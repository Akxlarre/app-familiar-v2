import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

// AC10, AC11 y AC12 — el paso 4: la primera corrida.
//
// Dos casos, porque el vacío es el que más importa: es el más probable cuando el
// formato de un banco cambió (RB-01) y es donde un "listo" mentiroso hace más
// daño.
//
//   1. Vacío  — `procesar-ahora` corre DE VERDAD (Deno en :8000) contra un token
//               falso. La corrida termina sin hallazgos y la pantalla tiene que
//               decir dónde miró, no felicitar.
//   2. Con datos — la respuesta de la función se simula y los movimientos se
//               siembran en Postgres: lo que se comprueba es que la pantalla
//               muestre nombre y monto reales, no el conteo.
const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const FUNCION = 'http://127.0.0.1:8000/';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DIR = new URL('./capturas/', import.meta.url).pathname;

const sql = (q) =>
  execFileSync('docker', ['exec', 'supabase_db_app-familiar-v2', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', q])
    .toString().trim();

let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/** Deja un usuario nuevo con hogar y cuenta, parado en el paso 3. */
async function hastaElPaso3(page, correo) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', correo);
  await page.fill('#password', 'prueba123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.fill('#nombre-hogar', 'Casa del Paso 4');
  await page.click('[data-llm-action="confirmar-hogar"]');
  await page.waitForTimeout(2500);
  await page.click('[data-llm-action="continuar-desde-hogar"]');
  await page.waitForTimeout(1500);
  await page.selectOption('#banco', 'BancoEstado');
  await page.fill('#nombre-cuenta', 'Mi tarjeta');
  await page.fill('#last4', '4321');
  await page.click('[data-llm-action="crear-primera-cuenta"]');
  await page.waitForTimeout(2500);
}

async function nuevoUsuario() {
  const correo = `listo${Date.now()}${Math.floor(Math.random() * 999)}@casa.cl`;
  const alta = await fetch('http://127.0.0.1:54321/auth/v1/signup', {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password: 'prueba123456' }),
  }).then((r) => r.json());
  if (!alta.access_token) { console.log('❌ no se pudo crear el usuario', alta); process.exit(1); }
  const uid = JSON.parse(Buffer.from(alta.access_token.split('.')[1], 'base64').toString()).sub;
  return { correo, uid };
}

