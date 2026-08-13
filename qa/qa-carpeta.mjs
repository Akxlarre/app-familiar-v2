import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

// AC8 y AC9 — elegir la carpeta a vigilar y desconectar la casilla.
//
// Lo que se siembra a mano es SÓLO la fila de la integración: el canje con
// Google necesita un consentimiento real. Todo lo que esta tanda comprueba
// —el UPDATE por columna, la policy, el DELETE— corre por PostgREST de verdad
// con el JWT del usuario, que es justamente lo que se acaba de construir.
const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DIR = new URL('./capturas/', import.meta.url).pathname;
const correo = `carpeta${Date.now()}@casa.cl`;

const sql = (q) =>
  execFileSync('docker', ['exec', 'supabase_db_app-familiar-v2', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', q])
    .toString().trim();

const alta = await fetch('http://127.0.0.1:54321/auth/v1/signup', {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: correo, password: 'prueba123456' }),
}).then((r) => r.json());
if (!alta.access_token) { console.log('❌ no se pudo crear el usuario', alta); process.exit(1); }
const uid = JSON.parse(Buffer.from(alta.access_token.split('.')[1], 'base64').toString()).sub;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };
const problemas = [];
// Las dos sondas de más abajo provocan un 400 y un 403 a propósito — son el
// resultado que se está comprobando, no un problema.
let sondando = false;
page.on('response', (r) => {
  if (r.status() < 400 || r.url().includes('favicon') || sondando) return;
  problemas.push(`${r.status()} ${r.url().slice(-60)}`);
});

// ── Hogar y cuenta por la UI ────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', correo);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.fill('#nombre-hogar', 'Casa de la Carpeta');
await page.click('[data-llm-action="confirmar-hogar"]');
await page.waitForTimeout(2500);
await page.click('[data-llm-action="continuar-desde-hogar"]');
await page.waitForTimeout(1500);
await page.selectOption('#banco', 'BancoEstado');
await page.fill('#nombre-cuenta', 'Mi tarjeta');
await page.fill('#last4', '4321');
await page.click('[data-llm-action="crear-primera-cuenta"]');
await page.waitForTimeout(2500);

// ── Simular la respuesta de Google, y nada más ──────────────────────────────
// La fila se inserta DENTRO del handler, en el instante en que la función
// habría contestado: si se sembrara antes, `onboardingGuard` vería el
// onboarding completo y mandaría a Hoy antes de llegar a la pantalla.
const hogar = sql(`SELECT household_id FROM public.profiles WHERE id='${uid}';`);
await page.route('**/functions/v1/gmail-oauth', (route) => {
  sql(`INSERT INTO public.integraciones_email
         (household_id, profile_id, proveedor, email, access_token, refresh_token, carpeta, estado)
       VALUES ('${hogar}','${uid}','gmail','${correo}','at-falso','rt-falso','INBOX','activa');`);
  route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({ ok: true, email: correo }),
  });
});

