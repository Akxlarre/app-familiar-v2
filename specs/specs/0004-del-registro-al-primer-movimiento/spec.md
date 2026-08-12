# Spec 0004 — Del registro al primer movimiento

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** 🟡 manual, una vez en la vida
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** hueco detectado al cerrar el hito 0.

**Persona afectada:** quien instala la app (y su pareja, que se une después).

**Problema que resuelve:**
La cadena del hito 0 funciona por RPC y edge function, pero **no tiene pantalla**. Hoy, para que
un usuario nuevo llegue a ver su primer movimiento, alguien tiene que ejecutar SQL a mano: crear
el hogar, insertar una cuenta, insertar un parser y disparar el OAuth. Es decir: el producto
entero es inalcanzable sin acceso a la base.

Y el onboarding no es un formulario cualquiera. Es el **único** momento en que se le pide al
usuario que escriba cosas, y es donde se decide si la app le sirve: si termina el onboarding y no
ve nada, se va. La promesa —"tus gastos aparecen solos"— tiene que cumplirse en la primera
sesión, no en la tercera.

**Hipótesis de valor:**
Si el onboarding termina mostrando un movimiento real, capturado de su propio correo, el usuario
entiende el producto sin que nadie se lo explique. Si termina en una pantalla vacía con un "ya
está configurado", no vuelve.

---

## 2. User Stories

- **US1**: Como persona que instala la app, quiero crear mi hogar y obtener un código para mi pareja, sin tocar la base de datos.
- **US2**: Como pareja de quien instaló, quiero entrar con un código y ver los mismos datos.
- **US3**: Como usuario nuevo, quiero conectar mi Gmail y elegir qué carpeta vigilar, en un flujo guiado.
- **US4**: Como usuario nuevo, quiero terminar el onboarding **viendo un movimiento mío**, para saber que esto funciona.
- **US5**: Como usuario, quiero desconectar mi correo y que se borren los tokens.

---

## 3. Acceptance Criteria (Gherkin)

### Hogar

- **AC1**: Given un usuario recién registrado sin hogar, When entra a la app, Then se le ofrece crear un hogar o unirse con código — y no puede llegar a ninguna otra pantalla hasta elegir.
- **AC2**: Given el usuario elige crear, When confirma, Then queda en un hogar nuevo y ve el `invite_code` con un botón para copiarlo.
- **AC3**: Given el usuario elige unirse y escribe un código válido, When confirma, Then queda en el hogar existente y ve sus datos.
- **AC4**: Given un código inválido o inexistente, When se confirma, Then se explica que no existe, sin revelar si el hogar existe pero el código venció.

### Correo

- **AC5**: Given un usuario con hogar y sin correo conectado, When toca "Conectar mi correo", Then va al consentimiento de Google con `access_type=offline` y `prompt=consent`.
- **AC6**: Given Google devuelve el código, When se canjea, Then se guarda el refresh token **en el servidor** y el cliente nunca lo ve (RNF-05).
- **AC7**: Given Google no devuelve refresh token, When se canjea, Then se explica que hay que reintentar el consentimiento, en vez de guardar una integración que muere en una hora.
- **AC8**: Given un correo conectado, When el usuario elige la carpeta o etiqueta a vigilar, Then se guarda en la integración.
- **AC9**: Given un correo conectado, When el usuario lo desconecta, Then se borran `access_token` y `refresh_token` de la base.

### Primera captura

- **AC10**: Given una integración recién creada, When termina el paso de conexión, Then se dispara una primera corrida de `process-bank-emails` sin esperar al cron.
- **AC11**: Given esa corrida encontró correos del banco, When termina, Then el onboarding muestra los movimientos creados y las capturas pendientes, con nombre y monto.
- **AC12**: Given esa corrida no encontró nada, When termina, Then se dice qué se buscó (carpeta, días hacia atrás, bancos reconocidos) y qué hacer — no un "listo" vacío.

### Cuenta y parser — el problema real

- **AC13**: Given un usuario sin cuentas, When llega el primer correo del banco, Then la captura queda en la bandeja con "El parser no tiene cuenta asociada" y el onboarding le pide crear la cuenta.
- **AC14**: Given el usuario crea su primera cuenta durante el onboarding, When elige su banco de una lista, Then se le asocian los parsers de ese banco sin que tenga que escribir un solo regex.

### Edge cases obligatorios

- **AC-E1**: Given el usuario cierra el navegador a mitad del onboarding, When vuelve a entrar, Then retoma en el paso donde quedó — no reinicia.
- **AC-E2**: Given un usuario que ya pertenece a un hogar, When intenta ver el onboarding por URL directa, Then se lo manda a Hoy.
- **AC-E3**: Given dos personas creando hogar al mismo tiempo, When ambas confirman, Then los `invite_code` son distintos.
- **AC-E4**: Given el consentimiento de Google se cancela, When vuelve a la app, Then se explica y se puede reintentar, con el hogar ya creado (no se pierde el paso anterior).

---

## 4. Out of scope

- ❌ **Editar parsers.** El usuario elige su banco de una lista curada; escribir regex es tarea de mantenimiento, no de onboarding.
- ❌ **Otros proveedores de correo** (Outlook, iCloud). Gmail primero; el modelo de `integraciones_email` ya tiene `proveedor`.
- ❌ **Invitar por link o por mail.** El código de 6 caracteres se dicta por WhatsApp y alcanza.
- ❌ **Recuperar contraseña / gestión de cuenta.** Ya existe en el boilerplate.
- ❌ **Onboarding de despensa o alimentación.** Cuando existan esos módulos tendrán su propio momento; meterlos acá alarga el camino al primer movimiento.

