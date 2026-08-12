---
paths:
  - "src/app/**/*.html"
  - "src/app/**/*.scss"
  - "src/app/shared/**/*.ts"
  - "src/app/features/**/*.ts"
  - "src/app/layout/**/*.ts"
  - "src/styles/**/*.scss"
---

# Sistema Visual

## Prioridad de UI

1. `indices/COMPONENTS.md` — ¿Existe algo reutilizable del Design System local?
2. `PrimeNG` — Para inputs complejos, tablas, calendarios, dropdowns
3. Componente custom — Solo si 1 y 2 no cubren la necesidad

## Tokens de color (PROHIBIDO hardcodear)

- Textos: `text-primary`, `text-secondary`, `text-muted`
- Fondos: `bg-canvas` (página), `bg-surface` (cards), `bg-surface-elevated`
- Marca: `var(--ds-brand)`, `var(--color-primary)`
- **NUNCA**: `text-red-500`, `bg-[#ff0000]`, u otras utilities de colores arbitrarios de Tailwind. Usa siempre variables abstractas.

## Iconos — Sistema Lucide (OBLIGATORIO)

- **PROHIBIDO** usar emojis como iconos de UI (❌ `✅`, `⚠️`, `🔒`, `📊`)
- **OBLIGATORIO** usar `<app-icon name="..." />` para todo ícono de interfaz
- Selector: `app-icon` | inputs: `name` (requerido), `size` (default 16), `color`, `ariaHidden`
- Nombres en kebab-case igual que en lucide.dev (ej: `"trending-up"`, `"trash-2"`)
- Para agregar un ícono nuevo: importarlo de `'lucide-angular'` y registrarlo en `provideIcons()` en `app.config.ts`
- **NUNCA** insertar `<svg>` inline ad-hoc — siempre pasar por `<app-icon>`

## Regla 3-2-1 de Marca (Brand Color Discipline)

El color de marca `var(--ds-brand)` debe aparecer en **máximo 3 elementos por viewport**:
- **2 interactivos** → CTAs primarios, links de acción, botones `.btn-primary`
- **1 decorativo** → borde de `.card-accent`, indicador de sección activa, o highlight visual

**PROHIBIDO:**
- Usar `var(--ds-brand)` en texto largo o de cuerpo
- Fondos de sección completos con el brand color (usar `.surface-hero` en su lugar)
- Más de 1 elemento puramente decorativo de marca por viewport

## Vocabulario tipográfico (OBLIGATORIO)

Cuatro clases cubren el 90% de la tipografía de la app. **Usarlas siempre en lugar de recomponer
utilities de Tailwind** — cada recomposición a mano es un punto de divergencia. En un proyecto
real esta regla nació después de encontrar 221 micro-labels escritos a mano en 25 variantes
distintas, con 14 archivos mezclando varias entre sí.

| Clase | Qué es | Reemplaza a |
|---|---|---|
| `.kpi-value` | Número KPI principal | `text-4xl font-bold` |
| `.micro-label` | **Micro-label uppercase** — label de KPI, cabecera de grupo, título de columna, etiqueta de campo en lectura | `text-xs uppercase tracking-* font-* text-text-muted` |
| `.item-title` | Título de fila / card / ítem de lista | `text-sm font-semibold text-text-primary` |
| `.section-eyebrow` | Línea de contexto **legible** antes de un título (sin uppercase) | `text-sm text-text-secondary` |

Combinar con `.card-tinted` para máximo contraste visual en KPIs.

```html
<!-- CORRECTO -->
<div class="card-tinted">
  <span class="micro-label">Usuarios activos</span>
  <span class="kpi-value">24.8K</span>
</div>

<!-- INCORRECTO -->
<div>
  <p class="text-xs text-gray-500 uppercase">Usuarios activos</p>
  <p class="text-4xl font-bold">24.8K</p>
</div>
```

