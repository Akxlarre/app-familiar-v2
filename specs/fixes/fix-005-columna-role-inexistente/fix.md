# Fix: el repositorio pedía una columna que el producto descartó
> id: fix-005-columna-role-inexistente
> refs: 0003-navegacion-y-secciones
> status: done
> created: 2026-08-12

## Root Cause

`ProfilesRepository.findById()` pedía `display_name, avatar_url, role`. La tabla `profiles` de
este proyecto **no tiene `role`**:

```
id, household_id, display_name, avatar_url, created_at, updated_at
```

PostgREST responde 400 a la consulta entera cuando una columna no existe, así que **cada carga de
perfil fallaba**. El nombre y el avatar del usuario nunca llegaban.

`role` viene del boilerplate de Koa, que trae `roleGuard` y un modelo con roles. Las migraciones
de app-familiar no lo replicaron, y con razón: REQ-001 dice dos personas con los mismos permisos,
y el ROADMAP archiva "rol de administrador dentro del hogar" de forma explícita. **El repositorio
seguía pidiendo una columna de un modelo que el producto rechazó a propósito.**

### Por qué no lo vio nadie

El spec del repositorio afirmaba `toHaveBeenCalledWith('display_name, avatar_url, role')`. El
mock devuelve lo que se le pida, así que el test pasaba verificando exactamente el bug — el
tercero de esta clase en la sesión, después del breadcrumb y del menú.

## ACs Afectados

- **Spec 0003** — la topbar y el sidebar muestran el usuario. Sin perfil caían al correo.

## Cambio

- **Archivos:** `profiles.repository.ts`, `auth.facade.ts` y el spec del repositorio
- **Qué cambia:** `role` sale del `select` y de `ProfileRow`. `AuthFacade` fija `role: 'member'`,
  que es lo único que este producto tiene.

## Pendiente declarado, no arreglado

`role.guard.ts`, `UserRole` y la línea del sidebar que muestra el rol siguen en pie. Son código
del boilerplate sin uso en este producto, no un bug: sacarlos es una limpieza con criterio
propio, y mezclarla acá haría que este fix dejara de ser una causa raíz y un cambio puntual.

## Test de Regresión

- `profiles.repository.spec.ts > no pide columnas que la tabla no tiene` ✓
- QA en navegador: la consola ya no reporta el 400 sobre `/rest/v1/profiles`
