---
name: sdd
description: >
  Spec-Driven Development para Koa CLI. Activar cuando el usuario pida crear, planificar,
  ejecutar o verificar un feature/módulo, o cuando mencione "spec", "requerimiento",
  "plan técnico", "acceptance criteria" o use cualquier comando /spec-*, /fix-*, /hotfix o
  /assign-*. El SDD impone un contrato verificable (spec → plan → tasks → acceptance) antes
  de tocar código de producto; la capa de Asignaciones (/assign-new, /assign-list,
  /assign-claim) reparte tareas de equipo antes de que cada quien escriba su propia spec.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# SDD — Spec-Driven Development para Koa CLI

> Este skill convierte cada feature en un **contrato verificable** antes de tocar código.
> Cuatro artefactos por feature, validados por 3 hooks. Stack-agnóstico (sirve para Angular,
> Next.js, Python, etc.) — el acoplamiento con el dominio del proyecto vive en sus índices
> y reglas locales, no acá.

## Cuándo activar este skill

- El usuario invoca `/spec-new`, `/spec-activate`, `/spec-plan`, `/spec-tasks`, `/spec-verify`, `/fix-new`, `/fix-close`, `/hotfix`, `/assign-new`, `/assign-list` o `/assign-claim`.
- El usuario pide "creemos la spec de…", "planifiquemos el feature X", "verifica los AC", "asígnale esto a X", "qué me toca a mí", "designemos tareas al equipo".
- Vas a tocar `src/`, `app/`, `lib/` o `supabase/migrations/` y el proyecto tiene carpeta `specs/`
  (en ese caso el `spec-gate` te bloqueará si no hay spec activa — este skill te dice cómo desbloquearlo).

## El ciclo SDD (5 fases)

| Fase | Comando | Artefacto | Responsable |
|------|---------|-----------|-------------|
| 1. Spec | `/spec-new "título"` | `specs/specs/NNNN-slug/spec.md` | Usuario aprueba; Claude puede redactar borrador |
| 2. Activar | `/spec-activate NNNN` | `specs/.active` | Usuario |
| 3. Plan | `/spec-plan` | `specs/specs/NNNN-slug/plan.md` | Claude redacta basado en spec + índices |
| 4. Tareas | `/spec-tasks` | `specs/specs/NNNN-slug/tasks.md` | Claude descompone plan en checklist atómico |
| 5. Implementar | (libre) | código + tests | Claude ejecuta tareas; hooks validan |
| 6. Verificar | `/spec-verify` | `specs/specs/NNNN-slug/acceptance.md` | AC verifier (Haiku) marca AC con evidencia |

## Estructura canónica de un proyecto con SDD activo

```
<proyecto>/
├── specs/
│   ├── ROADMAP.md              # índice vivo de todas las specs (estado, prioridad, dueño)
│   ├── ASSIGNMENTS.md          # tablero de Asignaciones de equipo (previo a un track) — opcional
│   ├── assignments/
│   │   └── ASG-X-NNN-slug.md     # brief de una Asignación (contexto para quien la reclame)
│   ├── .active                 # contiene el ID del track en ejecución, o vacío
│   ├── specs/
│   │   └── NNNN-X-slug/
│   │       ├── spec.md         # QUÉ + POR QUÉ + AC + out-of-scope
│   │       ├── plan.md         # CÓMO técnicamente
│   │       ├── tasks.md        # checklist atomizado con DoD
│   │       └── acceptance.md   # AC marcados con evidencia (commit, test, screenshot)
│   ├── fixes/
│   │   └── fix-NNN-X-slug/
│   │       └── fix.md          # Root Cause + ACs afectados + test de regresión
│   └── hotfixes/
│       └── hotfix-NNN-X-slug/
│           └── hotfix.md       # Problema + Cambios (auto-cerrado al fin de sesión)
└── .claude/
    └── settings.json           # engancha los 3 hooks SDD globales
```

## Asignaciones de equipo (capa previa, opcional)

