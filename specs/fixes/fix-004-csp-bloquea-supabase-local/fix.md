# Fix: la CSP bloqueaba hablar con Supabase local
> id: fix-004-csp-bloquea-supabase-local
> refs: 0001-cadena-de-captura-del-correo-bancario
> status: done
> created: 2026-08-12

## Root Cause

El `index.html` declara una Content Security Policy cuyo `connect-src` sólo permitía
`'self'` y `https://*.supabase.co`. El `environment.ts` de desarrollo apunta a
`http://127.0.0.1:54321`, que es donde vive `npx supabase start`.

Las dos cosas se contradicen desde el primer commit: **el proyecto nace apuntando a un origen que
su propia CSP prohíbe.** El navegador corta el login antes de que salga el request:

```
Refused to connect to 'http://127.0.0.1:54321/auth/v1/token' because it violates
the following Content Security Policy directive: "connect-src ..."
```

### Por qué no lo vio nadie

Nadie había levantado la base todavía. Sin backend al que conectarse, la app nunca intentó salir
a ese origen — y una CSP sólo se queja cuando algo la cruza. El error, además, no menciona
Supabase por ningún lado: habla de una directiva.

Viene del boilerplate de Koa, así que **todo proyecto generado tenía la misma contradicción**.

## ACs Afectados

- Ninguno en particular: bloquea *todos* los que necesiten datos. La app no podía autenticarse.

## Cambio

- **Archivos:** `src/index.html` (v2) y `lib/scaffolder.js` (Koa, que es quien inyecta la CSP)
- **Qué cambia:** `connect-src` incluye `http://localhost:54321`, `http://127.0.0.1:54321` y sus
  equivalentes `ws://` para Realtime.

En producción no abren nada: sólo permiten que la propia página hable con un puerto del equipo de
quien la abre. Se prefirió eso a mantener dos `index.html` —uno de dev y otro de prod—, que es
duplicación que se desincroniza en cuanto alguien toca uno solo.

## Test de Regresión

No hay test unitario: una CSP sólo se puede verificar en un navegador de verdad. Queda cubierto
por la QA de `qa-real.mjs`, que hace login real y falla si la consola reporta violaciones.

Antes: `Refused to connect … violates the following CSP directive`.
Después: login completo y `/app/hoy` cargando.
