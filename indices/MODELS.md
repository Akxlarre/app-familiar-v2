<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Modelos (DTO & UI)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE registrar todo modelo nuevo en la tabla correspondiente (`dto/` o `ui/`). Antes de crear un modelo, verificar aquí si ya existe uno que resuelva la necesidad. Ver reglas completas en `.claude/rules/models.md`.

## DTO (Data Transfer Objects — mapean tablas de Supabase)

| Modelo | Tabla/Vista | Campos Clave | Ubicación | Estado |
|--------|-------------|--------------|-----------|--------|
| `User` | `users` | `id`, `first_names`, `paternal_last_name`, `email`, `role_id` | `core/models/dto/user.model.ts` | ✅ Estable |

## UI (Modelos de Presentación — no existen en BD)

| Modelo | Propósito | Campos Clave | Ubicación | Estado |
|--------|-----------|--------------|-----------|--------|
| `User` | Usuario para la vista (camelCase, campos derivados) | `id`, `name`, `initials`, `role` | `core/models/ui/user.model.ts` | ✅ Estable |

<!-- DETAIL:BEGIN -->
## Auto-Index — Modelos detectados por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Interfaces | Categoría | Archivo |
|-----------|----------|---------|
| `OrigenCaptura`, `EstadoCaptura`, `PayloadCaptura`, `InterpretacionCaptura`, `Captura`, `ResolucionCaptura` | `other` | `src/app/core/models/captura.model.ts` |
| `LayoutTier` | `other` | `src/app/core/models/layout.model.ts` |
| `NotificationType`, `Notification` | `other` | `src/app/core/models/notification.model.ts` |
| `SectionHeroChip`, `SectionHeroMenuItem`, `SectionHeroKpi`, `SectionHeroAction` | `other` | `src/app/core/models/section-hero.model.ts` |
| `UserRole`, `User` | `other` | `src/app/core/models/user.model.ts` |

<!-- AUTO-GENERATED:END -->
