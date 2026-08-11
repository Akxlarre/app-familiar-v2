# Spec 0018 — Objetivo calórico derivado del peso

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟢 automático (se recalcula solo al pesarse)
> **Hito:** 3 — cuerpo y alimentación

---

## 1. Contexto de negocio

**Origen:** REQ-051.

**Persona afectada:** cada miembro por separado.

**Problema que resuelve:**
Esta spec existe por un error concreto y bien documentado de v1. `calories_target` era una
columna: se calculaba una vez con el peso de ese día y se guardaba. Como el peso cambia y la
columna no, el objetivo quedaba viejo. La solución que se aplicó en v1 fue agregar más columnas —
`last_recalibration` e `is_manual_override`— para administrar la desactualización en vez de
eliminarla.

Acá el objetivo **no se almacena**: se deriva del último peso registrado en Cuerpo (spec 0015).
Cuando el usuario se pesa, el objetivo ya está actualizado, sin recalibración, sin job, sin
columna que se pudra.

Es el ejemplo canónico de la regla de oro del dominio: **los eventos congelan, las definiciones
derivan.** Un registro de comida es un evento y congela sus macros; el objetivo calórico es una
definición y se deriva.

**Hipótesis de valor:**
Un objetivo que se mantiene solo es un objetivo en el que se puede confiar. Uno que hay que
recalibrar a mano se ignora a los dos meses.

---

## 2. User Stories

- **US1**: Como usuario, quiero definir mi objetivo una vez y que se mantenga solo.
- **US2**: Como usuario, quiero que al registrar un peso nuevo mi objetivo se actualice sin hacer nada.
- **US3**: Como usuario, quiero poder fijar un número a mano si mi nutricionista me dio uno.
- **US4**: Como usuario, quiero entender de dónde sale el número, para confiar en él.

---

## 3. Acceptance Criteria (Gherkin)

### El perfil

- **AC1**: Given un usuario, When completa su perfil nutricional, Then registra sexo, fecha de nacimiento, altura, nivel de actividad y objetivo (bajar, mantener, subir).
- **AC2**: Given el perfil, When se guarda, Then **no** incluye el peso — lo lee de Cuerpo (RN-08).
- **AC3**: Given el perfil, When se define el reparto de macros, Then se guarda como porcentajes que suman 100.

### Derivar

- **AC4**: Given un perfil completo y al menos un peso registrado, When se consulta el objetivo calórico, Then se **calcula** a partir del último peso — no se lee de ninguna columna.
- **AC5**: Given una medición de peso nueva, When se guarda, Then el objetivo del día siguiente ya refleja el peso nuevo, sin recalibración ni job.
- **AC6**: Given el objetivo, When se muestra, Then se explica cómo se llegó a él (peso, altura, edad, actividad, objetivo).
- **AC7**: Given un perfil sin peso registrado, When se consulta el objetivo, Then **no hay objetivo** y se pide registrar un peso — no se inventa con un peso por defecto.

### Sobrescribir

- **AC8**: Given un usuario con un número dado por un profesional, When lo fija a mano, Then ese número gana sobre el derivado.
- **AC9**: Given un objetivo fijado a mano, When se registra un peso nuevo, Then **no** se sobrescribe — pero se avisa que el derivado cambió y se ofrece volver al automático.
- **AC10**: Given un objetivo fijado a mano, When se vuelve al automático, Then se recalcula al instante.

### Edge cases obligatorios

- **AC-E1**: Given un peso registrado hace seis meses, When se deriva el objetivo, Then se avisa que el dato está viejo en vez de calcular en silencio con un peso obsoleto.
- **AC-E2**: Given un perfil incompleto (sin altura), When se consulta, Then se dice qué falta.
- **AC-E3**: Given un cambio de nivel de actividad, When se guarda, Then el objetivo cambia al instante.
- **AC-E4**: Given dos pesos el mismo día, When se deriva, Then se usa el más reciente (coherente con AC3 de la spec 0015).

---

## 4. Out of scope

- ❌ **Consejo nutricional.** Un número calculado con una fórmula pública no es una recomendación médica, y la app no opina sobre lo que se come.
- ❌ **Ajuste automático del objetivo según el progreso.** Suena inteligente y es exactamente donde un sistema empieza a decidir sobre el cuerpo del usuario sin preguntar (R-04).
- ❌ **Planes de déficit con fechas.** Es una meta; viven en Entrenamiento (spec 0021).
- ❌ **Múltiples fórmulas seleccionables.** Una fórmula, bien explicada.

---

## 5. Dependencias

### Specs previas
- 0015 — el peso. **Bloqueante duro y la razón por la que Cuerpo va antes que Alimentación.**
- 0017 — el objetivo se muestra contra los totales del día.

### Capacidades del proyecto que se asumen existentes
- Serie de mediciones con su último peso.

### Capacidades nuevas requeridas
- Tabla `perfil_nutricional` — **sin columna de peso ni de calorías objetivo**.
- Cálculo de TDEE (Mifflin-St Jeor u otra) — función pura con tests, incluyendo los casos límite.
- Vista o RPC que exponga el objetivo derivado.
- Campo de override explícito, con su propia bandera (AC8-AC10).

---

## 6. Datos y modelo

- **Tabla nueva:** `perfil_nutricional` (sexo, nacimiento, altura, actividad, objetivo, reparto de macros, override opcional).
- **Prohibido:** columnas `calories_target`, `last_recalibration`, `is_manual_override` como estado calculado. El override sí es un dato del usuario; el objetivo derivado, no.
- **Modelo UI:** `PerfilNutricional`, `ObjetivoCalorico` (con su explicación).
- **RLS:** por perfil, igual que 0015 y 0017.

---

## 7. UX y flujos

- **Dónde vive:** el perfil se completa una vez desde Ajustes o al abrir Alimentación por primera vez. El objetivo se **muestra** en la pantalla de comidas (spec 0017).
- **La explicación importa (AC6):** un número sin origen se desconfía. Una línea alcanza: *"1.980 kcal — calculado con tu peso de ayer (78 kg), altura y actividad moderada, para bajar 0,5 kg por semana."*
- **Override:** un campo aparte, con la diferencia respecto del derivado a la vista.
- **Estados:** sin perfil, sin peso (AC7), peso viejo (AC-E1).

---

## 8. Métricas de éxito post-launch

- % de usuarios con objetivo derivado vs. fijado a mano (mucho override sugiere que la fórmula no convence).
- Días entre el último peso y hoy — si crece, el objetivo pierde sentido y AC-E1 se activa seguido.

---

## 9. Notas / decisiones abiertas

- [ ] 🤖 ¿Qué fórmula? Mifflin-St Jeor es el estándar razonable. Documentarla en el código con su fuente.
- [ ] 🤖 ¿Cuántos días hacen "peso viejo" (AC-E1)? 30 parece razonable.
- [ ] 🤖 ¿El reparto de macros por defecto? Uno sensato y editable.
- [x] ¿Se almacena el objetivo? **No.** Es la razón de existir de esta spec.
- [x] ¿Se ajusta solo según el progreso? **No.** R-04.

---

## Changelog

- 2026-08-11 — draft inicial.
