/**
 * Pruebas del chequeo de contraste.
 *
 *   node --test scripts/lib/contrast-check.test.mjs
 *
 * Lo que se prueba es que el guardrail **detecte** un texto ilegible, no que los
 * colores actuales pasen. Un linter que no puede fallar no sirve de nada, y es un
 * error que ya cometimos en este repo: `CREATE POLICY IF NOT EXISTS` pasaba el test
 * porque el test tampoco lo verificaba.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aRgb,
  componer,
  contrasteDe,
  leerDeclaraciones,
  resolver,
  verificarPares,
  AA_TEXTO_NORMAL,
} from './contrast-check.js';

// ── Parseo de color ──────────────────────────────────────────────────────────

test('lee hex de 6 y de 3 dígitos', () => {
  assert.deepEqual(aRgb('#ffffff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(aRgb('#000'), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(aRgb('#09090b'), { r: 9, g: 9, b: 11, a: 1 });
});

test('lee rgb y rgba', () => {
  assert.deepEqual(aRgb('rgb(255, 0, 0)'), { r: 255, g: 0, b: 0, a: 1 });
  assert.deepEqual(aRgb('rgba(74, 222, 128, 0.1)'), { r: 74, g: 222, b: 128, a: 0.1 });
});

test('lo que no es color devuelve null en vez de un valor inventado', () => {
  assert.equal(aRgb('color-mix(in srgb, red 50%, blue)'), null);
  assert.equal(aRgb('var(--otro)'), null);
  assert.equal(aRgb(''), null);
});

// ── Contraste ────────────────────────────────────────────────────────────────

test('negro sobre blanco da el máximo', () => {
  const r = contrasteDe(aRgb('#000'), aRgb('#fff'));
  assert.ok(Math.abs(r - 21) < 0.01, `esperaba 21, dio ${r}`);
});

test('un color contra sí mismo da 1', () => {
  assert.equal(Math.round(contrasteDe(aRgb('#7f7f7f'), aRgb('#7f7f7f'))), 1);
});

test('el orden de los argumentos no cambia el ratio', () => {
  const a = contrasteDe(aRgb('#333'), aRgb('#eee'));
  const b = contrasteDe(aRgb('#eee'), aRgb('#333'));
  assert.ok(Math.abs(a - b) < 1e-9);
});

// ── Composición de semitransparentes ─────────────────────────────────────────

test('compone un semitransparente sobre su fondo', () => {
  // rgba(255,255,255,0.5) sobre negro = gris medio.
  const c = componer({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
  assert.equal(Math.round(c.r), 128);
  assert.equal(c.a, 1);
});

test('un color opaco no se toca', () => {
  const c = { r: 10, g: 20, b: 30, a: 1 };
  assert.deepEqual(componer(c, { r: 255, g: 255, b: 255, a: 1 }), c);
});

test('sin componer, un fondo al 10% miente sobre el contraste', () => {
  // Es el caso real del tema oscuro: --state-success-bg es rgba(74,222,128,.1).
  const base = aRgb('#09090b');
  const tinte = aRgb('rgba(74, 222, 128, 0.1)');
  const texto = aRgb('#4ade80');

  const crudo = contrasteDe(texto, tinte);
  const real = contrasteDe(texto, componer(tinte, base));

  assert.ok(real > crudo, 'componer sobre el fondo real cambia el resultado');
});

// ── Resolución de tokens ─────────────────────────────────────────────────────

test('sigue una cadena de var() hasta el color', () => {
  const d = leerDeclaraciones(`
    --ds-brand: #2563eb;
    --color-primary: var(--ds-brand);
    --btn-primary-bg: var(--color-primary);
  `);
  assert.deepEqual(resolver('--btn-primary-bg', d), { r: 37, g: 99, b: 235, a: 1 });
});

test('usa el fallback del var() cuando el token no existe', () => {
  const d = leerDeclaraciones('--x: var(--no-existe, #ff0000);');
  assert.deepEqual(resolver('--x', d), { r: 255, g: 0, b: 0, a: 1 });
});

test('un ciclo entre tokens no cuelga el linter', () => {
  const d = leerDeclaraciones('--a: var(--b); --b: var(--a);');
  assert.equal(resolver('--a', d), null);
});

test('un token que no existe devuelve null', () => {
  assert.equal(resolver('--fantasma', leerDeclaraciones('--x: #fff;')), null);
});

// ── El chequeo completo ──────────────────────────────────────────────────────

test('detecta un texto ilegible', () => {
  const temas = {
    claro: leerDeclaraciones('--bg-base: #ffffff; --bg-surface: #ffffff; --text-muted: #eeeeee;'),
  };
  const { fallas } = verificarPares(temas, [{ fg: '--text-muted', sobre: '--bg-surface' }]);

  assert.equal(fallas.length, 1);
  assert.equal(fallas[0].fg, '--text-muted');
  assert.ok(fallas[0].ratio < AA_TEXTO_NORMAL);
});

test('no reporta un par que cumple', () => {
  const temas = {
    claro: leerDeclaraciones('--bg-base: #ffffff; --bg-surface: #ffffff; --text-primary: #09090b;'),
  };
  const { fallas, revisados } = verificarPares(temas, [{ fg: '--text-primary', sobre: '--bg-surface' }]);

  assert.equal(fallas.length, 0);
  assert.equal(revisados, 1);
});

test('el texto grande pasa con 3.0', () => {
  // Un par que da ~3.5: falla como texto normal, pasa como grande.
  const decls = leerDeclaraciones('--bg-base: #ffffff; --bg-surface: #ffffff; --kpi: #8a8a8a;');
  const par = { fg: '--kpi', sobre: '--bg-surface' };

  assert.equal(verificarPares({ claro: decls }, [par]).fallas.length, 1);
  assert.equal(verificarPares({ claro: decls }, [{ ...par, grande: true }]).fallas.length, 0);
});

test('un par que no se puede resolver se reporta aparte, no como falla', () => {
  // color-mix() no se evalúa. Reportarlo como fallo sería un falso positivo;
  // callarlo sería esconder que ese par no lo verifica nadie.
  const temas = {
    claro: leerDeclaraciones('--bg-base: #fff; --raro: color-mix(in srgb, red 50%, blue); --text-primary: #000;'),
  };
  const { fallas, sinResolver } = verificarPares(temas, [{ fg: '--text-primary', sobre: '--raro' }]);

  assert.equal(fallas.length, 0);
  assert.equal(sinResolver.length, 1);
});

test('revisa los dos temas', () => {
  const temas = {
    claro: leerDeclaraciones('--bg-base: #fff; --bg-surface: #ffffff; --text-muted: #000000;'),
    oscuro: leerDeclaraciones('--bg-base: #000; --bg-surface: #000000; --text-muted: #0a0a0a;'),
  };
  const { fallas, revisados } = verificarPares(temas, [{ fg: '--text-muted', sobre: '--bg-surface' }]);

  assert.equal(revisados, 2);
  assert.equal(fallas.length, 1);
  assert.equal(fallas[0].tema, 'oscuro');
});
