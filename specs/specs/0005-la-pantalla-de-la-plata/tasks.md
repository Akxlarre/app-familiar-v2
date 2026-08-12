# Tasks 0005 — La pantalla de la plata

> **Spec:** [spec.md](./spec.md)
> **Status:** in_progress
> **Created:** 2026-08-12

---

## Fase 1 — Ver la plata  ✅

- [x] **T1.1** — Semilla de desarrollo: 32 movimientos en dos meses
  - `supabase/seeds/movimientos-demo.sql`, **no** una migración. Incluye a propósito los casos
    borde que la spec exige: sin categoría (AC-E1), ingresos (AC2), sin comercio.
- [x] **T1.2** — `resumen_del_periodo` y `gasto_por_categoria` + índice `(household_id, fecha DESC)`
  - **AC ref:** AC6, AC7
  - Agregar en el cliente obliga a traerse todas las filas del período. Con un mes no se nota;
    con un año la pantalla deja de cumplir RNF-02 sin que nadie toque su código.
  - `STABLE` y **sin** `SECURITY DEFINER`: RLS sigue filtrando por hogar. Una función que salta
    RLS para "simplificar" es cómo se filtran datos entre hogares.
  - Sólo gastos en el reparto: mezclar el sueldo haría que se coma el 90% y el resto sea ilegible.
- [x] **T1.3** — `plata.model.ts`: período, agrupación por día, porcentajes — 12 tests
- [x] **T1.4** — `MovimientosRepository`: filtros, paginación y los dos agregados
- [x] **T1.5** — `PlataFacade`: tres bloques que cargan juntos y **fallan por separado** — 10 tests
- [x] **T1.6** — `MovimientosComponent` con las cinco piezas del contrato
- [x] **T1.7** — Ruta `/app/plata/movimientos` y **destino Plata encendido**
  - Primera prueba real del menú derivado de la spec 0003: registrar un `Destino` bastó para que
    apareciera en el sidebar y en la barra inferior, sin tocar la navegación.
- [x] **T1.8** — **QA en navegador con datos reales** — 14 comprobaciones

---

## Fase 2 — Corregir y aprender  ✅

- [x] **T2.1** — Drawer de detalle con el correo de origen (AC5)
  - El origen falla en silencio a propósito: es contexto, no el dato. Que no cargue no puede
    impedir corregir la categoría.
- [x] **T2.2** — Cambiar categoría (AC9)
- [x] **T2.3** — "Recordar este comercio" → alias (AC10)
- [x] **T2.4** — Aplicar a los pasados **con el conteo a la vista** (AC11, R-04)
  - El conteo excluye los que ya tienen la categoría destino: ofrecer "aplicar a 14" cuando 12 ya
    están bien infla el número y hace que el usuario acepte creyendo que arregla más de lo que
    arregla.
- [x] **T2.5** — Borrar devuelve la captura a la bandeja (AC12, RN-09)
  - Y lo **dice**: sin avisarlo, el usuario cree que borró el correo también.
- [x] **T2.6** — Los tres RPCs en SQL, no en el cliente
  - Agrupar "los otros del mismo comercio" exige normalizar igual que `normalizar_comercio`.
    Reimplementarlo en TypeScript sería una segunda versión del pedazo del que depende TODO el
    aprendizaje, y el día que difieran los alias dejarían de aplicarse en silencio.
  - Ninguno es `SECURITY DEFINER`: RLS ya filtra por hogar y `authenticated` tiene los privilegios
    (fix-001). Elevar permisos "para simplificar" es cómo se filtran datos entre hogares.
- [x] **T2.7** — **QA en navegador del ciclo completo** — 14 comprobaciones
  - Corregir un JUMBO desde la UI aplicó el cambio a los 4, aprendió el alias, y
    `categoria_para_comercio` confirma que un correo nuevo de JUMBO **ya llegaría categorizado**.
    Es REQ-013 funcionando de punta a punta.

## Fase 3 — Filtros

- [ ] **T3.1** — Filtros por cuenta, categoría, tipo y texto (AC13)
- [ ] **T3.2** — Los filtros viven en la URL (AC14)
- [ ] **T3.3** — Tabs de subsección de Plata → **cierra AC3, AC7 y AC-E3 de la spec 0003**

## Fase 4 — Cierre

- [ ] **T4.1** — AC-E4: 5.000 movimientos dentro del presupuesto de RNF-02
      → **cierra AC-E1 de la spec 0002**
- [ ] **T4.2** — `acceptance.md`, ROADMAP, `.active`

---

## Tareas descubiertas durante implementación

- [x] **TD1** — **Los KPIs del hero salían sin separador de miles** (`$348400`). `section-hero`
      interpola `kpi.value` tal cual, así que formatear es responsabilidad de quien arma el KPI.
      AC3 y RB-04 lo piden explícitamente. **Lo encontró la captura de pantalla**, no el test.
- [x] **TD2** — **Tres comprobaciones del QA pasaban vacuamente.** `[].every(...)` es `true`, y
      `undefined !== valor` también: dos de ellas pasaban justo cuando el hero **no** renderizaba.
      Un selector equivocado convirtió los tests en tautologías que confirmaban lo contrario de lo
      que decían medir. Corregidas exigiendo que el valor exista y tenga formato.
- [x] **TD4** — El drawer inyectaba `MovimientosRepository` y `ToastService` directamente, y
      ARCH-02 lo bloqueó. La corrección no fue cosmética: mover la lógica al facade puso la
      recarga de la lista donde corresponde, y el callback `alGuardar` que había inventado para
      avisarle al padre dejó de hacer falta — ataba el drawer a esta pantalla.
- [x] **TD3** — Un comentario del repositorio afirmaba "paginado por rango y no por offset"
      cuando `range` **es** offset. Corregido antes de que envejeciera como verdad, con la
      condición explícita bajo la cual habría que pasar a un cursor.
