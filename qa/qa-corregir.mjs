import { chromium } from 'playwright';

const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const correo = process.env.QA_CORREO;
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
await page.waitForTimeout(2500);

await page.goto(`${BASE}/app/plata/movimientos`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Abrir el detalle del primer JUMBO.
const filas = page.locator('[data-llm-action="ver-movimiento"]');
const total = await filas.count();
ok(total > 0, `Las filas son clicables — ${total}`);

let idx = -1;
for (let i = 0; i < total; i++) {
  if ((await filas.nth(i).textContent())?.includes('JUMBO')) { idx = i; break; }
}
ok(idx >= 0, 'Hay un JUMBO en la lista');
await filas.nth(idx).click();
await page.waitForTimeout(1800);

const detalle = await page.evaluate(() => {
  const d = document.querySelector('app-layout-drawer');
  return {
    abierto: !!d && d.getBoundingClientRect().width > 100,
    texto: d?.textContent ?? '',
    haySelector: !!document.querySelector('#categoria'),
    mainAncho: Math.round(document.querySelector('main').getBoundingClientRect().width),
  };
});
ok(detalle.abierto, `El drawer se abre y empuja el contenido — main ${detalle.mainAncho}px`);
ok(detalle.haySelector, 'AC9: hay selector de categoría');
ok(detalle.texto.includes('De dónde salió'), 'AC5: muestra de dónde salió el movimiento');
ok(detalle.texto.includes('cargó a mano'), 'Sin captura, lo dice en vez de mostrar un bloque vacío');

// Cambiar la categoría a Restaurantes.
const opciones = await page.locator('#categoria option').allTextContents();
ok(opciones.includes('Restaurantes'), `El selector trae las categorías del hogar — ${opciones.length}`);
await page.selectOption('#categoria', { label: 'Restaurantes' });
await page.waitForTimeout(600);

const trasCambio = await page.evaluate(() => document.querySelector('app-layout-drawer')?.textContent ?? '');
ok(trasCambio.includes('Recordar este comercio'), 'AC10: ofrece recordar el comercio');
ok(!trasCambio.includes('anteriores'), 'Sin marcar recordar, no ofrece tocar el historial');

// Marcar recordar → aparece el conteo de pasados.
await page.locator('input[type="checkbox"]').first().check();
await page.waitForTimeout(1500);
const conConteo = await page.evaluate(() => document.querySelector('app-layout-drawer')?.textContent ?? '');
const m = conConteo.match(/los (\d+) anteriores/);
ok(!!m, `AC11: ofrece aplicar a los pasados CON el número a la vista — ${m?.[0]}`);
ok(m && Number(m[1]) === 3, `El conteo es exacto: 3 otros JUMBO — dice ${m?.[1]}`);

// Aceptar y guardar.
await page.locator('input[type="checkbox"]').nth(1).check();
await page.click('[data-llm-action="guardar-categoria"]');
await page.waitForTimeout(2800);

const cerrado = await page.evaluate(() => {
  const d = document.querySelector('app-layout-drawer');
  return !d || d.getBoundingClientRect().width < 50;
});
ok(cerrado, 'Al guardar, el drawer se cierra');

const listaTras = await page.evaluate(() => document.body.innerText);
ok(!/Supermercado/.test(listaTras.split('EN QUÉ SE FUE')[1]?.split('VIERNES')[0] ?? 'Supermercado')
   || /Restaurantes/.test(listaTras), 'La lista se recargó con los números nuevos');

ok(problemas.length === 0, `Consola y red limpias${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/corregir.png' });
await browser.close();
console.log(fallos === 0 ? '\n✅ Corregir y aprender: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
