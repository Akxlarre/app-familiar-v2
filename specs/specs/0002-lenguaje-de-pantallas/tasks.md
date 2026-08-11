# Tasks 0002 — Lenguaje de pantallas: el contrato de UI

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-11

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en una sentada.
- Se marca `[x]` apenas pasa su DoD. No antes, no en bloque.
- Si aparece una sub-tarea no listada, se agrega al final de su sección antes de hacerla.
- Si algo queda fuera del scope de la spec → **detenerse** y abrir spec nueva.

---

## Fase 1 — Arreglar el harness (va primero: todo lo demás se escribe con las reglas cargando bien)

- [ ] **T1.1** — Agregar `src/app/features/**/*.ts` al `paths:` de `visual-system.md` y `a11y-spec.md`
  - **AC ref:** AC7, AC13
  - **Por qué:** los templates inline de `features/` (bandeja, completar-captura) **no** reciben
    estas reglas hoy. La regla existe y no se aplica donde más hace falta.
  - **DoD:**
    - [ ] Los dos frontmatter incluyen el glob
    - [ ] Verificado: editar `features/bandeja/bandeja.component.ts` inyecta la regla

- [ ] **T1.2** — `scripts/lib/contrast-check.js`: contraste AA de los pares texto/fondo declarados
  - **AC ref:** AC9
  - **DoD:**
    - [ ] Función pura `contrasteDe(fg, bg)` con el algoritmo de luminancia relativa de WCAG
    - [ ] Lista explícita de pares canónicos (texto primario/secundario/muted sobre base, surface, elevated, y los `--state-*-bg`)
    - [ ] Resuelve `var(--x)` encadenados hasta el color literal
    - [ ] Reporta por tema (claro y oscuro) con el ratio medido
    - [ ] `contrast-check.test.mjs` cubre: par que pasa, par que falla, `var()` anidado, color en formato distinto

- [ ] **T1.3** — Cablear `contrast-check` en `npm run lint:arch` como ARCH-25
  - **DoD:**
    - [ ] Aparece en la lista de reglas validadas del reporte
    - [ ] Corre con el baseline actual sin romper el build (si hay deuda, se ratchea como class-discipline)

- [ ] **T1.4** — ARCH-24 en `class-discipline.js`: cluster de input ad-hoc
  - **AC ref:** AC7
  - **Por qué:** `.field-input` reemplazó un cluster de catorce utilities. Nada impide volver a escribirlo.
  - **DoD:**
    - [ ] Detecta la combinación (border + bg + padding + rounded) sobre un `<input>`, `<select>` o `<textarea>`
    - [ ] Exime el login (deuda pre-existente) vía el baseline del ratchet
    - [ ] Micro-suite en `class-discipline.test.mjs`: caso positivo, caso con `.field-input`, falso positivo típico
    - [ ] `npm run lint:arch:test` verde

- [ ] **T1.5** — `.claude/rules/screen-contract.md`, path-scoped a `features/**` y `shared/**`
  - **AC ref:** AC5, AC6
  - **DoD:**
    - [ ] Las cinco piezas, las cuatro reglas de composición y las **dos** excepciones declaradas (login y revisión de boleta)
    - [ ] Enlaza a `/app/_ds` como referencia viva
    - [ ] Frontmatter `paths:` correcto
    - [ ] Pasa el `harness-gate` (principios reutilizables, no parches de un track)

---

## Fase 2 — La pantalla de referencia

- [ ] **T2.1** — `ds-drawer-demo.component.ts`: el contenido del drawer
  - **AC ref:** AC5 (pieza 4)
  - **DoD:**
    - [ ] OnPush, standalone
    - [ ] Recibe un `input()` — demuestra el paso de datos del drawer
    - [ ] Usa `.field-label` / `.field-input`, no un cluster

