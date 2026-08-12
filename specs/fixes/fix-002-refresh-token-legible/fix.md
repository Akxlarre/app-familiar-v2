# Fix: el refresh_token de Gmail se puede leer desde la API
> id: fix-002-refresh-token-legible
> refs: 0001-cadena-de-captura-del-correo-bancario
> status: done
> created: 2026-08-12

## Root Cause

`integraciones_email` hace bien casi todo. Revoca los privilegios de tabla y otorga sólo un
`GRANT SELECT` **por columna** — el mecanismo correcto para que una columna quede fuera del
alcance del cliente. Y la vista `mis_integraciones_email` fue escrita justamente para no exponer
el token: publica `(refresh_token IS NOT NULL) AS conectada` en su lugar.

El problema es que **`refresh_token` está en la lista de columnas otorgadas**:

```sql
GRANT SELECT (id, household_id, profile_id, proveedor, email, carpeta, estado,
              ultima_sync, ultimo_error, created_at, refresh_token)  -- ← acá
  ON public.integraciones_email TO authenticated;
```

Está ahí por un motivo técnico real: la vista es `security_invoker`, así que evalúa
`refresh_token IS NOT NULL` **con los permisos de quien consulta**. Sin ese GRANT, la vista falla.

El efecto es que toda la protección se puede saltar pidiendo la tabla directamente, sin pasar por
la vista. Verificado contra la base local, con un usuario autenticado normal:

```
GET /rest/v1/integraciones_email?select=email,refresh_token
→ [{"email":"benja@casa.cl","refresh_token":"TOKEN-SECRETO-DE-GMAIL-1234"}]
```

Un refresh token de Google no caduca por sí solo: quien lo tenga puede leer el correo del hogar
desde fuera de la app, indefinidamente, hasta que alguien revoque el acceso a mano en la cuenta
de Google.

### Por qué no lo vio nadie

El diseño **parecía** correcto en el diff: hay un REVOKE, hay un GRANT por columna, y hay una
vista que no publica el token. Los tres elementos de la defensa están presentes. Sólo pidiéndole
la columna a la base se ve que la lista los contradice.

## ACs Afectados

- **Spec 0001, RNF-04 (privacidad de las credenciales)** — el token deja de ser legible por el
  cliente. La app nunca lo necesitó: le basta `conectada`.

## Cambio

- **Archivo:** `supabase/migrations/20260812010000_seguridad_ocultar_refresh_token.sql`
- **Qué cambia:** una columna generada `conectada` en la tabla reemplaza el cálculo de la vista.
  Con eso la vista ya no necesita leer `refresh_token`, y la columna sale de la lista del GRANT.
  El token queda accesible sólo para `service_role`, que es quien lo usa en las edge functions.

## Test de Regresión

- `supabase/tests/grants.test.mjs > el refresh_token no es legible por authenticated` ✓
- `supabase/tests/grants.test.mjs > la vista sigue diciendo si el correo está conectado` ✓
