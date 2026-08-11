import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';
import { LayoutDrawerService } from '@core/services/layout-drawer.service';

/**
 * LayoutDrawerComponent — panel lateral dinámico del shell.
 *
 * - **Desktop (≥768px):** hermano flex de `<main>` que EMPUJA el contenido en vez
 *   de taparlo. Por eso el bento se compacta (`.force-compact`) mientras está
 *   abierto: el contenido sigue siendo usable con menos ancho.
 * - **Mobile (<768px):** fixed a pantalla completa con backdrop, animado en X.
 *
 * El modo se decide en runtime dentro de las animaciones GSAP, así que un resize
 * con el drawer abierto no lo deja en un estado intermedio.
 *
 * Va en `AppShellComponent` como hermano de `<main>`. Solo habla con
 * `LayoutDrawerService`; los componentes de feature usan `LayoutDrawerFacadeService`.
 */
@Component({
  selector: 'app-layout-drawer',
  standalone: true,
  imports: [NgComponentOutlet, IconComponent, BadgeComponent, PressFeedbackDirective, CardHoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Desktop: hermano flex de ancho 0 que GSAP expande (layout-shift).
    // Mobile: la animación lo pasa a fixed con estilos inline.
    class: 'shrink-0 overflow-visible relative z-30',
    style: 'width: 0px; display: none; box-sizing: border-box;',
  },
  template: `
    <!-- Backdrop: solo mobile, lo muestra y oculta GSAP -->
    <div
      data-drawer-backdrop
      class="absolute inset-0 z-0 bg-black/50"
      style="opacity: 0; display: none;"
      (click)="close()"
      aria-hidden="true"
    ></div>

    <div
      data-drawer-panel
      class="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-tl-2xl border-border-subtle bg-canvas lg:rounded-tr-2xl lg:border-x lg:border-t"
      style="min-height: 0; will-change: transform;"
      role="dialog"
      [attr.aria-label]="title()"
    >
      <!-- Header -->
      <header
        class="z-20 mx-4 mt-4 mb-2 flex shrink-0 flex-row! items-center justify-between gap-4 px-4! py-3! bento-card"
        appCardHover
      >
        <div class="flex min-w-0 flex-1 items-center">
          @if (canGoBack()) {
            <button
              type="button"
              appPressFeedback
              (click)="back()"
              class="mr-3 flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-subtle hover:text-text-primary"
              aria-label="Volver"
              data-llm-action="drawer-back"
            >
              <app-icon name="arrow-left" [size]="16" [ariaHidden]="true" />
              <span class="hidden md:inline">Volver</span>
            </button>
            <div class="mr-3 h-5 w-px shrink-0" style="background-color: var(--border-subtle);"></div>
          }

          @if (icon(); as nombreIcono) {
            <div
              class="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style="background: var(--color-primary-tint); color: var(--color-primary);"
            >
              <app-icon [name]="nombreIcono" [size]="18" [ariaHidden]="true" />
            </div>
          }

          <h2 class="m-0 truncate text-base font-semibold text-text-primary">{{ title() }}</h2>

          @if (badge(); as textoBadge) {
            <app-badge variant="brand" class="ml-3 shrink-0">{{ textoBadge }}</app-badge>
          }
        </div>

        <div class="flex shrink-0 items-center">
          @if (actions().length > 0) {
            <div class="mr-3 flex items-center gap-1">
              @for (accion of actions(); track accion.label) {
                <button
                  type="button"
                  appPressFeedback
                  (click)="accion.callback()"
                  class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-transparent px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-subtle hover:text-text-primary"
                  [attr.data-llm-action]="accion.llmAction"
                >
                  <app-icon [name]="accion.icon" [size]="16" [ariaHidden]="true" />
                  <span class="hidden sm:inline">{{ accion.label }}</span>
                </button>
              }
            </div>
            <div class="mr-3 h-5 w-px shrink-0" style="background-color: var(--border-subtle);"></div>
          }

          <button
            type="button"
            appPressFeedback
            (click)="close()"
            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-muted transition-colors hover:bg-subtle hover:text-text-primary"
            aria-label="Cerrar panel"
          >
            <app-icon name="x" [size]="20" [ariaHidden]="true" />
          </button>
        </div>
      </header>

      <!-- Cuerpo dinámico -->
      <div class="mr-1 mb-2 flex flex-1 flex-col overflow-y-auto py-2 pr-3 pl-4 lg:mr-2 lg:pr-2">
        @if (component(); as componenteActivo) {
          <ng-container *ngComponentOutlet="componenteActivo; inputs: inputs()" />
        }
      </div>
    </div>
  `,
})
export class LayoutDrawerComponent implements OnDestroy {
  private readonly drawer = inject(LayoutDrawerService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly isOpen = this.drawer.isOpen;
  protected readonly component = this.drawer.component;
  protected readonly title = this.drawer.title;
  protected readonly icon = this.drawer.icon;
  protected readonly actions = this.drawer.actions;
  protected readonly badge = this.drawer.badge;
  protected readonly inputs = this.drawer.inputs;
  protected readonly canGoBack = this.drawer.canGoBack;

  /** El signal `isOpen` cambia antes que el DOM: hace falta saber qué se animó. */
  private visible = false;

  constructor() {
    effect(() => {
      const abierto = this.isOpen();

      if (abierto && !this.visible) {
        this.visible = true;
        this.cdr.markForCheck();
        // Un tick para que Angular resuelva el NgComponentOutlet antes de animar;
        // si no, GSAP mide un panel vacío.
        setTimeout(() => this.gsap.animateLayoutDrawerEnter(this.el.nativeElement, this.backdrop()), 0);
        return;
      }

      if (!abierto && this.visible) {
        this.visible = false;
        this.gsap.animateLayoutDrawerLeave(this.el.nativeElement, this.backdrop(), () => {
          this.drawer.clear();
          this.cdr.markForCheck();
        });
      }
    });
  }

  ngOnDestroy(): void {
    // El drawer bloquea el scroll del body en mobile. Si el componente muere con
    // el panel abierto, la página quedaría trabada para siempre.
    document.body.style.overflow = '';
  }

  private backdrop(): HTMLElement | null {
    return this.el.nativeElement.querySelector('[data-drawer-backdrop]');
  }

  protected back(): void {
    this.drawer.back();
  }

  protected close(): void {
    this.drawer.close();
  }
}
