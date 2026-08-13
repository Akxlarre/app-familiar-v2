import { chromium } from 'playwright';

const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// El usuario dueño del hogar sembrado.
const correo = process.env.QA_CORREO ?? 'nuevo1786515079174@casa.cl';
await fetch('http://127.0.0.1:54321/auth/v1/signup', {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: correo, password: 'prueba123456' }),
}).catch(() => {});

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };
const problemas = [];
page.on('console', (m) => m.type() === 'error' && problemas.push(m.text().slice(0, 140)));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) problemas.push(`${r.status()} ${r.url().slice(0, 90)}`); });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', correo);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// El menú derivado tiene que haber encendido Plata.
const menu = await page.evaluate(() =>
  [...document.querySelectorAll('app-sidebar a')].map((a) => a.textContent.trim()).filter(Boolean));
ok(menu.length === 2 && menu.some((m) => m.includes('Plata')),
   `El destino Plata se encendió solo — ${JSON.stringify(menu)}`);

await page.goto(`${BASE}/app/plata`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

ok(page.url().includes('/app/plata/movimientos'), `Plata redirige a movimientos — ${page.url()}`);

const v = await page.evaluate(() => {
  const txt = document.body.innerText;
  const kpis = [...document.querySelectorAll('app-section-hero span.text-lg')].map((e) => e.textContent.trim());
  const filas = [...document.querySelectorAll('.bento-fill li')];
  const dias = [...document.querySelectorAll('.bento-fill section h3')].map((h) => h.textContent.trim());
  const barras = document.querySelectorAll('.bento-fill section ul li div[style*="width"]').length;
  return {
    texto: txt,
    kpis,
    filas: filas.length,
    dias,
    barras,
    scrollDoc: document.documentElement.scrollHeight > document.documentElement.clientHeight + 2,
    scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

ok(v.kpis.length === 3, `AC6: el hero muestra los tres números — ${JSON.stringify(v.kpis)}`);
// AC3: punto de miles, sin decimales.
// `[].every()` es true: sin exigir que haya KPIs, este test pasaba sobre vacío.
ok(v.kpis.length > 0 && v.kpis.every((k) => /^−?\$\d{1,3}(\.\d{3})*$/.test(k)),
   `AC3: los KPIs llevan punto de miles y ningún decimal — ${JSON.stringify(v.kpis)}`);
ok(/\$\s?\d{1,3}\.\d{3}/.test(v.texto), 'AC3: punto como separador de miles');
ok(v.filas > 5, `AC1: la lista trae movimientos — ${v.filas} filas`);
ok(v.dias.length > 1, `AC1: agrupados por día — ${v.dias.length} días`);
ok(v.barras > 2, `AC7: el reparto por categoría se ve — ${v.barras} categorías`);
ok(v.texto.includes('Sin categorizar'), 'AC-E1: los sin categoría se ven, no se esconden');
ok(v.texto.includes('JUMBO MAIPU'), 'Aparecen comercios reales');
ok(!v.scrollDoc, 'AC contrato App-like: el documento no scrollea en desktop');
ok(!v.scrollH, 'Sin scroll horizontal');

// Selector de período: el mes anterior tiene datos distintos.
const antes = v.kpis[0];
await page.click('[data-llm-action="periodo-anterior"]');
await page.waitForTimeout(2000);
const despues = await page.evaluate(() =>
  document.querySelector('app-section-hero span.text-lg')?.textContent?.trim());
// `undefined !== antes` también es true: sin exigir un valor con formato, este
// test pasaba justo cuando el hero dejaba de renderizar.
ok(!!despues && /^−?\$[\d.]+$/.test(despues) && despues !== antes,
   `El selector de período cambia los números — ${antes} → ${despues}`);

ok(problemas.length === 0, `Consola y red limpias${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/plata.png' });
await browser.close();
console.log(fallos === 0 ? '\n✅ Plata: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
