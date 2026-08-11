# Registro de Layout Blueprints

> **Regla de uso:** Antes de crear una feature page, consulta la tabla de arquetipos.
> Si el arquetipo aplica, usa el esqueleto HTML como punto de partida — no inventes estructura.
> Reglas de selección y restricciones: `.claude/rules/layout-blueprints.md`

## Quick Reference

| Arquetipo | Trigger | Hero | Grid | Componentes clave |
|-----------|---------|------|------|-------------------|
| `dashboard` | Inicio, overview, resumen | `.bento-hero.surface-hero` | `.bento-grid` | `app-kpi-card` (≥3), actividad `.bento-wide` |
| `list` | Índice de entidades | Ninguno (`.page-header` plano) | Columna simple | `p-table` + `app-empty-state` |
| `detail` | Ficha de 1 entidad | `.card.card-accent` | `grid-cols-3` (2+1) | `app-drawer`, `app-alert-card` |
| `form` | Crear / editar entidad | Ninguno (breadcrumb plano) | `.page-narrow` centrado | PrimeNG inputs, footer acciones |
| `auth` | Login / registro / reset | `.surface-hero` (50%) | `grid-cols-2` split | `app-alert-card` errores |
| `analytics` | Reportes / métricas | Strip KPIs (bento, sin hero-section) | `.bento-grid` + `grid-cols-2` | `app-kpi-card`, `p-table` drill-down |
| `settings` | Configuración / perfil | Ninguno (título plano) | `grid-cols-4` (nav 1+3) | Nav lateral, panels `.card` |
| `onboarding` | Primer uso / wizard / setup | `.surface-hero` fullwidth | `.page-narrow` centrado | `p-stepper` |

<!-- DETAIL:BEGIN -->

## Esqueletos HTML por arquetipo

---

### `dashboard`

```html
<div class="bento-grid" [appBentoGridLayout]>

  <!-- Hero de marca (ÚNICO .card-accent implícito de la vista) -->
  <section class="bento-hero surface-hero rounded-xl p-8 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold" style="color: var(--color-primary-text)">
        Bienvenido, {{ facade.userName() }}
      </h1>
      <span class="indicator-live text-sm mt-2" style="color: var(--color-primary-text)">
        Sistema activo
      </span>
    </div>
    <div class="flex flex-col items-end">
      <span class="kpi-label" style="color: var(--color-primary-text)">Métrica principal</span>
      <span class="kpi-value" style="color: var(--color-primary-text)">
        {{ facade.mainMetric() }}
      </span>
    </div>
  </section>

  <!-- KPI cards (mínimo 3) -->
  @for (kpi of facade.kpis(); track kpi.id) {
    <app-kpi-card
      class="bento-square"
      [value]="kpi.value"
      [label]="kpi.label"
      [trend]="kpi.trend"
      [suffix]="kpi.suffix"
    />
  } @empty {
    <app-kpi-card-skeleton class="bento-square" />
    <app-kpi-card-skeleton class="bento-square" />
    <app-kpi-card-skeleton class="bento-square" />
  }

  <!-- Actividad / tabla reciente -->
  <section class="bento-wide card rounded-xl p-6">
    <h2 class="text-lg font-semibold text-primary mb-4">Actividad reciente</h2>
    @if (facade.isLoading()) {
      <skeleton-block variant="rect" width="100%" height="200px" />
    } @else if (facade.items().length === 0) {
      <app-empty-state icon="inbox" message="Sin actividad reciente." />
    } @else {
      <!-- p-table o lista de items -->
    }
  </section>

</div>
```

---

### `list`

