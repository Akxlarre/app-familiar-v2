import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * BadgeComponent — píldora de estado semántico.
 *
 * @example
 * ```html
 * <app-badge variant="success">Activo</app-badge>
 * <app-badge variant="brand">Paso 2 de 6</app-badge>
 * ```
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly variant = input<'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand'>(
    'neutral',
  );

  /**
   * Clases literales completas a propósito, no `'badge-' + variant()`: Tailwind v4
   * poda las `@utility` por contenido escaneado igual que las utilidades normales,
   * y una concatenación dinámica no es detectable por el scanner. Con la versión
   * concatenada el badge se renderiza sin ningún estilo y nada falla.
   */
  protected readonly badgeClass = computed(() => {
    switch (this.variant()) {
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'error':
        return 'badge-error';
      case 'info':
        return 'badge-info';
      case 'brand':
        return 'badge-brand';
      case 'neutral':
      default:
        return 'badge-neutral';
    }
  });
}