> **`.kpi-label` es un alias deprecado de `.micro-label`.** Sigue funcionando; no usarla en
> código nuevo.
>
> **`.micro-label` no tiene restricción de alcance** — es para cualquier micro-label en
> mayúsculas, no solo para KPIs. Restringirla a datos numéricos es precisamente lo que empuja a
> la gente a recomponer la clase a mano cuando la necesita en otro contexto.
>
> ⚠️ **No nombrar una clase del DS igual que una utility "bare" de Tailwind.** Esta clase se
> llamó `.overline` hasta que se detectó la colisión: `overline` es también una utilidad nativa
> de Tailwind (`text-decoration-line: overline`), así que Tailwind generaba su propia regla en
> `@layer utilities` que **se sumaba** (no reemplazaba) al estilo del DS, dibujando una línea
> física encima del texto. Renombrar fue la única forma de eliminarla de raíz.
>
> La distinción que **sí** importa es `.micro-label` (uppercase, micro, `text-muted`) vs
> `.section-eyebrow` (`text-sm`, natural, `text-secondary`): la primera etiqueta un dato, la
> segunda da contexto legible antes de un título.

## Vocabulario de campos (OBLIGATORIO) — ARCH-24

Un input tiene borde, fondo, padding y radio. Escritos como utilities son catorce clases que hay
que repetir idénticas en cada campo de la app, y no lo van a ser.

| Clase | Qué es |
|---|---|
| `.field-label` | Label de un campo editable |
| `.field-input` | El `<input>`, `<select>` o `<textarea>` |
| `.field-input--invalid` | Estado de error del campo |

```html
<!-- CORRECTO -->
<label for="email" class="field-label">Correo electrónico</label>
<input id="email" type="email" class="field-input" />

<!-- INCORRECTO — ARCH-24 -->
<input class="w-full box-border rounded-[var(--input-radius)] border
              border-[var(--input-border-default)] bg-[var(--input-bg)]
              px-[var(--input-padding-x)] py-[var(--input-padding-y)] …" />
```

**ARCH-24** detecta la combinación borde + fondo + padding + radio sobre un campo. Es ratcheado
como el resto de la disciplina de clases: la deuda existente se tolera vía baseline, una nueva es
regresión.

## El contraste no se hereda del token — ARCH-25

Que un token exista en los dos temas **no significa que se pueda leer**. Un par texto/fondo
válido en claro puede quedar en 2.1:1 en oscuro y nadie lo nota hasta que un usuario lo reporta.

- Texto normal: **≥4.5:1**. Texto grande (≥18.66px bold o ≥24px): **≥3.0:1**.
- Se miden los pares canónicos declarados en `scripts/lib/contrast-check.js`, en **los dos temas**.
- Los fondos semi-transparentes (`--state-*-bg` en rgba) se **componen** sobre `--bg-base` antes
  de medir: el contraste real es el del color compuesto, no el del rgba.
- Al agregar un par texto/fondo nuevo al DS, agregarlo también a `PARES_CANONICOS`. Un par que
  nadie mide es un par que nadie garantiza.

## Nombrar tokens del `@theme` — ARCH-26

La colisión con utilities bare (`.overline`) tiene un gemelo del lado del `@theme`, y es peor.

Un token `--color-X` genera `text-X`, `bg-X`, `border-X`. Si `X` coincide con un valor de una
**escala nativa** de Tailwind (`base`, `sm`, `lg`, `xl`…), la utilidad de color generada **le gana
a la nativa**:

```css
/* ❌ --color-base hace que `text-base` sea una utilidad de COLOR.
      Los inputs del login quedaron pintados del color del fondo: 1.15:1, invisibles. */
--color-base: var(--bg-base);

/* ✅ */
--color-canvas: var(--bg-base);
```

**Regla:** ningún token del `@theme` puede llamarse como un valor de escala nativa. Los fondos de
página son `bg-canvas`, no `bg-base`. ARCH-26 lo verifica en cada auditoría.

## Patrón App-like (fill-screen Desktop / scroll Mobile)

> Cuando se dice **"hazlo app-like"** significa **exactamente esto**, no una estética genérica de app.

**Definición:** la página ocupa todo el alto disponible en Desktop (lg+) **sin que el documento
scrollee** — como una app de escritorio nativa. El overflow se resuelve con **scroll interno**
dentro de los paneles (tabla, lista, rail), no moviendo la página. En **Mobile** revierte a
scroll nativo normal.

### App-like son DOS pilares, no uno

Aplicar solo el modificador CSS produce una página que "llena la pantalla" pero **recorta o
scrollea mal**. App-like OBLIGA a los dos juntos:

1. **Shell fill-screen (CSS):** modificador en el `.bento-grid` raíz + la celda que crece marcada
   con `.bento-fill`.
