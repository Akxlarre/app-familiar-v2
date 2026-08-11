// Lógica pura sobre capturas, compartida entre las funciones que las escriben.
//
// Vive acá y no dentro de una función porque `reprocesar-capturas` necesita
// tomar exactamente la misma decisión que `process-bank-emails` tomó la primera
// vez: si dos versiones de "¿alcanza para resolverse solo?" divergen, el
// reproceso empieza a contradecir al proceso original.

import { elegirParser, extraerDatos, type DatosExtraidos, type ReglasParser } from './parseo.ts';

/** Sin monto no se llega nunca a este número (ver `extraerDatos`). */
export const CONFIANZA_MINIMA = 60;

/**
 * Motivo legible de por qué una captura quedó en la bandeja.
 *
 * `motivo` se muestra TAL CUAL en la pantalla del usuario, así que nunca puede
 * llevar el mensaje crudo de Postgres — nombra tablas, columnas y constraints.
 *
 * No es el gemelo Deno de `mensajeSeguroDeBd` del frontend: aquel traduce el
 * error de una acción que el usuario acaba de hacer ("no tienes permisos"),
 * este explica por qué algo automático no pudo terminar. Distinto momento,
 * distinta audiencia, y por eso son tres casos y no seis.
 */
export function motivoSeguro(codigo?: string): string {
  if (codigo === '23503') return 'La cuenta o la categoría de este parser ya no existe';
  if (codigo === '42501') return 'El sistema no tiene permiso para crear el movimiento';
  return 'No se pudo crear el movimiento automáticamente';
}

/** Lo mínimo de una captura para poder reinterpretarla. */
export interface CapturaReinterpretable {
  id: string;
  parser_id: string | null;
  payload: { remitente?: string; asunto?: string; extracto?: string } | null;
  interpretado: Record<string, unknown> | null;
}

export interface ParserActivo extends ReglasParser {
  id: string;
  banco: string;
  tipo: string;
  remitente_patron: string;
  asunto_patron: string | null;
  cuenta_id: string | null;
}

/**
 * ¿Le falta algo a esta interpretación para resolverse sola? `null` si alcanza.
 *
 * La usan las DOS funciones que escriben capturas: `process-bank-emails` sobre
 * el correo recién bajado, y `reprocesar-capturas` sobre el texto guardado. Si
 * cada una tuviera su versión, el reproceso empezaría a contradecir al proceso
 * original — dejaría pendiente algo que la otra resolvió, o al revés.
 */
export function motivoDeFaltante(
  datos: Pick<DatosExtraidos, 'confianza'>,
  cuentaId: string | null,
  confianzaMinima = CONFIANZA_MINIMA,
): string | null {
  if (datos.confianza < confianzaMinima) return 'No se pudo leer el monto';
  if (!cuentaId) return 'El parser no tiene cuenta asociada';
  return null;
}

export interface Replanteo {
  /** El parser que ahora corresponde. `null` si ninguno matchea el correo. */
  parser: ParserActivo | null;
  datos: DatosExtraidos | null;
  /** ¿Ya alcanza para que el usuario la confirme de un toque? */
  resuelta: boolean;
  /** Por qué sigue sin alcanzar. `null` cuando `resuelta`. */
  motivo: string | null;
}

/**
 * Vuelve a interpretar una captura con las reglas de HOY.
 *
 * El caso que justifica todo esto: se arregla un regex y quedan capturas viejas
 * atascadas. Volver a correr `process-bank-emails` no las alcanza — lista los
 * correos de Gmail de los últimos 90 días, y una captura de hace cuatro meses
 * ya no aparece ahí.
 *
 * Se re-elige el parser en vez de reusar `parser_id`, porque el arreglo puede
 * haber sido justamente agregar un parser nuevo para ese remitente.
 *
 * **Limitación conocida:** se reinterpreta sobre `payload.extracto`, que son los
 * primeros 500 caracteres del cuerpo. Un regex que necesite texto más abajo no
 * va a matchear en el reproceso aunque sea correcto. Guardar el correo entero
 * sería peor: son datos bancarios y el payload no se borra (R-06).
 */
export function replantearCaptura(
  captura: CapturaReinterpretable,
  parsers: ParserActivo[],
  confianzaMinima = CONFIANZA_MINIMA,
): Replanteo {
  const cuerpo = captura.payload?.extracto?.trim() ?? '';
  if (!cuerpo) {
    return { parser: null, datos: null, resuelta: false, motivo: 'No quedó texto del correo para reinterpretar' };
  }

  const parser = elegirParser(parsers, captura.payload?.remitente ?? '', captura.payload?.asunto ?? '');
  if (!parser) {
    return { parser: null, datos: null, resuelta: false, motivo: 'Ningún parser activo reconoce este correo' };
  }

  const datos = extraerDatos(cuerpo, parser);
  const motivo = motivoDeFaltante(datos, parser.cuenta_id, confianzaMinima);

  return { parser, datos, resuelta: motivo === null, motivo };
}