```html
<div class="flex flex-col gap-6">

  <!-- Page header (SIN surface-hero) -->
  <header class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-primary">Entidades</h1>
      <p class="text-sm text-muted mt-1">{{ facade.totalCount() }} registros</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="p-input-icon-left">
        <app-icon name="search" [size]="16" />
        <input pInputText placeholder="Buscar..." (input)="facade.setSearch($any($event.target).value)" />
      </span>
      <button class="btn-primary" (click)="openCreate()" data-llm-action="open-create">
        <app-icon name="plus" [size]="16" />
        Nueva entidad
      </button>
    </div>
  </header>

  <!-- Tabla -->
  <p-table
    [value]="facade.items()"
    [loading]="facade.isLoading()"
    [paginator]="true"
    [rows]="20"
    [showCurrentPageReport]="true"
    styleClass="p-datatable-sm"
  >
    <ng-template pTemplate="header">
      <tr>
        <th pSortableColumn="name">Nombre <p-sortIcon field="name" /></th>
        <th>Acciones</th>
      </tr>
    </ng-template>

    <ng-template pTemplate="body" let-item>
      <tr>
        <td>{{ item.name }}</td>
        <td>
          <button class="btn-ghost" (click)="openDetail(item)" data-llm-action="open-detail">
            <app-icon name="eye" [size]="16" />
          </button>
        </td>
      </tr>
    </ng-template>

    <ng-template pTemplate="emptymessage">
      <tr><td colspan="2">
        <app-empty-state
          icon="inbox"
          message="No hay registros todavía."
          actionLabel="Crear primero"
          (action)="openCreate()"
        />
      </td></tr>
    </ng-template>
  </p-table>

</div>
```

---

### `detail`

```html
<div class="flex flex-col gap-6">

  <!-- Header de entidad (.card-accent — ÚNICO de la vista) -->
  <div class="card card-accent flex items-center justify-between gap-4 p-6">
    @if (facade.isLoading()) {
      <skeleton-block variant="text" width="200px" />
    } @else {
      <div class="flex items-center gap-3">
        <app-icon name="user" [size]="24" style="color: var(--ds-brand)" />
        <div>
          <h1 class="text-xl font-semibold text-primary">{{ facade.entity()?.name }}</h1>
          <span class="text-sm text-muted">{{ facade.entity()?.email }}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary" (click)="showEditDrawer.set(true)" data-llm-action="open-edit-drawer">
          <app-icon name="edit-2" [size]="16" />
          Editar
        </button>
        <button class="btn-ghost" (click)="confirmDelete()">
          <app-icon name="trash-2" [size]="16" />
        </button>
      </div>
    }
  </div>

  <!-- Alert contextual (solo si hay advertencia de estado) -->
  @if (facade.hasAlert()) {
    <app-alert-card [severity]="facade.alertSeverity()" [title]="facade.alertTitle()">
      {{ facade.alertMessage() }}
    </app-alert-card>
  }

  <!-- Grid 2+1 columnas -->
  <div class="grid grid-cols-3 gap-6">
    <div class="col-span-2 flex flex-col gap-4">
      <section class="card p-6">
        <h2 class="text-base font-semibold text-primary mb-4">Información general</h2>
        <!-- campos de detalle -->
      </section>
    </div>
    <aside class="flex flex-col gap-4">
      <section class="card p-4">
        <h3 class="text-sm font-semibold text-secondary mb-3">Estado</h3>
        <!-- chips, fechas, meta -->
      </section>
    </aside>
  </div>

  <!-- Drawer de edición (preferido sobre /edit route) -->
  <app-drawer
    [isOpen]="showEditDrawer()"
    title="Editar entidad"
    icon="edit-2"
    [hasFooter]="true"
    (closed)="showEditDrawer.set(false)"
  >
    <!-- form fields via ng-content -->
    <div drawer-footer class="flex justify-end gap-2">
      <button class="btn-ghost" (click)="showEditDrawer.set(false)">Cancelar</button>
      <button class="btn-primary" (click)="save()">Guardar</button>
    </div>
  </app-drawer>

</div>
```

---

### `form`