2. **Densidad adaptativa (TS):** el contenido se **presupuesta** para caber en el alto fijo —
   nunca "se deja empujar".

### Pilar 1 — Shell (clases canónicas)

| Clase | Uso |
|---|---|
| `.bento-grid--fill-screen` | Hero + celda protagonista. |
| `.bento-grid--fill-screen-2` | Hero + 2 zonas que llenan. |
| `.bento-grid--fill-screen-kpi` | Hero + fila de KPIs separada + celda protagonista. |
| `.bento-fill` | Celda que **crece y scrollea internamente**. Aplica `contain: size` solo en lg+. |
| `.bento-grid--hero-fit` | La 1ª fila se ajusta a su contenido (hero slim sin hueco debajo). |
| `.bento-grid--rows-fit` | TODAS las filas se ajustan. Solo para grids de puros `.bento-banner`. |

- **Toda celda hija de un grid fill-screen debe ocupar UNA sola fila.** Los modificadores
  definen un `grid-template-rows` explícito; si una celda pide 2 filas, el template se
  desborda, el grid crea filas implícitas y **las celdas se superponen**. `.bento-hero`,
  `.bento-feature` y `.bento-tall` ocupan 2 filas → **no sirven acá**. Usar `.bento-banner`
  (full-width, 1 fila) y anidar adentro: una fila de KPIs es un `grid grid-cols-4` DENTRO
  del banner, no cuatro `.bento-square` sueltos.
  **ARCH-23 lo caza** (`npm run lint:arch`): el navegador no lanza ningún error acá — solo
  se ven celdas encimadas —, así que la regla es la única red que atrapa este bug.
- **PROHIBIDO** `contain` o `min-height` **inline** en la celda — el canon vive en `.bento-fill`.
  Duplicarlo inline rompe el layout dual.
- **`flex`, no `grid`,** para las columnas internas: solo flex propaga el alto para que cada
  columna tenga su propio scroll.
- Un componente que actúa como celda `.bento-fill` necesita
  `:host { display:flex; flex-direction:column; min-height:0 }` y el padre le pasa
  `class="bento-fill flex flex-col"`.
- El descuento de topbar/gutters vive en `--app-shell-offset` (default `120px`) dentro de
  `_bento-grid.scss`. Si cambiás la altura del topbar, ajustalo ahí — no hardcodees el `calc()`.

### Ejemplo mínimo

```html
<!-- Todas las celdas son .bento-banner → 1 fila cada una.
     Los KPIs se anidan DENTRO del banner de la fila 2. -->
<section class="bento-grid bento-grid--fill-screen-kpi" appBentoReveal appBentoGridLayout>

  <!-- Fila 1 — header -->
  <div class="bento-banner surface-hero rounded-2xl p-6">…</div>

  <!-- Fila 2 — KPIs anidados, NO celdas sueltas del bento -->
  <div class="bento-banner grid grid-cols-2 gap-4 lg:grid-cols-4">
    @for (k of kpis(); track k.id) {
      <app-kpi-card [label]="k.label" [value]="k.value" />
    }
  </div>

  <!-- Fila 3 — la celda que crece y scrollea internamente -->
  <div class="bento-banner bento-fill card flex flex-col overflow-hidden min-h-0">
    <ul class="flex-1 overflow-y-auto min-h-0">…</ul>
  </div>
</section>
```

### Pilar 2 — Densidad adaptativa (medir por CONTENEDOR)

- `LayoutService.tier()` → signal `mobile | tablet | desktop` (umbrales 640/1024), alimentado por
  `observeMain(<main>)` con ResizeObserver, registrado **una sola vez** en `AppShellComponent`.
  Es **por contenedor**, no por viewport.
- `core/utils/layout-tier.utils.ts` → `widthToTier`, `sliceByBudget` (recorta N items al
  presupuesto de alto), `visibleWithLoadMore`, `LoadMoreState`.
- El Smart Component resuelve el presupuesto y lo pasa al Dumb como input (ej. `maxVisible: number | null`).
- **Estados vacíos y skeletons dentro de un `.bento-fill`** van SIEMPRE en un wrapper
  `flex-1 flex items-center justify-center`: la celda puede medir 500px+, mucho más que la card
  de altura natural, y sin eso quedan pegados arriba con un hueco vacío debajo.

### Trampas ya resueltas (no reinventar)

