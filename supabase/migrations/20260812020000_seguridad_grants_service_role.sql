-- spec:
--   grants_added: [service_role sobre las 11 tablas del dominio]
--   breaking: false
--   description: "service_role no podía tocar ninguna tabla: la cadena de captura entera fallaba antes de empezar."
-- /spec

-- =============================================================================
-- PRIVILEGIOS DE service_role (fix-003)
--
-- `fix-001` otorgó privilegios a `authenticated` y dejó `service_role` sin
-- nada. Misma causa raíz —las migraciones nunca otorgaban— y la mitad que
-- faltaba, porque los dos roles hacen trabajos distintos:
--
--   authenticated → lo que hace el usuario en la app, filtrado por RLS
--   service_role  → lo que pasa SOLO: leer el correo, crear capturas, renovar
--                   el token de Gmail. Salta RLS a propósito, porque no actúa
--                   en nombre de nadie
--
-- Sin esto la tesis del producto no arranca: `process-bank-emails` no puede
-- leer el refresh token para hablar con Gmail, ni escribir las capturas que
-- produce. La cadena falla en el primer paso y en silencio, porque nadie está
-- mirando cuando corre.
--
-- `service_role` es la llave maestra y nunca llega al navegador: vive en los
-- secretos de las edge functions. Por eso acá el criterio no es "lo mínimo por
-- tabla" —como en fix-001— sino "las tablas del dominio, todas las
-- operaciones": acotar por tabla daría una falsa sensación de contención
-- mientras el rol siga pudiendo saltarse RLS, y obligaría a tocar esta
-- migración cada vez que una función automatice un paso más.
--
-- Lo que sí importa es que el rol siga siendo **inalcanzable desde el cliente**.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- La tabla de credenciales quedó con los privilegios rehechos en fix-002, que
-- sólo declaró los de `authenticated`. Se otorga explícitamente para que no
-- dependa del orden de las migraciones: es la que guarda el refresh token, y es
-- justo la que las edge functions necesitan leer.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integraciones_email TO service_role;

-- Las tablas que se creen después heredan lo mismo, para que agregar una no
-- vuelva a romper la cadena en silencio.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- `anon` y `authenticated` NO entran en el default: lo suyo se declara tabla
-- por tabla y a propósito (fix-001). Una tabla nueva nace inaccesible para la
-- app hasta que alguien decida qué puede hacer con ella, y eso es deliberado.
