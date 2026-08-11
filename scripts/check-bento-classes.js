#!/usr/bin/env node
/**
 * check-bento-classes.js — Freno contra el sprawl del sistema bento.
 *
 * Compara las clases `.bento-*` definidas en `_bento-grid.scss` contra
 * `scripts/lib/bento-classes.allowlist.json` y falla si aparece una clase nueva
 * que nadie revisó. El grid tiende a crecer por acumulación: cada pantalla suma
 * "una clasecita más" hasta que hay 30 y ninguna se puede borrar sin miedo.
 *
 * Está cableado como **ARCH-21** en `architect.js`, así que corre con
 * `npm run lint:arch`. También se puede correr suelto:
 *
 *   npm run check:bento
 *
 * Criterio para aprobar una clase nueva: el bento describe FORMAS, no contenidos.
 * Si el nombre alude a la sección de la app que la usa (`bento-invoices`,
 * `bento-activity-lg`), casi siempre se resuelve con una proporción existente o
 * con los data-attributes de placement (`data-col-span`, `data-row-span`).
 *
 * `extractBentoClasses` y `diffBentoClasses` son funciones puras (Data In → Data
 * Out), testeables sin fs — ver `scripts/lib/bento-classes.test.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export function extractBentoClasses(scssContent) {
  return new Set([...scssContent.matchAll(/\.(bento-[\w-]+)/g)].map((m) => m[1]));
}

/** @returns {{ newClasses: string[], removedClasses: string[] }} */
export function diffBentoClasses(currentClasses, allowlistClasses) {
  const current = new Set(currentClasses);
  const allow = new Set(allowlistClasses);
  return {
    newClasses: [...current].filter((c) => !allow.has(c)).sort(),
    removedClasses: [...allow].filter((c) => !current.has(c)).sort(),
  };
}

// ── CLI (solo cuando se ejecuta directamente, no al importar en tests) ───────
// pathToFileURL normaliza relativo/absoluto y separadores \ vs / (Windows) — una
// comparación de string a mano acá se rompía en silencio: exit 0 sin correr nada.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const scssPath = join(__dirname, '..', 'src', 'styles', 'layout', '_bento-grid.scss');
  const allowlistPath = join(__dirname, 'lib', 'bento-classes.allowlist.json');

  const current = extractBentoClasses(readFileSync(scssPath, 'utf8'));
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')).classes;
  const { newClasses, removedClasses } = diffBentoClasses(current, allowlist);

  if (newClasses.length > 0) {
    console.error('🚨 Clases .bento-* nuevas, no revisadas en el allowlist:');
    newClasses.forEach((c) => console.error(`   .${c}`));
    console.error(
      '\n¿Ya revisaste que ninguna clase existente resuelve esto? Ver indices/STYLES.md ' +
        "§ 'Cómo elegir: bento + botones'. Si es legítima, sumala a " +
        'scripts/lib/bento-classes.allowlist.json con la justificación.',
    );
    process.exitCode = 1;
  } else {
    console.log(`✅ check-bento-classes: ${current.size} clases, todas en el allowlist.`);
  }

  if (removedClasses.length > 0) {
    console.log(
      `ℹ️  ${removedClasses.length} clase(s) del allowlist ya no existen en el CSS (mejora — re-generar el allowlist): ${removedClasses.join(', ')}`,
    );
  }
}
