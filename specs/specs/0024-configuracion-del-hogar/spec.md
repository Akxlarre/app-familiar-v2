# Spec 0024 — Configuración del hogar

> **Status:** draft
> **Created:** 2026-08-12
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟢 ninguno — es una pantalla de consulta que rara vez se toca
> **Hito:** transversal

---

## 1. Contexto de negocio

**Origen:** deuda descubierta al cerrar la fase 4 de la spec 0004 (TD4).

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**

Hay decisiones que se toman una vez durante el onboarding y después **no se pueden volver a
tocar**, porque el onboarding deja de ser alcanzable. `onboardingGuard` manda a Hoy exactamente
cuando la configuración está completa (AC-E2 de la 0004), que es justo el momento en que empieza
a haber algo que administrar.

El caso que lo hizo evidente: **desconectar el correo**. Se construyó en el paso 3, funciona, y
es inalcanzable apenas el usuario recarga la página. Es un control de privacidad — quien quiere
revocarle a la app el acceso a su Gmail no puede hacerlo desde la app.

Lo mismo pasa, en menor grado, con el `invite_code`: se muestra una vez al crear el hogar y
después no hay dónde volver a mirarlo. Quien quiera sumar a su pareja tres semanas más tarde no
tiene de dónde sacarlo.

**Hipótesis de valor:**

Una pantalla de configuración no agrega funcionalidad: **le da permanencia a la que ya existe**.
Sin ella, cada decisión del onboarding es de una sola vez en la vida, y eso es una promesa que la
app no debería hacer.

**Por qué no es parte de la 0004:**

Porque el onboarding es un camino, no un lugar. Meterle la capacidad de volver lo convierte en
una pantalla de administración disfrazada de asistente, y entonces el guard que impide crear un
segundo hogar deja de poder existir.

---

## 2. User Stories

- **US1**: Como usuario, quiero desconectar mi correo cuando quiera, sin tener que borrar la cuenta.
- **US2**: Como usuario, quiero volver a ver el código de invitación de mi hogar para sumar a mi pareja.
- **US3**: Como usuario, quiero cambiar qué carpeta del correo se vigila si mi banco empezó a llegar a otra parte.
- **US4**: Como usuario, quiero saber si la captura está funcionando — cuándo fue la última vez que se leyó el correo y si falló.
- **US5**: Como usuario, quiero cambiar el nombre de mi hogar sin tener que rehacerlo.

---

## 3. Acceptance Criteria (Gherkin)

### El correo conectado

- **AC1**: Given un correo conectado, When se abre configuración, Then se ve qué casilla es, qué carpeta se vigila y cuándo fue la última lectura.
- **AC2**: Given un correo conectado, When se desconecta, Then se borran `access_token` y `refresh_token` de la base — no se marca la fila como revocada (hereda AC9 de la spec 0004).
- **AC3**: Given el usuario va a desconectar, When confirma, Then se le dice qué deja de pasar (no entran movimientos nuevos) y qué se conserva (todo lo ya capturado).
- **AC4**: Given un correo desconectado, When se abre configuración, Then se ofrece conectarlo de nuevo sin pasar por el onboarding.
- **AC5**: Given un correo conectado, When se cambia la carpeta, Then se guarda y la próxima corrida usa la nueva (hereda AC8 de la spec 0004).

### El hogar

- **AC6**: Given un hogar, When se abre configuración, Then se ve su nombre, su `invite_code` con botón de copiar, y quiénes lo integran.
- **AC7**: Given un hogar, When se cambia el nombre, Then se guarda sin afectar nada más.

### Estado de la captura

- **AC8**: Given una integración con `ultimo_error`, When se abre configuración, Then se muestra en lenguaje del usuario y se dice qué hacer — típicamente reconectar.
- **AC9**: Given una integración que nunca sincronizó, When se abre configuración, Then se distingue "todavía no corrió" de "corrió y no encontró nada".

### Edge cases obligatorios

- **AC-E1**: Given el usuario desconecta el correo, When vuelve a Hoy, Then **no** se lo manda al onboarding — tiene hogar y cuenta, y `hogarGuard` no puede tratarlo como usuario nuevo.
- **AC-E2**: Given dos miembros del hogar, When uno desconecta su correo, Then el del otro sigue conectado — la integración es por perfil, no por hogar.
- **AC-E3**: Given un usuario sin correo conectado nunca, When abre configuración, Then la sección existe y explica qué se gana conectándolo, en vez de estar vacía.

