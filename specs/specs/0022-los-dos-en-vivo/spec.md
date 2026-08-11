# Spec 0022 — Los dos miembros en vivo

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟢 automático
> **Hito:** transversal

---

## 1. Contexto de negocio

**Origen:** RNF-01.

**Persona afectada:** los dos miembros del hogar, al mismo tiempo.

**Problema que resuelve:**
Hay un momento concreto donde esta app se rompe sin Realtime: uno está en el supermercado con la
lista abierta y el otro, desde la casa, agrega "leche". Si la lista no se actualiza, la leche no
se compra — y peor, la app quedó en el medio de algo que un mensaje de WhatsApp resolvía.

Lo mismo con la despensa ("acabo de usar el último atún") y con los movimientos.

Es transversal a propósito: no es una feature de la lista ni de la despensa, es una propiedad que
varias pantallas necesitan y que conviene resolver una sola vez y bien.

**Hipótesis de valor:**
Si la app se mantiene sincronizada sin que nadie recargue, se puede confiar en ella para coordinar
entre dos personas. Si no, cada uno vuelve a preguntar por mensaje.

---

## 2. User Stories

- **US1**: Como usuario en el supermercado, quiero ver lo que mi pareja agrega a la lista en ese momento.
- **US2**: Como usuario, quiero que lo que marco como comprado le aparezca al otro sin que recargue.
- **US3**: Como usuario, quiero ver un movimiento nuevo aparecer sin refrescar.
- **US4**: Como usuario con mala señal, quiero que la app siga usable y sincronice cuando pueda.

---

## 3. Acceptance Criteria (Gherkin)

### Sincronizar

- **AC1**: Given dos sesiones del mismo hogar con la lista abierta, When una agrega, marca o borra un ítem, Then la otra lo refleja en segundos sin recargar.
- **AC2**: Given la despensa abierta en dos dispositivos, When uno marca "se acabó", Then el otro lo ve.
- **AC3**: Given la pantalla de movimientos abierta, When entra un movimiento por captura, Then aparece sin recargar.
- **AC4**: Given una tabla sin necesidad de tiempo real (mediciones, recetas, presupuestos), When se modifica, Then **no** se suscribe nada — cada suscripción es una conexión abierta y un costo.

### Que no moleste

- **AC5**: Given un cambio remoto en la lista que se está mirando, When llega, Then no salta la posición de scroll ni se pierde lo que se está escribiendo.
- **AC6**: Given un cambio remoto, When llega, Then se distingue visualmente por un momento — que algo cambie solo sin señal alguna desorienta.
- **AC7**: Given el usuario en otra pantalla, When llega un cambio, Then no se interrumpe con un aviso.

### Cuando falla

- **AC8**: Given la conexión de Realtime se cae, When ocurre, Then la app sigue funcionando con datos locales y se reconecta sola.
- **AC9**: Given una reconexión, When ocurre, Then se refrescan los datos de la pantalla actual — los eventos perdidos durante la caída no se recuperan solos.
- **AC10**: Given el usuario deja la app en segundo plano un rato largo, When vuelve, Then se refresca en vez de confiar en una suscripción vieja.

### Seguridad

- **AC11**: Given las suscripciones de Realtime, When se establecen, Then respetan RLS: un hogar **jamás** recibe eventos de otro (RNF-03).
- **AC12**: Given un usuario que se va del hogar, When se desconecta, Then deja de recibir eventos.

### Edge cases obligatorios

- **AC-E1**: Given dos usuarios editando el mismo ítem a la vez, When ambos guardan, Then gana el último y nadie ve un error.
- **AC-E2**: Given una actualización optimista local (spec 0013) y el eco del servidor, When llega el evento propio, Then no se aplica dos veces ni parpadea.
- **AC-E3**: Given un componente destruido, When llega un evento, Then la suscripción ya se cerró y no hay fuga.
- **AC-E4**: Given varias pestañas abiertas del mismo usuario, When se suscriben, Then no se multiplican las conexiones sin control.

---

## 4. Out of scope

- ❌ **Realtime en todo.** AC4. Suscribir todo es la forma más fácil de gastar conexiones sin que nadie lo note.
- ❌ **Edición colaborativa carácter por carácter.** No hay documentos.
- ❌ **Presencia** ("Ana está mirando la lista"). Simpático, inútil acá.
- ❌ **Resolución de conflictos con merge.** Último gana (AC-E1); con dos usuarios alcanza.
- ❌ **Offline completo con cola de sincronización.** Es otro proyecto. Lo que sí entra es que la app no se rompa sin conexión (AC8).

---

## 5. Dependencias

### Specs previas
- 0013 — la lista es el caso que justifica esta spec.
- 0011 — la despensa.
- 0005 — los movimientos.

Se puede construir en cualquier momento después de que exista la primera de esas tres, pero **no
antes**: Realtime sin una pantalla compartida que lo necesite es infraestructura sin usuario.

### Capacidades del proyecto que se asumen existentes
- `BaseFacade` con `dispose()` — el gancho de limpieza ya está previsto en el boilerplate.
- RLS en todas las tablas.

### Capacidades nuevas requeridas
- Servicio de Realtime que centralice suscripciones, reconexión y limpieza.
- Publicación de Realtime habilitada **sólo** en las tablas de AC1-AC3.
- Deduplicación del eco propio (AC-E2).
- Refresco al volver del segundo plano (AC10).

---

## 6. Datos y modelo

- **Tablas:** sin cambios de esquema. Sí cambia la **configuración**: `ALTER PUBLICATION supabase_realtime ADD TABLE …` sólo para `items_lista`, `despensa` y `movimientos`.
- **RLS:** Realtime respeta RLS, pero hay que verificarlo explícitamente (AC11), no asumirlo.

---

## 7. UX y flujos

No tiene pantalla. Se manifiesta como:

- **Un ítem que aparece** en la lista con una transición breve que lo señala (AC6).
- **Un contador que cambia** en el hero.
- **Nada más.** El mejor Realtime es el que no se nota, salvo el instante en que evita una pregunta.

---

## 8. Métricas de éxito post-launch

- Sesiones simultáneas de los dos miembros (mide si el caso de uso existe de verdad).
- Reconexiones por sesión (si son muchas, algo anda mal).

---

## 9. Notas / decisiones abiertas

- [ ] 🤖 ¿Un canal por tabla o uno por hogar? Uno por hogar es menos conexiones; hay que ver qué permite el filtrado de Supabase.
- [ ] 🤖 ¿Cómo se dedupe el eco propio (AC-E2)? Por id del cambio local, o ignorando eventos cuyo `updated_by` es uno mismo.
- [x] ¿Realtime en todo? **No.** Sólo lista, despensa y movimientos.
- [x] ¿Offline con cola? **No.** Que no se rompa, sí; sincronización diferida completa, no.

---

## Changelog

- 2026-08-11 — draft inicial.
