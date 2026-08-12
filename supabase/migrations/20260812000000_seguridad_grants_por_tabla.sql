-- spec:
--   grants_added: [alias_comercio, capturas, categorias_gasto, compras_en_cuotas, cuentas, detalle_credito, households, movimientos, parsers_email, profiles]
--   breaking: false
--   description: "Los GRANT que faltaban: sin ellos Postgres corta antes de evaluar RLS y ninguna tabla se puede leer."
-- /spec

-- =============================================================================
-- PRIVILEGIOS DE TABLA (fix-001)
--
-- RLS y GRANT son dos mecanismos distintos y hacen falta los dos:
--
--   GRANT  → ¿este rol puede TOCAR la tabla?
--   RLS    → ¿qué FILAS ve, una vez que puede tocarla?
--
-- Las migraciones anteriores activaron RLS y escribieron las policies, pero
-- nunca otorgaron privilegios. Postgres corta en el primer paso, así que las
-- policies —correctas— nunca llegaban a evaluarse:
--
--   capturas → 42501 permission denied for table capturas
--
-- No se resuelve dejándoselo a los privilegios por defecto de Supabase cloud.
-- Primero porque local y cloud pasarían a comportarse distinto, que es cómo
-- este bug sobrevivió hasta el día que se levantó la base. Y segundo porque un
-- grant amplio por defecto pisaría la restricción por columna de
-- `integraciones_email`, que es lo único que mantiene los tokens de Gmail fuera
-- del alcance de la app.
--
-- Regla de esta migración: **cada GRANT refleja exactamente lo que su policy ya
-- permite, ni una operación más.** Si mañana una policy se amplía, su GRANT se
-- amplía con ella y no al revés.
--
-- `integraciones_email` NO se toca acá: ya tiene su grant por columna y
-- ampliarlo sería el bug. Su corrección va en fix-002.
-- =============================================================================

-- ─── anon: nada ──────────────────────────────────────────────────────────────
-- No hay una sola pantalla pública. Un rol sin uso al que igual se le otorga es
-- la superficie de ataque que nadie revisa porque nadie recuerda que existe.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- ─── Privilegios que nadie pidió ─────────────────────────────────────────────
-- Los privilegios por defecto de Supabase incluyen TRUNCATE, REFERENCES y
-- TRIGGER para `authenticated`. **TRUNCATE no evalúa RLS**: vacía la tabla
-- entera, hogar ajeno incluido.
--
-- Hoy no hay cómo dispararlo desde el cliente —PostgREST no expone TRUNCATE y
-- el navegador nunca ve una contraseña del rol—, así que esto es defensa en
-- profundidad y no el cierre de un agujero abierto. Pero es un privilegio que
-- ninguna policy respalda, y la próxima función `SECURITY DEFINER` mal escrita
-- sí tendría por dónde.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ─── Lectura y escritura completa (policy FOR ALL) ───────────────────────────
-- alias_comercio · categorias_gasto · compras_en_cuotas · cuentas ·
-- detalle_credito · movimientos · parsers_email
--
-- Sus policies son FOR ALL acotadas por `belongs_to_household()`: el miembro
-- del hogar administra estas tablas enteras, pero sólo las filas de su hogar.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alias_comercio    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_gasto  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_en_cuotas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detalle_credito   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimientos       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parsers_email     TO authenticated;

-- ─── Sólo lectura y actualización (policies SELECT + UPDATE) ─────────────────
-- capturas: se leen en la bandeja y se resuelven. **Sin INSERT**: las capturas
-- las crea la edge function con service role, que salta RLS. Que un cliente
-- pueda insertar capturas sería dejarle inventar movimientos.
-- **Sin DELETE**: RN-09 — una captura nunca se pierde; se descarta cambiando
-- su estado, y eso es un UPDATE.
GRANT SELECT, UPDATE ON public.capturas TO authenticated;

-- households: se lee y se edita el nombre. **Sin INSERT ni DELETE**: crear un
-- hogar pasa por el alta (spec 0004) y borrarlo se llevaría por delante todo lo
-- capturado, en cascada, desde un cliente.
GRANT SELECT, UPDATE ON public.households TO authenticated;

-- profiles: cada quien lee los perfiles de su hogar y edita el suyo. El INSERT
-- lo hace el trigger de alta con service role.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- ─── Vistas ──────────────────────────────────────────────────────────────────
-- `mis_integraciones_email` se creó sin GRANT, así que **nadie podía leerla**.
-- Es la que la app usa para saber si el correo está conectado: la pantalla de
-- la spec 0004 habría fallado con 42501 el día que se escribiera.
--
-- Es `security_invoker`, así que la fila la sigue filtrando el permiso de quien
-- consulta sobre la tabla de abajo. Este GRANT no salta nada.
GRANT SELECT ON public.mis_integraciones_email TO authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.mis_integraciones_email FROM authenticated;

-- ─── Secuencias ──────────────────────────────────────────────────────────────
-- Todas las PK son UUID con `gen_random_uuid()`, así que hoy no hay secuencias
-- que otorgar. Se deja dicho para que quien agregue una columna `serial` sepa
-- que su INSERT va a fallar con "permission denied for sequence" hasta que la
-- otorgue acá.
