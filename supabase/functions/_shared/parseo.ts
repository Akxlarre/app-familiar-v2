// Interpretación de los correos bancarios chilenos.
//
// Es la parte más frágil del sistema (RB-01): cada banco tiene su formato y
// cambia sin avisar. Por eso vive acá, aislada y con pruebas propias
// (`parseo.test.ts`), en vez de estar embebida en el flujo de la función.
//
// Los patrones concretos NO están acá: viven en `parsers_email`, que es
// configuración editable sin desplegar.

export interface ReglasParser {
  regex_monto: string;
  regex_comercio?: string | null;
  regex_fecha?: string | null;
  regex_cuota?: string | null;
  regex_tarjeta?: string | null;
}

export interface DatosExtraidos {
  monto: number | null;
  comercio: string | null;
  cuotaActual: number | null;
  cuotasTotal: number | null;
  tarjeta: string | null;
  confianza: number;
}

/**
 * Convierte un monto escrito a la chilena en un entero de pesos.
 *
 * El peso no tiene decimales (RB-04), así que "$15.990" son quince mil
 * novecientos noventa pesos y NO 15,99. Interpretar el punto como separador
 * decimal —que es lo que hace parseFloat— divide todos los montos por mil.
 *
 *   "$15.990"      → 15990
 *   "1.234.567"    → 1234567
 *   "$ 4.500.-"    → 4500
 *   "15990"        → 15990
 *   "12.500,00"    → 12500   (algunos bancos escriben decimales; se descartan)
 */
export function montoChileno(texto: string): number | null {
  if (!texto) return null;

  let limpio = texto.replace(/[$\s]/g, '').replace(/\.-$/, '');

  // Si hay coma, es el separador decimal: se corta ahí. Los puntos que queden
  // a la izquierda son siempre de miles.
  const coma = limpio.indexOf(',');
  if (coma !== -1) limpio = limpio.slice(0, coma);

  limpio = limpio.replace(/\./g, '');

  const soloDigitos = limpio.match(/-?\d+/)?.[0];
  if (!soloDigitos) return null;

  const n = parseInt(soloDigitos, 10);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

/** Primer grupo de captura, o el match completo si la regex no tiene grupos. */
function primerGrupo(texto: string, patron: string | null | undefined): string | null {
  if (!patron) return null;
  try {
    const m = texto.match(new RegExp(patron, 'i'));
    if (!m) return null;
    return (m[1] ?? m[0] ?? '').trim() || null;
  } catch {
    // Una regex inválida en la configuración no puede tumbar el procesamiento
    // de todos los correos: se ignora ese campo.
    return null;
  }
}

/**
 * Normaliza el texto de un comercio para poder compararlo entre correos.
 * "UBER   *TRIP 123" y "uber *trip 456" tienen que caer en el mismo alias.
 */
export function normalizarComercio(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // saca tildes
    .replace(/\d+/g, ' ')                               // los números varían por transacción
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae "Cuota 3 de 12" en sus dos números (RB-03). */
function extraerCuota(texto: string, patron: string | null | undefined): [number | null, number | null] {
  if (!patron) return [null, null];
  try {
    const m = texto.match(new RegExp(patron, 'i'));
    if (!m) return [null, null];
    const actual = m[1] ? parseInt(m[1], 10) : NaN;
    const total = m[2] ? parseInt(m[2], 10) : NaN;
    return [
      Number.isFinite(actual) ? actual : null,
      Number.isFinite(total) ? total : null,
    ];
  } catch {
    return [null, null];
  }
}

/**
 * Aplica las reglas del parser al cuerpo del correo.
 *
 * `confianza` decide si el movimiento se crea solo o queda en la bandeja:
 * sin monto no hay nada que registrar, y sin comercio hay un movimiento pero
 * nadie sabe de qué.
 */
export function extraerDatos(cuerpo: string, reglas: ReglasParser): DatosExtraidos {
  const montoTexto = primerGrupo(cuerpo, reglas.regex_monto);
  const monto = montoTexto ? montoChileno(montoTexto) : null;

  const comercioTexto = primerGrupo(cuerpo, reglas.regex_comercio);
  const comercio = comercioTexto ? comercioTexto.replace(/\s+/g, ' ').trim() : null;

  const [cuotaActual, cuotasTotal] = extraerCuota(cuerpo, reglas.regex_cuota);
  const tarjeta = primerGrupo(cuerpo, reglas.regex_tarjeta);

  let confianza = 0;
  if (monto != null && monto > 0) confianza += 60;
  if (comercio) confianza += 25;
  if (tarjeta) confianza += 10;
  if (cuotasTotal) confianza += 5;

  return { monto, comercio, cuotaActual, cuotasTotal, tarjeta, confianza };
}

/**
 * Elige el parser que corresponde al correo.
 *
 * Gana el que además del remitente coincide en asunto: un banco manda muchos
 * tipos de correo desde la misma dirección, y el asunto es lo único que
 * distingue un cargo de un pago recibido.
 */
export function elegirParser<T extends { remitente_patron: string; asunto_patron?: string | null }>(
  parsers: T[],
  remitente: string,
  asunto: string,
): T | null {
  const rem = remitente.toLowerCase();
  const asu = asunto.toLowerCase();

  const porRemitente = parsers.filter((p) => rem.includes(p.remitente_patron.toLowerCase()));
  if (porRemitente.length === 0) return null;

  const conAsunto = porRemitente.find(
    (p) => p.asunto_patron?.trim() && asu.includes(p.asunto_patron.trim().toLowerCase()),
  );
  if (conAsunto) return conAsunto;

  // Sin coincidencia de asunto, sólo sirve un parser que no exija asunto.
  // v1 caía al primero de la lista, y así un "pago recibido" se registraba con
  // las reglas de un cargo.
  return porRemitente.find((p) => !p.asunto_patron?.trim()) ?? null;
}

/** Fecha del correo en la zona horaria del hogar, como YYYY-MM-DD. */
export function fechaEnZona(fecha: Date | null, zona: string): string {
  const d = fecha ?? new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
