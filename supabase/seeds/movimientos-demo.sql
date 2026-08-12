-- Datos de DESARROLLO. No es una migración: vive en seeds/ y se corre a mano.
--
-- Simula lo que la cadena de captura produciría tras un par de meses, para poder
-- construir y verificar la pantalla de Plata (spec 0005) antes de que haya un
-- Gmail conectado. Incluye a propósito los casos borde que la spec exige:
-- movimientos sin categoría (AC-E1), ingresos (AC2), y compras en cuotas (AC-E3).
DO $$
DECLARE
  v_hogar   UUID;
  v_cuenta  UUID;
  v_perfil  UUID;
  cat       JSONB := '{}';
  r         RECORD;
BEGIN
  SELECT id INTO v_hogar  FROM public.households LIMIT 1;
  SELECT id INTO v_cuenta FROM public.cuentas WHERE household_id = v_hogar LIMIT 1;
  SELECT id INTO v_perfil FROM public.profiles WHERE household_id = v_hogar LIMIT 1;
  IF v_hogar IS NULL OR v_cuenta IS NULL THEN
    RAISE EXCEPTION 'Falta hogar o cuenta: corré el onboarding primero';
  END IF;

  FOR r IN SELECT nombre, id FROM public.categorias_gasto LOOP
    cat := jsonb_set(cat, ARRAY[r.nombre], to_jsonb(r.id::text));
  END LOOP;

  DELETE FROM public.movimientos WHERE household_id = v_hogar;

  INSERT INTO public.movimientos (household_id, cuenta_id, profile_id, categoria_id, monto, tipo, fecha, comercio)
  SELECT v_hogar, v_cuenta, v_perfil,
         (cat->>d.categoria)::uuid, d.monto, d.tipo, CURRENT_DATE - d.dias, d.comercio
  FROM (VALUES
    (0,  15990, 'gasto',   'Supermercado',  'JUMBO MAIPU'),
    (0,   4500, 'gasto',   'Restaurantes',  'STARBUCKS PROVIDENCIA'),
    (1,   2300, 'gasto',   'Transporte',    'METRO DE SANTIAGO'),
    (1,  32450, 'gasto',   'Supermercado',  'LIDER EXPRESS'),
    (2,   8990, 'gasto',   'Entretención',  'NETFLIX.COM'),
    (3, 129900, 'gasto',   'Hogar',         'SODIMAC HOMECENTER'),
    (4,   6700, 'gasto',   'Restaurantes',  'DOGGIS'),
    (5,  45000, 'gasto',   'Salud',         'FARMACIA CRUZ VERDE'),
    (6,  12500, 'gasto',   'Transporte',    'COPEC'),
    (7,  23400, 'gasto',   'Supermercado',  'UNIMARC'),
    (9,   3200, 'gasto',   'Restaurantes',  'JUAN VALDEZ'),
    (11, 89000, 'gasto',   'Servicios',     'ENEL DISTRIBUCION'),
    (12, 18700, 'gasto',   'Supermercado',  'JUMBO MAIPU'),
    (14,  5600, 'gasto',   'Transporte',    'UBER TRIP'),
    (16, 34900, 'gasto',   'Entretención',  'CINEMARK'),
    (18, 11200, 'gasto',   'Restaurantes',  'PAPA JOHNS'),
    (20, 27800, 'gasto',   'Supermercado',  'TOTTUS'),
    (22,  9900, 'gasto',   'Servicios',     'SPOTIFY'),
    (25, 56000, 'gasto',   'Hogar',         'EASY'),
    (28, 41300, 'gasto',   'Supermercado',  'JUMBO MAIPU'),
    (30, 950000,'ingreso', 'Sueldo',        'TRANSFERENCIA SUELDO'),
    (33, 19800, 'gasto',   'Restaurantes',  'LA PICADA'),
    (36, 62000, 'gasto',   'Educación',     'COLEGIO SAN JOSE'),
    (40, 15400, 'gasto',   'Supermercado',  'LIDER EXPRESS'),
    (45,  7800, 'gasto',   'Transporte',    'SHELL'),
    (50, 88000, 'gasto',   'Salud',         'CLINICA ALEMANA'),
    (55, 22100, 'gasto',   'Supermercado',  'JUMBO MAIPU'),
    (60, 950000,'ingreso', 'Sueldo',        'TRANSFERENCIA SUELDO')
  ) AS d(dias, monto, tipo, categoria, comercio);

  -- Sin categoría: la cadena no siempre acierta, y AC-E1 pide que se vea y se
  -- pueda arreglar de un toque.
  INSERT INTO public.movimientos (household_id, cuenta_id, profile_id, categoria_id, monto, tipo, fecha, comercio)
  VALUES
    (v_hogar, v_cuenta, v_perfil, NULL, 13400, 'gasto', CURRENT_DATE - 2,  'COMERCIO DESCONOCIDO SPA'),
    (v_hogar, v_cuenta, v_perfil, NULL,  6200, 'gasto', CURRENT_DATE - 8,  'PAGO SERVICIOS 4471'),
    (v_hogar, v_cuenta, v_perfil, NULL, 45800, 'gasto', CURRENT_DATE - 19, 'MERPAGO*VARIOS');

  -- Un movimiento sin comercio: el banco no siempre lo manda (AC-E2 vecino).
  INSERT INTO public.movimientos (household_id, cuenta_id, profile_id, categoria_id, monto, tipo, fecha, comercio)
  VALUES (v_hogar, v_cuenta, v_perfil, (cat->>'Otros')::uuid, 3900, 'gasto', CURRENT_DATE - 4, NULL);

  RAISE NOTICE 'sembrados % movimientos', (SELECT count(*) FROM public.movimientos WHERE household_id = v_hogar);
END $$;
