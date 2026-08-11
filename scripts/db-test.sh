#!/usr/bin/env bash
# Aplica el esquema completo sobre una base limpia y corre las pruebas de RLS.
#
# El stack completo de Supabase no siempre se puede levantar (en contenedores
# restringidos el edge-runtime falla), pero para verificar el esquema alcanza con
# Postgres. Esto usa la misma imagen que usa Supabase.
#
#   ./scripts/db-test.sh
#
# Variables: PGHOST, PGPORT, PGUSER, PGPASSWORD (por defecto, el contenedor local).
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
DB="${DB:-v2_test}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 -q)

echo "▸ Base limpia: $DB"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB;" >/dev/null
"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB;" >/dev/null

echo "▸ Bootstrap de auth (lo que Supabase provee en producción)"
"${PSQL[@]}" -d "$DB" -f "$RAIZ/supabase/tests/_bootstrap_auth.sql" >/dev/null

echo "▸ Migraciones"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null 2>&1
  echo "   ✓ $(basename "$f")"
done

echo "▸ Idempotencia (segunda pasada)"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null 2>&1
done
echo "   ✓ reaplicadas sin error"

echo "▸ Toda tabla con RLS"
sin_rls=$("${PSQL[@]}" -d "$DB" -tAc \
  "SELECT coalesce(string_agg(c.relname, ', '), '') FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;")
if [ -n "$sin_rls" ]; then echo "   ✗ sin RLS: $sin_rls"; exit 1; fi
echo "   ✓ todas"

echo "▸ Pruebas de RLS"
salida=$("${PSQL[@]}" -d "$DB" -f "$RAIZ/supabase/tests/rls_hogar.test.sql" 2>&1 || true)
echo "$salida" | grep -oE "PASS +.*" | sed 's/^/   ✓ /'
if echo "$salida" | grep -qE "FALLO|ERROR"; then
  echo "$salida" | grep -E "FALLO|ERROR" | sed 's/^/   ✗ /'
  exit 1
fi

total=$(echo "$salida" | grep -c "PASS" || true)
echo
echo "✅ $total casos en verde"
