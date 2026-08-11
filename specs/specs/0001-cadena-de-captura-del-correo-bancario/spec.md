# Spec 0001 — Cadena de captura del correo bancario

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** 🟢 automático
> **Hito:** 0 — el esqueleto vivo

> ⚠️ **Spec retroactiva.** El código de este track se escribió antes de activar el SDD. Se
> documenta acá porque sus AC son el contrato de regresión de todo lo que venga después: cada
> spec del hito 1 en adelante asume que esta cadena funciona. Los AC ya cubiertos llevan su
> evidencia; los que no, están marcados y son la única razón por la que esta spec no está `done`.

---

## 1. Contexto de negocio

**Origen:** post-mortem de v1 (`context/vision.md`).

**Persona afectada:** los dos miembros del hogar. No hay roles.

**Problema que resuelve:**
v1 tenía nueve módulos y cero uso. La causa no fue la falta de funcionalidades: fue que siete de
los nueve exigían escribir datos todos los días. Nadie sostiene eso. Este track construye la
única cadena que produce datos sin que nadie escriba nada — el banco manda un correo, y el
movimiento aparece.

**Hipótesis de valor:**
Si un cargo de tarjeta aparece como movimiento sin intervención, el usuario abre la app para
*mirar* en vez de para *alimentar*. Todo el resto del producto depende de que esto sea cierto.

---

## 2. User Stories

- **US1**: Como persona que instala la app, quiero crear un hogar y darle un código a mi pareja, para que los dos veamos los mismos datos.
- **US2**: Como usuario, quiero conectar mi Gmail una sola vez, para que mis gastos aparezcan solos.
- **US3**: Como usuario, quiero que un cargo de mi tarjeta aparezca como movimiento sin que yo escriba nada.
- **US4**: Como usuario, quiero un solo lugar donde revisar lo que el sistema capturó y no pudo resolver.
- **US5**: Como usuario, quiero decir una sola vez que "UBER *TRIP" es Transporte y que nunca más me lo pregunte.

---

## 3. Acceptance Criteria (Gherkin)

### Hogar

- **AC1**: Given un usuario registrado sin hogar, When llama `create_household`, Then queda asociado a un hogar nuevo con un `invite_code` único de 6 caracteres legibles.
  <br>✅ `supabase/tests/rls_hogar.test.sql` — "el código tiene 6 caracteres legibles", "el perfil queda asociado al hogar"
- **AC2**: Given un usuario sin hogar y un `invite_code` válido, When llama `join_household_by_code`, Then queda en el mismo hogar que quien lo generó.
  <br>✅ `rls_hogar.test.sql` — "Beto se une con el código", "Ana y Beto comparten hogar"
- **AC3**: Given un usuario que ya pertenece a un hogar, When intenta crear o unirse a otro, Then la operación falla.
  <br>✅ `rls_hogar.test.sql` — "no deja crear un segundo hogar", "no deja unirse a quien ya tiene hogar"
- **AC4**: Given dos hogares distintos, When un miembro del hogar A consulta cualquier tabla, Then no ve ninguna fila del hogar B.
  <br>✅ `rls_hogar.test.sql` — "Ana ve solo su hogar / su cuenta / sus movimientos", "no puede escribir en el hogar ajeno"

### Captura

- **AC5**: Given una casilla de Gmail conectada y un correo que coincide con un parser activo, When corre `process-bank-emails`, Then se crea una `captura` con el payload crudo antes de intentar interpretarla.
  <br>⬜ **Sin verificar contra Gmail real.**
- **AC6**: Given una captura cuyo parser extrae monto con confianza suficiente y cuyo parser tiene cuenta asociada, When se procesa, Then se crea el `movimiento` y la captura queda `procesada`.
  <br>⬜ **Sin verificar contra Gmail real.** La decisión pura sí: `_shared/capturas.test.ts`.
- **AC7**: Given un correo que ya fue procesado, When se vuelve a procesar, Then no se crea un segundo movimiento.
  <br>✅ `supabase/tests/bandeja_resolver.test.sql` — "un mismo correo no entra dos veces a la bandeja", "una captura genera a lo sumo un movimiento"
- **AC8**: Given una captura que el parser no pudo resolver, When termina el proceso, Then queda en la bandeja con un motivo legible y **nunca** se descarta sola (RN-09).
  <br>✅ `_shared/capturas.test.ts`, `bandeja.facade.spec.ts`
- **AC9**: Given una captura en la bandeja con monto interpretado, When el usuario toca Confirmar, Then se crea el movimiento y la captura queda `procesada`, de forma atómica.
  <br>✅ `bandeja_resolver.test.sql` (RPC `resolver_captura`), `bandeja.facade.spec.ts`
- **AC10**: Given una captura sin monto, When el usuario la completa a mano, Then puede crear el movimiento sin salir de la bandeja.
  <br>✅ `completar-captura.component.spec.ts` (11 casos)
- **AC11**: Given un parser corregido y capturas atascadas de cuando estaba roto, When el usuario toca "Reintentar con los parsers actuales", Then las que ahora se pueden leer vuelven a la bandeja como confirmables de un toque.
  <br>✅ `_shared/capturas.test.ts`, `bandeja.facade.spec.ts`

### Aprendizaje

- **AC12**: Given un movimiento que se resuelve marcando "recordar este comercio", When llega otra captura del mismo comercio, Then se categoriza sola (RN-10).
  <br>✅ `bandeja_resolver.test.sql`, RPC `categoria_para_comercio`
- **AC13**: Given un comercio escrito con variaciones ("JUMBO", "jumbo maipú", "JUMBO  MAIPU"), When se busca su alias, Then el match tolera acentos, mayúsculas y espacios repetidos.
  <br>✅ `normalizar_comercio` + `unaccent_simple` en SQL

