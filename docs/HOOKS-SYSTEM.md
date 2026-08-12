# Sistema de Hooks — Guardrails Automáticos (Koa Blueprint v6.1)

> Este documento explica cómo el sistema de hooks convierte las reglas arquitectónicas
> en **constraints** reales que Claude no puede ignorar.

## El Problema que Resuelve

Sin hooks, las reglas del proyecto son un **contrato social**: Claude las lee en CLAUDE.md
pero puede ignorarlas. El humano tiene que recordarle en cada prompt que siga las reglas.

Con hooks, las reglas son **constraints del sistema**: Claude es bloqueado automáticamente
si intenta violar una regla, sin intervención humana.

## Arquitectura del Sistema

```
Claude recibe un prompt del humano
    │
    ├─ Intenta Read("indices/COMPONENTS.md")
    │   └─ PostToolUse → discovery-tracker.js → crea flag de sesión ✓
    │
    ├─ Intenta Edit("src/app/features/dashboard.component.ts")
    │   └─ PreToolUse → pre-write-guard.js
    │       ├─ ¿Flag de discovery existe? → NO → BLOQUEADO "Lee los índices primero"
    │       ├─ ¿Flag existe? → SÍ → continúa
    │       ├─ ¿Tiene *ngIf? → SÍ → BLOQUEADO "Usa @if"
    │       ├─ ¿Tiene OnPush? → NO → BLOQUEADO "Agrega OnPush"
    │       └─ Todo OK → PERMITIDO + inyecta reglas relevantes como contexto
    │                    (architecture.md, visual-system.md, database.md, skills)
    │
    ├─ PostToolUse → post-edit.js → Prettier formatea automáticamente
    │
    ├─ Intenta Bash("echo > src/app/nuevo.ts")
    │   └─ PreToolUse → bash-guard.js → BLOQUEADO "Usa Edit/Write"
    │
    ├─ Claude termina de responder
    │   └─ Stop → prompt hook → "¿Actualizaste los índices?" → si no → sigue trabajando
    │
    ├─ Un tool falla
    │   └─ PostToolUseFailure → failure-tracker.js → registra en LESSONS_LEARNED.md
    │
    └─ Contexto se compacta
        └─ PostCompact → compact-recovery.js → re-inyecta índices
```

## Hooks Activos

### 1. Pre-Write Guard (`pre-write-guard.js`)
- **Evento**: PreToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Cuádruple capa de protección antes de cada escritura

| Capa | Qué hace | Resultado si falla |
|------|----------|--------------------|
| File Protection | Bloquea edits a `.claude/hooks/`, `settings.json`, `architect.js` | BLOQUEADO: archivo protegido |
| Discovery Gate | Verifica que se leyeron los índices | BLOQUEADO: lee indices/ primero |
| Architect Guard | Valida reglas en el contenido nuevo | BLOQUEADO: violación específica |
| Context Injection | Inyecta rules y skills relevantes según tipo de archivo | Contexto adicional para Claude |

**Reglas validadas por el Architect Guard:**

| Regla | Archivos | Qué detecta |
|-------|----------|-------------|
| No `*ngIf` / `*ngFor` | .ts, .html | Directivas deprecadas de Angular |
| No `[ngClass]` / `[ngStyle]` | .ts, .html | Bindings deprecados |
| No `@Input()` / `@Output()` | .ts | Decoradores legacy (usar signal API) |
| No `@supabase/supabase-js` | .ts (UI) | Import directo en capa de presentación |
| No `@angular/animations` | .ts | Usar GSAP en vez de animations |
| OnPush obligatorio | .component.ts | Solo en Write (archivo completo) |
| No colores hardcodeados | .ts, .html, .scss | `text-red-500`, `bg-blue-200`, etc. |
| No `@keyframes` | .scss, .css | Usar GSAP para animaciones |
| No Facade en Dumb comp. | shared/.component.ts | Dumb components no inyectan Facades |
| Naming de migraciones | supabase/migrations/ | Formato: YYYYMMDDHHMMSS_dominio_tipo_desc.sql |
| RLS obligatorio | .sql con CREATE TABLE | Toda tabla nueva debe tener RLS activado |

### Hooks del harness y del SDD

