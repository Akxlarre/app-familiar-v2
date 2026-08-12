# Fix: service_role no podía tocar ninguna tabla
> id: fix-003-service-role-sin-privilegios
> refs: 0001-cadena-de-captura-del-correo-bancario, fix-001-grants-faltantes
> status: done
> created: 2026-08-12

## Root Cause

Misma causa raíz que `fix-001` —las migraciones nunca otorgaban privilegios— y **la mitad que
fix-001 dejó sin arreglar**. Otorgó todo a `authenticated` y a `service_role` no le dio nada:

```
alias_comercio | false | false      capturas    | false | false
movimientos    | false | false      profiles    | false | false
        (SELECT e INSERT para service_role, en las 11 tablas)
```

Los dos roles hacen trabajos distintos y hacían falta los dos:

| Rol | Qué hace | RLS |
|---|---|---|
| `authenticated` | Lo que el usuario hace en la app | Lo filtra |
| `service_role` | Lo que pasa solo: leer el correo, crear capturas, renovar el token | Lo salta, a propósito |

Sin esto **la tesis del producto no arranca**: `process-bank-emails` no puede leer el refresh
token para hablar con Gmail ni escribir las capturas que produce. Y falla **en silencio**, porque
la cadena corre sin nadie mirando — el síntoma habría sido una bandeja que nunca se llena, no un
error.

### Por qué fix-001 no lo cubrió

Se diagnosticó desde el síntoma visible: la app devolvía 42501 y la app usa `authenticated`. El
rol que trabaja de noche no tenía a nadie que se quejara por él.

## ACs Afectados

- **Spec 0001, REQ-010/011/012** — la cadena completa: leer el correo, crear la captura,
  convertirla en movimiento.

## Cambio

- **Archivo:** `supabase/migrations/20260812020000_seguridad_grants_service_role.sql`
- **Qué cambia:** otorga las cuatro operaciones sobre las tablas del dominio a `service_role`, y
  fija un `ALTER DEFAULT PRIVILEGES` para que una tabla nueva no vuelva a romper la cadena en
  silencio.

### Por qué acá el criterio no es "lo mínimo"

En `fix-001` cada GRANT refleja exactamente lo que su policy permite. Acá no, y es deliberado:
`service_role` ya puede saltarse RLS por definición, así que acotarlo tabla por tabla daría una
sensación de contención que no existe, y obligaría a volver sobre esta migración cada vez que una
función automatice un paso más. Lo que sí importa de este rol es que **no llegue nunca al
navegador**: vive en los secretos de las edge functions.

El `ALTER DEFAULT PRIVILEGES` es **sólo** para `service_role`. `anon` y `authenticated` siguen
declarándose tabla por tabla: una tabla nueva nace inaccesible para la app hasta que alguien
decida qué se puede hacer con ella.

## Test de Regresión

- `supabase/tests/grants.test.mjs > service_role puede operar sobre todo el dominio` ✓
  — verificado **en rojo** revocando su INSERT sobre `capturas`:
  `Tablas que service_role no puede operar: capturas`
- `supabase/tests/grants.test.mjs > service_role sí lee el refresh token: es quien habla con Gmail` ✓
  — el contrapeso de `fix-002`: ocultarle el token a la app no puede ocultárselo a quien debe usarlo

Los 9 casos de `grants.test.mjs` en verde.
