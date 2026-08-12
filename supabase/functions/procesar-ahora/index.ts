// Spec 0004, AC10 · La primera corrida, sin esperar al cron.
//
// Conectar el correo y que no pase nada hasta la próxima hora convierte el paso
// más importante del onboarding en un acto de fe. Esto lo dispara en el momento
// y devuelve QUÉ encontró, que es lo que el paso 4 muestra.
//
// POST {} + Authorization: Bearer <JWT del usuario>
//
// La diferencia con `process-bank-emails` es quién la llama y con qué alcance:
// aquélla la dispara el cron con service role para todas las casillas; ésta la
// dispara el usuario y **sólo puede tocar su hogar**. La corrida es la misma
// función en los dos casos, a propósito.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { entornoSupabase, error, guardarPreflight, json } from '../_shared/http.ts';
import { credencialesGoogle } from '../_shared/gmail.ts';
import { correrCaptura, DIAS_ATRAS_PRIMERA, MAX_CORREOS_POR_CORRIDA } from '../_shared/corrida.ts';

/**
 * La primera corrida mira más correos que el cron.
 *
 * El cron corre seguido y va al día; ésta corre una vez y tiene que dar una
 * primera impresión. Diez correos de 180 días alcanzan para que el paso 4
 * muestre algo real sin que el usuario espere de más.
 */
const MAX_PRIMERA = MAX_CORREOS_POR_CORRIDA * 3;

Deno.serve(async (req) => {
  const preflight = guardarPreflight(req);
  if (preflight) return preflight;

  try {
    const cred = credencialesGoogle();
    if (!cred) return error('Gmail sin configurar: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET', 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return error('Falta la cabecera Authorization', 401);

    const { url, anonKey, serviceKey } = entornoSupabase();

    // El JWT se valida con la anon key: sirve para saber QUIÉN pide, no para
    // darle permisos. La corrida va después con service role.
    const clienteUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errUsuario } =
      await clienteUsuario.auth.getUser(authHeader.slice('Bearer '.length));

    if (errUsuario || !user) return error('No autorizado', 401);

    const supabase = createClient(url, serviceKey);

    // El hogar se resuelve DESDE EL JWT y nunca desde el cuerpo del pedido. Si
    // viniera de afuera, cualquiera podría disparar la corrida de otro hogar —
    // y con service role no hay RLS que lo frene después.
    const { data: perfil } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .maybeSingle();

    const householdId = (perfil as { household_id: string | null } | null)?.household_id;
    if (!householdId) return error('El perfil todavía no pertenece a un hogar', 409);

    const { capturadas, movimientos, motivo } = await correrCaptura(supabase, cred, {
      householdId,
      maximo: MAX_PRIMERA,
      diasAtras: DIAS_ATRAS_PRIMERA,
    });

    // Qué se buscó viaja en la respuesta, no sólo qué se encontró: AC12 pide que
    // una corrida vacía diga dónde miró, y esos números tienen que salir de lo
    // que de verdad se usó, no de una constante repetida en la pantalla.
    return json({
      ok: true,
      capturadas,
      movimientos,
      motivo,
      buscado: { diasAtras: DIAS_ATRAS_PRIMERA, maximo: MAX_PRIMERA },
    });
  } catch (e) {
    return error(String(e), 500);
  }
});
