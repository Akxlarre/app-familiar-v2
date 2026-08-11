import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import type {
  Captura,
  EstadoCaptura,
  InterpretacionCaptura,
  PayloadCaptura,
  ResolucionCaptura,
} from '@core/models/captura.model';

/** Fila cruda de `capturas`, con los nombres de columna de la BD. */
interface CapturaRow {
  id: string;
  origen: string;
  estado: string;
  payload: PayloadCaptura | null;
  interpretado: InterpretacionCaptura | null;
  motivo: string | null;
  intentos: number;
  fecha_origen: string | null;
  created_at: string;
}

function aDominio(row: CapturaRow): Captura {
  return {
    id: row.id,
    origen: row.origen as Captura['origen'],
    estado: row.estado as EstadoCaptura,
    payload: row.payload ?? {},
    interpretado: row.interpretado,
    motivo: row.motivo,
    intentos: row.intentos,
    fechaOrigen: row.fecha_origen,
    creadaEn: row.created_at,
  };
}

const COLUMNAS = 'id, origen, estado, payload, interpretado, motivo, intentos, fecha_origen, created_at';

/**
 * CapturasRepository — único lugar que consulta `capturas`.
 *
 * Un método por query, y siempre devuelve el modelo de dominio: la UI nunca ve
 * los nombres de columna ni el objeto crudo de Supabase.
 */
@Injectable({ providedIn: 'root' })
export class CapturasRepository {
  private client = inject(SupabaseService).db;

  /** Lo que espera resolución en la bandeja: pendientes y en revisión. */
  async pendientes(): Promise<Captura[]> {
    const { data, error } = await this.client
      .from('capturas')
      .select(COLUMNAS)
      .in('estado', ['pendiente', 'requiere_revision'])
      .order('fecha_origen', { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return ((data ?? []) as CapturaRow[]).map(aDominio);
  }

  /**
   * Confirma una captura: crea el movimiento y la marca procesada.
   *
   * Va por RPC y no por dos escrituras desde el cliente porque tiene que ser
   * atómico — si el movimiento se crea y la captura no se marca, el próximo
   * reproceso la ve pendiente y duplica.
   */
  async resolver(capturaId: string, resolucion: ResolucionCaptura): Promise<void> {
    // El comercio va crudo: normalizarlo es tarea del RPC. Hacerlo acá crearía
    // una segunda implementación que tendría que coincidir con la de SQL para
    // siempre — y el día que difieran, los alias dejan de aplicarse en silencio.
    const { error } = await this.client.rpc('resolver_captura', {
      p_captura_id: capturaId,
      p_monto: resolucion.monto,
      p_comercio: resolucion.comercio,
      p_categoria_id: resolucion.categoriaId,
      p_cuenta_id: resolucion.cuentaId,
      p_fecha: resolucion.fecha,
      p_tipo: resolucion.tipo,
      p_recordar: resolucion.recordarComercio,
    });

    if (error) throw new Error(error.message);
  }

  /** Descarta una captura: no es un movimiento (publicidad, aviso, duplicado). */
  async descartar(capturaId: string, motivo: string): Promise<void> {
    const { error } = await this.client
      .from('capturas')
      .update({ estado: 'descartada', motivo, updated_at: new Date().toISOString() })
      .eq('id', capturaId);

    if (error) throw new Error(error.message);
  }
}
