// REQ-010 · Conectar la casilla de correo.
//
// Canjea el código del consentimiento de Google por tokens y los guarda. Es el
// único paso manual de toda la cadena de captura: se hace una vez y después el
// sistema trabaja solo.
//
// POST { code, redirect_uri } + Authorization: Bearer <JWT del usuario>
// Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { entornoSupabase, error, guardarPreflight, json } from '../_shared/http.ts';
import { canjearCodigo, correoDeLaCuenta, credencialesGoogle } from '../_shared/gmail.ts';

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
    // darle permisos. La escritura va después con service role.
    const clienteUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errUsuario } =
      await clienteUsuario.auth.getUser(authHeader.slice('Bearer '.length));

    if (errUsuario || !user) return error('No autorizado', 401);

    const body = (await req.json().catch(() => ({}))) as { code?: string; redirect_uri?: string };
    if (!body.code || !body.redirect_uri) return error('Se requieren code y redirect_uri', 400);

    const tokens = await canjearCodigo(cred, body.code, body.redirect_uri);

    // Sin refresh token la integración sirve una hora y después muere en
    // silencio. Pasa cuando el usuario ya autorizó antes y Google no lo vuelve a
    // mandar: hay que pedir el consentimiento con prompt=consent.
    if (!tokens.refresh_token) {
      return error(
        'Google no entregó refresh_token. Reintentá el consentimiento con prompt=consent&access_type=offline.',
        400,
      );
    }

    const correo = await correoDeLaCuenta(tokens.access_token);
    if (!correo) return error('No se pudo leer la dirección de la casilla conectada', 502);

    const supabase = createClient(url, serviceKey);

    const { data: perfil } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .maybeSingle();

    const householdId = (perfil as { household_id: string | null } | null)?.household_id;
    if (!householdId) return error('El perfil todavía no pertenece a un hogar', 409);

    const { error: errUpsert } = await supabase.from('integraciones_email').upsert(
      {
        profile_id: user.id,
        household_id: householdId,
        proveedor: 'gmail',
        email: correo,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expira_en: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
        estado: 'activa',
        ultimo_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,email' },
    );

    if (errUpsert) return error(errUpsert.message, 500);

    return json({ ok: true, email: correo });
  } catch (e) {
    return error(String(e), 500);
  }
});
