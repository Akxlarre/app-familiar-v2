import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import type { SectionHeroKpi } from '@core/models/section-hero.model';
import type { Movimiento } from '@core/models/movimiento.model';
import type { FiltroMovimientos } from '@core/models/plata.model';
import { moverPeriodo } from '@core/models/plata.model';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import { DetalleMovimientoComponent } from './detalle-movimiento.component';
import { PlataFacade } from './plata.facade';
import { aQueryParams, desdeQueryParams, mismoFiltro } from './filtros-url.utils';

/**
 * MovimientosComponent — la pantalla que justifica el proyecto.
 *
 * Es donde el usuario comprueba, sin haber escrito nada, en qué se le va la
 * plata. Hasta ahora la única pantalla con datos era la bandeja, que muestra
 * sólo lo que falló: la app enseñaba sus errores y escondía sus aciertos.
 *
 * Los montos van sin decimales y con punto de miles (RB-04): el peso chileno no
 * tiene centavos, y mostrar "15.990,00" es inventar precisión que no existe.
 */
@Component({
  selector: 'app-movimientos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    IconComponent,
    SectionHeroComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoReveal appBentoGridLayout>
      <app-section-hero
        class="bento-banner"
        density="slim"
        title="Movimientos"
        contextLine="Plata"
        [subtitle]="bajada()"
        icon="wallet"
        [actions]="[]"
        [kpis]="kpis()"
        [loading]="facade.cargando()"
        [loadingKpiCount]="3"
        [animateOnInit]="false"
      />

      <div class="bento-banner bento-fill card flex min-h-0 flex-col p-0">
        <!-- Cabecera: el selector de período. Mes en curso con anterior y
             siguiente, no dos calendarios — eso sería un formulario. -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn-ghost"
              (click)="mesAnterior()"
              aria-label="Mes anterior"
              data-llm-action="periodo-anterior"
            >
              <app-icon name="chevron-left" [size]="16" [ariaHidden]="true" />
            </button>
            <span class="micro-label">{{ facade.filtro().desde | date: 'MMMM yyyy' }}</span>
            <button
              type="button"
              class="btn-ghost"
              [disabled]="esMesActual()"
              (click)="mesSiguiente()"
              aria-label="Mes siguiente"
              data-llm-action="periodo-siguiente"
            >
              <app-icon name="chevron-right" [size]="16" [ariaHidden]="true" />
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            @if (facade.resumen(); as resumen) {
              <span class="text-sm text-text-muted">
                {{ resumen.movimientos }} {{ resumen.movimientos === 1 ? 'movimiento' : 'movimientos' }}
              </span>
            }
            <button
              type="button"
              class="btn-ghost"
              [attr.aria-expanded]="mostrarFiltros()"
              (click)="mostrarFiltros.set(!mostrarFiltros())"
              data-llm-action="abrir-filtros"
            >
              <app-icon name="search" [size]="14" [ariaHidden]="true" />
              Filtrar
              @if (facade.hayFiltrosAplicados()) { <span class="text-brand">•</span> }
            </button>
          </div>
        </div>

        @if (mostrarFiltros()) {
          <div class="flex flex-wrap items-end gap-3 border-b border-border-subtle px-4 py-3">
            <div class="flex min-w-[9rem] flex-1 flex-col gap-1">
              <label for="f-texto" class="field-label">Comercio</label>
              <input
                id="f-texto"
                type="search"
                class="field-input"
                placeholder="jumbo"
                [ngModel]="facade.filtro().texto"
                (ngModelChange)="filtrarPorTexto($event)"
                data-llm-description="Filter movements by merchant name"
              />
            </div>

            <div class="flex min-w-[9rem] flex-1 flex-col gap-1">
              <label for="f-categoria" class="field-label">Categoría</label>
              <select
                id="f-categoria"
                class="field-input"
                [ngModel]="facade.filtro().categoriaId ?? ''"
                (ngModelChange)="aplicar({ categoriaId: $event || null })"
              >
                <option value="">Todas</option>
                @for (cat of facade.categoriasDelHogar(); track cat.id) {
                  <option [value]="cat.id">{{ cat.nombre }}</option>
                }
              </select>
            </div>

            <div class="flex min-w-[9rem] flex-1 flex-col gap-1">
              <label for="f-cuenta" class="field-label">Cuenta</label>
              <select
                id="f-cuenta"
                class="field-input"
                [ngModel]="facade.filtro().cuentaId ?? ''"
                (ngModelChange)="aplicar({ cuentaId: $event || null })"
              >
                <option value="">Todas</option>
                @for (cuenta of facade.cuentasDelHogar(); track cuenta.id) {
                  <option [value]="cuenta.id">{{ cuenta.nombre }}</option>
                }
              </select>
            </div>

            <div class="flex min-w-[8rem] flex-1 flex-col gap-1">
              <label for="f-tipo" class="field-label">Tipo</label>
              <select
                id="f-tipo"
                class="field-input"
                [ngModel]="facade.filtro().tipo ?? ''"
                (ngModelChange)="aplicar({ tipo: $event || null })"
              >
                <option value="">Todos</option>
                <option value="gasto">Gastos</option>
                <option value="ingreso">Ingresos</option>
              </select>
            </div>

            @if (facade.hayFiltrosAplicados()) {
              <button
                type="button"
                class="btn-ghost"
                (click)="limpiar()"
                data-llm-action="limpiar-filtros"
              >
                Limpiar
              </button>
            }
          </div>
        }

        <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-3">
          @if (facade.cargando()) {
            <div class="flex flex-col gap-3">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <app-skeleton-block height="3.5rem" />
              }
            </div>
          }

          @if (facade.error(); as mensaje) {
            <app-error-state [message]="mensaje" (retry)="recargar()" />
          }

          <!-- Vacío de PERÍODO, distinto de "la app no tiene datos" (AC8) -->
          @if (facade.periodoVacio()) {
            <app-empty-state
              icon="wallet"
              message="No hay movimientos en este período"
              subtitle="Probá con el mes anterior. Los movimientos entran solos cuando el banco avisa una compra."
            />
          }

          <!-- El reparto por categoría: dónde se fue la plata, de mayor a menor -->
          @if (facade.categorias().length > 0) {
            <section class="flex flex-col gap-2">
              <h2 class="micro-label m-0">En qué se fue</h2>
              <ul class="flex flex-col gap-2">
                @for (cat of facade.categorias(); track cat.categoria) {
                  <li class="flex flex-col gap-1">
                    <div class="flex items-baseline justify-between gap-3">
                      <span class="item-title truncate">{{ cat.categoria }}</span>
                      <span class="shrink-0 text-sm text-text-secondary">
                        \${{ cat.total | number: '1.0-0' }}
                        <span class="text-text-muted">· {{ cat.porcentaje }}%</span>
                      </span>
                    </div>
                    <div class="h-1.5 w-full overflow-hidden rounded-full" style="background: var(--bg-subtle);">
                      <div
                        class="h-full rounded-full"
                        style="background: var(--color-primary);"
                        [style.width.%]="cat.porcentaje"
                      ></div>
                    </div>
                  </li>
                }
              </ul>
            </section>
          }

          <!-- La lista, agrupada por día -->
          @for (dia of facade.dias(); track dia.fecha) {
            <section class="flex flex-col gap-1">
              <div class="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-1">
                <h3 class="micro-label m-0">{{ dia.fecha | date: 'EEEE d MMM' }}</h3>
                @if (dia.totalGastado > 0) {
                  <span class="micro-label">−\${{ dia.totalGastado | number: '1.0-0' }}</span>
                }
              </div>

              <ul class="divide-y divide-border-subtle">
                @for (mov of dia.movimientos; track mov.id) {
                  <li>
                  <button
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent py-3 text-left transition-colors hover:bg-subtle"
                    (click)="abrirDetalle(mov)"
                    [attr.data-llm-action]="'ver-movimiento'"
                  >
                    <!-- El color y la posición dicen el tipo sin leer el signo (AC2) -->
                    <span
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      [style.background]="mov.tipo === 'ingreso' ? 'var(--state-success-bg)' : 'var(--bg-subtle)'"
                    >
                      <app-icon
                        [name]="mov.tipo === 'ingreso' ? 'trending-up' : 'trending-down'"
                        [size]="14"
                        [ariaHidden]="true"
                      />
                    </span>

                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="item-title truncate">{{ mov.comercio ?? 'Sin comercio' }}</span>
                      @if (!mov.capturaId) {
                        <span class="micro-label">Cargado a mano</span>
                      }
                    </span>

                    <span
                      class="row-value shrink-0"
                      [class.text-success]="mov.tipo === 'ingreso'"
                    >{{ signo(mov) }}{{ mov.monto | number: '1.0-0' }}</span>
                  </button>
                  </li>
                }
              </ul>
            </section>
          }

          @if (facade.hayMas()) {
            <button
              type="button"
              class="btn-secondary self-center"
              [disabled]="facade.cargandoMas()"
              (click)="cargarMas()"
              data-llm-action="cargar-mas-movimientos"
            >
              @if (facade.cargandoMas()) { Cargando… } @else { Ver más }
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class MovimientosComponent implements OnInit {
  protected readonly facade = inject(PlataFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly mostrarFiltros = signal(false);

  /** Para no disparar una consulta por cada tecla. */
  private tecleo?: ReturnType<typeof setTimeout>;

  protected readonly bajada = computed(() =>
    this.facade.resumen()?.movimientos === 0
      ? 'No hay nada registrado en este período.'
      : 'Todo lo que el banco avisó, sin que anotaras nada.',
  );

  /**
   * `section-hero` interpola `kpi.value` tal cual, así que un número crudo sale
   * `$348400`. El separador de miles es un requisito explícito (AC3, RB-04) y
   * formatear es responsabilidad de quien arma el KPI, no del componente.
   */
  private static readonly PESOS = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

  protected readonly kpis = computed<SectionHeroKpi[]>(() => {
    const r = this.facade.resumen();
    if (!r) return [];
    const monto = (v: number) => MovimientosComponent.PESOS.format(Math.abs(v));
    return [
      { id: 'gastado', label: 'Gastado', value: monto(r.gastado), prefix: '$' },
      { id: 'ingresado', label: 'Ingresado', value: monto(r.ingresado), prefix: '$' },
      // El saldo puede ser negativo y el signo va antes del símbolo: −$12.000,
      // no $−12.000.
      { id: 'saldo', label: 'Saldo', value: monto(r.saldo), prefix: r.saldo < 0 ? '−$' : '$' },
    ];
  });

  /** El mes en curso no tiene "siguiente": no hay movimientos del futuro. */
  protected esMesActual(): boolean {
    return this.facade.filtro().desde >= new Date().toISOString().slice(0, 8) + '01';
  }

  protected signo(mov: Movimiento): string {
    return mov.tipo === 'ingreso' ? '+$' : '−$';
  }

  ngOnInit(): void {
    void this.facade.cargarCategorias();

    // La URL es la fuente de verdad del filtro (AC14). Escuchar los params en
    // vez de cargar y después navegar hace que el botón "atrás" del navegador
    // funcione solo: cada estado de filtro es una entrada del historial.
    this.ruta.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const desdeUrl = desdeQueryParams(params as Record<string, string | undefined>);
      if (this.primeraCarga || !mismoFiltro(desdeUrl, this.facade.filtro())) {
        this.primeraCarga = false;
        this.mostrarFiltros.set(this.mostrarFiltros() || tieneFiltros(desdeUrl));
        void this.facade.cargar(desdeUrl);
      }
    });
  }

  private primeraCarga = true;
  private readonly destroyRef = inject(DestroyRef);

  /** Navegar, no cargar: el efecto de los query params dispara la carga. */
  protected aplicar(cambio: Partial<FiltroMovimientos>): void {
    const nuevo = { ...this.facade.filtro(), ...cambio };
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: aQueryParams(nuevo),
      queryParamsHandling: 'merge',
      // Reemplazar y no apilar: escribir en un campo no puede dejar veinte
      // entradas en el historial del navegador.
      replaceUrl: !!cambio.texto || cambio.texto === '',
    });
  }

  protected filtrarPorTexto(texto: string): void {
    clearTimeout(this.tecleo);
    this.tecleo = setTimeout(() => this.aplicar({ texto }), 350);
  }

  protected limpiar(): void {
    this.aplicar({ cuentaId: null, categoriaId: null, tipo: null, texto: '' });
  }

  /**
   * Abre el detalle en el drawer del shell, que empuja el contenido en vez de
   * taparlo. El callback recarga la lista: el drawer no la conoce, y hacer que
   * la conociera lo ataría a esta pantalla.
   */
  protected abrirDetalle(movimiento: Movimiento): void {
    this.drawer.open(
      DetalleMovimientoComponent,
      movimiento.comercio ?? 'Movimiento',
      'wallet',
      [],
      // Sin callback de recarga: el facade la hace solo tras guardar. Pasarlo
      // ataría el drawer a esta pantalla.
      { movimiento, categorias: this.facade.categoriasDelHogar() },
    );
  }

  protected recargar(): void {
    void this.facade.cargar();
  }

  protected cargarMas(): void {
    void this.facade.cargarMas();
  }

  protected mesAnterior(): void {
    this.aplicar(moverPeriodo(this.facade.filtro().desde, -1));
  }

  protected mesSiguiente(): void {
    this.aplicar(moverPeriodo(this.facade.filtro().desde, 1));
  }
}

/** Si un filtro trae algo puesto, para abrir la barra al entrar por una URL con filtros. */
function tieneFiltros(f: FiltroMovimientos): boolean {
  return !!(f.cuentaId || f.categoriaId || f.tipo || f.texto.trim());
}
