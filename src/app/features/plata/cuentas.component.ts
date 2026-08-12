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
import type { CuentaCompleta } from '@core/models/cuenta.model';
import { periodoDeFacturacion, resumenDeCupo } from '@core/models/cuenta.model';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import { CuentasFacade } from './cuentas.facade';
import { EditarCuentaComponent } from './editar-cuenta.component';

/**
 * CuentasComponent — de dónde sale cada gasto.
 *
 * La cuenta no es un dato administrativo: es lo que hace que un cargo del banco
 * pueda convertirse en movimiento. Sin ella la captura queda atascada en la
 * bandeja aunque el monto se haya leído perfecto, y por eso el estado vacío
 * explica **esa** consecuencia en vez de decir "no hay cuentas".
 */
@Component({
  selector: 'app-cuentas',
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
      <app-section-hero
        class="bento-banner"
        density="slim"
        title="Cuentas"
        contextLine="Plata"
        subtitle="De dónde sale cada gasto. Se configura una vez y no se vuelve a tocar."
        icon="credit-card"
        [actions]="[]"
        [kpis]="kpis()"
        [loading]="facade.cargando()"
        [loadingKpiCount]="2"
        [animateOnInit]="false"
      />

      <div class="bento-banner bento-fill card flex min-h-0 flex-col p-0">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <span class="micro-label">Tus cuentas</span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn-ghost"
              (click)="alternarArchivadas()"
              data-llm-action="alternar-archivadas"
            >
              @if (facade.verArchivadas()) { Ocultar archivadas } @else { Ver archivadas }
            </button>
            <button
              type="button"
              class="btn-primary"
              (click)="nuevaCuenta()"
              data-llm-action="nueva-cuenta"
            >
              Agregar cuenta
            </button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-3">
          @if (facade.cargando()) {
            <div class="flex flex-col gap-3">
              @for (i of [1, 2]; track i) { <app-skeleton-block height="5rem" /> }
            </div>
          }

          @if (facade.error(); as mensaje) {
            <app-error-state [message]="mensaje" (retry)="recargar()" />
          }

          <!-- Capturas atascadas por falta de cuenta: el motivo real de esta pantalla -->
          @if (facade.parsersSinCuenta() > 0) {
            <a
              routerLink="/app/bandeja"
              class="flex items-center gap-3 rounded-lg p-4 no-underline"
              style="background: var(--state-warning-bg);"
              data-llm-action="ir-a-bandeja-por-parsers"
            >
              <app-icon name="alert-triangle" [size]="18" [ariaHidden]="true" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="item-title">
                  {{ facade.parsersSinCuenta() }}
                  {{ facade.parsersSinCuenta() === 1 ? 'parser sin cuenta' : 'parsers sin cuenta' }}
                </span>
                <span class="micro-label">
                  Sus correos llegan pero no se pueden convertir en movimientos.
                </span>
              </span>
              <app-icon name="chevron-right" [size]="18" [ariaHidden]="true" />
            </a>
          }

          @if (facade.vacio()) {
            <app-empty-state
              icon="credit-card"
              message="Todavía no hay cuentas"
              subtitle="Sin una cuenta, los cargos que manda el banco quedan atascados en la bandeja: el sistema lee el monto pero no sabe a qué tarjeta cargarlo."
            />
            <button
              type="button"
              class="btn-primary self-center"
              (click)="nuevaCuenta()"
              data-llm-action="crear-primera-cuenta-desde-vacio"
            >
              Agregar mi primera cuenta
            </button>
          }

          @for (cuenta of facade.cuentas(); track cuenta.id) {
            <article class="flex flex-col gap-3 rounded-lg border border-border-subtle p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="item-title truncate">
                    {{ cuenta.nombre }}
                    @if (cuenta.last4; as last4) {
                      <span class="font-mono text-text-muted">···{{ last4 }}</span>
                    }
                  </span>
                  <span class="micro-label">
                    {{ etiquetaDeTipo(cuenta) }}@if (cuenta.banco) { · {{ cuenta.banco }} }
                  </span>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    class="btn-ghost"
                    (click)="editar(cuenta)"
                    [attr.data-llm-action]="'editar-cuenta'"
                  >
                    Editar
                  </button>
                  @if (cuenta.estado !== 'activa') {
                    <span class="micro-label">Archivada</span>
                    <button type="button" class="btn-ghost" (click)="reactivar(cuenta)">
                      Reactivar
                    </button>
                  } @else {
                    <button type="button" class="btn-ghost" (click)="archivar(cuenta)">
                      Archivar
                    </button>
                  }
                </div>
              </div>

              <!-- Cupo: sólo si es de crédito Y tiene cupo declarado -->
              @if (cupoDe(cuenta); as cupo) {
                <div class="flex flex-col gap-1">
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="micro-label">
                      @if (cupo.superado) { Cupo superado } @else { Disponible }
                    </span>
                    <span class="text-sm" [class.text-danger]="cupo.superado">
                      \${{ cupo.disponible | number: '1.0-0' }}
                      <span class="text-text-muted">de \${{ cupo.total | number: '1.0-0' }}</span>
                    </span>
                  </div>
                  <div class="h-2 w-full overflow-hidden rounded-full" style="background: var(--bg-subtle);">
                    <div
                      class="h-full rounded-full"
                      [style.width.%]="minimo(cupo.porcentaje)"
                      [style.background]="cupo.superado ? 'var(--state-error)' : 'var(--color-primary)'"
                    ></div>
                  </div>
                  @if (periodoDe(cuenta); as periodo) {
                    <span class="micro-label">
                      Período hasta el {{ periodo.hasta | date: "d 'de' MMMM" }} ·
                      @if (periodo.diasParaCierre > 0) {
                        cierra en {{ periodo.diasParaCierre }}
                        {{ periodo.diasParaCierre === 1 ? 'día' : 'días' }}
                      } @else { cierra hoy }
                    </span>
                  }
                </div>
              } @else {
                <span class="micro-label">
                  Gastado este período: \${{ cuenta.usadoEnPeriodo | number: '1.0-0' }}
                </span>
              }

              <!-- Sin parser, sus cargos no entran solos -->
              @if (cuenta.parsersVinculados === 0 && cuenta.estado === 'activa') {
                <span class="flex items-center gap-1.5 text-sm text-warning">
                  <app-icon name="alert-circle" [size]="14" [ariaHidden]="true" />
                  Sus cargos no entran solos: falta vincularla al parser de su banco.
                </span>
              }
            </article>
          }
        </div>
      </div>
    </div>
  `,
})
export class CuentasComponent implements OnInit {
  protected readonly facade = inject(CuentasFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  private static readonly PESOS = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

  private static readonly TIPOS: Record<string, string> = {
    credito: 'Tarjeta de crédito',
    debito: 'Tarjeta de débito',
    efectivo: 'Efectivo',
    billetera_digital: 'Billetera digital',
  };

  protected readonly kpis = computed<SectionHeroKpi[]>(() => {
    const cupo = this.facade.cupoDelHogar();
    const kpis: SectionHeroKpi[] = [
      { id: 'cuentas', label: 'Cuentas', value: this.facade.cuentas().length },
    ];
    if (cupo) {
      kpis.unshift({
        id: 'disponible',
        label: 'Cupo disponible',
        value: CuentasComponent.PESOS.format(cupo.disponible),
        prefix: '$',
      });
    }
    return kpis;
  });

  protected etiquetaDeTipo(cuenta: CuentaCompleta): string {
    return CuentasComponent.TIPOS[cuenta.tipo] ?? cuenta.tipo;
  }

  protected cupoDe(cuenta: CuentaCompleta) {
    return cuenta.tipo === 'credito'
      ? resumenDeCupo(cuenta.credito?.cupoTotal ?? null, cuenta.usadoEnPeriodo)
      : null;
  }

  protected periodoDe(cuenta: CuentaCompleta) {
    const dia = cuenta.credito?.diaFacturacion;
    return dia ? periodoDeFacturacion(dia) : null;
  }

  /** La barra no pasa del 100% aunque el cupo sí: el color dice que se superó. */
  protected minimo(porcentaje: number): number {
    return Math.min(100, porcentaje);
  }

  ngOnInit(): void {
    void this.facade.cargar();
  }

  protected recargar(): void {
    void this.facade.cargar();
  }

  protected alternarArchivadas(): void {
    void this.facade.alternarArchivadas();
  }

  /** Alta: sin cuenta previa, el drawer arranca eligiendo el tipo. */
  protected nuevaCuenta(): void {
    this.drawer.open(EditarCuentaComponent, 'Nueva cuenta', 'credit-card', [], { cuenta: null });
  }

  protected editar(cuenta: CuentaCompleta): void {
    this.drawer.open(EditarCuentaComponent, cuenta.nombre, 'credit-card', [], { cuenta });
  }

  protected archivar(cuenta: CuentaCompleta): void {
    void this.facade.archivar(cuenta.id);
  }

  protected reactivar(cuenta: CuentaCompleta): void {
    void this.facade.reactivar(cuenta.id);
  }
}
