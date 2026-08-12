-- spec:
--   columns_added: [conectada]
--   breaking: false
--   description: "El refresh_token de Gmail deja de ser legible por el cliente: una columna generada reemplaza el cálculo que obligaba a otorgarlo."
-- /spec

-- =============================================================================
-- OCULTAR EL REFRESH TOKEN DE GMAIL (fix-002)
--
-- `integraciones_email` ya hacía casi todo bien: revocaba los privilegios de
-- tabla y otorgaba un SELECT **por columna**, que es el mecanismo correcto para
-- dejar una columna fuera del alcance del cliente. Y la vista
-- `mis_integraciones_email` fue escrita para no publicar el token, exponiendo
-- `(refresh_token IS NOT NULL) AS conectada` en su lugar.
--
-- Pero `refresh_token` estaba EN la lista de columnas otorgadas, así que toda
-- esa defensa se saltaba pidiendo la tabla directamente:
--
--   GET /rest/v1/integraciones_email?select=refresh_token
--   → [{"refresh_token":"TOKEN-SECRETO-DE-GMAIL-1234"}]
--
-- Estaba ahí por un motivo real: la vista es `security_invoker`, así que evalúa
-- la expresión con los permisos de quien consulta. Sin el GRANT, la vista falla.
--
-- La salida es mover el cálculo a la tabla. Una columna generada la mantiene
-- Postgres, no la app, así que no puede quedar desincronizada del token — y la
-- vista pasa a leer una columna que sí se puede otorgar.
--
-- Un refresh token de Google no caduca solo: quien lo tenga lee el correo del
-- hogar desde fuera de la app, indefinidamente, hasta que alguien revoque el
-- acceso a mano en la cuenta de Google.
-- =============================================================================

-- `STORED` y no una expresión en la vista: así el valor lo calcula la base en
-- cada escritura y ningún camino de lectura necesita ver el token.
ALTER TABLE public.integraciones_email
  ADD COLUMN IF NOT EXISTS conectada BOOLEAN
  GENERATED ALWAYS AS (refresh_token IS NOT NULL) STORED;

COMMENT ON COLUMN public.integraciones_email.conectada IS
  'Si la integración tiene refresh token. Existe para que el cliente sepa si el correo está conectado SIN poder leer el token (fix-002).';

COMMENT ON COLUMN public.integraciones_email.refresh_token IS
  'Credencial de larga vida de Google. Sólo service_role. Nunca se otorga a authenticated: ver fix-002.';

-- La vista deja de calcular sobre `refresh_token` y lee la columna generada.
DROP VIEW IF EXISTS public.mis_integraciones_email;
CREATE VIEW public.mis_integraciones_email
WITH (security_invoker = true) AS
  SELECT id, household_id, profile_id, proveedor, email, carpeta, estado,
         ultima_sync, ultimo_error, created_at, conectada
    FROM public.integraciones_email
   WHERE profile_id = auth.uid();

-- ─── Privilegios ─────────────────────────────────────────────────────────────
-- Se rehacen enteros en vez de un REVOKE puntual: los grants por columna se
-- acumulan, y quitar sólo `refresh_token` dejaría el resto dependiendo de que
-- la migración anterior siga diciendo lo mismo. Acá se declara la lista final.
REVOKE ALL ON public.integraciones_email FROM authenticated;

-- Sin `refresh_token`, sin `access_token`, sin `expira_en`: las tres son
-- credenciales o metadatos de credencial, y la app no necesita ninguna.
GRANT SELECT (id, household_id, profile_id, proveedor, email, carpeta, estado,
              ultima_sync, ultimo_error, created_at, conectada)
  ON public.integraciones_email TO authenticated;

-- Desconectar el correo es borrar la integración. Es la única escritura que el
-- cliente necesita: conectarla la hace la edge function con service role.
GRANT DELETE ON public.integraciones_email TO authenticated;

GRANT SELECT ON public.mis_integraciones_email TO authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.mis_integraciones_email FROM authenticated;
