/**
 * Integridad de enlaces entre specs.
 *
 * Una spec cerrada no es un documento independiente: cuando una spec nueva
 * decide algo, suele **modificar** specs ya escritas. Y ese cambio hoy se hace
 * a mano, en las dos puntas, sin nada que lo verifique.
 *
 * El caso que originó esto: al cerrar "las cuotas viven adentro de Deudas", hubo
 * que ir a la spec 0007 a tachar dos AC y a la 0008 a agregar uno. Nada rastreaba
 * esa dependencia. Olvidarse de una punta deja la spec vieja prometiendo algo que
 * ya vive en otro lado — y no se nota hasta construirla.
 *
 * Es el mismo patrón que `nav-integrity` (rutas que el menú declara y no existen)
 * y `rule-wiring` (reglas registradas sin cablear): **un verificador de enlaces
 * que deberían existir en los dos sentidos.**
 *
 * El contrato es una línea en la cabecera de la spec:
 *
 *     > **Modifica:** 0007, 0008
 *
 * y la exigencia de que esas specs la mencionen de vuelta.
 */

/** Ids de spec: cuatro dígitos, que es como se nombran las carpetas. */
const ID = /\b(\d{4})\b/g;

/**
 * Qué specs declara modificar ésta.
 *
 * Se lee sólo de la línea `**Modifica:**`. Cualquier otra mención en el
 * documento es una referencia, no una declaración — y confundirlas haría que
 * la sección "Dependencias", que nombra media docena de specs, disparara
 * falsos positivos hasta que alguien apague el chequeo.
 */
export function extraerModifica(fuente) {
  const linea = fuente.match(/^>?\s*\*\*Modifica:\*\*\s*(.+)$/m);
  if (!linea) return [];
  const valor = linea[1];
  if (/ningun|—|^-$/i.test(valor.trim())) return [];
  return [...valor.matchAll(ID)].map((m) => m[1]);
}

/**
 * ¿Este documento menciona a la spec `id`?
 *
 * Alcanza con nombrarla: la forma natural de reconocer el cambio ya es escribir
 * "absorbido por AC1 de la spec 0025". Exigir una sintaxis específica en el lado
 * modificado convertiría una nota en prosa en un formulario, y nadie la escribiría.
 */
export function mencionaA(fuente, id) {
  return new RegExp(`\\b${id}\\b`).test(fuente);
}

/**
 * Marcas de que una spec fue modificada por otra.
 *
 * Sirven para la dirección inversa: alguien editó la spec de abajo —tachó un AC,
 * lo movió— y no lo registró en la de arriba. Sin esto, sólo se verificaría la
 * mitad del enlace.
 */
const ABSORBIDO = /(absorbid[oa]|reemplazad[oa]|movid[oa]|delegad[oa])\s+(?:por|a|en)\s+(?:el\s+|la\s+)?(?:AC\d+\s+de\s+la\s+)?spec\s+(\d{4})/gi;

export function extraerAbsorbidoPor(fuente) {
  return [...new Set([...fuente.matchAll(ABSORBIDO)].map((m) => m[2]))];
}

/**
 * Audita los enlaces de un conjunto de specs.
 *
 * @param {Array<{id:string, fuente:string}>} specs
 * @returns {{inexistentes:Array, sinAcuse:Array, sinDeclarar:Array}}
 */
export function auditarEnlaces(specs) {
  const porId = new Map(specs.map((s) => [s.id, s.fuente]));

  const inexistentes = [];
  const sinAcuse = [];
  const sinDeclarar = [];

  for (const { id, fuente } of specs) {
    for (const destino of extraerModifica(fuente)) {
      if (destino === id) continue;
      if (!porId.has(destino)) {
        inexistentes.push({ de: id, a: destino });
        continue;
      }
      // El enlace tiene dos puntas: declarar que se modifica algo y que ese algo
      // lo diga. Con una sola, la spec modificada sigue prometiendo lo viejo.
      if (!mencionaA(porId.get(destino), id)) {
        sinAcuse.push({ de: id, a: destino });
      }
    }
  }

  for (const { id, fuente } of specs) {
    for (const origen of extraerAbsorbidoPor(fuente)) {
      if (origen === id) continue;
      const fuenteOrigen = porId.get(origen);
      if (!fuenteOrigen) {
        inexistentes.push({ de: id, a: origen });
        continue;
      }
      if (!extraerModifica(fuenteOrigen).includes(id)) {
        sinDeclarar.push({ modificada: id, por: origen });
      }
    }
  }

  return { inexistentes, sinAcuse, sinDeclarar };
}
