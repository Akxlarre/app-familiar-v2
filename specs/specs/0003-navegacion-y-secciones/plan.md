# Plan 0003 — Navegación y secciones

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-12

---

## 1. Resumen ejecutivo

La spec 0002 fijó **cómo se ve** una pantalla. Ésta fija **dónde vive** y **cómo se llega**.

El entregable real no son cinco pantallas: es la **maquinaria** que hace que la app responda
"¿tengo que hacer algo?" sin obligar a explorar, más la única pantalla que hoy tiene contenido
propio —**Hoy**— y el mecanismo por el que las demás secciones aparecen solas cuando sus specs
aterricen.

### La tensión que hay que resolver primero

La spec enumera cinco destinos (AC2) y **prohíbe mostrar entradas de módulos que no existen**
(AC4). Hoy, cuatro de los cinco no tienen contenido:

| Destino | Contenido | Estado real |
|---|---|---|
| **Hoy** | Pendientes, últimos movimientos | **Se construye acá** |
| **Plata** | Movimientos · Cuentas · Cuotas · Presupuestos | specs 0005–0008 |
| **Casa** | Despensa · Lista · Precios | hito 2 (0011–0014) |
| **Cuerpo** | Mediciones · Comidas · Entrenamiento | hitos 3–4 (0015–0021) |
| **Ajustes** | Hogar · Correo · Categorías · Comercios | repartido en 0001, 0004, 0009 |

No es una contradicción de la spec: es AC4 funcionando. **Si construyera los cinco destinos hoy,
el resultado sería exactamente el menú de promesas que AC4 prohíbe** — y que es la razón por la
que v1 tenía nueve módulos y cero uso.

**Decisión:** el menú **se deriva** de lo que está registrado, no de una lista fija. Hoy muestra
lo que hay; cada spec que aterrice enciende su destino agregando un registro, sin tocar la
navegación. AC3 y AC7 (tabs de subsección) se construyen y se prueban unitariamente ahora, pero
su **verificación en la app se declara diferida a la spec 0005**, que es la primera sección con
dos subsecciones reales. Mismo criterio que AC-E1 en la spec 0002: se declara, no se finge.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Archivo | Qué es |
|---|---|
| `core/models/pendiente.model.ts` | `Pendiente` + `FuenteDePendientes` + el `InjectionToken` multi |
| `core/services/pendientes.service.ts` | Agrega las fuentes registradas, aísla fallos por fuente |
| `core/services/pendientes.service.spec.ts` | Incluye el caso "una fuente falla y las demás siguen" |
| `core/models/destino.model.ts` | `Destino` (label, icono, ruta, subsecciones) |
| `core/services/navegacion.service.ts` | Deriva los destinos visibles de lo registrado |
| `core/services/navegacion.service.spec.ts` | AC2, AC4 |
| `core/guards/hogar.guard.ts` | Sin hogar → onboarding (AC-E1) |
| `core/guards/hogar.guard.spec.ts` | |
| `features/hoy/hoy.component.ts` | La pantalla (AC9–AC12) |
| `features/hoy/hoy.component.spec.ts` | |
| `features/hoy/hoy.facade.ts` + `.spec.ts` | Orquesta `PendientesService` + últimos movimientos |
| `features/bandeja/bandeja.pendientes.ts` | La bandeja **como fuente**, no como destino |
| `layout/bottom-nav.component.ts` + `.spec.ts` | Barra inferior bajo 1024px (AC6) |
| `core/directives/focus-on-navigation.directive.ts` + `.spec.ts` | Foco al `<h1>` (AC8) |
| `scripts/lib/nav-integrity.js` + `.test.mjs` | **NAV-01**: toda entrada del menú resuelve a una ruta declarada |

### Archivos a MODIFICAR

| Archivo | Cambio |
|---|---|
| `app.routes.ts` | `/app` → Hoy; not-found **dentro** del shell (AC-E2); `hogarGuard` |
| `core/services/menu-config.service.ts` | Deja de tener la lista fija: delega en `NavegacionService` |
| `layout/app-shell.component.ts` | Monta la barra inferior; aplica el foco de navegación |
| `layout/sidebar.component.ts` | Consume los destinos derivados |
| `app.config.ts` | Registra la fuente de pendientes de la bandeja |
| `scripts/architect.js` | Cablea NAV-01 (y `rule-wiring` lo exige) |
| `indices/ROUTES.md`, `COMPONENTS.md`, `SERVICES.md` | Sincronización |

