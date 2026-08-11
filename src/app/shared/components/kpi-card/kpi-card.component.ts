import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

/**
 * KpiCardComponent — Molécula de métrica (KPI).
 *
 * Dumb component que combina .kpi-value + .micro-label + trend indicator + animateCounter().
 * Úsalo dentro de un bento-grid para construir dashboards de nivel premium.
 *
 * La animación del contador va de 0 al valor final en 1.2s (power2.out).
 * Respeta `prefers-reduced-motion` automáticamente.
 *
 * @example
 * <!-- KPI básico -->
 * <app-kpi-card
 *   label="Usuarios activos"
 *   [value]="24819"
 * />
 *
 * <!-- Con trend y sufijo -->
 * <app-kpi-card
 *   label="Tasa de conversión"
 *   [value]="4.7"
 *   suffix="%"
 *   [trend]="1.2"
 *   trendLabel="vs. mes anterior"
 * />
 *
 * <!-- Con prefijo monetario y card-accent (máx 1 por sección bento) -->
 * <app-kpi-card
 *   label="Ingresos del mes"
 *   [value]="84320"
 *   prefix="$"
 *   [trend]="-3.1"
 *   [accent]="true"
 * />
 *
 * NOTA: La animación de counter usa Math.round() internamente.
 * Para valores con decimales significativos (ej: "4.7%"), pasa el valor
 * como entero × 10 y ajusta el sufijo, o usa el campo suffix directamente
 * en combinación con el display del template.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div
      class="card card-tinted flex flex-col gap-2 h-full"
      [class.card-accent]="accent()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="loading() ? 'Cargando métrica' : null"
    >
      @if (loading()) {
        <!-- Skeleton interno — misma estructura que el estado cargado, sin layout shift.
             NO extraer a un *-skeleton.component.ts: ver visual-system.md. -->
        <app-skeleton-block variant="text" width="55%" height="12px" />
        <app-skeleton-block width="70%" height="44px" />
        <app-skeleton-block variant="text" width="40%" height="14px" />
      } @else {
      <!-- Etiqueta descriptiva -->
      <span class="micro-label">{{ label() }}</span>

      <!-- Valor principal — animado por GSAP al montar -->
      <p class="kpi-value flex items-baseline gap-0.5">
        @if (prefix()) {
          <span class="text-2xl font-semibold" style="color: var(--text-secondary)">
            {{ prefix() }}
          </span>
        }
        <span #valueEl>{{ value() }}</span>
        @if (suffix()) {
          <span class="text-2xl font-semibold" style="color: var(--text-secondary)">
            {{ suffix() }}
          </span>
        }
      </p>

      <!-- Trend indicator — solo si se provee -->
      @if (trend() !== undefined) {
        <div
          class="flex items-center gap-1 mt-auto"
          [style.color]="trendColor()"
          [attr.aria-label]="trendAriaLabel()"
        >
          <app-icon [name]="trendIcon()" [size]="14" />
          <span class="text-sm font-semibold">{{ trendDisplay() }}</span>
          @if (trendLabel()) {
            <span class="text-xs" style="color: var(--text-muted)">
              {{ trendLabel() }}
            </span>
          }
        </div>
      }
      }
    </div>
  `,
})
export class KpiCardComponent {
  /** Valor numérico principal. Se anima desde 0 al montar. */
  readonly value = input.required<number>();

  /** Etiqueta descriptiva del KPI (ej: "Usuarios activos"). Se muestra en .micro-label. */
  readonly label = input.required<string>();

  /** Sufijo del valor (ej: '%', 'K', ' hrs'). Aparece fuera del contador animado. */
  readonly suffix = input<string>('');

  /** Prefijo del valor (ej: '$', '€'). Aparece fuera del contador animado. */
  readonly prefix = input<string>('');

  /**
   * Variación porcentual del periodo.
   * Positivo → verde + trending-up. Negativo → rojo + trending-down.
   * Omitir (undefined) → oculta la sección de trend.
   */
  readonly trend = input<number | undefined>(undefined);

  /** Contexto temporal del trend (ej: "vs. mes anterior", "últimas 24 h"). */
  readonly trendLabel = input<string>('');

  /**
   * Activa el borde superior .card-accent con var(--ds-brand).
   * Solo 1 card-accent por sección bento. Default: false.
   */
  readonly accent = input<boolean>(false);

  /**
   * true mientras el Facade carga. Renderiza el skeleton interno en lugar del contenido.
   * Patrón Single-Component Skeleton: NUNCA crear un `*-skeleton.component.ts` aparte.
   */
  readonly loading = input<boolean>(false);

  // ── Señales derivadas del trend ───────────────────────────────────────────

  protected readonly trendIcon = computed(() =>
    (this.trend() ?? 0) >= 0 ? 'trending-up' : 'trending-down'
  );

  protected readonly trendColor = computed(() =>
    (this.trend() ?? 0) >= 0 ? 'var(--state-success)' : 'var(--state-error)'
  );

  protected readonly trendDisplay = computed(() => {
    const t = this.trend() ?? 0;
    const sign = t >= 0 ? '+' : '';
    const abs = Math.abs(t);
    return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}%`;
  });

  protected readonly trendAriaLabel = computed(() => {
    const t = this.trend();
    if (t === undefined) return null;
    const dir = t >= 0 ? 'incremento' : 'descenso';
    return `${dir} de ${Math.abs(t).toFixed(1)}%${this.trendLabel() ? ' ' + this.trendLabel() : ''}`;
  });

  // ── GSAP counter ──────────────────────────────────────────────────────────

  // viewChild NO required: mientras loading() es true el span no existe en el DOM.
  private readonly valueEl = viewChild<ElementRef<HTMLElement>>('valueEl');
  private readonly gsap = inject(GsapAnimationsService);

  /** Evita re-animar el contador en cada cambio de detección. */
  private hasAnimated = false;

  constructor() {
    // El effect se re-ejecuta cuando el span aparece al pasar de loading→cargado.
    // GsapAnimationsService.animateCounter() respeta prefers-reduced-motion.
    effect(() => {
      const el = this.valueEl();
      if (!el || this.hasAnimated) return;
      this.hasAnimated = true;
      this.gsap.animateCounter(
        el.nativeElement,
        this.value(),
        // El suffix se omite aquí porque se renderiza fuera del span animado.
        // Esto evita duplicar el sufijo durante la animación.
        ''
      );
    });
  }
}
