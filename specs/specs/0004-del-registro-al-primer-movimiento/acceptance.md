# Acceptance 0004 — Del registro al primer movimiento

> **Spec:** [spec.md](./spec.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verificado:** 2026-08-12
> **Método:** 516 tests + 40 tests de edge functions + 12 de privilegios + QA en navegador contra
> Supabase real y contra el endpoint real de Google.

---

## Qué se pudo verificar y qué no

Esta spec depende de un tercero. La línea es nítida y conviene dejarla escrita:

| | |
|---|---|
| **Se verificó de verdad** | Que Google acepta el par client_id + client_secret (pasa de `invalid_client` a `invalid_grant`). Que el redirect URI autorizado es `:4292` — los demás dan `redirect_uri_mismatch`. Que la URL del consentimiento lleva los seis parámetros. Que el `state` sobrevive al ida y vuelta por `accounts.google.com`. Que `procesar-ahora` corre, filtra por hogar y marca la integración. Que el UPDATE de la carpeta llega a Postgres y que leer o escribir el `refresh_token` se rechaza. |
| **No se pudo** | Completar el consentimiento. Exige entrar a una cuenta de Google real, y ni yo puedo hacerlo ni este contenedor es alcanzable desde el navegador del usuario. |

Lo que quedó **simulado** en el QA está acotado a dos cosas: la respuesta de `gmail-oauth` y, en
un caso, la de `procesar-ahora`. Todo lo demás —PostgREST con el JWT del usuario, RLS, los GRANT
por columna, la corrida contra Gmail— corrió de verdad.

---

## Los AC

| AC | Qué exige | Estado | Evidencia |
|---|---|---|---|
| **AC1** | Sin hogar, no se llega a ninguna otra pantalla | ✅ | `/app/hoy`, `/app/plata` y `/app/bandeja` mandan al onboarding, y no queda navegación |
| **AC2** | Crear hogar muestra el `invite_code` copiable | ✅ | Código de 6 caracteres + botón. **Requirió el paso retenido**: ver hallazgos |
| **AC3** | Unirse con código válido | ✅ | RPC `join_household_by_code` |
| **AC4** | Código inválido se explica sin filtrar si existe | ✅ | Mensaje del RPC como token; el texto de Postgres nunca pasa |
| **AC5** | Consentimiento con `access_type=offline` y `prompt=consent` | ✅ | Los seis parámetros medidos en la URL real |
| **AC6** | El refresh token se guarda en el servidor y el cliente no lo ve | ✅ | GRANT por columna. Leerlo da **403 (42501)**; ninguna respuesta que la app pide lo trae |
| **AC7** | Sin refresh token no se guarda la integración | ✅ | La edge function lo rechaza; el mensaje llega traducido |
| **AC8** | Elegir la carpeta a vigilar | ✅ | Lista cerrada de etiquetas de sistema. El cambio **llega a Postgres**: `carpeta = CATEGORY_UPDATES` |
| **AC9** | Desconectar borra los dos tokens | ✅ | Se borra la fila. **Sin puerta de entrada permanente**: ver abajo |
| **AC10** | Primera corrida sin esperar al cron | ✅ | `procesar-ahora` se dispara sola al llegar al paso 4 — una vez, no una por montaje |
| **AC11** | Mostrar lo encontrado con nombre y monto | ✅ | `JUMBO MAIPU −$18.700`, leído de la base y no del conteo. Y avisa de las capturas pendientes |
| **AC12** | Una corrida vacía dice qué se buscó y qué hacer | ✅ | Carpeta, días y **los bancos del hogar** — no los del catálogo: ver hallazgos |
| **AC13** | Captura sin cuenta cae en la bandeja con motivo | ✅ | `motivoDeFaltante` (spec 0001) |
| **AC14** | Elegir banco de una lista, sin escribir un regex | ✅ | Catálogo de 10 bancos chilenos; las plantillas se copian |
| **AC-E1** | Retomar donde se quedó | ✅ | El paso se **deriva** del estado real: retomar no es una funcionalidad, es lo que pasa por no guardar progreso |
| **AC-E2** | Ya configurado, `/onboarding` manda a Hoy | ✅ | Medido con los guards cableados |
| **AC-E3** | Dos hogares simultáneos, códigos distintos | ✅ | El código lo genera la base con reintento |
| **AC-E4** | Cancelar el consentimiento se explica y se reintenta | ✅ | `access_denied` tiene copy propio; el hogar sigue creado |

**18 de 18.**

---

## Lo que la verificación encontró

| # | Defecto | Cómo apareció |
|---|---|---|
| 1 | **El `invite_code` no se veía nunca.** El paso derivado avanza en cuanto la base cambia | Navegador. Los tests verificaban el paso, no lo que se ve |
| 2 | Lo mismo en el paso 3: la casilla conectada desaparecía antes de poder elegir la carpeta | Al construir AC8 |
| 3 | **`npx tsc --noEmit -p tsconfig.json` no comprueba nada.** El tsconfig raíz es solution-style: compila cero archivos y sale 0 | Un error de sintaxis que tsc no vio y el dev server sí |
| 4 | **`npm run test:functions` nunca funcionó.** `node --test` no puede con imports por URL de Deno | Al correr la suite completa antes de cerrar |
| 5 | **Un token revocado por Google se reintentaba para siempre.** El status HTTP se perdía al construir el error, así que un 401 era indistinguible de Gmail caído | El QA del caso vacío: la integración quedaba `activa` con un error anotado que nadie mira |
| 6 | **El caso vacío nombraba los 9 bancos del catálogo**, teniendo el hogar parsers de uno solo | La **captura de pantalla** |
| 7 | `COMMENT ON FUNCTION` sin firma se volvió ambiguo al agregarse una sobrecarga en otra migración | `supabase db push` |
| 8 | Tres comprobaciones de mi propio QA pasaban vacuamente: `innerText` devuelve el texto ya transformado por `text-transform`, así que las regex sensibles a mayúsculas no comprobaban nada | Revisando por qué un caso fallaba |

El nº 3 y el nº 4 son la misma historia: **dos comprobaciones que existían, se corrían, y no
comprobaban nada.** El nº 3 destapó además 7 errores de tipos dormidos, entre ellos dos
`pending()` de Jasmine que eran `ReferenceError` esperando a que el fixture cambiara.

El nº 6 es el más instructivo del grupo: el texto era correcto en el sentido de que decía la
verdad sobre la app, y falso en el único sentido que le importa al usuario — decirle que se
buscaron correos de Santander cuando no hay ningún parser de Santander configurado.

---

## Lo que queda declarado

- **El paso 4 es efímero por diseño.** `onboardingGuard` manda a Hoy exactamente cuando el
  onboarding queda completo, así que el resumen sólo existe en la sesión en que la corrida
  ocurrió. Coherente con no persistir progreso; decisión cerrada en la spec.
- **AC9 se muda a la spec 0024.** El mismo guard lo deja sin puerta de entrada apenas el usuario
  recarga, y a diferencia del resumen esto no puede ser efímero: es un control de privacidad.
- **El estado de publicación de Google está sin decidir.** Con la pantalla de consentimiento en
  "Testing", el refresh token de un scope restringido como `gmail.readonly` **caduca a los 7
  días** (verificado en la documentación de Google, citado en `docs/CONECTAR-GMAIL.md`). Toda
  esta spec se apoya en que conectar el correo es una vez y listo.

---

## Comandos de verificación

```bash
npm run typecheck      # tsconfig.app.json + tsconfig.spec.json — NO tsconfig.json
npm run test:ci        # 516 tests
npm run lint:arch      # 0 errores, 2 advertencias (ARCH-09 heredadas)
npm run test:functions # 40 tests de las edge functions (Deno)
npm run check:functions
node --test supabase/tests/grants.test.mjs   # 12 casos

# QA en navegador
npx supabase start -x edge-runtime,studio,imgproxy,logflare,vector,supavisor,realtime,storage-api,inbucket,pg_meta,mailpit
./scripts/servir-funcion.sh procesar-ahora   # :8000
ng serve --port 4292                         # el puerto NO es libre: ver docs/CONECTAR-GMAIL.md
node qa-correo.mjs qa-carpeta.mjs qa-listo.mjs qa-guard.mjs
```
