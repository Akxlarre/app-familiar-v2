<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Anti-Patterns (NO HACER)

> Este índice enumera atajos comunes que degradan el sistema.  
> **Regla:** si detectas uno, detente y refactoriza hacia el patrón canónico.

## AP-001 — `[ngClass]` (evitar)
- **NO** uses `[ngClass]`.
- **Sí** usa binding directo: `[class.active]="isActive()"`, `[class.foo]="cond()"`.

## AP-002 — `@Input()` / `@Output()` (evitar)
- **NO** uses `@Input()` / `@Output()`.
- **Sí** usa Signal Inputs/Outputs: `input()`, `output()`.

## AP-003 — `inject(SupabaseService)` en componentes (evitar)
- **NO** inyectes `SupabaseService` ni importes `@supabase/supabase-js` en `features/` o `shared/`.
- **Sí** usa un `*FacadeService` para datos/estado y expón Signals al template.

## AP-004 — Colores Tailwind hardcodeados (evitar)
- **NO** uses `text-red-500`, `bg-blue-200`, etc.
- **Sí** usa tokens semánticos (`text-primary`, `text-muted`, `bg-surface`, `bg-canvas`, `var(--ds-brand)`).

## AP-005 — `@angular/animations` (evitar)
- **NO** uses `@angular/animations`.
- **Sí** usa GSAP vía `GsapAnimationsService` (y View Transitions para navegación).

## AP-006 — `.db.from()` en un Facade (evitar)
- **NO** llames `inject(SupabaseService).db.from('tabla')` dentro de un Facade.
- El getter `.db` existe **solo para Repositories** (`core/repositories/`).
- **Sí** crea un `*Repository` que encapsula la query y haz que el Facade lo inyecte.
- Patrón canónico: `UI → Facade → Repository → SupabaseService.db`