Para equipos multi-dev (varios agentes/personas compartiendo `specs/` commiteado al repo —
en proyectos de un solo dev conviene gitignorarlo), existe una capa **antes**
de la spec: la **Asignación**. No es un 4to track — es cómo alguien designa
"esto hay que hacer" a un integrante del equipo (o lo deja abierto), y esa persona genera su propio
track real a partir de ahí, con contexto pre-cargado.

```
/assign-new "título"     → specs/ASSIGNMENTS.md ("Pendientes", visible para todo el equipo)
/assign-list             → cada dev ve qué le toca a él (o qué está libre para tomar)
/assign-claim <ASG-ID>   → resume la ASG y da a quien reclama una instancia breve para
                           confirmar u objetar la visión heredada, ANTES de generar el track
                           → genera spec/fix/hotfix con SU código de autor, contexto pre-cargado
                           → de ahí en más, flujo SDD normal (/spec-plan, /spec-tasks, etc.)
```

- Vive en `specs/ASSIGNMENTS.md` (índice) + `specs/assignments/ASG-X-NNN-slug.md` (un archivo liviano por asignación).
- `ASG-<autor>-NNN` usa contador **por autor**, igual que spec/fix/hotfix (ver `specs/AUTHORS.md`). Un contador global provoca que dos devs en ramas distintas saquen el mismo ID y que git auto-resuelva el merge sin conflicto.
- Las tablas "Reclamadas / En curso" y "Completadas" de `ASSIGNMENTS.md` son **auto-generadas** por `npm run assignments:sync` desde el frontmatter de cada `ASG-*.md`, cruzado con el `status`/`closed` del track resultante. Solo "Pendientes" se mantiene a mano (tiene curación: flags de bloqueo, notas de solape, agrupación por reunión).
- `npm run assignments:audit` verifica integridad (naming, colisiones de numeración, refs colgantes, filas stale) sin escribir nada.
- **Riesgo multi-rama**: si cada dev trabaja en su propia rama, el tablero puede quedar desactualizado entre ramas. `/assign-new` y `/assign-claim` hacen un chequeo best-effort (`git fetch` + diff contra `origin/main`) y recuerdan commitear/pushear la reclamación de inmediato, separada del resto del trabajo de feature — ver la sección "Conflictos entre ramas" en `specs/ASSIGNMENTS.md`.
- Si el equipo no la necesita (proyecto de una sola persona), simplemente no se usa — `/spec-new` sigue funcionando exactamente igual sin que exista `ASSIGNMENTS.md`.

## Los hooks SDD (vendorizados en `.claude/hooks/sdd/`, activos solo si existe specs/)

| Hook | Evento | Función |
|------|--------|---------|
| `spec-gate.js` | PreToolUse Edit\|Write\|MultiEdit | Bloquea escrituras en código de producto si no hay spec activa o si la spec no tiene plan |
| `plan-injector.js` | PreToolUse Edit\|Write\|MultiEdit | Inyecta spec + plan activo como contexto adicional en cada edición |
| `hotfix-autoclose.js` | Stop | Cierra automáticamente los tracks `hotfix-*` al terminar la sesión |
| AC verifier | Stop (prompt hook) | Definido inline en `.claude/settings.json`: verifica si los AC de la spec activa fueron cumplidos en la sesión |

**Importante: los hooks son fail-open.** Si un proyecto no tiene `specs/`, el hook no bloquea
nada — esto los hace seguros de embarcar por defecto sin romper proyectos que no usan SDD.

## Convención de IDs

- Formato: `NNNN-kebab-slug` (ej: `0001-registro-de-usuario`)
- NNNN es secuencial de 4 dígitos, empieza en `0001`
- El slug se deriva del título: lowercase, sin acentos, espacios → guiones
- IDs nunca se reutilizan ni se renumeran

## Estado de specs (campo `status` en spec.md)

| Estado | Significado |
|--------|-------------|
| `draft` | Spec en redacción, no se puede activar |
| `approved` | Spec aprobada por el usuario, se puede activar |
| `in_progress` | Spec activa (referenciada por `.active`) |
| `done` | Todos los AC verificados con evidencia |
| `archived` | Descartada/superseded (mantener para historia) |

## Reglas de operación

