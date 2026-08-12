import { Injectable, computed, inject, signal } from '@angular/core';

import { BancosRepository } from '@core/repositories/bancos.repository';
import { ToastService } from '@core/services/toast.service';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import type { CuentaCompleta, DetalleCredito, ParserDelHogar } from '@core/models/cuenta.model';
import { resumenDeCupo } from '@core/models/cuenta.model';
import type { NuevaCuenta } from '@core/models/banco.model';
import { HogaresRepository } from '@core/repositories/hogares.repository';

/**
 * CuentasFacade — las cuentas del hogar y su cupo.
 *
 * Sin cuentas, los cargos del banco **quedan atascados en la bandeja** aunque
 * el monto se haya leído perfecto: `process-bank-emails` saca la cuenta del
 * parser, y un parser sin cuenta no puede crear el movimiento (AC11, AC13 de la
 * spec 0004). Por eso el estado vacío de esta pantalla explica esa consecuencia
 * en vez de decir "no hay cuentas".
 */
@Injectable({ providedIn: 'root' })
export class CuentasFacade {
  private readonly repo = inject(BancosRepository);
  private readonly toast = inject(ToastService);
  private readonly hogares = inject(HogaresRepository);

  private readonly _cuentas = signal<readonly CuentaCompleta[]>([]);
  private readonly _parsersSinCuenta = signal(0);
  private readonly _cargando = signal(false);
  private readonly _cargado = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _verArchivadas = signal(false);
  private readonly _parsers = signal<readonly ParserDelHogar[]>([]);
  private readonly _bancos = signal<readonly string[]>([]);

  readonly cuentas = this._cuentas.asReadonly();
  readonly parsersSinCuenta = this._parsersSinCuenta.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly verArchivadas = this._verArchivadas.asReadonly();
  readonly parsers = this._parsers.asReadonly();
  readonly bancos = this._bancos.asReadonly();

  readonly vacio = computed(() => this._cargado() && this._cuentas().length === 0);

  /** Sólo las de crédito tienen cupo que sumar. */
  readonly cupoDelHogar = computed(() => {
    let total = 0;
    let usado = 0;
    for (const c of this._cuentas()) {
      if (c.credito?.cupoTotal) {
        total += c.credito.cupoTotal;
        usado += c.usadoEnPeriodo;
      }
    }
    return total > 0 ? resumenDeCupo(total, usado) : null;
  });

  /** Cuentas cuyos cargos NO entran solos: no hay parser apuntándoles. */
  readonly sinCaptura = computed(() => this._cuentas().filter((c) => c.parsersVinculados === 0));

  async cargar(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);

    const [cuentas, sinCuenta] = await Promise.allSettled([
      this.repo.cuentasCompletas(this._verArchivadas()),
      this.repo.parsersSinCuenta(),
    ]);

    if (cuentas.status === 'fulfilled') {
      this._cuentas.set(cuentas.value);
      this._cargado.set(true);
    } else {
      this._error.set(mensajeSeguroDeBd(cuentas.reason, 'No se pudieron cargar las cuentas.'));
    }

    // El aviso de parsers atascados es un complemento: que no cargue no puede
    // esconder las cuentas.
    this._parsersSinCuenta.set(sinCuenta.status === 'fulfilled' ? sinCuenta.value : 0);
    this._cargando.set(false);
  }

  async alternarArchivadas(): Promise<void> {
    this._verArchivadas.update((v) => !v);
    await this.cargar();
  }

  /**
   * Archiva, nunca borra (AC4).
   *
   * `movimientos.cuenta_id` es `ON DELETE SET NULL`: borrar no perdería las
   * filas, pero sí de qué tarjeta salió cada gasto — y eso no se reconstruye.
   */
  async archivar(cuentaId: string): Promise<string | null> {
    try {
      await this.repo.archivar(cuentaId);
      this.toast.success('Cuenta archivada. Sus movimientos siguen visibles en Plata.');
      await this.cargar();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo archivar la cuenta.');
    }
  }

  async reactivar(cuentaId: string): Promise<string | null> {
    try {
      await this.repo.reactivar(cuentaId);
      this.toast.success('Cuenta reactivada');
      await this.cargar();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo reactivar la cuenta.');
    }
  }

  // ── Crear, editar y vincular (AC1–AC3, AC10) ──────────────────────────────

  /** Parsers y catálogo de bancos, para los selectores del formulario. */
  async cargarAuxiliares(): Promise<void> {
    const [parsers, catalogo] = await Promise.allSettled([
      this.repo.parsers(),
      this.repo.catalogo(),
    ]);
    this._parsers.set(parsers.status === 'fulfilled' ? parsers.value : []);
    this._bancos.set(
      catalogo.status === 'fulfilled' ? catalogo.value.map((b) => b.banco) : [],
    );
  }

  /** Los parsers de un banco, que son los candidatos a vincular a una cuenta suya. */
  parsersDe(banco: string | null): ParserDelHogar[] {
    if (!banco) return [];
    return this._parsers().filter((p) => p.banco === banco);
  }

  /**
   * Crea la cuenta y, si es de crédito, su detalle.
   *
   * Las dos escrituras van juntas porque una tarjeta sin cupo ni fechas no
   * puede mostrar nada de lo que esta pantalla promete, y dejarla a medias
   * obliga al usuario a volver a un formulario que creía terminado.
   */
  async crear(cuenta: NuevaCuenta, credito: DetalleCredito | null): Promise<string | null> {
    try {
      const hogar = await this.hogares.miHogar();
      if (!hogar) return 'No se encontró tu hogar.';

      const creada = await this.repo.crearCuenta(hogar.id, cuenta);
      if (cuenta.tipo === 'credito' && credito) {
        await this.repo.guardarCredito(creada.id, credito);
      }
      this.toast.success('Cuenta creada');
      await this.cargar();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo crear la cuenta.');
    }
  }

  async editar(
    cuentaId: string,
    cambios: { nombre: string; banco: string; last4: string | null },
    credito: DetalleCredito | null,
  ): Promise<string | null> {
    try {
      await this.repo.editarCuenta(cuentaId, cambios);
      if (credito) await this.repo.guardarCredito(cuentaId, credito);
      this.toast.success('Cuenta actualizada');
      await this.cargar();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo guardar la cuenta.');
    }
  }

  /** Apunta un parser a una cuenta: es lo que hace que sus cargos entren solos. */
  async vincular(parserId: string, cuentaId: string | null): Promise<string | null> {
    try {
      await this.repo.vincularParser(parserId, cuentaId);
      this.toast.success(
        cuentaId
          ? 'Vinculado. Los próximos cargos de ese correo entran con esta cuenta.'
          : 'Desvinculado',
      );
      await this.cargar();
      await this.cargarAuxiliares();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo vincular el parser.');
    }
  }
}