### Archivos a ELIMINAR

| Archivo | Por qué |
|---|---|
| `features/dashboard/` | **Hoy es su reemplazo.** La spec 0002 declaró explícitamente que no se migraba al contrato de UI porque 0003 lo iba a reemplazar: migrarlo era trabajo tirado. Este es el momento |

---

## 3. Reutilización (Discovery)

### Lo que ya existe y se reutiliza tal cual

- `AppShellComponent` + `SidebarComponent` + `TopbarComponent`.
- `LayoutService` con `tier` derivado del ancho **del contenedor** (no del viewport) — el patrón
  App-like de la spec 0002. La barra inferior se decide con esto, no con una media query suelta.
- `subnav-tier.utils.ts` (`pickSubnavTier`) y `app-tabs` con sus cuatro tiers
  (full → short → icon → select). **AC7 ya está resuelto**: no hay que escribir el cálculo.
- `withViewTransitions()` ya está activo en `app.config.ts` — la mitad de AC8 está hecha.
- `authGuard`, `guestGuard`.
- Las cinco piezas del contrato de UI (`screen-contract.md`) para armar Hoy.

### Guardrails que ya cubren AC de esta spec

| AC | Guardrail que lo cubre |
|---|---|
| AC5/AC6 responsive sin scroll horizontal | ARCH-23 + el contrato fill-screen |
| Iconos de los destinos | ICON-01 |
| Botones de sólo icono en la barra inferior | A11Y-03 |
| Contraste del destino activo en los dos temas | ARCH-25 |

### Lo que hay que crear, y por qué no alcanza lo existente

- **`MenuConfigService` tiene la lista hardcodeada** y apunta a `/app/settings`, **una ruta que no
  existe**. Es el bug de AC4 ya presente en el repo: una entrada de menú que no lleva a ninguna
  parte. Por eso el menú pasa a derivarse, y por eso NAV-01 es una regla y no una revisión manual.
- **No hay barra inferior.** El sidebar colapsa, pero bajo 1024px la navegación tiene que estar
  bajo el pulgar (AC6).
- **No hay modelo de pendientes.** Es el corazón de la spec y no existe nada parecido.

---

## 4. Modelo de datos

No crea tablas. Introduce un modelo de UI y —más importante— una **dirección de dependencia**:

```ts
interface Pendiente {
  tipo: string;        // 'captura' | 'despensa' | …
  titulo: string;
  detalle?: string;
  cantidad: number;
  ruta: string;        // a dónde lleva resolverlo
  prioridad: number;   // menor = más arriba
}

interface FuenteDePendientes {
  readonly id: string;
  cargar(): Promise<Pendiente[]>;
}

const FUENTE_DE_PENDIENTES = new InjectionToken<FuenteDePendientes>('fuente-de-pendientes');
```

Cada dominio se registra como proveedor `multi: true`. **Hoy inyecta el token, nunca los facades.**

Agregar un módulo = agregar un proveedor. Nunca se toca Hoy. Es exactamente lo que v1 no hizo: su
dashboard terminó inyectando los nueve facades, y por eso cada módulo nuevo lo rompía.

---

## 5. Arquitectura del feature

### La inversión, en una línea

```
BandejaPendientes ─┐
DespensaPendientes ─┼→ FUENTE_DE_PENDIENTES (multi) → PendientesService → HoyFacade → HoyComponent
CuotasPendientes  ─┘
```

### Aislamiento de fallos

