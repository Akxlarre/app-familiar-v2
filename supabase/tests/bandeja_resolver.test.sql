-- =============================================================================
-- El ciclo completo de la bandeja (REQ-012, REQ-013).
--
-- Lo que se comprueba no es que el SQL corra, sino que el producto cumpla su
-- promesa: que categorizar un comercio UNA vez alcance para siempre.
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
  IF p_cond THEN RAISE NOTICE 'PASS  %', p_desc;
  ELSE RAISE EXCEPTION 'FALLO: %', p_desc; END IF;
END; $$;

-- ─── Escenario ───────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, instance_id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        'ana@test.cl', '{"display_name":"Ana"}');

SELECT pg_temp.como('11111111-1111-1111-1111-111111111111');
SELECT public.create_household('Casa Ana');

SELECT pg_temp.como_admin();
CREATE TEMP TABLE ctx AS
  SELECT p.household_id AS hogar, p.id AS ana
    FROM public.profiles p WHERE p.id = '11111111-1111-1111-1111-111111111111';
GRANT SELECT ON ctx TO authenticated;

INSERT INTO public.cuentas (household_id, nombre, tipo, banco)
  SELECT hogar, 'Visa', 'credito', 'Banco Ejemplo' FROM ctx;

INSERT INTO public.parsers_email (household_id, banco, tipo, remitente_patron, regex_monto, cuenta_id)
  SELECT hogar, 'Banco Ejemplo', 'cargo', '@bancoejemplo.cl', 'por \$?([\d.]+)',
         (SELECT id FROM public.cuentas LIMIT 1)
    FROM ctx;

-- Dos correos del MISMO comercio, como los dejaría process-bank-emails.
INSERT INTO public.capturas (household_id, origen, origen_ref, parser_id, payload, interpretado, estado, fecha_origen)
  SELECT hogar, 'email', 'msg-1', (SELECT id FROM public.parsers_email LIMIT 1),
         '{"asunto":"Compra con tarjeta"}'::jsonb,
         '{"monto":15990,"comercio":"UBER *TRIP 123","confianza":85}'::jsonb,
         'pendiente', now()
    FROM ctx;
INSERT INTO public.capturas (household_id, origen, origen_ref, parser_id, payload, interpretado, estado, fecha_origen)
  SELECT hogar, 'email', 'msg-2', (SELECT id FROM public.parsers_email LIMIT 1),
         '{"asunto":"Compra con tarjeta"}'::jsonb,
         '{"monto":8500,"comercio":"uber *trip  456","confianza":85}'::jsonb,
         'pendiente', now()
    FROM ctx;

-- ─── La normalización agrupa lo que es el mismo comercio ─────────────────────
SELECT pg_temp.ok('dos escrituras del mismo comercio dan el mismo patrón',
  public.normalizar_comercio('UBER *TRIP 123') = public.normalizar_comercio('uber *trip  456'));

SELECT pg_temp.ok('el patrón queda legible',
  public.normalizar_comercio('UBER *TRIP 123') = 'UBER TRIP');

SELECT pg_temp.ok('las tildes no cambian el patrón',
  public.normalizar_comercio('Café Altura') = public.normalizar_comercio('CAFE ALTURA'));

SELECT pg_temp.ok('un texto sin letras no genera patrón',
  public.normalizar_comercio('*** 123 ***') IS NULL);

-- ─── Resolver la primera, pidiendo recordar ──────────────────────────────────
SELECT pg_temp.como('11111111-1111-1111-1111-111111111111');

CREATE TEMP TABLE r1 AS
  SELECT public.resolver_captura(
    (SELECT id FROM public.capturas WHERE origen_ref = 'msg-1'),
    15990, 'UBER *TRIP 123', NULL, NULL, CURRENT_DATE, 'gasto', true
  ) AS movimiento_id;

SELECT pg_temp.ok('crea el movimiento', (SELECT movimiento_id FROM r1) IS NOT NULL);

