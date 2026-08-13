import { chromium } from 'playwright';

// Un usuario nuevo de verdad: signup, onboarding, hogar creado en Postgres.
const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const correo = `nuevo${Date.now()}@casa.cl`;

// El alta se hace por API para llegar al onboarding con sesión limpia: la
// pantalla de registro es del boilerplate y no es lo que esta spec construye.
const alta = await fetch(`http://127.0.0.1:54321/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: correo, password: 'prueba123456' }),
}).then((r) => r.json());
if (!alta.access_token) { console.log('❌ no se pudo crear el usuario', alta); process.exit(1); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };
const problemas = [];
page.on('console', (m) => m.type() === 'error' && problemas.push(m.text().slice(0, 140)));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) problemas.push(`${r.status()} ${r.url().slice(0, 80)}`); });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', correo);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

ok(page.url().includes('/onboarding') || page.url().includes('/app'),
   `Tras el login llega a algún lado: ${page.url()}`);

// AC1: un usuario sin hogar tiene que poder llegar al onboarding.
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const inicio = await page.evaluate(() => ({
  paso: document.querySelector('.micro-label')?.textContent?.trim(),
  titulo: document.querySelector('h1')?.textContent?.trim(),
  hayDosCaminos: document.querySelectorAll('[role="tab"]').length === 2,
  hayCampoNombre: !!document.querySelector('#nombre-hogar'),
  hayNavegacion: !!document.querySelector('app-sidebar, app-bottom-nav'),
}));

ok(inicio.paso === 'Paso 1 de 4', `Arranca en el paso 1 — ${JSON.stringify(inicio.paso)}`);
ok(inicio.titulo === 'Tu hogar', `El título es del paso — ${JSON.stringify(inicio.titulo)}`);
ok(inicio.hayDosCaminos, 'Dos caminos: crear o unirse');
ok(inicio.hayCampoNombre, 'El camino por defecto es crear');
ok(!inicio.hayNavegacion, 'AC1: sin navegación — no se puede escapar a otra pantalla');

// AC2: crear el hogar y ver el código.
await page.fill('#nombre-hogar', 'Casa de Prueba');
await page.click('[data-llm-action="confirmar-hogar"]');
await page.waitForTimeout(2500);

const tras = await page.evaluate(() => {
  const code = document.querySelector('code');
  return {
    codigo: code?.textContent?.trim() ?? null,
    paso: document.querySelector('.micro-label')?.textContent?.trim(),
    hayCopiar: !!document.querySelector('[data-llm-action="copiar-codigo"]'),
    texto: document.body.innerText,
  };
});

ok(/^[BCDFGHJKLMNPQRSTVWXYZ23456789]{6}$/.test(tras.codigo ?? ''),
   `AC2: muestra un invite_code válido — ${JSON.stringify(tras.codigo)}`);
ok(tras.hayCopiar, 'AC2: hay botón para copiarlo');
ok(tras.texto.includes('Casa de Prueba'), 'Muestra el nombre del hogar creado');
ok(tras.paso === 'Paso 1 de 4', `Se queda en el paso 1 para mostrar el código — ${JSON.stringify(tras.paso)}`);

// Recién al confirmar avanza.
await page.click('[data-llm-action="continuar-desde-hogar"]');
await page.waitForTimeout(800);
const avanzado = await page.evaluate(() => document.querySelector('.micro-label')?.textContent?.trim());
ok(avanzado === 'Paso 2 de 4', `Al continuar avanza — ${JSON.stringify(avanzado)}`);

// ── Paso 2: banco y primera cuenta ──────────────────────────────────────────
await page.waitForTimeout(1200);
const paso2 = await page.evaluate(() => ({
  titulo: document.querySelector('h1')?.textContent?.trim(),
  bancos: [...document.querySelectorAll('#banco option')].map((o) => o.textContent.trim()),
  hayRegex: /regex|patr[oó]n|\\d\{/i.test(document.body.innerText),
  explicaPorQue: document.body.innerText.includes('a qué tarjeta corresponde'),
}));
ok(paso2.titulo === 'Tu banco', `Paso 2 es el banco — ${JSON.stringify(paso2.titulo)}`);
ok(paso2.bancos.length > 5, `AC14: el catálogo llega — ${paso2.bancos.length - 1} bancos`);
ok(!paso2.hayRegex, 'AC14: el usuario nunca ve un regex');
ok(paso2.explicaPorQue, 'Explica por qué hace falta la cuenta');

await page.selectOption('#banco', 'BancoEstado');
await page.fill('#nombre-cuenta', 'Mi tarjeta');
await page.fill('#last4', '4321');
await page.click('[data-llm-action="crear-primera-cuenta"]');
await page.waitForTimeout(2500);

const paso3 = await page.evaluate(() => document.querySelector('.micro-label')?.textContent?.trim());
ok(paso3 === 'Paso 3 de 4', `Al crear la cuenta avanza al correo — ${JSON.stringify(paso3)}`);

// AC-E2: quien ya tiene todo no debería volver acá. Con el onboarding a medias
// (sin cuenta ni correo) todavía SÍ debe poder verlo.
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
ok(page.url().includes('/onboarding'), 'A medio configurar, el onboarding sigue accesible');

ok(problemas.length === 0, `Consola y red limpias${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await page.screenshot({ path: new URL('./capturas/', import.meta.url).pathname + '/onboarding.png' });
await browser.close();

console.log(fallos === 0 ? '\n✅ Onboarding paso 1: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
