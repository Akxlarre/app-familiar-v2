# ADR-0001 · La migración `hogar` reemplaza las semillas de auth del blueprint

- **Fecha**: 2026-08-11
- **Estado**: aceptada

## Contexto

Koa entrega dos migraciones semilla en todo proyecto generado:
`20240101000000_auth_create_profiles.sql` y `20240101000001_auth_rls_role_protection.sql`.
Crean `public.profiles`, el trigger `on_auth_user_created` y cuatro policies con un
modelo de roles `admin`/`member`.

Este proyecto ya tiene `20260811100000_hogar_create_households_profiles.sql`, que
crea `profiles` junto con `households`, los predicados de RLS y los RPC de crear
hogar y unirse por código.

## Decisión

**Las dos semillas se excluyen.** `hogar` es la capa de auth de este proyecto.

## Por qué

Convivir no era una opción, y no por gusto sino por tres choques concretos:

1. **`profiles_select_public` rompe el aislamiento.** Su condición es
   `auth.role() = 'authenticated'`, o sea que cualquier usuario logueado lee
   *todos* los perfiles de *todos* los hogares. Contradice RN-01 de forma directa,
   y la prueba «Ana ve a Beto pero no a Caro» falla con esa policy activa.

2. **Los timestamps ganan al contenido.** `2024… < 2026…`, así que las semillas
   corren primero y crean `profiles` con su forma. Como `hogar` usa
   `CREATE TABLE IF NOT EXISTS`, salta la creación y hereda una tabla sin
   `updated_at` — columna que los RPC `create_household` y `join_household_by_code`
   escriben. Fallarían en runtime, no al migrar.

3. **Dos `handle_new_user()` y dos triggers homónimos.** El último en aplicarse
   gana, en silencio.

## Qué se pierde

El modelo de roles `admin`/`member` con protección contra auto-elevación. No hace
falta acá: la visión dice que la pareja comparte la gestión **50/50** y que no hay
administrador ni usuario pasivo. Un rol que no existe en el producto no necesita
protegerse.

## Consecuencias

- El proyecto no usa `profiles.role` ni `profiles.role_id`.
- Si en el futuro hicieran falta roles, se agregan en una migración propia con el
  modelo que el dominio pida — no reintroduciendo las semillas.
- Al re-correr el CLI, las semillas se copian de nuevo a `supabase/migrations/`
  porque ahí el CLI sólo agrega lo que falta. Hay que volver a borrarlas, o
  mantenerlas fuera con un `.gitignore` específico si llegara a molestar.

## Nota al margen

Las semillas venían con un error que impedía aplicarlas: usaban
`CREATE POLICY IF NOT EXISTS`, que PostgreSQL no soporta. Se corrigió en el
blueprint (Koa) junto con un test que lo previene. Esta decisión es independiente
de ese arreglo: aun funcionando, chocarían con `hogar`.
