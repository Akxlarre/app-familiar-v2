import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { Movimiento, TipoDeMovimiento } from '@core/models/movimiento.model';
import type {
  Categoria,
  FiltroMovimientos,
  GastoPorCategoria,
  OrigenDelMovimiento,
  ResumenPeriodo,
} from '@core/models/plata.model';
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

  /**
   * Los tres números, **sobre lo filtrado** (AC6, AC13).
   *
   * Recibe el filtro completo y no sólo el período: con un filtro puesto, un
   * hero que suma todo el mes dice una cosa mientras la lista dice otra, y el
   * usuario filtró justamente para saber cuánto es eso.
   */
  async resumen(filtro: FiltroMovimientos): Promise<ResumenPeriodo> {
    const { data, error } = await this.client.rpc('resumen_del_periodo', {
      p_desde: filtro.desde,
      p_hasta: filtro.hasta,
      p_cuenta_id: filtro.cuentaId,
      p_categoria_id: filtro.categoriaId,
      p_tipo: filtro.tipo,
      p_texto: filtro.texto.trim() || null,
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

  /** El reparto por categoría, de mayor a menor y sobre lo filtrado (AC7, AC13). */
  async porCategoria(filtro: FiltroMovimientos): Promise<GastoPorCategoria[]> {
    const { data, error } = await this.client.rpc('gasto_por_categoria', {
      p_desde: filtro.desde,
      p_hasta: filtro.hasta,
      p_cuenta_id: filtro.cuentaId,
      p_categoria_id: filtro.categoriaId,
      p_texto: filtro.texto.trim() || null,
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

  /** Las categorías del hogar, para el selector. */
  async categorias(): Promise<Categoria[]> {
    const { data, error } = await this.client
      .from('categorias_gasto')
      .select('id, nombre, icono')
      .order('nombre');

    if (error) throw new ErrorDeBd(error.message, error.code);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r['id'] as string,
      nombre: r['nombre'] as string,
      icono: (r['icono'] as string | null) ?? null,
    }));
  }

  /** El correo del que nació el movimiento (AC5). */
  async origen(capturaId: string): Promise<OrigenDelMovimiento | null> {
    const { data, error } = await this.client
      .from('capturas')
      .select('payload, created_at')
      .eq('id', capturaId)
      .maybeSingle();

    if (error) throw new ErrorDeBd(error.message, error.code);
    if (!data) return null;

    const fila = data as { payload: Record<string, string> | null; created_at: string };
    return {
      remitente: fila.payload?.['remitente'] ?? null,
      asunto: fila.payload?.['asunto'] ?? null,
      extracto: fila.payload?.['extracto'] ?? null,
      fechaCaptura: fila.created_at,
    };
  }

  /**
   * Cuántos OTROS movimientos comparten comercio y cambiarían de categoría.
   *
   * El número va a la vista antes de aceptar (AC11): "también aplicar a los 14
   * anteriores de JUMBO" deja evaluar; preguntarlo a ciegas, no.
   */
  async contarMismoComercio(movimientoId: string, categoriaId: string): Promise<number> {
    const { data, error } = await this.client.rpc('contar_mismo_comercio', {
      p_movimiento_id: movimientoId,
      p_categoria_id: categoriaId,
    });

    if (error) throw new ErrorDeBd(error.message, error.code);
    return (data as number) ?? 0;
  }

  /** Corrige la categoría y, si se pide, aprende el comercio. Devuelve cuántos cambió. */
  async recategorizar(
    movimientoId: string,
    categoriaId: string,
    recordar: boolean,
    aplicarPasados: boolean,
  ): Promise<number> {
    const { data, error } = await this.client.rpc('recategorizar_movimiento', {
      p_movimiento_id: movimientoId,
      p_categoria_id: categoriaId,
      p_recordar: recordar,
      p_aplicar_pasados: aplicarPasados,
    });

    if (error) throw new ErrorDeBd(error.message, error.code);
    return (data as number) ?? 0;
  }

  /** Borra el movimiento. Su captura vuelve a la bandeja (AC12, RN-09). */
  async borrar(movimientoId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('borrar_movimiento', {
      p_movimiento_id: movimientoId,
    });

    if (error) throw new ErrorDeBd(error.message, error.code);
    return (data as boolean) ?? false;
  }
}