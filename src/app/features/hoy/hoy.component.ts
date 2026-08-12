import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import type { SectionHeroKpi } from '@core/models/section-hero.model';
import type { Movimiento } from '@core/models/movimiento.model';
import { HoyFacade } from './hoy.facade';

/**
 * HoyComponent — la primera pantalla, y la que decide si hay que hacer algo.
 *
 * Reemplaza al dashboard. La diferencia no es estética: un dashboard muestra
 * indicadores y deja que el usuario deduzca si algo pasa; Hoy responde la
 * pregunta. Si no hay nada, lo dice y el usuario cierra la app.
 *
 * Por eso el estado vacío **no muestra una grilla de KPIs en cero** (AC9). Un
 * tablero de ceros obliga a leer cuatro números para concluir lo que una frase
 * dice de una vez, y es exactamente lo que hacía v1.
 */
@Component({
  selector: 'app-hoy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
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
      <!-- Fila 1 — Hero slim con la banda de KPIs adentro -->
      <app-section-hero
        class="bento-banner"
        density="slim"
        title="Hoy"
        contextLine="Tu casa"
        [subtitle]="bajada()"
        icon="home"
        [actions]="[]"
        [kpis]="kpis()"
        [loading]="facade.cargandoPendientes() && !facade.sinNadaPendiente()"
        [loadingKpiCount]="2"
        [animateOnInit]="false"
      />

      <!-- Fila 2 — Panel que llena -->
      <div class="bento-banner bento-fill card flex min-h-0 flex-col p-0">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3"
        >
          <span class="micro-label">Lo que necesita de ti</span>
          @if (facade.hayFuentesCaidas()) {
            <!-- Se avisa al lado de lo que SÍ cargó, nunca en su lugar. -->
            <span class="flex items-center gap-1.5 text-sm text-warning">
              <app-icon name="alert-triangle" [size]="14" [ariaHidden]="true" />
              Algo no se pudo consultar
            </span>
          }
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-3">
          @if (facade.cargandoPendientes()) {
            <div class="flex flex-col gap-3">
              @for (i of [1, 2]; track i) {
                <app-skeleton-block height="4.5rem" />
              }
            </div>
          }

          <!-- Pendientes: van primero porque son lo único accionable -->
          @if (facade.pendientes().length > 0) {
            <ul class="divide-y divide-border-subtle">
              @for (pendiente of facade.pendientes(); track pendiente.tipo) {
                <li>
                  <a
                    [routerLink]="pendiente.ruta"
                    class="flex items-center gap-3 py-4 no-underline transition-colors first:pt-0 hover:bg-subtle"
                    [attr.data-llm-action]="'resolver-' + pendiente.tipo"
                  >
                    <span
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style="background: var(--color-primary-tint); color: var(--color-primary);"
                    >
                      <app-icon [name]="iconoDe(pendiente.tipo)" [size]="18" [ariaHidden]="true" />
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="item-title">{{ pendiente.titulo }}</span>
                      @if (pendiente.detalle; as detalle) {
                        <span class="micro-label">{{ detalle }}</span>
                      }
                    </span>
                    <app-icon name="chevron-right" [size]="18" [ariaHidden]="true" />
                  </a>
                </li>
              }
            </ul>
          }

          <!-- El estado deseable. Una frase, no un tablero de ceros. -->
          @if (facade.sinNadaPendiente() && !facade.hayFuentesCaidas()) {
            <app-empty-state
              icon="check-circle"
              message="No hay nada que hacer"
              subtitle="Los movimientos entran solos. Si algo necesita tu decisión, aparece acá."
            />
          }

          <!-- Últimos movimientos: mirar la plata sin entrar a Plata -->
          <section class="flex flex-col gap-2">
            <h2 class="micro-label m-0">Últimos movimientos</h2>

            @if (facade.cargandoMovimientos()) {
              <app-skeleton-block height="8rem" />
            }

            @if (facade.errorMovimientos(); as mensaje) {
              <app-error-state [message]="mensaje" (retry)="recargarMovimientos()" />
            }

            @if (facade.sinMovimientos()) {
              <p class="m-0 text-sm text-text-muted">
                Todavía no hay movimientos. El primero llega cuando el banco avise una compra.
              </p>
            }

            @if (facade.movimientos().length > 0) {
              <ul class="divide-y divide-border-subtle">
                @for (movimiento of facade.movimientos(); track movimiento.id) {
                  <li class="flex items-center gap-3 py-3">
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="item-title truncate">{{ movimiento.comercio ?? 'Sin comercio' }}</span>
                      <span class="micro-label">{{ movimiento.fecha | date: 'd MMM' }}</span>
                    </span>
                    <span
                      class="row-value shrink-0"
                      [class.text-success]="movimiento.tipo === 'ingreso'"
                    >
                      {{ signoDe(movimiento) }}{{ movimiento.monto | number: '1.0-0' }}
                    </span>
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      </div>
    </div>
  `,
})
export class HoyComponent implements OnInit {
  protected readonly facade = inject(HoyFacade);

  /**
   * El icono de cada tipo de pendiente.
   *
   * Todos tienen que estar en el `pick()` de `app.config.ts`. ICON-01 **no**
   * puede verificarlo acá porque el nombre llega por binding dinámico, y un
   * icono sin registrar no rompe el build: lucide lanza en runtime. Así que el
   * fallback también es un icono registrado, no un nombre inventado.
   */
  private static readonly ICONOS: Record<string, string> = {
    captura: 'inbox',
    despensa: 'shopping-cart',
    cuota: 'credit-card',
  };

  protected iconoDe(tipo: string): string {
    return HoyComponent.ICONOS[tipo] ?? 'alert-circle';
  }

  /** El signo y el símbolo, juntos: `−$` o `+$`. */
  protected signoDe(movimiento: Movimiento): string {
    return movimiento.tipo === 'ingreso' ? '+$' : '−$';
  }

  /**
   * La bajada cambia con el estado: repetir "acá está tu resumen" cuando no hay
   * nada que hacer desperdicia la única línea que el usuario lee seguro.
   */
  protected readonly bajada = computed(() =>
    this.facade.sinNadaPendiente()
      ? 'Todo al día. No hay nada esperando tu decisión.'
      : 'Esto es lo que necesita tu decisión. El resto ya pasó solo.',
  );

  /**
   * Dos KPIs y sólo dos.
   *
   * Cuando no hay nada pendiente la banda queda vacía a propósito: mostrar
   * "0 pendientes / 0 por confirmar" obliga a leer números para concluir lo que
   * la frase del estado vacío ya dijo (AC9).
   */
  protected readonly kpis = computed<SectionHeroKpi[]>(() => {
    if (this.facade.sinNadaPendiente()) return [];
    return [
      { id: 'pendientes', label: 'Pendientes', value: this.facade.totalPendientes() },
      { id: 'recientes', label: 'Movimientos recientes', value: this.facade.movimientos().length },
    ];
  });

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected recargarMovimientos(): void {
    void this.facade.cargarMovimientos();
  }
}
