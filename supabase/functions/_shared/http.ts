// Cabeceras y respuestas comunes a todas las funciones.
//
// En v1 cada función repetía el bloque de CORS y armaba sus Response a mano, con
// pequeñas diferencias entre archivos. Acá vive una sola vez.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function error(mensaje: string, status = 400): Response {
  return json({ error: mensaje }, status);
}

/**
 * Resuelve preflight y método incorrecto. Devuelve `null` si la petición sigue.
 */
export function guardarPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('Method not allowed', 405);
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