SELECT pg_temp.ok('el movimiento queda ligado a su captura',
  (SELECT m.captura_id FROM public.movimientos m WHERE m.id = (SELECT movimiento_id FROM r1))
  = (SELECT id FROM public.capturas WHERE origen_ref = 'msg-1'));

SELECT pg_temp.ok('la captura queda procesada',
  (SELECT estado FROM public.capturas WHERE origen_ref = 'msg-1') = 'procesada');

SELECT pg_temp.ok('la cuenta salió del parser sin que el cliente la mandara',
  (SELECT cuenta_id FROM public.movimientos WHERE id = (SELECT movimiento_id FROM r1)) IS NOT NULL);

SELECT pg_temp.ok('sin alias previo cae a la categoría base "Otros"',
  (SELECT c.nombre FROM public.movimientos m
     JOIN public.categorias_gasto c ON c.id = m.categoria_id
    WHERE m.id = (SELECT movimiento_id FROM r1)) = 'Otros');

SELECT pg_temp.ok('quedó aprendido el comercio',
  (SELECT count(*) FROM public.alias_comercio WHERE patron = 'UBER TRIP') = 1);

-- ─── La promesa del producto: la segunda vez se categoriza sola ──────────────
SELECT pg_temp.como_admin();
UPDATE public.alias_comercio
   SET categoria_id = (SELECT id FROM public.categorias_gasto WHERE household_id IS NULL AND nombre = 'Transporte')
 WHERE patron = 'UBER TRIP';

SELECT pg_temp.ok('el alias aplica aunque el comercio venga escrito distinto',
  public.categoria_para_comercio((SELECT hogar FROM ctx), 'uber *trip  456')
  = (SELECT id FROM public.categorias_gasto WHERE household_id IS NULL AND nombre = 'Transporte'));

SELECT pg_temp.ok('usar el alias suma un acierto',
  (SELECT aciertos FROM public.alias_comercio WHERE patron = 'UBER TRIP') > 0);

SELECT pg_temp.como('11111111-1111-1111-1111-111111111111');
CREATE TEMP TABLE r2 AS
  SELECT public.resolver_captura(
    (SELECT id FROM public.capturas WHERE origen_ref = 'msg-2'),
    8500, 'uber *trip  456', NULL, NULL, CURRENT_DATE, 'gasto', false
  ) AS movimiento_id;

SELECT pg_temp.ok('la segunda captura se categoriza SOLA como Transporte',
  (SELECT c.nombre FROM public.movimientos m
     JOIN public.categorias_gasto c ON c.id = m.categoria_id
    WHERE m.id = (SELECT movimiento_id FROM r2)) = 'Transporte');

-- ─── Salvaguardas ────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM public.resolver_captura(
    (SELECT id FROM public.capturas WHERE origen_ref = 'msg-1'),
    1000, 'X', NULL, NULL, CURRENT_DATE, 'gasto', false);
  RAISE EXCEPTION 'FALLO: resolvió dos veces la misma captura';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ya fue procesada%' THEN RAISE NOTICE 'PASS  no se puede resolver dos veces';
  ELSE RAISE; END IF;
END $$;

DO $$
BEGIN
  PERFORM public.resolver_captura(
    (SELECT id FROM public.capturas WHERE origen_ref = 'msg-2'),
    0, 'X', NULL, NULL, CURRENT_DATE, 'gasto', false);
  RAISE EXCEPTION 'FALLO: aceptó monto cero';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%mayor que cero%' THEN RAISE NOTICE 'PASS  rechaza monto cero';
  ELSE RAISE; END IF;
END $$;

DO $$
BEGIN
  PERFORM public.resolver_captura(
    gen_random_uuid(), 1000, 'X', NULL, NULL, CURRENT_DATE, 'gasto', false);
  RAISE EXCEPTION 'FALLO: resolvió una captura inexistente';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%inexistente%' THEN RAISE NOTICE 'PASS  rechaza una captura de otro hogar o inexistente';
  ELSE RAISE; END IF;
END $$;

ROLLBACK;
