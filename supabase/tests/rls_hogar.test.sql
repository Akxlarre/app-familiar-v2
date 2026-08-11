-- =============================================================================
-- Pruebas de RLS y RPC del contexto Hogar + Dinero.
--
-- RN-01 dice que ningún hogar ve datos de otro. Eso no se verifica leyendo
-- policies: se verifica poniéndose en los zapatos de dos usuarios distintos y
-- comprobando que uno no alcanza los datos del otro.
--
--   psql -f supabase/tests/rls_hogar.test.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO NOTICE;

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.como(p_uid UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.como_admin() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.ok(p_desc TEXT, p_cond BOOLEAN) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond THEN
    RAISE NOTICE 'PASS  %', p_desc;
  ELSE
    RAISE EXCEPTION 'FALLO: %', p_desc;
  END IF;
END; $$;

-- ─── Dos usuarios ────────────────────────────────────────────────────────────
-- El trigger on_auth_user_created crea el profile solo.
INSERT INTO auth.users (id, instance_id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'ana@test.cl',  '{"display_name":"Ana"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'beto@test.cl', '{"display_name":"Beto"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'caro@test.cl', '{"display_name":"Caro"}');

SELECT pg_temp.ok('el trigger crea un profile por usuario',
  (SELECT count(*) FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333')) = 3);

SELECT pg_temp.ok('toma el display_name de la metadata',
  (SELECT display_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') = 'Ana');

-- ─── REQ-001: crear hogar y unirse por código ────────────────────────────────
SELECT pg_temp.como('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.ok('Ana crea su hogar',
  (SELECT id FROM public.create_household('Casa Ana')) IS NOT NULL);

SELECT pg_temp.ok('el perfil queda asociado al hogar',
  (SELECT household_id FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') IS NOT NULL);

SELECT pg_temp.ok('el código tiene 6 caracteres legibles',
  (SELECT invite_code FROM public.households LIMIT 1) ~ '^[BCDFGHJKLMNPQRSTVWXYZ23456789]{6}$');

-- No puede crear un segundo hogar estando en uno.
DO $$
BEGIN
  PERFORM public.create_household('Segundo hogar');
  RAISE EXCEPTION 'FALLO: dejó crear un segundo hogar';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ya pertenece%' THEN RAISE NOTICE 'PASS  no deja crear un segundo hogar';
  ELSE RAISE; END IF;
END $$;

-- Beto se une con el código.
SELECT pg_temp.como_admin();
CREATE TEMP TABLE t_codigo AS SELECT invite_code AS c FROM public.households LIMIT 1;
GRANT SELECT ON t_codigo TO authenticated;

SELECT pg_temp.como('22222222-2222-2222-2222-222222222222');
SELECT pg_temp.ok('Beto se une con el código',
  (SELECT id FROM public.join_household_by_code((SELECT c FROM t_codigo))) IS NOT NULL);

SELECT pg_temp.ok('Ana y Beto comparten hogar',
  (SELECT count(DISTINCT household_id) FROM public.profiles
    WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')) = 1);

-- Beto ya tiene hogar: el RPC corta ahí, antes de mirar el código.
DO $$
BEGIN
  PERFORM public.join_household_by_code('XXXXXX');
  RAISE EXCEPTION 'FALLO: dejó unirse teniendo hogar';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ya pertenece%' THEN RAISE NOTICE 'PASS  no deja unirse a quien ya tiene hogar';
  ELSE RAISE; END IF;
END $$;

-- El código inválido se prueba con Caro, que todavía no pertenece a ninguno.
SELECT pg_temp.como('33333333-3333-3333-3333-333333333333');
DO $$
BEGIN
  PERFORM public.join_household_by_code('XXXXXX');
  RAISE EXCEPTION 'FALLO: aceptó un código inexistente';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%inválido%' THEN RAISE NOTICE 'PASS  rechaza un código inexistente';
  ELSE RAISE; END IF;
END $$;

-- Caro arma su propio hogar aparte.
SELECT public.create_household('Casa Caro');

-- ─── RN-01: aislamiento entre hogares ────────────────────────────────────────
SELECT pg_temp.como_admin();
CREATE TEMP TABLE t_hogares AS
  SELECT (SELECT household_id FROM public.profiles WHERE id='11111111-1111-1111-1111-111111111111') AS ana,
         (SELECT household_id FROM public.profiles WHERE id='33333333-3333-3333-3333-333333333333') AS caro;
GRANT SELECT ON t_hogares TO authenticated;

-- Datos en cada hogar, insertados como admin (salta RLS, como haría la edge function).
INSERT INTO public.cuentas (household_id, nombre, tipo)
  SELECT ana, 'Tarjeta Ana', 'credito' FROM t_hogares;
INSERT INTO public.cuentas (household_id, nombre, tipo)
  SELECT caro, 'Tarjeta Caro', 'credito' FROM t_hogares;

INSERT INTO public.movimientos (household_id, monto, tipo, comercio)
  SELECT ana, 15990, 'gasto', 'JUMBO' FROM t_hogares;
INSERT INTO public.movimientos (household_id, monto, tipo, comercio)
  SELECT caro, 42000, 'gasto', 'LIDER' FROM t_hogares;

SELECT pg_temp.como('11111111-1111-1111-1111-111111111111');

SELECT pg_temp.ok('Ana ve solo su hogar',
  (SELECT count(*) FROM public.households) = 1);

SELECT pg_temp.ok('Ana ve solo su cuenta',
  (SELECT count(*) FROM public.cuentas) = 1
  AND (SELECT nombre FROM public.cuentas) = 'Tarjeta Ana');

SELECT pg_temp.ok('Ana ve solo sus movimientos',
  (SELECT count(*) FROM public.movimientos) = 1
  AND (SELECT comercio FROM public.movimientos) = 'JUMBO');

SELECT pg_temp.ok('Ana ve a Beto (mismo hogar) pero no a Caro',
  (SELECT count(*) FROM public.profiles) = 2);

-- No puede escribir en el hogar ajeno.
DO $$
DECLARE v_caro UUID;
BEGIN
  SELECT caro INTO v_caro FROM t_hogares;
  INSERT INTO public.movimientos (household_id, monto, tipo) VALUES (v_caro, 1, 'gasto');
  RAISE EXCEPTION 'FALLO: escribió en el hogar de Caro';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS  no puede escribir en el hogar ajeno';
END $$;

-- ─── El household_id no se cambia por UPDATE (solo por RPC) ──────────────────
DO $$
DECLARE v_caro UUID; v_filas INT;
BEGIN
  SELECT caro INTO v_caro FROM t_hogares;
  BEGIN
    UPDATE public.profiles SET household_id = v_caro WHERE id = auth.uid();
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas > 0 THEN RAISE EXCEPTION 'FALLO: se mudó de hogar con un UPDATE'; END IF;
    RAISE NOTICE 'PASS  no puede mudarse de hogar con un UPDATE';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'PASS  no puede mudarse de hogar con un UPDATE';
  END;
END $$;

DO $$
DECLARE v_filas INT;
BEGIN
  UPDATE public.profiles SET display_name = 'Ana G.' WHERE id = auth.uid();
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas = 1 THEN RAISE NOTICE 'PASS  sí puede cambiar su nombre';
  ELSE RAISE EXCEPTION 'FALLO: no pudo cambiar su propio nombre'; END IF;
END $$;

-- ─── El catálogo base de categorías se ve; el ajeno no ───────────────────────
SELECT pg_temp.ok('ve las 11 categorías base',
  (SELECT count(*) FROM public.categorias_gasto WHERE household_id IS NULL) = 11);

-- ─── Idempotencia de la captura ──────────────────────────────────────────────
SELECT pg_temp.como_admin();
INSERT INTO public.capturas (household_id, origen, origen_ref, payload)
  SELECT ana, 'email', 'gmail-msg-abc123', '{"asunto":"Compra con tarjeta"}'::jsonb FROM t_hogares;

DO $$
DECLARE v_ana UUID;
BEGIN
  SELECT ana INTO v_ana FROM t_hogares;
  INSERT INTO public.capturas (household_id, origen, origen_ref, payload)
  VALUES (v_ana, 'email', 'gmail-msg-abc123', '{}'::jsonb);
  RAISE EXCEPTION 'FALLO: aceptó el mismo correo dos veces';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS  un mismo correo no entra dos veces a la bandeja';
END $$;

-- Una captura produce a lo sumo un movimiento.
DO $$
DECLARE v_ana UUID; v_cap UUID;
BEGIN
  SELECT ana INTO v_ana FROM t_hogares;
  SELECT id INTO v_cap FROM public.capturas WHERE origen_ref = 'gmail-msg-abc123';
  INSERT INTO public.movimientos (household_id, monto, tipo, captura_id) VALUES (v_ana, 5000, 'gasto', v_cap);
  INSERT INTO public.movimientos (household_id, monto, tipo, captura_id) VALUES (v_ana, 5000, 'gasto', v_cap);
  RAISE EXCEPTION 'FALLO: una captura generó dos movimientos';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS  una captura genera a lo sumo un movimiento';
END $$;

-- ─── Los tokens de OAuth no viajan al cliente (RNF-05) ───────────────────────
SELECT pg_temp.como('11111111-1111-1111-1111-111111111111');
DO $$
BEGIN
  PERFORM access_token FROM public.integraciones_email;
  RAISE EXCEPTION 'FALLO: el cliente puede leer access_token';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS  access_token no es legible por el cliente';
END $$;

ROLLBACK;