```html
<div class="page-narrow flex flex-col gap-6">

  <!-- Breadcrumb / nav back (sin hero visual) -->
  <nav class="flex items-center gap-2 text-sm text-muted">
    <button class="btn-ghost" routerLink="/entidades">
      <app-icon name="arrow-left" [size]="16" />
      Volver
    </button>
  </nav>

  <h1 class="text-xl font-semibold text-primary">Crear entidad</h1>

  @if (facade.saveError()) {
    <app-alert-card severity="error" title="No se pudo guardar">
      {{ facade.saveError() }}
    </app-alert-card>
  }

  <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
    <div class="card p-6 flex flex-col gap-4">
      <h2 class="text-base font-semibold text-primary">Información básica</h2>
      <p-floatLabel>
        <input pInputText id="name" formControlName="name" data-llm-description="nombre de la entidad" />
        <label for="name">Nombre</label>
      </p-floatLabel>
      <!-- más campos PrimeNG -->
    </div>

    <div class="flex justify-end gap-3 pb-6">
      <button type="button" class="btn-ghost" routerLink="/entidades">Cancelar</button>
      <p-button
        type="submit"
        label="Guardar"
        [loading]="facade.isSaving()"
        styleClass="btn-primary"
        data-llm-action="submit-form"
      />
    </div>
  </form>

</div>
```

---

### `auth`

```html
<!-- Split 50/50. Para forgot/reset: usar variante centrada sin hero lateral -->
<div class="min-h-screen grid grid-cols-2">

  <!-- Hero lateral de marca -->
  <div class="surface-hero flex flex-col items-center justify-center p-12 gap-6">
    <app-icon name="layers" [size]="48" style="color: var(--color-primary-text)" />
    <h1 class="text-3xl font-bold" style="color: var(--color-primary-text)">Mi App</h1>
    <p class="text-center opacity-80 max-w-xs" style="color: var(--color-primary-text)">
      Tagline de la aplicación.
    </p>
  </div>

  <!-- Panel del formulario -->
  <div class="flex items-center justify-center p-12 bg-base">
    <div class="card p-8 w-full max-w-sm flex flex-col gap-6">

      <div>
        <h2 class="text-xl font-semibold text-primary">Iniciar sesión</h2>
        <p class="text-sm text-muted mt-1">Ingresa tus credenciales</p>
      </div>

      @if (authService.error()) {
        <app-alert-card severity="error" title="Error de autenticación">
          {{ authService.error() }}
        </app-alert-card>
      }

      <form [formGroup]="form" (ngSubmit)="login()" class="flex flex-col gap-4">
        <p-floatLabel>
          <input pInputText id="email" formControlName="email" type="email" />
          <label for="email">Email</label>
        </p-floatLabel>
        <p-floatLabel>
          <input pInputText id="password" formControlName="password" type="password" />
          <label for="password">Contraseña</label>
        </p-floatLabel>
        <p-button type="submit" label="Ingresar" [loading]="authService.isLoading()" styleClass="btn-primary w-full" />
      </form>

      <p class="text-sm text-center text-muted">
        ¿No tienes cuenta?
        <a routerLink="/registro" class="text-primary underline">Regístrate</a>
      </p>

    </div>
  </div>

</div>
```

---

### `analytics`

```html
<div class="flex flex-col gap-6">

  <!-- Header con filtro de fechas -->
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-primary">Analíticas</h1>
    <p-calendar
      [(ngModel)]="dateRange"
      selectionMode="range"
      [readonlyInput]="true"
      placeholder="Rango de fechas"
      (onSelect)="facade.setDateRange(dateRange)"
    />
  </header>

  <!-- Strip de KPIs (SIN surface-hero) -->
  <div class="bento-grid" [appBentoGridLayout]>
    @for (kpi of facade.kpis(); track kpi.id) {
      <app-kpi-card class="bento-square" [value]="kpi.value" [label]="kpi.label" [trend]="kpi.trend" />
    } @empty {
      <app-kpi-card-skeleton class="bento-square" />
      <app-kpi-card-skeleton class="bento-square" />
      <app-kpi-card-skeleton class="bento-square" />
    }
  </div>

  <!-- Charts 2 columnas -->
  <div class="grid grid-cols-2 gap-6">
    <section class="card p-6">
      <h2 class="text-base font-semibold text-primary mb-4">Evolución mensual</h2>
      <!-- chart component local de features/X/components/ -->
    </section>
    <section class="card p-6">
      <h2 class="text-base font-semibold text-primary mb-4">Distribución</h2>
      <!-- chart component local -->
    </section>
  </div>

  <!-- Tabla drill-down -->
  <section class="card p-6">
    <h2 class="text-base font-semibold text-primary mb-4">Detalle</h2>
    <p-table [value]="facade.tableData()" [paginator]="true" [rows]="15">
      <!-- columnas -->
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="99">
          <app-empty-state icon="bar-chart-2" message="Sin datos para el período seleccionado." />
        </td></tr>
      </ng-template>
    </p-table>
  </section>

</div>
```

