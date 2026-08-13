# QA en navegador

Los guiones que verificaron cada spec contra **Supabase real y el navegador**, no
contra mocks. Están acá y no en un scratchpad porque son la evidencia de los
`acceptance.md`: sin ellos, "18/18 AC" es una afirmación sin respaldo.

## Correr

```bash
npx supabase start -x edge-runtime,studio,imgproxy,logflare,vector,supavisor,realtime,storage-api,inbucket,pg_meta,mailpit
ng serve --port 4292          # el puerto importa: es el redirect URI autorizado en Google
node qa/qa-guard.mjs
```

Otro puerto: `QA_BASE=http://localhost:4300 node qa/qa-guard.mjs`.

Las capturas van a `qa/capturas/`, que está ignorado.

## Cuáles necesitan una edge function servida

`servir-funcion.sh` levanta UNA función por vez en `:8000`, y los guiones enrutan
hacia ahí porque el gateway local no tiene el edge runtime.

| Guion | Necesita | Qué verifica |
|---|---|---|
| `qa-correo.mjs` | `servir-funcion.sh gmail-oauth` | Paso 3: la URL del consentimiento, el `state` contra CSRF, el error de Google traducido |
| `qa-carpeta.mjs` | — | AC8 y AC9: cambiar la carpeta y desconectar, con los GRANT por columna |
| `qa-listo.mjs` | `servir-funcion.sh procesar-ahora` | Paso 4: la corrida vacía y la que encuentra movimientos |
| `qa-guard.mjs` | — | Los dos guards, en las dos direcciones y con la red caída |
| `qa-plata.mjs`, `qa-corregir.mjs`, `qa-filtros.mjs`, `qa-volumen.mjs` | — | Spec 0005 |
| `qa-cuentas.mjs`, `qa-crear-cuenta.mjs` | — | Spec 0006 |
| `qa-onboarding.mjs` | — | Pasos 1 y 2 |

## Lo que estos guiones simulan, y por qué

Sólo dos cosas: la **respuesta de Google al canje** y, en un caso, la de
`procesar-ahora`. Completar el consentimiento exige entrar a una cuenta de Google
real, y eso no se puede automatizar sin guardar credenciales.

Todo lo demás corre de verdad: PostgREST con el JWT del usuario, RLS, los GRANT
por columna, y la corrida contra la API de Gmail.

**Cuidado con `innerText`:** devuelve el texto **ya transformado** por CSS. Las
clases `.micro-label` son `uppercase`, así que una regex sensible a mayúsculas
sobre ellas no comprueba nada y pasa vacuamente. Ya pasó tres veces.
