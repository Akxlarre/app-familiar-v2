# Spec 0015 — Serie de mediciones

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟡 manual con intención
> **Hito:** 3 — cuerpo y alimentación

---

## 1. Contexto de negocio

**Origen:** REQ-060, RN-08.

**Persona afectada:** cada miembro por separado — aunque los datos son del hogar, como todo lo
demás (AC13). Lo personal acá es el uso, no el alcance: cada uno registra y mira lo suyo.

**Problema que resuelve:**
En v1 el peso vivía en tres tablas distintas y ninguna era la buena. La consecuencia no fue sólo
desprolijidad: el objetivo calórico se calculaba desde una copia que se desactualizaba, y por eso
existían columnas como `last_recalibration` e `is_manual_override` — parches para un problema que
no debería haber existido.

Esta spec va **antes** que toda Alimentación aunque sea menos visible, porque es la que le da al
peso un solo dueño. Después, quien lo necesite lo lee.

**Hipótesis de valor:**
Pesarse es de las pocas entradas manuales que sí se sostienen: se hace de mañana, con intención, y
el resultado se quiere ver. A cambio, habilita que el objetivo calórico se derive solo.

---

## 2. User Stories

- **US1**: Como usuario, quiero registrar mi peso y ver cómo evoluciona.
- **US2**: Como usuario, quiero registrar medidas corporales cuando me las tomo, sin que sea obligatorio cada vez.
- **US3**: Como usuario, quiero guardar una foto de progreso junto a la medición.
- **US4**: Como sistema, necesito que el peso tenga un solo dueño, para que el objetivo calórico se derive y no se copie.

---

## 3. Acceptance Criteria (Gherkin)

### Registrar

- **AC1**: Given un usuario, When registra una medición, Then guarda fecha y peso, y opcionalmente cintura, cadera, pecho, brazos, piernas, notas y foto.
- **AC2**: Given una medición, When se registra sólo el peso, Then es válida — los demás campos no se piden ni se marcan como faltantes.
- **AC3**: Given dos mediciones el mismo día, When se registran, Then ambas se guardan; la serie usa la más reciente de ese día.
- **AC4**: Given una medición, When se corrige o borra, Then la serie y todo lo que la deriva se recalculan.

### La serie

- **AC5**: Given tres o más mediciones, When se abre Cuerpo, Then se ve la evolución del peso en el tiempo.
- **AC6**: Given mediciones con ruido diario, When se muestra la tendencia, Then se suaviza — el peso oscila 1-2 kg por hidratación y mostrar cada punto crudo asusta sin informar.
- **AC7**: Given una medida corporal registrada varias veces, When se abre, Then tiene su propia serie.
- **AC8**: Given una foto de progreso, When se abre la medición, Then se ve, y se pueden comparar dos fechas.

### Un solo dueño

- **AC9**: Given el peso registrado acá, When Alimentación calcula el objetivo calórico, Then lo **lee** de esta serie (RN-08).
- **AC10**: Given una medición nueva, When se guarda, Then el objetivo calórico se actualiza solo (spec 0018).
- **AC11**: Given cualquier otro contexto, When necesita el peso, Then **no** lo copia a una columna propia.

### Alcance dentro del hogar

- **AC12**: Given dos miembros del hogar, When uno abre Cuerpo, Then ve **sus** mediciones por defecto — es el caso de uso del 99% de las veces.
- **AC13**: Given las mediciones del otro miembro, When se buscan explícitamente, Then **se ven**. El hogar comparte todo (REQ-001) y esta tabla no es la excepción: cuelga de `belongs_to_household()` como el resto.
- **AC14**: Given un miembro nuevo que se une al hogar, When entra, Then ve las mediciones históricas del otro — no hay datos que se oculten retroactivamente.

### Edge cases obligatorios

- **AC-E1**: Given un peso imposible (300 kg, 3 kg), When se registra, Then se pide confirmación en vez de rechazarlo — es más probable un typo que un error del usuario, pero rechazar de plano es hostil.
- **AC-E2**: Given una medición con fecha futura, When se intenta guardar, Then no se permite.
- **AC-E3**: Given un hueco de meses en la serie, When se muestra la tendencia, Then no se interpola una línea recta que finja datos que no existen.
- **AC-E4**: Given la primera medición, When se abre la pantalla, Then se muestra el dato sin gráfico — un punto no es una serie.

