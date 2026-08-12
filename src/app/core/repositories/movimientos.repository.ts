import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { Movimiento, TipoDeMovimiento } from '@core/models/movimiento.model';

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
 * Hoy tiene **un solo método**, el que necesita la pantalla Hoy (AC11 de la
 * spec 0003). El listado con filtros, rangos y paginación es de la spec 0005:
 * agregarlo antes de que exista su pantalla sería código sin llamador, que es
 * el que se pudre sin que nadie lo note.
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
}
