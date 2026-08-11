<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Estilos & Design System

> **Regla de Actualización:** El Agente debe consultar esta tabla ANTES de crear estilos nuevos. Si ya existe una clase o token que resuelve la necesidad, **reutilizar**. Añadir a esta tabla cada vez que se cree un archivo de estilos nuevo.

## Design Tokens

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_variables.scss` | Tokens del Design System (4 capas): escala (colores, espaciado, radios, tipografía, motion), semántica (superficies, texto, bordes, sombras, estados), marca (brand, gradientes, acciones), componentes (btn, input, card, motion). Light + Dark mode. | `styles/tokens/_variables.scss` | ✅ Estable |

## Utilities (Tailwind v4)

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `tailwind.css` | Capa de utilidades Tailwind v4. Mapea tokens del design system vía `@theme` para clases como `text-text-secondary`, `bg-surface`, `rounded-lg`. Incluye `@utility btn-primary`, `@utility btn-secondary` y `@utility btn-ghost` (3 tiers de botones del DS). No usa Preflight (PrimeNG tiene su propio reset). | `src/tailwind.css` | ✅ Estable |
| `postcss.config.json` | Configuración PostCSS para Tailwind v4. **Tiene que ser `.json`**: el builder `@angular/build:application` ignora `.js`/`.mjs`/`.cjs` y Tailwind queda sin procesar sin ningún error visible. | `postcss.config.json` (root) | ✅ Estable |

## Layout

| Archivo | Clases principales | Ubicación | README | Estado |
|---------|-------------------|-----------|--------|--------|
| `_bento-grid.scss` | Proporciones: `.bento-grid`, `.bento-square`, `.bento-wide`, `.bento-tall`, `.bento-feature`, `.bento-hero`, `.bento-banner`, `.bento-card`, `.bento-media` + data-attributes de placement. **App-like**: `.bento-grid--fill-screen`, `--fill-screen-2`, `--fill-screen-kpi`, `--hero-fit`, `--rows-fit` y `.bento-fill`. Responde a `@container layoutmain`, **no** a `@media`. | `styles/layout/_bento-grid.scss` | `_bento-grid.README.md` | ✅ Estable |
| `_page-shell.scss` | `.page-centered`, `.page-narrow`, `.page-content`, `.page-wide`, `.page-split`, `.page-header`, `.page-section`, `.page-empty` + buffer de `@media (display-mode: fullscreen)` para F11/PWA. | `styles/layout/_page-shell.scss` | `_page-shell.README.md` | ✅ Estable |

## Motion

| Archivo | Responsabilidad | Ubicación | README | Estado |
|---------|----------------|-----------|--------|--------|
| `_view-transitions.scss` | View Transitions API: navegación (page-out/in asimétrico) + theme switch (reveal circular desde el clic). Requiere `view-transition-name: main-content` en el `<main>` del app-shell. | `styles/motion/_view-transitions.scss` | `_view-transitions.README.md` | ✅ Estable |
| `_animations.scss` | Fallback CSS puro sin JS: `.animate-fade-in-up`, `.animate-fade-in`, `.animate-stagger`. Es global (no estilo de componente), así que sus `@keyframes` están exentos de ARCH-07. | `styles/_animations.scss` | — | ✅ Estable |

## Vendors

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_primeng-overrides.scss` | Mapeo de tokens PrimeNG al Design System: toast, button, avatar, badge, table, stepper, datepicker, select, skeleton, breadcrumb, menu y fixes de dark mode. Cero colores hardcodeados; todo vía `var(--*)`. | `styles/vendors/_primeng-overrides.scss` | ✅ Estable |

## Vocabulario de clases semánticas (`_variables.scss`)

> Estas clases existen para que nadie recomponga el mismo cluster de utilities a mano.
> El linter las enforza: ARCH-19 detecta clusters ad-hoc y ARCH-15 pills ad-hoc.

