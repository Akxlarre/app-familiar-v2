import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { Movimiento, TipoDeMovimiento } from '@core/models/movimiento.model';
import type { FiltroMovimientos, GastoPorCategoria, ResumenPeriodo } from '@core/models/plata.model';
import { conPorcentaje } from '@core/models/plata.model';

/** Fila cruda de `movimientos`, con los nombres de columna de la BD. */
interface MovimientoRow {
  id: string;
  monto: number;
  tipo: string;
  fecha: string;
  comercio: string | null;
  nota: string | null;
  captura_id: string | null;
  created_at: string;
}

function aDominio(row: MovimientoRow): Movimiento {
  return {
    id: row.id,
    monto: row.monto,
    tipo: row.tipo as TipoDeMovimiento,
    fecha: row.fecha,
    comercio: row.comercio,
    nota: row.nota,
    capturaId: row.captura_id,
    creadoEn: row.created_at,
  };
}

const COLUMNAS = 'id, monto, tipo, fecha, comercio, nota, captura_id, created_at';

/**
 * MovimientosRepository — único lugar que consulta `movimientos`.
 *
 * El filtro por hogar no va acá: lo aplica RLS. Ponerlo también en el cliente
 * daría la impresión de que es lo que protege los datos.
 */
@Injectable({ providedIn: 'root' })
export class MovimientosRepository {
  private client = inject(SupabaseService).db;

  /** Los últimos movimientos, de más nuevo a más viejo. */
  async ultimos(limite = 5): Promise<Movimiento[]> {
    const { data, error } = await this.client
      .from('movimientos')
      .select(COLUMNAS)
      // Por fecha y, a igualdad, por creación: varios movimientos del mismo día
      // es lo normal, y sin el segundo criterio el orden sería arbitrario.
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) throw new ErrorDeBd(error.message, error.code);
    return ((data ?? []) as MovimientoRow[]).map(aDominio);
  }

  /**
   * Una página de movimientos del período, con los filtros aplicados.
   *
   * `range` es paginación por **offset**: Postgres recorre y descarta las filas
   * anteriores, así que cada página cuesta un poco más que la anterior. Con un
   * mes de movimientos —decenas— no se nota, y el índice
   * `(household_id, fecha DESC)` hace barato el recorrido.
   *
   * Si algún día el período pasa a ser "todo" y se llega a miles de filas, esto
   * se cambia por un cursor sobre `(fecha, created_at)`. No se hace ahora
   * porque un cursor obliga a arrastrar la última fila vista por toda la UI, y
   * es complejidad comprada para un volumen que no existe.
   */
  async pagina(filtro: FiltroMovimientos, limite: number, saltar = 0): Promise<Movimiento[]> {
    let query = this.client
      .from('movimientos')
      .select(COLUMNAS)
      .gte('fecha', filtro.desde)
      .lte('fecha', filtro.hasta)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .range(saltar, saltar + limite - 1);

    if (filtro.cuentaId) query = query.eq('cuenta_id', filtro.cuentaId);
    if (filtro.categoriaId) query = query.eq('categoria_id', filtro.categoriaId);
    if (filtro.tipo) query = query.eq('tipo', filtro.tipo);
    // `ilike` y no `like`: el comercio llega del banco en mayúsculas y nadie
    // busca "JUMBO" escribiendo en mayúsculas.
    if (filtro.texto.trim()) query = query.ilike('comercio', `%${filtro.texto.trim()}%`);

    const { data, error } = await query;
    if (error) throw new ErrorDeBd(error.message, error.code);
    return ((data ?? []) as MovimientoRow[]).map(aDominio);
  }

  /** Los tres números del período. Los suma la base (AC6). */
  async resumen(desde: string, hasta: string): Promise<ResumenPeriodo> {
    const { data, error } = await this.client.rpc('resumen_del_periodo', {
      p_desde: desde,
      p_hasta: hasta,
    });

    if (error) throw new ErrorDeBd(error.message, error.code);
    const fila = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
    return {
      gastado: fila?.['gastado'] ?? 0,
      ingresado: fila?.['ingresado'] ?? 0,
      saldo: fila?.['saldo'] ?? 0,
      movimientos: fila?.['movimientos'] ?? 0,
    };
  }

  /** El reparto por categoría, de mayor a menor (AC7). */
  async porCategoria(desde: string, hasta: string): Promise<GastoPorCategoria[]> {
    const { data, error } = await this.client.rpc('gasto_por_categoria', {
      p_desde: desde,
      p_hasta: hasta,
    });

    if (error) throw new ErrorDeBd(error.message, error.code);
    return conPorcentaje(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        categoriaId: (r['categoria_id'] as string | null) ?? null,
        categoria: r['categoria'] as string,
        total: r['total'] as number,
        movimientos: r['movimientos'] as number,
      })),
    );
  }
}
