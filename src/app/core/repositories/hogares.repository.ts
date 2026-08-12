import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { EstadoDeOnboarding, Hogar } from '@core/models/hogar.model';

interface HogarRow {
  id: string;
  nombre: string;
  invite_code: string;
  timezone: string;
  created_at: string;
}

function aDominio(row: HogarRow): Hogar {
  return {
    id: row.id,
    nombre: row.nombre,
    inviteCode: row.invite_code,
    zonaHoraria: row.timezone,
    creadoEn: row.created_at,
  };
}

/**
 * HogaresRepository — único lugar que consulta `households`.
 *
 * Crear y unirse van por RPC y no por INSERT desde el cliente: el `invite_code`
 * se genera en la base, que es la única capaz de garantizar unicidad sin
 * exponer la tabla entera para comprobar si un código ya existe.
 */
@Injectable({ providedIn: 'root' })
export class HogaresRepository {
  private client = inject(SupabaseService).db;

  /** El hogar del usuario, o null si todavía no tiene. */
  async miHogar(): Promise<Hogar | null> {
    const { data, error } = await this.client
      .from('households')
      .select('id, nombre, invite_code, timezone, created_at')
      .maybeSingle();

    if (error) throw new ErrorDeBd(error.message, error.code);
    return data ? aDominio(data as HogarRow) : null;
  }

  async crear(nombre: string): Promise<Hogar> {
    const { data, error } = await this.client.rpc('create_household', { p_nombre: nombre });
    if (error) throw new ErrorDeBd(error.message, error.code);
    return aDominio(data as HogarRow);
  }

  /**
   * Unirse con el código de otro hogar.
   *
   * El código se manda tal cual lo escribió el usuario: normalizarlo acá crearía
   * una segunda implementación que tendría que coincidir con la del SQL para
   * siempre.
   */
  async unirse(codigo: string): Promise<Hogar> {
    const { data, error } = await this.client.rpc('join_household_by_code', { p_code: codigo });
    if (error) throw new ErrorDeBd(error.message, error.code);
    return aDominio(data as HogarRow);
  }

  /**
   * Lo necesario para saber en qué paso del onboarding está el usuario.
   *
   * Tres conteos y no tres cargas completas: sólo importa si hay algo, y traer
   * las filas para contarlas es cómo una comprobación barata se vuelve cara sin
   * que nadie toque su código.
   */
  async estadoDeOnboarding(): Promise<EstadoDeOnboarding> {
    const [hogar, cuentas, correos] = await Promise.all([
      this.client.from('households').select('id', { count: 'exact', head: true }),
      this.client.from('cuentas').select('id', { count: 'exact', head: true }),
      this.client
        .from('mis_integraciones_email')
        .select('id', { count: 'exact', head: true })
        .eq('conectada', true),
    ]);

    for (const r of [hogar, cuentas, correos]) {
      if (r.error) throw new ErrorDeBd(r.error.message, r.error.code);
    }

    return {
      tieneHogar: (hogar.count ?? 0) > 0,
      tieneCuenta: (cuentas.count ?? 0) > 0,
      tieneCorreoConectado: (correos.count ?? 0) > 0,
    };
  }
}
