# Spec 0009 — Catálogo de artículos y alias

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** 🟢 automático (se llena desde boletas y Open Food Facts)
> **Hito:** 2 — boleta → despensa

---

## 1. Contexto de negocio

**Origen:** REQ-020, RN-02, RN-03.

**Persona afectada:** el sistema, antes que el usuario. Es infraestructura de dominio.

**Problema que resuelve:**
Tres módulos futuros necesitan hablar del mismo objeto: la despensa dice *tengo atún*, la
alimentación dice *comí atún y aporta 25 g de proteína*, y el historial de precios dice *el atún
costó $1.890 en Jumbo*. En v1 eso eran dos tablas distintas (`products` y `foods`) que nunca se
pudieron cruzar — el error original del que sale toda la reescritura.

La regla es una: **un sustantivo del negocio se modela una sola vez.** Si dos módulos necesitan la
misma cosa con facetas distintas, se separa la faceta, no se duplica la cosa.

**Hipótesis de valor:**
Si el artículo existe una sola vez, la boleta puebla la despensa y la nutrición sin ninguna
traducción entre módulos. Si existe dos veces, cada módulo empieza a mantener su propia versión y
en seis meses hay que elegir cuál está bien.

---

## 2. User Stories

- **US1**: Como sistema, necesito que un artículo exista una sola vez, para que despensa y nutrición hablen del mismo objeto.
- **US2**: Como usuario, quiero que "COCA COLA 1.5L" de la boleta y "Coca-Cola 1,5 L" del escáner sean el mismo artículo.
- **US3**: Como usuario, quiero corregir un artículo mal resuelto y que el sistema aprenda ese texto para la próxima.
- **US4**: Como usuario, quiero fusionar dos artículos duplicados sin perder lo que ya compré.

---

## 3. Acceptance Criteria (Gherkin)

### Identidad

- **AC1**: Given un artículo, When se crea, Then tiene nombre canónico, marca opcional, código de barras opcional, categoría, `procedencia` y `creado_por`.
- **AC2**: Given un artículo con código de barras, When se busca otro con el mismo código, Then se reconoce como el mismo y no se duplica (RN-02).
- **AC3**: Given un artículo sin código de barras, When se busca, Then se identifica por nombre canónico + marca.
- **AC4**: Given un artículo, When se consulta desde cualquier hogar, Then es visible — el catálogo es **global** (R-02): un código de barras es un hecho del mundo, no de un hogar.

### Alias

- **AC5**: Given un texto de boleta que no resuelve, When el usuario lo asocia a un artículo, Then se crea un alias con origen `boleta` y el `household_id` de quien lo enseñó (RN-03).
- **AC6**: Given un alias con origen `openfoodfacts`, When se crea, Then su `household_id` es nulo — es global.
- **AC7**: Given un alias aprendido, When llega el mismo texto en otra boleta del mismo hogar, Then resuelve solo.
- **AC8**: Given el mismo texto en una boleta de **otro** hogar, When se intenta resolver, Then el alias de origen `boleta` ajeno no se usa (R-06: los alias revelan hábitos de compra).
- **AC9**: Given un texto con variaciones de mayúsculas, acentos o espacios, When se busca su alias, Then matchea igual.

### Faceta nutricional

- **AC10**: Given un artículo que es alimento, When tiene datos nutricionales, Then viven en `articulo_nutricion` 1:1 con macros por 100 g.
- **AC11**: Given un artículo que no es alimento (detergente), When se crea, Then **no** tiene fila de nutrición y eso no es un error ni un estado incompleto.

### Fusión

- **AC12**: Given dos artículos que son el mismo, When se fusionan, Then los alias, las filas de despensa, los precios y los registros de comida del perdedor apuntan al ganador.
- **AC13**: Given una fusión, When ya terminó, Then los registros de comida **conservan sus macros congelados** (RN-04): el martes no cambia porque hoy se fusionaron dos artículos.
- **AC14**: Given una fusión, When se deshace, Then… **no se puede**. Se avisa antes de que es irreversible.

### Edge cases obligatorios

