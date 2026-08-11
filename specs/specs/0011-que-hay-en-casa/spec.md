# Spec 0011 — Qué hay en casa

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** 🟢 automático
> **Hito:** 2 — boleta → despensa

---

## 1. Contexto de negocio

**Origen:** REQ-040, RN-06, R-03.

**Persona afectada:** quien está en el supermercado preguntándose si queda atún.

**Problema que resuelve:**
Todas las apps de despensa fracasan por la misma razón: piden inventariar. Y el inventario es la
forma más pura de "manual sin retorno" — hay que registrar lo que entra **y** lo que sale, todos
los días, para siempre.

Acá la entrada es automática (la boleta la escribe) y la salida se **infiere o se toca una vez**.
Por eso la despensa guarda **presencia, no cantidad**: un contador necesita las dos puntas, y con
una sola punta automática deriva siempre hacia arriba hasta que miente. Y una despensa que miente
es peor que no tener despensa, porque se deja de mirar.

**Hipótesis de valor:**
Saber si hay atún sin haber registrado que se compró es un dato que hoy no existe en ninguna
parte, y sale gratis de un gesto que ya se hizo por otro motivo (la boleta, spec 0010).

---

## 2. User Stories

- **US1**: Como usuario, quiero saber si tengo atún sin haber registrado que lo compré.
- **US2**: Como usuario en el supermercado, quiero mirar la despensa en el teléfono y decidir.
- **US3**: Como usuario, quiero marcar "se acabó" en un toque cuando uso lo último.
- **US4**: Como usuario, quiero ver cuándo compré algo por última vez.
- **US5**: Como usuario, quiero saber qué está por vencerse.

---

## 3. Acceptance Criteria (Gherkin)

### Se llena sola

- **AC1**: Given una boleta confirmada, When se procesa, Then sus artículos resueltos entran a la despensa como `disponible` con la fecha de esa compra.
- **AC2**: Given un artículo que ya estaba en la despensa, When se vuelve a comprar, Then se actualiza su última compra y **no** se crea una fila duplicada.
- **AC3**: Given un artículo agotado que se vuelve a comprar, When entra la boleta, Then vuelve a `disponible` y se cierra el ciclo anterior (base de la spec 0012).
- **AC4**: Given cada cambio de estado, When ocurre, Then queda registrado en el log con su origen (compra, agotado, confirmación, descarte).

### Estado, no cantidad

- **AC5**: Given un artículo en la despensa, When se consulta, Then tiene exactamente uno de tres estados: `disponible`, `por_acabarse`, `agotado`.
- **AC6**: Given la despensa, When se busca una cantidad, Then **no existe** — ninguna pantalla, modelo ni columna la expone (R-03).
- **AC7**: Given un artículo disponible, When el usuario toca "se acabó", Then pasa a `agotado` en un toque, sin confirmación ni formulario.
- **AC8**: Given un artículo agotado, When se mira la despensa por defecto, Then no aparece entre lo disponible, pero sigue existiendo para la lista de compras y la cadencia.

### Mirar

- **AC9**: Given la despensa, When se abre, Then se ve agrupada por categoría y ordenada de forma útil en el supermercado.
- **AC10**: Given un artículo, When se abre su detalle, Then se ve última compra, dónde se compró, precio de esa vez y su historial de estados.
- **AC11**: Given una búsqueda por texto, When se escribe "atun" sin tilde, Then encuentra "Atún".
- **AC12**: Given un artículo con vencimiento cargado, When se acerca la fecha, Then se destaca y aparece como pendiente en Hoy.

### Los dos miembros

- **AC13**: Given dos miembros mirando la despensa, When uno marca algo como agotado, Then el otro lo ve sin recargar (RNF-01, spec 0022).

### Edge cases obligatorios

