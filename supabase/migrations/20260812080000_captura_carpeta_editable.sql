-- spec:
--   policies_added: [integraciones_email_update]
--   breaking: false
--   description: "El usuario puede cambiar qué carpeta se vigila, sin ganar acceso a ninguna credencial."
-- /spec

-- =============================================================================
-- ELEGIR LA CARPETA A VIGILAR (spec 0004, AC8)
--
-- `integraciones_email` quedó con SELECT por columna y DELETE, y nada más: la
-- escritura la hacía siempre la edge function con service role. AC8 pide que el
-- usuario cambie `carpeta`, y hoy no puede — no por una policy que lo prohíba,
-- sino porque no existe el privilegio. Postgres corta antes de mirar RLS.
--
-- El GRANT es **por columna** por la misma razón que el SELECT: un
-- `GRANT UPDATE` a secas dejaría al cliente escribir `refresh_token`, y
-- entonces daría igual habérselo ocultado para leer. Con la lista explícita,
-- `carpeta` es lo único que puede tocar.
--
-- La policy necesita `USING` **y** `WITH CHECK`: sin `WITH CHECK` se podría
-- mover la integración a otro `profile_id` en el mismo UPDATE — es decir,
-- regalarle la casilla a otra cuenta. Los dos lados son el mismo predicado a
-- propósito.
-- =============================================================================

DROP POLICY IF EXISTS integraciones_email_update ON public.integraciones_email;
CREATE POLICY integraciones_email_update ON public.integraciones_email
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

GRANT UPDATE (carpeta) ON public.integraciones_email TO authenticated;

COMMENT ON COLUMN public.integraciones_email.carpeta IS
  'Etiqueta de Gmail que se vigila. INBOX por defecto; los correos del banco suelen caer ahí o en CATEGORY_UPDATES. Es la única columna que el cliente puede escribir (spec 0004, AC8).';
