import type { Movimiento } from '@core/models/movimiento.model';

/** Los tres números del período (AC6). */
export interface ResumenPeriodo {
  gastado: number;
  ingresado: number;
  saldo: number;
  movimientos: number;
}

/** Una porción del reparto por categoría (AC7). */
export interface GastoPorCategoria {
  categoriaId: string | null;
  categoria: string;
  total: number;
  movimientos: number;
  /** Sobre el total gastado del período. Lo calcula el cliente: es presentación. */
  porcentaje: number;
}

/**
 * Lo que se puede filtrar.
 *
 * Vive en la URL, no en memoria: recargar y perder el filtro es de las cosas
 * que hacen que una app se sienta un prototipo (AC14).
 */
export interface FiltroMovimientos {
  /** Primer día del período. `YYYY-MM-DD`. */
  desde: string;
  /** Último día del período, inclusive. */
  hasta: string;
  cuentaId: string | null;
  categoriaId: string | null;
  tipo: 'gasto' | 'ingreso' | null;
  texto: string;
}

/** Un día con sus movimientos, que es como la lista se agrupa (AC1). */
export interface DiaDeMovimientos {
  fecha: string;
  movimientos: readonly Movimiento[];
  /** Lo gastado ese día. Un ingreso no resta acá: se muestra aparte. */
  totalGastado: number;
}

/** El mes en curso, que es el período por defecto. */
export function periodoDelMes(referencia = new Date()): { desde: string; hasta: string } {
  const año = referencia.getFullYear();
  const mes = referencia.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // El día 0 del mes siguiente es el último del actual, sin tener que saber
  // cuántos días tiene ni acordarse de los años bisiestos.
  return { desde: iso(new Date(año, mes, 1)), hasta: iso(new Date(año, mes + 1, 0)) };
}

/** Corre el período N meses. Negativo va hacia atrás. */
export function moverPeriodo(desde: string, meses: number): { desde: string; hasta: string } {
  const [año, mes] = desde.split('-').map(Number);
  return periodoDelMes(new Date(año, mes - 1 + meses, 1));
}

/**
 * Agrupa por día conservando el orden que traía la consulta.
 *
 * No reordena: el orden lo decide el `ORDER BY` de la base, que es quien puede
 * hacerlo sobre el conjunto completo y no sólo sobre la página cargada.
 */
export function agruparPorDia(movimientos: readonly Movimiento[]): DiaDeMovimientos[] {
  const dias: DiaDeMovimientos[] = [];
  for (const m of movimientos) {
    let dia = dias[dias.length - 1];
    if (!dia || dia.fecha !== m.fecha) {
      dia = { fecha: m.fecha, movimientos: [], totalGastado: 0 };
      dias.push(dia);
    }
    (dia.movimientos as Movimiento[]).push(m);
    if (m.tipo === 'gasto') dia.totalGastado += m.monto;
  }
  return dias;
}

/** El porcentaje de cada categoría sobre el total. */
export function conPorcentaje(
  filas: ReadonlyArray<Omit<GastoPorCategoria, 'porcentaje'>>,
): GastoPorCategoria[] {
  const total = filas.reduce((suma, f) => suma + f.total, 0);
  // Sin gastos no hay reparto: dividir por cero daría NaN en pantalla.
  if (total === 0) return filas.map((f) => ({ ...f, porcentaje: 0 }));
  return filas.map((f) => ({ ...f, porcentaje: Math.round((f.total / total) * 1000) / 10 }));
}
