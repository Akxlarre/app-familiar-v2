/**
 * tailwind-bare-utilities.js — ARCH-22: colisión de nombre con utilidad "bare" de Tailwind.
 *
 * Caso real que motivó esta regla (fix-115-b): el DS definía `.overline` como micro-label
 * tipográfico. Tailwind CSS v4 escanea el contenido (`@source`) y, al ver el literal
 * `"overline"` como class en 141 lugares, generaba su PROPIA regla dentro de
 * `@layer utilities` — `overline` es también una utilidad nativa de Tailwind
 * (`text-decoration-line: overline`, familia `underline`/`overline`/`line-through`).
 * Como esa regla y la del DS no comparten ninguna propiedad CSS, ambas se aplicaban a la
 * vez: el texto quedaba con el estilo correcto de micro-label Y ADEMÁS con una línea física
 * dibujada encima. Renombrado a `.micro-label` (fix-115-b).
 *
 * Esta regla evita que el próximo nombre de clase del DS repita el mismo error: falla si
 * una clase definida en un archivo de `src/styles/` coincide EXACTAMENTE con una utilidad
 * "bare" (sin sufijo de valor) reservada de Tailwind. Nombres compuestos con guion
 * (`.item-title`, `.card-tinted`) no chocan por construcción — las utilidades bare de
 * Tailwind son casi siempre una sola palabra inglesa suelta.
 *
 * Micro-suite: `node scripts/lib/tailwind-bare-utilities.test.mjs`
 * Standalone (sin esperar el wiring en architect.js — protegido, ver architect-js-patch.md):
 *   `node scripts/lib/tailwind-bare-utilities.js`
 */

// ── Utilidades "bare" reservadas de Tailwind (sin sufijo de valor) ───────────
// Lista curada, no exhaustiva — cubre las utilidades de una sola palabra con más
// probabilidad de coincidir con un nombre de clase semántico del DS. Si aparece una
// colisión nueva con una utilidad no listada acá, sumala (mismo espíritu que el
// allowlist de bento-classes.js: se extiende cuando se descubre un caso real).
export const TAILWIND_BARE_UTILITIES = [
  // display
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'table',
  'inline-table',
  'flow-root',
  'grid',
  'inline-grid',
  'contents',
  'list-item',
  'hidden',
  // position
  'static',
  'fixed',
  'absolute',
  'relative',
  'sticky',
  // visibility / isolation
  'visible',
  'invisible',
  'collapse',
  'isolate',
  // flex sizing
  'grow',
  'shrink',
  // box sizing
  'border',
  'box-border',
  'box-content',
  // typography (decoración / transformación / estilo)
  'italic',
  'uppercase',
  'lowercase',
  'capitalize',
  'underline',
  'overline',
  'truncate',
  'antialiased',
  // efectos
  'rounded',
  'shadow',
  'ring',
  'outline',
  // motion / interacción
  'transition',
  'resize',
  // misc
  'container',
  'group',
  'peer',
  'sr-only',
];

