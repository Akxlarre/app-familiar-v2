-- =============================================================================
-- Lo que Supabase provee en producción, reproducido para poder probar el esquema
-- contra un PostgreSQL pelado.
--
-- No es parte de las migraciones: en un proyecto Supabase real, GoTrue crea el
-- schema `auth` y sus funciones antes de que corra la primera migración. Esto
-- existe sólo para que las pruebas se puedan correr en cualquier lado:
--
--   createdb prueba
--   psql -d prueba -f supabase/tests/_bootstrap_auth.sql
--   psql -d prueba -f supabase/migrations/*.sql
--   psql -d prueba -f supabase/tests/rls_hogar.test.sql
--
-- Las firmas replican las reales de Supabase: `auth.uid()` lee el claim `sub`
-- del JWT, que en las pruebas se simula con `set_config('request.jwt.claim.sub', …)`.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                  UUID PRIMARY KEY,
  instance_id         UUID,
  email               TEXT,
  raw_user_meta_data  JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

-- Roles de PostgREST.
DO $$ BEGIN CREATE ROLE anon;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

-- Supabase concede los privilegios de tabla por defecto; RLS es lo que después
-- restringe fila por fila. Sin esto, las policies no llegan ni a evaluarse.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
