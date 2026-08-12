import { Directive, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Mueve el foco del teclado al encabezado de la pantalla nueva tras navegar.
 *
 * Sin esto, en una SPA el foco se queda donde estaba —típicamente en el enlace
 * del menú que se acaba de pulsar—, así que quien navega con teclado o lector
 * de pantalla cambia de pantalla sin enterarse: el contenido cambió y su
 * contexto no. Es el motivo por el que AC8 pide esto explícitamente.
 *
 * Se aplica sobre el contenedor del router outlet, no sobre cada pantalla.
 */
@Directive({
  selector: '[appFocusOnNavigation]',
  standalone: true,
})
export class FocusOnNavigationDirective {
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      // No hay caso de "primera carga" que excluir: la directiva se crea con el
      // shell, y el NavigationEnd inicial ya ocurrió antes de que exista.
      .subscribe(() => this.enfocarEncabezado());
  }

  private enfocarEncabezado(): void {
    // Un tick para que el router haya pintado la pantalla nueva; si no, se
    // enfoca el encabezado de la que se está yendo.
    setTimeout(() => {
      const el = this.host.nativeElement as HTMLElement;
      const encabezado = el.querySelector<HTMLElement>('h1, [data-page-title]');
      if (!encabezado) return;

      // `tabindex="-1"` lo hace enfocable por código sin meterlo en el orden de
      // tabulación. `preventScroll` porque el contrato App-like ya deja la
      // pantalla arriba: hacer scroll acá la movería sin motivo.
      if (!encabezado.hasAttribute('tabindex')) encabezado.setAttribute('tabindex', '-1');
      encabezado.focus({ preventScroll: true });
    }, 0);
  }
}
