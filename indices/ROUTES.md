<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Mapa de Rutas

> Árbol de rutas del proyecto con sus guards y componentes. Se regenera con `npm run indices:sync`.

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Path | Componente | Guards | Archivo de rutas |
|------|-----------|--------|------------------|
| `/login` | `LoginComponent` | `guestGuard` | `src/app/app.routes.ts` |
| `/app` | `AppShellComponent` | `authGuard` | `src/app/app.routes.ts` |
| `/app` | → redirect a `dashboard` | — | `src/app/app.routes.ts` |
| `/app/dashboard` | `DashboardComponent` | — | `src/app/app.routes.ts` |
| `/` | → redirect a `/login` | — | `src/app/app.routes.ts` |
| `/**` | `NotFoundComponent` | — | `src/app/app.routes.ts` |

<!-- AUTO-GENERATED:END -->
