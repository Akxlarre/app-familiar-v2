-- spec:
--   tables_added: [cuentas, detalle_credito, categorias_gasto, movimientos, alias_comercio, compras_en_cuotas]
--   columns_added: [monto, tipo, fecha, comercio, captura_id, compra_cuotas_id, numero_cuota, patron]
--   breaking: false
--   functions_added: [incrementar_aciertos_alias]
--   description: "Cuentas y movimientos, con alias_comercio para que categorizar se aprenda una sola vez."
-- /spec

-- =============================================================================
-- DINERO — cuentas, movimientos y lo que los categoriza solo
--
-- `alias_comercio` es la pieza que faltaba en v1: había alias aprendidos para
-- productos de boleta, pero no para comercios, así que categorizar seguía siendo
-- manual transacción por transacción, para siempre (REQ-013, RN-10).
--
-- No hay tags: `categorias_gasto` es la única taxonomía. v1 tenía las dos, que
-- es el mismo error que `products`/`foods` en chico.
-- =============================================================================

-- ─── cuentas (REQ-030) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cuentas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  titular_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nombre             TEXT NOT NULL,
  tipo               TEXT NOT NULL
                     CHECK (tipo IN ('debito', 'credito', 'efectivo', 'billetera_digital')),
  banco              TEXT,
  last4              TEXT CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$'),
  proposito          TEXT,

  -- Vínculo con la captura: de qué casilla y carpeta salen sus movimientos.
  correo_vinculado   TEXT,
  carpeta_inbox      TEXT,

  activa             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_household ON public.cuentas(household_id);

-- FK que quedó diferida en la migración de Captura: los parsers apuntan a la
-- cuenta destino, pero `cuentas` nace acá.
ALTER TABLE public.parsers_email
  DROP CONSTRAINT IF EXISTS parsers_email_cuenta_id_fkey;
ALTER TABLE public.parsers_email
  ADD CONSTRAINT parsers_email_cuenta_id_fkey
  FOREIGN KEY (cuenta_id) REFERENCES public.cuentas(id) ON DELETE SET NULL;

