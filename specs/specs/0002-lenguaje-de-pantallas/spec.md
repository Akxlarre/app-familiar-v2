# Spec 0002 — Lenguaje de pantallas: el contrato de UI

> **Status:** done
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** — (no produce datos)
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** iniciativa interna. Se escribe **antes** que las pantallas del hito 1, no después.

**Persona afectada:** los dos miembros del hogar, y quien construya las pantallas siguientes.

**Problema que resuelve:**
Hoy hay dos pantallas con datos (dashboard y bandeja) y ya divergen: una usa `bento-grid` con
KPIs propios y la otra un `section-hero` con su banda de KPIs. Van a venir unas veinte pantallas
más. Sin un contrato explícito, cada una inventa su forma, y unificarlas después cuesta diez
veces más que acordarlo ahora — es exactamente lo que pasó en v1, donde 80 componentes crecieron
sin vocabulario común.

**Hipótesis de valor:**
Si toda pantalla se arma con las mismas cinco piezas, construir la sexta pantalla cuesta la mitad
que construir la primera, y ninguna se siente de otra app.

---

## 2. User Stories

- **US1**: Como usuario, quiero que la app se sienta una sola app, para no tener que reaprender dónde están las cosas en cada sección.
- **US2**: Como usuario en el teléfono, quiero que cada pantalla sea usable con una mano, sin zoom ni scroll horizontal.
- **US3**: Como quien construye la pantalla siguiente, quiero un vocabulario cerrado de piezas, para no tener que decidir de cero el layout cada vez.

---

## 3. Acceptance Criteria (Gherkin)

### El contrato App-like

- **AC1**: Given cualquier pantalla de lista o panel en desktop (≥1024px), When se abre, Then llena el viewport y el scroll vive **dentro** del panel — el documento no scrollea.
- **AC2**: Given esa misma pantalla bajo 1024px, When se abre, Then mide su contenido y la página scrollea de forma nativa.
- **AC3**: Given un grid `--fill-screen`, When se inspecciona su markup, Then ninguna celda hija directa abarca más de una fila.
  <br>_Ya enforzado por ARCH-23 (`scripts/lib/bento-fill-rows.js`)._
- **AC4**: Given el drawer del shell abierto en desktop, When se mira el contenido principal, Then fue **empujado**, no tapado, y el bento se compactó.

### El vocabulario de piezas

- **AC5**: Given una pantalla nueva, When se arma, Then usa exclusivamente estas cinco piezas: hero (`app-section-hero`), panel que llena, fila de lista, drawer de detalle y estados (vacío, error, skeleton).
- **AC6**: Given una pantalla con métricas, When se muestran, Then van en la banda de KPIs del hero — no en cards sueltas por encima del contenido.
- **AC7**: Given cualquier texto de la app, When se le asigna estilo, Then usa el vocabulario semántico (`.kpi-value`, `.micro-label`, `.item-title`, `.section-eyebrow`, `.field-label`) y no un cluster de utilities equivalente.
  <br>_Parcialmente enforzado por ARCH-19._
- **AC8**: Given cualquier color en la app, When se aplica, Then sale de un token del design system; no hay colores Tailwind literales.
  <br>_Ya enforzado por ARCH-08._

### Modo claro y oscuro

- **AC9**: Given cualquier pantalla, When se cambia el tema, Then todo el contenido conserva contraste AA y ningún elemento queda invisible.
- **AC10**: Given un token de color nuevo, When se define, Then existe en los dos temas.
  <br>_Ya enforzado por `scripts/lib/theme-tokens.js`._

### Movimiento

- **AC11**: Given `prefers-reduced-motion: reduce`, When se navega por la app, Then ninguna animación GSAP corre y los callbacks de fin de animación se ejecutan igual.
- **AC12**: Given una animación de entrada, When el componente se destruye antes de terminar, Then no queda ningún tween vivo.

### Accesibilidad

- **AC13**: Given un botón que sólo muestra un icono, When se inspecciona, Then tiene nombre accesible.
  <br>_Ya enforzado por A11Y-03._
- **AC14**: Given un icono usado en un template, When se compila la app, Then está registrado en `app.config.ts`.
  <br>_Ya enforzado por ICON-01 — un icono sin registrar revienta en runtime, no al compilar._

### Edge cases obligatorios