### Seguridad

- **AC14**: Given una integración de correo guardada, When el cliente consulta sus integraciones, Then **no** recibe `access_token` ni `refresh_token` (RNF-05).
  <br>✅ `rls_hogar.test.sql` — "access_token no es legible por el cliente" (vista `mis_integraciones_email`)
- **AC15**: Given una petición a una edge function desde un origen no permitido, When llega el preflight, Then no se refleja `Access-Control-Allow-Origin`.
  <br>✅ `_shared/http.test.ts` (7 casos)
- **AC16**: Given un error de base de datos de cualquier tipo, When llega a la UI o al `motivo` de una captura, Then no contiene nombres de tabla, columna ni constraint.
  <br>✅ `db-error.utils.spec.ts` (11 casos), `_shared/capturas.test.ts` — `motivoSeguro`

### Edge cases obligatorios

- **AC-E1**: Given un correo que no coincide con ningún parser, When se procesa, Then se ignora sin dejar rastro — registrarlo llenaría la bandeja de ruido. ✅ código + revisión
- **AC-E2**: Given un token de Gmail expirado, When corre el proceso, Then se refresca solo y la integración no se marca caída. ⬜ **Sin verificar contra Google real.**
- **AC-E3**: Given un monto escrito a la chilena ("$15.990"), When se parsea, Then vale 15990 y no 15,99. ✅ `_shared/parseo.test.ts`
- **AC-E4**: Given una captura sin texto guardado, When se reprocesa, Then se dice por qué en vez de reportar "ningún parser reconoce el correo". ✅ `_shared/capturas.test.ts`

---

## 4. Out of scope

- ❌ **Ver los movimientos.** La cadena los crea y no hay pantalla que los muestre → spec 0005.
- ❌ **Administrar cuentas y tarjetas** desde la UI. Hoy se insertan a mano en la base → spec 0006.
- ❌ **Administrar parsers** desde la UI. Son configuración editable en base sin desplegar; una pantalla para eso es un producto aparte.
- ❌ **Boletas.** El otro origen de captura → hito 2.
- ❌ **Cuotas agrupadas.** El parser ya las extrae; verlas es la spec 0007.
- ❌ **Onboarding.** Crear hogar y conectar Gmail funcionan por RPC y edge function, pero no tienen pantalla → spec 0004.

---

## 5. Dependencias

### Specs previas
Ninguna. Es la primera.

### Capacidades del proyecto que se asumen existentes
- Boilerplate de Koa 7.0: `BaseFacade`, `AppShell`, `LayoutDrawerService`, sistema de tokens.
- Supabase con `auth.users` y el trigger `handle_new_user`.

### Capacidades nuevas requeridas
- 11 tablas (`supabase/migrations/2026081110–13*`), RLS en todas.
- RPCs `create_household`, `join_household_by_code`, `resolver_captura`, `categoria_para_comercio`, `normalizar_comercio`, `unaccent_simple`.
- Edge functions `gmail-oauth`, `process-bank-emails`, `reprocesar-capturas`.

---

## 6. Datos y modelo

- **Tablas:** `households`, `profiles`, `capturas`, `integraciones_email`, `parsers_email`, `cuentas`, `categorias_gasto`, `movimientos`, `alias_comercio`, `compras_en_cuotas`, `detalle_credito`.
- **Vista:** `mis_integraciones_email` — expone la integración sin los tokens (AC14).
- **Modelos UI:** `Captura`, `InterpretacionCaptura`, `ResolucionCaptura`.
- **RLS:** todas las tablas, vía `belongs_to_household()` con `SECURITY DEFINER` y `search_path` fijo (evita la recursión de políticas).

---

## 7. UX y flujos

- **Pantalla:** `/app/bandeja`. Hero slim con tres KPIs (por revisar, a un toque, necesitan datos) + panel que llena el viewport.
- **Happy path:** el usuario **no** entra. El movimiento se creó solo y la bandeja está vacía.
- **Camino corto:** captura con monto → un toque en Confirmar → desaparece de la lista sin recargar.
- **Camino largo:** captura sin monto → "Completar" → drawer con lo que el parser sí entendió + los campos que faltan.
- **Orden de la lista:** primero lo que se resuelve de un toque. Poner arriba lo que exige tipear convierte la bandeja en un formulario, que es justo lo que este producto evita.
- **Estados:** skeleton en primera carga, `app-error-state` con reintento, `app-empty-state` con copy que explica que lo normal es que esté vacía.

---

## 8. Métricas de éxito post-launch

- **La métrica que importa:** % de movimientos creados sin intervención sobre el total. Si baja de ~70%, los parsers no sirven y hay que corregirlos.
- Capturas que llegan a la bandeja por semana (debería bajar con el tiempo, por REQ-013).
- Comercios aprendidos acumulados.

---

## 9. Notas / decisiones abiertas

- [ ] 🌍 **La cadena nunca corrió contra la realidad.** Faltan: un proyecto Supabase desplegado, el cliente OAuth de Google y una casilla con correos de banco reales. Es lo único que puede decir si los parsers portados de v1 siguen sirviendo (RB-01). AC5, AC6 y AC-E2 dependen de esto.
- [x] ¿El reproceso crea movimientos? **No.** Deja la captura confirmable y el usuario da el toque: el parser ya se equivocó una vez con ese correo (R-04, RN-09).
- [x] ¿Dónde se normaliza el comercio? **Sólo en SQL.** Tenerlo también en TS obligaría a que dos implementaciones coincidan para siempre; el día que difieran, los alias dejan de aplicarse en silencio.

---

## Changelog

- 2026-08-11 — spec retroactiva redactada sobre código ya escrito, al activar el SDD.
