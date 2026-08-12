import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { BancoDelCatalogo, Cuenta, NuevaCuenta, TipoDeCuenta } from '@core/models/banco.model';

interface PlantillaRow {
  id: string;
  banco: string;
  tipo: string;
  remitente_patron: string;
  asunto_patron: string | null;
  regex_monto: string;
  regex_comercio: string | null;
  regex_fecha: string | null;
  regex_cuota: string | null;
  regex_tarjeta: string | null;
}

/**
 * BancosRepository — el catálogo de bancos y la primera cuenta del hogar.
 *
 * Elegir un banco **copia** sus plantillas a `parsers_email`. Copiar y no
 * referenciar es deliberado: cuando el formato de un banco cambia y alguien
 * corrige la plantilla global, los hogares que ya funcionaban no se ven
 * afectados por un cambio que no pidieron. La corrección se propaga
 * reprocesando lo atascado, no reescribiendo lo que ya anda.
 */
@Injectable({ providedIn: 'root' })
export class BancosRepository {
  private client = inject(SupabaseService).db;

  /** Los bancos del catálogo, con cuántas plantillas aporta cada uno. */
  async catalogo(): Promise<BancoDelCatalogo[]> {
    const { data, error } = await this.client
      .from('plantillas_parser')
      .select('banco')
      .eq('activa', true)
      .order('banco');

    if (error) throw new ErrorDeBd(error.message, error.code);

    const cuenta = new Map<string, number>();
    for (const fila of (data ?? []) as { banco: string }[]) {
      cuenta.set(fila.banco, (cuenta.get(fila.banco) ?? 0) + 1);
    }
    return [...cuenta.entries()].map(([banco, plantillas]) => ({ banco, plantillas }));
  }

  async cuentas(): Promise<Cuenta[]> {
    const { data, error } = await this.client
      .from('cuentas')
      .select('id, nombre, tipo, banco, last4, activa')
      .order('created_at');

    if (error) throw new ErrorDeBd(error.message, error.code);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r['id'] as string,
      nombre: r['nombre'] as string,
      tipo: r['tipo'] as TipoDeCuenta,
      banco: (r['banco'] as string | null) ?? null,
      last4: (r['last4'] as string | null) ?? null,
      activa: r['activa'] as boolean,
    }));
  }

  /**
   * Crea la cuenta y le engancha los parsers de su banco.
   *
   * Las dos cosas juntas porque una cuenta sin parsers no captura nada, y unos
   * parsers sin cuenta dejan las capturas en la bandeja con "el parser no tiene
   * cuenta asociada" (AC13). Separarlas es crear el estado intermedio que el
   * propio AC describe como problema.
   */
  async crearCuentaConParsers(hogarId: string, cuenta: NuevaCuenta): Promise<Cuenta> {
    const { data: creada, error: errCuenta } = await this.client
      .from('cuentas')
      .insert({
        household_id: hogarId,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        banco: cuenta.banco,
        last4: cuenta.last4,
      })
      .select('id, nombre, tipo, banco, last4, activa')
      .single();

    if (errCuenta) throw new ErrorDeBd(errCuenta.message, errCuenta.code);

    const nueva = creada as Record<string, unknown>;
    await this.copiarPlantillas(hogarId, cuenta.banco, nueva['id'] as string);

    return {
      id: nueva['id'] as string,
      nombre: nueva['nombre'] as string,
      tipo: nueva['tipo'] as TipoDeCuenta,
      banco: (nueva['banco'] as string | null) ?? null,
      last4: (nueva['last4'] as string | null) ?? null,
      activa: nueva['activa'] as boolean,
    };
  }

  /** Copia las plantillas del banco a `parsers_email`, ya apuntando a la cuenta. */
  private async copiarPlantillas(hogarId: string, banco: string, cuentaId: string): Promise<void> {
    const { data, error } = await this.client
      .from('plantillas_parser')
      .select('id, banco, tipo, remitente_patron, asunto_patron, regex_monto, regex_comercio, regex_fecha, regex_cuota, regex_tarjeta')
      .eq('banco', banco)
      .eq('activa', true);

    if (error) throw new ErrorDeBd(error.message, error.code);

    const plantillas = (data ?? []) as PlantillaRow[];
    if (plantillas.length === 0) return;

    const { error: errInsert } = await this.client.from('parsers_email').insert(
      plantillas.map((p) => ({
        household_id: hogarId,
        banco: p.banco,
        tipo: p.tipo,
        remitente_patron: p.remitente_patron,
        asunto_patron: p.asunto_patron,
        regex_monto: p.regex_monto,
        regex_comercio: p.regex_comercio,
        regex_fecha: p.regex_fecha,
        regex_cuota: p.regex_cuota,
        regex_tarjeta: p.regex_tarjeta,
        cuenta_id: cuentaId,
      })),
    );

    if (errInsert) throw new ErrorDeBd(errInsert.message, errInsert.code);
  }
}
