<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Componentes (Atomic Design)

> **Regla de Actualización (CRÍTICA - SINGLE SOURCE OF TRUTH):** El Agente DEBE usar sus herramientas de sistema (escritura de archivos) para agregar incondicionalmente todos los nuevos componentes creados a estas tablas. 
> Esta tabla es tu ÚNICA fuente de la verdad para conocer qué átomos y moléculas existen. Antes de crear un componente UI, verifica aquí si ya existe uno que resuelva el problema. Si ignoras mantener esta tabla actualizada, fallarás en la tarea gravemente por provocar duplicación de código e inconsistencia de UI.

## Átomos (Atoms)
*Elementos UI básicos e indivisibles (botones, inputs, badges).*

| Componente | API (inputs / outputs) | Descripción | Ubicación | Estado |
|------------|------------------------|-------------|-----------|--------|
| `skeleton-block` | `variant:('rect'\|'circle'\|'text')` `width?:string` `height?:string` | Bloque placeholder para estados de carga | `shared/components/skeleton-block/skeleton-block.component.ts` | ✅ Estable |
| `app-icon` | `name:string` (req, kebab-case) `size?:number` (def 16) `color?:string` `ariaHidden?:boolean` | Wrapper Lucide — SIEMPRE con `[attr.aria-label]` si es icono de acción | `shared/components/icon/icon.component.ts` | ✅ Estable |

## Moléculas (Molecules)
*Agrupación de átomos que forman una unidad funcional simple.*

| Componente | API (inputs / outputs) | Descripción | Ubicación | Estado |
|------------|------------------------|-------------|-----------|--------|
| `app-kpi-card` | `value:number` (req) `label:string` (req) `suffix?:string` `prefix?:string` `trend?:number` `trendLabel?:string` `accent?:boolean` `loading?:boolean` | KPI numérico con animación counter, badge de tendencia y skeleton interno (`loading`) | `shared/components/kpi-card/kpi-card.component.ts` | ✅ Estable |

## Moléculas — Feedback
*Comunicación de estados del sistema al usuario.*

| Componente | API (inputs / outputs) | Descripción | Ubicación | Estado |
|------------|------------------------|-------------|-----------|--------|
| `app-empty-state` | `message:string` (req) `subtitle?:string` `icon?:string` `actionLabel?:string` `actionIcon?:string` → `action:OutputEmitterRef<void>` | Estado vacío con acción opcional | `shared/components/empty-state/empty-state.component.ts` | ✅ Estable |
| `app-alert-card` | `title:string` (req) `severity?:('error'\|'warning'\|'info'\|'success')` `actionLabel?:string` `dismissible?:boolean` → `action:OutputEmitterRef<void>` `dismissed:OutputEmitterRef<void>` | Alerta contextual con acción y dismiss | `shared/components/alert-card/alert-card.component.ts` | ✅ Estable |

## Moléculas — Contenedores

| Componente | API (inputs / outputs) | Descripción | Ubicación | Estado |
|------------|------------------------|-------------|-----------|--------|
| `app-drawer` | `isOpen:boolean` (req) `title:string` (req) `icon?:string` `hasFooter?:boolean` → `closed:OutputEmitterRef<void>`. Body via `ng-content`, footer via `[drawer-footer]` | Panel lateral deslizante con proyección de contenido | `shared/components/drawer/drawer.component.ts` | ✅ Estable |

## Organismos (Organisms)
*Para tablas, formularios y modals usa PrimeNG — ver regla component-selection.md.*

| Componente | Tipo | Propósito | Ubicación | Estado |
|------------|------|-----------|-----------|--------|
| — | — | — | — | — |

## Layout (Shell)
*Componentes estructurales del shell — no son páginas enrutables.*

| Componente | Tipo | Propósito | Ubicación | Estado |
|------------|------|-----------|-----------|--------|
| `AppShellComponent` | Smart | Layout principal: sidebar + topbar + router-outlet | `layout/app-shell.component.ts` | ✅ Estable |
| `SidebarComponent` | Smart | Sidebar de navegación con pill hovers, theme toggle y avatar | `layout/sidebar.component.ts` | ✅ Estable |
| `TopbarComponent` | Smart | Barra superior con badge de notificaciones y menú de usuario | `layout/topbar.component.ts` | ✅ Estable |

## Páginas / Vistas (Pages)
*Smart components enrutables que consumen Facades.*

| Ruta / Componente | Facades | Ubicación | Estado |
|-------------------|---------|-----------|----|
| `/app/dashboard` — `DashboardComponent` | `AuthFacade`, `GsapAnimationsService` | `features/dashboard/dashboard.component.ts` | ✅ Estable (datos estáticos — conectar Facade) |
| `/login` — `LoginComponent` | `AuthService` | `features/auth/login.component.ts` | ✅ Estable |
| `/**` — `NotFoundComponent` | — | `features/not-found/not-found.component.ts` | ✅ Estable |

