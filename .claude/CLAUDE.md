# app-familiar-v2 — Koa Agent Blueprint v7.0.0

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes leer al menos un archivo de `indices/`. Serás bloqueado automáticamente.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes`.
- **File Protector** — No puedes modificar los archivos del sistema de hooks (`.claude/hooks/`, `settings.json`, `architect.js`).
- **Bash Guard** — No puedes crear archivos `.ts/.html/.scss` via Bash. Usa Edit/Write.
- **Compact Recovery** — Si el contexto se compacta, los índices se re-inyectan automáticamente (PostCompact).
- **Failure Tracker** — Los errores de tools se registran en `.claude/temp/LESSONS_LEARNED.md` con dedup y rotación automática (max 20).
- **Sync Check** — Al terminar de responder, se verifica si los índices necesitan actualización.
- **Context Guardian** — Al terminar de responder, audita la frescura del contexto semántico: avisa si `context/brief.md` tiene más de 7 días sin actualizar o si `context/learnings.md` lleva más de 14 días sin crecer.
- **Harness Gate** — Las superficies de guía (`.claude/rules/`, `indices/ANTI-PATTERNS.md`, `context/learnings.md`, `CLAUDE.md`) solo aceptan **principios reutilizables** con criterio de aplicabilidad, nunca parches de un track puntual. La lógica determinista va en `scripts/`, no en prosa.
- **Spec Gate (SDD)** — Si el proyecto tiene carpeta `specs/`, no puedes tocar código de producto sin una spec activa con su plan. Sin `specs/`, no bloquea nada.
- **Prettier** — Cada archivo editado se formatea automáticamente.

> Hook adicional **opt-in**: `context-enrichment-guard.js` (Day 0 Context Guard) bloquea escribir
> código mientras `context/domain.md` e `indices/DATABASE.md` sigan vacíos. No viene cableado —
> actívalo en `.claude/settings.json` cuando el dominio lo amerite.

Detalle completo: @docs/HOOKS-SYSTEM.md

## Comandos del proyecto

- Dev: `ng serve`
- Build: `ng build`
- Lint: `ng lint`
- Lint arquitectónico: `npm run lint:arch`
- Supabase local: `npx supabase start`

## Flujo obligatorio (5 pasos)

1. **DESCUBRIR** — Lee los índices de `indices/` (COMPONENTS, SERVICES, FACADES, MODELS…) **y** `context/domain.md` + `context/brief.md` si existen. Los índices te dicen qué código hay; el contexto te dice qué es el negocio y qué se está construyendo hoy. **El Discovery Gate te bloqueará si no lees los índices.**
2. **PLANIFICAR** — Define qué vas a tocar sin violar las reglas de arquitectura.
3. **EJECUTAR** — Escribe el código. Reutiliza siempre lo existente primero. Los hooks validarán cada escritura en tiempo real.
4. **VALIDAR** — Corre `npm run lint:arch` para una auditoría completa del proyecto.
5. **SINCRONIZAR** — Actualiza `indices/*.md` con los componentes/servicios creados. El Stop hook te lo recordará si lo olvidas.

## Skills disponibles

| Skill | Cuándo usar |
|---|---|
| `/plan` | SIEMPRE antes de una tarea no trivial (>2 archivos). Genera task-spec con artefactos afectados, reglas que aplican y criterio de done. |
| `/angular-component` | Crear o refactorizar un componente Angular |
| `/angular-signals` | Implementar estado reactivo con Signals |
| `/sync-indices` | Sincronizar índices al cerrar sesión |
| `sdd` | Ciclo Spec-Driven Development. Comandos: `/spec-new`, `/spec-activate`, `/spec-plan`, `/spec-tasks`, `/spec-verify`, `/fix-new`, `/fix-close`, `/hotfix`, `/assign-new`, `/assign-list`, `/assign-claim` |
| `verify` | Verificar visualmente en el navegador (Playwright MCP) que un cambio funciona de verdad — no solo que compila |
| `form-ux` | Diseñar o revisar la UX de un formulario |
| `grill_me` | Estresar una propuesta con preguntas antes de convertirla en spec |
| `harness-feedback` | Registrar fricción del harness para mejorarlo |

### SDD — cómo activarlo

El motor SDD viene incluido pero **dormido**: sin carpeta `specs/`, el `spec-gate` deja pasar todo.
Para activarlo, ver la sección "Activar el SDD en este proyecto" en `.claude/skills/sdd/SKILL.md`.

## Reglas del proyecto (path-scoped — se cargan automáticamente)

Las reglas viven en `.claude/rules/` con frontmatter `paths:`. Claude Code las inyecta
**solo cuando el archivo editado coincide con el path** — no se cargan todas al inicio.

| Archivos editados | Reglas activas |
|---|---|
| `src/app/**/*.ts` + `.html` | `architecture`, `facades`, `swr-pattern`, `testing-tdd`, `state-management` |
| `src/app/core/models/**` + `core/facades/**` | `models`, `facades` |
| `src/app/shared/**` + `features/**` | `component-selection` |
| `src/app/**/*.html` + `shared/**` + `styles/**` | `visual-system`, `ai-readability` |
| `src/app/features/**` + `layout/**` | `notifications`, `layout-blueprints` |
| `supabase/**` + `core/services/**` | `database` |

## Referencias (leer bajo demanda — no cargadas automáticamente)

- Stack completo: `docs/TECH-STACK-RULES.md`
- Brand & UI: `docs/BRAND_GUIDELINES.md`
- Sistema de Hooks: `docs/HOOKS-SYSTEM.md`
- Visión del producto: `docs/PRODUCT-VISION.md`
