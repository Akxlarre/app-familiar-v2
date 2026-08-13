import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clasificar, contarTests, veredicto, resumir } from './smoke-scripts.js';

describe('clasificar', () => {
  test('un script que no termina no se puede correr en un smoke', () => {
    assert.equal(clasificar('start', 'ng serve'), 'no-termina');
    assert.equal(clasificar('watch', 'ng build --watch'), 'no-termina');
    assert.equal(clasificar('e2e:ui', 'playwright test --ui'), 'no-termina');
  });

  test('`--watch=false` NO es un watcher: es justamente lo contrario', () => {
    // El bug obvio de escribir el patrón a ojo. `test:ci` es el script que más
    // importa correr, y una regex ingenua sobre "watch" lo saltearía en silencio.
    assert.equal(clasificar('test:ci', 'ng test --watch=false'), 'verificable');
  });

  test('lo que necesita servicios de afuera queda fuera del smoke', () => {
    assert.equal(clasificar('supabase:start', 'supabase start'), 'externo');
    assert.equal(clasificar('claude:review', 'claude -p "..."'), 'externo');
  });

  test('lo destructivo gana sobre todo lo demás', () => {
    // `supabase:reset` es externo Y destructivo. Lo que manda es que borra datos:
    // clasificarlo como externo daría lo mismo hoy, pero el día que el smoke
    // decida correr los externos, borraría la base de alguien.
    assert.equal(clasificar('supabase:reset', 'supabase db reset'), 'destructivo');
  });

  test('lo desconocido se corre: el default seguro es medir, no saltear', () => {
    assert.equal(clasificar('lint:arch', 'node scripts/lint-arch-wrapper.js'), 'verificable');
    assert.equal(clasificar('inventado', 'node algo.js'), 'verificable');
  });
});

describe('contarTests', () => {
  test('lee la salida de Vitest', () => {
    assert.equal(contarTests('  Test Files  51 passed (51)\n     Tests  516 passed (516)'), 516);
  });

  test('lee la salida de deno test', () => {
    assert.equal(contarTests('ok | 40 passed | 0 failed (326ms)'), 40);
  });

  test('lee la salida TAP de node --test', () => {
    assert.equal(contarTests('# tests 12\n# pass 12\n# fail 0'), 12);
  });

  test('devuelve null si no reconoce el formato — no cero', () => {
    // La diferencia importa: cero significa "corrió y no había tests", que es un
    // hallazgo. Null significa "no supe leer", que no lo es. Confundirlos
    // convertiría este chequeo en el mismo falso negativo que vino a cazar.
    assert.equal(contarTests('todo salió bien'), null);
  });
});

describe('veredicto', () => {
  test('un script que falla en un proyecto sano está roto', () => {
    // El caso real: `node --test` sobre tests de Deno. El script existía, se
    // invocaba, y su error se leía como "hay tests rotos" en vez de "el comando
    // está mal".
    const v = veredicto({ nombre: 'test:functions', exitLimpio: 1, salida: 'Cannot find module' });
    assert.equal(v.estado, 'roto');
  });

  test('un script que pasa igual con un defecto adentro es decorativo', () => {
    // El caso real: `tsc --noEmit -p tsconfig.json` sobre un tsconfig
    // solution-style. Compila cero archivos y sale 0 SIEMPRE.
    const v = veredicto({ nombre: 'typecheck', exitLimpio: 0, salida: '', exitProvocado: 0 });
    assert.equal(v.estado, 'decorativo');
    assert.match(v.motivo, /defecto/);
  });

  test('un script que falla cuando tiene que fallar está bien', () => {
    const v = veredicto({ nombre: 'typecheck', exitLimpio: 0, salida: '', exitProvocado: 2 });
    assert.equal(v.estado, 'ok');
  });

  test('un runner que corre cero tests es decorativo aunque salga 0', () => {
    const v = veredicto({ nombre: 'test:ci', exitLimpio: 0, salida: 'Tests  0 passed (0)' });
    assert.equal(v.estado, 'decorativo');
  });

  test('un runner con tests de verdad está bien', () => {
    const v = veredicto({ nombre: 'test:ci', exitLimpio: 0, salida: 'Tests  516 passed (516)' });
    assert.equal(v.estado, 'ok');
    assert.match(v.motivo, /516/);
  });

  test('un script sin forma declarada de fallar se reporta, no se aprueba', () => {
    // No falla el smoke —sería intolerable el primer día— pero queda a la vista.
    // Lo que no puede es pasar inadvertido, que es como llegaron acá los dos bugs.
    const v = veredicto({ nombre: 'indices:sync', exitLimpio: 0, salida: 'ok' });
    assert.equal(v.estado, 'sin-comprobar');
  });
});

describe('resumir', () => {
  test('roto o decorativo hacen fallar el smoke; sin-comprobar no', () => {
    assert.equal(resumir([{ estado: 'ok' }, { estado: 'sin-comprobar' }]).falla, false);
    assert.equal(resumir([{ estado: 'ok' }, { estado: 'decorativo' }]).falla, true);
    assert.equal(resumir([{ estado: 'roto' }]).falla, true);
  });
});