- **Switch de layout por CONTENEDOR, NO por `lg:` de Tailwind.** Usar
  `isDesktopLayout() = maxVisible() === null` (= tier desktop). Con `lg:` las columnas no se
  apilan cuando un drawer angosta `<main>`.
- **`<main>` DEBE declarar `container-type: inline-size; container-name: layoutmain`.** Todo el
  bento grid responde a `@container layoutmain`. Sin eso, ninguna query matchea y el grid colapsa
  a 1 columna en cualquier ancho.
- **Jerarquía por ancho, no por tamaño de fuente.** Si "se siente apretado", revisar qué panel es
  el protagonista (tabla ancha `flex-1` + rail angosto `<aside w-80>`) **antes** de achicar tipografías.
- **QA geométrico ≠ mirada humana.** Tests en verde no garantizan que se vea bien; validar
  visualmente con el skill `verify`.
- **Nunca backticks dentro de comentarios de un `template` literal** — rompen el build y
  `ng serve` sirve un bundle stale en silencio.
- **Nunca corchetes en un binding de clase** (`[class.flex-[2]]`) — rompen el binding.

### Cuándo NO aplica (excepción, no regla)

App-like es el default de toda página de contenido enrutable (excluye auth pre-shell e
impresión). "No aplica" debe justificarse con al menos uno de estos criterios — nunca con "es un
formulario" o "es una página de detalle" como motivo genérico:

1. **Contenido genuinamente corto que nunca produce overflow.** El modificador no resuelve nada
   porque no hay scroll que evitar.
2. **El caso de uso real es mobile/tablet-first por el contexto físico de la tarea.** El patrón
   optimiza sesiones de escritorio.
3. **No es una vista de navegación normal.** Hojas imprimibles (`@media print`) o pantallas
   previas al shell autenticado.

**"Múltiples secciones secuenciales" NO es criterio de exclusión válido por sí solo** — es la
señal de que la página necesita **reestructurarse en tabs**, para que cada sección se vuelva su
propio `.bento-fill` sin perder funcionalidad. Los wizards con stepper tampoco quedan excluidos
por defecto: usar un patrón full-height propio (`:host { display:flex }` +
`@container layoutmain (min-width:1024px) { height: calc(100vh - Npx) }`).

## Skeletons y Estados de Carga (OBLIGATORIO)

Patrón estricto de **Single-Component Skeleton**, para evitar componentes duplicados y Layout
Shift (CLS).

- **PROHIBIDO** crear componentes separados tipo `*-skeleton.component.ts`. Si el skeleton vive
  aparte, se desincroniza en silencio cuando el componente real cambia de estructura — y el
  layout shift vuelve sin que nadie lo note.
- **OBLIGATORIO** resolver el skeleton dentro del mismo componente: todo componente que cargue
  datos acepta un input `loading` y renderiza el placeholder con `@if (loading())`.
- **OBLIGATORIO** usar `<app-skeleton-block>` para los placeholders — usa
  `GsapAnimationsService.createShimmer()` automáticamente. No usar `@keyframes` CSS para brillos.
- Marcar el contenedor con `[attr.aria-busy]` mientras carga.

```html
<!-- CORRECTO — dentro del propio componente -->
<div class="card card-tinted" [attr.aria-busy]="loading() ? 'true' : null">
  @if (loading()) {
    <app-skeleton-block variant="text" width="55%" height="12px" />
  } @else {
    <span class="micro-label">{{ label() }}</span>
  }
</div>
```

> ⚠️ **Trampa conocida:** si el componente anima algo con `viewChild.required()`, pasar a
> skeleton interno lo rompe — durante la carga ese elemento no existe en el DOM y
> `viewChild.required()` lanza. Usar `viewChild()` sin `required` y disparar la animación desde
> un `effect()` que espere a que el elemento aparezca. Ver `kpi-card.component.ts` como
> referencia.

## Superficies Activas (OBLIGATORIO)

- **`.surface-hero`** → banners, hero sections, headers de alta jerarquía. Aplica `var(--gradient-hero)`. El texto SIEMPRE en `var(--color-primary-text)` (blanco).
- **`.surface-glass`** → modales flotantes, overlays, panels glassmorphism. Usa backdrop-filter blur automático.

