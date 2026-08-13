import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { auditarProvocacion, disparo, FIXTURES } from './provocacion.js';

describe('disparo', () => {
  test('reconoce la regla en la salida del linter', () => {
    assert.equal(disparo('🚨 [ARCH-04] OnPush required: Componente sin…', 'ARCH-04'), true);
  });

  test('NO se conforma con el ID suelto', () => {
    // Al final de una corrida fallida, el linter imprime la lista de TODAS las
    // reglas validadas: "ARCH-04 — OnPush required — docs/…". Buscar el ID
    // pelado daría positivo para las 25 reglas, siempre. Es el falso verde que
    // este archivo existe para evitar, y casi se comete al escribirlo.
    const listaFinal = '📋 Reglas validadas:\n   ARCH-04 — OnPush required — docs/TECH-STACK-RULES.md';
    assert.equal(disparo(listaFinal, 'ARCH-04'), false);
  });
});

describe('auditarProvocacion', () => {
  const base = { registradas: ['ARCH-01', 'ARCH-02', 'ARCH-03'], conFixture: ['ARCH-01'] };

  test('lo que está en el baseline no falla: es deuda declarada', () => {
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-02', 'ARCH-03'] });
    assert.deepEqual(r.sinFixture, ['ARCH-02', 'ARCH-03']);
    assert.deepEqual(r.nuevasSinFixture, []);
  });

  test('una regla nueva sin fixture SÍ falla', () => {
    // El momento de escribir el fixture es cuando se escribe la regla. Después
    // es cuando aparece ARCH-26: detector escrito, tests en verde, sin cablear.
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-02'] });
    assert.deepEqual(r.nuevasSinFixture, ['ARCH-03']);
  });

  test('el baseline que ya no corresponde es un error, no un detalle', () => {
    // Un trinquete que no se achica es una lista de excusas. Si ARCH-01 ya tiene
    // fixture y sigue en el baseline, el número de "deuda" miente hacia arriba.
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-01', 'ARCH-02', 'ARCH-03'] });
    assert.deepEqual(r.baselineObsoleto, ['ARCH-01']);
  });

  test('una regla borrada del linter también deja el baseline obsoleto', () => {
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-02', 'ARCH-03', 'ARCH-99'] });
    assert.deepEqual(r.baselineObsoleto, ['ARCH-99']);
  });
});

describe('FIXTURES', () => {
  test('cada fixture viola su regla y no arrastra otras evidentes', () => {
    // Un fixture que viola tres reglas no permite saber cuál disparó, y el día
    // que una se rompa las otras dos la tapan.
    for (const [ruleId, f] of Object.entries(FIXTURES)) {
      assert.ok(f.ruta && f.contenido, `${ruleId} sin ruta o contenido`);
      // Todos menos el propio ARCH-04 tienen que traer OnPush, o dispararían
      // ARCH-04 de rebote.
      if (ruleId !== 'ARCH-04' && f.ruta.endsWith('.component.ts')) {
        assert.match(f.contenido, /ChangeDetectionStrategy\.OnPush/,
          `${ruleId} dispararía ARCH-04 de rebote`);
      }
    }
  });
});
