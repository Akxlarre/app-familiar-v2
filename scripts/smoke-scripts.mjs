#!/usr/bin/env node
/**
 * Smoke de los scripts de package.json.
 *
 *   node scripts/smoke-scripts.mjs
 *   node scripts/smoke-scripts.mjs --solo typecheck,test:ci
 *
 * No pregunta si los scripts pasan. Pregunta si **pueden fallar**, que es la
 * pregunta que ningún CI hace y la única que encuentra un comando decorativo.
 *
 * Para los que comprueban código, introduce un defecto a propósito y exige que
 * el script se dé cuenta. El archivo tocado se restaura siempre, incluso si el
 * proceso muere: se escribe una copia antes y se repone en el `finally`.
 *
 * Tarda. Está pensado para correrse al cerrar una sesión o antes de publicar,
 * no en cada guardado.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { clasificar, veredicto, resumir, COMPROBACIONES } from './lib/smoke-scripts.js';

const raiz = process.cwd();
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const soloArg = process.argv.indexOf('--solo');
const solo = soloArg !== -1 ? (process.argv[soloArg + 1] ?? '').split(',').filter(Boolean) : null;

const c = {
  gris: '\x1b[90m', rojo: '\x1b[31m', verde: '\x1b[32m',
  amarillo: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m',
};

// ─── Los defectos que se introducen ─────────────────────────────────────────
//
// Cada uno tiene que ser algo que la herramienta correspondiente NO pueda
// ignorar. Un defecto sutil produciría un falso "decorativo" y haría que este
// smoke mienta en la dirección contraria.

const DEFECTOS = {
  /** Un tipo imposible. Cualquier compilador de TypeScript lo rechaza. */
  tipo: {
    archivo: () => primerArchivo('src/app', (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')),
    inyectar: (texto) => `${texto}\nconst __smokeDefecto: number = "no soy un número";\n`,
  },
  /**
   * Una violación arquitectónica. Un componente sin OnPush es ARCH-04, que es
   * de las reglas más antiguas y menos probable que alguien desactive.
   */
  arquitectura: {
    archivo: () => path.join('src', 'app', 'features', '__smoke-defecto.component.ts'),
    crear: true,
    contenido: [
      "import { Component } from '@angular/core';",
      '',
      '// Archivo temporal del smoke: viola ARCH-04 (falta OnPush) a propósito.',
      '@Component({',
      "  selector: 'app-smoke-defecto',",
      '  standalone: true,',
      "  template: '<p>defecto</p>',",
      '})',
      'export class SmokeDefectoComponent {}',
      '',
    ].join('\n'),
  },
};

function primerArchivo(dir, filtro) {
  const pendientes = [path.join(raiz, dir)];
  while (pendientes.length > 0) {
    const actual = pendientes.shift();
    if (!fs.existsSync(actual)) continue;
    for (const nombre of fs.readdirSync(actual)) {
      const completo = path.join(actual, nombre);
      if (fs.statSync(completo).isDirectory()) { pendientes.push(completo); continue; }
      if (filtro(completo)) return path.relative(raiz, completo);
    }
  }
  return null;
}

function correr(script) {
  const inicio = Date.now();
  try {
    const salida = execFileSync(NPM, ['run', script], {
      cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000,
    });
    return { exit: 0, salida, ms: Date.now() - inicio };
  } catch (e) {
    const salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    return { exit: e.status ?? 1, salida, ms: Date.now() - inicio };
  }
}

/**
 * Corre el script con un defecto adentro y devuelve su exit code.
 *
 * El `finally` es la parte que importa: si esto deja un defecto puesto, rompe el
 * repositorio de quien lo corrió. Por eso el respaldo se escribe en el temp del
 * sistema y no al lado del archivo — un `.bak` olvidado en `src/` también rompe
 * el build.
 */
function provocar(script, nombreDefecto) {
  const defecto = DEFECTOS[nombreDefecto];
  if (!defecto) return null;

  const relativo = typeof defecto.archivo === 'function' ? defecto.archivo() : defecto.archivo;
  if (!relativo) return null;

  const absoluto = path.join(raiz, relativo);
  const creado = Boolean(defecto.crear);
  const respaldo = creado ? null : path.join(os.tmpdir(), `smoke-${Date.now()}.bak`);

  try {
    if (creado) {
      fs.mkdirSync(path.dirname(absoluto), { recursive: true });
      fs.writeFileSync(absoluto, defecto.contenido);
    } else {
      const original = fs.readFileSync(absoluto, 'utf8');
      fs.writeFileSync(respaldo, original);
      fs.writeFileSync(absoluto, defecto.inyectar(original));
    }
    return correr(script).exit;
  } finally {
    if (creado) {
      fs.rmSync(absoluto, { force: true });
    } else if (respaldo && fs.existsSync(respaldo)) {
      fs.copyFileSync(respaldo, absoluto);
      fs.rmSync(respaldo, { force: true });
    }
  }
}

// ─── Ejecución ───────────────────────────────────────────────────────────────

const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};

console.log(`\n${c.cyan}🔥 Smoke de scripts — ¿pueden fallar, o sólo pasar?${c.reset}\n`);

const saltados = [];
const veredictos = [];

for (const [nombre, comando] of Object.entries(scripts)) {
  if (solo && !solo.includes(nombre)) continue;

  const clase = clasificar(nombre, comando);
  if (clase !== 'verificable') {
    saltados.push({ nombre, clase });
    continue;
  }

  process.stdout.write(`${c.gris}  ${nombre}…${c.reset}`);
  const limpio = correr(nombre);

  let exitProvocado;
  const comprobacion = COMPROBACIONES[nombre];
  if (limpio.exit === 0 && comprobacion?.modo === 'provocar') {
    exitProvocado = provocar(nombre, comprobacion.defecto);
  }

  const v = veredicto({
    nombre, exitLimpio: limpio.exit, salida: limpio.salida, exitProvocado,
  });
  veredictos.push({ nombre, ...v, ms: limpio.ms });

  const icono = { ok: `${c.verde}✅`, roto: `${c.rojo}🚨`, decorativo: `${c.rojo}🎭`, 'sin-comprobar': `${c.amarillo}❓` }[v.estado];
  process.stdout.write(`\r${icono} ${nombre}${c.reset} ${c.gris}— ${v.motivo} (${(limpio.ms / 1000).toFixed(1)}s)${c.reset}\n`);
}

if (saltados.length > 0) {
  console.log(`\n${c.gris}No se corren: ${saltados.map((s) => `${s.nombre} (${s.clase})`).join(', ')}${c.reset}`);
}

const r = resumir(veredictos);
console.log('');

const decorativos = veredictos.filter((v) => v.estado === 'decorativo');
if (decorativos.length > 0) {
  console.log(`${c.rojo}🎭 ${decorativos.length} script(s) decorativos — pasan sin comprobar nada:${c.reset}`);
  for (const d of decorativos) console.log(`   ${d.nombre}: ${d.motivo}`);
  console.log(`${c.amarillo}   Un script que sale 0 sin mirar nada es peor que uno ausente: el ausente se nota.${c.reset}\n`);
}

if (r.falla) {
  console.error(`${c.rojo}❌ Smoke falló: ${r.roto} roto(s), ${r.decorativo} decorativo(s), ${r.ok} bien.${c.reset}\n`);
  process.exit(1);
}

console.log(`${c.verde}✅ ${r.ok} script(s) comprobados${c.reset}${r['sin-comprobar'] > 0 ? `${c.gris}, ${r['sin-comprobar']} sin forma declarada de fallar${c.reset}` : ''}\n`);
