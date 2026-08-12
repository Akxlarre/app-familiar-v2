-- Prueba de VOLUMEN. No es una migración ni datos de demo: se corre a mano para
-- verificar AC-E4 de la spec 0005 (y de paso AC-E1 de la 0002, que pedía 500
-- filas y quedó diferido desde entonces).
--
-- 5.000 movimientos repartidos en dos años. Lo que se está comprobando no es
-- que la base aguante —Postgres ni se despeina— sino que **la pantalla no se
-- los traiga todos**: el modo de fallar de una lista es pedir el conjunto
-- completo y paginar en el cliente, y eso no se nota hasta que hay volumen.
DO $$
DECLARE
  v_hogar  UUID;
  v_cuenta UUID;
  v_perfil UUID;
  v_cats   UUID[];
BEGIN
  SELECT id INTO v_hogar FROM public.households
   WHERE id IN (SELECT household_id FROM public.movimientos) LIMIT 1;
  IF v_hogar IS NULL THEN SELECT id INTO v_hogar FROM public.households LIMIT 1; END IF;
  SELECT id INTO v_cuenta FROM public.cuentas WHERE household_id = v_hogar LIMIT 1;
  SELECT id INTO v_perfil FROM public.profiles WHERE household_id = v_hogar LIMIT 1;
  SELECT array_agg(id) INTO v_cats FROM public.categorias_gasto;

  INSERT INTO public.movimientos (household_id, cuenta_id, profile_id, categoria_id, monto, tipo, fecha, comercio)
  SELECT
    v_hogar, v_cuenta, v_perfil,
    -- Uno de cada diez sin categoría, como en la vida real.
    CASE WHEN i % 10 = 0 THEN NULL ELSE v_cats[1 + (i % array_length(v_cats, 1))] END,
    1000 + (i * 37) % 90000,
    CASE WHEN i % 40 = 0 THEN 'ingreso' ELSE 'gasto' END,
    CURRENT_DATE - (i % 730),
    'COMERCIO ' || (i % 250)
  FROM generate_series(1, 5000) AS i;

  RAISE NOTICE 'total ahora: %', (SELECT count(*) FROM public.movimientos WHERE household_id = v_hogar);
END $$;
