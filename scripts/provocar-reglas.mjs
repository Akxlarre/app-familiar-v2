#!/usr/bin/env node
/**
 * Provoca cada regla del linter para comprobar que puede fallar.
 *
 *   node scripts/provocar-reglas.mjs
 *   node scripts/provocar-reglas.mjs --actualizar-baseline
 *
 * Por cada regla con fixture: arma un sandbox con el archivo que la viola, corre
 * el linter ahí, y exige que su salida la nombre. Una regla que no dispara ante
 * su propia violación es decoración.
 *
 * Las reglas sin fixture no hacen fallar esto — quedan en `provocacion.baseline.json`,
 * que sólo puede achicarse. Lo que sí falla es agregar una regla nueva sin fixture:
 * el momento de escribirlo es cuando se escribe la regla.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { extraerReglasRegistradas } from './lib/rule-wiring.js';
import { FIXTURES, auditarProvocacion, disparo } from './lib/provocacion.js';

const raiz = process.cwd();
const architect = path.join(raiz, 'scripts', 'architect.js');
const rutaBaseline = path.join(raiz, 'scripts', 'provocacion.baseline.json');
const actualizar = process.argv.includes('--actualizar-baseline');

const c = { gris: '\x1b[90m', rojo: '\x1b[31m', verde: '\x1b[32m', amarillo: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };

if (!fs.existsSync(architect)) {
  console.error(`${c.rojo}No se encontró scripts/architect.js${c.reset}`);
  process.exit(1);
}

const registradas = extraerReglasRegistradas(fs.readFileSync(architect, 'utf8'));
const baseline = fs.existsSync(rutaBaseline)
  ? JSON.parse(fs.readFileSync(rutaBaseline, 'utf8')).sinFixture ?? []
  : [];

console.log(`\n${c.cyan}🎯 Provocación de reglas — ¿cada una puede fallar?${c.reset}\n`);

/** Corre el linter contra un sandbox que sólo contiene el fixture. */
function provocar(fixture) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'provocar-'));
  try {
    const destino = path.join(sandbox, fixture.ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, fixture.contenido);
    try {
      // El linter sale 1 cuando encuentra errores: eso es éxito acá.
      return execFileSync(process.execPath, [architect], {
        cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      return `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

const mudas = [];
for (const [ruleId, fixture] of Object.entries(FIXTURES)) {
  if (!registradas.includes(ruleId)) {
    console.log(`${c.amarillo}❓ ${ruleId}${c.reset} ${c.gris}— hay fixture pero la regla ya no existe en architect.js${c.reset}`);
    continue;
  }
  const salida = provocar(fixture);
  if (disparo(salida, ruleId)) {
    console.log(`${c.verde}✅ ${ruleId}${c.reset} ${c.gris}— dispara ante su violación${c.reset}`);
  } else {
    console.log(`${c.rojo}🔇 ${ruleId}${c.reset} ${c.gris}— NO dispara: la regla está registrada y no detecta nada${c.reset}`);
    mudas.push(ruleId);
  }
}

const { sinFixture, nuevasSinFixture, baselineObsoleto } = auditarProvocacion({
  registradas, conFixture: Object.keys(FIXTURES), baseline,
});

if (actualizar) {
  fs.writeFileSync(rutaBaseline, `${JSON.stringify({
    _comentario: 'Reglas sin fixture de provocación. Esta lista sólo puede achicarse: agregar una regla nueva sin fixture hace fallar el chequeo.',
    sinFixture,
  }, null, 2)}\n`);
  console.log(`\n${c.cyan}Baseline actualizado: ${sinFixture.length} regla(s) sin fixture.${c.reset}\n`);
  process.exit(0);
}

console.log('');
if (sinFixture.length > 0) {
  console.log(`${c.gris}Sin fixture todavía (${sinFixture.length}/${registradas.length}): ${sinFixture.join(', ')}${c.reset}\n`);
}

let falla = false;

if (mudas.length > 0) {
  console.error(`${c.rojo}🔇 ${mudas.length} regla(s) registradas que NO disparan ante su propia violación:${c.reset}`);
  for (const r of mudas) console.error(`   ${r}`);
  console.error(`${c.amarillo}   Una regla que no puede fallar da la sensación de estar protegido sin estarlo.${c.reset}\n`);
  falla = true;
}

if (nuevasSinFixture.length > 0) {
  console.error(`${c.rojo}🆕 ${nuevasSinFixture.length} regla(s) nuevas sin fixture: ${nuevasSinFixture.join(', ')}${c.reset}`);
  console.error(`${c.amarillo}   El momento de escribir el fixture es cuando se escribe la regla.${c.reset}\n`);
  falla = true;
}

if (baselineObsoleto.length > 0) {
  console.error(`${c.rojo}📉 El baseline quedó viejo: ${baselineObsoleto.join(', ')} ya no corresponde(n).${c.reset}`);
  console.error(`${c.amarillo}   Corré con --actualizar-baseline. Un baseline que no se achica es una lista de excusas.${c.reset}\n`);
  falla = true;
}

if (falla) process.exit(1);

console.log(`${c.verde}✅ ${Object.keys(FIXTURES).length} regla(s) provocadas y todas disparan.${c.reset}\n`);
