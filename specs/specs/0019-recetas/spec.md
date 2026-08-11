# Spec 0019 — Recetas

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟡 manual, una vez por receta
> **Hito:** 3 — cuerpo y alimentación

---

## 1. Contexto de negocio

**Origen:** REQ-052, RN-05.

**Persona afectada:** quien cocina.

**Problema que resuelve:**
Una casa cocina las mismas quince cosas. Registrar "tallarines con salsa" como cinco alimentos
sueltos, cada vez, es trabajo repetido — y la comida guardada de la spec 0017 lo resuelve a
medias: repite lo que se comió, pero no sabe qué lleva ni cuánto rinde.

La receta es lo que convierte esos quince platos en objetos con ingredientes, y eso habilita lo
único realmente valioso: saber **qué se puede cocinar con lo que hay en casa** (spec 0020).

El costo de entrada es honesto: escribir una receta es un formulario. Pero se paga **una vez por
receta**, no cada vez que se cocina, y el usuario ya está motivado cuando lo hace. Es "manual con
intención" en el límite de lo aceptable.

**Hipótesis de valor:**
Quince recetas escritas una vez permiten sugerir qué cocinar todos los días sin que nadie planifique nada.

---

## 2. User Stories

- **US1**: Como usuario, quiero guardar las recetas que hago siempre, con sus ingredientes.
- **US2**: Como usuario, quiero ver los macros de una receta sin tipearlos.
- **US3**: Como usuario, quiero saber cuántos ingredientes tengo en casa antes de decidir cocinarla.
- **US4**: Como usuario, quiero registrar que comí una porción de una receta, sin desglosarla.

---

## 3. Acceptance Criteria (Gherkin)

### Definir

- **AC1**: Given una receta, When se crea, Then tiene nombre, porciones que rinde, ingredientes con cantidad y unidad, y pasos opcionales.
- **AC2**: Given un ingrediente, When se agrega, Then apunta al catálogo de artículos (spec 0009), no a texto libre.
- **AC3**: Given una receta, When se guarda, Then **no almacena macros** (RN-05).

### Derivar

- **AC4**: Given una receta con ingredientes del catálogo, When se consultan sus macros, Then se **derivan** de los ingredientes y sus cantidades.
- **AC5**: Given una receta que rinde N porciones, When se muestran los macros, Then se muestran por porción y del total.
- **AC6**: Given un ingrediente sin datos nutricionales, When se derivan los macros, Then se dice que el cálculo es parcial y qué ingrediente falta — no se muestra un número incompleto como si fuera exacto.
- **AC7**: Given un ingrediente cuyos datos se corrigen, When se consulta la receta, Then los macros reflejan la corrección (es una definición, deriva).

### Contra la despensa

- **AC8**: Given una receta y la despensa, When se abre, Then se ve cuántos ingredientes están disponibles y cuáles faltan.
- **AC9**: Given los ingredientes que faltan, When el usuario lo pide, Then se mandan a la lista de compras (spec 0013).

### Cocinar y registrar

- **AC10**: Given una receta, When el usuario registra que comió una porción, Then se crea un registro de comida que **congela** los macros de esa porción (RN-04).
- **AC11**: Given ese registro, When después se corrige un ingrediente, Then el registro **no** cambia — congela, aunque la receta derive.

### Edge cases obligatorios

- **AC-E1**: Given un ingrediente en unidad no convertible ("2 dientes de ajo"), When se derivan macros, Then se acepta la unidad y el aporte se omite o se estima con una equivalencia declarada, nunca inventada en silencio.
- **AC-E2**: Given un artículo usado en una receta, When se intenta borrar del catálogo, Then se impide o se avisa: las recetas derivan y necesitan `ON DELETE RESTRICT`.
- **AC-E3**: Given una receta sin ingredientes, When se guarda, Then se permite como borrador pero no aporta macros ni sugerencias.
- **AC-E4**: Given dos artículos fusionados (spec 0009), When se miran las recetas que los usaban, Then apuntan al ganador sin duplicar ingredientes.

---

## 4. Out of scope

- ❌ **Importar recetas de sitios web.** Scraping, formatos, mantenimiento. Otro producto.
- ❌ **Escalar porciones dinámicamente** al cocinar. Se puede después; no es lo que habilita la 0020.
- ❌ **Fotos paso a paso, tiempos, dificultad.** La receta acá existe para saber qué lleva, no para reemplazar un recetario.
- ❌ **Compartir recetas.** R-06.
- ❌ **Sugerencias.** Es la spec 0020.

---

## 5. Dependencias

### Specs previas
- 0009 — el catálogo. **Bloqueante duro.**
- 0011 — la despensa, para AC8.
- 0017 — el registro de comida, para AC10.

### Capacidades del proyecto que se asumen existentes
- Catálogo con faceta nutricional, despensa, registro de comida.

### Capacidades nuevas requeridas
- Tablas `recetas` e `ingredientes_receta` — **sin columnas nutricionales** en `recetas`.
- Derivación de macros con conversión de unidades — función pura con tests, incluyendo el caso parcial (AC6).
- Cruce receta ↔ despensa (AC8).

---

## 6. Datos y modelo

- **Tablas nuevas:** `recetas`, `ingredientes_receta`.
- **Prohibido:** cualquier columna de calorías o macros en `recetas` (RN-05).
- **`ON DELETE RESTRICT`** desde `ingredientes_receta` hacia `articulos` (AC-E2). Es el único lugar del proyecto donde hace falta, y es el precio de derivar.
- **Modelo UI:** `Receta`, `IngredienteReceta`, `MacrosDerivados`, `DisponibilidadReceta`.

---

## 7. UX y flujos

- **Pantalla:** `/app/cuerpo/recetas` (o dentro de Alimentación, según lo que decida la spec 0003).
- **Forma:** panel con una fila por receta, mostrando macros por porción y **cuántos ingredientes hay en casa** — que es el dato que decide.
- **Crear:** drawer con nombre, porciones y una lista de ingredientes que se agregan con el mismo selector de la spec 0017 (despensa primero).
- **Detalle:** macros derivados con su desglose, ingredientes marcados según disponibilidad, y dos acciones: "mandar lo que falta a la lista" y "comí una porción".
- **Estados:** cálculo parcial señalado (AC6), receta sin ingredientes como borrador.

---

## 8. Métricas de éxito post-launch

- Recetas creadas por hogar (esperado: 10–20, y después meseta).
- % de recetas que se usan para registrar comidas.
- Recetas con macros completos vs. parciales.

---

## 9. Notas / decisiones abiertas

- [ ] 🤖 ¿Cómo se manejan las unidades no convertibles (AC-E1)? Una tabla de equivalencias declaradas ("1 diente de ajo = 3 g") es lo honesto, y se puede empezar con las diez más comunes.
- [ ] 🧑 ¿Las recetas son del hogar o del perfil? Del hogar: se cocina para los dos.
- [x] ¿Las recetas guardan macros? **No.** RN-05, y es el complemento exacto de RN-04.
- [x] ¿Ingredientes de texto libre? **No.** Sin catálogo no hay macros ni cruce con la despensa, y entonces la receta no sirve para nada más que leerla.

---

## Changelog

- 2026-08-11 — draft inicial.