| Clase | Qué es | Reemplaza a |
|---|---|---|
| `.kpi-value` | Número KPI principal | `text-4xl font-bold` |
| `.micro-label` | Micro-label uppercase (label de KPI, cabecera de grupo, título de columna) | `text-xs uppercase tracking-* text-text-muted` |
| `.item-title` | Título de fila / card / ítem de lista | `text-sm font-semibold text-text-primary` |
| `.section-eyebrow` | Línea de contexto legible antes de un título (sin uppercase) | `text-sm text-text-secondary` |
| `.badge-count` | Badge numérico superpuesto (notificaciones) | `rounded-full + text-[10px] + px-1` a mano |
| `.surface-hero` / `.surface-glass` | Jerarquía de superficies | — |
| `.indicator-live` / `.badge-pulse` | Indicadores de actividad | — |

> `.kpi-label` es alias **deprecado** de `.micro-label`. Sigue funcionando; no usar en código nuevo.
>
> ⚠️ Al crear una clase del DS, no le pongas el nombre de una utilidad "pelada" de Tailwind
> (`.truncate`, `.overline`, …): Tailwind genera su propia regla homónima en `@layer utilities`
> que **se suma** a la tuya en vez de reemplazarla. ARCH-22 lo bloquea.

## Cómo elegir una celda bento

> El sistema bento está **congelado por allowlist** (ARCH-21): agregar una clase
> `.bento-*` a `_bento-grid.scss` sin sumarla a `scripts/lib/bento-classes.allowlist.json`
> hace fallar `npm run lint:arch`. El freno existe porque este grid tiende a crecer por
> acumulación: cada pantalla suma "una clasecita más" hasta que hay treinta y ninguna se
> puede borrar sin miedo.

**El bento describe FORMAS, no contenidos.** Si el nombre que se te ocurre alude a la
sección de la app que lo usa (`bento-facturas`, `bento-actividad-lg`), es señal de que
la necesidad se resuelve con lo que ya hay.

Árbol de decisión, en orden:

1. **¿Alguna proporción existente sirve?** → `.bento-square` (1×1), `.bento-wide` (2:1),
   `.bento-tall` (1×2), `.bento-feature` (protagonista), `.bento-hero` (full-width),
   `.bento-banner` (full-width, 1 fila).
2. **¿Necesitás una medida puntual?** → data-attributes de placement:
   `data-col-span`, `data-row-span`, `data-col-start`. No requieren clase nueva.
   Ej. dos paneles 50/50 a la misma altura: `data-col-span="6"` en cada celda.
3. **¿Es un comportamiento del grid entero?** → modificador en el contenedor:
   `--four-equal`, `--hero-fit`, `--rows-fit`, `--wizard`, o los `--fill-screen*` del
   patrón App-like.
4. **Solo si nada de lo anterior alcanza** → clase nueva + entrada en el allowlist con
   una línea explicando por qué no bastaba.

> ⚠️ Dentro de un grid `--fill-screen*` el paso 1 se recorta: `.bento-tall`, `.bento-feature`
> y `.bento-hero` ocupan **2 filas** y desbordan el `grid-template-rows` explícito, así que
> las celdas terminan superpuestas sin que el navegador avise. Ahí toda celda hija va en
> `.bento-banner` (1 fila) y lo que necesite subdividirse se anida adentro. ARCH-23 lo caza.

## Estilos Globales (`styles.scss`)

| Concepto | Clases/Selectores | Propósito |
|----------|-------------------|-----------|
| Scroll locks | `body.layout-drawer-open`, `body.modal-open` | Bloqueo de scroll en drawer mobile y modales |
| Modal overlay | `.modal-overlay__wrapper` | Posicionamiento fijo del overlay de modales (z-index > topbar) |

<!-- DETAIL:BEGIN -->
## Reglas de Uso

1. **Layouts de página**: usar `.page-centered`, `.page-narrow`, `.page-wide`, etc. — NO crear max-width ad-hoc
2. **Grids de dashboard**: usar `.bento-grid` con clases de proporción — NO crear grids custom
3. **Colores y espaciado**: usar tokens `var(--*)` de `_variables.scss` — NUNCA valores hex/px directos
4. **Componentes PrimeNG**: los overrides ya están en `_primeng-overrides.scss` — NO sobrescribir en componentes individuales
5. **Animaciones de página**: usar View Transitions API (`_view-transitions.scss`) — NO crear transiciones de ruta custom
6. **Tipografía**: usar el vocabulario de clases semánticas — NO recomponer clusters de utilities
7. **Tamaños de fuente**: usar la escala (`--text-2xs` … `--text-5xl`) — NUNCA `text-[NNpx]` arbitrario (ARCH-17)
8. **Breakpoints del bento**: el grid escucha a `@container layoutmain`, no al viewport. El `<main>` DEBE declarar `container-type: inline-size; container-name: layoutmain` o el grid colapsa a 1 columna

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
## Tokens canónicos — top 25 por frecuencia de uso real

