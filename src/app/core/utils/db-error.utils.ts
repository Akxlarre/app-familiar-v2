/**
 * Sanitización de errores de base de datos para la UI.
 *
 * Los mensajes crudos de PostgreSQL exponen nombres de tablas, columnas y
 * constraints. Nunca deben llegar al usuario: la UI muestra algo accionable en
 * español y el error real queda en consola para diagnóstico.
 *
 * La idea viene de `db-error.utils.ts` de autoescuela. Los mensajes se
 * generalizaron —los suyos hablan de alumnos y sedes— pero se conserva lo que
 * importa: el mapeo por SQLSTATE y la distinción entre lo que se puede mostrar
 * y lo que no.
 *
 * Es el ÚNICO sanitizador de la app. `BaseFacade.sanitizeError` delega acá: dos
 * implementaciones que tienen que decir lo mismo terminan diciendo distinto.
 */

/** Forma mínima de un error de PostgREST/Supabase. */
interface ErrorTipoPostgrest {
  code?: string;
  message?: string;
}

function esDePostgrest(err: unknown): err is ErrorTipoPostgrest {
  return typeof err === 'object' && err !== null && ('code' in err || 'message' in err);
}

/**
 * Error de BD que conserva el SQLSTATE.
 *
 * Los repositories lanzan `Error` para cumplir el contrato de `BaseFacade`, y al
 * hacerlo con `new Error(error.message)` se pierde `error.code` — que es el dato
 * MÁS confiable que trae PostgREST. Sin él, el mapeo por SQLSTATE de abajo nunca
 * se ejecuta y todo cae en la heurística por texto.
 */
export class ErrorDeBd extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ErrorDeBd';
    this.code = code;
  }
}

/**
 * Mensajes por código SQLSTATE. Son genéricos a propósito: el contexto lo pone
 * el `fallback` de quien llama ("No se pudo crear el movimiento").
 */
const POR_SQLSTATE: Record<string, string> = {
  // unique_violation
  '23505': 'Ya existe un registro con estos datos.',
  // not_null_violation
  '23502': 'Faltan datos obligatorios.',
  // check_violation
  '23514': 'Los datos no cumplen una restricción del sistema.',
  // foreign_key_violation
  '23503': 'Hay datos relacionados que impiden completar la operación.',
  // insufficient_privilege — típicamente RLS
  '42501': 'No tienes permisos para realizar esta acción.',
  // serialization_failure
  '40001': 'La operación chocó con otro cambio simultáneo. Intenta de nuevo.',
};

/**
 * Segunda línea, para cuando no hay SQLSTATE: fallas de red y de RLS que llegan
 * como texto (el fetch de supabase-js nunca trae código, y PostgREST devuelve
 * el 403 de RLS con un mensaje que nombra la tabla).
 *
 * Se compara contra el mensaje crudo, nunca se muestra.
 */
const POR_TEXTO: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /network|fetch|timeout|offline/i,
    'Error de conexión. Verifica tu internet e intenta de nuevo.',
  ],
  [
    /row-level security|permission|policy|\brls\b|\b403\b/i,
    'No tienes permisos para realizar esta acción.',
  ],
];

/**
 * Traduce un error de BD a un mensaje seguro. Nunca incluye el texto original.
 *
 * El orden importa: lo que levantan nuestros propios triggers gana sobre
 * cualquier mapeo genérico, porque es más específico y ya está escrito para el
 * usuario.
 *
 * @param err       Error capturado.
 * @param fallback  Mensaje contextual de quien llama.
 * @param tokens    Mensajes que NUESTROS triggers levantan a propósito
 *                  (`RAISE EXCEPTION 'La captura ya fue procesada'`). Son un
 *                  contrato UI↔BD, no filtran esquema, y decir "error
 *                  inesperado" en su lugar sería peor para el usuario.
 */
export function mensajeSeguroDeBd(
  err: unknown,
  fallback: string,
  tokens: readonly string[] = [],
): string {
  if (!esDePostgrest(err)) return fallback;

  const crudo = err.message ?? '';

  const deNuestro = tokens.find((t) => crudo.includes(t));
  if (deNuestro) return deNuestro;

  if (err.code && POR_SQLSTATE[err.code]) return POR_SQLSTATE[err.code];

  const porTexto = POR_TEXTO.find(([re]) => re.test(crudo));
  if (porTexto) return porTexto[1];

  // Sin código ni patrón conocido, el texto crudo no se muestra jamás.
  return fallback;
}
