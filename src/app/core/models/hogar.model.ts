/**
 * Hogar — la unidad de todo lo que la app guarda.
 *
 * Hay uno por familia y todos sus miembros ven lo mismo (REQ-001, R-02). No hay
 * jerarquía: quien crea el hogar y quien se une tienen los mismos permisos.
 */
export interface Hogar {
  id: string;
  nombre: string;
  /** Seis caracteres, sin vocales ni dígitos ambiguos. Se dicta en voz alta. */
  inviteCode: string;
  zonaHoraria: string;
  creadoEn: string;
}

/**
 * En qué punto del onboarding está el usuario.
 *
 * **Se deriva del estado real, nunca se guarda.** Una columna `onboarding_step`
 * miente el día que alguien desconecta su correo: diría "listo" con la cadena
 * apagada. Derivarlo también resuelve retomar donde se quedó (AC-E1) sin
 * escribir nada — el paso se recalcula al entrar.
 */
export type PasoDeOnboarding = 'hogar' | 'banco' | 'correo' | 'listo';

/** Lo que hace falta para saber en qué paso está alguien. */
export interface EstadoDeOnboarding {
  tieneHogar: boolean;
  tieneCuenta: boolean;
  tieneCorreoConectado: boolean;
}

/** Los pasos en orden, para el indicador de progreso. */
export const PASOS_DE_ONBOARDING: readonly PasoDeOnboarding[] = [
  'hogar',
  'banco',
  'correo',
  'listo',
] as const;

/**
 * El primer paso sin completar.
 *
 * El orden importa y no es arbitrario: sin hogar no hay dónde poner una cuenta,
 * y sin cuenta las capturas del correo quedan sin poder convertirse en
 * movimientos (AC13).
 */
export function pasoActual(estado: EstadoDeOnboarding): PasoDeOnboarding {
  if (!estado.tieneHogar) return 'hogar';
  if (!estado.tieneCuenta) return 'banco';
  if (!estado.tieneCorreoConectado) return 'correo';
  return 'listo';
}

/** Si el onboarding terminó. Sólo entonces `/app` tiene algo que mostrar. */
export function onboardingCompleto(estado: EstadoDeOnboarding): boolean {
  return pasoActual(estado) === 'listo';
}

/** Para el "Paso N de 4" del encabezado. */
export function numeroDePaso(paso: PasoDeOnboarding): number {
  return PASOS_DE_ONBOARDING.indexOf(paso) + 1;
}