- **AC-E1**: Given una lista de 500 filas, When se abre en móvil, Then el primer render no supera el presupuesto de RNF-02 (la pantalla es usable antes de 30 s desde abrir la app).
- **AC-E2**: Given un dato largo (comercio de 80 caracteres), When se muestra en una fila, Then se trunca sin romper el layout ni causar scroll horizontal.
- **AC-E3**: Given un monto de 9 cifras, When se muestra como KPI, Then no desborda su celda.

---

## 4. Out of scope

- ❌ **Rediseñar el design system.** Los tokens y el bento existen y están congelados por allowlist (ARCH-21). Esta spec fija **cómo se usan**, no los reemplaza.
- ❌ **La estructura de navegación** (qué secciones hay, cómo se agrupan) → spec 0003.
- ❌ **Componentes nuevos de PrimeNG.** Si una pantalla necesita uno, se decide en su propia spec.
- ❌ **Tema de marca / rebranding.** El brand actual se mantiene.

---

## 5. Dependencias

### Specs previas
- 0001 (`in_progress`) — no bloqueante: esta spec no toca la cadena de captura.

### Capacidades del proyecto que se asumen existentes
- `_bento-grid.scss` con los modificadores `--fill-screen`, `--fill-screen-2`, `--fill-screen-kpi`.
- `app-section-hero`, `app-empty-state`, `app-error-state`, `app-skeleton-block`.
- `LayoutDrawerService` + `LayoutDrawerComponent` con soporte de `inputs`.
- `GsapAnimationsService` con guarda de `prefers-reduced-motion`.
- Linter arquitectónico con ARCH-08, 11, 15–23, ICON-01, A11Y-03.

### Capacidades nuevas requeridas
- Una **pantalla de referencia** viva (no un Storybook: una ruta real en dev) que muestre las cinco piezas armadas, para copiar en vez de reinventar.
- Regla de path-scope en `.claude/rules/` que inyecte este contrato al editar `features/**`.

---

## 6. Datos y modelo

No toca persistencia.

---

## 7. UX y flujos

### Las cinco piezas

| Pieza | Qué es | Cuándo |
|---|---|---|
| **Hero** | Título, bajada, línea de contexto y banda de KPIs | Toda pantalla de sección. `density="slim"` cuando el contenido manda |
| **Panel que llena** | Card con cabecera fija, cuerpo scrolleable y pie fijo | Toda lista o tabla |
| **Fila** | `item-title` + `micro-label` de contexto + valor a la derecha + acciones | Todo listado |
| **Drawer** | Detalle o formulario que empuja el contenido en desktop, fullscreen en móvil | Todo detalle y todo formulario |
| **Estados** | Vacío con copy que explica, error con reintento, skeleton en primera carga | Siempre los tres |

### Reglas de composición

1. **Una pantalla = un hero + un panel.** Si necesita dos paneles, es `--fill-screen-2`.
2. **Los formularios viven en drawers, no en páginas.** Dos excepciones declaradas, y sólo
   dos: el login (previo al shell) y la revisión de una boleta (spec 0010 — 20-40 líneas
   que hay que comparar contra la foto necesitan ancho). Cualquier otra excepción se
   discute contra esta regla antes de escribirse.
3. **El estado vacío no es un error.** En la bandeja, vacío es el estado *deseable*, y el copy lo dice.
4. **Nada de modales.** El drawer del shell cubre el caso y no tapa el contexto.

---

## 8. Métricas de éxito post-launch

- Nº de clases ad-hoc detectadas por el ratchet de `class-discipline` (debe quedar en 0 regresiones).
- Tiempo de construcción de la enésima pantalla vs. la primera.

---

## 9. Notas / decisiones abiertas

- [x] ¿La pantalla de referencia va en una ruta `/app/_ds` sólo en dev, o se documenta en `indices/STYLES.md` con snippets? **Ruta `/app/_ds`, sólo en dev.** Se excluye del build de producción por configuración de rutas. Snippets en un `.md` se pudren en dos meses; una ruta que compila no puede quedar desactualizada sin que el build lo diga.
- [x] ¿Modal o drawer? **Drawer.** Ya existe, empuja en vez de tapar, y en móvil es fullscreen — un modal en móvil es un drawer peor hecho.
- [x] ¿KPIs en cards sueltas o en el hero? **En el hero.** Cards sueltas encima del contenido empujan la lista fuera del viewport y rompen el contrato App-like.

---

## Changelog

- 2026-08-11 — draft inicial.
- 2026-08-11 — decisiones cerradas en sesión de `grill_me`; aprobada y activada.
- 2026-08-12 — **cerrada.** 16/17 AC con evidencia en `acceptance.md`; AC-E1 declarado sin verificar.
