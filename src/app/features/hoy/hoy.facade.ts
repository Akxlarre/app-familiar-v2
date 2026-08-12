import { Injectable, computed, inject, signal } from '@angular/core';

import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import { PendientesService } from '@core/services/pendientes.service';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import type { Movimiento } from '@core/models/movimiento.model';

/**
 * HoyFacade — la respuesta a "¿tengo que hacer algo?".
 *
 * No inyecta **ningún facade de dominio**. No es una formalidad de ARCH-02: es
 * la defensa estructural contra que Hoy se convierta en el dashboard de v1, que
 * terminó dependiendo de los nueve facades del proyecto porque nada se lo
 * impedía, y por eso cada módulo nuevo lo rompía.
 *
 * Lo único que conoce es `PendientesService` (que no sabe de dominios) y el
 * repositorio de movimientos, que es su propio contenido.
 *
 * No extiende `BaseFacade`: sus dos bloques cargan y fallan por separado, y un
 * único `isLoading`/`error` los volvería a atar.
 */
@Injectable({ providedIn: 'root' })
export class HoyFacade {
  private readonly pendientesService = inject(PendientesService);
  private readonly movimientosRepo = inject(MovimientosRepository);

  // ── Bloque 1: pendientes ──────────────────────────────────────────────────

  readonly pendientes = this.pendientesService.pendientes;
  readonly cargandoPendientes = this.pendientesService.cargando;
  readonly totalPendientes = this.pendientesService.total;
  readonly fuentesCaidas = this.pendientesService.fuentesCaidas;

  /** El estado deseable. Sólo cierto después de haber preguntado. */
  readonly sinNadaPendiente = this.pendientesService.sinNadaPendiente;

  /**
   * Si algo no se pudo consultar.
   *
   * Se muestra **junto** a los pendientes que sí cargaron, nunca en su lugar:
   * un bloque caído no puede dejar sin ver a los demás.
   */
  readonly hayFuentesCaidas = computed(() => this.fuentesCaidas().length > 0);

  // ── Bloque 2: últimos movimientos ─────────────────────────────────────────

  private readonly _movimientos = signal<readonly Movimiento[]>([]);
  private readonly _cargandoMovimientos = signal(false);
  private readonly _errorMovimientos = signal<string | null>(null);
  private readonly _movimientosCargados = signal(false);

  readonly movimientos = this._movimientos.asReadonly();
  readonly cargandoMovimientos = this._cargandoMovimientos.asReadonly();
  readonly errorMovimientos = this._errorMovimientos.asReadonly();

  readonly sinMovimientos = computed(
    () => this._movimientosCargados() && this._movimientos().length === 0,
  );

  /**
   * Los dos bloques arrancan a la vez y ninguno espera al otro.
   *
   * `allSettled` otra vez, y por el mismo motivo: si los movimientos no cargan,
   * los pendientes tienen que verse igual.
   */
  async initialize(): Promise<void> {
    await Promise.allSettled([this.pendientesService.cargar(), this.cargarMovimientos()]);
  }

  async cargarMovimientos(): Promise<void> {
    this._cargandoMovimientos.set(true);
    this._errorMovimientos.set(null);
    try {
      this._movimientos.set(await this.movimientosRepo.ultimos(5));
      this._movimientosCargados.set(true);
    } catch (e) {
      // Un error crudo de Supabase trae nombres de tabla y detalles de la query,
      // y esto se pinta en pantalla.
      this._errorMovimientos.set(
        mensajeSeguroDeBd(e, 'No se pudieron cargar los últimos movimientos.'),
      );
    } finally {
      this._cargandoMovimientos.set(false);
    }
  }
}
