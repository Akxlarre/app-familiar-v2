<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Mapa de Uso (quién usa qué)

> Cruce de componentes, directivas y servicios contra los archivos que los consumen. Sirve para medir el impacto real de un cambio ANTES de hacerlo. Se regenera con `npm run indices:sync`.

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
## Componentes shared → Consumidores

| Componente | Usado en |
|------------|----------|
| `app-alert-card` | `shared/components/error-state` |
| `app-icon` | `features/dashboard`, `layout`, `shared/components/alert-card`, `shared/components/drawer`, `shared/components/empty-state`, `shared/components/kpi-card` |
| `app-kpi-card` | `features/dashboard` |
| `app-skeleton-block` | `shared/components/kpi-card` |

## Directivas → Consumidores

| Directiva | Usada en |
|-----------|---------|
| `[appAnimateIn]` | `features/dashboard` |
| `[appBentoGridLayout]` | `features/dashboard` |
| `[appBentoReveal]` | `features/dashboard` |
| `[appCardHover]` | `features/dashboard` |
| `[appPressFeedback]` | `shared/components/alert-card`, `shared/components/drawer`, `shared/components/empty-state` |

## Facades → Consumidores

| Facade | Inyectada en |
|--------|-------------|
| `AuthFacade` | `features/auth/login`, `features/dashboard`, `layout` |

## Services → Consumidores

| Service | Inyectado en |
|---------|-------------|
| `BreadcrumbService` | `layout` |
| `GsapAnimationsService` | `features/dashboard`, `layout`, `shared/components/drawer`, `shared/components/kpi-card` |
| `LayoutService` | `layout` |
| `MenuConfigService` | `layout` |
| `NotificationsService` | `layout` |
| `ThemeService` | `layout` |

## Matriz de patrones por página

| Página | Loading | Empty | Error | Skeleton |
|--------|---------|-------|-------|----------|
| `features/auth/login` | ❌ | ❌ | ❌ | ❌ |
| `features/dashboard` | ✅ | ❌ | ❌ | ❌ |
| `features/not-found` | ❌ | ❌ | ❌ | ❌ |

## Sin consumidores detectados (candidatos a revisión)

> ⚠️ Un componente enrutado directo (ver ROUTES.md, ya excluidos), instanciado dinámicamente
> (`ViewContainerRef`, overlays) o usado solo en specs puede aparecer aquí sin estar muerto.
> Verificar antes de eliminar.

| Artefacto | Tipo | Archivo |
|-----------|------|---------|
| `app-drawer` | componente | `src/app/shared/components/drawer/drawer.component.ts` |
| `app-empty-state` | componente | `src/app/shared/components/empty-state/empty-state.component.ts` |
| `app-error-state` | componente | `src/app/shared/components/error-state/error-state.component.ts` |
| `[appClickOutside]` | directiva | `src/app/core/directives/click-outside.directive.ts` |
| `[appHasRole]` | directiva | `src/app/core/directives/has-role.directive.ts` |
| `[appModalOverlay]` | directiva | `src/app/core/directives/modal-overlay.directive.ts` |
| `[appScrollContainer]` | directiva | `src/app/core/directives/scroll-container.directive.ts` |
| `[appScrollReveal]` | directiva | `src/app/core/directives/scroll-reveal.directive.ts` |
| `[appSearchShortcut]` | directiva | `src/app/core/directives/search-shortcut.directive.ts` |
| `[appStableWidth]` | directiva | `src/app/core/directives/stable-width.directive.ts` |


<!-- AUTO-GENERATED:END -->
