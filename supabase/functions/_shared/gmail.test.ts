import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ErrorDeGmail, necesitaRefresco } from './gmail.ts';

// Qué se hace con un fallo de Gmail depende ENTERAMENTE de esta clasificación:
// una credencial muerta se marca `revocada` y se le pide al usuario reconectar;
// cualquier otra cosa se reintenta. Equivocarse en un sentido deja la captura
// reintentando algo muerto para siempre; en el otro, manda a reconectar cada vez
// que Google tose.

Deno.test('un 401 es credencial muerta: reconectar es lo único que sirve', () => {
  assertEquals(new ErrorDeGmail('sin permiso', 401).esCredencialMuerta, true);
});

Deno.test('un 403 también: Google revoca así cuando el usuario quita el acceso', () => {
  assertEquals(new ErrorDeGmail('forbidden', 403).esCredencialMuerta, true);
});

Deno.test('un 429 NO lo es: es cuota, y se arregla esperando', () => {
  assertEquals(new ErrorDeGmail('rate limit', 429).esCredencialMuerta, false);
});

Deno.test('un 500 tampoco: Gmail caído no es culpa del permiso', () => {
  assertEquals(new ErrorDeGmail('boom', 500).esCredencialMuerta, false);
});

Deno.test('sin access token hay que refrescar', () => {
  assertEquals(necesitaRefresco(null, null), true);
});

Deno.test('un token que vence dentro de 5 minutos se refresca antes de usarlo', () => {
  // El margen existe porque entre esta comprobación y la llamada a Gmail pasa
  // tiempo: un token que vence "justo ahora" ya venció cuando se usa.
  const enTresMinutos = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  assertEquals(necesitaRefresco('at', enTresMinutos), true);
});

Deno.test('un token con margen de sobra no se toca', () => {
  const enUnaHora = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assertEquals(necesitaRefresco('at', enUnaHora), false);
});
