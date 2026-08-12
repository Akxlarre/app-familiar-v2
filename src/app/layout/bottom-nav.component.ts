import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { IconComponent } from '@shared/components/icon/icon.component';
import { NavegacionService } from '@core/services/navegacion.service';

/**
 * BottomNavComponent — la navegación bajo el pulgar (spec 0003, AC6).
 *
 * Bajo 1024px el sidebar deja de estar a la vista y llegar al menú cuesta
 * abrir un panel. Con cinco destinos como máximo, la barra inferior los pone a
 * un toque sin tapar contenido — que es por qué la spec fija cinco y no siete.
 *
 * Los destinos salen de `NavegacionService`, igual que el sidebar: dos listas
 * distintas de lo mismo se desincronizan, y ésta es la que se mira más.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  host: {
    // `lg:hidden` y no una consulta al tier: esta barra es del VIEWPORT, no del
    // contenedor `<main>`. El bento mide su contenedor porque el drawer lo
    // angosta; la barra inferior tiene que seguir abajo aunque el drawer esté
    // abierto, así que su breakpoint es el de la pantalla.
    class: 'lg:hidden',
  },
  template: `
    @if (destinos().length > 0) {
      <nav
        class="fixed inset-x-0 bottom-0 z-40 flex border-t border-border-subtle bg-surface"
        style="padding-bottom: env(safe-area-inset-bottom);"
        aria-label="Navegación principal"
      >
        @for (destino of destinos(); track destino.id) {
          <a
            [routerLink]="destino.routerLink"
            class="flex flex-1 flex-col items-center gap-1 py-2 no-underline"
            [class.text-brand]="esActivo(destino.routerLink)"
            [class.text-text-muted]="!esActivo(destino.routerLink)"
            [attr.aria-current]="esActivo(destino.routerLink) ? 'page' : null"
            [attr.data-llm-action]="'ir-a-' + destino.id"
          >
            <app-icon [name]="destino.icon" [size]="20" [ariaHidden]="true" />
            <span class="micro-label">{{ destino.label }}</span>
          </a>
        }
      </nav>
    }
  `,
})
export class BottomNavComponent {
  private readonly navegacion = inject(NavegacionService);
  private readonly router = inject(Router);

  protected readonly destinos = this.navegacion.destinos;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected esActivo(routerLink: string): boolean {
    const destino = this.destinos().find((d) => d.routerLink === routerLink);
    return destino ? this.navegacion.esActivo(destino, this.url()) : false;
  }
}
