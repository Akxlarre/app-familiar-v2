# Tasks 0003 — Navegación y secciones

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-12

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en una sentada.
- Se marca `[x]` apenas pasa su DoD. No antes, no en bloque.
- Si aparece una sub-tarea no listada, se agrega al final de su sección antes de hacerla.
- Si algo queda fuera del scope de la spec → **detenerse** y abrir spec nueva.

---

## Fase 1 — La maquinaria (va primero: todo lo demás se cuelga de acá)

- [~] **T1.1** — NAV-01: toda entrada del menú resuelve a una ruta declarada
  - **AC ref:** AC4
  - **Por qué primero:** el repo **ya tiene** una entrada muerta (`/app/settings`, que no existe
    en `app.routes.ts`). La regla se escribe en rojo sobre un bug real, no sobre uno inventado.
  - **DoD:**
    - [x] `scripts/lib/nav-integrity.js` puro: rutas declaradas × destinos del menú → huérfanos
    - [x] Resuelve rutas anidadas (`/app` + hijo) y las condicionales (el `...(prod ? [] : [...])` de `/_ds`)
    - [x] `nav-integrity.test.mjs`: 8 casos — entrada válida, entrada muerta, ruta anidada,
          comodín, ternario, comentario, menú vacío
    - [x] Cableado en `architect.js` como NAV-01 — `rule-wiring.test.mjs` lo exige y pasa
    - [x] **Falla sobre el repo actual** por `/app/settings`
    - [ ] Pasa cuando el menú se deriva → se cierra con **T1.5**
  - **Hallazgos:**
    - El primer parser contaba corchetes sin distinguir un array `children` de cualquier otro:
      leía `/_ds` como `/app/_ds` por venir después de la ruta `app`. Tres tests en rojo lo
      destaparon antes de cablear nada.
    - El docblock de `app.routes.ts` documenta `{ path: 'admin', … }` **como ejemplo**, y la
      regla lo contaba como ruta declarada. Un enlace muerto a `/admin` habría pasado: un falso
      negativo, que es el único error que a un linter no se le perdona. Ahora ignora comentarios.

- [ ] **T1.2** — `Pendiente`, `FuenteDePendientes` y el token multi
  - **AC ref:** AC10
  - **DoD:**
    - [ ] `core/models/pendiente.model.ts` con los tres artefactos
    - [ ] Documentado **por qué** es un token multi y no una lista: agregar un módulo no puede obligar a tocar Hoy

- [ ] **T1.3** — `PendientesService` con aislamiento de fallos
  - **AC ref:** AC10, "estados especiales"
  - **DoD:**
    - [ ] Agrega todas las fuentes registradas, ordenadas por `prioridad`
    - [ ] `allSettled`, no `all`
    - [ ] Expone qué fuentes fallaron, para que Hoy lo muestre por bloque
    - [ ] Test: dos fuentes OK + una que rechaza → las dos siguen y la caída se reporta
    - [ ] Test: cero fuentes registradas → lista vacía, sin reventar

- [ ] **T1.4** — `NavegacionService`: el menú derivado
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [ ] `destinos()` computa **sólo** los que tienen contenido registrado
    - [ ] El orden canónico (Hoy · Plata · Casa · Cuerpo · Ajustes) vive acá, aunque falten
    - [ ] Test: con 1 destino registrado devuelve 1; con 3, los 3 en orden
    - [ ] Test: un destino sin ruta declarada **no** sale

- [ ] **T1.5** — `MenuConfigService` pasa a adaptador
  - **DoD:**
    - [ ] Sin lista hardcodeada; delega en `NavegacionService`
    - [ ] `SidebarComponent` sigue funcionando sin cambios de API
    - [ ] NAV-01 en verde

- [ ] **T1.6** — La bandeja como **fuente** de pendientes
  - **AC ref:** AC10
  - **Por qué:** la spec es explícita en que la bandeja no es un destino sino un pendiente.
  - **DoD:**
    - [ ] `features/bandeja/bandeja.pendientes.ts` implementa `FuenteDePendientes`
    - [ ] Registrada en `app.config.ts` como `multi: true`
    - [ ] Devuelve el número exacto de capturas sin resolver y la ruta a la bandeja
    - [ ] Test con el facade mockeado