| Hook | Evento | Función |
|------|--------|---------|
| `harness-gate.js` | PreToolUse (Edit/Write) | Gobierna las superficies de GUÍA (`.claude/rules/`, `indices/ANTI-PATTERNS.md`, `context/learnings.md`, `CLAUDE.md`) y los scripts de CAPACIDAD. Exige que lo que se acumula ahí sean principios reutilizables, no parches de un track puntual, y que la lógica determinista viva en `scripts/` y no como prosa disfrazada de mecanismo. |
| `sdd/spec-gate.js` | PreToolUse (Edit/Write) | Bloquea escribir código de producto sin una spec activa con su plan. **Fail-open**: sin carpeta `specs/` no bloquea nada. |
| `sdd/plan-injector.js` | PreToolUse (Edit/Write) | Inyecta la spec y el plan activos como contexto en cada edición. |
| `sdd/hotfix-autoclose.js` | Stop | Cierra los tracks `hotfix-*` al terminar la sesión. |
| `context-enrichment-guard.js` | — (**OPT-IN**) | Day 0 Context Guard: impide escribir código mientras `context/domain.md` e `indices/DATABASE.md` sigan vacíos. **No viene cableado**: un proyecto recién generado los trae como plantilla, así que activarlo por defecto bloquearía todo desde el minuto cero. |

**Contexto inyectado por tipo de archivo (Context Injection):**

Cuando una escritura pasa todas las validaciones, el hook inyecta reglas relevantes
directamente en el contexto de Claude vía `additionalContext`. Esto hace que Claude
tenga las rules y skills presentes **sin tener que leerlas manualmente**.

| Archivo editado | Rules inyectadas | Skills referenciadas |
|----------------|-----------------|---------------------|
| `features/*.component.ts` | architecture.md (Smart), visual-system.md (tokens, bento, GSAP) | angular-component, design-system, angular-signals |
| `shared/*.component.ts` | architecture.md (Dumb: solo input/output), visual-system.md (cards, radios) | angular-component, design-system |
| `layout/*.component.ts` | architecture.md (Layout), visual-system.md (dark mode) | — |
| `core/services/*.facade.ts` | architecture.md (Facade pattern, toSignal) | angular-signals |
| `core/services/*.service.ts` | architecture.md (Core service, no UI injection) | angular-signals |
| `core/directives/*.ts` | architecture.md (directivas) | angular-component |
| `supabase/migrations/*.sql` | database.md (naming, RLS, idempotencia) | supabase-data-model |
| `*.html` (templates) | architecture.md (@if/@for), visual-system.md (tokens, bento), ai-readability.md (data-llm-*) | angular-primeng |
| `*.scss` / `*.css` | visual-system.md (tokens, layouts, motion) | design-system |

### 2. Discovery Tracker (`discovery-tracker.js`)
- **Evento**: PostToolUse
- **Matcher**: `Read`
- **Función**: Cuando Claude lee un archivo de `indices/`, crea un flag temporal
  que desbloquea el Discovery Gate para el resto de la sesión.

### 3. Bash Guard (`bash-guard.js`)
- **Evento**: PreToolUse
- **Matcher**: `Bash`
- **Función**: Bloquea dos patrones peligrosos:
  - Creación de archivos `.ts/.html/.scss/.sql` via Bash (debe usar Edit/Write)
  - Operaciones destructivas (`rm -rf`) sobre directorios críticos

### 4. Compact Recovery (`compact-recovery.js`)
- **Evento**: PostCompact
- **Matcher**: ninguno (se ejecuta en cada compactación)
- **Función**: Cuando Claude Code compacta la conversación, re-inyecta el contenido
  de todos los archivos `indices/*.md` al contexto. Claude nunca pierde la memoria
  de lo que existe en el proyecto.

### 5. Failure Tracker (`failure-tracker.js`)
- **Evento**: PostToolUseFailure
- **Matcher**: ninguno (captura todos los fallos de tools)
- **Función**: Registra errores de ejecución de tools en `.claude/temp/LESSONS_LEARNED.md`
  con guardrails automáticos:
  - **Max 20 entradas** — las más antiguas rotan automáticamente
  - **Deduplicación** — errores repetidos incrementan un contador en vez de duplicarse
  - **Contexto** — registra el tool, error y archivo/comando involucrado

