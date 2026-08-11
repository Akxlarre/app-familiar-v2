# Spec 0013 — Lista de compras

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟢 mixta — se propone sola, se ajusta a mano
> **Hito:** 2 — boleta → despensa

---

## 1. Contexto de negocio

**Origen:** REQ-042.

**Persona afectada:** los dos, y sobre todo el que está en el supermercado.

**Problema que resuelve:**
La lista de compras es la app más usada del mundo y la más aburrida de reinventar. No se
construye porque falte una lista: se construye porque **es el único lugar donde todo lo anterior
se paga**. La despensa sabe qué falta (0011), la cadencia sabe qué está por faltar (0012), la
boleta sabe qué se compró (0010). La lista es donde eso se junta y se convierte en algo que
ahorra un viaje al supermercado.

Y cierra el ciclo hacia atrás: al confirmar la boleta, lo que estaba en la lista se marca solo.
Nadie tacha nada.

**Hipótesis de valor:**
Una lista que se propone sola y se marca sola es una lista que se usa. Una lista vacía que hay
que llenar cada vez es la misma app de notas que ya tienen.

---

## 2. User Stories

- **US1**: Como usuario, quiero que lo agotado y lo que está por acabarse ya esté propuesto, para no tener que acordarme.
- **US2**: Como usuario, quiero agregar cualquier cosa a la lista, esté o no en el catálogo.
- **US3**: Como pareja, queremos ver la misma lista al mismo tiempo y que lo que agrega uno le aparezca al otro.
- **US4**: Como usuario, quiero que al confirmar la boleta se marque solo lo que compré.
- **US5**: Como usuario en el supermercado, quiero marcar lo que voy echando al carro con un toque.

---

## 3. Acceptance Criteria (Gherkin)

### Se propone sola

- **AC1**: Given artículos agotados en la despensa, When se abre la lista, Then se proponen para agregar, agrupados aparte de lo ya agregado.
- **AC2**: Given artículos cuya cadencia está por cumplirse (spec 0012), When se abre la lista, Then se proponen con el motivo visible ("suele durarte 3 semanas").
- **AC3**: Given una sugerencia, When el usuario la acepta, Then pasa a la lista; When la descarta, Then no vuelve en ese ciclo.
- **AC4**: Given sin sugerencias, When se abre la lista, Then no se muestra una sección de sugerencias vacía.

### Agregar y marcar

- **AC5**: Given el catálogo, When el usuario busca y elige un artículo, Then se agrega a la lista.
- **AC6**: Given algo que no está en el catálogo, When el usuario escribe texto libre, Then se agrega igual — la lista **nunca** bloquea por falta de catálogo.
- **AC7**: Given un ítem de la lista, When se marca, Then queda marcado sin salir de la lista ni confirmar nada.
- **AC8**: Given ítems marcados, When se termina la compra, Then se pueden limpiar de una vez.

### Los dos a la vez

- **AC9**: Given dos miembros con la lista abierta, When uno agrega o marca algo, Then el otro lo ve en segundos sin recargar (RNF-01).
- **AC10**: Given dos miembros marcando el mismo ítem a la vez, When ambos confirman, Then queda marcado una sola vez y nadie ve un error.

### La boleta la cierra

- **AC11**: Given una boleta confirmada, When sus artículos coinciden con ítems de la lista, Then esos ítems se marcan como comprados automáticamente, con el precio pagado.
- **AC12**: Given un ítem de texto libre que coincide con un artículo de la boleta por alias, When se confirma, Then también se marca.
- **AC13**: Given ítems que quedaron sin comprar, When se confirma la boleta, Then siguen en la lista — no se borran.

### Edge cases obligatorios

- **AC-E1**: Given un artículo agregado dos veces, When se agrega la segunda, Then se avisa que ya está en vez de duplicarlo.
- **AC-E2**: Given un ítem de texto libre que después se resuelve a un artículo, When ocurre, Then se conserva el texto original escrito por el usuario.
- **AC-E3**: Given una lista con 80 ítems, When se abre en móvil con mala señal, Then sigue siendo usable y las marcas se aplican sin esperar al servidor.
- **AC-E4**: Given una compra parcial (se compró la mitad de la lista), When se confirma la boleta, Then los no comprados quedan y no se proponen dos veces.

---

## 4. Out of scope

- ❌ **Varias listas simultáneas** (súper, farmacia, ferretería). Una lista por hogar. Si hace falta separar, se decide con uso real.
- ❌ **Ordenar por pasillo del supermercado.** Requiere mapear cada local; el orden por categoría alcanza.
- ❌ **Precio estimado del total de la lista.** Se puede con `precios_observados` (spec 0014), pero es una promesa que envejece mal.
- ❌ **Compartir la lista fuera del hogar.** R-06.
- ❌ **Planes de comida generando la lista.** Es la spec 0020.

---

## 5. Dependencias

### Specs previas
- 0011 — lo agotado alimenta las sugerencias.
- 0010 — la boleta marca lo comprado (AC11).
- 0012 — las sugerencias por cadencia. **No bloqueante:** la lista funciona con lo agotado y gana la cadencia después.
- 0022 — Realtime (AC9, AC10). **No bloqueante:** funciona sin él, pero pierde la mitad de la gracia.

### Capacidades del proyecto que se asumen existentes
- Catálogo, alias y despensa.

### Capacidades nuevas requeridas
- Tablas `listas_compra` e `items_lista`.
- `ListaFacade` con actualización optimista (AC-E3: en el supermercado la señal es mala).
- Realtime sobre `items_lista`.
- Cruce boleta ↔ lista en el RPC de confirmación de boleta (AC11).

---

## 6. Datos y modelo

- **Tablas nuevas:** `listas_compra`, `items_lista` (artículo o texto libre, marcado, precio pagado, origen: manual · agotado · cadencia · plan).
- **Modelo UI:** `Lista`, `ItemLista`, `SugerenciaLista`.
- **`origen` importa:** es lo que permite medir si las sugerencias sirven (métricas).

---

## 7. UX y flujos

- **Pantalla:** `/app/casa/lista`.
- **Forma:** panel que llena, agrupado por categoría. Las sugerencias van arriba, visualmente separadas y **colapsables**: no se mezclan con lo que el usuario decidió.
- **Marcar:** toda la fila es el área de toque. Con una mano, en movimiento, con guantes de verano.
- **Optimista:** marcar responde al instante y sincroniza después. Esperar al servidor en un pasillo con mala señal es lo que hace que se abandone una lista.
- **Estados:** vacío con las sugerencias como primera oferta; si tampoco hay, se explica que se llenan solas con las boletas.

---

## 8. Métricas de éxito post-launch

- % de ítems que entraron por sugerencia y se compraron — **mide si la inferencia sirve**.
- % de ítems marcados por la boleta vs. a mano.
- Listas usadas por semana.

---

## 9. Notas / decisiones abiertas

- [ ] 🤖 ¿Los ítems marcados se borran al confirmar la boleta o quedan como historial? Historial permite medir; puede vivir en el log.
- [ ] 🧑 ¿La lista es persistente o se archiva cada compra? Persistente es más simple y coincide con cómo se usa una lista en la heladera.
- [x] ¿Texto libre permitido? **Sí, siempre.** Una lista que exige catálogo es una lista que no se usa.
- [x] ¿Actualización optimista? **Sí.** La señal en el supermercado es mala, y esperar rompe el flujo.

---

## Changelog

- 2026-08-11 — draft inicial.
