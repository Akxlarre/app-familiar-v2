/**
 * Pruebas de NAV-01.
 *
 *   node --test scripts/lib/nav-integrity.test.mjs
 *
 * Lo que se prueba es que la regla **detecte** una entrada de menú muerta, no
 * que el menú de hoy pase. Un linter que no puede fallar no sirve de nada.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extraerDestinosDelMenu,
  extraerRutasDeclaradas,
  findDestinosHuerfanos,
} from './nav-integrity.js';

const RUTAS = `
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./x'),
  },
  {
    path: 'app',
    children: [
      { path: '', redirectTo: 'hoy', pathMatch: 'full' },
      {
        path: 'hoy',
        loadComponent: () => import('./y'),
      },
      {
        path: 'bandeja',
        loadComponent: () => import('./z'),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./nf'),
  },
];
`;

test('lee las rutas anidadas como paths absolutos', () => {
  const rutas = extraerRutasDeclaradas(RUTAS);
  assert.ok(rutas.includes('/login'));
  assert.ok(rutas.includes('/app'));
  assert.ok(rutas.includes('/app/hoy'));
  assert.ok(rutas.includes('/app/bandeja'));
});

test('lee los routerLink del menú', () => {
  const menu = `
    { label: 'Hoy', icon: 'home', routerLink: '/app/hoy' },
    { label: 'Ajustes', icon: 'settings', routerLink: '/app/settings' },
  `;
  assert.deepEqual(extraerDestinosDelMenu(menu), ['/app/hoy', '/app/settings']);
});

test('detecta la entrada de menú sin ruta — el bug real del repo', () => {
  // `/app/settings` estuvo en el menú desde el día uno sin existir en las rutas.
  const menu = `
    { routerLink: '/app/hoy' },
    { routerLink: '/app/settings' },
  `;
  assert.deepEqual(findDestinosHuerfanos(RUTAS, menu), ['/app/settings']);
});

test('un menú que sólo apunta a rutas declaradas no reporta nada', () => {
  const menu = `
    { routerLink: '/app/hoy' },
    { routerLink: '/app/bandeja' },
  `;
  assert.deepEqual(findDestinosHuerfanos(RUTAS, menu), []);
});

test('la ruta comodín no respalda a nadie', () => {
  // Si `**` contara, cualquier enlace pasaría — que es el fallo que la regla busca.
  const menu = `{ routerLink: '/inventado' }`;
  assert.deepEqual(findDestinosHuerfanos(RUTAS, menu), ['/inventado']);
});

test('una ruta declarada dentro de un ternario también cuenta', () => {
  // La ruta `/_ds` de la spec 0002 vive en `...(prod ? [] : [ ... ])`.
  const rutas = `
export const routes: Routes = [
  ...(environment.production ? [] : [
    {
      path: '_ds',
      children: [
        { path: '', loadComponent: () => import('./ds') },
      ],
    },
  ]),
];
`;
  assert.ok(extraerRutasDeclaradas(rutas).includes('/_ds'));
  assert.deepEqual(findDestinosHuerfanos(rutas, `{ routerLink: '/_ds' }`), []);
});

test('un menú vacío no reporta nada', () => {
  assert.deepEqual(findDestinosHuerfanos(RUTAS, 'sin enlaces'), []);
});

test('una ruta de ejemplo en un comentario no cuenta como declarada', () => {
  // El docblock de `app.routes.ts` documenta `{ path: 'admin', … }`. Si contara,
  // un enlace muerto a /admin pasaría la regla.
  const rutas = `
/**
 * Seguridad por rol:
 *   { path: 'admin', canActivate: [roleGuard('admin')], loadComponent: ... }
 */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./x') },
];
`;
  assert.ok(!extraerRutasDeclaradas(rutas).includes('/admin'));
  assert.deepEqual(findDestinosHuerfanos(rutas, `{ routerLink: '/admin' }`), ['/admin']);
});