---

## 5. Dependencias

### Specs previas
- 0001 — la cadena tiene que existir para que el onboarding pueda terminar mostrándola.
- 0002, 0003 — el onboarding usa el vocabulario de piezas, y al terminar deja al usuario en Hoy.

### Capacidades del proyecto que se asumen existentes
- RPCs `create_household` y `join_household_by_code`.
- Edge functions `gmail-oauth` y `process-bank-emails`.
- `AuthFacade`, `authGuard`.

### Capacidades nuevas requeridas
- Rutas y pantallas de onboarding con estado persistente entre sesiones.
- Guard "tiene hogar" que redirige.
- **Catálogo de bancos con sus parsers** (semilla), para que elegir "BancoEstado" configure los patrones.
- Endpoint para disparar `process-bank-emails` a demanda para un hogar (hoy corre por cron sobre todos).
- Formulario de primera cuenta (versión mínima de la spec 0006).

---

## 6. Datos y modelo

- **Tablas nuevas:** ninguna. `households`, `profiles`, `integraciones_email`, `parsers_email` y `cuentas` ya existen.
- **Semilla nueva:** parsers por banco chileno, marcados como plantilla (`household_id` nulo) y copiados al hogar cuando el usuario elige su banco.
- **Estado de onboarding:** derivado, no almacenado — ¿tiene hogar? ¿tiene integración activa? ¿tiene cuenta? Una columna `onboarding_step` se desincroniza el día que alguien borra su integración.

---

## 7. UX y flujos

### Los cuatro pasos

1. **Tu hogar** — crear o unirse. Termina mostrando el código para compartir.
2. **Tu banco** — elegir de una lista y crear la primera cuenta. Es el paso que el usuario no sabe que necesita, así que se explica en una línea: *"Para saber a qué tarjeta corresponde cada cargo."*
3. **Tu correo** — consentimiento de Google y elección de carpeta.
4. **Listo** — se dispara la primera corrida y se muestra **lo que encontró**.

### Reglas del flujo

- **Un paso por pantalla**, con el progreso visible ("Paso 2 de 4" en el badge del drawer o del hero).
- **Se puede volver atrás** sin perder lo hecho.
- **Nada de campos opcionales.** Si un dato no es imprescindible para llegar al primer movimiento, no se pide acá.
- **El paso 4 no es una felicitación**: es la primera pantalla con datos reales del usuario.

### Estados especiales

- **Esperando a Google:** el consentimiento abre fuera de la app; al volver hay que retomar el paso exacto.
- **Primera corrida vacía:** ver AC12. Es el caso más probable en un banco cuyo formato cambió (RB-01) y el copy tiene que dejar al usuario con algo que hacer.
- **Error de Gmail:** se muestra el motivo y se ofrece reintentar sin rehacer los pasos previos.

---

## 8. Métricas de éxito post-launch

- % de usuarios que completan los 4 pasos.
- % que ve al menos un movimiento real en el paso 4 — **la métrica que importa**.
- Paso donde más gente abandona.

---

## 9. Notas / decisiones abiertas

- [x] ¿La lista de bancos con sus parsers se semilla en migración o se administra en una tabla global? **Tabla global de plantillas**, no semilla de migración. RB-01 dice que los formatos cambian solos: corregir un regex no puede exigir un despliegue.
- [x] ¿Qué días hacia atrás mira la primera corrida? **180 días en la primera corrida, 90 en las siguientes.** El paso 4 del onboarding necesita algo que mostrar; después el cron sólo mira lo nuevo.
- [x] ¿Se puede usar la app sin conectar correo? **Obligatorio ahora, opcional cuando exista la boleta (hito 2).** Hasta entonces, sin correo la app está literalmente vacía y dejar entrar es prometer algo que no se cumple. Cuando la boleta produzca datos, el onboarding ofrece los dos caminos y esta spec se revisa.
- [x] ¿`onboarding_step` en la base? **No.** Se deriva del estado real; una columna de progreso miente el día que alguien desconecta su correo.
- [x] ¿El paso 4 se puede volver a ver? **No, y está bien.** `onboardingGuard` manda a Hoy
      exactamente cuando el paso es "listo" (AC-E2), así que el resumen sólo existe en la sesión
      en que la corrida ocurrió. Es coherente con no persistir progreso: un resumen de "lo que
      encontramos en tu correo" mostrado una semana después ya no describe nada — esos datos
      están en Hoy y en Plata, que sí son permanentes. **AC11 y AC12 se leen como "al terminar
      la primera corrida", no como una pantalla consultable.**
- [x] ¿Y desconectar el correo (AC9)? **Se muda a la spec 0024.** El mismo guard lo deja sin
      puerta de entrada apenas el usuario recarga, y a diferencia del resumen, esto no puede ser
      efímero: es un control de privacidad. Acá se construye porque el onboarding lo necesita
      —quien se equivoca de casilla tiene que poder corregirlo en el momento— pero su lugar
      permanente es la pantalla de configuración.

---

## Changelog

- 2026-08-11 — draft inicial.
- 2026-08-12 — cerradas las dos decisiones que abrió la fase 4: el paso 4 es efímero por diseño;
  AC9 se muda a la spec 0024 (configuración del hogar).
