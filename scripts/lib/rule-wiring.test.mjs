/**
 * Pruebas del chequeo de cableado de reglas.
 *
 *   node --test scripts/lib/rule-wiring.test.mjs
 *
 * Dos mitades. La primera prueba las funciones puras contra fuentes sintéticas
 * que **reproducen los dos bugs reales** que motivaron el módulo. La segunda
 * corre contra el `architect.js` de verdad y exige cero inconsistencias: es la
 * que se rompe el día que alguien agregue una regla y olvide enchufarla.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  auditarCableado,
  extraerReglasAcumuladas,
  extraerReglasAlimentadas,
  extraerReglasRegistradas,
  extraerReglasReportadas,
} from './rule-wiring.js';
import { DS_RULES } from './class-discipline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Extracción ───────────────────────────────────────────────────────────────

test('lee los IDs del registro RULES', () => {
  const src = `
const RULES = {
    'ARCH-01': {
        name: 'No Supabase in UI',
    },
    'A11Y-03': {
        name: 'Icon-only button',
    },
};
`;
  assert.deepEqual(extraerReglasRegistradas(src), ['ARCH-01', 'A11Y-03']);
});

test('lee el ID aunque la llamada lo ponga en la línea siguiente', () => {
  const src = `
    reportError('ARCH-22', scssPath, 'colisiona');
    reportWarning(
        'ARCH-09', filePath, 'muy grande'
    );
`;
  assert.deepEqual(extraerReglasReportadas(src).sort(), ['ARCH-09', 'ARCH-22']);
});

test('no confunde un ID mencionado en un comentario con una llamada', () => {
  const src = `
    // ARCH-25: contraste AA, con ratchet
    reportError('ARCH-25', ruta, 'ilegible');
`;
  assert.deepEqual(extraerReglasReportadas(src), ['ARCH-25']);
});

// ── El bug de ARCH-26: registrada y sin llamador ──────────────────────────────

test('detecta una regla registrada que no reporta desde ningún lado', () => {
  // Exactamente lo que pasó: detector escrito, tests escritos, cero llamadas.
  const { huerfanas } = auditarCableado({
    registradas: ['ARCH-18', 'ARCH-26'],
    reportadas: ['ARCH-18'],
    alimentadas: [],
    acumuladas: [],
    dsRules: [],
  });
  assert.deepEqual(huerfanas, ['ARCH-26']);
});

test('una regla con llamador no se marca huérfana', () => {
  const { huerfanas } = auditarCableado({
    registradas: ['ARCH-18', 'ARCH-26'],
    reportadas: ['ARCH-18', 'ARCH-26'],
    alimentadas: [],
    acumuladas: [],
    dsRules: [],
  });
  assert.deepEqual(huerfanas, []);
});

// ── El bug de ARCH-24: cuenta y no reporta ───────────────────────────────────

test('detecta la regla del ratchet que falta en DS_RULES', () => {
  // TD3: el detector corría, `add()` la contaba, `dsCounts` la acumulaba, y la
  // comparación contra el baseline la ignoraba porque DS_RULES es fija.
  const { huerfanas, ratchetIncompleto } = auditarCableado({
    registradas: ['ARCH-15', 'ARCH-24'],
    reportadas: [],
    alimentadas: ['ARCH-15', 'ARCH-24'],
    acumuladas: ['ARCH-15', 'ARCH-24'],
    dsRules: ['ARCH-15'],
  });
  assert.deepEqual(ratchetIncompleto, [
    { regla: 'ARCH-24', falta: 'DS_RULES (class-discipline.js)' },
  ]);
  // Y además queda huérfana: sin DS_RULES no llega nunca a un reportError.
  assert.deepEqual(huerfanas, ['ARCH-24']);
});

test('detecta la regla que está en DS_RULES pero nadie alimenta', () => {
  const { ratchetIncompleto } = auditarCableado({
    registradas: ['ARCH-15'],
    reportadas: [],
    alimentadas: [],
    acumuladas: [],
    dsRules: ['ARCH-15'],
  });
  assert.deepEqual(ratchetIncompleto, [
    { regla: 'ARCH-15', falta: 'add() en trackClassDiscipline' },
  ]);
});

test('el circuito completo del ratchet no reporta nada', () => {
  const { huerfanas, ratchetIncompleto } = auditarCableado({
    registradas: ['ARCH-15'],
    reportadas: [],
    alimentadas: ['ARCH-15'],
    acumuladas: ['ARCH-15'],
    dsRules: ['ARCH-15'],
  });
  assert.deepEqual(ratchetIncompleto, []);
  assert.deepEqual(huerfanas, []);
});

// ── Regla fantasma ───────────────────────────────────────────────────────────

test('detecta un ID que se reporta sin estar registrado', () => {
  // Un typo acá produce un error sin nombre, sin doc y sin fix: el usuario ve
  // un código y nada más.
  const { fantasma } = auditarCableado({
    registradas: ['ARCH-01'],
    reportadas: ['ARCH-01', 'ARCH-O1'],
    alimentadas: [],
    acumuladas: [],
    dsRules: [],
  });
  assert.deepEqual(fantasma, ['ARCH-O1']);
});

// ── Contra el architect.js real ──────────────────────────────────────────────

test('toda regla registrada en architect.js puede fallar', () => {
  const src = readFileSync(join(__dirname, '..', 'architect.js'), 'utf8');

  const registradas = extraerReglasRegistradas(src);
  assert.ok(registradas.length > 10, `el registro se leyó vacío o a medias (${registradas.length})`);

  const { huerfanas, fantasma, ratchetIncompleto } = auditarCableado({
    registradas,
    reportadas: extraerReglasReportadas(src),
    alimentadas: extraerReglasAlimentadas(src),
    acumuladas: extraerReglasAcumuladas(src),
    dsRules: DS_RULES,
  });

  assert.deepEqual(
    huerfanas, [],
    `Reglas registradas que no pueden fallar: ${huerfanas.join(', ')}.\n` +
    'Una regla sin llamador se ve igual que una regla que pasa. Enchúfala o sácala del registro.',
  );
  assert.deepEqual(
    fantasma, [],
    `IDs reportados sin entrada en RULES: ${fantasma.join(', ')}. El usuario vería un código sin fix ni doc.`,
  );
  assert.deepEqual(
    ratchetIncompleto, [],
    `Ratchet a medio cablear: ${ratchetIncompleto.map((r) => `${r.regla} (falta ${r.falta})`).join(', ')}.`,
  );
});
