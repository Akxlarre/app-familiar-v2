import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { BancoDelCatalogo, Cuenta, NuevaCuenta, TipoDeCuenta } from '@core/models/banco.model';
import type {
  CuentaCompleta,
  DetalleCredito,
  EstadoDeCuenta,
  ParserDelHogar,
} from '@core/models/cuenta.model';
import { periodoDeFacturacion } from '@core/models/cuenta.model';

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

  /**
   * Las cuentas con su detalle de crédito y lo usado en el período.
   *
   * El usado se **deriva** de los movimientos, nunca es columna: un saldo
   * guardado se pudre igual que `calories_target` en v1, y basta un borrado
   * para que mienta hasta que alguien lo recalcule a mano.
   *
   * Cada tarjeta usa **su** período de facturación, no el mes calendario: un
   * corte el 15 significa que lo comprado el 20 pertenece al período siguiente,
   * y mostrarlo contra el mes daría un cupo usado que no coincide con el que
   * cobra el banco.
   */
  async cuentasCompletas(incluirArchivadas = false): Promise<CuentaCompleta[]> {
    let query = this.client
      .from('cuentas')
      .select('id, nombre, tipo, banco, last4, estado, detalle_credito(cupo_total, dia_facturacion, dia_vencimiento)')
      .order('created_at');

    if (!incluirArchivadas) query = query.eq('estado', 'activa');

    const { data, error } = await query;
    if (error) throw new ErrorDeBd(error.message, error.code);

    const filas = (data ?? []) as Array<Record<string, unknown>>;
    if (filas.length === 0) return [];

    const [usados, parsers] = await Promise.all([
      this.usadoPorCuenta(filas),
      this.parsersPorCuenta(),
    ]);

    return filas.map((r) => {
      const detalle = this.aDetalleCredito(r['detalle_credito']);
      return {
        id: r['id'] as string,
        nombre: r['nombre'] as string,
        tipo: r['tipo'] as TipoDeCuenta,
        banco: (r['banco'] as string | null) ?? null,
        last4: (r['last4'] as string | null) ?? null,
        estado: r['estado'] as EstadoDeCuenta,
        credito: detalle,
        usadoEnPeriodo: usados.get(r['id'] as string) ?? 0,
        parsersVinculados: parsers.get(r['id'] as string) ?? 0,
      };
    });
  }

  /** PostgREST devuelve la relación 1-1 como objeto o como array según el caso. */
  private aDetalleCredito(bruto: unknown): DetalleCredito | null {
    const d = (Array.isArray(bruto) ? bruto[0] : bruto) as Record<string, unknown> | null | undefined;
    if (!d) return null;
    return {
      cupoTotal: (d['cupo_total'] as number | null) ?? null,
      diaFacturacion: (d['dia_facturacion'] as number | null) ?? null,
      diaVencimiento: (d['dia_vencimiento'] as number | null) ?? null,
    };
  }

  /**
   * Lo gastado por cada cuenta en SU período.
   *
   * Una consulta por cuenta y no una sola agrupada: cada tarjeta tiene un rango
   * de fechas distinto, así que no hay un `GROUP BY` que las cubra a todas. Con
   * las cuentas de un hogar —unas pocas— el costo es despreciable; si algún día
   * fueran decenas, esto pasa a un RPC.
   */
  private async usadoPorCuenta(filas: Array<Record<string, unknown>>): Promise<Map<string, number>> {
    const usados = new Map<string, number>();

    await Promise.all(
      filas.map(async (r) => {
        const detalle = this.aDetalleCredito(r['detalle_credito']);
        const { desde, hasta } = detalle?.diaFacturacion
          ? periodoDeFacturacion(detalle.diaFacturacion)
          : periodoDelMesActual();

        const { data } = await this.client
          .from('movimientos')
          .select('monto')
          .eq('cuenta_id', r['id'] as string)
          .eq('tipo', 'gasto')
          .gte('fecha', desde)
          .lte('fecha', hasta);

        usados.set(
          r['id'] as string,
          ((data ?? []) as Array<{ monto: number }>).reduce((s, m) => s + m.monto, 0),
        );
      }),
    );

    return usados;
  }

  /** Cuántos parsers apuntan a cada cuenta. Cero significa cargos que no entran solos. */
  private async parsersPorCuenta(): Promise<Map<string, number>> {
    const { data } = await this.client.from('parsers_email').select('cuenta_id');
    const conteo = new Map<string, number>();
    for (const p of (data ?? []) as Array<{ cuenta_id: string | null }>) {
      if (p.cuenta_id) conteo.set(p.cuenta_id, (conteo.get(p.cuenta_id) ?? 0) + 1);
    }
    return conteo;
  }

  /** Parsers del hogar sin cuenta: sus capturas quedan atascadas (AC11). */
  async parsersSinCuenta(): Promise<number> {
    const { count, error } = await this.client
      .from('parsers_email')
      .select('id', { count: 'exact', head: true })
      .is('cuenta_id', null);

    if (error) throw new ErrorDeBd(error.message, error.code);
    return count ?? 0;
  }

  /** Archiva en vez de borrar: los movimientos históricos no se pueden perder (AC4). */
  async archivar(cuentaId: string): Promise<void> {
    const { error } = await this.client
      .from('cuentas')
      .update({ estado: 'archivada' })
      .eq('id', cuentaId);

    if (error) throw new ErrorDeBd(error.message, error.code);
  }

  async reactivar(cuentaId: string): Promise<void> {
    const { error } = await this.client
      .from('cuentas')
      .update({ estado: 'activa' })
      .eq('id', cuentaId);

    if (error) throw new ErrorDeBd(error.message, error.code);
  }

  /** Los parsers del hogar, para poder vincularlos a una cuenta (AC10). */
  async parsers(): Promise<ParserDelHogar[]> {
    const { data, error } = await this.client
      .from('parsers_email')
      .select('id, banco, tipo, asunto_patron, cuenta_id')
      .order('banco');

    if (error) throw new ErrorDeBd(error.message, error.code);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r['id'] as string,
      banco: r['banco'] as string,
      tipo: r['tipo'] as string,
      asuntoPatron: (r['asunto_patron'] as string | null) ?? null,
      cuentaId: (r['cuenta_id'] as string | null) ?? null,
    }));
  }

  /**
   * Apunta un parser a una cuenta.
   *
   * Es lo que hace que los cargos de ese correo entren solos. Un parser puede
   * cambiar de cuenta —alguien cambió de tarjeta— así que se sobrescribe sin
   * más; lo que **no** se toca son sus regex.
   */
  async vincularParser(parserId: string, cuentaId: string | null): Promise<void> {
    const { error } = await this.client
      .from('parsers_email')
      .update({ cuenta_id: cuentaId })
      .eq('id', parserId);

    if (error) throw new ErrorDeBd(error.message, error.code);
  }

  /** Crea una cuenta sin copiar plantillas: el vínculo con el parser se elige aparte. */
  async crearCuenta(hogarId: string, cuenta: NuevaCuenta): Promise<Cuenta> {
    const { data, error } = await this.client
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

    if (error) throw new ErrorDeBd(error.message, error.code);
    const r = data as Record<string, unknown>;
    return {
      id: r['id'] as string,
      nombre: r['nombre'] as string,
      tipo: r['tipo'] as TipoDeCuenta,
      banco: (r['banco'] as string | null) ?? null,
      last4: (r['last4'] as string | null) ?? null,
      activa: r['activa'] as boolean,
    };
  }

  /** Edita los datos básicos. El tipo no se cambia: define qué otros campos existen. */
  async editarCuenta(cuentaId: string, cambios: { nombre: string; banco: string; last4: string | null }): Promise<void> {
    const { error } = await this.client
      .from('cuentas')
      .update({ nombre: cambios.nombre, banco: cambios.banco, last4: cambios.last4 })
      .eq('id', cuentaId);

    if (error) throw new ErrorDeBd(error.message, error.code);
  }

  /** Guarda el detalle de crédito de una tarjeta. */
  async guardarCredito(cuentaId: string, detalle: DetalleCredito): Promise<void> {
    const { error } = await this.client.from('detalle_credito').upsert({
      cuenta_id: cuentaId,
      cupo_total: detalle.cupoTotal,
      dia_facturacion: detalle.diaFacturacion,
      dia_vencimiento: detalle.diaVencimiento,
    });

    if (error) throw new ErrorDeBd(error.message, error.code);
  }
}

/** El mes en curso, para las cuentas que no facturan por corte. */
function periodoDelMesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
  };
}