<!-- DETAIL:BEGIN -->
## Ejemplos de uso

### skeleton-block / app-icon

```html
<skeleton-block variant="rect" width="100%" height="120px" />
<skeleton-block variant="circle" width="48px" height="48px" />
<skeleton-block variant="text" width="60%" />

<app-icon name="trending-up" [size]="14" />
<app-icon name="users" [size]="24" style="color: var(--color-primary)" />
```

### app-kpi-card

```html
<!-- KPI monetario con tendencia positiva -->
<app-kpi-card
  [value]="84320"
  label="Ingresos del mes"
  prefix="$"
  [trend]="12.5"
  trendLabel="vs. mes anterior"
  [accent]="true"
/>

<!-- KPI porcentaje con tendencia negativa -->
<app-kpi-card
  [value]="4.7"
  label="Tasa de conversión"
  suffix="%"
  [trend]="-3.1"
  trendLabel="últimas 24 h"
/>

<!-- Skeleton mientras carga — interno, sin componente aparte -->
<app-kpi-card [value]="0" label="Ingresos" [loading]="true" />
```

### app-empty-state

```html
<app-empty-state message="No hay transacciones todavía." />

<app-empty-state
  icon="search"
  message="Sin resultados"
  subtitle="Intenta con otros términos de búsqueda."
  actionLabel="Limpiar filtros"
  actionIcon="x"
  (action)="resetFilters()"
/>

<app-empty-state
  icon="users"
  message="No tienes usuarios todavía"
  subtitle="Invita a tu equipo para empezar a colaborar."
  actionLabel="Invitar usuario"
  (action)="openInviteModal()"
/>
```

### app-alert-card

```html
<app-alert-card title="Actualización disponible">
  Se publicó la versión 2.1 con mejoras de rendimiento.
</app-alert-card>

<app-alert-card
  severity="error"
  title="No se pudo guardar"
  actionLabel="Reintentar"
  (action)="saveData()"
>
  Hubo un problema al conectarse con el servidor.
</app-alert-card>

<app-alert-card
  severity="success"
  title="Cambios guardados"
  [dismissible]="true"
  (dismissed)="showAlert.set(false)"
/>
```

### app-drawer

```html
<app-drawer
  [isOpen]="showDrawer()"
  title="Detalle del usuario"
  icon="user"
  [hasFooter]="true"
  (closed)="showDrawer.set(false)"
>
  <div class="flex flex-col gap-4">
    <p>Contenido del drawer...</p>
  </div>

  <div drawer-footer class="flex justify-end gap-2">
    <button class="btn-ghost" (click)="showDrawer.set(false)">Cancelar</button>
    <button class="btn-primary" (click)="save()">Guardar</button>
  </div>
</app-drawer>
```

## Auto-Index — Componentes detectados por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Selector | Inputs | Outputs | Archivo |
|----------|--------|---------|---------|
| `app-alert-card` | `severity`, `title`, `actionLabel`, `dismissible` | `action`, `dismissed` | `src/app/shared/components/alert-card/alert-card.component.ts` |
| `app-badge` | `variant` | — | `src/app/shared/components/badge/badge.component.ts` |
| `app-drawer` | `isOpen`, `title`, `icon`, `hasFooter` | `closed` | `src/app/shared/components/drawer/drawer.component.ts` |
| `app-empty-state` | `message`, `subtitle`, `icon`, `actionLabel`, `actionIcon` | `action` | `src/app/shared/components/empty-state/empty-state.component.ts` |
| `app-error-state` | `title`, `message`, `retryLabel` | `retry` | `src/app/shared/components/error-state/error-state.component.ts` |
| `app-icon` | `name`, `size`, `color`, `ariaHidden`, `ariaLabel` | — | `src/app/shared/components/icon/icon.component.ts` |
| `app-kpi-card` | `value`, `label`, `suffix`, `prefix`, `trend`, `trendLabel`, `accent`, `loading` | — | `src/app/shared/components/kpi-card/kpi-card.component.ts` |
| `app-section-hero` | `title`, `contextLine`, `subtitle`, `icon`, `chips`, `actions`, `backRoute`, `backLabel`, `animateOnInit`, `backClickable`, `density`, `kpis`, `loading`, `loadingKpiCount` | `actionClick`, `backClicked`, `kpiClick` | `src/app/shared/components/section-hero/section-hero.component.ts` |
| `app-skeleton-block` | `variant`, `width`, `height` | — | `src/app/shared/components/skeleton-block/skeleton-block.component.ts` |
| `app-tabs` | `tabs`, `activeId`, `variant`, `uppercase` | `activeIdChange` | `src/app/shared/components/tabs/tabs.component.ts` |

<!-- AUTO-GENERATED:END -->
