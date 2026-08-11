/**
 * Captura — un dato que entró al sistema sin que nadie lo escribiera.
 *
 * Ver `context/domain.md`. Una captura queda en la bandeja hasta que alguien la
 * confirma o la descarta: nunca se pierde y nunca se descarta sola (RN-09).
 */

export type OrigenCaptura = 'email' | 'boleta';

export type EstadoCaptura =
  | 'pendiente'
  | 'procesada'
  | 'requiere_revision'
  | 'descartada';

/** El dato crudo, tal como llegó. */
export interface PayloadCaptura {
  remitente?: string;
  asunto?: string;
  extracto?: string;
  /** Boletas: ruta de la imagen en Storage. */
  imagen?: string;
}

/** Lo que el parser entendió. Puede estar incompleto: por eso hay bandeja. */
export interface InterpretacionCaptura {
  monto?: number | null;
  comercio?: string | null;
  cuotaActual?: number | null;
  cuotasTotal?: number | null;
  tarjeta?: string | null;
  confianza?: number;
  fecha?: string;
  banco?: string;
  tipo?: string;
}

export interface Captura {
  id: string;
  origen: OrigenCaptura;
  estado: EstadoCaptura;
  payload: PayloadCaptura;
  interpretado: InterpretacionCaptura | null;
  motivo: string | null;
  intentos: number;
  fechaOrigen: string | null;
  creadaEn: string;
}

/** Lo que el usuario corrige al resolver una captura desde la bandeja. */
export interface ResolucionCaptura {
  monto: number;
  comercio: string | null;
  /** `null` deja que el RPC resuelva: alias del comercio, si no la categoría base. */
  categoriaId: string | null;
  /** `null` deja que el RPC use la cuenta configurada en el parser de origen. */
  cuentaId: string | null;
  fecha: string;
  tipo: 'gasto' | 'ingreso';
  /** Si es true, se recuerda la categoría para este comercio (REQ-013). */
  recordarComercio: boolean;
}

/**
 * ¿Qué le falta a esta captura para poder resolverse sola?
 * Se usa para ordenar la bandeja: primero lo que sólo necesita un toque.
 */
export function faltaDeCaptura(captura: Captura): 'monto' | 'comercio' | 'cuenta' | null {
  const i = captura.interpretado;
  if (!i?.monto) return 'monto';
  if (!i.comercio) return 'comercio';
  if (captura.motivo?.toLowerCase().includes('cuenta')) return 'cuenta';
  return null;
}

/** Una captura sin monto no se puede resolver sin escribirlo a mano. */
export function requiereEscribirMonto(captura: Captura): boolean {
  return !captura.interpretado?.monto;
}
