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

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', process.env.QA_CORREO);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.goto(`${BASE}/app/plata`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// ── AC3 de la spec 0003: subsecciones como tabs, no como entradas del menú ──
// `app-tabs` renderiza medidores ocultos para decidir el tier: sin filtrar por
// visibilidad, el selector encuentra botones que el usuario no puede tocar.
const nav = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('app-tabs button, app-tabs a')]
    .filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => e.textContent.trim()).filter(Boolean),
  menu: [...document.querySelectorAll('app-sidebar a')].map((a) => a.textContent.trim()).filter(Boolean),
}));
ok(nav.tabs.length === 2, `AC3(0003): las subsecciones son tabs — ${JSON.stringify(nav.tabs)}`);
ok(nav.menu.length === 2 && !nav.menu.some((m) => /movimientos|cuentas/i.test(m)),
   `AC3(0003): y NO entradas del menú principal — ${JSON.stringify(nav.menu)}`);
ok(page.url().includes('/plata/movimientos'), 'Plata entra por su tab por defecto');

// Cambiar de tab.
await page.locator('app-tabs button:visible', { hasText: 'Cuentas' }).first().click();
await page.waitForTimeout(2500);
ok(page.url().includes('/plata/cuentas'), `El tab navega — ${page.url().split('/app')[1]}`);

const v = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    texto: txt,
    hayCupo: /disponible|cupo superado/i.test(txt),
    hayPeriodo: /cierra en \d+ d|cierra hoy/i.test(txt),
    barras: document.querySelectorAll('article div[style*="width"]').length,
    kpis: [...document.querySelectorAll('app-section-hero span.text-lg')].map((e) => e.textContent.trim()),
    scrollDoc: document.documentElement.scrollHeight > document.documentElement.clientHeight + 2,
  };
});
ok(v.texto.includes('Mi tarjeta'), 'AC1: se ve la cuenta del hogar');
ok(v.hayCupo, 'AC6: se ve el cupo disponible');
ok(v.barras > 0, 'AC6: con barra de uso');
ok(v.hayPeriodo, 'AC7: se ve cuándo cierra el período de facturación');
ok(v.kpis.length >= 1 && v.kpis.every((k) => !/^\$?\d{4,}$/.test(k.replace(/\./g, '') ) || k.includes('.')),
   `Los KPIs llevan formato — ${JSON.stringify(v.kpis)}`);
ok(!v.scrollDoc, 'El documento no scrollea (contrato App-like)');

// ── AC-E3 de la spec 0003: recargar en la subsección deja el tab correcto ──
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const trasRecarga = await page.evaluate(() => {
  const activo = document.querySelector('app-tabs [aria-selected="true"], app-tabs .active, app-tabs [data-active="true"]');
  return { url: location.pathname, textoActivo: activo?.textContent?.trim() ?? null,
           sigueEnCuentas: document.body.innerText.includes('Mi tarjeta') };
});
ok(trasRecarga.url.includes('/plata/cuentas'), `AC-E3(0003): la recarga conserva la subsección — ${trasRecarga.url}`);
ok(trasRecarga.sigueEnCuentas, 'AC-E3(0003): y su contenido');

// ── AC7 de la spec 0003: los tabs colapsan al angostar ──
await page.setViewportSize({ width: 420, height: 800 });
await page.waitForTimeout(1500);
const angosto = await page.evaluate(() => ({
  haySelect: !!document.querySelector('app-tabs select'),
  scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  tabsVisibles: [...document.querySelectorAll('app-tabs button')].filter((b) => b.getBoundingClientRect().width > 0).length,
}));
ok(!angosto.scrollH, 'AC7(0003): al angostar no aparece scroll horizontal');
console.log(`   (a 420px: ${angosto.haySelect ? 'colapsó a select' : `${angosto.tabsVisibles} tabs visibles`})`);

ok(problemas.length === 0, `Consola y red limpias${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForTimeout(800);
await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/cuentas.png' });
await browser.close();
console.log(fallos === 0 ? '\n✅ Cuentas y tabs: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