---

### `settings`

```html
<div class="flex flex-col gap-6">

  <h1 class="text-xl font-semibold text-primary">Configuración</h1>

  <div class="grid grid-cols-4 gap-6">

    <!-- Nav lateral -->
    <nav class="col-span-1 flex flex-col gap-1">
      @for (section of sections; track section.id) {
        <button
          class="btn-ghost w-full text-left"
          [class.active]="activeSection() === section.id"
          (click)="activeSection.set(section.id)"
        >
          <app-icon [name]="section.icon" [size]="16" />
          {{ section.label }}
        </button>
      }
    </nav>

    <!-- Panel activo -->
    <div class="col-span-3 flex flex-col gap-4">
      @switch (activeSection()) {
        @case ('perfil') {
          <section class="card p-6 flex flex-col gap-4">
            <h2 class="text-base font-semibold text-primary">Perfil</h2>
            <!-- campos de perfil -->
            <div class="flex justify-end">
              <button class="btn-primary" (click)="savePerfil()">Guardar cambios</button>
            </div>
          </section>
        }
        @case ('seguridad') {
          <!-- panel seguridad -->
        }
        @default {
          <app-empty-state icon="settings" message="Selecciona una sección." />
        }
      }
    </div>

  </div>

</div>
```

---

### `onboarding`

```html
<div class="flex flex-col min-h-screen">

  <!-- Hero fullwidth de bienvenida -->
  <header class="surface-hero p-12 text-center flex flex-col items-center gap-4">
    <app-icon name="rocket" [size]="48" style="color: var(--color-primary-text)" />
    <h1 class="text-3xl font-bold" style="color: var(--color-primary-text)">
      Configura tu cuenta
    </h1>
    <p class="opacity-80" style="color: var(--color-primary-text)">
      Solo {{ totalSteps }} pasos para empezar.
    </p>
  </header>

  <!-- Wizard de pasos -->
  <main class="page-narrow py-12">
    <p-stepper [(activeStep)]="activeStep">

      <p-stepperPanel header="Tu negocio">
        <ng-template pTemplate="content" let-nextCallback="nextCallback">
          <div class="flex flex-col gap-4">
            <!-- campos paso 1 -->
            <div class="flex justify-end">
              <button class="btn-primary" (click)="nextCallback.emit()">
                Siguiente
                <app-icon name="arrow-right" [size]="16" />
              </button>
            </div>
          </div>
        </ng-template>
      </p-stepperPanel>

      <p-stepperPanel header="Tu equipo">
        <!-- paso 2 -->
      </p-stepperPanel>

      <p-stepperPanel header="Listo">
        <ng-template pTemplate="content">
          <div class="text-center flex flex-col items-center gap-6 py-8">
            <app-icon name="check-circle" [size]="64" style="color: var(--ds-brand)" />
            <h2 class="text-2xl font-semibold text-primary">Todo listo</h2>
            <button class="btn-primary" routerLink="/app/dashboard">
              Ir al dashboard
              <app-icon name="arrow-right" [size]="16" />
            </button>
          </div>
        </ng-template>
      </p-stepperPanel>

    </p-stepper>
  </main>

</div>
```
