# Spec 0012 — Consumo inferido por recompra

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟢 automático
> **Hito:** 2 — boleta → despensa

---

## 1. Contexto de negocio

**Origen:** REQ-041, RN-07, R-04.

**Persona afectada:** quien no va a marcar "se acabó" cada vez que termina un frasco.

**Problema que resuelve:**
La despensa (spec 0011) tiene una punta automática —la boleta la llena— y una manual: alguien
tiene que decir que algo se acabó. Y nadie lo hace de forma consistente. A las tres semanas la
despensa dice que hay atún, arroz y salsa de tomate que se comieron hace meses, y una despensa
que miente se deja de mirar.

La salida no es pedir más disciplina: es notar que **volver a comprar algo es evidencia de que se
acabó**. Ese dato ya llega solo, en la boleta siguiente. Con dos o tres ciclos se conoce cada
cuánto se recompra cada cosa, y de ahí sale la sugerencia sin ningún mínimo configurado a mano.

**Hipótesis de valor:**
Si la despensa se corrige sola con la evidencia que ya entra, se mantiene fiel sin trabajo. Y la
cadencia habilita lo siguiente: proponer la lista de compras antes de que falte algo.

---

## 2. User Stories

- **US1**: Como usuario, quiero que el sistema deduzca que algo se terminó sin que yo se lo diga.
- **US2**: Como usuario, quiero que me pregunte si se acabó el atún cuando ya pasó el tiempo que suele durar, no que lo decida solo.
- **US3**: Como usuario, quiero que lo que suelo comprar cada dos semanas se me proponga para la lista antes de que falte.

---

## 3. Acceptance Criteria (Gherkin)

### Cerrar ciclos

- **AC1**: Given un artículo en la despensa, When se vuelve a comprar, Then el ciclo anterior se cierra con la fecha de la recompra y empieza uno nuevo.
- **AC2**: Given un artículo con dos o más ciclos cerrados, When se calcula su cadencia, Then es la mediana de la duración de esos ciclos.
- **AC3**: Given un artículo con un solo ciclo, When se calcula la cadencia, Then **no hay cadencia** — un punto no es una serie, y actuar sobre él es adivinar.
- **AC4**: Given un artículo marcado "se acabó" a mano, When se cierra el ciclo, Then esa fecha es más confiable que la de la recompra y así se registra.

### Preguntar, nunca decidir

- **AC5**: Given un artículo cuya cadencia se superó, When se abre Hoy, Then aparece la pregunta "¿se acabó el atún?" con dos respuestas de un toque.
- **AC6**: Given esa pregunta, When el usuario responde que sí, Then el artículo pasa a `agotado` y el ciclo se cierra con esa fecha.
- **AC7**: Given esa pregunta, When el usuario responde que no, Then el artículo sigue `disponible` y **no se vuelve a preguntar hasta pasada otra cadencia**.
- **AC8**: Given cualquier inferencia, When el usuario no responde, Then el estado **no cambia** (RN-07, R-04). Nunca.
- **AC9**: Given varias preguntas pendientes, When se abre Hoy, Then se muestran de a pocas — preguntar quince cosas de golpe es un formulario disfrazado.

### Sugerir compras

- **AC10**: Given un artículo agotado, When se arma la sugerencia de lista, Then se propone (spec 0013).
- **AC11**: Given un artículo cuya cadencia está por cumplirse, When se arma la sugerencia, Then se propone **antes** de que falte, indicando por qué.
- **AC12**: Given una sugerencia por cadencia, When el usuario la descarta, Then no se repite en ese ciclo.

### Edge cases obligatorios

