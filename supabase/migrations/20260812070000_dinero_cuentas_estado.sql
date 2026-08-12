-- spec:
--   columns_added: [estado]
--   breaking: false
--   description: "Archivar una cuenta sin borrarla: sus movimientos históricos no se pueden perder."
-- /spec

-- =============================================================================
-- ESTADO DE UNA CUENTA (spec 0006, AC4 y AC5)
--
-- Una cuenta con movimientos **no se borra**. `movimientos.cuenta_id` es
-- `ON DELETE SET NULL`, así que borrarla no perdería las filas — pero sí de qué
-- tarjeta salió cada gasto, y eso no se puede reconstruir. Archivar conserva la
-- historia y saca la cuenta de las listas.
--
-- `estado TEXT` con CHECK y no `archivada BOOLEAN`: deja lugar a "cerrada por
-- el banco", que no es lo mismo que archivada por el usuario, sin otra
-- migración. La decisión está en las notas de la spec.
--
-- Ya existía `activa BOOLEAN`, que este campo reemplaza. Se migra el valor y se
-- deja la columna vieja para no romper nada que la lea todavía: quitarla es una
-- limpieza aparte, no algo que deba pasar en la misma migración que introduce
-- su reemplazo.
-- =============================================================================

ALTER TABLE public.cuentas
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activa'
  CHECK (estado IN ('activa', 'archivada', 'cerrada'));

COMMENT ON COLUMN public.cuentas.estado IS
  'activa = en uso · archivada = el usuario la sacó de las listas · cerrada = el banco la cerró. Sus movimientos siguen visibles en los tres casos (spec 0006, AC5).';

-- Traer lo que decía `activa`, para no perder cuentas ya dadas de baja.
UPDATE public.cuentas SET estado = 'archivada' WHERE activa = false AND estado = 'activa';

-- Las listas piden las activas de un hogar: es la consulta de todos los días.
CREATE INDEX IF NOT EXISTS idx_cuentas_household_estado
  ON public.cuentas(household_id, estado);
