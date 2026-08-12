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

- [x] **T1.1** — Agregar `src/app/features/**/*.ts` al `paths:` de `visual-system.md` y `a11y-spec.md`
  - **AC ref:** AC7, AC13
  - **Por qué:** los templates inline de `features/` (bandeja, completar-captura) **no** reciben
    estas reglas hoy. La regla existe y no se aplica donde más hace falta.
  - **DoD:**
    - [x] Los dos frontmatter incluyen el glob
    - [x] Verificado: editar `features/bandeja/bandeja.component.ts` inyecta la regla

- [x] **T1.2** — `scripts/lib/contrast-check.js`: contraste AA de los pares texto/fondo declarados
  - **AC ref:** AC9
  - **DoD:**
    - [x] Función pura `contrasteDe(fg, bg)` con el algoritmo de luminancia relativa de WCAG
    - [x] Lista explícita de pares canónicos (texto primario/secundario/muted sobre base, surface, elevated, y los `--state-*-bg`)
    - [x] Resuelve `var(--x)` encadenados hasta el color literal
    - [x] Reporta por tema (claro y oscuro) con el ratio medido
    - [x] `contrast-check.test.mjs` cubre: par que pasa, par que falla, `var()` anidado, color en formato distinto

- [x] **T1.3** — Cablear `contrast-check` en `npm run lint:arch` como ARCH-25
  - **DoD:**
    - [x] Aparece en la lista de reglas validadas del reporte
    - [x] Corre con el baseline actual sin romper el build (si hay deuda, se ratchea como class-discipline)

- [x] **T1.4** — ARCH-24 en `class-discipline.js`: cluster de input ad-hoc
  - **AC ref:** AC7
  - **Por qué:** `.field-input` reemplazó un cluster de catorce utilities. Nada impide volver a escribirlo.
  - **DoD:**
    - [x] Detecta la combinación (border + bg + padding + rounded) sobre un `<input>`, `<select>` o `<textarea>`
    - [x] ~~Exime el login vía baseline~~ → se **arregló** el login: sus 3 inputs usan `.field-input`. Baseline en cero.
    - [x] Micro-suite en `class-discipline.test.mjs`: caso positivo, caso con `.field-input`, falso positivo típico
    - [x] `npm run lint:arch:test` verde

- [x] **T1.5** — `.claude/rules/screen-contract.md`, path-scoped a `features/**` y `shared/**`
  - **AC ref:** AC5, AC6
  - **DoD:**
    - [x] Las cinco piezas, las cuatro reglas de composición y las **dos** excepciones declaradas (login y revisión de boleta)
    - [x] Enlaza a `/app/_ds` como referencia viva
    - [x] Frontmatter `paths:` correcto
    - [x] Pasa el `harness-gate` (principios reutilizables, no parches de un track)

---

## Fase 2 — La pantalla de referencia

- [x] **T2.1** — `ds-drawer-demo.component.ts`: el contenido del drawer
  - **AC ref:** AC5 (pieza 4)
  - **DoD:**
    - [x] OnPush, standalone
    - [x] Recibe un `input()` — demuestra el paso de datos del drawer
    - [x] Usa `.field-label` / `.field-input`, no un cluster

- [x] **T2.2** — `ds-reference.component.ts`: las cinco piezas armadas
  - **AC ref:** AC1, AC2, AC4, AC5, AC6
  - **DoD:**
    - [x] Hero slim con banda de KPIs
    - [x] `bento-grid--fill-screen` con panel de cabecera fija / cuerpo scrolleable / pie fijo
    - [x] Filas con `.item-title` + `.micro-label` + valor + acciones
    - [x] Botón que abre el drawer con `inputs`
    - [x] Selector de estado (normal / vacío / error / cargando) que fuerza cada uno
    - [x] Datos hardcodeados: **cero facades de dominio**
    - [x] `data-llm-action` en los controles

- [x] **T2.3** — `ds-reference.component.spec.ts`: test contra la pudrición
  - **AC ref:** AC5
  - **DoD:**
    - [x] Verifica presencia de las cinco piezas en el DOM
    - [x] Verifica que los cuatro estados se pueden forzar
    - [x] Falla si alguien saca una pieza