1. **Una spec activa a la vez.** No hay paralelismo. Si necesitas cambiar de feature, cierra la actual o desactívala (`/spec-activate --clear`).
2. **No tocas código sin spec activa.** El spec-gate te bloquea. Si te bloquea, lee este skill y dile al usuario qué comando correr.
3. **El plan se deriva de la spec; las tareas del plan.** Nunca al revés.
4. **Out-of-scope es sagrado.** Si el usuario pide algo que está fuera del scope declarado, sugiere crear una spec nueva, no extender la actual.
5. **Acceptance Criteria son Gherkin.** Given/When/Then. Verificables. Nada de "el sistema debe ser rápido".
6. **El AC verifier es la fuente de verdad del cierre.** No marques una spec como `done` sin haber pasado `/spec-verify`.

## Plantillas

Las plantillas viven en `.claude/skills/sdd/templates/` (vendorizadas en este proyecto, ver nota abajo):

- `spec.md` — el contrato del feature
- `plan.md` — descomposición técnica
- `tasks.md` — checklist atómico
- `acceptance.md` — verificación final
- `ROADMAP.md` — índice del proyecto

Los comandos `/spec-new`, `/spec-plan`, etc. copian estas plantillas como base.

## Conexión con el sistema Koa Blueprint existente

SDD **complementa**, no reemplaza, el sistema actual:

| Layer existente | Sigue funcionando |
|-----------------|-------------------|
| Discovery Gate (lee índices antes de código) | Sí — corre DESPUÉS del spec-gate |
| Architect Guard (valida forma del código) | Sí — sin cambios |
| Sync Check (índices actualizados) | Sí — convive con AC Verifier |
| `indices/*.md` | Se referencian en `plan.md` para reutilizar |
| `.claude/rules/*.md` | Se mencionan en `plan.md` como restricciones |

**División de responsabilidades:**
- SDD = QUÉ construir (contrato de negocio)
- Koa Blueprint = CÓMO construirlo (contrato técnico)

## Anti-patrones (NO HACER)

- ❌ Escribir código sin spec activa (el gate te bloquea, no intentes pasarlo)
- ❌ Extender una spec activa para meter scope nuevo → crear spec nueva
- ❌ Marcar AC como cumplido sin evidencia (commit hash, archivo de test, ruta de screenshot)
- ❌ Editar specs `done` → si necesitan cambio, abrir spec nueva que la supersede
- ❌ Renumerar specs o reutilizar IDs
- ❌ Acoplar los hooks SDD a un stack específico (Angular, Next, etc.) — el SDD es agnóstico

## Activar el SDD en este proyecto

El motor SDD viene **vendorizado**: los comandos (`.claude/commands/`), este skill
(`.claude/skills/sdd/`) y los hooks (`.claude/hooks/sdd/`) ya están en el repo y se commitean
con él. No dependen de `~/.claude/` global — cualquier dev que clone el repo hereda el motor
completo con un `git pull`, sin pasos manuales.

Pero el SDD arranca **dormido**. `spec-gate.js` es fail-open: si no existe la carpeta `specs/`,
deja pasar toda escritura y el ciclo no te molesta. Para activarlo:

```bash
mkdir -p specs/specs specs/fixes specs/hotfixes
touch specs/.active
cp .claude/skills/sdd/templates/ROADMAP.md specs/ROADMAP.md
```

Desde ese momento, tocar código de producción (`src/`, `app/`, `lib/`, `supabase/migrations/`)
exige una spec activa con su `plan.md`. Para desactivarlo, basta con borrar `specs/`.

### Capa de Asignaciones (opcional)

`/assign-new`, `/assign-list` y `/assign-claim` sirven para repartir trabajo en equipos de 2+
devs. Requieren además:

```bash
cp .claude/skills/sdd/templates/ASSIGNMENTS.md specs/ASSIGNMENTS.md
mkdir -p specs/assignments
```

y los scripts `npm run assignments:sync` / `assignments:audit` (incluidos en `scripts/`).
En proyectos de un solo dev podés ignorar esta capa por completo: el ciclo
spec → plan → tasks → acceptance funciona sin ella.
