/**
 * Micro-suite de tailwind-bare-utilities.js. Sin framework:
 * `node scripts/lib/tailwind-bare-utilities.test.mjs`. Exit 1 si algún caso falla.
 */
import { readFileSync } from 'node:fs';
import {
  extractDefinedClassNames,
  findReservedTailwindClassCollisions,
  findThemeTokenCollisions,
} from './tailwind-bare-utilities.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

// ── extractDefinedClassNames ──────────────────────────────────────────────────
check(
  'extrae selector simple',
  [...extractDefinedClassNames('.item-title {\n  color: red;\n}')].join(',') === 'item-title',
);
check(
  'extrae grupo de selectores multi-línea (alias)',
  [...extractDefinedClassNames('.overline,\n.kpi-label {\n  color: red;\n}')].sort().join(',') ===
    'kpi-label,overline',
);
check(
  'no duplica si la clase aparece 2 veces',
  extractDefinedClassNames('.card {}\n.card {}').size === 1,
);
check(
  'ignora selectores anidados (no son definición de nivel superior)',
  !extractDefinedClassNames('.card {\n  &.card--active { color: red; }\n}').has('card--active'),
);

// ── findReservedTailwindClassCollisions — caso real: overline ────────────────
check(
  'detecta la colisión real (.overline choca con text-decoration-line: overline)',
  findReservedTailwindClassCollisions('.overline {\n  color: red;\n}').join(',') === 'overline',
);
check(
  'clase ya renombrada (.micro-label) NO colisiona',
  findReservedTailwindClassCollisions('.micro-label {\n  color: red;\n}').length === 0,
);

// ── Casos inventados con la lista reservada real ──────────────────────────────
check(
  'detecta colisión con utilidad bare inventada (flex)',
  findReservedTailwindClassCollisions('.flex {\n  color: red;\n}').join(',') === 'flex',
);
check(
  'detecta colisión con utilidad bare inventada (truncate)',
  findReservedTailwindClassCollisions('.truncate {\n  color: red;\n}').join(',') === 'truncate',
);
check(
  'detecta colisión con utilidad bare inventada (container)',
  findReservedTailwindClassCollisions('.container {\n  color: red;\n}').join(',') === 'container',
);
check(
  'múltiples colisiones se listan todas, ordenadas',
  findReservedTailwindClassCollisions('.overline {}\n.flex {}\n.item-title {}').join(',') ===
    'flex,overline',
);

// ── Falsos positivos: nombres compuestos existentes del DS NO deben marcar ───
for (const cls of ['item-title', 'card-tinted', 'bento-hero', 'section-eyebrow', 'kpi-value', 'field-label']) {
  check(
    `nombre compuesto del DS NO colisiona (.${cls})`,
    findReservedTailwindClassCollisions(`.${cls} {\n  color: red;\n}`).length === 0,
  );
}

// ── reserved override para tests aislados ─────────────────────────────────────
check(
  'acepta lista reservada custom (override) sin usar la global',
  findReservedTailwindClassCollisions('.mi-clase-inventada {}', ['mi-clase-inventada']).join(
    ',',
  ) === 'mi-clase-inventada',
);


// ── ARCH-26: tokens de @theme que pisan una utilidad nativa ──────────────────

const colisiones = (css) => findThemeTokenCollisions(css);

// El caso real: --color-base hacía que text-base pintara COLOR en vez de tamaño,
// y los inputs del login quedaron en 1.15:1 — invisibles, en producción.
const caso = colisiones('@theme {\n  --color-base: var(--bg-base);\n  --color-surface: white;\n}');
check('detecta --color-base, que rompe text-base',
  caso.length === 1 && caso[0].token === '--color-base' && caso[0].utilidad === 'text-base');

check('no marca tokens que no chocan con ninguna escala',
  colisiones('@theme {\n  --color-canvas: red;\n  --color-surface: white;\n  --color-brand: blue;\n}').length === 0);

const escala = colisiones('@theme {\n  --color-sm: red;\n  --color-xl: blue;\n  --color-2xl: green;\n}')
  .map((c) => c.utilidad);
check('detecta toda la escala tipográfica, no sólo base',
  ['text-sm', 'text-xl', 'text-2xl'].every((u) => escala.includes(u)));

const anchos = colisiones('@theme {\n  --color-2: red;\n}').map((c) => c.prefijo);
check('detecta colisiones de anchos de borde y ring',
  anchos.includes('border') && anchos.includes('ring'));

check('sin bloque @theme no explota',
  colisiones(':root { --color-base: red; }').length === 0);

// Regresión del bug: si alguien vuelve a poner --color-base, esto falla.
const real = findThemeTokenCollisions(
  readFileSync(new URL('../../src/tailwind.css', import.meta.url), 'utf8'),
);
check('el @theme real del proyecto no tiene colisiones',
  real.length === 0);
if (real.length > 0) console.error('   →', real.map((x) => `${x.token} rompe ${x.utilidad}`).join(', '));

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallidos`);
  process.exit(1);
}
console.log('\n✅ tailwind-bare-utilities: todos los casos pasan');
