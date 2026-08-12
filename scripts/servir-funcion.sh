#!/usr/bin/env bash
# Sirve UNA edge function con Deno directo, sin el contenedor del CLI.
#
#   ./scripts/servir-funcion.sh reprocesar-capturas
#   curl -X POST localhost:8000/ -H "Authorization: Bearer <jwt>" -d '{}'
#
# Por qué existe: `supabase functions serve` levanta el edge runtime en un
# contenedor que en algunos entornos no arranca —
#
#   error setting rlimit type 7: operation not permitted
#
# — porque pide un RLIMIT_NOFILE mayor que el límite duro del sandbox. Las
# functions son Deno estándar, así que se pueden servir sin ese contenedor y se
# comportan igual: mismo código, misma base, mismos secretos.
#
# Lo que NO reproduce: el enrutado por nombre (`/functions/v1/<nombre>`) y la
# verificación de JWT que hace el gateway. La función igual valida el
# Authorization por su cuenta, que es donde está la lógica que importa.
set -euo pipefail

FUNCION="${1:?Uso: ./scripts/servir-funcion.sh <nombre-de-la-funcion>}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Las mismas claves que imprime `npx supabase status`. Son de demo: el CLI las
# genera idénticas en toda instalación local, no son un secreto.
export SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

# Detrás de un proxy que re-termina TLS, Deno necesita su CA explícitamente.
if [[ -f /root/.ccr/ca-bundle.crt ]]; then
  export DENO_CERT=/root/.ccr/ca-bundle.crt
fi

exec deno run --allow-all "$RAIZ/supabase/functions/$FUNCION/index.ts"