// Pedir el consentimiento para tener un `state` válido, y volver con él.
await page.route('https://accounts.google.com/**', (route) =>
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>google</body></html>' }));
await page.click('[data-llm-action="conectar-correo"]');
await page.waitForTimeout(1500);
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const state = await page.evaluate(() => sessionStorage.getItem('onboarding.google.state'));
await page.goto(`${BASE}/onboarding?code=4/simulado&state=${state}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const conectado = await page.evaluate(() => ({
  paso: document.querySelector('.micro-label')?.textContent?.trim(),
  texto: document.body.innerText,
  carpeta: document.querySelector('#carpeta')?.value,
  opciones: [...document.querySelectorAll('#carpeta option')].map((o) => o.textContent.trim()),
  hayDesconectar: !!document.querySelector('[data-llm-action="desconectar-correo"]'),
  hayContinuar: !!document.querySelector('[data-llm-action="continuar-desde-correo"]'),
}));

ok(conectado.paso === 'Paso 3 de 4', `Con el correo conectado se queda en el paso 3 — ${JSON.stringify(conectado.paso)}`);
ok(conectado.texto.includes(correo), `Muestra QUÉ casilla quedó conectada — ${correo}`);
ok(conectado.carpeta === 'INBOX', `La carpeta actual sale de la base — ${conectado.carpeta}`);
ok(conectado.opciones.includes('Actualizaciones'), 'Ofrece la etiqueta donde Gmail suele poner los avisos del banco');
ok(conectado.hayDesconectar && conectado.hayContinuar, 'AC9: hay desconectar, y hay continuar');
ok(!conectado.texto.includes('rt-falso') && !conectado.texto.includes('at-falso'),
   'RNF-05: ningún token aparece en la pantalla');
await page.screenshot({ path: `${DIR}/correo-conectado.png` });

// El token tampoco puede viajar: se mira la RED, no el DOM.
let tokenEnLaRed = false;
page.on('response', async (r) => {
  if (!r.url().includes('integraciones')) return;
  try { if ((await r.text()).includes('rt-falso')) tokenEnLaRed = true; } catch { /* sin cuerpo */ }
});

// ── AC8: cambiar la carpeta, y comprobarlo en Postgres ──────────────────────
await page.selectOption('#carpeta', 'CATEGORY_UPDATES');
await page.waitForTimeout(2500);

const enBd = sql(`SELECT carpeta FROM public.integraciones_email WHERE profile_id='${uid}';`);
ok(enBd === 'CATEGORY_UPDATES', `AC8: el cambio llegó a Postgres — carpeta = ${enBd}`);
const enPantalla = await page.evaluate(() => document.querySelector('#carpeta')?.value);
ok(enPantalla === 'CATEGORY_UPDATES', `Y la pantalla muestra lo que quedó — ${enPantalla}`);

// ── El GRANT por columna: la app no puede tocar una credencial ──────────────
sondando = true;
const escribirToken = await page.evaluate(async ([base, anon]) => {
  const clave = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  const jwt = JSON.parse(localStorage.getItem(clave)).access_token;
  const r = await fetch(`${base}/rest/v1/integraciones_email?select=id`, {
    method: 'PATCH',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: 'rt-del-atacante' }),
  });
  return { status: r.status, cuerpo: (await r.text()).slice(0, 120) };
}, ['http://127.0.0.1:54321', ANON]);

ok(escribirToken.status >= 400, `Escribir el refresh_token se rechaza — HTTP ${escribirToken.status}`);
const intacto = sql(`SELECT refresh_token FROM public.integraciones_email WHERE profile_id='${uid}';`);
ok(intacto === 'rt-falso', `Y el token sigue siendo el de antes — ${intacto}`);

const leerToken = await page.evaluate(async ([base, anon]) => {
  const clave = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  const jwt = JSON.parse(localStorage.getItem(clave)).access_token;
  const r = await fetch(`${base}/rest/v1/integraciones_email?select=refresh_token`, {
    headers: { apikey: anon, Authorization: `Bearer ${jwt}` },
  });
  return { status: r.status, cuerpo: (await r.text()).slice(0, 120) };
}, ['http://127.0.0.1:54321', ANON]);
ok(leerToken.status >= 400 || !leerToken.cuerpo.includes('rt-falso'),
   `Leerlo tampoco — HTTP ${leerToken.status} ${leerToken.cuerpo.slice(0, 50)}`);
ok(!tokenEnLaRed, 'Ninguna respuesta que la app pidió trae el token');
sondando = false;

// ── AC9: desconectar ────────────────────────────────────────────────────────
await page.click('[data-llm-action="desconectar-correo"]');
await page.waitForTimeout(2500);

const quedan = sql(`SELECT count(*) FROM public.integraciones_email WHERE profile_id='${uid}';`);
ok(quedan === '0', `AC9: desconectar borra la fila y con ella los tokens — quedan ${quedan}`);

const tras = await page.evaluate(() => ({
  paso: document.querySelector('.micro-label')?.textContent?.trim(),
  hayConectar: !!document.querySelector('[data-llm-action="conectar-correo"]'),
}));
ok(tras.paso === 'Paso 3 de 4', `Vuelve al paso del correo — ${JSON.stringify(tras.paso)}`);
ok(tras.hayConectar, 'Y ofrece conectar de nuevo');
await page.screenshot({ path: `${DIR}/correo-desconectado.png` });

ok(problemas.length === 0, `Red sin 4xx inesperados${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

await browser.close();
console.log(fallos === 0 ? '\n✅ AC8 y AC9: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
