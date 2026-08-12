-- spec:
--   functions_added: [contar_mismo_comercio, recategorizar_movimiento, borrar_movimiento]
--   breaking: false
--   description: "Corregir la categoría de un movimiento y que el sistema aprenda el comercio para la próxima."
-- /spec

-- =============================================================================
-- CORREGIR Y APRENDER (spec 0005, AC9–AC12)
--
-- Es la pieza que hace que la app mejore con el uso: cada comercio aprendido es
-- una captura que la próxima vez llega ya categorizada y no pasa por la bandeja
-- (REQ-013, RN-10).
--
-- Todo pasa por SQL y no por el cliente por un motivo concreto: agrupar "los
-- otros movimientos del mismo comercio" exige normalizar el nombre igual que lo
-- hace `normalizar_comercio`. Reimplementarlo en TypeScript sería una segunda
-- versión del pedazo del que depende TODO el aprendizaje, y el día que las dos
-- difieran los alias dejarían de aplicarse en silencio.
--
-- Ninguna es `SECURITY DEFINER`: RLS ya filtra por hogar y `authenticated`
-- tiene los privilegios que necesitan (fix-001). Elevar permisos "para
-- simplificar" es cómo se filtran datos entre hogares.
-- =============================================================================

-- ─── Cuántos movimientos pasados comparten el comercio ───────────────────────
-- El número va A LA VISTA antes de que el usuario acepte (AC11): "también
-- aplicar a los 14 anteriores de JUMBO" deja evaluar; "¿aplicar a los
-- anteriores?" a ciegas, no.
CREATE OR REPLACE FUNCTION public.contar_mismo_comercio(
  p_movimiento_id UUID,
  p_categoria_id  UUID
)
RETURNS INT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_patron TEXT;
BEGIN
  SELECT public.normalizar_comercio(comercio) INTO v_patron
    FROM public.movimientos WHERE id = p_movimiento_id;

  IF v_patron IS NULL THEN RETURN 0; END IF;

  -- Se excluye el propio movimiento y los que YA tienen la categoría destino:
  -- ofrecer "aplicar a 14" cuando 12 ya están bien infla el número y hace que
  -- el usuario acepte creyendo que arregla más de lo que arregla.
  RETURN (
    SELECT count(*)
      FROM public.movimientos
     WHERE id <> p_movimiento_id
       AND public.normalizar_comercio(comercio) = v_patron
       AND (categoria_id IS DISTINCT FROM p_categoria_id)
  );
END;
$$;

-- ─── Corregir, y opcionalmente aprender ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recategorizar_movimiento(
  p_movimiento_id   UUID,
  p_categoria_id    UUID,
  p_recordar        BOOLEAN DEFAULT false,
  p_aplicar_pasados BOOLEAN DEFAULT false
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_patron   TEXT;
  v_hogar    UUID;
  v_afectados INT := 0;
BEGIN
  IF p_categoria_id IS NULL THEN
    RAISE EXCEPTION 'Hay que elegir una categoría';
  END IF;

  SELECT household_id, public.normalizar_comercio(comercio)
    INTO v_hogar, v_patron
    FROM public.movimientos WHERE id = p_movimiento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento inexistente o de otro hogar';
  END IF;

  UPDATE public.movimientos
     SET categoria_id = p_categoria_id, updated_at = now()
   WHERE id = p_movimiento_id;
  v_afectados := 1;

  -- El alias es lo que hace que la próxima vez no haya que corregir nada.
  IF p_recordar AND v_patron IS NOT NULL THEN
    INSERT INTO public.alias_comercio (household_id, patron, categoria_id)
    VALUES (v_hogar, v_patron, p_categoria_id)
    ON CONFLICT (household_id, patron)
    DO UPDATE SET categoria_id = EXCLUDED.categoria_id;
  END IF;

  -- Reescribir el historial es una decisión del usuario, nunca un efecto
  -- secundario de marcar "recordar" (R-04: nada cambia en silencio).
  IF p_aplicar_pasados AND v_patron IS NOT NULL THEN
    UPDATE public.movimientos
       SET categoria_id = p_categoria_id, updated_at = now()
     WHERE id <> p_movimiento_id
       AND public.normalizar_comercio(comercio) = v_patron
       AND (categoria_id IS DISTINCT FROM p_categoria_id);
    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    v_afectados := v_afectados + 1;
  END IF;

  RETURN v_afectados;
END;
$$;

-- ─── Borrar un movimiento sin perder su captura ──────────────────────────────
-- RN-09: una captura nunca se pierde. Borrar el movimiento creado por error
-- devuelve su captura a la bandeja en vez de dejar el correo sin rastro — si
-- desapareciera, el usuario no tendría forma de volver a intentarlo.
CREATE OR REPLACE FUNCTION public.borrar_movimiento(p_movimiento_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_captura UUID;
BEGIN
  SELECT captura_id INTO v_captura
    FROM public.movimientos WHERE id = p_movimiento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento inexistente o de otro hogar';
  END IF;

  DELETE FROM public.movimientos WHERE id = p_movimiento_id;

  -- Sólo si nació de una captura. Los cargados a mano no tienen a dónde volver.
  IF v_captura IS NOT NULL THEN
    UPDATE public.capturas
       SET estado = 'pendiente', motivo = 'El movimiento se borró: revisar de nuevo'
     WHERE id = v_captura;
  END IF;

  RETURN v_captura IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contar_mismo_comercio(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recategorizar_movimiento(UUID, UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.borrar_movimiento(UUID) TO authenticated;
