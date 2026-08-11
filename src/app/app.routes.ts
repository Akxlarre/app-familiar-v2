import { Routes } from '@angular/router';
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

  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