---

## 4. Out of scope

- ❌ **Salir del hogar / borrar el hogar.** No hay caso de uso todavía y las consecuencias sobre los datos compartidos son una decisión aparte.
- ❌ **Roles y permisos.** REQ-001: dos personas, los mismos permisos.
- ❌ **Preferencias de apariencia (tema, idioma).** El tema ya vive en el shell; traerlo acá sería moverlo, no configurarlo.
- ❌ **Editar los regex de los parsers.** Igual que en la 0006: eso es mantenimiento, no configuración.
- ❌ **Notificaciones.** Sin spec que las produzca todavía.

---

## 5. Dependencias

### Specs previas
- 0004 — construye `IntegracionesRepository`, `mis_integraciones_email` y el GRANT por columna sobre `carpeta`. Esta spec les da una puerta de entrada permanente.
- 0003 — la navegación y el shell donde vive la pantalla.

### Capacidades del proyecto que se asumen existentes
- `IntegracionesRepository` con `mia()`, `cambiarCarpeta()`, `desconectar()`.
- `HogaresRepository` con `miHogar()`.
- Edge function `gmail-oauth` y las utilidades del consentimiento.
- `ConfirmModalService` para AC3.

### Capacidades nuevas requeridas
- Ruta y pantalla de configuración, y su lugar en la navegación (¿menú? ¿avatar? — decidir en el plan).
- `UPDATE` sobre `households.nombre` para AC7: hoy el cliente no tiene ese privilegio, igual que no tenía el de `carpeta`.
- Listado de los miembros del hogar (AC6): `profiles` filtrado por `household_id`.
- Reutilizar `PasoCorreoComponent` o extraer su bloque de conexión a un componente compartido — **decidir en el plan**, porque duplicarlo es tener dos pantallas que conectan Gmail de forma distinta.

---

## 6. Datos y modelo

- **Tablas modificadas:** ninguna nueva. Hace falta revisar privilegios: `households.nombre` necesita `GRANT UPDATE` por columna y policy, con el mismo criterio que `integraciones_email.carpeta` — por columna, nunca a secas.
- **Modelo UI:** `IntegracionEmail` (ya existe), `Hogar` (ya existe), `MiembroDelHogar` (nuevo).
- **RLS:** ya cubierta para lectura. Las escrituras nuevas necesitan `USING` **y** `WITH CHECK`.

---

## 7. UX y flujos

- **Pantalla:** `/app/configuracion` (nombre a confirmar en el plan).
- **Forma:** secciones, no pestañas. Son pocas cosas y todas caben en una columna: el hogar arriba, el correo abajo, el estado de la captura junto al correo.
- **Desconectar** es la única acción destructiva: confirmación explícita (AC3), y el botón no compite visualmente con nada.
- **No es un formulario.** Es una pantalla de lectura con acciones puntuales; los campos editables se guardan al confirmar cada uno, no con un "Guardar" global que invita a tocar de más.

---

## 8. Métricas de éxito post-launch

- El correo se puede desconectar sin pasar por la base de datos. Hoy no.
- El `invite_code` se puede recuperar sin recrear el hogar. Hoy no.
- Un `ultimo_error` de la integración llega al usuario en vez de quedar en una columna que nadie mira.

---

## 9. Notas / decisiones abiertas

- [ ] ¿Dónde entra en la navegación? El menú tiene cuatro destinos y agregarle "Configuración" lo convierte en cinco, con uno que casi nunca se usa. La alternativa es colgarlo del avatar/perfil del topbar. **Decidir antes del plan.**
- [ ] ¿El bloque de conectar Gmail se comparte con el onboarding o se duplica? Compartirlo obliga a que el componente no dependa de `OnboardingFacade` — hoy sí depende.
- [ ] ¿Reconectar el correo desde acá vuelve a pedir consentimiento completo? Sí, no hay otra: el refresh token se borró. Pero conviene decirlo antes de mandar a Google.
- [ ] ¿Se muestra cuándo caduca el permiso de Google? Con la app en "Testing" el refresh token dura 7 días (ver `docs/CONECTAR-GMAIL.md`), y una integración que muere sola sin avisar es el peor caso posible. Depende de qué se decida sobre el estado de publicación.

---

## Changelog

- 2026-08-12 — draft inicial. Nace de TD4 de la spec 0004: AC9 quedó construido y sin puerta de entrada.
