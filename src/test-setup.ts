import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Zoneless, igual que la app: `ng new` no instala el polyfill de zone.js desde
// Angular 20 y el boilerplate no provee `provideZoneChangeDetection()`.
//
// Importar '@analogjs/vitest-angular/setup-zone' acá parchearía el `Promise`
// global a ZoneAwarePromise, y cualquier `expect(x).toBeInstanceOf(Promise)`
// empezaría a fallar aunque el código sea correcto.
setupTestBed({ zoneless: true });

// jsdom no implementa matchMedia. GSAP (ScrollTrigger) y ThemeService lo llaman
// al inicializarse, así que sin este stub cualquier spec que monte un componente
// con directivas GSAP revienta con "_win.matchMedia is not a function".
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}
