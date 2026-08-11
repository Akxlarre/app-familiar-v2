# Spec 0016 — Open Food Facts

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🔵 un gesto (escanear)
> **Hito:** 3 — cuerpo y alimentación

---

## 1. Contexto de negocio

**Origen:** REQ-021, RB-02.

**Persona afectada:** quien quiere registrar lo que comió sin tipear macros.

**Problema que resuelve:**
Registrar una comida exige saber cuántas calorías y macros tiene el alimento. Pedirle eso al
usuario es "manual sin retorno" en su forma más pura: nadie sostiene tipear los macros de un yogur.

Open Food Facts es una base abierta con millones de productos indexados por código de barras.
Escanear es un gesto de dos segundos que trae nombre, marca y macros completos. Es lo que hace
que toda la spec 0017 sea posible.

También completa el catálogo por el otro lado: la boleta (0010) da los alias reales del hogar
—"COCA COLA 1.5L"— y el escaneo da la identidad y los macros. Se juntan en el mismo artículo.

**Hipótesis de valor:**
Si escanear un código de barras crea el artículo con sus macros, registrar una comida es elegir de
una lista corta y no llenar un formulario nutricional.

---

## 2. User Stories

- **US1**: Como usuario, quiero escanear un código de barras y que el alimento aparezca con sus macros.
- **US2**: Como usuario, quiero buscar por texto cuando el producto no tiene código o no está.
- **US3**: Como usuario, quiero que lo escaneado se sume al mismo catálogo que usa la despensa.
- **US4**: Como usuario, quiero corregir los macros cuando la base está mal, y que mi corrección gane.

---

## 3. Acceptance Criteria (Gherkin)

### Buscar

- **AC1**: Given un código de barras, When se consulta, Then se prioriza la instancia chilena y se cae a la global si no está (RB-02).
- **AC2**: Given un texto, When se busca, Then se devuelven resultados con nombre, marca e imagen.
- **AC3**: Given un producto encontrado, When se guarda, Then entra al catálogo con `procedencia = openfoodfacts` y su faceta nutricional (spec 0009).
- **AC4**: Given un producto ya existente con ese código de barras, When se escanea de nuevo, Then **no se duplica**: se usa el que ya está (RN-02).
- **AC5**: Given un producto sin datos nutricionales en la base, When se guarda, Then el artículo se crea igual, sin faceta nutricional — es válido (AC11 de la spec 0009).

### Escanear

- **AC6**: Given la cámara del navegador, When se apunta a un código, Then se lee sin instalar nada (R-05: nada de Capacitor).
- **AC7**: Given un escaneo fallido, When no se reconoce, Then se ofrece escribir el código a mano o buscar por texto.
- **AC8**: Given un dispositivo sin cámara o sin permiso, When se abre el escáner, Then se explica y se ofrece la búsqueda por texto.

### Corregir

- **AC9**: Given un artículo de Open Food Facts con datos malos, When el usuario los corrige, Then la procedencia pasa a `verificado` y la corrección no se sobrescribe en consultas futuras.
- **AC10**: Given un artículo corregido, When se vuelve a escanear su código, Then se devuelve la versión corregida, no la de la base externa.

### Edge cases obligatorios

- **AC-E1**: Given Open Food Facts caído o lento, When se consulta, Then hay timeout y se ofrece crear el artículo a mano — la app no se cuelga esperando a un tercero.
- **AC-E2**: Given un producto con macros por porción y no por 100 g, When se guarda, Then se normaliza a 100 g o se descarta el dato; guardarlo sin saber la unidad es peor que no guardarlo.
- **AC-E3**: Given un nombre en otro idioma, When se guarda, Then se puede editar sin perder el vínculo por código de barras.
- **AC-E4**: Given un código de barras de un producto que no es alimento, When se escanea, Then se crea el artículo con su categoría y sin nutrición.

---

## 4. Out of scope

- ❌ **Contribuir de vuelta a Open Food Facts.** Sería lo correcto con la comunidad, pero implica exponer datos del hogar (R-06). Se evalúa aparte.
- ❌ **Descargar el dump completo.** Millones de productos para dos usuarios.
- ❌ **Scoring nutricional (Nutri-Score, NOVA).** La base lo trae; mostrarlo es otra spec, y opinar sobre lo que come el usuario no es el trabajo de esta app.
- ❌ **Escanear boletas con este escáner.** La boleta es OCR de foto (spec 0010).

---

## 5. Dependencias

### Specs previas
- 0009 — el artículo y su faceta nutricional. **Bloqueante duro.**

### Capacidades del proyecto que se asumen existentes
- Catálogo con procedencia y alias.

### Capacidades nuevas requeridas
- Edge function que consulte Open Food Facts (la clave: **no** desde el cliente, para poder cachear y no exponer patrones de consumo).
- Lector de códigos de barras vía web API (`BarcodeDetector` con fallback a librería).
- Caché de respuestas por código de barras.
- Normalización de macros a 100 g.

---

## 6. Datos y modelo

- **Tablas:** las de la spec 0009. Puede convenir cachear la respuesta cruda para no re-consultar.
- **Modelo UI:** `ResultadoBusquedaAlimento`.
- **Privacidad:** consultar desde el servidor evita que Open Food Facts vea qué come esta familia (R-06).

---

## 7. UX y flujos

- **Dónde vive:** no tiene pantalla propia. Es un buscador que aparece al agregar un alimento (spec 0017) o al resolver un ítem de boleta (spec 0010).
- **Forma:** drawer con dos modos — escanear (por defecto en móvil) y buscar por texto.
- **Escanear:** la cámara ocupa la pantalla, con el resultado apareciendo abajo. Confirmar con un toque.
- **Estados:** buscando, sin resultados con opción de crear a mano, servicio caído con la misma salida.

---

## 8. Métricas de éxito post-launch

- % de alimentos que entran por escaneo vs. a mano.
- % de escaneos que encuentran el producto (si es bajo en Chile, RB-02 no alcanza y hay que replantear).

---

## 9. Notas / decisiones abiertas

- [ ] ¿`BarcodeDetector` alcanza? Está en Chrome/Android; Safari iOS no lo tiene. Va a hacer falta un fallback en JS.
- [ ] ¿Se cachea la respuesta cruda o sólo lo mapeado? Cruda permite re-mapear si cambia el criterio, y ocupa poco.
- [x] ¿Consulta desde el cliente o desde el servidor? **Servidor.** Cachea y no expone patrones de consumo.
- [x] ¿Qué gana, la base o la corrección del usuario? **La corrección** (`verificado`).

---

## Changelog

- 2026-08-11 — draft inicial.
