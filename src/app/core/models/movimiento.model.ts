/**
 * Movimiento — plata que entró o salió.
 *
 * Casi siempre nace de una captura (REQ-011): `capturaId` es null sólo cuando
 * lo escribió una persona a mano, que es la excepción y no la regla.
 */

export type TipoDeMovimiento = 'gasto' | 'ingreso';

export interface Movimiento {
  id: string;
  /**
   * En pesos chilenos, sin decimales.
   *
   * La columna es BIGINT a propósito: el peso no tiene centavos, y guardar
   * plata en punto flotante es cómo se acumulan diferencias de un peso que
   * después nadie explica.
   */
  monto: number;
  tipo: TipoDeMovimiento;
  /** `YYYY-MM-DD`. Es la fecha del movimiento, no la de captura. */
  fecha: string;
  comercio: string | null;
  nota: string | null;
  /** null = lo cargó una persona a mano. */
  capturaId: string | null;
  creadoEn: string;
}