- [x] **T2.4** — Ruta `/_ds`, sólo en dev
  - **DoD:**
    - [x] Alcanzable con `ng serve`
    - [~] `npm run build` **sí emite el chunk** (2,72 kB gzip). esbuild no constant-foldea
          `environment.production` a través del acceso a propiedad, así que el ternario queda en
          runtime. **La ruta es inalcanzable** —el array evalúa a `[]`— pero el chunk queda
          huérfano y nunca se pide. Se acepta y se declara: el requisito real era que no fuera
          alcanzable, y contorsionar el código por 2,72 kB que nadie descarga no lo vale.
    - [x] Documentada en `indices/STYLES.md`
    - [x] **Cambio sobre el plan:** va **fuera de `authGuard`** (ruta top-level con shell, no hija
          de `/app`). Una referencia de diseño que exige credenciales de producción para mirarse es
          la que se queda sin QA en navegador — que es justo lo que esta spec combate.

---

## Fase 3 — Cerrar los AC que hoy no verifica nadie

- [x] **T3.1** — AC12: auditar limpieza de tweens al destruir
  - **Hallazgo:** `animateCounter` anima un **objeto plano**, no el elemento, así que
    `killTweensOf(el)` no lo alcanzaba y `kpi-card` no tenía ninguna limpieza. Ahora devuelve el
    tween. `section-hero` y `layout-drawer` tampoco mataban los suyos.
  - **DoD:**
    - [x] Revisados los componentes que animan a la entrada (bento-reveal, section-hero, drawer)
    - [x] Cada uno mata sus tweens en `ngOnDestroy` o vía `DestroyRef`
    - [x] Test donde se destruye el componente a mitad de animación y no queda tween vivo

- [x] **T3.2** — AC11: verificar que `prefers-reduced-motion` no rompe callbacks
  - **DoD:**
    - [x] Auditados los métodos de `GsapAnimationsService` con `onComplete`
    - [x] Todos llaman el callback aunque no animen (como ya hace `animateSuccessFeedback`)
    - [x] Test del caso reduced-motion

- [x] **T3.3** — AC-E2 y AC-E3: dato largo y monto de 9 cifras en la referencia
  - **DoD:**
    - [x] La referencia incluye una fila con comercio de 80 caracteres y un KPI de 9 cifras
    - [x] Ninguno rompe el layout ni causa scroll horizontal

