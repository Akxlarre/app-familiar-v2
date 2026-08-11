import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BandejaFacade } from '@core/facades/bandeja.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import type { SectionHeroKpi } from '@core/models/section-hero.model';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import type { Captura } from '@core/models/captura.model';
import { requiereEscribirMonto } from '@core/models/captura.model';

/**
 * BandejaComponent — donde el usuario confirma y el sistema aprende (REQ-012).
 *
 * Es la única pantalla del hito 0 con interacción real: todo lo demás pasa solo.
 * Por eso su diseño se rige por una idea: **confirmar tiene que costar un toque**.
 * Lo que ya viene resuelto se acepta sin abrir nada; sólo lo que le falta un dato
 * pide escribir.
 *
 * El checkbox de "recordar" es la pieza que convierte esta pantalla en algo que
 * se usa cada vez menos: cada comercio aprendido es una captura que la próxima
 * vez no llega acá (REQ-013).
 */
@Component({
  selector: 'app-bandeja',
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
    <!-- App-like: hero slim (con sus KPIs adentro) + panel que llena. Las dos
         celdas ocupan UNA fila, que es el contrato de un grid fill-screen. -->
    <div
      class="bento-grid bento-grid--fill-screen"
      appBentoReveal
      appBentoGridLayout
    >
      <!-- ═══ Fila 1 — Hero slim (auto) ═══
           section-hero trae título, bajada y la banda de KPIs en una sola
           celda. Antes esto eran dos celdas escritas a mano acá — el componente
           ya existía en el blueprint y lo reimplementé sin saberlo. -->
      <app-section-hero
        class="bento-banner"
        density="slim"
        title="Bandeja"
        contextLine="Captura"
        subtitle="Lo que llegó del banco y de las boletas. Confirmá lo que está bien; lo que corrijas se aprende para la próxima."
        icon="inbox"
        [actions]="[]"
        [kpis]="kpis()"
        [loading]="facade.isLoading() && !facade.hasData()"
        [loadingKpiCount]="3"
        [animateOnInit]="false"
      />

      <!-- ═══ Fila 2 — Panel que llena (minmax(0,1fr)) ═══
           En desktop ocupa el resto del viewport y el scroll vive en el CUERPO
           del panel; bajo lg mide su contenido y la página scrollea nativamente. -->
      <div class="bento-banner bento-fill card flex min-h-0 flex-col p-0">
        <!-- Cabecera del panel -->
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3"
        >
          <span class="micro-label">Capturas sin resolver</span>
          @if (facade.total() > 0) {
            <span class="text-sm text-text-muted">
              {{ facade.listasParaConfirmar() }} de {{ facade.total() }} se confirman sin escribir nada
            </span>
          }
        </div>

        <!-- Cuerpo: lo único que scrollea -->
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
          @if (facade.isLoading() && !facade.hasData()) {
            <div class="flex flex-col gap-3">
              @for (i of [1, 2, 3, 4]; track i) {
                <app-skeleton-block height="5.5rem" />
              }
            </div>
          }

          @if (facade.error(); as mensaje) {
            <app-error-state [message]="mensaje" (retry)="recargar()" />
          }

          @if (facade.vacia()) {
            <app-empty-state
              icon="inbox"
              message="No hay nada que revisar"
              subtitle="Los movimientos del banco entran solos. Cuando algo no se pueda resolver, aparece acá."
            />
          }

          @if (facade.total() > 0) {
            <ul class="divide-y divide-border-subtle">
              @for (captura of facade.ordenadas(); track captura.id) {
                <li class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <app-icon
                          [name]="captura.origen === 'email' ? 'mail' : 'receipt'"
                          [size]="16"
                          [ariaHidden]="true"
                        />
                        <span class="item-title truncate">
                          {{ captura.interpretado?.comercio || sinComercio(captura) }}
                        </span>
                      </div>
                      <span class="micro-label">
                        {{ captura.interpretado?.banco || 'Boleta' }}
                        @if (captura.fechaOrigen) {
                          · {{ captura.fechaOrigen | date: 'd MMM' }}
                        }
                        @if (captura.interpretado?.cuotasTotal) {
                          · cuota {{ captura.interpretado?.cuotaActual }} de
                          {{ captura.interpretado?.cuotasTotal }}
                        }
                      </span>
                    </div>

                    <div class="flex items-center gap-3">
                      @if (captura.interpretado?.monto; as monto) {
                        <span class="kpi-value">\${{ monto | number: '1.0-0' }}</span>
                      } @else {
                        <span class="micro-label micro-label--warning">falta el monto</span>
                      }
                    </div>
                  </div>

                  @if (captura.motivo) {
                    <p class="text-sm text-text-muted">{{ captura.motivo }}</p>
                  }

                  <div
                    class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3"
                  >
                    <label class="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
                      <input
                        type="checkbox"
                        [(ngModel)]="recordar[captura.id]"
                        [attr.aria-label]="
                          'Recordar la categoría de ' +
                          (captura.interpretado?.comercio || 'este comercio')
                        "
                      />
                      Recordar este comercio
                    </label>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="btn-ghost"
                        [disabled]="ocupada() === captura.id"
                        (click)="descartar(captura)"
                      >
                        Descartar
                      </button>
                      <button
                        type="button"
                        class="btn-primary"
                        [disabled]="ocupada() === captura.id || !puedeConfirmar(captura)"
                        (click)="confirmar(captura)"
                      >
                        @if (ocupada() === captura.id) { Guardando… } @else { Confirmar }
                      </button>
                    </div>
                  </div>

                  @if (!puedeConfirmar(captura)) {
                    <p class="text-sm text-text-muted">
                      Esta captura necesita datos que el parser no pudo leer. Abrila para completarla.
                    </p>
                  }
                </li>
              }
            </ul>
          }
        </div>

        <!-- Pie: queda fijo, no se va con el scroll -->
        @if (facade.total() > 0) {
          <div class="border-t border-border-subtle px-4 py-3 text-sm text-text-muted">
            Mostrando {{ facade.total() }}
            {{ facade.total() === 1 ? 'captura' : 'capturas' }} sin resolver
          </div>
        }
      </div>
    </div>
  `,
})
export class BandejaComponent implements OnInit {
  protected readonly facade = inject(BandejaFacade);

  /** Qué captura está guardando ahora — evita dobles clics. */
  protected readonly ocupada = signal<string | null>(null);

  /** Estado del checkbox por captura. */
  protected recordar: Record<string, boolean> = {};

  /** Los tres números que uno se pregunta al abrir la bandeja. */
  protected readonly kpis = computed<SectionHeroKpi[]>(() => [
    { id: 'total', label: 'Por revisar', value: this.facade.total() },
    { id: 'listas', label: 'A un toque', value: this.facade.listasParaConfirmar() },
    { id: 'faltan', label: 'Necesitan datos', value: this.facade.necesitanDatos() },
  ]);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected recargar(): void {
    void this.facade.initialize();
  }

  protected sinComercio(captura: Captura): string {
    return captura.payload.asunto?.slice(0, 60) ?? 'Sin descripción';
  }

  /**
   * Sólo se puede confirmar de un toque lo que ya tiene monto. Lo demás necesita
   * completarse, y eso es una pantalla aparte que todavía no existe.
   */
  protected puedeConfirmar(captura: Captura): boolean {
    return !requiereEscribirMonto(captura);
  }

  protected async confirmar(captura: Captura): Promise<void> {
    const interpretado = captura.interpretado;
    if (!interpretado?.monto) return;

    this.ocupada.set(captura.id);
    try {
      await this.facade.resolver(captura.id, {
        monto: interpretado.monto,
        comercio: interpretado.comercio ?? null,
        categoriaId: null,
        cuentaId: null,
        fecha: interpretado.fecha ?? new Date().toISOString().slice(0, 10),
        tipo: interpretado.tipo === 'pago_recibido' || interpretado.tipo === 'abono'
          ? 'ingreso'
          : 'gasto',
        recordarComercio: this.recordar[captura.id] ?? false,
      });
    } finally {
      this.ocupada.set(null);
    }
  }

  protected async descartar(captura: Captura): Promise<void> {
    this.ocupada.set(captura.id);
    try {
      await this.facade.descartar(captura.id, 'Descartada desde la bandeja');
    } finally {
      this.ocupada.set(null);
    }
  }
}