- [ ] **T2.2** — `ds-reference.component.ts`: las cinco piezas armadas
  - **AC ref:** AC1, AC2, AC4, AC5, AC6
  - **DoD:**
    - [ ] Hero slim con banda de KPIs
    - [ ] `bento-grid--fill-screen` con panel de cabecera fija / cuerpo scrolleable / pie fijo
    - [ ] Filas con `.item-title` + `.micro-label` + valor + acciones
    - [ ] Botón que abre el drawer con `inputs`
    - [ ] Selector de estado (normal / vacío / error / cargando) que fuerza cada uno
    - [ ] Datos hardcodeados: **cero facades de dominio**
    - [ ] `data-llm-action` en los controles

- [ ] **T2.3** — `ds-reference.component.spec.ts`: test contra la pudrición
  - **AC ref:** AC5
  - **DoD:**
    - [ ] Verifica presencia de las cinco piezas en el DOM
    - [ ] Verifica que los cuatro estados se pueden forzar
    - [ ] Falla si alguien saca una pieza

- [ ] **T2.4** — Ruta `/app/_ds`, excluida de producción
  - **DoD:**
    - [ ] Alcanzable con `ng serve`
    - [ ] `npm run build` no incluye su chunk — **verificado en la salida del build**, no asumido
    - [ ] Documentada en `indices/STYLES.md`

---

## Fase 3 — Cerrar los AC que hoy no verifica nadie

- [ ] **T3.1** — AC12: auditar limpieza de tweens al destruir
  - **DoD:**
    - [ ] Revisados los componentes que animan a la entrada (bento-reveal, section-hero, drawer)
    - [ ] Cada uno mata sus tweens en `ngOnDestroy` o vía `DestroyRef`
    - [ ] Test donde se destruye el componente a mitad de animación y no queda tween vivo

- [ ] **T3.2** — AC11: verificar que `prefers-reduced-motion` no rompe callbacks
  - **DoD:**
    - [ ] Auditados los métodos de `GsapAnimationsService` con `onComplete`
    - [ ] Todos llaman el callback aunque no animen (como ya hace `animateSuccessFeedback`)
    - [ ] Test del caso reduced-motion

- [ ] **T3.3** — AC-E2 y AC-E3: dato largo y monto de 9 cifras en la referencia
  - **DoD:**
    - [ ] La referencia incluye una fila con comercio de 80 caracteres y un KPI de 9 cifras
    - [ ] Ninguno rompe el layout ni causa scroll horizontal

---

## Fase 4 — Validación

- [ ] **T4.1** — `npm run lint:arch` limpio (0 errores)
- [ ] **T4.2** — `npm run test:ci` verde
- [ ] **T4.3** — `npm run lint:arch:test` verde (guardrails nuevos)
- [ ] **T4.4** — **QA en navegador** de `/app/_ds` — la lección de esta sesión es que compilar no alcanza
  - **DoD:** matriz completa, con evidencia en `acceptance.md`
    - [ ] 4 estados × 2 temas
    - [ ] ≥1024px: llena el viewport, el documento no scrollea (AC1)
    - [ ] <1024px: la página scrollea nativamente (AC2)
    - [ ] Drawer abierto: empuja el contenido y el bento se compacta (AC4)
    - [ ] `prefers-reduced-motion: reduce`: sin animaciones, sin callbacks perdidos (AC11)
    - [ ] Consola limpia, sin 4xx en red

- [ ] **T4.5** — `/spec-verify`
  - **DoD:** cada AC en `acceptance.md` con su evidencia (test, commit o captura)

---

## Fase 5 — Cierre

- [ ] **T5.1** — `npm run indices:sync`
- [ ] **T5.2** — Marcar 0002 como `done` en `ROADMAP.md`
- [ ] **T5.3** — Limpiar `specs/.active`
- [ ] **T5.4** — Backportear a Koa lo que sea genérico: `contrast-check.js`, ARCH-24,
      `screen-contract.md` y el arreglo del path-scope. Verificar con un Full Scaffold real.

---

## Tareas descubiertas durante implementación

> Dentro del scope de la spec. Si algo queda fuera, spec nueva.

- (ninguna todavía)

---

## Fuera de scope, confirmado en el plan

- ❌ **Migrar el dashboard al contrato.** La spec 0003 lo reemplaza por Hoy; arreglarlo ahora es
  trabajo tirado. Se migra cuando se construya su reemplazo.