---

## Fase 2 — Hoy

- [ ] **T2.1** — `HoyFacade`
  - **AC ref:** AC10, AC11
  - **DoD:**
    - [ ] Inyecta `PendientesService`, **nunca** facades de dominio (ARCH-02)
    - [ ] Expone pendientes + últimos movimientos + estado por bloque
    - [ ] Test del estado vacío y del estado con fallo parcial

- [ ] **T2.2** — `HoyComponent` con las cinco piezas
  - **AC ref:** AC9, AC10, AC11, AC12
  - **DoD:**
    - [ ] Hero slim con banda de KPIs; filas con `.item-title` / `.micro-label`
    - [ ] **Sin nada pendiente:** mensaje explícito, no una grilla de ceros (AC9)
    - [ ] Pendientes primero, con cantidad exacta y acceso directo (AC10)
    - [ ] Últimos movimientos sin entrar a Plata (AC11)
    - [ ] Lugar reservado para las preguntas de despensa (AC12) — sin fuente todavía
    - [ ] `data-llm-action` en los controles

- [ ] **T2.3** — Rutas: `/app` → Hoy, not-found dentro del shell, `hogarGuard`
  - **AC ref:** AC1, AC-E1, AC-E2
  - **DoD:**
    - [ ] `/app` aterriza en Hoy, no en dashboard
    - [ ] Ruta comodín **hija de `/app`**: el not-found conserva la navegación (AC-E2)
    - [ ] `hogarGuard` manda a onboarding a un usuario sin hogar (AC-E1)
    - [ ] Tests del guard en sus dos ramas

---

## Fase 3 — Navegación

- [ ] **T3.1** — `BottomNavComponent`
  - **AC ref:** AC6
  - **DoD:**
    - [ ] Aparece bajo 1024px según el `tier` del **contenedor** (LayoutService), no una media query suelta
    - [ ] Marca el destino activo; nombre accesible en cada botón (A11Y-03)
    - [ ] El shell reserva su alto: no tapa el contenido del bento fill-screen

- [ ] **T3.2** — Foco al `<h1>` al navegar
  - **AC ref:** AC8
  - **DoD:**
    - [ ] Directiva que mueve el foco tras cada `NavigationEnd`
    - [ ] No roba el foco en la primera carga
    - [ ] Test unitario

---

## Fase 4 — Cierre

- [ ] **T4.1** — Borrar `features/dashboard/`
  - **Por qué:** la spec 0002 declaró explícitamente que no lo migraba al contrato porque 0003 lo
    iba a reemplazar. Este es el momento; dejarlo sería exactamente la deuda que se difirió.
  - **DoD:** sin referencias en rutas, menú ni tests

- [ ] **T4.2** — `npm run lint:arch` limpio · `npm run test:ci` verde · `lint:arch:test` verde
- [ ] **T4.3** — **QA en navegador**: 2 temas × 2 anchos, barra inferior, foco tras navegar,
      recarga en subsección (AC-E3), consola limpia
- [ ] **T4.4** — `acceptance.md` con evidencia por AC. **AC3 y AC7 se declaran diferidos a la 0005**
- [ ] **T4.5** — `indices:sync`, ROADMAP a `done`, limpiar `.active`
- [ ] **T4.6** — Backportear a Koa lo genérico (NAV-01 seguro; el modelo de pendientes, a evaluar)

---

## Tareas descubiertas durante implementación

> Dentro del scope de la spec. Si algo queda fuera, spec nueva.

---

## Fuera de scope, confirmado en el plan

- ❌ **Plata, Casa, Cuerpo y Ajustes.** Sus contenidos son de otras specs; sus contenedores hoy
  serían entradas de menú a pantallas vacías — lo que AC4 prohíbe.
- ❌ **Búsqueda global, push, orden personalizable.**
