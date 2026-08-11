/**
 * contrast-check.js — ARCH-25: contraste AA de los pares texto/fondo del design system.
 *
 * `theme-tokens.js` verifica que un token EXISTA en los dos temas. Eso no dice nada
 * sobre si se puede leer: un `--text-muted` correctamente definido en oscuro puede
 * quedar en 2.1:1 contra `--bg-surface` y ser invisible igual.
 *
 * Esta es la diferencia entre "el token está" y "el token sirve", y es justo el bug
 * que ya apareció una vez en este proyecto: `.micro-label--warning` existía, el token
 * existía, y el texto se veía gris porque la clase nunca se aplicaba.
 *
 * Sólo se verifican **pares declarados** — texto sobre el fondo donde de verdad se
 * usa. El producto cartesiano de todos los colores contra todos los fondos produce
 * decenas de combinaciones que nadie va a escribir nunca, y un linter que reporta
 * cosas imposibles se empieza a ignorar.
 *
 * Micro-suite: `node scripts/lib/contrast-check.test.mjs`
 */

import fs from 'fs';

/** Umbral WCAG AA para texto normal. El texto grande (≥18.66px bold / 24px) admite 3.0. */
export const AA_TEXTO_NORMAL = 4.5;
export const AA_TEXTO_GRANDE = 3.0;

/**
 * Pares que se verifican, por tema. `sobre` es el fondo real donde ese texto vive.
 *
 * `grande: true` marca los que sólo aparecen en tamaño grande — el KPI es el caso
 * típico: `.kpi-value` es `--text-4xl` y le alcanza 3.0.
 */
export const PARES_CANONICOS = [
  // Texto sobre las superficies de la app
  { fg: '--text-primary', sobre: '--bg-base' },
  { fg: '--text-primary', sobre: '--bg-surface' },
  { fg: '--text-primary', sobre: '--bg-elevated' },
  { fg: '--text-secondary', sobre: '--bg-base' },
  { fg: '--text-secondary', sobre: '--bg-surface' },
  { fg: '--text-muted', sobre: '--bg-base' },
  { fg: '--text-muted', sobre: '--bg-surface' },
  { fg: '--text-muted', sobre: '--bg-subtle' },

  // Estados sobre su propio fondo tintado — el caso de las micro-labels
  { fg: '--state-success', sobre: '--state-success-bg' },
  { fg: '--state-warning', sobre: '--state-warning-bg' },
  { fg: '--state-error', sobre: '--state-error-bg' },

  // Estados sobre superficie plana: así se usan en `.micro-label--warning`
  { fg: '--state-success', sobre: '--bg-surface' },
  { fg: '--state-warning', sobre: '--bg-surface' },
  { fg: '--state-error', sobre: '--bg-surface' },

  // Botón primario
  { fg: '--btn-primary-text', sobre: '--btn-primary-bg' },
];

// ── Parseo de los bloques de tema ────────────────────────────────────────────

const BLOQUES = [
  { tema: 'claro', re: /(?:^|\n):root\s*\{([\s\S]*?)\n\}/ },
  { tema: 'oscuro', re: /(?:^|\n)\[data-mode="dark"\]\s*\{([\s\S]*?)\n\}/ },
];

/**
 * Devuelve `{ claro: Map, oscuro: Map }` con las custom properties de cada tema.
 * El tema oscuro **hereda** del claro: sólo redefine lo que cambia.
 */
export function parsearTemas(cssPath) {
  const src = fs.readFileSync(cssPath, 'utf-8');
  const out = {};

  for (const { tema, re } of BLOQUES) {
    const m = src.match(re);
    if (!m) throw new Error(`No se encontró el bloque del tema ${tema} en ${cssPath}`);
    out[tema] = leerDeclaraciones(m[1]);
  }

  // El bloque oscuro sólo redefine; lo que no toca lo hereda del claro.
  const heredado = new Map(out.claro);
  for (const [k, v] of out.oscuro) heredado.set(k, v);
  out.oscuro = heredado;

  return out;
}

export function leerDeclaraciones(cuerpo) {
  const mapa = new Map();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(cuerpo)) !== null) mapa.set(m[1], m[2].trim());
  return mapa;
}

// ── Resolución de valores ────────────────────────────────────────────────────

/**
 * Resuelve un token hasta un color literal, siguiendo cadenas de `var()`.
 * Devuelve `null` si no se llega a un color (p. ej. un `color-mix` que no sabemos evaluar).
 */
export function resolver(token, decls, saltos = 0) {
  if (saltos > 10) return null; // ciclo entre tokens
  const valor = decls.get(token);
  if (!valor) return null;

  const m = valor.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (m) {
    const directo = resolver(m[1], decls, saltos + 1);
    if (directo) return directo;
    return m[2] ? aRgb(m[2].trim()) : null; // el fallback del var()
  }

  return aRgb(valor);
}

/** Convierte `#rgb`, `#rrggbb`, `rgb()` o `rgba()` a `{r,g,b,a}`. Devuelve null si no puede. */
export function aRgb(valor) {
  const v = valor.trim();

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }

  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };

  return null;
}

/**
 * Compone un color semitransparente sobre su fondo.
 *
 * Hace falta de verdad: en el tema oscuro los `--state-*-bg` son `rgba(..., 0.1)`,
 * y medirlos como si fueran opacos da un contraste que nadie ve nunca.
 */
export function componer(color, fondo) {
  if (color.a >= 1) return color;
  const a = color.a;
  return {
    r: color.r * a + fondo.r * (1 - a),
    g: color.g * a + fondo.g * (1 - a),
    b: color.b * a + fondo.b * (1 - a),
    a: 1,
  };
}

// ── Contraste WCAG ───────────────────────────────────────────────────────────

function canal(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminancia({ r, g, b }) {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Ratio de contraste WCAG, de 1 (nulo) a 21 (negro sobre blanco). */
export function contrasteDe(fg, bg) {
  const l1 = luminancia(fg);
  const l2 = luminancia(bg);
  const [claro, oscuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (oscuro + 0.05);
}

// ── Chequeo ──────────────────────────────────────────────────────────────────

/**
 * Verifica los pares declarados en los dos temas.
 * Devuelve `{ fallas, revisados, sinResolver }` — data in, data out, sin fs ni console.
 */
export function verificarPares(temas, pares = PARES_CANONICOS) {
  const fallas = [];
  const sinResolver = [];
  let revisados = 0;

  for (const [tema, decls] of Object.entries(temas)) {
    // Fondo último de la app: es sobre esto que se componen los semitransparentes.
    const base = resolver('--bg-base', decls) ?? { r: 255, g: 255, b: 255, a: 1 };

    for (const par of pares) {
      const fgCrudo = resolver(par.fg, decls);
      const bgCrudo = resolver(par.sobre, decls);

      if (!fgCrudo || !bgCrudo) {
        sinResolver.push({ tema, ...par });
        continue;
      }

      const bg = componer(bgCrudo, base);
      const fg = componer(fgCrudo, bg);
      const ratio = contrasteDe(fg, bg);
      const minimo = par.grande ? AA_TEXTO_GRANDE : AA_TEXTO_NORMAL;
      revisados++;

      if (ratio < minimo) {
        fallas.push({
          tema,
          fg: par.fg,
          sobre: par.sobre,
          ratio: Math.round(ratio * 100) / 100,
          minimo,
        });
      }
    }
  }

  return { fallas, revisados, sinResolver };
}
