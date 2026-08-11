-- spec:
--   tables_added: [integraciones_email, parsers_email, capturas]
--   columns_added: [origen, origen_ref, payload, interpretado, estado, motivo, intentos, ultimo_error]
--   views_added: [mis_integraciones_email]
--   breaking: false
--   description: "El espinazo: todo lo que produce datos sin tipeo, con una sola bandeja de revisión."
-- /spec

-- =============================================================================
-- CAPTURA — el espinazo del producto
--
-- Todo lo que produce datos sin que nadie los escriba. En v1 esto vivía DENTRO
-- del módulo financiero, así que ningún otro contexto podía usarlo aunque lo
-- necesitara (el escáner de boletas alimentaba la despensa por su cuenta, con su
-- propia cola de revisión).
--
-- `capturas` es UNA sola bandeja: v1 tenía dos haciendo lo mismo
-- (`email_transactions_log.pending_review` y `receipts.status`).
-- =============================================================================

-- ─── integraciones_email (REQ-010) ───────────────────────────────────────────
-- Los tokens NUNCA llegan al cliente (RNF-05): esta tabla no se expone por
-- PostgREST — no lleva policy de SELECT para `authenticated`, sólo la lee la
-- edge function con el service role.
CREATE TABLE IF NOT EXISTS public.integraciones_email (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proveedor      TEXT NOT NULL DEFAULT 'gmail' CHECK (proveedor IN ('gmail')),
  email          TEXT NOT NULL,
  access_token   TEXT,
  refresh_token  TEXT,
  expira_en      TIMESTAMPTZ,
  carpeta        TEXT NOT NULL DEFAULT 'INBOX',
  estado         TEXT NOT NULL DEFAULT 'activa'
                 CHECK (estado IN ('activa', 'expirada', 'revocada')),
  ultima_sync    TIMESTAMPTZ,
  -- Por qué falló la última sincronización. Una integración que se rompe sin
  -- decir por qué obliga a mirar logs del servidor para algo que el usuario
  -- puede resolver solo (reconectar la cuenta).
  ultimo_error   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, email)
);

CREATE INDEX IF NOT EXISTS idx_integraciones_email_household
  ON public.integraciones_email(household_id);

-- ─── parsers_email (REQ-011) ─────────────────────────────────────────────────
-- Los formatos de correo bancario chilenos son específicos y frágiles (RB-01):
-- se guardan como configuración, no como código, para poder corregirlos sin
-- desplegar.
CREATE TABLE IF NOT EXISTS public.parsers_email (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  banco              TEXT NOT NULL,
  tipo               TEXT NOT NULL
                     CHECK (tipo IN ('cargo', 'abono', 'cuota', 'pago_recibido')),
  remitente_patron   TEXT NOT NULL,
  asunto_patron      TEXT,
  regex_monto        TEXT NOT NULL,
  regex_comercio     TEXT,
  regex_fecha        TEXT,
  regex_cuota        TEXT,
  regex_tarjeta      TEXT,
  cuenta_id          UUID,   -- FK diferida: `cuentas` nace en la migración de Dinero
  activo             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parsers_email_household
  ON public.parsers_email(household_id) WHERE activo;

-- ─── capturas (REQ-012) — la bandeja única ───────────────────────────────────
-- RN-09: una captura queda acá hasta que se confirma o se descarta. Nunca se
-- pierde y nunca se descarta sola.
CREATE TABLE IF NOT EXISTS public.capturas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  origen         TEXT NOT NULL CHECK (origen IN ('email', 'boleta')),

  -- Identificador estable en el sistema de origen (el id del mensaje de Gmail,
  -- el path de la imagen). Es lo que hace idempotente el reproceso: un mismo
  -- correo no puede generar dos movimientos aunque se procese dos veces.
  origen_ref     TEXT NOT NULL,

  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- el dato crudo, sin interpretar
  interpretado   JSONB,                                 -- lo que el parser entendió

  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'procesada', 'requiere_revision', 'descartada')),
  motivo         TEXT,                                  -- por qué requiere revisión o falló
  intentos       INT NOT NULL DEFAULT 0,

  parser_id      UUID REFERENCES public.parsers_email(id) ON DELETE SET NULL,
  fecha_origen   TIMESTAMPTZ,                           -- fecha del correo/boleta, no de la captura
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (household_id, origen, origen_ref)
);

CREATE INDEX IF NOT EXISTS idx_capturas_bandeja
  ON public.capturas(household_id, estado, fecha_origen DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.integraciones_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsers_email       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capturas            ENABLE ROW LEVEL SECURITY;

-- integraciones_email: el usuario ve QUE existe y puede borrarla, pero los
-- tokens no viajan al cliente. La vista `mis_integraciones_email` expone sólo
-- las columnas seguras; la tabla queda sin SELECT para `authenticated`.
DROP POLICY IF EXISTS integraciones_email_delete ON public.integraciones_email;
CREATE POLICY integraciones_email_delete ON public.integraciones_email
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

CREATE OR REPLACE VIEW public.mis_integraciones_email
WITH (security_invoker = true) AS
  SELECT id, household_id, profile_id, proveedor, email, carpeta, estado,
         ultima_sync, ultimo_error, created_at,
         (refresh_token IS NOT NULL) AS conectada
    FROM public.integraciones_email
   WHERE profile_id = auth.uid();

-- La vista es security_invoker, así que necesita que la tabla deje pasar el
-- SELECT del dueño. Se restringe por columna vía GRANT, no por policy.
DROP POLICY IF EXISTS integraciones_email_select ON public.integraciones_email;
CREATE POLICY integraciones_email_select ON public.integraciones_email
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

REVOKE ALL ON public.integraciones_email FROM authenticated;
GRANT SELECT (id, household_id, profile_id, proveedor, email, carpeta, estado,
              ultima_sync, ultimo_error, created_at, refresh_token)
  ON public.integraciones_email TO authenticated;
GRANT DELETE ON public.integraciones_email TO authenticated;

-- parsers_email: configuración del hogar, editable por sus miembros.
DROP POLICY IF EXISTS parsers_email_all ON public.parsers_email;
CREATE POLICY parsers_email_all ON public.parsers_email
  FOR ALL TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));

-- capturas: se leen y se resuelven desde la bandeja. El INSERT lo hace la edge
-- function con service role, que salta RLS.
DROP POLICY IF EXISTS capturas_select ON public.capturas;
CREATE POLICY capturas_select ON public.capturas
  FOR SELECT TO authenticated
  USING (public.belongs_to_household(household_id));

DROP POLICY IF EXISTS capturas_update ON public.capturas;
CREATE POLICY capturas_update ON public.capturas
  FOR UPDATE TO authenticated
  USING (public.belongs_to_household(household_id))
  WITH CHECK (public.belongs_to_household(household_id));
