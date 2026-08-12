import { Injectable, computed, inject, signal } from '@angular/core';

import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import type { Movimiento } from '@core/models/movimiento.model';
import {
  agruparPorDia,
  moverPeriodo,
  periodoDelMes,
  type FiltroMovimientos,
  type GastoPorCategoria,
  type ResumenPeriodo,
} from '@core/models/plata.model';

/** Cuántos movimientos por página. Un mes normal entra en una. */
const POR_PAGINA = 50;

/**
 * PlataFacade — la lista, los números y los filtros.
 *
 * Los tres bloques —lista, resumen y reparto— se piden juntos pero fallan por
 * separado. Que el reparto por categoría no cargue no puede dejar sin ver los
 * movimientos, que es lo que el usuario vino a mirar.
 */
@Injectable({ providedIn: 'root' })
export class PlataFacade {
  private readonly repo = inject(MovimientosRepository);

  private readonly _filtro = signal<FiltroMovimientos>({
    ...periodoDelMes(),
    cuentaId: null,
    categoriaId: null,
    tipo: null,
    texto: '',
  });

  private readonly _movimientos = signal<readonly Movimiento[]>([]);
  private readonly _resumen = signal<ResumenPeriodo | null>(null);
  private readonly _categorias = signal<readonly GastoPorCategoria[]>([]);
  private readonly _cargando = signal(false);
  private readonly _cargandoMas = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _hayMas = signal(false);
  private readonly _cargado = signal(false);

  /**
   * Cada carga lleva su número. Cambiar de filtro rápido produce respuestas
   * fuera de orden, y sin esto la lista termina mostrando el resultado de un
   * filtro que el usuario ya cambió.
   */
  private peticion = 0;

  readonly filtro = this._filtro.asReadonly();
  readonly movimientos = this._movimientos.asReadonly();
  readonly resumen = this._resumen.asReadonly();
  readonly categorias = this._categorias.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly cargandoMas = this._cargandoMas.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hayMas = this._hayMas.asReadonly();

  readonly dias = computed(() => agruparPorDia(this._movimientos()));

  /** Vacío de período, que no es lo mismo que "la app no tiene datos" (AC8). */
  readonly periodoVacio = computed(() => this._cargado() && this._movimientos().length === 0);

  readonly hayFiltrosAplicados = computed(() => {
    const f = this._filtro();
    return !!(f.cuentaId || f.categoriaId || f.tipo || f.texto.trim());
  });

  async cargar(filtro?: Partial<FiltroMovimientos>): Promise<void> {
    if (filtro) this._filtro.update((actual) => ({ ...actual, ...filtro }));

    const mio = ++this.peticion;
    this._cargando.set(true);
    this._error.set(null);

    const f = this._filtro();
    const [pagina, resumen, categorias] = await Promise.allSettled([
      this.repo.pagina(f, POR_PAGINA),
      this.repo.resumen(f.desde, f.hasta),
      this.repo.porCategoria(f.desde, f.hasta),
    ]);

    // Llegó tarde: hay otra carga más nueva en curso.
    if (mio !== this.peticion) return;

    if (pagina.status === 'fulfilled') {
      this._movimientos.set(pagina.value);
      this._hayMas.set(pagina.value.length === POR_PAGINA);
      this._cargado.set(true);
    } else {
      this._error.set(mensajeSeguroDeBd(pagina.reason, 'No se pudieron cargar los movimientos.'));
    }

    // El resumen y el reparto caen en silencio: son un complemento, y taparlos
    // con un error de pantalla completa escondería la lista que sí cargó.
    this._resumen.set(resumen.status === 'fulfilled' ? resumen.value : null);
    this._categorias.set(categorias.status === 'fulfilled' ? categorias.value : []);

    this._cargando.set(false);
  }

  /** La página siguiente, sin perder lo que ya se ve (AC4). */
  async cargarMas(): Promise<void> {
    if (this._cargandoMas() || !this._hayMas()) return;

    this._cargandoMas.set(true);
    const mio = this.peticion;
    try {
      const siguiente = await this.repo.pagina(this._filtro(), POR_PAGINA, this._movimientos().length);
      if (mio !== this.peticion) return;
      this._movimientos.update((actuales) => [...actuales, ...siguiente]);
      this._hayMas.set(siguiente.length === POR_PAGINA);
    } catch (e) {
      this._error.set(mensajeSeguroDeBd(e, 'No se pudieron cargar más movimientos.'));
    } finally {
      this._cargandoMas.set(false);
    }
  }

  async moverMes(meses: number): Promise<void> {
    await this.cargar(moverPeriodo(this._filtro().desde, meses));
  }

  async limpiarFiltros(): Promise<void> {
    await this.cargar({ cuentaId: null, categoriaId: null, tipo: null, texto: '' });
  }
}
