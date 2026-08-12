import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';

/**
 * Las subsecciones de Plata.
 *
 * Sólo entran acá las que **existen**. Cuotas (spec 0007) y Presupuestos
 * (0008) no están, y no van comentadas ni deshabilitadas: un tab que no lleva
 * a ningún lado es la misma promesa que AC4 de la spec 0003 prohíbe en el menú
 * principal, sólo que un nivel más abajo.
 */
const SUBSECCIONES: ReadonlyArray<TabOption & { ruta: string }> = [
  { id: 'movimientos', label: 'Movimientos', shortLabel: 'Movs', icon: 'wallet', ruta: 'movimientos' },
  { id: 'cuentas', label: 'Cuentas', shortLabel: 'Ctas', icon: 'credit-card', ruta: 'cuentas' },
] as const;

/**
 * PlataShellComponent — la sección y sus tabs.
 *
 * Cierra AC3, AC7 y AC-E3 de la spec 0003, que estaban diferidos por no existir
 * ninguna sección con dos subsecciones.
 *
 * El tab activo sale de la **URL**, no de un signal propio: recargar en una
 * subsección tiene que dejar el tab correcto (AC-E3 de la 0003), y dos fuentes
 * de verdad para "dónde estoy" se desincronizan en cuanto alguien navega con el
 * botón del navegador.
 */
@Component({
  selector: 'app-plata-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TabsComponent],
  template: `
    <div class="flex h-full min-h-0 flex-col gap-3">
      <app-tabs
        [tabs]="tabs"
        [activeId]="activo()"
        (activeIdChange)="irA($event)"
      />
      <div class="min-h-0 flex-1">
        <router-outlet />
      </div>
    </div>
  `,
})
export class PlataShellComponent {
  private readonly router = inject(Router);

  protected readonly tabs = SUBSECCIONES.map(({ ruta: _ruta, ...tab }) => tab);

  private readonly url = signal(this.router.url);

  /** El primero cuyo segmento aparece en la URL; si ninguno, el primero de la lista. */
  protected readonly activo = computed(() => {
    const url = this.url();
    return SUBSECCIONES.find((s) => url.includes(`/plata/${s.ruta}`))?.id ?? SUBSECCIONES[0].id;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.url.set(this.router.url));
  }

  protected irA(id: string): void {
    const destino = SUBSECCIONES.find((s) => s.id === id);
    if (destino) void this.router.navigate(['/app/plata', destino.ruta]);
  }
}