- **AC-E1**: Given un artículo estacional (pan de pascua), When pasa un año sin comprarlo, Then su cadencia no genera una pregunta absurda cada dos semanas.
- **AC-E2**: Given un artículo comprado dos veces el mismo día (dos boletas), When se calculan ciclos, Then no se cuenta un ciclo de duración cero.
- **AC-E3**: Given un artículo con ciclos muy dispares (1 semana, 6 meses), When se calcula la cadencia, Then la dispersión es tan alta que **no se pregunta**: mejor callarse que preguntar al azar.
- **AC-E4**: Given dos artículos fusionados, When se recalculan ciclos, Then se unifican sin inventar duraciones.

---

## 4. Out of scope

- ❌ **Cambiar el estado sin preguntar.** RN-07 y R-04. No es una decisión de producto discutible: un sistema que se equivoca sin avisar deja de merecer confianza, y recuperarla cuesta más que haber preguntado.
- ❌ **Inferir consumo desde registros de comida.** El dominio lo lista como evidencia secundaria; entra recién cuando exista Alimentación (hito 3) y haya datos para calibrar.
- ❌ **Predecir cantidades.** No hay cantidades (R-03).
- ❌ **Aprendizaje entre hogares.** R-06.

---

## 5. Dependencias

### Specs previas
- 0011 — la despensa y su log. **Bloqueante duro.**
- 0010 — sin boletas repetidas no hay ciclos.
- 0003 — las preguntas viven en Hoy.
- **Bloqueante blando y real:** esto necesita **meses de datos** para que la cadencia signifique algo. Se puede construir antes, pero no se puede validar. Está declarado como riesgo en `context/brief.md`.

### Capacidades del proyecto que se asumen existentes
- `movimientos_despensa` como log con fechas y orígenes.

### Capacidades nuevas requeridas
- Cálculo de ciclos y cadencia — **función pura con tests** sobre series sintéticas, que es la única forma de probarlo sin esperar meses.
- Umbral de dispersión bajo el cual no se pregunta (AC-E3).
- Registro de preguntas hechas y respondidas, para no repetirlas (AC7, AC12).
- Modelo de "pendiente" que Hoy consume (spec 0003).

---

## 6. Datos y modelo

- **Tablas:** puede alcanzar con derivar todo de `movimientos_despensa`, o convenir una tabla de ciclos materializados. Decidir en el plan según cuánto cueste la consulta.
- **Nueva:** registro de preguntas emitidas y su respuesta.
- **Modelo UI:** `CadenciaArticulo`, `PreguntaDespensa`.
- **Regla:** la cadencia se **deriva** del log. Si se materializa, es caché y se puede recalcular.

---

## 7. UX y flujos

- **Dónde vive:** en Hoy, como pendientes. No hay pantalla de "inferencias".
- **La pregunta:** una línea, dos botones. "¿Se acabó el atún? Lo compraste hace 5 semanas y suele durarte 3." El *por qué* va incluido: sin él parece que la app adivina.
- **Dosificación:** pocas por vez (AC9).
- **En la despensa:** un artículo con sospecha de agotado se marca distinto de uno confirmado — el usuario ve que el sistema *cree* algo sin que lo haya decidido.

---

## 8. Métricas de éxito post-launch

- % de preguntas respondidas (si es bajo, molestan y hay que bajar la frecuencia).
- % respondidas "sí" — **mide si la inferencia acierta**. Bajo 60%, la cadencia no sirve y hay que subir el umbral.
- Artículos con cadencia conocida.

---

## 9. Notas / decisiones abiertas

- [ ] ¿Cuántos ciclos hacen falta? El dominio dice "dos o tres". Empezar con 3 y bajar si tarda demasiado en ser útil.
- [ ] ¿Qué umbral de dispersión calla la pregunta (AC-E3)? Calibrar con datos reales.
- [ ] ¿La cadencia se recalcula en cada boleta o por job? Con un hogar, en cada boleta alcanza.
- [x] ¿Puede cambiar el estado sola? **No.** RN-07.
- [x] ¿Un solo ciclo genera cadencia? **No.** Un punto no es una serie.

---

## Changelog

- 2026-08-11 — draft inicial.
