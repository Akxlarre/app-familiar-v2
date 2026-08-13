import { chromium } from 'playwright';

// AC-E4 de la spec 0005 y AC-E1 de la 0002. Lo que se mide no es si Postgres
// aguanta —aguanta— sino si la PANTALLA se trae el conjunto completo. El modo
// de fallar de una lista es pedir todo y paginar en el cliente, y eso no se
// nota hasta que hay volumen.
const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };

// Se contabiliza lo que la app pide de verdad, no lo que uno cree que pide.
const consultas = [];
page.on('response', async (r) => {
  if (!r.url().includes('/rest/v1/')) return;
  let filas = null, bytes = null;
  try {
    const cuerpo = await r.text();
    bytes = cuerpo.length;
    const json = JSON.parse(cuerpo);
    filas = Array.isArray(json) ? json.length : null;
  } catch { /* respuesta no-JSON */ }
  consultas.push({ url: r.url().split('/rest/v1/')[1].slice(0, 60), filas, bytes });
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', process.env.QA_CORREO);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

consultas.length = 0;
const t0 = Date.now();
await page.goto(`${BASE}/app/plata/movimientos`, { waitUntil: 'domcontentloaded' });
await page.locator('[data-llm-action="ver-movimiento"]').first().waitFor({ timeout: 30000 });
const tPrimerRender = Date.now() - t0;

const filasVisibles = await page.locator('[data-llm-action="ver-movimiento"]').count();
const mayor = consultas.reduce((a, c) => (c.filas ?? 0) > (a.filas ?? 0) ? c : a, { filas: 0 });
const totalBytes = consultas.reduce((s, c) => s + (c.bytes ?? 0), 0);

console.log(`\n   consultas REST: ${consultas.length} · ${(totalBytes / 1024).toFixed(1)} kB en total`);
for (const c of consultas) console.log(`     · ${c.filas ?? '—'} filas  ${c.url}`);
console.log('');

ok(tPrimerRender < 30000, `RNF-02: primer render en ${(tPrimerRender / 1000).toFixed(1)}s (límite 30s)`);
ok((mayor.filas ?? 0) <= 50,
   `AC-E4: NO se trae el conjunto completo — la consulta mayor devolvió ${mayor.filas} filas, no 5.032`);
ok(filasVisibles <= 50, `Se pintan ${filasVisibles} filas, no miles`);
ok(totalBytes < 500 * 1024, `La carga inicial pesa ${(totalBytes / 1024).toFixed(1)} kB`);

// Paginar: "Ver más" trae otra página, no vuelve a pedir todo.
const antes = consultas.length;
const verMas = page.locator('[data-llm-action="cargar-mas-movimientos"]');
if (await verMas.count()) {
  await verMas.click();
  await page.waitForTimeout(2500);
  const nuevas = consultas.slice(antes);
  const mayorPagina = nuevas.reduce((a, c) => (c.filas ?? 0) > (a.filas ?? 0) ? c : a, { filas: 0 });
  ok((mayorPagina.filas ?? 0) <= 50, `"Ver más" pide una página, no el resto — ${mayorPagina.filas} filas`);
  ok(await page.locator('[data-llm-action="ver-movimiento"]').count() > filasVisibles,
     'La lista creció sin recargar la pantalla (AC4)');
} else {
  console.log('   (sin "Ver más": el mes en curso cabe en una página)');
}

// El scroll vive dentro del panel, no en el documento (contrato App-like).
const scrollDoc = await page.evaluate(() =>
  document.documentElement.scrollHeight > document.documentElement.clientHeight + 2);
ok(!scrollDoc, 'Con 5.000 movimientos el documento sigue sin scrollear');

await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/volumen.png' });
await browser.close();
console.log(fallos === 0 ? '\n✅ Volumen: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
