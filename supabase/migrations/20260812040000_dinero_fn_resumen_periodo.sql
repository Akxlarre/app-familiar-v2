-- spec:
--   functions_added: [resumen_del_periodo, gasto_por_categoria]
--   indexes_added: [idx_movimientos_household_fecha]
--   breaking: false
--   description: "Los números del período y el reparto por categoría, agregados en la base y no en el cliente."
-- /spec

-- =============================================================================
-- LOS NÚMEROS DE LA PANTALLA DE PLATA (spec 0005, AC6 y AC7)
--
-- Agregar en el cliente obliga a traerse todas las filas del período para
-- sumarlas. Con un mes normal son decenas y no se nota; con un año son miles y
-- la pantalla deja de cumplir RNF-02 sin que nadie haya tocado su código. Sumar
-- es trabajo de la base.
--
-- No hay vista materializada a propósito: un hogar no genera ese volumen, y
-- materializar obliga a decidir cuándo refrescar — una decisión que se paga
-- para siempre a cambio de nada.
--
-- Las dos funciones son `STABLE` y **no** `SECURITY DEFINER`: corren con los
-- permisos de quien llama, así que RLS filtra por hogar igual que en una query
-- normal. Una función que salta RLS para "simplificar" es cómo se filtran datos
-- entre hogares.
-- =============================================================================

-- El índice que hace que todo esto sea barato. La pantalla siempre pide un
-- rango de fechas de un hogar, y siempre en orden descendente.
CREATE INDEX IF NOT EXISTS idx_movimientos_household_fecha
  ON public.movimientos(household_id, fecha DESC);

-- ─── Los tres números del hero ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resumen_del_periodo(p_desde DATE, p_hasta DATE)
RETURNS TABLE (gastado BIGINT, ingresado BIGINT, saldo BIGINT, movimientos INT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(monto) FILTER (WHERE tipo = 'gasto'), 0)::BIGINT,
    COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0)::BIGINT,
    (COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0)
   - COALESCE(SUM(monto) FILTER (WHERE tipo = 'gasto'), 0))::BIGINT,
    COUNT(*)::INT
  FROM public.movimientos
  WHERE fecha >= p_desde AND fecha <= p_hasta;
$$;

-- Con la firma explícita, no por prolijidad: sin ella `COMMENT ON FUNCTION`
-- falla con "function name is not unique" apenas exista otra sobrecarga del
-- mismo nombre — que es justo lo que agrega la migración 060000. Una migración
-- vieja no puede volverse irreproducible porque una nueva sume una sobrecarga.
COMMENT ON FUNCTION public.resumen_del_periodo(DATE, DATE) IS
  'Gastado, ingresado y saldo del período. STABLE y sin SECURITY DEFINER: RLS filtra por hogar.';

-- ─── El reparto por categoría ────────────────────────────────────────────────
-- Sólo gastos: mezclar el sueldo con las categorías de gasto haría que
-- "Sueldo" se comiera el 90% del gráfico y el resto fuera ilegible.
CREATE OR REPLACE FUNCTION public.gasto_por_categoria(p_desde DATE, p_hasta DATE)
RETURNS TABLE (categoria_id UUID, categoria TEXT, total BIGINT, movimientos INT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    m.categoria_id,
    -- Sin categoría es un estado real y frecuente: la cadena no siempre acierta.
    -- Agruparlo bajo su propio nombre lo hace visible en vez de esconderlo.
    COALESCE(c.nombre, 'Sin categorizar'),
    SUM(m.monto)::BIGINT,
    COUNT(*)::INT
  FROM public.movimientos m
  LEFT JOIN public.categorias_gasto c ON c.id = m.categoria_id
  WHERE m.tipo = 'gasto' AND m.fecha >= p_desde AND m.fecha <= p_hasta
  GROUP BY m.categoria_id, c.nombre
  ORDER BY SUM(m.monto) DESC;
$$;

COMMENT ON FUNCTION public.gasto_por_categoria(DATE, DATE) IS
  'Reparto de gastos por categoría en un período, de mayor a menor. Sólo gastos: el sueldo taparía el resto.';

GRANT EXECUTE ON FUNCTION public.resumen_del_periodo(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gasto_por_categoria(DATE, DATE) TO authenticated;
