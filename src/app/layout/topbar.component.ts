import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthFacade } from "@core/services/auth.facade";
import { BreadcrumbService } from "@core/services/breadcrumb.service";
import { LayoutService } from "@core/services/layout.service";
import { NotificationsService } from "@core/services/notifications.service";
import { ThemeService } from "@core/services/theme.service";
import { Button } from "primeng/button";
import { Avatar } from "primeng/avatar";
import { BadgeModule } from "primeng/badge";
import { IconComponent } from "@shared/components/icon/icon.component";

/**
 * TopbarComponent — barra superior de la aplicación.
 *
 * Smart component: inyecta LayoutService, AuthFacade, NotificationsService, ThemeService.
 *
 * TODOs para extender:
 * - Añadir overlay/panel de notificaciones al pulsar el botón de campana
 * - Añadir menú de usuario (p-menu) al pulsar el avatar
 */
@Component({
  selector: "app-topbar",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Avatar, BadgeModule, IconComponent],
  template: `
    <header
      class="sticky top-0 z-10 flex h-[56px] items-center gap-4 border-b border-border-subtle bg-surface px-6 shadow-[var(--shadow-layout-topbar)]"
      role="banner"
    >
      <!-- Hamburger — solo visible en mobile -->
      <p-button
        class="!flex lg:!hidden"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Abrir menú de navegación"
        data-llm-action="toggle-mobile-sidebar"
        (onClick)="layout.toggleSidebar()"
      >
        <app-icon name="menu" [size]="18" [ariaHidden]="true" />
      </p-button>

      <!-- Ruta actual — alimentada por BreadcrumbService desde el menú -->
      <nav class="flex-1 min-w-0" aria-label="Ruta de navegación">
        <ol class="m-0 flex list-none items-center gap-1.5 p-0 text-sm">
          <li>
            <a
              [routerLink]="breadcrumb.breadcrumb().home.routerLink"
              class="flex items-center text-text-muted transition-colors hover:text-text-primary"
              [attr.aria-label]="breadcrumb.breadcrumb().home.label"
            >
              <app-icon name="home" [size]="14" [ariaHidden]="true" />
            </a>
          </li>
          @for (item of breadcrumb.breadcrumb().items; track item.label) {
            <li class="flex items-center gap-1.5 min-w-0">
              <app-icon
                name="chevron-right"
                [size]="12"
                [ariaHidden]="true"
                class="text-text-muted"
              />
              <span class="truncate font-medium text-text-secondary">{{ item.label }}</span>
            </li>
          }
        </ol>
      </nav>

      <!-- Acciones de la derecha -->
      <div
        class="flex items-center gap-1"
        role="toolbar"
        aria-label="Acciones globales"
      >
        <!-- Notificaciones -->
        <div
          class="relative"
          [attr.aria-label]="
            'Notificaciones (' + notifications.unreadCount() + ' sin leer)'
          "
        >
          <p-button
            [text]="true"
            [rounded]="true"
            severity="secondary"
            ariaLabel="Ver notificaciones"
            data-llm-action="open-notifications-panel"
          >
            <app-icon name="bell" [size]="18" [ariaHidden]="true" />
          </p-button>
          @if (notifications.unreadCount() > 0) {
            <span
              class="badge-count absolute right-1 top-1"
              aria-hidden="true"
            >
              {{ notifications.unreadCount() }}
            </span>
          }
        </div>

        <!-- Avatar de usuario -->
        @if (auth.currentUser(); as user) {
          <p-button
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="'Perfil de ' + user.name"
            data-llm-action="open-user-profile-menu"
          >
            <p-avatar [label]="user.initials" shape="circle" size="normal" />
          </p-button>
        }
      </div>
    </header>
  `,
  styles: [],
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly auth = inject(AuthFacade);
  protected readonly notifications = inject(NotificationsService);
  protected readonly theme = inject(ThemeService);
  protected readonly breadcrumb = inject(BreadcrumbService);
}