| Token | Usos | Valor |
|-------|------|-------|
| `--text-muted` | 24 | `#71717a` |
| `--border-subtle` | 19 | `rgba(255, 255, 255, 0.04)` |
| `--color-primary-text` | 16 | `#ffffff` |
| `--text-secondary` | 14 | `#a1a1aa` |
| `--transition-color` | 11 | `—` |
| `--bg-subtle` | 11 | `#2d2d30` |
| `--color-primary` | 10 | `#38bdf8` |
| `--text-primary` | 10 | `#f4f4f5` |
| `--bg-elevated` | 9 | `#27272a` |
| `--state-success` | 9 | `#4ade80` |
| `--state-error` | 8 | `#f87171` |
| `--ds-brand` | 7 | `#38bdf8` |
| `--bg-surface` | 7 | `#18181b` |
| `--input-radius` | 6 | `var(--radius-md)` |
| `--input-border-default` | 6 | `var(--border-default)` |
| `--input-bg` | 6 | `var(--bg-subtle)` |
| `--input-padding-x` | 6 | `var(--space-4)` |
| `--input-padding-y` | 6 | `var(--space-3)` |
| `--input-text` | 6 | `var(--text-primary)` |
| `--transition-input` | 6 | `—` |
| `--input-placeholder` | 6 | `var(--text-muted)` |
| `--input-border-focus` | 6 | `var(--color-primary)` |
| `--input-shadow-focus-neutral` | 6 | `var(--shadow-focus)` |
| `--state-success-bg` | 5 | `rgba(74, 222, 128, 0.1)` |
| `--state-warning` | 5 | `#fbbf24` |

## Clases semánticas del Design System

| Clase | Usos en templates | Archivo |
|-------|------------------|---------|
| `.micro-label` | 8 | `src/styles/tokens/_variables.scss` |
| `.card` | 7 | `src/styles/tokens/_variables.scss` |
| `.surface-hero` | 6 | `src/styles/tokens/_variables.scss` |
| `.item-title` | 4 | `src/styles/tokens/_variables.scss` |
| `.kpi-value` | 3 | `src/styles/tokens/_variables.scss` |
| `.indicator-live` | 3 | `src/styles/tokens/_variables.scss` |
| `.card-accent` | 2 | `src/styles/tokens/_variables.scss` |
| `.micro-label--warning` | 1 | `src/styles/tokens/_variables.scss` |
| `.badge-count` | 1 | `src/styles/tokens/_variables.scss` |
| `.section-eyebrow` | 1 | `src/styles/tokens/_variables.scss` |
| `.card-tinted` | 1 | `src/styles/tokens/_variables.scss` |
| `.micro-label--error` | — | `src/styles/tokens/_variables.scss` |
| `.micro-label--success` | — | `src/styles/tokens/_variables.scss` |
| `.kpi-label` | — | `src/styles/tokens/_variables.scss` |
| `.surface-glass` | — | `src/styles/tokens/_variables.scss` |
| `.badge-pulse` | — | `src/styles/tokens/_variables.scss` |

## Bento Grid — Clases de celda disponibles

