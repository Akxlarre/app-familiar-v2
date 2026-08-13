import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

// T6.1 — los dos guards, ya cableados (spec 0004, AC1 y AC-E2).
//
// Son espejo uno del otro y el modo de fallar es simétrico: si `hogarGuard`
// bloquea de más, un usuario nuevo queda encerrado en un onboarding; si
// `onboardingGuard` bloquea de menos, alguien puede volver y crear un segundo
// hogar. Las dos direcciones se comprueban acá.
const BASE = process.env.QA_BASE ?? 'http://localhost:4292';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const sql = (q) =>
  execFileSync('docker', ['exec', 'supabase_db_app-familiar-v2', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', q])
    .toString().trim();

let fallos = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallos++; };

async function nuevoUsuario() {
  const correo = `guard${Date.now()}${Math.floor(Math.random() * 999)}@casa.cl`;
  const alta = await fetch('http://127.0.0.1:54321/auth/v1/signup', {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password: 'prueba123456' }),
  }).then((r) => r.json());
  if (!alta.access_token) { console.log('❌ signup', alta); process.exit(1); }
  return { correo, uid: JSON.parse(Buffer.from(alta.access_token.split('.')[1], 'base64').toString()).sub };
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function sesion(correo) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', correo);
  await page.fill('#password', 'prueba123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  return { ctx, page };
}

// ── AC1: sin configurar, /app no se puede pisar ────────────────────────────
{
  const { correo } = await nuevoUsuario();
  const { ctx, page } = await sesion(correo);

  for (const destino of ['/app/hoy', '/app/plata/movimientos', '/app/bandeja']) {
    await page.goto(`${BASE}${destino}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    ok(page.url().includes('/onboarding'),
       `AC1: ${destino} manda al onboarding — ${page.url().replace(BASE, '')}`);
  }

  const nav = await page.evaluate(() => !!document.querySelector('app-sidebar, app-bottom-nav'));
  ok(!nav, 'AC1: y no queda navegación con la que escaparse');
  await ctx.close();
}

// ── AC-E2: ya configurado, /onboarding manda a Hoy ─────────────────────────
{
  const { correo, uid } = await nuevoUsuario();
  const { ctx, page } = await sesion(correo);

  // Se lo deja configurado por SQL: lo que se prueba es el guard, no el camino.
  // `create_household` es SECURITY DEFINER y necesita `auth.uid()`, así que
  // desde psql no sirve — se escriben las filas directamente.
  // El id se genera acá: `RETURNING` por psql viene con el tag del INSERT pegado.
  const hogar = crypto.randomUUID();
  const codigo = `G${Math.floor(Math.random() * 89999 + 10000)}`;
  sql(`INSERT INTO public.households (id, nombre, invite_code)
       VALUES ('${hogar}','Casa Guard','${codigo}');`);
  sql(`UPDATE public.profiles SET household_id='${hogar}' WHERE id='${uid}';`);
  sql(`INSERT INTO public.cuentas (household_id, nombre, tipo, banco)
       VALUES ('${hogar}','Tarjeta','credito','BancoEstado');`);
  sql(`INSERT INTO public.integraciones_email
         (household_id, profile_id, proveedor, email, refresh_token, carpeta, estado)
       VALUES ('${hogar}','${uid}','gmail','${correo}','rt','INBOX','activa');`);

  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  ok(page.url().includes('/app/hoy'),
     `AC-E2: con todo configurado, /onboarding manda a Hoy — ${page.url().replace(BASE, '')}`);

  await page.goto(`${BASE}/app/plata/movimientos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  ok(page.url().includes('/app/plata'),
     `Y la app entera queda accesible — ${page.url().replace(BASE, '')}`);
  const nav2 = await page.evaluate(() => !!document.querySelector('app-sidebar, app-bottom-nav'));
  ok(nav2, 'Con su navegación');
  await ctx.close();
}

// ── El guard falla hacia adelante ──────────────────────────────────────────
{
  // Si la consulta revienta, un guard que bloquea deja al usuario encerrado sin
  // forma de salir — y lo que hay detrás ya está protegido por RLS.
  const { correo } = await nuevoUsuario();
  const { ctx, page } = await sesion(correo);
  await page.route('**/rest/v1/households*', (route) => route.abort('failed'));
  await page.route('**/rest/v1/cuentas*', (route) => route.abort('failed'));

  await page.goto(`${BASE}/app/hoy`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  ok(page.url().includes('/app/hoy'),
     `Con la red caída el guard deja pasar, no encierra — ${page.url().replace(BASE, '')}`);
  await ctx.close();
}

await browser.close();
console.log(fallos === 0 ? '\n✅ Guards: todo verde' : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
