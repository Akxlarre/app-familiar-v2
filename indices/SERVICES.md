<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Servicios

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de sistema (escritura de archivos) para registrar el servicio en la tabla correspondiente al crearlo. Solo si el entorno no los soporta, usa el bloque `<memory_update>` para el humano.

## 1. Core & Utility Services
Servicios estructurales compartidos que proveen funcionalidades base, autenticación o UI interactions globales.

| Servicio | Responsabilidad Principal | Ubicación (File Path) | Dependencias | Estado |
|----------|---------------------------|-----------------------|--------------|--------|
| `SupabaseService` | Cliente Supabase singleton — NO inyectar en UI, solo en Facades/Services | `core/services/supabase.service.ts` | @supabase/supabase-js | ✅ Estable |
| `ToastService` | Wrapper sobre PrimeNG `MessageService` con `success()`, `error()`, `warning()`, `info()` y duraciones pre-configuradas. NUNCA inyectar MessageService directamente. | `core/services/toast.service.ts` | MessageService (PrimeNG) | ✅ Estable |
| `ThemeService` | Modo claro/oscuro/sistema con `[data-mode='dark']` en documentElement; persiste en localStorage | `core/services/theme.service.ts` | GsapAnimationsService, ToastService | ✅ Estable |
| `GsapAnimationsService` | Centraliza TODAS las animaciones GSAP: bento, counters, hover, page enter, reduced-motion | `core/services/gsap-animations.service.ts` | gsap, ScrollTrigger | ✅ Estable |
| `LayoutService` | Estado responsive del sidebar drawer en mobile (`sidebarOpen` signal) | `core/services/layout.service.ts` | — | ✅ Estable |
| `MenuConfigService` | Items de navegación del sidebar (`NavItem[]` — interfaz propia). `icon` es nombre Lucide kebab-case. Personalizar por proyecto agregando `NavItem` a la lista. | `core/services/menu-config.service.ts` | — | ✅ Estable |
| `NotificationsService` | Estado signal de notificaciones en-app con filtros y `unreadCount` computed | `core/services/notifications.service.ts` | — | ✅ Estable |
| `SearchPanelService` | Estado signal del panel de búsqueda global (open/close/toggle) para `[appSearchShortcut]` | `core/services/search-panel.service.ts` | — | ✅ Estable |
| `BreadcrumbService` | Breadcrumb reactivo; soporta menús planos y jerárquicos; deriva el trail desde `MenuConfigService` | `core/services/breadcrumb.service.ts` | Router, MenuConfigService | ✅ Estable |
| `ConfirmModalService` | Modal de confirmación imperativo con patrón `confirm() → Promise<boolean>`; sin dependencia de PrimeNG | `core/services/confirm-modal.service.ts` | — | ✅ Estable |
| `ModalOverlayService` | Teleporta modales al overlay container (z-index > topbar) | `core/services/modal-overlay.service.ts` | — | ✅ Estable |

## 2. Facades & Feature-Specific State
Servicios que median entre la UI (`features/`) y las APIs de datos (`SupabaseService`/`HttpClient`). Manejan el estado del dominio (`toSignal()`).

| Facade | Manejo de Dominio | Ubicación (File Path) | Dependencias | Estado |
|--------|-------------------|-----------------------|--------------|--------|
| `AuthFacade` | Autenticación con Supabase; expone `currentUser`, `isAuthenticated`, `login()`, `logout()`, `whenReady` | `core/services/auth.facade.ts` | SupabaseService, Router | ✅ Estable |

## 3. Pure Utilities
Funciones puras sin estado ni dependencias Angular. Importar desde `@core/utils`.

| Utility | Funciones | Ubicación | Estado |
|---------|-----------|-----------|--------|
| `date.utils` | `toISODate()`, `formatDate()`, `capitalize()` | `core/utils/date.utils.ts` | ✅ Estable |
| `validation.utils` | `validateEmail()` | `core/utils/validation.utils.ts` | ✅ Estable |
| Barrel | `export *` de todos los utils | `core/utils/index.ts` | ✅ Estable |

<!-- DETAIL:BEGIN -->
## Auto-Index — Servicios detectados por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Clase | Dependencias | Archivo |
|-------|-------------|---------|
| `BreadcrumbService` | `Router`, `MenuConfigService` | `src/app/core/services/breadcrumb.service.ts` |
| `ConfirmModalService` | — | `src/app/core/services/confirm-modal.service.ts` |
| `ErrorSanitizerService` | — | `src/app/core/services/error-sanitizer.service.ts` |
| `GsapAnimationsService` | `PLATFORM_ID` | `src/app/core/services/gsap-animations.service.ts` |
| `LayoutDrawerFacadeService` | `LayoutDrawerService` | `src/app/core/services/layout-drawer.facade.service.ts` |
| `LayoutDrawerService` | — | `src/app/core/services/layout-drawer.service.ts` |
| `LayoutService` | — | `src/app/core/services/layout.service.ts` |
| `MenuConfigService` | — | `src/app/core/services/menu-config.service.ts` |
| `ModalOverlayService` | — | `src/app/core/services/modal-overlay.service.ts` |
| `NotificationsService` | — | `src/app/core/services/notifications.service.ts` |
| `SearchPanelService` | `SearchPanelService` | `src/app/core/services/search-panel.service.ts` |
| `SupabaseService` | — | `src/app/core/services/supabase.service.ts` |
| `ThemeService` | `ThemeService`, `PLATFORM_ID`, `GsapAnimationsService`, `ToastService` | `src/app/core/services/theme.service.ts` |
| `ToastService` | `ToastService`, `MessageService` | `src/app/core/services/toast.service.ts` |

<!-- AUTO-GENERATED:END -->