---

## 4. Out of scope

- ❌ **Integración con balanzas inteligentes.** R-05 y una dependencia de hardware.
- ❌ **% de grasa corporal, IMC como métrica destacada.** El IMC se puede mostrar como dato secundario, pero no es un objetivo.
- ❌ **Objetivos de peso con fecha.** Es una meta, y las metas viven en Entrenamiento (spec 0021).
- ❌ **Recordatorios de pesaje.** Notificación recurrente para una entrada manual: el camino más corto a que se desinstale la app.
- ❌ **Comparar entre miembros.** Las mediciones del otro se pueden ver (AC13), pero la app no pone dos series una al lado de la otra. Ver el progreso de tu pareja para acompañarla es una cosa; una pantalla que las compara es otra.
- ❌ **Ocultar mediciones propias.** Decidido: el hogar comparte todo, sin switch de privacidad. Si algún día hace falta, es una spec nueva y una migración de RLS.

---

## 5. Dependencias

### Specs previas
- 0003 — lugar en la navegación (Cuerpo).
- 0002 — vocabulario de piezas.

### Capacidades del proyecto que se asumen existentes
- Storage para las fotos (el mismo bucket de boletas, con otra ruta).

### Capacidades nuevas requeridas
- Tabla `mediciones`.
- **RLS por hogar**, vía `belongs_to_household()`, igual que todo el resto. Se evaluó hacerla por perfil y se descartó: habría sido la primera excepción del modelo, y la habrían heredado Alimentación y Entrenamiento.
- Suavizado de la serie (media móvil) — función pura con tests.
- `MedicionesRepository`, `MedicionesFacade`.

---

## 6. Datos y modelo

- **Tabla nueva:** `mediciones` (perfil, fecha, peso, cintura, cadera, pecho, brazos, piernas, notas, foto).
- **Modelo UI:** `Medicion`, `SeriePeso`, `TendenciaPeso`.
- **RLS:** por hogar (AC13). El filtro por perfil es de la UI —cada uno ve lo suyo por defecto—, no de la política.
- **Regla:** ninguna otra tabla tiene columna de peso (RN-08). Si aparece una, esta spec falló.

---

## 7. UX y flujos

- **Pantalla:** `/app/cuerpo/mediciones`.
- **Forma:** hero con peso actual, variación desde la última y desde hace un mes + panel con el gráfico y la lista de mediciones.
- **Registrar:** drawer con el peso enfocado y el teclado numérico abierto. Todo lo demás, colapsado. Registrar el peso tiene que costar cuatro toques desde abrir la app.
- **Detalle:** drawer con todas las medidas de esa fecha, notas y foto.
- **Estados:** primera vez, un dato sin gráfico (AC-E4), serie con hueco sin interpolar (AC-E3).

---

## 8. Métricas de éxito post-launch

- Frecuencia de registro por usuario (si cae a cero, la entrada manual no se sostuvo ni con intención).
- % de mediciones con más que el peso (dice si las medidas corporales valen la pena).

---

## 9. Notas / decisiones abiertas

- [x] **AC13 — ¿el otro miembro ve mi peso?** **Sí, compartido como todo lo demás.** El hogar comparte cuenta bancaria y despensa; esconder el peso sería una asimetría rara. La tabla cuelga de `belongs_to_household()` y no hay excepción al modelo — que además habrían heredado Alimentación (0017) y Entrenamiento (0021). El filtro "veo lo mío" es de la UI, no de la política.
- [x] ¿Se pueden comparar las dos series? **No.** Verlas es una cosa; una pantalla que las pone lado a lado es otra. Queda en out-of-scope.
- [x] ¿Qué ventana usa el suavizado? **Media móvil de 7 días.** Es lo habitual y absorbe la oscilación por hidratación sin ocultar una tendencia real.
- [x] ¿El peso vive en una sola tabla? **Sí.** RN-08, sin excepciones.
- [x] ¿Recordatorios? **No.**

---

## Changelog

- 2026-08-11 — draft inicial.
