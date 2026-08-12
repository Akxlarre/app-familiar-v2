import { Injectable, computed, inject, signal } from '@angular/core';

import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import { ToastService } from '@core/services/toast.service';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import type { Movimiento } from '@core/models/movimiento.model';
import type { Categoria, OrigenDelMovimiento } from '@core/models/plata.model';
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
 * Mensajes que los RPCs levantan con `RAISE EXCEPTION` a propósito. Están
 * escritos para el usuario; deben coincidir textualmente con el SQL.
 */
const MENSAJES_DEL_RPC = [
  'Hay que elegir una categoría',
  'Movimiento inexistente o de otro hogar',
] as const;

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
  private readonly toast = inject(ToastService);

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
  private readonly _categoriasDelHogar = signal<readonly Categoria[]>([]);

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

  readonly categoriasDelHogar = this._categoriasDelHogar.asReadonly();

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

  /** Las categorías del hogar. Se piden una vez: es una lista corta y estable. */
  async cargarCategorias(): Promise<void> {
    if (this._categoriasDelHogar().length > 0) return;
    try {
      this._categoriasDelHogar.set(await this.repo.categorias());
    } catch {
      // Sin categorías el selector queda vacío, pero la lista se sigue viendo.
      this._categoriasDelHogar.set([]);
    }
  }

  async moverMes(meses: number): Promise<void> {
    await this.cargar(moverPeriodo(this._filtro().desde, meses));
  }

  async limpiarFiltros(): Promise<void> {
    await this.cargar({ cuentaId: null, categoriaId: null, tipo: null, texto: '' });
  }

  // ── Corregir y aprender (AC5, AC9–AC12) ───────────────────────────────────
  //
  // Vive acá y no en el drawer porque un componente vista no habla con el
  // repositorio (ARCH-02). Además, el que recarga la lista tras un cambio es
  // este facade: el drawer no la conoce.

  /**
   * El correo del que nació el movimiento (AC5).
   *
   * Devuelve `null` si falla: el origen es contexto, no el dato. Que no cargue
   * no puede impedir corregir la categoría.
   */
  async origenDe(capturaId: string): Promise<OrigenDelMovimiento | null> {
    try {
      return await this.repo.origen(capturaId);
    } catch {
      return null;
    }
  }

  /** Cuántos OTROS movimientos del mismo comercio cambiarían (AC11). */
  async contarMismoComercio(movimientoId: string, categoriaId: string): Promise<number> {
    try {
      return await this.repo.contarMismoComercio(movimientoId, categoriaId);
    } catch {
      // Sin conteo no se ofrece aplicar a los pasados: preguntarlo a ciegas es
      // justo lo que AC11 evita.
      return 0;
    }
  }

  /**
   * Corrige la categoría y, si se pide, aprende el comercio.
   *
   * Devuelve el mensaje de error o `null` si salió bien. Recarga la lista al
   * terminar: los números del hero cambian con la corrección.
   */
  async recategorizar(
    movimientoId: string,
    categoriaId: string,
    recordar: boolean,
    aplicarPasados: boolean,
  ): Promise<string | null> {
    try {
      const afectados = await this.repo.recategorizar(
        movimientoId, categoriaId, recordar, aplicarPasados,
      );
      this.toast.success(
        afectados > 1 ? `${afectados} movimientos actualizados` : 'Movimiento actualizado',
      );
      await this.cargar();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo guardar.', MENSAJES_DEL_RPC);
    }
  }

  /** Borra el movimiento; su captura vuelve a la bandeja (AC12, RN-09). */
  async borrar(movimientoId: string): Promise<string | null> {
    try {
      const volvioABandeja = await this.repo.borrar(movimientoId);
      this.toast.success(
        volvioABandeja ? 'Movimiento borrado. El correo volvió a la bandeja.' : 'Movimiento borrado',
      );
      await this.cargar();
      return null;
    } catch (e) {
      return mensajeSeguroDeBd(e, 'No se pudo borrar.', MENSAJES_DEL_RPC);
    }
  }
}