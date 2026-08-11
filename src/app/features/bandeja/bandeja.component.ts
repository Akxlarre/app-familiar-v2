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
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
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
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonBlockComponent,
    AnimateInDirective,
    BentoGridLayoutDirective,
  ],
  template: `
    <!-- App-like: en desktop el grid ocupa el alto disponible y el scroll vive
         DENTRO de la lista, no en el documento. Ambas celdas son .bento-banner
         (una fila cada una), que es el contrato de un grid fill-screen. -->
    <section
      class="bento-grid bento-grid--fill-screen"
      appBentoGridLayout
    >
      <!-- Encabezado -->
      <header class="bento-banner flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="section-eyebrow">Captura</span>
          <h1 class="text-2xl font-semibold text-text-primary">Bandeja</h1>
          <p class="text-sm text-text-muted max-w-prose">
            Lo que llegó del banco y de las boletas. Confirmá lo que está bien; lo que
            corrijas se aprende para la próxima.
          </p>
        </div>

        @if (facade.total() > 0) {
          <div class="flex items-center gap-4">
            <div class="flex flex-col items-end">
              <span class="kpi-value">{{ facade.total() }}</span>
              <span class="micro-label">por revisar</span>
            </div>
            @if (facade.listasParaConfirmar() > 0) {
              <div class="flex flex-col items-end">
                <span class="kpi-value">{{ facade.listasParaConfirmar() }}</span>
                <span class="micro-label">a un toque</span>
              </div>
            }
          </div>
        }
      </header>

      <!-- Fila 2: la celda protagonista. Llena el alto restante y scrollea
           por dentro; el documento no se mueve. -->
      <div class="bento-banner bento-fill flex min-h-0 flex-col gap-3 overflow-hidden">

      <!-- Carga -->
      @if (facade.isLoading() && !facade.hasData()) {
        <div class="flex flex-col gap-3">
          @for (i of [1, 2, 3]; track i) {
            <app-skeleton-block [height]="'5.5rem'" />
          }
        </div>
      }

      <!-- Error -->
      @if (facade.error(); as mensaje) {
        <app-error-state [message]="mensaje" (retry)="recargar()" />
      }

      <!-- Vacía: el estado deseable, no un error -->
      @if (facade.vacia()) {
        <app-empty-state
          icon="inbox"
          message="No hay nada que revisar"
          subtitle="Los movimientos del banco entran solos. Cuando algo no se pueda resolver, aparece acá."
        />
      }

      <!-- Lista -->
      @if (facade.total() > 0) {
        <ul class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" appAnimateIn>
          @for (captura of facade.ordenadas(); track captura.id) {
            <li class="card flex flex-col gap-3 p-4">
              <!-- Resumen -->
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

              <!-- Motivo por el que quedó acá -->
              @if (captura.motivo) {
                <p class="text-sm text-text-muted">{{ captura.motivo }}</p>
              }

              <!-- Acciones -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3">
                <label class="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    [(ngModel)]="recordar[captura.id]"
                    [attr.aria-label]="'Recordar la categoría de ' + (captura.interpretado?.comercio || 'este comercio')"
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
    </section>
  `,
})
export class BandejaComponent implements OnInit {
  protected readonly facade = inject(BandejaFacade);

  /** Qué captura está guardando ahora — evita dobles clics. */
  protected readonly ocupada = signal<string | null>(null);

  /** Estado del checkbox por captura. */
  protected recordar: Record<string, boolean> = {};

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
