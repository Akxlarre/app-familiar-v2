#!/usr/bin/env node
/**
 * Integridad de enlaces entre specs.
 *
 *   node scripts/verificar-specs.mjs
 *
 * Una spec nueva casi siempre modifica specs ya escritas, y ese cambio se hace a
 * mano en las dos puntas. Esto verifica que las dos puntas existan.
 *
 * Sin carpeta `specs/` no hace nada — igual que el spec-gate, el SDD viene
 * dormido y no molesta a quien no lo usa.
 */

import fs from 'fs';
import path from 'path';
import { auditarEnlaces } from './lib/spec-links.js';

const raizSpecs = path.join(process.cwd(), 'specs', 'specs');
const c = { gris: '\x1b[90m', rojo: '\x1b[31m', verde: '\x1b[32m', amarillo: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };

if (!fs.existsSync(raizSpecs)) {
  console.log(`${c.gris}Sin specs/: nada que verificar.${c.reset}`);
  process.exit(0);
}

// Una spec es su carpeta `NNNN-nombre/`, y su fuente es TODO lo que hay adentro:
// una decisión puede estar en spec.md, en tasks.md o en decisiones.md, y exigir
// que el acuse viva en un archivo puntual sería inventar una regla que nadie
// recuerda.
const specs = [];
for (const carpeta of fs.readdirSync(raizSpecs).sort()) {
  const m = carpeta.match(/^(\d{4})-/);
  if (!m) continue;
  const dir = path.join(raizSpecs, carpeta);
  if (!fs.statSync(dir).isDirectory()) continue;

  const fuente = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');

  specs.push({ id: m[1], carpeta, fuente });
}

console.log(`\n${c.cyan}🔗 Enlaces entre specs — ${specs.length} spec(s)${c.reset}\n`);

const { inexistentes, sinAcuse, sinDeclarar } = auditarEnlaces(specs);
let falla = false;

if (inexistentes.length > 0) {
  console.error(`${c.rojo}❓ Enlaces a specs que no existen:${c.reset}`);
  for (const e of inexistentes) console.error(`   ${e.de} → ${e.a}`);
  console.error('');
  falla = true;
}

if (sinAcuse.length > 0) {
  console.error(`${c.rojo}➡️  Declaran modificar una spec que no acusa recibo:${c.reset}`);
  for (const e of sinAcuse) console.error(`   ${e.de} dice modificar la ${e.a}, y la ${e.a} ni la nombra`);
  console.error(`${c.amarillo}   La spec modificada sigue prometiendo lo viejo, y no se nota hasta construirla.${c.reset}\n`);
  falla = true;
}

if (sinDeclarar.length > 0) {
  console.error(`${c.rojo}⬅️  Modificadas sin que nadie lo declare:${c.reset}`);
  for (const e of sinDeclarar) {
    console.error(`   la ${e.modificada} dice que la ${e.por} le absorbió algo, y la ${e.por} no lo declara`);
  }
  console.error(`${c.amarillo}   Agregá "> **Modifica:** ${sinDeclarar[0].modificada}" a la cabecera de la spec que la absorbió.${c.reset}\n`);
  falla = true;
}

if (falla) process.exit(1);

const conEnlaces = specs.filter((s) => /\*\*Modifica:\*\*/.test(s.fuente)).length;
console.log(`${c.verde}✅ Enlaces íntegros${c.reset}${c.gris} — ${conEnlaces} spec(s) declaran modificar a otras${c.reset}\n`);
