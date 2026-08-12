-- spec:
--   tables_added: [plantillas_parser]
--   columns_added: [banco, tipo, remitente_patron, asunto_patron, regex_monto, regex_comercio, regex_fecha, regex_cuota, regex_tarjeta]
--   breaking: false
--   description: "Catálogo global de bancos: elegir el tuyo copia sus patrones al hogar sin escribir un regex."
-- /spec

-- =============================================================================
-- CATÁLOGO DE BANCOS (spec 0004, AC14)
--
-- `parsers_email.household_id` es NOT NULL, así que no puede alojar plantillas
-- sin dueño. Esta tabla es el catálogo: elegir "BancoEstado" en el onboarding
-- COPIA sus filas al hogar del usuario.
--
-- Es una tabla y no una semilla de migración a propósito. RB-01 dice que los
-- formatos de correo cambian solos y sin avisar: corregir un regex no puede
-- exigir un despliegue. Acá se corrige con un UPDATE.
--
-- ⚠ **Los patrones de abajo son un punto de partida, no una verdad
-- verificada.** Se escribieron a partir de los remitentes conocidos de cada
-- banco, sin un correo real delante. El primero que conecte su casilla va a
-- encontrar los que no calzan, y ese es exactamente el flujo previsto: la
-- captura queda en la bandeja con su motivo, se corrige el patrón acá y
-- `reprocesar-capturas` la vuelve a interpretar. Ninguno se da por bueno hasta
-- que produzca un movimiento correcto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plantillas_parser (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  activa             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un banco puede tener varias plantillas (cargo, cuota, abono), pero no dos
-- iguales: sin esto, correr la migración dos veces duplica el catálogo y el
-- hogar termina con parsers repetidos que interpretan el mismo correo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_parser_banco_tipo
  ON public.plantillas_parser(banco, tipo);

COMMENT ON TABLE public.plantillas_parser IS
  'Catálogo global de bancos. Sin household_id: no es de nadie. Elegir un banco copia sus filas a parsers_email (spec 0004, AC14).';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.plantillas_parser ENABLE ROW LEVEL SECURITY;

-- Es un catálogo, no datos de nadie: cualquiera con sesión lo lee entero. No
-- hay policy de escritura, así que `authenticated` no puede tocarlo ni con el
-- GRANT puesto — corregir un patrón es mantenimiento, no algo que un usuario
-- haga desde la app.
DROP POLICY IF EXISTS plantillas_parser_select ON public.plantillas_parser;
CREATE POLICY plantillas_parser_select ON public.plantillas_parser
  FOR SELECT TO authenticated
  USING (activa);

GRANT SELECT ON public.plantillas_parser TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantillas_parser TO service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.plantillas_parser FROM authenticated;

-- ─── Catálogo inicial ────────────────────────────────────────────────────────
-- `ON CONFLICT DO NOTHING`: si alguien ya corrigió un patrón en la base, correr
-- la migración de nuevo no puede pisarle el arreglo.

INSERT INTO public.plantillas_parser
  (banco, tipo, remitente_patron, asunto_patron, regex_monto, regex_comercio, regex_cuota, regex_tarjeta)
VALUES
  ('BancoEstado', 'cargo', 'bancoestado.cl', 'Compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+el\s+\d', NULL, '\*{4}\s?(\d{4})'),

  ('Banco de Chile', 'cargo', 'bancochile.cl', 'Compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+por', NULL, 'final\s+(\d{4})'),

  ('Banco de Chile', 'cuota', 'bancochile.cl', 'cuotas',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+por', '(\d+)\s*de\s*(\d+)', 'final\s+(\d{4})'),

  ('Santander', 'cargo', 'santander.cl', 'Compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+el', NULL, '\*{4}(\d{4})'),

  ('BCI', 'cargo', 'bci.cl', 'Compra',
   '\$\s?([\d.]+)', 'Comercio:\s*(.+)', NULL, '\*{4}(\d{4})'),

  ('Scotiabank', 'cargo', 'scotiabank.cl', 'Compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+por', NULL, '\*{4}(\d{4})'),

  ('Itaú', 'cargo', 'itau.cl', 'Compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+el', NULL, '\*{4}(\d{4})'),

  ('Banco Falabella', 'cargo', 'bancofalabella.cl', 'Compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)\s+por', NULL, '\*{4}(\d{4})'),

  ('Tenpo', 'cargo', 'tenpo.cl', NULL,
   '\$\s?([\d.]+)', 'en\s+(.+?)$', NULL, NULL),

  ('Mercado Pago', 'cargo', 'mercadopago', 'compra',
   '\$\s?([\d.]+)', 'en\s+(.+?)$', NULL, NULL)
ON CONFLICT (banco, tipo) DO NOTHING;
