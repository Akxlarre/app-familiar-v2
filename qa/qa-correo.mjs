import { chromium } from 'playwright';

// Paso 3 del onboarding — conectar el correo (spec 0004, AC7 y AC-E4).
//
// Lo que este QA NO puede probar: que Google acepte el canje. Hace falta el
// client_secret, que el usuario todavía no entregó. Todo lo demás corre de
// verdad — incluida la edge function, servida con Deno en :8000, a la que se
// enruta porque el gateway local no tiene el edge runtime levantado.
const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const FUNCION = 'http://127.0.0.1:8000/';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DIR = new URL('./capturas/', import.meta.url).pathname;
const correo = `correo${Date.now()}@casa.cl`;

const alta = await fetch('http://127.0.0.1:54321/auth/v1/signup', {
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

// El gateway local no enruta /functions/v1/*: se manda a la función real.
let llamadas = 0;
await page.route('**/functions/v1/gmail-oauth', async (route) => {
  llamadas++;
  const req = route.request();
  const res = await fetch(FUNCION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers()['authorization'] ?? '',
    },
    body: req.postData() ?? '{}',
  });
  route.fulfill({
    status: res.status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: await res.text(),
  });
});

// ── Llegar al paso 3 ────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', correo);
await page.fill('#password', 'prueba123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.fill('#nombre-hogar', 'Casa del Correo');
await page.click('[data-llm-action="confirmar-hogar"]');
await page.waitForTimeout(2500);
await page.click('[data-llm-action="continuar-desde-hogar"]');
await page.waitForTimeout(1500);
await page.selectOption('#banco', 'BancoEstado');
await page.fill('#nombre-cuenta', 'Mi tarjeta');
await page.fill('#last4', '4321');
await page.click('[data-llm-action="crear-primera-cuenta"]');
await page.waitForTimeout(2500);

const p3 = await page.evaluate(() => ({
  paso: document.querySelector('.micro-label')?.textContent?.trim(),
  titulo: document.querySelector('h1')?.textContent?.trim(),
  texto: document.body.innerText,
  hayBoton: !!document.querySelector('[data-llm-action="conectar-correo"]'),
  botonHabilitado: !document.querySelector('[data-llm-action="conectar-correo"]')?.disabled,
}));
ok(p3.paso === 'Paso 3 de 4', `Se llega al paso 3 — ${JSON.stringify(p3.paso)}`);
ok(p3.titulo === 'Tu correo', `Es la pantalla del correo — ${JSON.stringify(p3.titulo)}`);
ok(p3.hayBoton && p3.botonHabilitado, 'El botón de conectar existe y está habilitado');
ok(/[Ss][oó]lo lectura/.test(p3.texto) && /No puede enviar/.test(p3.texto),
   'AC7: dice qué permiso pide y qué NO puede hacer');
await page.screenshot({ path: `${DIR}/correo-paso3.png` });

// ── La URL del consentimiento ───────────────────────────────────────────────
// Se intercepta la navegación a Google en vez de dejarla ir: interesa QUÉ se le
// pide, no lo que Google conteste.
let urlGoogle = null;
await page.route('https://accounts.google.com/**', (route) => {
  urlGoogle = route.request().url();
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>google</body></html>' });
});
await page.click('[data-llm-action="conectar-correo"]');
await page.waitForTimeout(2000);

ok(!!urlGoogle, `Manda a Google — ${urlGoogle ? urlGoogle.slice(0, 60) + '…' : 'no navegó'}`);
if (urlGoogle) {
  const u = new URL(urlGoogle);
  const q = u.searchParams;
  ok(q.get('access_type') === 'offline', `access_type=offline — ${q.get('access_type')}`);
  ok(q.get('prompt') === 'consent', `prompt=consent — ${q.get('prompt')}`);
  ok(q.get('scope') === 'https://www.googleapis.com/auth/gmail.readonly',
     `sólo gmail.readonly — ${q.get('scope')}`);
  ok(q.get('response_type') === 'code', `response_type=code — ${q.get('response_type')}`);
  ok(q.get('redirect_uri') === `${BASE}/onboarding`, `redirect_uri del origen real — ${q.get('redirect_uri')}`);
  ok((q.get('client_id') ?? '').endsWith('.apps.googleusercontent.com'),
     `client_id configurado — ${(q.get('client_id') ?? '').slice(0, 18)}…`);
}

// Volver al origen de la app ANTES de leer sessionStorage: tras el click la
// pestaña está en accounts.google.com, que tiene su propio almacenamiento.
// Que sobreviva a este ida y vuelta es justamente lo que hay que comprobar.
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const state = await page.evaluate(() => sessionStorage.getItem('onboarding.google.state'));
ok(!!state && state.length > 20, `El state queda guardado para la vuelta — ${state?.slice(0, 8)}…`);
ok(urlGoogle && new URL(urlGoogle).searchParams.get('state') === state,
   'El state de la URL es el mismo que se guardó');

// ── La vuelta con un state que no es el nuestro ─────────────────────────────
await page.goto(`${BASE}/onboarding?code=4/falso&state=de-otro-lado`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const csrf = await page.evaluate(() => ({ texto: document.body.innerText, url: location.href }));
ok(/no corresponde a esta sesi[oó]n/i.test(csrf.texto), 'Un state ajeno no se canjea');
ok(llamadas === 0, `Y no llega a llamar a la función — llamadas: ${llamadas}`);
ok(!csrf.url.includes('code='), `El code sale de la URL — ${csrf.url.replace(BASE, '')}`);

// ── La vuelta buena, con la función respondiendo de verdad ──────────────────
// El intento fallido consumió el state guardado (se borra al leerlo, para que
// no sirva dos veces), así que hay que pedir el consentimiento de nuevo.
await page.click('[data-llm-action="conectar-correo"]').catch(() => {});
await page.waitForTimeout(2000);
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const bueno = await page.evaluate(() => sessionStorage.getItem('onboarding.google.state'));
ok(!!bueno, `Hay state para la vuelta buena — ${bueno?.slice(0, 8)}…`);
await page.goto(`${BASE}/onboarding?code=4/falso&state=${bueno}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

const canje = await page.evaluate(() => ({ texto: document.body.innerText, url: location.href }));
ok(llamadas === 1, `El state bueno SÍ llega a la función — llamadas: ${llamadas}`);
ok(!/GOOGLE_CLIENT_SECRET|invalid_client|oauth2\.googleapis/i.test(canje.texto),
   'El error crudo del servidor no se muestra');
ok(/No es algo que puedas resolver|Intentá de nuevo|venció/i.test(canje.texto),
   `Se explica el fallo — ${(canje.texto.match(/.*(resolver|de nuevo|venció).*/) ?? ['(sin mensaje)'])[0].slice(0, 90)}`);
ok(!canje.url.includes('code='), 'El code tampoco queda en la URL tras canjear');
ok(/Conectar mi correo/.test(canje.texto), 'AC-E4: se puede reintentar, el hogar sigue creado');
await page.screenshot({ path: `${DIR}/correo-fallo.png` });

await browser.close();
console.log(fallos === 0 ? '\n✅ Paso 3: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