- **AC-E1**: Given un artículo marcado agotado por error, When el usuario lo deshace, Then vuelve a `disponible` y el log conserva ambos eventos.
- **AC-E2**: Given una boleta que se borra, When se recalcula, Then la despensa no queda con artículos fantasma.
- **AC-E3**: Given dos artículos fusionados (spec 0009), When ambos estaban en la despensa, Then queda una sola fila con el estado más reciente.
- **AC-E4**: Given un artículo que no es alimento (detergente), When entra a la despensa, Then funciona igual — la despensa no es sólo comida.

---

## 4. Out of scope

- ❌ **Cantidades, mínimos, unidades** (R-03, RN-06). Cualquier feature que necesite "cuántos quedan" está mal planteada: se reformula en presencia y cadencia.
- ❌ **Ubicación física detallada** (estante, repisa). El modelo tiene `ubicacion`; si nadie la llena, se corta.
- ❌ **Vencimiento automático desde la boleta.** La boleta no lo trae. Se carga a mano cuando importa (lácteos) o no se carga.
- ❌ **Inferir consumo.** Es la spec 0012.
- ❌ **Agregar artículos a la despensa a mano sin boleta.** Se evalúa después: si se necesita seguido, es señal de que la boleta no se está usando.

---

## 5. Dependencias

### Specs previas
- 0009 — el artículo tiene que existir. **Bloqueante duro.**
- 0010 — sin boleta la despensa se queda vacía. **Bloqueante duro:** construir la despensa antes que la boleta produce una pantalla vacía sin forma de llenarla, que es exactamente el error de v1.

### Capacidades del proyecto que se asumen existentes
- Catálogo y alias (0009), confirmación de boleta (0010).
- `search-filter.utils.ts` para la búsqueda normalizada.

### Capacidades nuevas requeridas
- Tablas `despensa` y `movimientos_despensa`.
- `DespensaRepository`, `DespensaFacade`.
- Realtime en `despensa` (AC13).

---

## 6. Datos y modelo

- **Tablas nuevas:** `despensa` (artículo, estado, ubicación, vencimiento, última compra), `movimientos_despensa` (log con tipo de evento y origen).
- **Modelo UI:** `ItemDespensa`, `EstadoDespensa`, `EventoDespensa`.
- **Regla dura:** ninguna columna de cantidad. Ni `quantity`, ni `stock_minimum`, ni `unidades`. Si alguien la agrega, viola R-03 y RN-06.
- **El log es la fuente de la cadencia** (spec 0012): sin él, inferir consumo es imposible.

---

## 7. UX y flujos

- **Pantalla:** `/app/casa/despensa`.
- **Forma:** hero con disponibles, por acabarse y agotados + panel agrupado por categoría.
- **Fila:** nombre, marca, última compra. Y **un solo control**: "se acabó". Nada de menús de tres puntos con cinco opciones.
- **Uso real:** esto se mira en el supermercado, con una mano, con mala señal. El texto tiene que ser legible sin acercar el teléfono y la búsqueda tiene que estar arriba.
- **Estados:** vacío explicando que se llena sola con la primera boleta, con acceso directo a sacar la foto.

---

## 8. Métricas de éxito post-launch

- Artículos en despensa por hogar (crece solo con las boletas).
- **La métrica que importa:** consultas a la despensa desde fuera de casa. Es la prueba de que resuelve la pregunta real.
- "Se acabó" por semana: mide si el estado se mantiene vivo.

---

## 9. Notas / decisiones abiertas

- [ ] ¿`por_acabarse` quién lo pone? Sólo el usuario, o también la cadencia de la spec 0012 (preguntando, R-04).
- [ ] ¿El orden por defecto es por categoría o por última compra? En el supermercado, categoría; en casa, quizás otra cosa.
- [x] ¿Cantidades? **No.** R-03, sin excepciones.
- [x] ¿La despensa se puede llenar sin boleta? **No en esta spec.** Si hace falta seguido, el problema está en la boleta.

---

## Changelog

- 2026-08-11 — draft inicial.
