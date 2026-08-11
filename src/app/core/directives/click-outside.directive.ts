import {
  Directive,
  ElementRef,
  DestroyRef,
  inject,
  output,
  input,
} from '@angular/core';

/**
 * Emite `clickOutside` cuando el usuario hace clic fuera del elemento host.
 * Útil para cerrar panels, dropdowns y menús custom sin depender de PrimeNG.
 *
 * Soporta activación condicional con `clickOutsideEnabled` para evitar
 * registrar listeners cuando el panel está cerrado.
 *
 * @example
 * <div
 *   class="notifications-panel card"
 *   [appClickOutside]
 *   [clickOutsideEnabled]="panelOpen()"
 *   (clickOutside)="panelOpen.set(false)"
 * ></div>
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /** Activa o desactiva el listener. Pasar `panelOpen()` para no escuchar en cerrado. */
  readonly clickOutsideEnabled = input<boolean>(true);

  /** Emite cuando se detecta un clic fuera del host. */
  readonly clickOutside = output<void>();

  private readonly listener = (event: MouseEvent) => {
    if (!this.clickOutsideEnabled()) return;
    const target = event.target as Node;
    if (!this.el.nativeElement.contains(target)) {
      this.clickOutside.emit();
    }
  };

  constructor() {
    // capture:true intercepta antes que los listeners internos del panel
    document.addEventListener('click', this.listener, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('click', this.listener, true);
    });
  }
}