### 6. Sync Check (prompt hook)
- **Evento**: Stop
- **Matcher**: ninguno (se ejecuta en cada respuesta)
- **Tipo**: `prompt` (evaluado por modelo Haiku)
- **Función**: Cuando Claude termina de responder, Haiku evalúa si se crearon
  componentes/servicios nuevos sin actualizar los índices. Si detecta drift,
  fuerza a Claude a continuar y actualizar los índices.

### 7. Prettier (post-edit.js)
- **Evento**: PostToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Formatea automáticamente con Prettier cada archivo editado.

## Linter Arquitectónico Completo (`architect.js` v2.0)

El linter AST se ejecuta con `npm run lint:arch` y valida **24 reglas**.

Analiza los `.ts`, los `.scss` y **los templates `template:` inline**, no solo los
`.html`: el boilerplate no tiene un solo archivo `.html`, así que sin eso las reglas
de markup no auditarían nada.

**Arquitectura (AST + regex):**

| Regla | Qué detecta | Método |
|---|---|---|
| ARCH-01 | `@supabase/supabase-js` en UI | AST (import declaration) |
| ARCH-02 | `inject(*Service)` en componentes vista | AST (call expression) |
| ARCH-03 | Falta `.spec.ts` para facades/services de `core/` | File existence |
| ARCH-04 | Falta OnPush | AST (decorator) |
| ARCH-05 | `@angular/animations` | AST (import declaration) |
| ARCH-06 | `*ngIf` / `*ngFor` / `[ngClass]` / `[ngStyle]` | Regex en markup |
| ARCH-07 | `@keyframes` en estilos de componente | Regex en .scss/.css |
| ARCH-08 | Colores Tailwind hardcodeados | Regex en markup |
| ARCH-09 / ARCH-10 | Complejidad (componentes shared, facades) | AST (line span) |

**Design system:**

| Regla | Qué detecta |
|---|---|
| ARCH-11 | Clases de token muertas: no existen en `@theme`, Tailwind no genera CSS y la clase no hace nada |
| ARCH-18 | Alias prohibidos dentro del propio `@theme` |
| ARCH-21 | Clase `.bento-*` definida sin aprobar en `scripts/lib/bento-classes.allowlist.json`. Freno contra el sprawl del grid — ver el árbol de decisión en `indices/STYLES.md` |
| ARCH-22 | Una clase del DS con el nombre de una utilidad "pelada" de Tailwind. Tailwind genera SU regla homónima en `@layer utilities` y **se suma** a la tuya en vez de reemplazarla |
| ARCH-23 | Celda hija de un grid `.bento-grid--fill-screen*` que ocupa 2 filas (`.bento-hero`/`.bento-feature`/`.bento-tall` o `data-row-span="2"`). Desborda el `grid-template-rows` explícito: las filas implícitas se superponen sin lanzar ningún error — ver el patrón App-like en `.claude/rules/visual-system.md` |
| ARCH-25 | Par texto/fondo por debajo de WCAG AA, **en cualquiera de los dos temas**. Compone los fondos semi-transparentes antes de medir. Ratcheado con `scripts/lib/contrast.baseline.json` |
| ARCH-26 | Token del `@theme` con el nombre de un valor de escala nativa. `--color-base` genera `text-base` como utilidad de **color**, que le gana a la de tamaño: es el bug que dejó los inputs del login en 1.15:1, invisibles en producción |

**Disciplina de clases (con ratchet):**

| Regla | Qué detecta |
|---|---|
| ARCH-15 | Pill/badge ad-hoc (`rounded-full` + micro-texto + `px-`) en vez de `.badge-count` |
| ARCH-16 | Utilities de tamaño pisando un `.btn-*` |
| ARCH-17 | Tamaño de fuente arbitrario `text-[NNpx]` fuera de la escala |
| ARCH-19 | Cluster tipográfico ad-hoc en vez de `.micro-label` / `.item-title` / `.section-eyebrow` |
| ARCH-24 | Cluster de input ad-hoc (borde + fondo + padding + radio sobre un campo) en vez de `.field-input` / `.field-label` |

Estas cinco usan un **ratchet**: `scripts/lib/class-discipline.baseline.json` registra la
deuda tolerada por archivo y solo se reporta una **regresión** (un archivo supera su cuota).
El proyecto solo puede mejorar. Tras limpiar deuda, fijá la mejora con
`npm run lint:arch -- --update-ds-baseline`. Koa arranca **sin baseline**, es decir con
tolerancia cero.

