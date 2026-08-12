# Tasks 0004 — Del registro al primer movimiento

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-12

---

## Fase 1 — Guards y paso derivado

- [x] **T1.1** — `hogar.model.ts`: el paso se **deriva**, nunca se guarda
  - **AC ref:** AC-E1
  - 9 tests. Incluye el caso que justifica la decisión: desconectar el correo devuelve el
    onboarding a incompleto, que es lo que una columna `onboarding_step` no sabría.
- [x] **T1.2** — `HogaresRepository`: `create_household`, `join_household_by_code`, estado
  - Tres conteos con `head: true`, no tres cargas: sólo importa si hay algo.
- [x] **T1.3** — `hogarGuard` y `onboardingGuard`, espejo uno del otro
  - **AC ref:** AC1, AC-E2 · 7 tests
  - Ambos **fallan hacia adelante**: si la consulta revienta, dejan pasar. Un guard que bloquea
    cuando la red falla encierra al usuario, y lo de atrás ya lo protege RLS.

---

## Fase 2 — Paso 1: tu hogar

- [x] **T2.1** — `OnboardingFacade` con paso derivado y paso **retenido** — 9 tests
- [x] **T2.2** — `PasoHogarComponent`: crear o unirse, y el código para compartir
- [x] **T2.3** — `OnboardingComponent`: contenedor con el progreso visible
- [x] **T2.4** — Ruta `/onboarding` fuera del shell, con `authGuard` + `onboardingGuard`
- [x] **T2.5** — **QA en navegador con un usuario creado de cero** — 13 comprobaciones en verde

---

## Fase 3 — Paso 2: tu banco y tu primera cuenta

- [x] **T3.1** — Migración `plantillas_parser` (catálogo global) + 10 plantillas de bancos chilenos
  - Tabla y no semilla de migración: RB-01 dice que los formatos cambian solos, y corregir un
    regex no puede exigir un despliegue.
  - Índice único `(banco, tipo)`: sin él, correr la migración dos veces duplica el catálogo y el
    hogar termina con parsers repetidos interpretando el mismo correo.
  - **Los patrones son un punto de partida, no una verdad verificada.** Se escribieron a partir de
    los remitentes conocidos, sin un correo real delante. El primero que conecte su casilla va a
    encontrar los que no calzan — y ese es el flujo previsto: la captura queda en la bandeja con
    su motivo, se corrige el patrón y `reprocesar-capturas` la vuelve a interpretar.
- [x] **T3.2** — `BancosRepository`: catálogo y copia al hogar (AC14) — 5 tests
  - **Copia y no referencia:** cuando alguien corrija una plantilla global, los hogares que ya
    funcionaban no se ven alterados por un cambio que no pidieron.
  - Crear la cuenta y copiar los parsers van juntos: una cuenta sin parsers no captura nada, y
    unos parsers sin cuenta dejan las capturas atascadas (AC13). Separarlos es crear el estado
    intermedio que el propio AC describe como problema.
- [x] **T3.3** — `PasoBancoComponent`: elegir banco y crear la primera cuenta
- [x] **T3.4** — Tests + **QA en navegador**: 18 comprobaciones en verde, y en Postgres la cuenta
      con su parser copiado y enganchado (`enganchados = t`)

---

## Fase 4 — Paso 3: tu correo  ·  *bloqueada por credenciales*

- [ ] **T4.1** — `PasoCorreoComponent`: consentimiento y elección de carpeta (AC5, AC8)
- [ ] **T4.2** — Desconectar borra los tokens (AC9)
- [ ] **T4.3** — Sin refresh token **no se guarda la integración** (AC7)

> Se puede construir; **no se puede verificar acá**. Faltan `GOOGLE_CLIENT_ID`/`SECRET`, y el
> edge runtime no arranca en este entorno (baja paquetes de npm y el proxy TLS le da
> `UnknownIssuer`).

---

## Fase 5 — Paso 4: la primera corrida  ·  *bloqueada*

- [ ] **T5.1** — Edge function `procesar-ahora` para un hogar (AC10)
- [ ] **T5.2** — `PasoListoComponent` mostrando lo encontrado (AC11)
- [ ] **T5.3** — Copy del caso vacío: qué se buscó y qué hacer (AC12)

---

## Fase 6 — Cierre

- [ ] **T6.1** — Cablear `hogarGuard` sobre `/app` — **a propósito, recién cuando los 4 pasos
      existan**. Cablearlo ahora mandaría a todo usuario nuevo a un onboarding que no puede
      terminar, y quedaría atascado sin forma de salir.
- [ ] **T6.2** — Declarar la tercera excepción de `screen-contract.md`: el onboarding es un
      formulario fuera de un drawer porque no hay shell donde montarlo.
- [ ] **T6.3** — `acceptance.md`, ROADMAP, `.active`

---

## Tareas descubiertas durante implementación

- [x] **TD1** — `households.timezone`, no `zona_horaria`: **inventé el nombre de la columna en vez
      de mirarlo**, y PostgREST devolvió 400 a la consulta entera. Mismo modo de fallo que
      `fix-005`, cometido de nuevo el mismo día.
- [x] **TD2** — **El código de invitación no se veía nunca.** El paso derivado avanza en cuanto la
      base cambia, así que al crear el hogar la pantalla saltaba a "banco" y el `invite_code` —lo
      único que el usuario necesita sacar de ahí— desaparecía antes de que llegara a leerlo. Es
      exactamente lo que AC2 pide y el diseño derivado, por sí solo, rompía. De ahí el **paso
      retenido**: lo que ya está hecho se puede seguir mostrando hasta que el usuario confirme.
      Lo encontró el navegador, no los tests: los tests verificaban el paso, no lo que se ve.
