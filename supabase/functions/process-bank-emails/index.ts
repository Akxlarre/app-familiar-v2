// REQ-011 · Movimientos desde el correo del banco.
//
// El corazón del producto: el banco manda el correo, esto lo lee y el movimiento
// aparece. Nadie escribe nada.
//
// Se invoca por cron con la service role key, y corre para TODAS las casillas
// conectadas. La corrida en sí vive en `_shared/corrida.ts`, porque
// `procesar-ahora` la ejecuta igual para un solo hogar.
//
// Diferencias con v1:
//   · Toda captura queda registrada ANTES de intentar interpretarla. Si algo
//     falla después, el correo no se pierde — queda en la bandeja (RN-09).
//   · La cuenta sale del parser (`cuenta_id`), no de adivinar por nombre de
//     banco + correo. v1 dejaba en revisión todo lo que no calzara.
//   · La categoría se aprende de `alias_comercio` (REQ-013). v1 mandaba todo a
//     "Otro gasto", así que categorizar seguía siendo manual para siempre.
//   · Las cuotas se extraen y se agrupan (REQ-031).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { entornoSupabase, error, guardarPreflight, json } from '../_shared/http.ts';
import { credencialesGoogle } from '../_shared/gmail.ts';
import { correrCaptura } from '../_shared/corrida.ts';

Deno.serve(async (req) => {
  const preflight = guardarPreflight(req);
  if (preflight) return preflight;

  try {
    const cred = credencialesGoogle();
    if (!cred) return error('Gmail sin configurar: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET', 500);

    const { url, serviceKey } = entornoSupabase();
    const supabase = createClient(url, serviceKey);

    const { capturadas, movimientos, motivo } = await correrCaptura(supabase, cred);

    return json({ ok: true, capturadas, movimientos, ...(motivo ? { motivo } : {}) });
  } catch (e) {
    return error(String(e), 500);
  }
});
