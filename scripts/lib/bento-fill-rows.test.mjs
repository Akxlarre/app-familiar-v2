/**
 * Micro-suite de bento-fill-rows.js. Sin framework:
 * `node scripts/lib/bento-fill-rows.test.mjs`. Exit 1 si algún caso falla.
 */
import { findFillScreenRowViolations, readRowSpan, readStaticClass } from './bento-fill-rows.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const causes = (markup) => findFillScreenRowViolations(markup).flatMap((v) => v.causes);

// ── readStaticClass ──────────────────────────────────────────────────────────
check('lee class con comillas dobles', readStaticClass(' class="a b"') === 'a b');
check("lee class con comillas simples", readStaticClass(" class='a b'") === 'a b');
check('ignora [class] dinámico', readStaticClass(' [class]="expr"') === '');
check(
  'no confunde un atributo terminado en "class"',
  readStaticClass(' data-class="x"') === '',
);

// ── readRowSpan ──────────────────────────────────────────────────────────────
check('lee data-row-span', readRowSpan(' data-row-span="2"') === 2);
check('toma el mayor entre -md y base', readRowSpan(' data-row-span-md="3" data-row-span="2"') === 3);
check('sin atributo devuelve 0', readRowSpan(' class="bento-banner"') === 0);

// ── El bug real: .bento-feature dentro de un grid fill-screen ────────────────
check(
  'detecta .bento-feature como hijo directo de --fill-screen-kpi',
  causes(`
    <div class="bento-grid bento-grid--fill-screen-kpi">
      <div class="bento-banner"></div>
      <div class="bento-feature"></div>
    </div>
  `).includes('bento-feature'),
);
check(
  'detecta .bento-hero y .bento-tall',
  causes(`
    <section class="bento-grid bento-grid--fill-screen">
      <div class="bento-hero"></div>
      <div class="bento-tall"></div>
    </section>
  `).sort().join(',') === 'bento-hero,bento-tall',
);
check(
  'detecta data-row-span="2" aunque la clase sea de una fila',
  causes(`
    <div class="bento-grid bento-grid--fill-screen-2">
      <div class="bento-banner" data-row-span="2"></div>
    </div>
  `).join(',') === 'data-row-span="2"',
);

// ── La forma correcta NO se marca ────────────────────────────────────────────
check(
  'acepta el patrón correcto (todo .bento-banner, KPIs anidados)',
  findFillScreenRowViolations(`
    <div class="bento-grid bento-grid--fill-screen-kpi">
      <header class="bento-banner"></header>
      <div class="bento-banner">
        <div class="grid grid-cols-4"><article class="bento-card"></article></div>
      </div>
      <div class="bento-banner bento-fill"></div>
    </div>
  `).length === 0,
);
check(
  'data-row-span="1" explícito es válido',
  findFillScreenRowViolations(
    '<div class="bento-grid bento-grid--fill-screen"><div data-row-span="1"></div></div>',
  ).length === 0,
);

// ── Alcance: solo hijos DIRECTOS de un grid fill-screen ─────────────────────
check(
  'no marca un .bento-feature de un grid normal',
  findFillScreenRowViolations(`
    <div class="bento-grid bento-grid--fill-screen"><div class="bento-banner"></div></div>
    <div class="bento-grid"><div class="bento-feature"></div></div>
  `).length === 0,
);
check(
  'no marca un .bento-feature de un grid anidado dentro de la celda .bento-fill',
  findFillScreenRowViolations(`
    <div class="bento-grid bento-grid--fill-screen">
      <div class="bento-banner bento-fill">
        <div class="bento-grid"><div class="bento-feature"></div></div>
      </div>
    </div>
  `).length === 0,
);
check(
  'no hace nada si no hay ningún grid fill-screen',
  findFillScreenRowViolations('<div class="bento-grid"><div class="bento-hero"></div></div>')
    .length === 0,
);

// ── Transparencias del markup Angular ───────────────────────────────────────
check(
  've a través de <ng-container> (no renderiza elemento)',
  causes(`
    <div class="bento-grid bento-grid--fill-screen">
      <ng-container><div class="bento-feature"></div></ng-container>
    </div>
  `).includes('bento-feature'),
);
check(
  'los bloques @for/@if no cambian el anidamiento',
  causes(`
    <div class="bento-grid bento-grid--fill-screen-2">
      @for (item of items(); track item.id) {
        <div class="bento-tall"></div>
      }
    </div>
  `).includes('bento-tall'),
);
check(
  'componentes self-closing no abren nivel',
  causes(`
    <div class="bento-grid bento-grid--fill-screen">
      <app-kpi class="bento-banner" />
      <app-panel class="bento-feature" />
    </div>
  `).join(',') === 'bento-feature',
);
check(
  'los void tags no desbalancean la pila',
  causes(`
    <div class="bento-grid bento-grid--fill-screen">
      <img src="a.png">
      <div class="bento-hero"></div>
    </div>
  `).includes('bento-hero'),
);
check(
  'un ">" dentro de un binding no rompe el parseo',
  causes(`
    <div class="bento-grid bento-grid--fill-screen">
      <div [attr.aria-hidden]="a > b" class="bento-feature"></div>
    </div>
  `).includes('bento-feature'),
);
check(
  'ignora comentarios HTML',
  findFillScreenRowViolations(`
    <div class="bento-grid bento-grid--fill-screen">
      <!-- <div class="bento-feature"></div> -->
      <div class="bento-banner"></div>
    </div>
  `).length === 0,
);
check(
  'no confunde un prefijo de clase (bento-feature-x no es bento-feature)',
  findFillScreenRowViolations(
    '<div class="bento-grid bento-grid--fill-screen"><div class="bento-featured"></div></div>',
  ).length === 0,
);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallidos`);
  process.exit(1);
}
console.log('\n✅ bento-fill-rows: todos los casos pasan');
