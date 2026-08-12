import { Injectable, computed, inject, signal } from '@angular/core';

import { BancosRepository } from '@core/repositories/bancos.repository';
import { ToastService } from '@core/services/toast.service';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import type { CuentaCompleta } from '@core/models/cuenta.model';
import { resumenDeCupo } from '@core/models/cuenta.model';

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

  private readonly _cuentas = signal<readonly CuentaCompleta[]>([]);
  private readonly _parsersSinCuenta = signal(0);
  private readonly _cargando = signal(false);
  private readonly _cargado = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _verArchivadas = signal(false);

  readonly cuentas = this._cuentas.asReadonly();
  readonly parsersSinCuenta = this._parsersSinCuenta.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly verArchivadas = this._verArchivadas.asReadonly();

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
}