// ── Extracción de nombres de clase DEFINIDOS (selectores, no usos) ───────────
// Solo selectores de nivel superior escritos como `.nombre {` o `.nombre,` al
// inicio de línea — el mismo nivel de heurística que extractBentoClasses (simple,
// suficiente para archivos del DS que no anidan selectores con `&`).
const CLASS_SELECTOR_RE = /^[ \t]*\.([a-zA-Z][\w-]*)[ \t]*[,{]/gm;

export function extractDefinedClassNames(scssContent) {
  const out = new Set();
  let m;
  CLASS_SELECTOR_RE.lastIndex = 0;
  while ((m = CLASS_SELECTOR_RE.exec(scssContent)) !== null) {
    out.add(m[1]);
  }
  return out;
}

/**
 * @param {string} scssContent
 * @param {string[]} [reserved] — override para tests; por defecto TAILWIND_BARE_UTILITIES.
 * @returns {string[]} nombres de clase definidos que colisionan, ordenados.
 */
export function findReservedTailwindClassCollisions(scssContent, reserved = TAILWIND_BARE_UTILITIES) {
  const defined = extractDefinedClassNames(scssContent);
  const reservedSet = new Set(reserved);
  return [...defined].filter((name) => reservedSet.has(name)).sort();
}

// ── ARCH-26: token de @theme que pisa una utilidad nativa ───────────────────
//
// La misma falla que ARCH-22, del otro lado. ARCH-22 mira los nombres de clase
// del DS; esto mira los nombres de TOKEN en el bloque @theme.
//
// Caso real: `--color-base: var(--bg-base)`. Tailwind genera `text-base` como
// utilidad de COLOR, y le gana a la `text-base` nativa de tamaño de fuente. El
// resultado fue texto pintado del color del fondo de la app: los inputs del
// login quedaron en 1.15:1 — invisibles, en producción, sin que nada fallara.
//
// El compilador no lo ve, los tests no lo ven y el ojo tampoco si el fondo del
// contenedor da la casualidad de tener contraste. Sólo se ve midiendo el color
// que el navegador pinta de verdad.

/** Sufijos de escala que ya usan las utilidades nativas de cada prefijo. */
export const ESCALAS_NATIVAS = {
  text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'],
  border: ['0', '2', '4', '8'],
  ring: ['0', '1', '2', '4', '8'],
  divide: ['0', '2', '4', '8'],
  outline: ['0', '1', '2', '4', '8'],
};

/** Prefijos de utility que Tailwind genera para cada `--color-*`. */
const PREFIJOS_DE_COLOR = Object.keys(ESCALAS_NATIVAS);

/** Nombres de token declarados en el bloque @theme. */
export function extraerTokensDeColor(cssContent) {
  const bloque = cssContent.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!bloque) return [];
  const nombres = [];
  const re = /--color-([\w-]+)\s*:/g;
  let m;
  while ((m = re.exec(bloque[1])) !== null) nombres.push(m[1]);
  return nombres;
}

/**
 * Devuelve los tokens que colisionan, con la utilidad exacta que rompen.
 * Data in → data out: sin fs, sin console.
 */
export function findThemeTokenCollisions(cssContent) {
  const out = [];
  for (const token of extraerTokensDeColor(cssContent)) {
    for (const prefijo of PREFIJOS_DE_COLOR) {
      if (ESCALAS_NATIVAS[prefijo].includes(token)) {
        out.push({ token: `--color-${token}`, utilidad: `${prefijo}-${token}`, prefijo });
      }
    }
  }
  return out;
}

// ── CLI standalone (no depende del wiring en architect.js) ───────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const raiz = join(__dirname, '..', '..');
  const scssPath = join(raiz, 'src', 'styles', 'tokens', '_variables.scss');
  const collisions = findReservedTailwindClassCollisions(readFileSync(scssPath, 'utf8'));

  // El mismo error, del otro lado: un token del @theme que pisa una escala nativa.
  // Se revisa acá y no sólo en architect.js porque este CLI es el que corre en el
  // pre-commit, y ARCH-26 nació de un token que estuvo semanas sin que nadie lo viera.
  let tokenCollisions = [];
  try {
    tokenCollisions = findThemeTokenCollisions(readFileSync(join(raiz, 'src', 'tailwind.css'), 'utf8'));
  } catch { /* sin tailwind.css no hay nada que revisar */ }

  if (collisions.length > 0) {
    console.error('🚨 Clases del DS que colisionan con una utilidad bare de Tailwind:');
    collisions.forEach((c) => console.error(`   .${c}`));
    console.error(
      '\nRenombrá la clase a un nombre compuesto (ej. .micro-label en vez de .overline, fix-115-b).',
    );
  }

  if (tokenCollisions.length > 0) {
    console.error('🚨 Tokens del @theme que generan una utilidad de color sobre una escala nativa:');
    tokenCollisions.forEach((c) => console.error(`   ${c.token} → ${c.utilidad} (pisa la escala ${c.prefijo})`));
    console.error(
      '\nRenombrá el token: --color-base hacía que `text-base` pintara el texto del color del fondo.',
    );
  }

  if (collisions.length > 0 || tokenCollisions.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('✅ tailwind-bare-utilities: sin colisiones de clase ni de token.');
  }
}