| Clase CSS | Proporción |
|-----------|-----------|
| `.bento-1x1` | ⚠️ Legacy — usar `.bento-square` |
| `.bento-2x1` | ⚠️ Legacy — usar `.bento-wide` |
| `.bento-2x2` | ⚠️ Legacy — usar `.bento-tall` |
| `.bento-3x1` | ⚠️ Legacy — usar `.bento-wide` |
| `.bento-3x2` | ⚠️ Legacy — usar `.bento-feature` |
| `.bento-4x1` | ⚠️ Legacy — usar `.bento-wide` |
| `.bento-banner` | 100% ancho — para tablas y listados |
| `.bento-card` | Alias visual de celda con card |
| `.bento-card--flush` | — |
| `.bento-card__body` | — |
| `.bento-card__body--bottom` | — |
| `.bento-card__body--center` | — |
| `.bento-card__body--spread` | — |
| `.bento-feature` | 2/3 ancho × 2 filas |
| `.bento-fill` | — |
| `.bento-grid` | Contenedor raíz (con [appBentoGridLayout]) |
| `.bento-grid--fill-screen` | — |
| `.bento-grid--fill-screen-2` | — |
| `.bento-grid--fill-screen-kpi` | — |
| `.bento-grid--four-equal` | — |
| `.bento-grid--hero-fit` | — |
| `.bento-grid--rows-fit` | — |
| `.bento-grid--wizard` | — |
| `.bento-hero` | 100% ancho — para app-section-hero |
| `.bento-media` | Celda de media (imagen/video) |
| `.bento-media--center` | — |
| `.bento-media--left` | — |
| `.bento-media--top` | — |
| `.bento-square` | 1/3 ancho (cuadrado) |
| `.bento-tall` | 1/3 ancho × 2 filas |
| `.bento-wide` | 2/3 ancho |

## PrimeNG — Componentes con override en _primeng-overrides.scss

| Componente | Selectores |
|-----------|-----------|
| **badge** | `.p-badge` |
| **breadcrumb** | `.p-breadcrumb` · `.p-breadcrumb-chevron` · `.p-breadcrumb-home` · `.p-breadcrumb-separator` |
| **button** | `.p-button` · `.p-button-danger` · `.p-button-outlined` · `.p-button-primary` · `.p-button-secondary` +1 |
| **card** | `.p-card` |
| **checkbox** | `.p-checkbox-box` |
| **datatable** | `.p-datatable` · `.p-datatable-header` · `.p-datatable-sm` · `.p-datatable-table` · `.p-datatable-table-wrapper` +3 |
| **datepicker** | `.p-datepicker` · `.p-datepicker-dropdown` · `.p-datepicker-panel` |
| **dialog** | `.p-dialog` · `.p-dialog-content` · `.p-dialog-header` · `.p-dialog-mask` |
| **highlight** | `.p-highlight` |
| **ink** | `.p-ink` |
| **inputtext** | `.p-inputtext` |
| **inputwrapper** | `.p-inputwrapper` |
| **menu** | `.p-menu` · `.p-menu-list` |
| **menuitem** | `.p-menuitem-badge` · `.p-menuitem-link` · `.p-menuitem-text` |
| **multiselect** | `.p-multiselect-panel` |
| **overlay** | `.p-overlay-mask` |
| **select** | `.p-select` · `.p-select-label` · `.p-select-list` · `.p-select-option` · `.p-select-option-focus` +3 |
| **skeleton** | `.p-skeleton` |
| **sortable** | `.p-sortable-column` |
| **step** | `.p-step` · `.p-step-header` · `.p-step-number` · `.p-step-title` |
| **steplist** | `.p-steplist` |
| **steppanel** | `.p-steppanel` · `.p-steppanel-content` |
| **steppanels** | `.p-steppanels` |
| **stepper** | `.p-stepper` · `.p-stepper-nav` · `.p-stepper-panels` · `.p-stepper-separator` |
| **toast** | `.p-toast` · `.p-toast-close-button` · `.p-toast-close-icon` · `.p-toast-message` · `.p-toast-message-content` +9 |
| **togglebutton** | `.p-togglebutton` · `.p-togglebutton-checked` |
| **toggleswitch** | `.p-toggleswitch` · `.p-toggleswitch-checked` |

## Tipografía — drift de utilidades

> Conteo crudo de utilidades de tipografía en templates. **No es deuda directa:** el peso de fuente (`font-bold/semibold`) es legítimo en botones, headers y títulos, y no tiene una clase semántica que lo reemplace. La señal accionable son los _clusters repetidos_ (abajo).

| Categoría | Usos | Interpretación |
|-----------|------|----------------|
| Tamaño display (`text-4xl/3xl/2xl`) | 7 | Candidatas a `.kpi-value` o heading semántico |
| Peso de fuente (`font-bold/semibold`) | 22 | Informativo — legítimo en botones/headers/títulos |


<!-- AUTO-GENERATED:END -->
