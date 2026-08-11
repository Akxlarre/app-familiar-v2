<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Facades

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE registrar toda Facade nueva en esta tabla al crearla. Antes de crear una Facade, verificar aquí si ya existe una que cubra el dominio. Duplicar Facades para el mismo dominio es un error arquitectónico grave.

## Facades de Dominio

| Facade | Dominio | Signals Expuestos | Ubicación | Estado |
|--------|---------|-------------------|-----------|--------|
| `AuthFacade` | Autenticación | `currentUser`, `isAuthenticated`, `isLoading` | `core/services/auth.facade.ts` | ✅ Estable |

<!-- DETAIL:BEGIN -->
## Auto-Index — Facades detectadas por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Clase | Dependencias | Signals expuestos | Archivo |
|-------|-------------|------------------|---------|
| `BandejaFacade` | `CapturasRepository`, `ToastService` | — | `src/app/core/facades/bandeja.facade.ts` |
| `ProductosFacade` | `SupabaseService` | — | `src/app/core/facades/base.facade.ts` |
| `AuthFacade` | `SupabaseService`, `Router`, `ProfilesRepository` | — | `src/app/core/services/auth.facade.ts` |

<!-- AUTO-GENERATED:END -->
