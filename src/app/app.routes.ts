import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { authGuard } from '@core/guards/auth.guard';
import { guestGuard } from '@core/guards/guest.guard';
// import { roleGuard } from '@core/guards/role.guard'; // ← usar para rutas por rol

/**
 * Rutas de la aplicación.
 *
 * Estructura sugerida:
 *   /           → rutas públicas (login, register, reset-password)
 *   /app        → rutas protegidas envueltas en AppShellComponent (sidebar + topbar)
 *   /app/**     → features cargadas con lazy loading
 *
 * Seguridad por rol (usar roleGuard para rutas de admin):
 *   { path: 'admin', canActivate: [roleGuard('admin')], loadComponent: ... }
 *
 * IMPORTANTE: roleGuard es defensa en el cliente. La defensa real son las
 * políticas RLS en Supabase (ver supabase/migrations/..._rls_role_protection.sql).
 */
export const routes: Routes = [
  // Rutas públicas — autenticación
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // Rutas protegidas — envueltas en el layout AppShell
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      // Ruta por defecto → dashboard
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'bandeja',
        title: 'Bandeja',
        loadComponent: () =>
          import('./features/bandeja/bandeja.component').then((m) => m.BandejaComponent),
      },
      // TODO: Añade tus feature routes aquí
    ],
  },

  // Referencia viva del contrato de UI (spec 0002). Va con el shell —hace falta
  // para demostrar que el drawer EMPUJA el contenido— pero **sin authGuard**: una
  // referencia de diseño que exige credenciales de producción para mirarse es una
  // referencia que nadie mira, y la que se queda sin verificar en navegador.
  //
  // Sólo existe en dev. En producción el array queda vacío y la ruta no existe.
  ...(environment.production
    ? []
    : [
        {
          path: '_ds',
          title: 'Referencia del design system',
          loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
          children: [
            {
              path: '',
              loadComponent: () =>
                import('./features/_ds/ds-reference.component').then((m) => m.DsReferenceComponent),
            },
          ],
        },
      ]),

  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

