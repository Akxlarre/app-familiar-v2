// REQ-011 · Rescatar lo que quedó atascado en la bandeja.
//
// Los parsers bancarios son la parte más frágil del sistema (RB-01): cada banco
// tiene su formato y lo cambia sin avisar. Cuando uno se rompe, las capturas de
// esos días quedan en `requiere_revision` con "No se pudo leer el monto".
//
// Arreglar el regex no las rescata: `process-bank-emails` lista los correos de
// Gmail de los últimos 90 días, y para entonces esos correos ya no están en la
// ventana — o el token de la integración cambió, o el correo se archivó. La
// captura queda ahí para siempre, y la única salida es escribir el monto a mano
// una por una.
//
// Esto vuelve a interpretar lo YA GUARDADO con las reglas de hoy. No crea
// movimientos: deja la captura lista para que el usuario la confirme de un
// toque en la bandeja. Crear el movimiento es de `resolver_captura`, que es
// atómico y ya está probado — duplicar esa lógica acá sería una segunda forma
// de escribir en `movimientos`.
//
// POST { limite?: number } + Authorization: Bearer <JWT del usuario>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { entornoSupabase, error, guardarPreflight, json } from '../_shared/http.ts';
import { replantearCaptura, type CapturaReinterpretable, type ParserActivo } from '../_shared/capturas.ts';

/** Tope por corrida: la función tiene límite de tiempo y esto es un rescate, no un cron. */
const MAX_POR_CORRIDA = 100;

Deno.serve(async (req) => {
  const preflight = guardarPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return error('Falta la cabecera Authorization', 401, req);

    const { url, anonKey, serviceKey } = entornoSupabase();

    // El JWT dice QUIÉN pide; la escritura va después con service role.
    const clienteUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errUsuario } =
      await clienteUsuario.auth.getUser(authHeader.slice('Bearer '.length));

    if (errUsuario || !user) return error('No autorizado', 401, req);

    const body = (await req.json().catch(() => ({}))) as { limite?: number };
    const limite = Math.min(Math.max(Number(body.limite) || MAX_POR_CORRIDA, 1), MAX_POR_CORRIDA);

    const supabase = createClient(url, serviceKey);

    const { data: perfil } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .maybeSingle();

    const householdId = (perfil as { household_id: string | null } | null)?.household_id;
    if (!householdId) return error('El usuario no pertenece a un hogar', 400, req);

    // Las reglas de HOY. Si esto viene vacío no hay nada que reintentar.
    const { data: parsersRaw } = await supabase
      .from('parsers_email')
      .select('id, banco, tipo, remitente_patron, asunto_patron, regex_monto, regex_comercio, regex_fecha, regex_cuota, regex_tarjeta, cuenta_id')
      .eq('household_id', householdId)
      .eq('activo', true);

    const parsers = (parsersRaw ?? []) as ParserActivo[];
    if (parsers.length === 0) {
      return json({ ok: true, revisadas: 0, recuperadas: 0, motivo: 'sin parsers activos' }, 200, req);
    }

    const { data: capturasRaw } = await supabase
      .from('capturas')
      .select('id, parser_id, payload, interpretado, intentos')
      .eq('household_id', householdId)
      .eq('estado', 'requiere_revision')
      .eq('origen', 'email')
      .order('fecha_origen', { ascending: false, nullsFirst: false })
      .limit(limite);

    const capturas = (capturasRaw ?? []) as (CapturaReinterpretable & { intentos: number })[];

    let recuperadas = 0;

    for (const captura of capturas) {
      const r = replantearCaptura(captura, parsers);

      // Lo leído se guarda aunque no alcance: un comercio recuperado es una
      // captura que en la bandeja ya se entiende sin abrir el correo.
      const interpretado = r.datos
        ? {
            ...(captura.interpretado ?? {}),
            ...r.datos,
            banco: r.parser?.banco,
            tipo: r.parser?.tipo,
          }
        : captura.interpretado;

      const cambios: Record<string, unknown> = {
        interpretado,
        intentos: captura.intentos + 1,
        updated_at: new Date().toISOString(),
      };

      if (r.resuelta) {
        // Vuelve a la bandeja como confirmable de un toque. NO se procesa sola:
        // el parser ya se equivocó una vez con este correo (RN-09).
        cambios.estado = 'pendiente';
        cambios.motivo = null;
        cambios.parser_id = r.parser?.id ?? captura.parser_id;
        recuperadas++;
      } else {
        cambios.motivo = r.motivo;
        if (r.parser) cambios.parser_id = r.parser.id;
      }

      const { error: errUpdate } = await supabase
        .from('capturas')
        .update(cambios)
        .eq('id', captura.id);

      if (errUpdate) console.error('[reprocesar]', captura.id, errUpdate);
    }

    return json({ ok: true, revisadas: capturas.length, recuperadas }, 200, req);
  } catch (e) {
    console.error('[reprocesar]', e);
    return error('No se pudo reprocesar la bandeja', 500, req);
  }
});