`PendientesService` resuelve con `allSettled`, no con `all`. Una fuente que revienta muestra **su
propio** estado de error dentro de Hoy; las demás siguen. Es un AC explícito de la spec ("que la
despensa no responda no puede dejar sin ver los movimientos") y es la clase de cosa que sólo se
verifica con un test que fuerce el rechazo.

### El menú derivado

`NavegacionService` expone `destinos()` computando **sólo los que tienen contenido registrado**.
`MenuConfigService` pasa a ser un adaptador sobre él para no romper a `SidebarComponent`.

### Capas tocadas

| Capa | Qué entra |
|---|---|
| `core/models` | `Pendiente`, `FuenteDePendientes`, `Destino` |
| `core/services` | `PendientesService`, `NavegacionService` |
| `core/guards` | `hogarGuard` |
| `core/directives` | `focusOnNavigation` |
| `features/hoy` | Componente + facade |
| `layout` | `BottomNavComponent`, cambios en el shell |
| `scripts/lib` | `nav-integrity` (NAV-01) |

---

## 6. Restricciones aplicables

- **R-01 (costo de entrada):** esta spec no produce datos; su justificación es que **baja el costo
  de consumirlos**. Si Hoy no responde la pregunta en un vistazo, no cumplió.
- **RNF-02:** consulta habitual en <30 s incluido abrir la app. Hoy es la que lo hace posible.
- **`screen-contract.md`:** Hoy usa las cinco piezas y sólo esas.
- **AC4 es una restricción de arquitectura, no de contenido:** obliga a que el menú se derive.
- **ARCH-02:** `HoyComponent` inyecta su facade, nunca `PendientesService` directo.

---

## 7. Plan de testing

| Qué | Cómo | AC |
|---|---|---|
| Agregación de pendientes | Unit con fuentes falsas | AC10 |
| **Una fuente falla, las otras sobreviven** | Unit con una fuente que rechaza | Estados especiales |
| Destinos visibles | Unit: registrar 1 y 3 destinos | AC2, AC4 |
| NAV-01 | `nav-integrity.test.mjs` + corre sobre el repo real | AC4 |
| `hogarGuard` | Unit: con hogar, sin hogar | AC-E1 |
| Foco al `<h1>` | Unit sobre la directiva | AC8 |
| Tabs y tier | Ya cubierto por `subnav-tier` | AC7 |
| Estado vacío de Hoy | Unit: cero pendientes → mensaje, no KPIs en cero | AC9 |
| **Navegador** | Matriz: 2 temas × 2 anchos, barra inferior con el pulgar, foco tras navegar, recarga en subsección | AC5, AC6, AC8, AC-E3 |

La lección de la 0002 se aplica entera: **el navegador manda**. Compilar no alcanza, y la captura
de pantalla encontró cosas que ningún test veía.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Hoy se convierte en el dashboard de v1** | La inversión de dependencia es la defensa estructural: Hoy no puede inyectar facades de dominio aunque alguien quiera |
| **La barra inferior tapa contenido** | El shell reserva su alto; se verifica en navegador con el bento fill-screen, no a ojo |
| **AC3/AC7 sin verificación real** | Declarado arriba y en `acceptance.md`. Se cierra con la 0005 |
| **Borrar el dashboard rompe algo** | Es una hoja: sólo lo referencian la ruta y el menú, y los dos cambian acá |

### Decisión de scope: no se construyen Plata, Casa, Cuerpo ni Ajustes

Sus contenidos pertenecen a otras specs. Construir sus contenedores hoy produciría entradas de
menú que llevan a pantallas vacías — el menú de promesas que AC4 prohíbe y que mató a v1.

Lo que **sí** entrega esta spec es que **encenderlos después cueste un registro**, no un rediseño.

---

## 9. Orden de implementación

1. **NAV-01 primero** — la regla que prueba que el menú no miente. Falla hoy sobre `/app/settings`:
   se escribe en rojo, como corresponde.
2. Modelo de pendientes + `PendientesService` con su aislamiento de fallos.
3. `NavegacionService` + `MenuConfigService` como adaptador.
4. La bandeja como **fuente** de pendientes.
5. `HoyComponent` + facade, con las cinco piezas del contrato.
6. Rutas: `/app` → Hoy, not-found dentro del shell, `hogarGuard`.
7. `BottomNavComponent` + montaje en el shell.
8. Foco de navegación (AC8).
9. Borrar `features/dashboard/`.
10. Validación: lint, tests, **navegador**, `acceptance.md`.

---

## 10. Estimación

| Fase | Tareas |
|---|---|
| Maquinaria (1–4) | 6 |
| Hoy (5–6) | 4 |
| Navegación (7–8) | 3 |
| Cierre (9–10) | 4 |

---

## Changelog

- 2026-08-12 — plan inicial. Resuelve la tensión AC2/AC4 derivando el menú y difiriendo la
  verificación de AC3/AC7 a la spec 0005.
