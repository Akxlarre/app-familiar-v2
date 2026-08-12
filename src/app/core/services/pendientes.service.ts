import { Injectable, computed, inject, signal } from '@angular/core';

import {
  FUENTE_DE_PENDIENTES,
  type FuenteDePendientes,
  type Pendiente,
} from '@core/models/pendiente.model';

/**
 * PendientesService — junta lo que espera decisión, sin saber de dónde sale.
 *
 * Inyecta el token multi, no los facades de dominio. Un módulo nuevo se suma
 * registrando un proveedor; este servicio no cambia y Hoy tampoco.
 */
@Injectable({ providedIn: 'root' })
export class PendientesService {
  /** `optional`: un proyecto sin fuentes registradas es válido, no un error. */
  private readonly fuentes = inject<readonly FuenteDePendientes[]>(FUENTE_DE_PENDIENTES, {
    optional: true,
  }) ?? [];

  private readonly _pendientes = signal<readonly Pendiente[]>([]);
  private readonly _fuentesCaidas = signal<readonly string[]>([]);
  private readonly _cargando = signal(false);
  private readonly _cargado = signal(false);

  readonly pendientes = this._pendientes.asReadonly();
  readonly cargando = this._cargando.asReadonly();

  /**
   * Qué fuentes no respondieron, por id.
   *
   * Se expone el id y **no el error**: un error de Supabase trae nombres de
   * tabla y detalles de la query, y esto se pinta en pantalla.
   */
  readonly fuentesCaidas = this._fuentesCaidas.asReadonly();

  /** Cuántas cosas hay que hacer, no cuántos bloques. */
  readonly total = computed(() => this._pendientes().reduce((suma, p) => suma + p.cantidad, 0));

  /**
   * Sólo después de haber preguntado.
   *
   * Decir "no hay nada que hacer" antes de cargar es peor que no decir nada:
   * el usuario cierra la app creyendo que está al día.
   */
  readonly sinNadaPendiente = computed(() => this._cargado() && this._pendientes().length === 0);

  async cargar(): Promise<void> {
    this._cargando.set(true);

    // `allSettled`, no `all`: con `all`, la primera fuente que falla se lleva a
    // todas las demás. Es un AC explícito — que la despensa no responda no puede
    // dejar sin ver los movimientos.
    const resultados = await Promise.allSettled(this.fuentes.map((f) => f.cargar()));

    const pendientes: Pendiente[] = [];
    const caidas: string[] = [];

    resultados.forEach((resultado, i) => {
      if (resultado.status === 'fulfilled') {
        pendientes.push(...resultado.value);
        return;
      }
      caidas.push(this.fuentes[i].id);
      console.error(`[pendientes] la fuente "${this.fuentes[i].id}" falló`, resultado.reason);
    });

    this._pendientes.set(pendientes.sort((a, b) => a.prioridad - b.prioridad));
    this._fuentesCaidas.set(caidas);
    this._cargado.set(true);
    this._cargando.set(false);
  }
}
