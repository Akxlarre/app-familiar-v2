import { chromium } from 'playwright';

const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };
const problemas = [];
page.on('console', (m) => m.type() === 'error' && problemas.push(m.text().slice(0, 140)));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) problemas.push(`${r.status()} ${r.url().slice(0, 90)}`); });

const kpiGastado = () => page.evaluate(() =>
  document.querySelector('app-section-hero span.text-lg')?.textContent?.trim());
const filas = () => page.locator('[data-llm-action="ver-movimiento"]').count();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', process.env.QA_CORREO);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.goto(`${BASE}/app/plata/movimientos`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const gastadoTotal = await kpiGastado();
const filasTotal = await filas();
ok(!page.url().includes('?'), `El mes en curso no ensucia la URL — ${page.url().split('/').pop()}`);

// Filtrar por categoría.
await page.click('[data-llm-action="abrir-filtros"]');
await page.waitForTimeout(500);
await page.selectOption('#f-categoria', { label: 'Supermercado' });
await page.waitForTimeout(2000);

const gastadoFiltrado = await kpiGastado();
const filasFiltradas = await filas();
ok(page.url().includes('categoria='), `AC14: el filtro va a la URL — ${page.url().split('?')[1]}`);
ok(filasFiltradas < filasTotal, `AC13: la lista se filtra — ${filasTotal} → ${filasFiltradas}`);
ok(gastadoFiltrado !== gastadoTotal,
   `AC13: los números del hero se recalculan sobre lo filtrado — ${gastadoTotal} → ${gastadoFiltrado}`);

// AC14: recargar conserva el filtro.
const urlConFiltro = page.url();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const trasRecarga = await page.evaluate(() => ({
  categoria: document.querySelector('#f-categoria')?.value ?? null,
  abierta: !!document.querySelector('#f-categoria'),
}));
ok(page.url() === urlConFiltro, 'AC14: la URL sobrevive a la recarga');
ok(trasRecarga.abierta, 'La barra de filtros se abre sola si la URL trae filtros');
ok(await kpiGastado() === gastadoFiltrado, `AC14: los números siguen filtrados tras recargar`);
ok(await filas() === filasFiltradas, 'AC14: la lista sigue filtrada tras recargar');

// Búsqueda por texto, insensible a mayúsculas (AC15).
await page.fill('#f-texto', 'jumbo');
await page.waitForTimeout(2200);
const conTexto = await filas();
ok(conTexto > 0 && conTexto <= filasFiltradas,
   `AC15: buscar "jumbo" en minúsculas encuentra JUMBO MAIPU — ${conTexto} filas`);

// Volver atrás con el navegador.
await page.goBack({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
ok(!page.url().includes('q=jumbo'), 'El botón atrás deshace el filtro de texto');

// Limpiar.
await page.click('[data-llm-action="limpiar-filtros"]').catch(() => {});
await page.waitForTimeout(2000);
ok(await filas() === filasTotal, `Limpiar devuelve la lista completa — ${await filas()}`);

ok(problemas.length === 0, `Consola y red limpias${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/filtros.png' });
await browser.close();
console.log(fallos === 0 ? '\n✅ Filtros: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