**Accesibilidad e iconos:**

| Regla | Qué detecta |
|---|---|
| A11Y-03 | Botón cuyo único contenido es un icono y no tiene nombre accesible |
| ICON-01 | Icono usado en un template pero **no registrado** en el `LucideAngularModule.pick()` de `app.config.ts`. No rompe el build: lucide lanza en **runtime** |

Los guardrails viven en `scripts/lib/` con sus propios tests: `npm run lint:arch:test`.

### La invariante: toda regla registrada tiene que poder fallar

`scripts/lib/rule-wiring.js` audita el linter a sí mismo. No busca violaciones en tu código:
busca **reglas desconectadas** en `architect.js`.

Existe porque el mismo fallo ocurrió dos veces con distinto disfraz:

- **ARCH-24** tenía detector, tests y su llamada — y estaba fuera de `DS_RULES`, la lista fija
  que decide qué se compara contra el baseline. Encontraba 3 hits y reportaba 0.
- **ARCH-26** tenía detector y tests, y **no lo llamaba nadie**. Es el detector del token que
  dejó los inputs del login ilegibles en producción.

En los dos casos el linter dio verde, porque **una regla desconectada se ve exactamente igual
que una regla que pasa**: cero hallazgos, build limpio. Esa ambigüedad es el bug.

El test verifica tres cosas contra el `architect.js` real:

| Falla | Qué significa |
|---|---|
| **Huérfana** | Está en `RULES` y no tiene ningún camino a un `reportError`. No puede fallar nunca |
| **Fantasma** | Se reporta un ID que no está en `RULES`. El usuario ve un código sin nombre, sin doc y sin fix |
| **Ratchet incompleto** | La regla asoma en el circuito del ratchet (`add()` → `dsCounts` → `DS_RULES`) con un eslabón roto. Cuenta en silencio |

**Al agregar una regla nueva**, este test se rompe hasta que esté enchufada de punta a punta.
Es intencional: es la única señal que distingue "no hay violaciones" de "la regla no corre".

> Lo que **no** prueba: que el detector detecte bien. De eso se encarga la micro-suite de cada
> módulo. La división es deliberada — el fallo nunca fue "el detector está mal", siempre fue
> "el detector no está enchufado".

## Diferencia entre Hooks y Linter

| | Pre-Write Guard (Hook) | architect.js (Linter) |
|---|---|---|
| **Cuándo corre** | En cada Edit/Write individual | Bajo demanda (`npm run lint:arch`) |
| **Qué analiza** | Solo el contenido nuevo (diff) | Todo el proyecto completo |
| **Profundidad** | Regex rápido | AST completo de TypeScript |
| **Puede bloquear** | Sí (exit 2) | Sí (exit 1), pero post-hoc |
| **Detecta OnPush faltante** | Solo en Write (archivo nuevo) | Siempre (recorre todos los .component.ts) |

Juntos forman un sistema de **defensa en profundidad**: el hook atrapa violaciones
en tiempo real, el linter las atrapa en auditoría completa.

## Personalización

### Desactivar un hook específico

Edita `.claude/settings.json` y elimina el bloque del hook que quieres desactivar.

### Desactivar todos los hooks temporalmente

En Claude Code, ejecuta `/hooks` y usa el toggle al final del menú.

### Agregar reglas nuevas al Architect Guard

Edita `.claude/hooks/pre-write-guard.js` y agrega checks en la sección 3 (Architect Guard).
Para reglas que requieren AST, agrégalas en `scripts/architect.js`.

### Agregar archivos protegidos

Edita el array `protectedPatterns` en `pre-write-guard.js`.

## Troubleshooting

### "Discovery Gate me bloquea pero ya leí los índices"
El flag es por sesión. Si reiniciaste Claude Code, debes leer un archivo
de `indices/` de nuevo. Cualquier archivo de esa carpeta sirve.

### "El hook falla con error de JSON parsing"
Verifica que tu `~/.zshrc` o `~/.bashrc` no imprima texto en shells no-interactivas.
Envuelve los `echo` en `if [[ $- == *i* ]]; then ... fi`.

### "Quiero editar un archivo protegido"
Los archivos del sistema de hooks están protegidos contra edición por Claude.
Edítalos manualmente en tu editor de texto.