/** Simula la vuelta de Google e inserta la integración en ese mismo instante. */
async function conectarCorreo(page, uid, correo, alConectar) {
  await page.route('**/functions/v1/gmail-oauth', (route) => {
    alConectar();
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, email: correo }),
    });
  });
  await page.route('https://accounts.google.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>g</body></html>' }));

  await page.click('[data-llm-action="conectar-correo"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => sessionStorage.getItem('onboarding.google.state'));
  await page.goto(`${BASE}/onboarding?code=4/simulado&state=${state}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
}

// ═══ CASO 1 — la corrida vacía, con la función corriendo de verdad ══════════
console.log('\n── Caso 1: la corrida no encuentra nada (AC12) ──');
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const { correo, uid } = await nuevoUsuario();

  let llamadas = 0;
  await page.route('**/functions/v1/procesar-ahora', async (route) => {
    llamadas++;
    const req = route.request();
    const res = await fetch(FUNCION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers()['authorization'] ?? '' },
      body: req.postData() ?? '{}',
    });
    route.fulfill({
      status: res.status,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: await res.text(),
    });
  });

  await hastaElPaso3(page, correo);
  const hogar = sql(`SELECT household_id FROM public.profiles WHERE id='${uid}';`);
  await conectarCorreo(page, uid, correo, () => {
    sql(`INSERT INTO public.integraciones_email
           (household_id, profile_id, proveedor, email, access_token, refresh_token, carpeta, estado)
         VALUES ('${hogar}','${uid}','gmail','${correo}','at-falso','rt-falso','INBOX','activa');`);
  });

  await page.click('[data-llm-action="continuar-desde-correo"]');
  await page.waitForTimeout(6000);

  const vacio = await page.evaluate(() => ({
    paso: document.querySelector('.micro-label')?.textContent?.trim(),
    texto: document.body.innerText,
    hayReintentar: !!document.querySelector('[data-llm-action="reintentar-corrida"]'),
    hayEntrar: !!document.querySelector('[data-llm-action="ir-a-hoy"]'),
  }));

  ok(vacio.paso === 'Paso 4 de 4', `Se llega al paso 4 — ${JSON.stringify(vacio.paso)}`);
  ok(llamadas === 1, `AC10: la corrida se dispara sola, sin botón — llamadas: ${llamadas}`);
  ok(/No encontramos correos/i.test(vacio.texto), 'AC12: no dice "listo" cuando no encontró nada');
  ok(/Recibidos/.test(vacio.texto), 'AC12: dice en qué carpeta buscó');
  ok(/180 días/.test(vacio.texto), 'AC12: dice cuántos días hacia atrás miró');
  ok(/BancoEstado/.test(vacio.texto) && !/Santander|Scotiabank/.test(vacio.texto),
     `AC12: nombra los bancos DEL HOGAR, no el catálogo — ${(vacio.texto.match(/correos de [^.]*/) ?? [''])[0].slice(0, 60)}`);
  ok(/activarlos desde su app|otra etiqueta/i.test(vacio.texto), 'AC12: dice qué hacer, no sólo qué pasó');
  ok(vacio.hayReintentar && vacio.hayEntrar, 'Se puede reintentar o entrar igual');
  ok(!/rt-falso|at-falso|access_token/.test(vacio.texto), 'Ningún token en la pantalla');

  // La corrida real dejó rastro: el token falso no sirve y Google lo rechazó.
  const estado = sql(`SELECT estado || ' · ' || coalesce(left(ultimo_error, 40), 'sin error')
                        FROM public.integraciones_email WHERE profile_id='${uid}';`);
  ok(/revocada|expirada/.test(estado), `La integración quedó marcada, no en silencio — ${estado}`);

  await page.screenshot({ path: `${DIR}/listo-vacio.png` });
  await ctx.close();
}

// ═══ CASO 2 — la corrida encuentra movimientos ══════════════════════════════
console.log('\n── Caso 2: la corrida encuentra movimientos (AC11) ──');
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const { correo, uid } = await nuevoUsuario();

  await page.route('**/functions/v1/procesar-ahora', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        ok: true, capturadas: 3, movimientos: 2, motivo: null,
        buscado: { diasAtras: 180, maximo: 30 },
      }),
    }));

  await hastaElPaso3(page, correo);
  const hogar = sql(`SELECT household_id FROM public.profiles WHERE id='${uid}';`);
  await conectarCorreo(page, uid, correo, () => {
    sql(`INSERT INTO public.integraciones_email
           (household_id, profile_id, proveedor, email, access_token, refresh_token, carpeta, estado)
         VALUES ('${hogar}','${uid}','gmail','${correo}','at','rt','INBOX','activa');`);
    // Lo que la corrida "habría creado": la pantalla tiene que leerlo de la base.
    sql(`INSERT INTO public.movimientos (household_id, profile_id, monto, tipo, fecha, comercio)
         VALUES ('${hogar}','${uid}',18700,'gasto',CURRENT_DATE,'JUMBO MAIPU'),
                ('${hogar}','${uid}',4990,'gasto',CURRENT_DATE,'UBER TRIP');`);
    // Y una captura sin resolver, para el aviso de la bandeja.
    sql(`INSERT INTO public.capturas (household_id, origen, origen_ref, payload, estado, motivo)
         VALUES ('${hogar}','email','msg-qa-1','{}'::jsonb,'requiere_revision','No se pudo leer el monto');`);
  });

  await page.click('[data-llm-action="continuar-desde-correo"]');
  await page.waitForTimeout(5000);

  const conDatos = await page.evaluate(() => ({
    paso: document.querySelector('.micro-label')?.textContent?.trim(),
    texto: document.body.innerText,
    filas: [...document.querySelectorAll('.item-title')].map((e) => e.textContent.trim()),
    montos: [...document.querySelectorAll('.row-value')].map((e) => e.textContent.trim()),
  }));

  ok(conDatos.paso === 'Paso 4 de 4', `Paso 4 — ${JSON.stringify(conDatos.paso)}`);
  ok(/Encontramos 2 movimientos/.test(conDatos.texto), `AC11: dice cuántos — ${(conDatos.texto.match(/Encontramos [^\n]*/) ?? [''])[0]}`);
  ok(conDatos.filas.includes('JUMBO MAIPU'), `AC11: con nombre — ${conDatos.filas.join(' · ')}`);
  ok(conDatos.montos.some((m) => m.includes('18.700')), `AC11: con monto y punto de miles — ${conDatos.montos.join(' · ')}`);
  // `micro-label` aplica text-transform: uppercase, e `innerText` devuelve el
  // texto YA transformado. Comparar sensible a mayúsculas acá no comprueba nada.
  ok(/necesita que confirmes|necesitan que confirmes/i.test(conDatos.texto),
     'AC11: avisa de las capturas pendientes');
  ok(/\b1 correo necesita/i.test(conDatos.texto),
     `Y dice cuántas — ${(conDatos.texto.match(/\d+ correos? necesitan?[^.]*/i) ?? ['(no dice)'])[0]}`);

  await page.screenshot({ path: `${DIR}/listo-con-datos.png` });
  await ctx.close();
}

await browser.close();
console.log(fallos === 0 ? '\n✅ Paso 4: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
