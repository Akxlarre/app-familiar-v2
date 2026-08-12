# Fix: Ninguna tabla otorga privilegios, así que RLS no llega a evaluarse
> id: fix-001-grants-faltantes
> refs: 0001-cadena-de-captura-del-correo-bancario, 0003-navegacion-y-secciones
> status: done
> created: 2026-08-12

## Root Cause

Las migraciones activan RLS y escriben las policies, pero **nunca otorgan privilegios de
tabla**. Son dos mecanismos distintos de Postgres y hacen falta los dos:

- **`GRANT`** decide si el rol puede *tocar* la tabla.
- **RLS** decide *qué filas* ve una vez que puede tocarla.

Sin `GRANT`, Postgres corta antes de mirar la policy. Las policies están bien escritas y no
sirven de nada:

```
capturas     → 42501 permission denied for table capturas
movimientos  → 42501 permission denied for table movimientos
profiles     → 42501 permission denied for table profiles
```

10 de las 11 tablas no tienen ningún `GRANT` para `authenticated`. La única que sí es
`integraciones_email`, porque su autor necesitaba restringir por columna — y ahí se ve que el
proyecto **sí** asume el modelo de grant explícito, no el de privilegios heredados.

### Por qué no lo vio nadie

Ni el linter ni los tests podían: los tests mockean el repositorio y el linter no ejecuta SQL.
Sólo aparece con la base levantada y un usuario real pidiendo una fila. Se descubrió el día que
se levantó Supabase local por primera vez.

### Por qué no se resuelve "confiando en Supabase cloud"

Supabase cloud configura `ALTER DEFAULT PRIVILEGES` para que las tablas nuevas queden accesibles.
Apoyarse en eso tiene dos problemas, y el segundo es grave:

1. **Local y cloud se comportan distinto.** Lo que funciona en producción falla en desarrollo, que
   es exactamente lo que acaba de pasar.
2. **Rompe la restricción por columna de `integraciones_email`.** Un grant amplio por defecto
   incluiría columnas que ese diseño quiere ocultar. (El agujero concreto se corrige en
   `fix-002`; este fix se limita a no ampliarlo.)

## ACs Afectados

- **Spec 0001, REQ-011/012** — la bandeja no puede leer una sola captura.
- **Spec 0003, AC10/AC11** — Hoy no puede leer pendientes ni movimientos. Peor: sin datos, la
  pantalla diría **"no hay nada que hacer"** con trabajo pendiente sin ver.

## Cambio

- **Archivo:** `supabase/migrations/20260812000000_seguridad_grants_por_tabla.sql`
- **Qué cambia:** otorga a `authenticated` exactamente las operaciones que cada policy ya permite
  —ni una más—, y revoca todo para `anon`. `integraciones_email` queda **intacta**: su grant por
  columna ya existe y ampliarlo es el bug de `fix-002`.

## Test de Regresión

- `supabase/tests/grants.test.mjs > cada tabla con policy tiene el GRANT que la policy necesita` ✓
- `supabase/tests/grants.test.mjs > anon no puede leer ninguna tabla del dominio` ✓