---

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` limpio (0 errores)
- [x] **T4.2** — `npm run test:ci` verde
- [x] **T4.3** — `npm run lint:arch:test` verde (guardrails nuevos)
- [x] **T4.4** — **QA en navegador** de `/app/_ds` — la lección de esta sesión es que compilar no alcanza
  - **DoD:** matriz completa, con evidencia en `acceptance.md`
    - [x] 4 estados × 2 temas
    - [x] ≥1024px: llena el viewport, el documento no scrollea (AC1)
    - [x] <1024px: la página scrollea nativamente (AC2)
    - [x] Drawer abierto: empuja el contenido y el bento se compacta (AC4)
    - [x] `prefers-reduced-motion: reduce`: sin animaciones, sin callbacks perdidos (AC11)
    - [x] Consola limpia, sin 4xx en red

- [x] **T4.5** — `acceptance.md` con evidencia por AC
  - **DoD:** 16 de 17 AC verificados. **AC-E1 (500 filas) queda sin verificar**: ninguna pantalla
    tiene ese volumen todavía; se mide con la lista de movimientos (spec 0005).

---

## Fase 5 — Cierre

- [x] **T5.1** — `npm run indices:sync`
- [x] **T5.2** — Marcar 0002 como `done` en `ROADMAP.md`
- [x] **T5.3** — Limpiar `specs/.active`
- [x] **T5.4** — Backportear a Koa lo que sea genérico: `contrast-check.js`, ARCH-24,
      `screen-contract.md` y el arreglo del path-scope. Verificar con un Full Scaffold real.
  - **Qué viajó:** los tres guardrails (ARCH-24/25/26 + sus micro-suites), `screen-contract.md`,
    el path-scope de `visual-system.md` y `a11y-spec.md`, `--color-canvas`, los tokens de
    contraste AA con `.field-*` y `.row-value`, la limpieza de tweens, el wrapper de `lint:arch`,
    los `fileReplacements` y el drawer con `inputs`. Doce archivos del boilerplate.
  - **Qué NO viajó:** `db-error.utils.ts` y `base.facade.ts` — Koa ya tenía la versión
    generalizada; la de acá habla de capturas y movimientos. Y `app.routes.ts`, `app.config.ts`,
    `menu-config.service.ts`, que son de esta app.
  - **Hallazgo:** **ARCH-26 no estaba cableado en ningún lado.** `findThemeTokenCollisions`
    existía, tenía tests y no lo llamaba nadie — el mismo patrón exacto de TD3. Cableado en
    `architect.js` y en el CLI standalone, **en los dos repos**. Y nueve documentos, reglas y
    adapters seguían enseñando `bg-base`, una clase que ya no genera CSS.
  - **DoD — Full Scaffold real:**
    - [x] Scaffold completo: Angular + PrimeNG + Supabase + boilerplate
    - [x] `npm run lint:arch` en el proyecto generado: 0 errores (2 advertencias ARCH-09 heredadas)
    - [x] ARCH-25 y ARCH-26 **provocados a mano** en el proyecto generado: los dos fallan el build
    - [x] `npm run build` OK; el bundle de producción **no** contiene `localhost:54321`
          (los `fileReplacements` sí se aplican)
    - [x] `npm run test:ci`: 314/314 · `npm run lint:arch:test`: 26/26
    - [x] **Navegador** sobre el login generado, midiendo el píxel pintado: input **15.68:1**
          (claro) y **12.49:1** (oscuro), label 10.44:1 y 11.99:1, `font-size` 16px, consola
          limpia. Era el mismo campo que estaba en 1.15:1.

---

## Tareas descubiertas durante implementación

> Dentro del scope de la spec. Si algo queda fuera, spec nueva.

- [x] **TD1** — El wrapper de `lint:arch` no reenviaba los flags a `architect.js`.
      `npm run lint:arch -- --update-ds-baseline` no hacía nada, y es el comando que el propio
      linter imprime como la forma de fijar una mejora del ratchet.
- [x] **TD2** — `--color-base` en el `@theme` generaba `text-base` como utilidad de COLOR y le
      ganaba a la nativa de tamaño de fuente. Los inputs del login estaban en 1.15:1. ARCH-26.
- [x] **TD3** — `DS_RULES` es una lista fija en el módulo: ARCH-24 contaba y la comparación lo
      ignoraba. El detector existía, corría, y no reportaba nunca.
- [x] **TD5** — `killAll()` usaba `killTweensOf('*')`, que sólo alcanza targets del DOM: los
      tweens sobre objetos planos sobrevivían. Ahora vacía el timeline global.
- [x] **TD4** — El login usaba el cluster de catorce utilities en sus 3 inputs. Migrado a
      `.field-input` / `.field-label` en vez de tolerarlo en el baseline.
- [x] **TD6** — **ARCH-26 no lo llamaba nadie.** Se escribió el detector del bug que dejó los
      inputs invisibles, se le escribieron tests, y nunca se cableó al linter: ni en
      `architect.js` ni en el CLI standalone. Es TD3 otra vez, con otro número de regla. Cableado
      en los dos repos y verificado provocando la regresión, no leyendo el diff.

      El patrón ya tiene nombre propio en esta spec: **casi todo lo que falló existía, estaba
      documentado, y no lo ejecutaba nadie.** Un detector sin llamador se ve idéntico a un
      detector que pasa. Candidato para el harness: un test que verifique que **cada regla del
      registro puede fallar** — si nadie logra hacerla fallar, no está conectada.

---

## Fuera de scope, confirmado en el plan

- ❌ **Migrar el dashboard al contrato.** La spec 0003 lo reemplaza por Hoy; arreglarlo ahora es
  trabajo tirado. Se migra cuando se construya su reemplazo.