-- ─── detalle_credito ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.detalle_credito (
  cuenta_id          UUID PRIMARY KEY REFERENCES public.cuentas(id) ON DELETE CASCADE,
  cupo_total         BIGINT,
  dia_facturacion    SMALLINT CHECK (dia_facturacion BETWEEN 1 AND 31),
  dia_vencimiento    SMALLINT CHECK (dia_vencimiento BETWEEN 1 AND 31),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── categorias_gasto ────────────────────────────────────────────────────────
-- `household_id` nullable: las filas con NULL son el catálogo base que ve todo
-- el mundo; las del hogar son las propias.
CREATE TABLE IF NOT EXISTS public.categorias_gasto (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES public.households(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'gasto' CHECK (tipo IN ('gasto', 'ingreso')),
  padre_id      UUID REFERENCES public.categorias_gasto(id) ON DELETE SET NULL,
  icono         TEXT,
  color         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_gasto_household
  ON public.categorias_gasto(household_id);

-- ─── movimientos (REQ-011) ───────────────────────────────────────────────────
-- Montos en BIGINT: son pesos chilenos, sin decimales (RB-04). DECIMAL sería
-- precisión que no existe en el dominio.
CREATE TABLE IF NOT EXISTS public.movimientos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  cuenta_id      UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
  profile_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  categoria_id   UUID REFERENCES public.categorias_gasto(id) ON DELETE SET NULL,

  monto          BIGINT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  comercio       TEXT,
  nota           TEXT,

  -- De qué captura salió. NULL = lo cargó una persona a mano.
  captura_id     UUID REFERENCES public.capturas(id) ON DELETE SET NULL,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_household_fecha
  ON public.movimientos(household_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta ON public.movimientos(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_categoria ON public.movimientos(categoria_id);

-- Una captura produce a lo sumo un movimiento. Es la otra mitad de la
-- idempotencia: `capturas` ya es única por (hogar, origen, ref), y esto impide
-- que un reproceso duplique el movimiento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_captura
  ON public.movimientos(captura_id) WHERE captura_id IS NOT NULL;

-- ─── alias_comercio (REQ-013) ────────────────────────────────────────────────
-- Se enseña una vez y se aplica siempre. `patron` se guarda normalizado
-- (mayúsculas, sin espacios repetidos) para que "UBER *TRIP 123" y
-- "uber *trip  456" caigan en el mismo alias.
CREATE TABLE IF NOT EXISTS public.alias_comercio (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  patron         TEXT NOT NULL,
  categoria_id   UUID NOT NULL REFERENCES public.categorias_gasto(id) ON DELETE CASCADE,
  aciertos       INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, patron)
);

CREATE INDEX IF NOT EXISTS idx_alias_comercio_trgm
  ON public.alias_comercio USING gin (patron gin_trgm_ops);

-- ─── compras_en_cuotas (REQ-031) ─────────────────────────────────────────────
-- El correo del banco dice "Cuota 3 de 12" (RB-03). Se extrae, no se tipea.
CREATE TABLE IF NOT EXISTS public.compras_en_cuotas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  cuenta_id       UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
  descripcion     TEXT NOT NULL,
  comercio        TEXT,
  monto_cuota     BIGINT NOT NULL,
  cuotas_total    SMALLINT NOT NULL CHECK (cuotas_total > 0),
  primera_fecha   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_en_cuotas_household
  ON public.compras_en_cuotas(household_id);

-- Cada movimiento puede ser la cuota N de una compra. Así el total pagado y el
-- pendiente se calculan del historial real, sin un contador que mantener.
ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS compra_cuotas_id UUID
  REFERENCES public.compras_en_cuotas(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS numero_cuota SMALLINT;

CREATE INDEX IF NOT EXISTS idx_movimientos_compra_cuotas
  ON public.movimientos(compra_cuotas_id) WHERE compra_cuotas_id IS NOT NULL;

-- ─── Aciertos del alias ──────────────────────────────────────────────────────
-- Cada vez que un alias resuelve la categoría de un movimiento suma uno. Sirve
-- para ver cuáles están trabajando y cuáles se crearon y nunca se usaron.
-- Es un RPC y no un UPDATE desde la función para que el incremento sea atómico.
CREATE OR REPLACE FUNCTION public.incrementar_aciertos_alias(p_alias_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.alias_comercio SET aciertos = aciertos + 1 WHERE id = p_alias_id;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.cuentas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_credito    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gasto   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alias_comercio     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_en_cuotas  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cuentas_all ON public.cuentas;
CREATE POLICY cuentas_all ON public.cuentas
  FOR ALL TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));

DROP POLICY IF EXISTS detalle_credito_all ON public.detalle_credito;
CREATE POLICY detalle_credito_all ON public.detalle_credito
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cuentas c
                  WHERE c.id = cuenta_id AND public.belongs_to_household(c.household_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cuentas c
                       WHERE c.id = cuenta_id AND public.belongs_to_household(c.household_id)));

-- El catálogo base (household_id NULL) se lee pero no se toca.
DROP POLICY IF EXISTS categorias_gasto_select ON public.categorias_gasto;
CREATE POLICY categorias_gasto_select ON public.categorias_gasto
  FOR SELECT TO authenticated
  USING (household_id IS NULL OR public.belongs_to_household(household_id));

DROP POLICY IF EXISTS categorias_gasto_write ON public.categorias_gasto;
CREATE POLICY categorias_gasto_write ON public.categorias_gasto
  FOR ALL TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));

DROP POLICY IF EXISTS movimientos_all ON public.movimientos;
CREATE POLICY movimientos_all ON public.movimientos
  FOR ALL TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));

DROP POLICY IF EXISTS alias_comercio_all ON public.alias_comercio;
CREATE POLICY alias_comercio_all ON public.alias_comercio
  FOR ALL TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));

DROP POLICY IF EXISTS compras_en_cuotas_all ON public.compras_en_cuotas;
CREATE POLICY compras_en_cuotas_all ON public.compras_en_cuotas
  FOR ALL TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));

-- ─── Catálogo base de categorías ─────────────────────────────────────────────
INSERT INTO public.categorias_gasto (household_id, nombre, tipo, icono)
SELECT NULL, v.nombre, v.tipo, v.icono
  FROM (VALUES
    ('Supermercado',  'gasto',   'shopping-cart'),
    ('Transporte',    'gasto',   'car'),
    ('Salud',         'gasto',   'heart-pulse'),
    ('Hogar',         'gasto',   'house'),
    ('Servicios',     'gasto',   'zap'),
    ('Restaurantes',  'gasto',   'utensils'),
    ('Entretención',  'gasto',   'clapperboard'),
    ('Educación',     'gasto',   'graduation-cap'),
    ('Otros',         'gasto',   'circle-dashed'),
    ('Sueldo',        'ingreso', 'banknote'),
    ('Transferencia', 'ingreso', 'arrow-left-right')
  ) AS v(nombre, tipo, icono)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.categorias_gasto c
    WHERE c.household_id IS NULL AND c.nombre = v.nombre
 );
