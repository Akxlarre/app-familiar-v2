// Cabeceras y respuestas comunes a todas las funciones.
//
// En v1 cada función repetía el bloque de CORS y armaba sus Response a mano, con
// pequeñas diferencias entre archivos. Acá vive una sola vez.

/**
 * Origen permitido. `*` sería cómodo pero esta app es privada de una familia
 * (R-06): cualquier página podría invocar las funciones desde el navegador de un
 * usuario logueado. Se configura con el secreto `CORS_ALLOWLIST` (orígenes
 * separados por coma). Sin allowlist configurada NO se refleja ningún origen.
 *
 * Idea tomada de `anti-abuse.ts` de autoescuela, donde la allowlist nació de una
 * auditoría de seguridad de su endpoint público.
 */
export function origenPermitido(origen: string | null | undefined): boolean {
  if (!origen) return false;
  const limpio = origen.trim();
  if (!limpio) return false;
  const allowlist = (Deno.env.get('CORS_ALLOWLIST') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return allowlist.includes(limpio);
}

export function corsHeaders(req?: Request): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const origen = req?.headers.get('Origin');
  if (origenPermitido(origen)) base['Access-Control-Allow-Origin'] = origen!;
  return base;
}

export function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function error(mensaje: string, status = 400, req?: Request): Response {
  return json({ error: mensaje }, status, req);
}

/**
 * Resuelve preflight y método incorrecto. Devuelve `null` si la petición sigue.
 */
export function guardarPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return error('Method not allowed', 405, req);
  return null;
}

/** Variables que Supabase inyecta sola en toda edge function. */
export function entornoSupabase() {
  return {
    url: Deno.env.get('SUPABASE_URL')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  };
}
