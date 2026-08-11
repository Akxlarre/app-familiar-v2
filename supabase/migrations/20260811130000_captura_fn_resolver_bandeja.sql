-- spec:
--   functions_added: [normalizar_comercio, categoria_para_comercio, resolver_captura]
--   breaking: false
--   description: "Resolución de capturas desde la bandeja, con la normalización de comercios como única implementación."
-- /spec

-- =============================================================================
-- Resolver una captura desde la bandeja (REQ-012, REQ-013)
--
-- La normalización de comercios vive ACÁ y en ningún otro lado. Tenía dos
-- implementaciones —una en la edge function y otra en el cliente— y eso es el
-- mismo error que products/foods: si divergen, los alias que escribe la UI no
-- coinciden con los que busca el proceso de correos, y el aprendizaje deja de
-- funcionar sin que nada falle.
-- =============================================================================

-- Quitar tildes sin depender de la extensión `unaccent`, que no está disponible
-- en todos los planes de Supabase.
CREATE OR REPLACE FUNCTION public.unaccent_simple(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    coalesce(p_texto, ''),
    'áéíóúàèìòùäëïöüâêîôûãõñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑÇ',
    'aeiouaeiouaeiouaeiouaoncAEIOUAEIOUAEIOUAEIOUAONC'
  );
$$;

-- ─── normalizar_comercio ─────────────────────────────────────────────────────
-- "UBER   *TRIP 123" y "uber *trip 456" tienen que dar el mismo patrón: los
-- números cambian en cada transacción y no son parte de la identidad del
-- comercio.
CREATE OR REPLACE FUNCTION public.normalizar_comercio(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            upper(public.unaccent_simple(coalesce(p_texto, ''))),
            '[0-9]+', ' ', 'g'),          -- los números varían por transacción
          '[^A-Z ]', ' ', 'g'),           -- símbolos: *, -, ., #
        '\s+', ' ', 'g')                  -- espacios repetidos
    ),
  '');
$$;

-- ─── categoria_para_comercio ─────────────────────────────────────────────────
-- La usa el proceso de correos para aplicar lo aprendido. Devuelve NULL si el
-- comercio todavía no tiene alias.
CREATE OR REPLACE FUNCTION public.categoria_para_comercio(
  p_household_id UUID,
  p_comercio     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patron  TEXT;
  v_alias   public.alias_comercio;
BEGIN
  v_patron := public.normalizar_comercio(p_comercio);
  IF v_patron IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_alias
    FROM public.alias_comercio
   WHERE household_id = p_household_id AND patron = v_patron;

  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.alias_comercio SET aciertos = aciertos + 1 WHERE id = v_alias.id;
  RETURN v_alias.categoria_id;
END;
$$;

-- ─── resolver_captura ────────────────────────────────────────────────────────
-- Crea el movimiento, marca la captura y —si se pidió— aprende el comercio.
--
-- Es un RPC y no tres escrituras desde el cliente porque tiene que ser atómico:
-- si el movimiento se crea y la captura no se marca, el siguiente reproceso la
-- ve pendiente y duplica.
--
-- SECURITY INVOKER a propósito: corre con los permisos del usuario, así que el
-- RLS de siempre decide si puede tocar ese hogar. No hace falta un predicado
-- especial acá.
CREATE OR REPLACE FUNCTION public.resolver_captura(
  p_captura_id    UUID,
  p_monto         BIGINT,
  p_comercio      TEXT,
  p_categoria_id  UUID,
  p_cuenta_id     UUID,
  p_fecha         DATE,
  p_tipo          TEXT,
  p_recordar      BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_captura      public.capturas;
  v_movimiento_id UUID;
  v_patron       TEXT;
  v_cuenta_id    UUID := p_cuenta_id;
  v_categoria_id UUID := p_categoria_id;
BEGIN
  IF p_tipo NOT IN ('gasto', 'ingreso') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_tipo;
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero';
  END IF;

  -- El SELECT pasa por RLS: si la captura es de otro hogar, no se encuentra.
  SELECT * INTO v_captura FROM public.capturas WHERE id = p_captura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Captura inexistente o de otro hogar';
  END IF;

  IF v_captura.estado = 'procesada' THEN
    RAISE EXCEPTION 'La captura ya fue procesada';
  END IF;

  -- La cuenta y la categoría son opcionales: el cliente no las conoce y no tiene
  -- por qué inventarlas. Se resuelven acá, que es donde está el contexto.
  IF v_cuenta_id IS NULL THEN
    SELECT cuenta_id INTO v_cuenta_id
      FROM public.parsers_email WHERE id = v_captura.parser_id;
  END IF;
  IF v_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'Falta indicar la cuenta: el parser de origen no tiene una asociada';
  END IF;

  IF v_categoria_id IS NULL THEN
    v_categoria_id := public.categoria_para_comercio(v_captura.household_id, p_comercio);
  END IF;
  IF v_categoria_id IS NULL THEN
    SELECT id INTO v_categoria_id
      FROM public.categorias_gasto
     WHERE household_id IS NULL
       AND nombre = CASE WHEN p_tipo = 'ingreso' THEN 'Transferencia' ELSE 'Otros' END;
  END IF;

  INSERT INTO public.movimientos (
    household_id, cuenta_id, profile_id, categoria_id,
    monto, tipo, fecha, comercio, captura_id
  ) VALUES (
    v_captura.household_id, v_cuenta_id, auth.uid(), v_categoria_id,
    p_monto, p_tipo, p_fecha, nullif(btrim(p_comercio), ''), p_captura_id
  )
  RETURNING id INTO v_movimiento_id;

  UPDATE public.capturas
     SET estado = 'procesada', motivo = NULL, updated_at = now()
   WHERE id = p_captura_id;

  -- REQ-013: se enseña una vez y se aplica siempre.
  IF p_recordar THEN
    v_patron := public.normalizar_comercio(p_comercio);
    IF v_patron IS NOT NULL AND v_categoria_id IS NOT NULL THEN
      INSERT INTO public.alias_comercio (household_id, patron, categoria_id)
      VALUES (v_captura.household_id, v_patron, v_categoria_id)
      ON CONFLICT (household_id, patron)
      DO UPDATE SET categoria_id = EXCLUDED.categoria_id;
    END IF;
  END IF;

  RETURN v_movimiento_id;
END;
$$;
