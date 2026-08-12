# Acceptance 0003 — Navegación y secciones

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verificado:** 2026-08-12
> **Método:** 405 tests + QA en navegador real (Chromium, Playwright) en dos anchos.

---

## Lo que esta spec entregó de verdad

No cinco pantallas: **la maquinaria** por la que el menú no puede mentir, más la única sección con
contenido propio hoy (**Hoy**) y el reemplazo del dashboard.

La spec enumera cinco destinos (AC2) y prohíbe mostrar los que no existen (AC4). Cuatro de los
cinco no tienen contenido todavía, así que construirlos habría producido el menú de promesas que
mató a v1. La salida fue **derivar** el menú: cada spec futura enciende su destino registrándolo.

---

## Los AC

| AC | Qué exige | Estado | Evidencia |
|---|---|---|---|
| **AC1** | `/app` aterriza en Hoy, no en un menú | ✅ | `app.routes.ts`: `redirectTo: 'hoy'`. El dashboard ya no existe |
| **AC2** | Los destinos son los cinco canónicos | ✅ | `ORDEN_DE_DESTINOS` + 7 tests de `NavegacionService`. Hoy se muestra **uno**, que es lo que AC4 exige |
| **AC3** | Subsecciones como tabs, no como menú | ⬜ | **Diferido a la spec 0005.** Ninguna sección tiene dos subsecciones todavía |
| **AC4** | Un módulo inexistente **no** aparece en el menú | ✅ | **NAV-01 nuevo**, en rojo sobre `/app/settings` —muerto desde el día uno— y en verde al derivar el menú |
| **AC5** | Sidebar persistente en desktop, marca la activa | ✅ | Navegador 1400px: sidebar visible; `esActivo` por segmento, con test de `/app/plataforma` ≠ `/app/plata` |
| **AC6** | Bajo 1024px, los destinos bajo el pulgar | ✅ | Navegador 390px: barra de **59px** visible, ausente en desktop, y el shell reserva **96px** |
| **AC7** | Los tabs colapsan a selector al angostar | ⬜ | **Diferido a la 0005.** `pickSubnavTier` ya existe y está probado; falta la sección donde ejercerlo |
| **AC8** | Transición de vista y foco al `<h1>` | ✅ | `withViewTransitions()` activo; directiva con 5 tests. Navegador: en la carga inicial el foco queda en `BODY`, no robado |
| **AC9** | Sin pendientes lo dice; no una grilla de ceros | ✅ | `HoyComponent` muestra la frase y `kpis()` devuelve `[]`. Test explícito |
| **AC10** | Capturas primero, con número exacto y acceso directo | ✅ | `BandejaPendientes` con `prioridad: 1`; 6 tests. El enlace apunta a `/app/bandeja` |
| **AC11** | Últimos movimientos sin entrar a Plata | ✅ | `MovimientosRepository.ultimos(5)`; el monto se pinta `−$12.990` (punto como separador de miles) |
| **AC12** | Pregunta de despensa como pendiente de un toque | ✅ | El lugar está: basta registrar una `FuenteDePendientes`. Se llena en el hito 2 |
| **AC-E1** | Usuario sin hogar → onboarding | ⬜ | **Diferido a la spec 0004**, que ES el onboarding. Un guard sin destino es código sin llamador |
| **AC-E2** | Ruta inexistente bajo `/app` sin perder navegación | ✅ | Comodín **hijo** de `/app`: el not-found conserva shell, sidebar y barra inferior |
| **AC-E3** | Recarga en subsección deja el tab correcto | ⬜ | **Diferido a la 0005**, con AC3 y AC7: no hay subsecciones que recargar |

**11 de 15 verificados. Los 4 diferidos lo están por dependencia real, no por falta de tiempo**, y
cada uno dice a qué spec se cierra.

---

## Lo que la verificación encontró

| # | Defecto | Cómo apareció |
|---|---|---|
| 1 | **`/app/settings` en el menú sin ruta que lo respalde** | NAV-01, escrita para eso. Llevaba ahí desde el primer commit |
| 2 | **La directiva de foco SÍ robaba el foco en la carga inicial** | **La captura del navegador**: anillo de foco sobre el `<h1>` al abrir. El código afirmaba lo contrario **en un comentario** |
| 3 | El parser de NAV-01 leía `/_ds` como `/app/_ds` | Tres tests en rojo antes de cablear nada |
| 4 | NAV-01 contaba como ruta un `path:` de un **comentario** | Revisando su salida sobre el repo real. Habría dejado pasar un enlace muerto a `/admin` |
| 5 | `BaseFacade.initialize()` no lanza: una bandeja caída se leía como cero pendientes | Al escribir `BandejaPendientes`. Hoy habría dicho "no hay nada que hacer" con trabajo sin ver |
| 6 | El spec de `BreadcrumbService` **verificaba el comportamiento del enlace muerto** | Se cayó al derivar el menú |
| 7 | El spec de `MenuConfigService` exigía "array no vacío" | Ídem. Es justo lo que empuja a inventar entradas para llenar el menú |
| 8 | `text-state-warning` y `text-state-success` no generan CSS | ARCH-11, sobre código recién escrito |
| 9 | El test de `HoyComponent` veía **media pantalla** | `ngOnInit` lanza `initialize()` sin esperarla y `whenStable()` no la rastrea en zoneless |

El defecto 2 es el de esta spec: **el comentario afirmaba el comportamiento y el navegador lo
desmintió.** Ni el linter ni los tests podían verlo, porque no había test — el DoD lo daba por
cierto.

---

## Correcciones sobre el plan

- **La barra inferior usa el breakpoint del viewport, no el `tier` del contenedor.** El plan decía
  lo contrario. El tier mide `<main>`, que el drawer angosta; la barra tiene que seguir abajo con
  el drawer abierto.
- **La QA se hizo sobre `/_ds`**, la única ruta con shell fuera de `authGuard`. Hoy vive detrás del
  guard, así que su verificación en navegador **con datos reales queda pendiente de credenciales de
  Supabase**. La navegación —que es lo que esta spec entrega— sí se verificó.

---

## Comandos de verificación

```bash
npm run test:ci        # 405 tests
npm run lint:arch      # 0 errores, 2 advertencias (ARCH-09 heredadas)
npm run lint:arch:test # incluye nav-integrity (8 casos) y rule-wiring
ng serve --port 4288 && node qa-0003.mjs   # 2 anchos, barra inferior, foco, consola
```
