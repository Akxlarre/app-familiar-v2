# Spec 0017 — Registrar una comida

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🔵 un gesto
> **Hito:** 3 — cuerpo y alimentación

---

## 1. Contexto de negocio

**Origen:** REQ-050, RN-04.

**Persona afectada:** cada miembro por separado.

**Problema que resuelve:**
Registrar comidas es, de todas las apps que existen, la que más gente instala y la que más gente
abandona. La razón siempre es la misma: buscar en un catálogo de millones para encontrar "arroz",
y hacerlo tres veces al día.

Este producto tiene una ventaja que las otras no: **sabe qué hay en la casa** (spec 0011). El
selector no arranca de un catálogo global, arranca de la despensa — que son treinta artículos, no
tres millones. Y lo que se come dos veces por semana se repite de un toque.

Es la spec donde R-01 se pone más a prueba de todo el proyecto. Si esto termina siendo un
formulario, no entra.

**Hipótesis de valor:**
Si registrar el almuerzo cuesta dos toques porque el arroz y el pollo ya están en la despensa y la
combinación se guardó la semana pasada, se sostiene. Si cuesta buscar en un catálogo, no.

---

## 2. User Stories

- **US1**: Como usuario, quiero registrar lo que comí eligiendo de una lista corta, no buscando en un catálogo de millones.
- **US2**: Como usuario, quiero repetir una comida que ya registré, en un toque.
- **US3**: Como usuario, quiero escanear un código de barras cuando como algo envasado.
- **US4**: Como usuario, quiero ver cuánto llevo del día contra mi objetivo.

---

## 3. Acceptance Criteria (Gherkin)

### Elegir rápido

- **AC1**: Given el selector de alimentos, When se abre, Then lo primero que ofrece es lo que hay en la despensa (spec 0011).
- **AC2**: Given el selector, When se abre, Then lo segundo son las comidas guardadas y lo comido recientemente.
- **AC3**: Given el catálogo global, When se busca por texto, Then aparece **después** de lo anterior, no como opción principal.
- **AC4**: Given un código de barras, When se escanea, Then el alimento se agrega directo (spec 0016).

### Registrar

- **AC5**: Given un alimento elegido, When se registra, Then se guarda con fecha, momento del día, cantidad y unidad.
- **AC6**: Given ese registro, When se guarda, Then **congela sus macros** calculados (RN-04): si mañana se corrige el alimento, el martes no cambia.
- **AC7**: Given un registro, When se corrige o borra, Then el total del día se recalcula.
- **AC8**: Given una comida de varios alimentos, When se registra, Then se pueden guardar juntos como comida guardada para repetir después.

### Repetir

- **AC9**: Given una comida guardada, When se toca, Then se registra completa en un toque, con la fecha y el momento actuales.
- **AC10**: Given una comida repetida, When se registra, Then congela los macros del momento — no reusa los congelados de la vez anterior, porque el alimento pudo corregirse.

### El día

- **AC11**: Given los registros del día, When se abre Alimentación, Then se ve el total de calorías y macros contra el objetivo (spec 0018).
- **AC12**: Given un día sin objetivo definido, When se abre, Then se muestran los totales sin objetivo, sin bloquear el registro.
- **AC13**: Given los registros, When se muestran, Then van agrupados por momento del día.

### Edge cases obligatorios

- **AC-E1**: Given un alimento sin datos nutricionales, When se registra, Then se registra igual y se dice que no aporta al total — comer algo no debería depender de que la base lo conozca.
- **AC-E2**: Given una cantidad en unidades no convertibles ("1 plato"), When se registra, Then se pide gramos o se acepta sin macros; no se inventa una equivalencia.
- **AC-E3**: Given un registro de ayer que se agrega hoy, When se elige la fecha, Then se puede, sin fricción.
- **AC-E4**: Given un alimento borrado del catálogo, When se mira un registro viejo, Then sigue mostrando sus macros congelados (RN-04 en acción).

---

## 4. Out of scope

- ❌ **Fotografiar el plato para estimar calorías.** Tecnología poco confiable y una promesa que no se puede cumplir.
- ❌ **Base de datos de restaurantes / platos preparados.** Otro producto.
- ❌ **Micronutrientes.** Calorías y macros. Agregar vitaminas multiplica la entrada de datos por diez.
- ❌ **Objetivos por macro configurables al detalle.** El reparto vive en el perfil (spec 0018).
- ❌ **Recordatorios de registrar.** Notificación recurrente para entrada manual: no.
- ❌ **Recetas como fuente de un registro.** Es la spec 0019.

---

## 5. Dependencias

### Specs previas
- 0009 — el catálogo. **Bloqueante duro.**
- 0011 — la despensa alimenta el selector. **Bloqueante duro:** sin ella, esta spec es una app de conteo de calorías más, y ya sabemos cómo termina.
- 0016 — el escaneo. No bloqueante.

### Capacidades del proyecto que se asumen existentes
- Catálogo con faceta nutricional, despensa.

### Capacidades nuevas requeridas
- Tablas `registro_comida`, `comidas_guardadas`, `items_comida_guardada`.
- **RLS por hogar**, coherente con la decisión de la spec 0015. La UI filtra por perfil; la política no.
- Cálculo de macros por cantidad — función pura con tests.
- Selector de alimentos con las cuatro fuentes priorizadas (AC1-AC4).

---

## 6. Datos y modelo

- **Tablas nuevas:** las tres de arriba.
- **Modelo UI:** `RegistroComida`, `ComidaGuardada`, `TotalesDia`.
- **Regla dura:** `registro_comida` **congela** macros (RN-04). Es un evento. Las recetas derivan porque son definiciones (spec 0019).
- **Corolario:** congelar permite podar el catálogo. Si los registros derivaran, habría `ON DELETE RESTRICT` para siempre sobre un catálogo alimentado por OCR y Open Food Facts, que va a acumular basura.

---

## 7. UX y flujos

- **Pantalla:** `/app/cuerpo/comidas`.
- **Forma:** hero con el total del día contra el objetivo + panel con los registros agrupados por momento.
- **Registrar:** botón siempre visible. Drawer con el selector: despensa arriba, guardadas después, búsqueda al final, escáner en un tab.
- **Cantidad:** por defecto una porción razonable, ajustable. Que el default sea bueno es lo que hace que el registro cueste dos toques.
- **Estados:** día vacío sin culpa; sin despensa, el selector cae a búsqueda y se explica que se llena con las boletas.

---

## 8. Métricas de éxito post-launch

- **La métrica que decide si esta spec sobrevive:** días con al menos un registro, en la semana 4. Si cae, R-01 tenía razón.
- % de registros que vienen de despensa o comida guardada vs. búsqueda global — mide si la hipótesis central es cierta.
- Toques promedio por registro (objetivo: ≤ 3).

---

## 9. Notas / decisiones abiertas

- [x] ¿Momento del día fijo o libre? **Fijo: desayuno, almuerzo, once, cena y snack.** Menos decisiones al registrar y agrupa bien la pantalla del día. "Once" es chileno y no puede faltar.
- [x] ¿La despensa se ordena por lo más comido o por lo más reciente? **Por lo más comido, con lo reciente como desempate.** Converge rápido a las quince cosas que uno come siempre.
- [x] ¿Congelan o derivan? **Congelan.** RN-04, y habilita podar el catálogo.
- [x] ¿Micronutrientes? **No.**

---

## Changelog

- 2026-08-11 — draft inicial.
