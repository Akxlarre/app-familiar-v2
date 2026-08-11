import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { LayoutService } from "@core/services/layout.service";
import { GsapAnimationsService } from "@core/services/gsap-animations.service";
import { SidebarComponent } from "./sidebar.component";
import { TopbarComponent } from "./topbar.component";

/**
 * AppShellComponent — layout principal de rutas protegidas.
 *
 * Estructura: sidebar fijo + área de contenido (topbar + router-outlet).
 * En mobile el sidebar actúa como drawer animado con GSAP.
 *
 * Uso en app.routes.ts:
 * ```ts
 * { path: 'app', loadComponent: () => import('./layout/app-shell.component')
 *     .then(m => m.AppShellComponent), children: [...] }
 * ```
 */
@Component({
  selector: "app-shell",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <!-- Backdrop mobile drawer -->
    @if (layout.sidebarOpen()) {
      <div
        #backdropEl
        class="fixed inset-0 z-[49] cursor-pointer bg-[var(--overlay-backdrop)] lg:hidden"
        role="presentation"
        aria-hidden="true"
        data-llm-action="close-mobile-sidebar"
        (click)="layout.closeSidebar()"
      ></div>
    }

    <div
      class="grid min-h-[100dvh] grid-cols-1 bg-base lg:grid-cols-[auto_1fr]"
    >
      <!-- Sidebar -->
      <app-sidebar
        #sidebarEl
        class="fixed inset-y-0 start-0 z-50 w-[240px] -translate-x-full transition-transform duration-normal ease-standard lg:static lg:translate-x-0"
        [class.translate-x-0]="layout.sidebarOpen()"
      />

      <!-- Main: topbar + content -->
      <div class="grid min-w-0 grid-rows-[auto_1fr] overflow-hidden">
        <app-topbar />

        <!--
          container-type/name: LOAD-BEARING. Todo el bento grid responde a
          @container layoutmain, no a @media. Si se quitan estas dos
          propiedades, ninguna container query matchea y el grid colapsa a
          su layout base (1 columna) en cualquier ancho de pantalla.
        -->
        <main
          #contentEl
          class="overflow-y-auto p-6 transition-[view-transition-name:main-content]"
          style="view-transition-name: main-content; container-type: inline-size; container-name: layoutmain;"
          role="main"
          tabindex="-1"
        >
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  host: { style: "display: contents;" },
})
export class AppShellComponent {
  protected readonly layout = inject(LayoutService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly contentEl = viewChild<ElementRef<HTMLElement>>("contentEl");

  constructor() {
    afterNextRender(() => {
      const el = this.contentEl()?.nativeElement;
      if (!el) return;

      this.gsap.animatePageEnter(el);

      // Tier por CONTENEDOR: el ancho real de <main> alimenta LayoutService.tier
      // para la densidad adaptativa (patrón App-like). Se registra una sola vez,
      // acá en el shell — nunca en páginas individuales.
      this.destroyRef.onDestroy(this.layout.observeMain(el));
    });
  }
}