- **AC-E1**: Given un artículo de Open Food Facts con nombre en otro idioma, When se guarda, Then el nombre canónico se puede editar sin perder el vínculo por código de barras.
- **AC-E2**: Given un alias que apunta a un artículo borrado, When se resuelve, Then no rompe la boleta.
- **AC-E3**: Given dos usuarios del mismo hogar creando el mismo artículo a la vez, When ambos confirman, Then el código de barras evita el duplicado.
- **AC-E4**: Given un artículo con procedencia `openfoodfacts` que el usuario corrige, When se guarda, Then su procedencia pasa a `verificado` — la corrección humana gana sobre la fuente externa.

---

## 4. Out of scope

- ❌ **Una pantalla de "administrar catálogo".** El catálogo se llena solo desde boletas y escaneos. Un CRUD de artículos es un formulario que nadie mantiene (R-01). Sólo existe lo que hace falta para corregir y fusionar desde donde el error aparece.
- ❌ **Buscar en Open Food Facts.** Es la spec 0016.
- ❌ **Categorías de artículo editables por el usuario.** Cuatro categorías fijas: alimento, limpieza, medicamento, otro.
- ❌ **Detección automática de duplicados.** Se fusiona a mano cuando molesta; adivinar acá es caro y arriesgado (R-04).

---

## 5. Dependencias

### Specs previas
Ninguna dura. Es la base del hito 2 y va **antes** que la boleta: sin catálogo, la boleta no tiene contra qué resolver.

### Capacidades del proyecto que se asumen existentes
- `unaccent_simple` y `normalizar_comercio` (el mismo problema de normalización ya resuelto para comercios).
- Convenciones de RLS y migraciones del harness.

### Capacidades nuevas requeridas
- Tablas `articulos`, `articulo_alias`, `articulo_nutricion`, `categorias_articulo`.
- **RLS especial:** el catálogo es global (lectura para todos los autenticados, escritura controlada), pero `articulo_alias` con `household_id` no nulo sí es privado. Es la primera tabla del proyecto que no cuelga entera de `belongs_to_household()`.
- Función de normalización de texto de artículo, **sólo en SQL** — igual que con comercios, tenerla también en TS obligaría a que dos implementaciones coincidan para siempre.
- RPC de fusión, atómico.

---

## 6. Datos y modelo

- **Tablas nuevas:** las cuatro de arriba.
- **Modelo UI:** `Articulo`, `AliasArticulo`, `NutricionArticulo`.
- **RLS:** ver arriba — es el punto de más cuidado de esta spec. Un error acá filtra hábitos de compra entre hogares (R-06).
- **Regla:** `ON DELETE` de artículos. El dominio dice que congelar permite podar: los registros de comida congelan macros, así que un artículo se puede borrar sin romper el historial. Las recetas **derivan**, así que ahí sí hace falta `RESTRICT`.

---

## 7. UX y flujos

Esta spec casi no tiene UI propia. Aparece dentro de otras pantallas:

- **Resolver un ítem de boleta** (spec 0010): drawer con búsqueda en el catálogo + "crear artículo nuevo". Confirmar crea el alias.
- **Fusionar**: desde el detalle de un artículo, con aviso de irreversibilidad y conteo de lo que se va a mover.
- **Corregir**: desde donde el artículo se muestre mal (despensa, comida, precio).

---

## 8. Métricas de éxito post-launch

- % de ítems de boleta que resuelven solos (sube con los alias aprendidos).
- Artículos duplicados detectados a mano (debería ser bajo; si es alto, falta normalización).

---

## 9. Notas / decisiones abiertas

- [ ] ¿Quién puede escribir en el catálogo global? Cualquier autenticado es lo simple; con dos usuarios no hay riesgo real, pero deja la puerta abierta si algún día hay más hogares.
- [ ] ¿La categoría del artículo se infiere del texto de la boleta o se pregunta? Inferir con confirmación (R-04).
- [x] ¿Catálogo global o por hogar? **Global** (R-02). Agregar `household_id` después es trivial; deduplicar al revés no.
- [x] ¿Una tabla de alias o dos? **Una**, con `origen` y `household_id` nullable. v1 tenía varias y ninguna se consultaba entera.

---

## Changelog

- 2026-08-11 — draft inicial.
