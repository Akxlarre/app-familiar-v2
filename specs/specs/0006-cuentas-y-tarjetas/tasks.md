# Tasks 0006 — Cuentas y tarjetas de crédito

> **Spec:** [spec.md](./spec.md)
> **Status:** in_progress
> **Created:** 2026-08-12

---

## Fase 1 — Ver y administrar cuentas  ✅

- [x] **T1.1** — Migración: `cuentas.estado` con CHECK
  - `estado TEXT` y no `archivada BOOLEAN`: deja lugar a "cerrada por el banco", que no es lo
    mismo que archivada por el usuario, sin otra migración.
  - Migra el valor de `activa`, y **no borra esa columna**: quitarla es una limpieza aparte, no
    algo que deba pasar en la misma migración que introduce su reemplazo.
- [x] **T1.2** — `periodoDeFacturacion` y `resumenDeCupo` — 13 tests
  - **AC-E2:** día 31 en un mes de 30. `new Date(2026, 3, 31)` **no lanza**: desborda a mayo. Una
    versión ingenua no falla, **miente**. Cubiertos febrero, febrero bisiesto y ambos cambios de año.
  - **AC-E3:** sin cupo declarado devuelve `null` en vez de dividir por cero. Una tarjeta sin cupo
    es normal: el banco no lo manda en el correo.
  - El disponible no baja de cero: "te quedan −40.000" no es información, y que se superó lo dice
    `superado`.
- [x] **T1.3** — `BancosRepository`: cuentas con detalle, cupo usado y parsers
  - El usado se **deriva** de los movimientos, nunca es columna: un saldo guardado se pudre igual
    que `calories_target` en v1.
  - Cada tarjeta usa **su** período de facturación, no el mes calendario: con corte el 15, lo
    comprado el 20 es del período siguiente, y mostrarlo contra el mes daría un cupo que no
    coincide con el que cobra el banco.
- [x] **T1.4** — `CuentasFacade` + `CuentasComponent` (AC1, AC4, AC5, AC6, AC7, AC9, AC11)
  - El estado vacío explica la **consecuencia**: sin cuenta, los cargos quedan atascados en la
    bandeja aunque el monto se haya leído perfecto.
- [x] **T1.5** — **Tabs de Plata** → **cierra AC3, AC7 y AC-E3 de la spec 0003**
  - Sólo entran las subsecciones que **existen**. Cuotas y Presupuestos no van comentadas ni
    deshabilitadas: un tab que no lleva a ningún lado es la misma promesa que AC4 de la 0003
    prohíbe en el menú, un nivel más abajo.
  - El tab activo sale de la **URL**, no de un signal propio: dos fuentes de verdad para "dónde
    estoy" se desincronizan en cuanto alguien usa el botón del navegador.
- [x] **T1.6** — **QA en navegador** — 15 comprobaciones

---

## Fase 2 — Crear y editar desde la app  ✅

- [x] **T2.1** — Drawer de alta/edición (AC1, AC2, AC3)
  - **El tipo se elige primero y define qué campos siguen.** En efectivo, cupo y fechas **no
    existen**: no están apagados. Un formulario con la mitad de los campos deshabilitados le pide
    al usuario que ignore lo que ve, y lo que se ignora se completa mal.
  - Al editar, el tipo **no** se cambia: dejaría un `detalle_credito` huérfano o una tarjeta sin
    él, y ninguna de las dos cosas se arregla sola.
- [x] **T2.2** — Vincular cuenta ↔ parser (AC10)
- [x] **T2.4** — AC-E1: el patrón de asunto se muestra en cada parser
  - Es lo que distingue dos cuentas del mismo banco: los correos de la tarjeta de crédito y la de
    débito llegan del mismo remitente y sólo se diferencian por el asunto. Verlo es lo que
    permite elegir bien.
- [~] **T2.3** — "Reintentar" con `reprocesar-capturas` → **no verificable en este entorno**
  - Es una edge function, y el edge runtime no arranca acá: baja paquetes de npm y el proxy TLS
    le da `UnknownIssuer`. Se construye cuando haya dónde probarlo, junto con los pasos 3 y 4 del
    onboarding, que están bloqueados por lo mismo.

---

## Fase 3 — Cierre

---

## Fase 3 — Cierre

- [ ] **T3.1** — `acceptance.md`, ROADMAP, `.active`

---

## Decisión que queda abierta, y por qué

- 🌍 **¿El cupo usado incluye las cuotas futuras?** Requiere ver **un estado de cuenta real** de
  una tarjeta con cuotas vigentes: el banco las descuenta del cupo al comprar, y mostrarlo
  distinto confundiría. Hoy el cupo usado suma sólo los movimientos del período. Se decide con la
  spec 0007, que es la que trae las cuotas.

---

## Tareas descubiertas durante implementación

- [x] **TD1** — **`'d \'de\' MMMM'` en un template inline no llega escapado a Angular.** El
      backslash lo consume TypeScript, así que el compilador recibe `'d 'de' MMMM'` y falla con
      `NG5002`. En `detalle-movimiento` había funcionado porque ahí quedó `\\'`. La forma que no
      depende de cuántos backslashes sobrevivan es **usar comillas dobles** para el formato:
      `date: "d 'de' MMMM"`.
- [x] **TD2** — Dos comprobaciones del QA fallaron por buscar texto en minúsculas: `.micro-label`
      aplica `text-transform: uppercase` e `innerText` devuelve **el texto pintado**, no el del
      markup. Esta vez el test falló por la razón correcta —la pantalla estaba bien— pero es el
      mismo malentendido que puede producir un falso verde en el sentido contrario.
- [x] **TD3** — `app-tabs` renderiza **medidores ocultos** para decidir su tier, así que un
      selector sin filtro de visibilidad encuentra botones que el usuario no puede tocar.
