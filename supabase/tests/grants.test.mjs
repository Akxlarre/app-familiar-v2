/**
 * Privilegios de tabla — el eslabón que RLS no cubre (fix-001).
 *
 *   node --test supabase/tests/grants.test.mjs
 *
 * Requiere la base local levantada (`npx supabase start`). Si no responde, los
 * casos se saltan en vez de fallar: un test que exige docker no puede bloquear
 * el CI de la app.
 *
 * Por qué existe: las policies estaban bien escritas y **ninguna llegaba a
 * evaluarse**, porque sin `GRANT` Postgres corta antes de mirar RLS. Ni el
 * linter ni los tests de la app podían verlo —mockean el repositorio y no
 * ejecutan SQL—, así que apareció recién el día que se levantó la base.
 *
 * La regla que se verifica: **cada policy tiene el GRANT que necesita, y nada
 * tiene privilegios que ninguna policy respalde.**
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const CONTENEDOR = 'supabase_db_app-familiar-v2';

async function sql(consulta) {
  const { stdout } = await ejecutar('docker', [
    'exec', CONTENEDOR, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', consulta,
  ]);
  return stdout.trim().split('\n').filter(Boolean);
}

let disponible = false;

describe('Privilegios de tabla', () => {
  before(async () => {
    try {
      await sql('SELECT 1');
      disponible = true;
    } catch {
      console.log('   ℹ base local no disponible: se saltan los casos');
    }
  });

  test('toda tabla con policy para authenticated puede ser leída por authenticated', async (t) => {
    if (!disponible) return t.skip();

    // `integraciones_email` es la excepción declarada: su SELECT es POR COLUMNA
    // para dejar el refresh_token fuera, así que a nivel tabla da false.
    const filas = await sql(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND c.relname <> 'integraciones_email'
        AND EXISTS (SELECT 1 FROM pg_policies p
                    WHERE p.schemaname='public' AND p.tablename=c.relname
                      AND p.roles::text LIKE '%authenticated%')
        AND NOT has_table_privilege('authenticated', c.oid, 'SELECT');`);

    assert.deepEqual(filas, [],
      `Tablas con policy y sin GRANT SELECT: ${filas.join(', ')}. ` +
      'La policy no se evalúa nunca: Postgres corta antes con 42501.');
  });

  test('ninguna tabla deja a authenticated vaciarla', async (t) => {
    if (!disponible) return t.skip();

    // TRUNCATE **no evalúa RLS**: se lleva el hogar ajeno por delante. Viene de
    // los privilegios por defecto de Supabase, no de ninguna policy.
    const filas = await sql(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind IN ('r','v')
        AND has_table_privilege('authenticated', c.oid, 'TRUNCATE');`);

    assert.deepEqual(filas, [], `Tablas que authenticated puede TRUNCATE: ${filas.join(', ')}`);
  });

  test('anon no puede leer nada del dominio', async (t) => {
    if (!disponible) return t.skip();

    // No hay una sola pantalla pública, y la anon key viaja en el bundle.
    const filas = await sql(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind IN ('r','v')
        AND has_table_privilege('anon', c.oid, 'SELECT');`);

    assert.deepEqual(filas, [], `Tablas legibles por anon: ${filas.join(', ')}`);
  });

  test('capturas no acepta INSERT ni DELETE desde el cliente', async (t) => {
    if (!disponible) return t.skip();

    // Insertar capturas es inventar movimientos; borrarlas viola RN-09, que
    // dice que una captura nunca se pierde.
    const [fila] = await sql(`
      SELECT has_table_privilege('authenticated','public.capturas','INSERT')::text
          || ',' || has_table_privilege('authenticated','public.capturas','DELETE')::text;`);

    assert.equal(fila, 'false,false');
  });

  test('la vista de integraciones es legible: la pantalla de conectar correo depende de ella', async (t) => {
    if (!disponible) return t.skip();

    const [fila] = await sql(
      `SELECT has_table_privilege('authenticated','public.mis_integraciones_email','SELECT')::text;`);

    assert.equal(fila, 'true');
  });

  test('ninguna credencial de Gmail es legible por authenticated', async (t) => {
    if (!disponible) return t.skip();

    // fix-002. Un refresh token de Google no caduca solo: quien lo tenga lee el
    // correo del hogar desde fuera de la app hasta que alguien revoque el acceso
    // a mano. Estuvo saliendo por `GET /integraciones_email?select=refresh_token`.
    const filas = await sql(`
      SELECT a.attname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname = 'integraciones_email'
        AND a.attname IN ('refresh_token','access_token','expira_en')
        AND has_column_privilege('authenticated', c.oid, a.attname, 'SELECT');`);

    assert.deepEqual(filas, [],
      `Credenciales legibles por el cliente: ${filas.join(', ')}. La app sólo necesita 'conectada'.`);
  });

  test('service_role puede operar sobre todo el dominio', async (t) => {
    if (!disponible) return t.skip();

    // fix-003. Es el rol de la cadena automática: leer el correo, crear
    // capturas, renovar el token. Sin privilegios falla en el primer paso y en
    // silencio, porque nadie está mirando cuando corre.
    const filas = await sql(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND NOT (has_table_privilege('service_role', c.oid, 'SELECT')
             AND has_table_privilege('service_role', c.oid, 'INSERT')
             AND has_table_privilege('service_role', c.oid, 'UPDATE'));`);

    assert.deepEqual(filas, [], `Tablas que service_role no puede operar: ${filas.join(', ')}`);
  });

  test('service_role sí lee el refresh token: es quien habla con Gmail', async (t) => {
    if (!disponible) return t.skip();

    // El contrapeso del caso anterior: ocultarle el token a la app no puede
    // ocultárselo también a quien tiene que usarlo.
    const [fila] = await sql(
      `SELECT has_column_privilege('service_role','public.integraciones_email','refresh_token','SELECT')::text;`);

    assert.equal(fila, 'true');
  });

  test('la app puede saber si el correo está conectado sin ver el token', async (t) => {
    if (!disponible) return t.skip();

    // El reemplazo tiene que seguir siendo utilizable: ocultar el token sin dar
    // alternativa deja la pantalla de conectar correo sin forma de saber su estado.
    const [fila] = await sql(`
      SELECT has_column_privilege('authenticated','public.integraciones_email','conectada','SELECT')::text;`);

    assert.equal(fila, 'true');
  });

  test('el usuario puede cambiar la carpeta que se vigila', async (t) => {
    if (!disponible) return t.skip();

    // AC8. Sin el GRANT la policy de UPDATE no se evalúa nunca: es el mismo modo
    // de fallar que fix-001, y se ve igual de poco.
    const [fila] = await sql(`
      SELECT has_column_privilege('authenticated','public.integraciones_email','carpeta','UPDATE')::text;`);

    assert.equal(fila, 'true');
  });

  test('el UPDATE del cliente NO alcanza a ninguna credencial', async (t) => {
    if (!disponible) return t.skip();

    // Lo que hace que el GRANT por columna sirva de algo. Un `GRANT UPDATE` a
    // secas dejaría al cliente escribir el refresh_token, y entonces daría igual
    // habérselo ocultado para leer.
    //
    // `profile_id` va en la lista porque poder reasignarlo es regalarle la
    // casilla a otra cuenta. La policy lo frena con WITH CHECK, pero el
    // privilegio no tiene por qué existir en primer lugar.
    const prohibidas = ['refresh_token', 'access_token', 'expira_en', 'profile_id', 'household_id', 'email'];
    const filas = await sql(`
      SELECT col FROM unnest(ARRAY[${prohibidas.map((c) => `'${c}'`).join(',')}]) AS col
       WHERE has_column_privilege('authenticated','public.integraciones_email',col,'UPDATE');`);

    assert.deepEqual(filas, [], `authenticated escribe columnas que no debería: ${filas.join(', ')}`);
  });

  test('la policy de UPDATE tiene WITH CHECK, no sólo USING', async (t) => {
    if (!disponible) return t.skip();

    // Con `USING` solo se puede leer la fila propia y dejarla apuntando a otro
    // perfil en el mismo UPDATE. `USING` decide qué filas se tocan; `WITH CHECK`,
    // en qué estado pueden quedar — y sin el segundo la salida no se revisa.
    const [fila] = await sql(`
      SELECT (with_check IS NOT NULL)::text FROM pg_policies
       WHERE schemaname='public' AND tablename='integraciones_email'
         AND policyname='integraciones_email_update';`);

    assert.equal(fila, 'true');
  });
});
