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
import { LayoutDrawerComponent } from './layout-drawer.component';
import { BottomNavComponent } from './bottom-nav.component';
import { FocusOnNavigationDirective } from '@core/directives/focus-on-navigation.directive';
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
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    LayoutDrawerComponent,
    BottomNavComponent,
    FocusOnNavigationDirective,
  ],
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
      class="grid min-h-[100dvh] grid-cols-1 bg-canvas lg:h-[100dvh] lg:grid-cols-[auto_1fr]"
    >
      <!-- Sidebar -->
      <app-sidebar
        #sidebarEl
        class="fixed inset-y-0 start-0 z-50 w-[240px] -translate-x-full transition-transform duration-normal ease-standard lg:static lg:translate-x-0"
        [class.translate-x-0]="layout.sidebarOpen()"
      />

      <!-- Main: topbar + content -->
      <!-- flex, no grid: el drawer es HERMANO de la zona de contenido y la
           empuja. Con grid habría que declarar una columna que casi siempre
           mide cero. -->
      <!-- min-h-0: sin esto el drawer alto estira la fila del grid y arrastra
           al <main>, que deja de scrollear por dentro y hace scrollear el
           documento — rompiendo el contrato App-like justo al abrir el panel. -->
      <div class="flex min-h-0 min-w-0 overflow-hidden">
        <div class="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_1fr] overflow-hidden">
          <app-topbar />

          <!--
            container-type/name: LOAD-BEARING. Todo el bento grid responde a
            @container layoutmain, no a @media. Si se quitan estas dos
            propiedades, ninguna container query matchea y el grid colapsa a
            su layout base (1 columna) en cualquier ancho de pantalla.
          -->
          <!-- appFocusOnNavigation: tras cada navegación el foco va al <h1> de
               la pantalla nueva. Sin esto el foco se queda en el enlace pulsado
               y quien navega con teclado cambia de pantalla sin enterarse. -->
          <main
            #contentEl
            appFocusOnNavigation
            class="overflow-y-auto p-6 pb-24 transition-[view-transition-name:main-content] lg:pb-6"
            style="view-transition-name: main-content; container-type: inline-size; container-name: layoutmain;"
            role="main"
            tabindex="-1"
          >
            <router-outlet />
          </main>
        </div>

        <!-- Drawer arquitectónico: empuja el contenido en desktop, fullscreen en
             mobile. Su ancho lo anima GSAP; en reposo mide 0 y no ocupa nada. -->
        <app-layout-drawer />
      </div>

      <!-- Bajo 1024px: los destinos, bajo el pulgar. Va fuera del contenedor de
           <main> para que el drawer abierto no la angoste ni la desplace. -->
      <app-bottom-nav />
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
