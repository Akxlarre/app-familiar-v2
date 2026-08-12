-- spec:
--   functions_added: [resumen_del_periodo, gasto_por_categoria]
--   breaking: false
--   description: "Los números del hero se recalculan sobre lo filtrado, no sobre el período entero."
-- /spec

-- =============================================================================
-- LOS NÚMEROS SIGUEN AL FILTRO (spec 0005, AC13)
--
-- Las funciones anteriores sumaban el período completo. Con un filtro puesto
-- —"sólo Supermercado", "sólo esta tarjeta"— el hero seguía mostrando el total
-- de todo, así que la lista decía una cosa y los números otra. Peor que no
-- tenerlos: el usuario filtra justamente para saber cuánto es ESO.
--
-- Los parámetros nuevos son opcionales y por defecto `NULL`, que significa "sin
-- filtrar". Así la firma vieja sigue funcionando y ninguna llamada existente se
-- rompe.
--
-- El texto se compara con `ILIKE` sobre `comercio`, igual que la consulta de la
-- lista. Si acá se filtrara distinto, los números no cuadrarían con las filas
-- —que es exactamente el bug que esta migración corrige, sólo que más difícil
-- de ver.
-- =============================================================================

-- `CREATE OR REPLACE` **no** reemplaza cuando la firma cambia: crea una segunda
-- función con el mismo nombre. Con las dos vivas, una llamada de dos argumentos
-- se vuelve ambigua y Postgres la rechaza con "function is not unique" — es
-- decir, agregar parámetros opcionales rompería a todos los clientes existentes.
-- Por eso se borra la versión anterior explícitamente.
DROP FUNCTION IF EXISTS public.resumen_del_periodo(DATE, DATE);
DROP FUNCTION IF EXISTS public.gasto_por_categoria(DATE, DATE);

CREATE OR REPLACE FUNCTION public.resumen_del_periodo(
  p_desde        DATE,
  p_hasta        DATE,
  p_cuenta_id    UUID DEFAULT NULL,
  p_categoria_id UUID DEFAULT NULL,
  p_tipo         TEXT DEFAULT NULL,
  p_texto        TEXT DEFAULT NULL
)
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
  WHERE fecha >= p_desde AND fecha <= p_hasta
    AND (p_cuenta_id    IS NULL OR cuenta_id = p_cuenta_id)
    AND (p_categoria_id IS NULL OR categoria_id = p_categoria_id)
    AND (p_tipo         IS NULL OR tipo = p_tipo)
    AND (p_texto        IS NULL OR p_texto = '' OR comercio ILIKE '%' || p_texto || '%');
$$;

CREATE OR REPLACE FUNCTION public.gasto_por_categoria(
  p_desde        DATE,
  p_hasta        DATE,
  p_cuenta_id    UUID DEFAULT NULL,
  p_categoria_id UUID DEFAULT NULL,
  p_texto        TEXT DEFAULT NULL
)
RETURNS TABLE (categoria_id UUID, categoria TEXT, total BIGINT, movimientos INT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    m.categoria_id,
    COALESCE(c.nombre, 'Sin categorizar'),
    SUM(m.monto)::BIGINT,
    COUNT(*)::INT
  FROM public.movimientos m
  LEFT JOIN public.categorias_gasto c ON c.id = m.categoria_id
  -- Sin `p_tipo`: el reparto es de gastos por definición, y dejar filtrar por
  -- 'ingreso' devolvería siempre vacío en vez de decir algo útil.
  WHERE m.tipo = 'gasto' AND m.fecha >= p_desde AND m.fecha <= p_hasta
    AND (p_cuenta_id    IS NULL OR m.cuenta_id = p_cuenta_id)
    AND (p_categoria_id IS NULL OR m.categoria_id = p_categoria_id)
    AND (p_texto        IS NULL OR p_texto = '' OR m.comercio ILIKE '%' || p_texto || '%')
  GROUP BY m.categoria_id, c.nombre
  ORDER BY SUM(m.monto) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.resumen_del_periodo(DATE, DATE, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gasto_por_categoria(DATE, DATE, UUID, UUID, TEXT) TO authenticated;