```html
<!-- Hero section con superficie de marca -->
<section class="bento-hero surface-hero rounded-xl">
  <h1>Dashboard</h1>
</section>

<!-- Panel flotante con glass -->
<div class="surface-glass rounded-lg p-4">
  <!-- contenido de overlay -->
</div>
```

## Indicadores de Actividad

- **`.indicator-live`** → dot verde pulsante para sistemas activos / conexiones en tiempo real
- **`.badge-pulse`** → pulso de atención en badges de conteo (nuevos items, alertas no leídas)

```html
<span class="indicator-live text-sm text-secondary">Sistema activo</span>
<span class="badge-pulse">
  <p-badge value="3" severity="danger" />
</span>
```

## Bento Grid

- Contenedor: `.bento-grid` + directiva `[appBentoGridLayout]`
- Hijos: `.bento-square`, `.bento-wide`, `.bento-tall`, `.bento-feature`, `.bento-hero`
- Solo **UN** `.card-accent` por sección bento
- SCSS canónico: `src/styles/layout/_bento-grid.scss`

## Cards

- `.card` — base con borde y padding estándar
- `.card-accent` — borde superior con `var(--ds-brand)` (1 por sección)
- `.card-tinted` — fondo primario diluido (para KPIs y highlights)

## Modo claro/oscuro

- Controlado por `ThemeService` con `[data-mode='dark']` en el documentElement
- `this.themeService.setColorMode('dark' | 'light' | 'system')`
- PrimeNG: usar `darkModeSelector: '.fake-dark-mode'` para evitar conflictos

## Personalización de marca por cliente (Multi-Brand)

Cuando un cliente requiere colores corporativos distintos al default, **no crees un tema paralelo ni dupliques tokens**. El sistema de 4 capas ya lo soporta:

### Cómo aplicar

Sobreescribir **solo Layer 3 (Brand)** en `_variables.scss`:

```scss
// Antes (default del Blueprint)
:root {
  --ds-brand: #0ea5e9;
  --color-primary-hover: #0284c7;
  --gradient-hero: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
}
[data-mode="dark"] {
  --ds-brand: #38bdf8;
  --color-primary-hover: #7dd3fc;
}

// Después (cliente "Acme Corp" con verde corporativo)
:root {
  --ds-brand: #16a34a;
  --color-primary-hover: #15803d;
  --gradient-hero: linear-gradient(135deg, #16a34a 0%, #059669 100%);
}
[data-mode="dark"] {
  --ds-brand: #4ade80;
  --color-primary-hover: #86efac;
}
```

### Reglas

- **SOLO** tocar Layer 3 (brand, gradientes, estados). Layers 1, 2 y 4 no cambian.
- El dark mode del brand **debe cumplir WCAG AA** (contraste ≥ 4.5:1 sobre `--bg-surface`). Verificar en [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/).
- Los component tokens (Layer 4) como `--btn-primary-bg: var(--ds-brand)` heredan automáticamente — no necesitan cambios.
- **NUNCA** crear selectores `[data-brand="x"]` ni CSS condicional por cliente. Un proyecto = una marca. Si necesitas multi-tenant runtime, eso es una feature distinta que requiere `ThemeService` extendido.

## Animaciones

- **PROHIBIDO** `@angular/animations` (redundante con CSS nativo y GSAP)
- **SIEMPRE** respetar `prefers-reduced-motion` en cualquier animación

### Sin GSAP (default — `blueprint.gsap: false`)
- Entradas de vistas: clases CSS `.animate-fade-in-up`, `.animate-fade-in`, `.animate-stagger` de `src/styles/_animations.scss`
- Navegación entre rutas: `withViewTransitions()` en `app.config.ts` + estilos en `src/styles/_view-transitions.scss`
- `@keyframes` permitido en cualquier archivo SCSS

### Con GSAP (`blueprint.gsap: true`, flag `--with-gsap`)
- **OBLIGATORIO** `GsapAnimationsService` en `ngAfterViewInit`
- Métodos clave: `animateBentoGrid()`, `animateHero()`, `animateCounter()`, `addCardHover()`
- Siempre `clearProps: 'transform'` tras animaciones de movimiento
- **PROHIBIDO** `@keyframes` en estilos de componente (`src/app/`). Solo en design system global (`src/styles/`)
- **PROHIBIDO** inventar `durations` o `eases` arbitrarios. Usa variables CSS (`--duration-*`, `--ease-*`)
