import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
// El plugin de Vite vive en @analogjs/vite-plugin-angular.
// @analogjs/vitest-angular es el BUILDER de `ng test` y no exporta plugin:
// importarlo acá rompe la resolución del módulo.
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  // Espejo de los path aliases de tsconfig.json. Sin esto, cualquier spec que
  // importe '@core/...' falla a resolver bajo Vitest.
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/app/core'),
      '@shared': resolve(__dirname, 'src/app/shared'),
      '@features': resolve(__dirname, 'src/app/features'),
      '@layout': resolve(__dirname, 'src/app/layout'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test-setup.ts', '**/*.spec.ts', '**/*.skeleton.*'],
    },
  },
});
