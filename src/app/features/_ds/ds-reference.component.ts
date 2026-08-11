import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import type { SectionHeroKpi } from '@core/models/section-hero.model';
import { DsDrawerDemoComponent } from './ds-drawer-demo.component';

type EstadoDemo = 'normal' | 'vacio' | 'error' | 'cargando';

interface FilaDemo {
  id: string;
  titulo: string;
  contexto: string;
  monto: number;
  icono: string;
}

/**
 * Pantalla de referencia del contrato de UI (spec 0002).
 *
 * Es una **ruta viva y no un documento** a propósito: unos snippets en un `.md`
 * se pudren en dos meses sin que nada avise, y esta compila. Si alguien rompe
 * una pieza, el build o `ds-reference.component.spec.ts` lo dicen.
 *
 * Dos decisiones que la hacen útil:
 *
 * 1. **Datos hardcodeados, cero facades de dominio.** Si dependiera de un
 *    facade real, dejaría de servir de referencia el día que ese dominio cambie
 *    — y arrastraría su Supabase a una pantalla que sólo debería enseñar forma.
 * 2. **Los cuatro estados se fuerzan con un selector.** Vacío, error y skeleton
 *    normalmente sólo se ven cuando el servidor falla, así que nadie los revisa.
 *    Acá se miran los cuatro en diez segundos.
 *
 * Sólo existe en dev: `app.routes.ts` la excluye del build de producción.
 */
@Component({
  selector: 'app-ds-reference',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    SectionHeroComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoReveal appBentoGridLayout>
      <!-- ═══ Pieza 1 — Hero slim, con la banda de KPIs adentro ═══ -->
      <app-section-hero
        class="bento-banner"
        density="slim"
        title="Lenguaje de pantallas"
        contextLine="Referencia"
        subtitle="Las cinco piezas con las que se arma cualquier pantalla de esta app. Copiá de acá en vez de reinventar."
        icon="layers"
        [actions]="[]"
        [kpis]="kpis()"
        [loading]="estado() === 'cargando'"
        [loadingKpiCount]="3"
        [animateOnInit]="false"
      />

      <!-- ═══ Pieza 2 — Panel que llena: cabecera fija, cuerpo scrolleable, pie fijo ═══ -->
      <div class="bento-banner bento-fill card flex min-h-0 flex-col p-0">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3"
        >
          <span class="micro-label">Panel que llena</span>

          <!-- El selector que hace útil a esta pantalla: fuerza cada estado. -->
          <div class="flex flex-wrap items-center gap-2">
            @for (e of estados; track e) {
              <button
                type="button"
                class="btn-ghost"
                [class.text-text-primary]="estado() === e"
                [attr.aria-pressed]="estado() === e"
                (click)="estado.set(e)"
                [attr.data-llm-action]="'ds-estado-' + e"
              >
                {{ e }}
              </button>
            }
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
          @switch (estado()) {
            @case ('cargando') {
              <!-- ═══ Pieza 5a — Skeleton, sólo en primera carga ═══ -->
              <div class="flex flex-col gap-3">
                @for (i of [1, 2, 3, 4]; track i) {
                  <app-skeleton-block height="4.5rem" />
                }
              </div>
            }
            @case ('error') {
              <!-- ═══ Pieza 5b — Error, siempre con reintento ═══ -->
              <app-error-state
                message="No se pudieron cargar los datos"
                (retry)="estado.set('normal')"
              />
            }
            @case ('vacio') {
              <!-- ═══ Pieza 5c — Vacío que EXPLICA, no un "no hay datos" ═══ -->
              <app-empty-state
                icon="inbox"
                message="No hay nada acá, y está bien"
                subtitle="Un estado vacío es el único momento en que el usuario está mirando sin nada que hacer. Aprovechalo para decirle qué va a aparecer y cuándo."
              />
            }
            @default {
              <!-- ═══ Pieza 3 — Fila de lista ═══ -->
              <ul class="divide-y divide-border-subtle">
                @for (fila of filas; track fila.id) {
                  <!-- min-w-0 en CADA nivel de la cadena flex: sin eso, un hijo
                       flex tiene min-width:auto y se niega a encogerse, así que
                       truncate no trunca y el texto largo parte la fila en dos.
                       Y nada de flex-wrap acá: es lo que deja que se parta. -->
                  <li class="flex items-center justify-between gap-3 py-4 first:pt-0">
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <app-icon [name]="fila.icono" [size]="16" [ariaHidden]="true" />
                      <div class="flex min-w-0 flex-col">
                        <span class="item-title truncate">{{ fila.titulo }}</span>
                        <span class="micro-label truncate">{{ fila.contexto }}</span>
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center gap-3">
                      <!-- .row-value, no .kpi-value: aquél es text-4xl y en una
                           fila se come el ancho que el título necesita. -->
                      <span class="row-value">\${{ fila.monto | number: '1.0-0' }}</span>
                      <button
                        type="button"
                        class="btn-ghost"
                        (click)="abrirDrawer(fila)"
                        [attr.data-llm-action]="'ds-abrir-' + fila.id"
                      >
                        Abrir
                      </button>
                    </div>
                  </li>
                }
              </ul>
            }
          }
        </div>

        <div class="border-t border-border-subtle px-4 py-3 text-sm text-text-muted">
          El pie queda fijo: no se va con el scroll del cuerpo.
        </div>
      </div>
    </div>
  `,
})
export class DsReferenceComponent {
  private readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly estados: EstadoDemo[] = ['normal', 'vacio', 'error', 'cargando'];
  protected readonly estado = signal<EstadoDemo>('normal');

  /**
   * Filas de muestra. Dos son casos límite a propósito (AC-E2 y AC-E3 de la
   * spec): un texto largo que tiene que truncar sin romper el layout, y un monto
   * de nueve cifras que no puede desbordar su celda.
   */
  protected readonly filas: FilaDemo[] = [
    { id: 'a', titulo: 'Fila normal', contexto: 'Contexto · 9 ago', monto: 15990, icono: 'receipt' },
    {
      id: 'b',
      titulo: 'Comercio con un nombre larguísimo que no entra en la fila y tiene que truncarse sin romper nada',
      contexto: 'Caso límite · truncado',
      monto: 4500,
      icono: 'mail',
    },
    { id: 'c', titulo: 'Monto de nueve cifras', contexto: 'Caso límite · desborde', monto: 123456789, icono: 'receipt' },
    { id: 'd', titulo: 'Otra fila normal', contexto: 'Contexto · 1 ago', monto: 2390, icono: 'mail' },
  ];

  protected readonly kpis = computed<SectionHeroKpi[]>(() => [
    { id: 'piezas', label: 'Piezas', value: 5 },
    { id: 'estados', label: 'Estados', value: this.estados.length },
    { id: 'excepciones', label: 'Excepciones', value: 2 },
  ]);

  /** Pieza 4: el drawer, con datos. */
  protected abrirDrawer(fila: FilaDemo): void {
    this.drawer.open(DsDrawerDemoComponent, 'Drawer de referencia', 'layers', [], {
      titulo: fila.titulo,
    });
  }
}
