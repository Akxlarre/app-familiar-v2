# Spec 0014 — Historial de precios

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟢 automático
> **Hito:** 2 — boleta → despensa

---

## 1. Contexto de negocio

**Origen:** REQ-043.

**Persona afectada:** quien decide dónde comprar.

**Problema que resuelve:**
Los precios en Chile se mueven mucho y nadie los recuerda. La pregunta *"¿esto siempre costó
esto?"* y *"¿me conviene el Jumbo o el Líder?"* no tienen respuesta hoy, aunque el dato esté: cada
boleta confirmada trae precio por artículo y comercio.

Esta spec es casi gratis: los datos ya se escriben en la spec 0010. Lo único que falta es
mirarlos. Por eso es P2 y no P0 — no habilita nada más, es puro rédito.

**Hipótesis de valor:**
Ver que el aceite subió 40% en cuatro meses, o que un producto está sistemáticamente más barato
en otro supermercado, es información que ninguna app entrega y que sale de un gesto ya hecho.

---

## 2. User Stories

- **US1**: Como usuario, quiero ver cómo evolucionó el precio de lo que compro seguido.
- **US2**: Como usuario, quiero saber en qué supermercado me conviene comprar algo.
- **US3**: Como usuario, quiero que me avise si algo subió mucho desde la última vez.

---

## 3. Acceptance Criteria (Gherkin)

### Registrar

- **AC1**: Given una boleta confirmada, When se procesa, Then se registra un precio observado por cada ítem resuelto, con artículo, comercio, precio y fecha.
- **AC2**: Given un ítem sin artículo resuelto, When se confirma la boleta, Then **no** se registra precio — un precio sin artículo no se puede comparar con nada.
- **AC3**: Given un ítem con cantidad mayor a uno, When se registra el precio, Then se guarda el unitario, no el total de la línea.

### Mirar

- **AC4**: Given un artículo con dos o más precios observados, When se abre su detalle, Then se ve la evolución en el tiempo.
- **AC5**: Given un artículo comprado en varios comercios, When se abre, Then se ve el precio por comercio y cuál sale más barato.
- **AC6**: Given un artículo con un solo precio, When se abre, Then se muestra ese precio sin dibujar una tendencia — un punto no es una serie.
- **AC7**: Given el historial, When se compara, Then los montos van en pesos sin decimales (RB-04).

### Avisar

- **AC8**: Given un artículo cuyo precio subió por sobre un umbral respecto de su mediana, When se confirma la boleta, Then se destaca en el resumen de esa boleta.
- **AC9**: Given ese aviso, When se muestra, Then dice el porcentaje y la referencia ("$2.490, un 38% más que las últimas veces").

### Edge cases obligatorios

- **AC-E1**: Given una oferta puntual, When entra al historial, Then no distorsiona la referencia — por eso se usa mediana y no promedio.
- **AC-E2**: Given un artículo cuyo formato cambió (1 L → 900 ml), When se compara el precio, Then se compara igual pero **no** se calcula precio por unidad de medida: la boleta no trae el gramaje de forma confiable.
- **AC-E3**: Given un OCR que leyó mal un precio (un cero de más), When entra al historial, Then el aviso de variación lo delata en vez de contaminar la serie en silencio.
- **AC-E4**: Given dos artículos fusionados, When se consulta el historial, Then las series se unen.

---

## 4. Out of scope

- ❌ **Comparar con precios de internet o scrapers de supermercados.** Otro producto.
- ❌ **Precio por kilo / litro.** Requiere gramaje confiable, que la boleta no da (AC-E2).
- ❌ **Predecir precios futuros.** No.
- ❌ **Compartir precios entre hogares.** R-06 — aunque sería lo más útil de todo, revela hábitos de compra.
- ❌ **Editar un precio a mano.** Si el OCR falló, se corrige la boleta, no el historial.

---

## 5. Dependencias

### Specs previas
- 0010 — la boleta escribe los precios. **Bloqueante duro.**
- 0009 — sin artículo resuelto no hay precio comparable.

### Capacidades del proyecto que se asumen existentes
- Confirmación de boleta como RPC atómico.

### Capacidades nuevas requeridas
- Tabla `precios_observados`.
- Cálculo de mediana y variación — función pura con tests.
- Vista de evolución (un sparkline alcanza; `sparkline.utils.ts` ya existe).

---

## 6. Datos y modelo

- **Tabla nueva:** `precios_observados` (artículo, comercio, precio, fecha, boleta de origen).
- **Modelo UI:** `PrecioObservado`, `EvolucionPrecio`, `ComparativaComercio`.
- **Regla:** es un log inmutable. No se edita ni se borra fila por fila; si una boleta se borra, se borran sus precios con ella.

---

## 7. UX y flujos

- **No tiene pantalla propia de primer nivel.** Vive en tres lugares:
  1. **Detalle de artículo** (desde despensa o lista): evolución y comparativa por comercio.
  2. **Resumen de boleta confirmada**: qué subió respecto de las veces anteriores.
  3. **Sección Casa → Precios**: los artículos que más subieron, para quien quiera mirar.
- **Forma:** sparkline en la fila, gráfico simple en el detalle. Nada de dashboards.
- **Estados:** con un solo dato, se muestra el dato (AC6). Sin datos, se explica que se llena con las boletas.

---

## 8. Métricas de éxito post-launch

- Artículos con 3+ observaciones (masa crítica para que sirva).
- Aperturas del detalle de precio.

---

## 9. Notas / decisiones abiertas

- [ ] 🌍 ¿Qué umbral de variación dispara el aviso (AC8)? 25% es un punto de partida; calibrar con datos.
  <br>🔓 **Se desbloquea con:** ~3 meses de precios observados. Arranca en 25% y se calibra midiendo cuántos avisos serían ruido.
- [ ] 🌍 ¿La comparativa por comercio necesita mínimo de observaciones por comercio? Con una sola compra en un supermercado, decir "acá es más barato" es ruido.
  <br>🔓 **Se desbloquea con:** datos de 2+ supermercados. Sin saber cuántas compras hay por comercio, cualquier mínimo es inventado.
- [x] ¿Mediana o promedio? **Mediana.** Una oferta puntual no puede mover la referencia.
- [x] ¿Precio por kilo? **No.** La boleta no trae gramaje confiable.

---

## Changelog

- 2026-08-11 — draft inicial.
