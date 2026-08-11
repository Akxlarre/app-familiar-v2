/**
 * Pruebas de la allowlist de CORS.
 *
 * `Access-Control-Allow-Origin: *` es el default cómodo y el que teníamos: con
 * él, cualquier página abierta en el navegador de un usuario logueado puede
 * invocar las funciones. Para una app privada de una familia (R-06) eso sobra.
 *
 *   node --test supabase/functions/_shared/http.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * `origenPermitido` lee `Deno.env`, que no existe en Node. Se replica acá la
 * misma lógica sobre una allowlist explícita: lo que se prueba es la REGLA de
 * comparación, que es donde estaría el error.
 */
function origenPermitido(origen: string | null | undefined, allowlist: string[]): boolean {
  if (!origen) return false;
  const limpio = origen.trim();
  if (!limpio) return false;
  return allowlist.map((o) => o.trim()).filter(Boolean).includes(limpio);
}

const ALLOWLIST = ['https://familiar.app', 'http://localhost:4200'];

test('acepta un origen de la lista', () => {
  assert.equal(origenPermitido('https://familiar.app', ALLOWLIST), true);
  assert.equal(origenPermitido('http://localhost:4200', ALLOWLIST), true);
});

test('rechaza un origen ajeno', () => {
  assert.equal(origenPermitido('https://sitio-malicioso.cl', ALLOWLIST), false);
});

test('rechaza sin origen', () => {
  assert.equal(origenPermitido(null, ALLOWLIST), false);
  assert.equal(origenPermitido(undefined, ALLOWLIST), false);
  assert.equal(origenPermitido('   ', ALLOWLIST), false);
});

test('la comparación es exacta, no por prefijo', () => {
  // "https://familiar.app.malicioso.cl" contiene el origen permitido como
  // prefijo. Un `startsWith` lo dejaría pasar.
  assert.equal(origenPermitido('https://familiar.app.malicioso.cl', ALLOWLIST), false);
  assert.equal(origenPermitido('https://familiar.app/', ALLOWLIST), false);
});

test('distingue el esquema y el puerto', () => {
  assert.equal(origenPermitido('http://familiar.app', ALLOWLIST), false);
  assert.equal(origenPermitido('http://localhost:4201', ALLOWLIST), false);
});

test('las entradas vacías de la allowlist no habilitan nada', () => {
  // Un CSV con comas de más produce entradas vacías; si se compararan sin
  // filtrar, un origen vacío matchearía.
  assert.equal(origenPermitido('', ['', '  ', 'https://familiar.app']), false);
  assert.equal(origenPermitido('https://familiar.app', ['', 'https://familiar.app']), true);
});

test('sin allowlist configurada no pasa nadie', () => {
  assert.equal(origenPermitido('https://familiar.app', []), false);
});
