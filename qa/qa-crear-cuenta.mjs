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

const drawerTexto = () => page.evaluate(() =>
  document.querySelector('app-layout-drawer')?.textContent ?? '');

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', process.env.QA_CORREO);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.goto(`${BASE}/app/plata/cuentas`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// ── AC3: el tipo se elige primero y define los campos ────────────────────────
await page.click('[data-llm-action="nueva-cuenta"]');
await page.waitForTimeout(1500);

ok(await page.locator('[data-llm-action="elegir-tipo-credito"]').count() > 0,
   'AC1: el alta arranca eligiendo el tipo');
ok(await page.locator('#c-cupo').count() > 0, 'AC2: crédito pide cupo y fechas');

await page.click('[data-llm-action="elegir-tipo-efectivo"]');
await page.waitForTimeout(700);
const conEfectivo = {
  cupo: await page.locator('#c-cupo').count(),
  facturacion: await page.locator('#c-facturacion').count(),
};
ok(conEfectivo.cupo === 0 && conEfectivo.facturacion === 0,
   'AC3: en efectivo esos campos NO existen — no están apagados');

// Crear la cuenta de efectivo.
await page.fill('#c-nombre', 'Plata en efectivo');
await page.selectOption('#c-banco', { index: 1 });
await page.click('[data-llm-action="guardar-cuenta"]');
await page.waitForTimeout(2800);

const trasCrear = await page.evaluate(() => document.body.innerText);
ok(trasCrear.includes('Plata en efectivo'), 'La cuenta aparece en la lista al crearla');
ok(/EFECTIVO/i.test(trasCrear), 'Se muestra con su tipo');

// ── AC10: vincular un parser desde la edición ────────────────────────────────
const filas = page.locator('[data-llm-action="editar-cuenta"]');
await filas.first().click();
await page.waitForTimeout(2000);

const conParsers = await drawerTexto();
ok(/Correos que entran a esta cuenta/.test(conParsers),
   'AC10: la edición ofrece vincular los correos del banco');
ok(/asunto dice|Todos los correos/.test(conParsers),
   'AC-E1: se ve el patrón de asunto, que es lo que distingue dos cuentas del mismo banco');

const checks = page.locator('app-layout-drawer input[type="checkbox"]');
const cuantos = await checks.count();
if (cuantos > 0) {
  const estabaMarcado = await checks.first().isChecked();
  await checks.first().click();
  await page.waitForTimeout(2500);
  const ahora = await page.locator('app-layout-drawer input[type="checkbox"]').first().isChecked();
  ok(ahora !== estabaMarcado, `Vincular/desvincular funciona — ${estabaMarcado} → ${ahora}`);
} else {
  ok(false, 'No hay parsers que vincular');
}

ok(problemas.length === 0, `Consola y red limpias${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/crear-cuenta.png' });
await browser.close();
console.log(fallos === 0 ? '\n✅ Crear y vincular: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
