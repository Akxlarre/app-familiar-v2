import {
  Directive,
  DestroyRef,
  ElementRef,
  inject,
  input,
  afterNextRender,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';

/**
 * BentoRevealDirective — Reveal de entrada sin flash para `.bento-grid`.
 *
 * Su valor está en **acoplar** dos pasos que, si viven separados, producen parpadeo:
 *
 *   1. PRE-HIDE (constructor, pre-paint): añade `.is-reveal-pending`, que el CSS
 *      traduce a `opacity: 0` en las celdas. El constructor corre durante la
 *      creación de la vista, ANTES del primer paint → las celdas nunca se ven
 *      "encendidas y luego apagadas".
 *   2. REVEAL (afterNextRender): dispara `animateBentoGrid()`, que fija el estado
 *      inicial inline (immediateRender) y recién ahí retira la clase → la
 *      animación arranca seamless.
 *
 * Como el hide y el reveal son del mismo dueño, es imposible dejar celdas
 * huérfanas en `opacity: 0`. El cleanup (`ctx.revert()`) se registra en
 * `DestroyRef`, así navegar fuera no deja tweens vivos sobre nodos destruidos.
 *
 * Respeta `prefers-reduced-motion` vía `GsapAnimationsService`. Además hay un
 * safety net en `_bento-grid.scss` que fuerza `opacity: 1` bajo reduced-motion
 * aunque el JS tarde o falle.
 *
 * @example Estándar
 * <div class="bento-grid" appBentoReveal appBentoGridLayout>...</div>
 *
 * @example Con View Transition de ruta cubriendo el fade → solo transform
 * <div class="bento-grid" appBentoReveal [skipOpacity]="true" appBentoGridLayout>...</div>
 */
@Directive({
  selector: '[appBentoReveal]',
  standalone: true,
})
export class BentoRevealDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Pasar `true` cuando una View Transition de ruta ya hace el fade del
   * contenedor, para que el grid anime solo `transform` y no haya doble-fade.
   */
  readonly skipOpacity = input<boolean>(false);

  constructor() {
    // Pre-paint: ocultar las celdas antes de que el browser pinte por primera vez.
    this.el.nativeElement.classList.add('is-reveal-pending');

    afterNextRender(() => {
      const cleanup = this.gsap.animateBentoGrid(this.el.nativeElement, {
        skipOpacity: this.skipOpacity(),
      });
      this.destroyRef.onDestroy(cleanup);
    });
  }
}
