import { Injectable, computed, inject } from '@angular/core';
import { BaseFacade } from '@core/facades/base.facade';
import { CapturasRepository } from '@core/repositories/capturas.repository';
import { ToastService } from '@core/services/toast.service';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import type { Captura, ResolucionCaptura } from '@core/models/captura.model';
import { requiereEscribirMonto } from '@core/models/captura.model';

/**
 * BandejaFacade — lo capturado que espera resolución (REQ-012).
 *
 * La bandeja es donde el usuario confirma y el sistema aprende. Es la única
 * pantalla del hito 0 con interacción real: todo lo demás pasa solo.
 */
@Injectable({ providedIn: 'root' })
export class BandejaFacade extends BaseFacade<Captura[]> {
  private repo = inject(CapturasRepository);
  private toast = inject(ToastService);

  /** Las capturas, ordenadas por cuánto trabajo cuesta resolverlas. */
  readonly capturas = computed(() => this.data() ?? []);

  /**
   * Primero lo que se resuelve con un toque. Dejar arriba lo que exige tipear
   * el monto convierte la bandeja en un formulario, que es justo lo que este
   * producto evita.
   */
  readonly ordenadas = computed(() =>
    [...this.capturas()].sort((a, b) => {
      const costoA = requiereEscribirMonto(a) ? 1 : 0;
      const costoB = requiereEscribirMonto(b) ? 1 : 0;
      if (costoA !== costoB) return costoA - costoB;
      return (b.fechaOrigen ?? b.creadaEn).localeCompare(a.fechaOrigen ?? a.creadaEn);
    }),
  );

  readonly total = computed(() => this.capturas().length);

  readonly listasParaConfirmar = computed(
    () => this.capturas().filter((c) => !requiereEscribirMonto(c)).length,
  );

  /** Las que el parser no pudo resolver y exigen escribir el monto a mano. */
  readonly necesitanDatos = computed(
    () => this.capturas().filter((c) => requiereEscribirMonto(c)).length,
  );

  readonly vacia = computed(() => this.hasData() && this.total() === 0);

  protected override async fetchData(): Promise<Captura[]> {
    return await this.repo.pendientes();
  }

  /**
   * Mensajes que `resolver_captura` levanta con `RAISE EXCEPTION` a propósito:
   * están escritos para el usuario y decirle "error inesperado" en su lugar
   * sería peor. Todo lo demás lo sanea `mensajeSeguroDeBd`, porque un error
   * crudo de Supabase filtra nombres de tabla y detalles de la query.
   *
   * Deben coincidir textualmente con los del RPC
   * (`20260811130000_captura_fn_resolver_bandeja.sql`).
   */
  private static readonly MENSAJES_DEL_RPC = [
    'El monto debe ser mayor que cero',
    'La captura ya fue procesada',
    'Captura inexistente o de otro hogar',
    'Tipo inválido',
  ] as const;

  /** Confirma una captura y la saca de la bandeja. */
  async resolver(capturaId: string, resolucion: ResolucionCaptura): Promise<boolean> {
    try {
      await this.repo.resolver(capturaId, resolucion);
      this.quitar(capturaId);
      this.toast.success(
        resolucion.recordarComercio && resolucion.comercio
          ? `Movimiento creado. La próxima vez ${resolucion.comercio} se categoriza solo.`
          : 'Movimiento creado',
      );
      return true;
    } catch (e) {
      this.toast.error(
        'No se pudo crear el movimiento',
        mensajeSeguroDeBd(e, 'No se pudo crear el movimiento', BandejaFacade.MENSAJES_DEL_RPC),
      );
      return false;
    }
  }

  /** Descarta lo que no es un movimiento (publicidad, avisos, duplicados). */
  async descartar(capturaId: string, motivo: string): Promise<boolean> {
    try {
      await this.repo.descartar(capturaId, motivo);
      this.quitar(capturaId);
      this.toast.info('Descartada');
      return true;
    } catch (e) {
      this.toast.error(
        'No se pudo descartar',
        mensajeSeguroDeBd(e, 'No se pudo descartar', BandejaFacade.MENSAJES_DEL_RPC),
      );
      return false;
    }
  }

  /**
   * Saca la captura de la lista sin volver a consultar. La bandeja se resuelve
   * de a una y recargar entera en cada confirmación hace saltar la lista bajo
   * el dedo.
   */
  private quitar(capturaId: string): void {
    const actuales = this.data();
    if (!actuales) return;
    this._data.set(actuales.filter((c) => c.id !== capturaId));
  }
}
