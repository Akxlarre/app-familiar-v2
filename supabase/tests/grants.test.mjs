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
});
