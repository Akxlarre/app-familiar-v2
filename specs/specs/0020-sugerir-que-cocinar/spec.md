# Spec 0020 — Sugerir qué cocinar

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟢 automático
> **Hito:** 3 — cuerpo y alimentación

---

## 1. Contexto de negocio

**Origen:** REQ-053.

**Persona afectada:** quien a las siete de la tarde no sabe qué hacer de comer.

**Problema que resuelve:**
Todas las apps de comida resuelven esto con un **planificador semanal**: una grilla de veintiún
casilleros que hay que llenar el domingo. Nadie lo llena dos domingos seguidos. Es el ejemplo más
puro de "manual sin retorno" y v1 tenía uno.

Acá se da vuelta la dirección: en vez de pedir que planifiques, el sistema **propone** — porque
sabe qué hay en la casa (0011) y qué se cocina en esta casa (0019). Y el plan de la semana, si
existe, es el **resultado** de haber aceptado sugerencias, no un formulario que hay que llenar
antes.

Esta spec es la culminación de las tres cadenas: la boleta llenó la despensa, la despensa dice qué
hay, las recetas dicen qué se puede hacer. Todo el hito 2 y medio hito 3 existen para que esta
pregunta se responda sola.

**Hipótesis de valor:**
Si la app dice "podés hacer tallarines con salsa, tenés todo" a las siete de la tarde, se abre
todos los días. Un planificador semanal no se abre nunca.

---

## 2. User Stories

- **US1**: Como usuario, quiero que la app me diga qué puedo cocinar con lo que tengo, en vez de pedirme que llene un plan semanal.
- **US2**: Como usuario, quiero aceptar una sugerencia y que quede agendada.
- **US3**: Como usuario, quiero mandar a la lista lo que falta para una receta que quiero hacer.
- **US4**: Como usuario, quiero ver qué se planeó para esta semana, si es que se planeó algo.

---

## 3. Acceptance Criteria (Gherkin)

### Proponer

- **AC1**: Given recetas y la despensa, When se piden sugerencias, Then se proponen ordenadas por cuántos ingredientes ya están en casa.
- **AC2**: Given una sugerencia, When se muestra, Then dice cuántos ingredientes faltan y cuáles.
- **AC3**: Given recetas con todos los ingredientes disponibles, When existen, Then van primero y se distinguen de las que requieren comprar.
- **AC4**: Given una receta cocinada hace poco, When se ordenan las sugerencias, Then baja de prioridad — repetir lo de anteayer no es una sugerencia útil.
- **AC5**: Given sin recetas cargadas, When se abre, Then se explica que las sugerencias necesitan recetas, con acceso a crear la primera. No se muestra una pantalla vacía.

### Aceptar

- **AC6**: Given una sugerencia, When se acepta, Then se agenda para un día y momento.
- **AC7**: Given una sugerencia aceptada, When llega ese día, Then aparece en Hoy.
- **AC8**: Given algo agendado, When se cocina y se come, Then se registra como comida en un toque (spec 0017).
- **AC9**: Given algo agendado que no se hizo, When pasa el día, Then desaparece sin culpa y sin marcarse como incumplido.

### Comprar lo que falta

- **AC10**: Given una receta con ingredientes faltantes, When el usuario la quiere hacer igual, Then los faltantes se mandan a la lista de compras (spec 0013) con origen `plan`.
- **AC11**: Given esos ingredientes comprados y confirmados por boleta, When se vuelven a pedir sugerencias, Then esa receta pasa a "tenés todo".

### El plan

- **AC12**: Given sugerencias aceptadas, When se mira la semana, Then se ve lo agendado — **y sólo eso**. No hay casilleros vacíos que llenar.
- **AC13**: Given una semana sin nada agendado, When se abre, Then no se muestra una grilla vacía: se muestran sugerencias.

### Edge cases obligatorios

- **AC-E1**: Given una despensa desactualizada (dice que hay algo que no hay), When se sugiere, Then el usuario puede marcar el faltante ahí mismo y la sugerencia se recalcula.
- **AC-E2**: Given todas las recetas con ingredientes faltantes, When se sugiere, Then se proponen las que menos faltan, diciéndolo — no se devuelve una lista vacía.
- **AC-E3**: Given un ingrediente marcado `por_acabarse`, When se calcula la disponibilidad, Then cuenta como disponible pero se avisa.
- **AC-E4**: Given una receta borrada, When estaba agendada, Then lo agendado no rompe.

---

## 4. Out of scope

- ❌ **Planificador semanal como formulario.** Es explícitamente lo que esta spec existe para no hacer. Está en el backlog frío del roadmap.
- ❌ **Sugerencias por objetivo calórico** ("una receta que te quepa en las 600 kcal que te faltan"). Tentador, pero mezcla dos problemas y empieza a opinar sobre lo que se come.
- ❌ **Recetas sugeridas de internet.** Sólo las del hogar.
- ❌ **Lista de compras generada para un menú semanal completo.** Requiere el planificador que no vamos a hacer.
- ❌ **Aprender preferencias con un modelo.** Con quince recetas, ordenar por disponibilidad y recencia alcanza.

---

## 5. Dependencias

### Specs previas
- 0019 — sin recetas no hay qué sugerir. **Bloqueante duro.**
- 0011 — sin despensa no hay con qué ordenarlas. **Bloqueante duro.**
- 0013 — para mandar lo que falta a la lista.
- 0003 — lo agendado aparece en Hoy.

### Capacidades del proyecto que se asumen existentes
- Cruce receta ↔ despensa (spec 0019, AC8).

### Capacidades nuevas requeridas
- Tablas `planes_comida` y `slots_plan` — pobladas **sólo** por sugerencias aceptadas.
- Ordenamiento de sugerencias (disponibilidad, recencia) — función pura con tests.
- Integración con Hoy como pendiente del día.

---

## 6. Datos y modelo

- **Tablas nuevas:** `planes_comida`, `slots_plan`.
- **Regla:** un slot se crea al aceptar una sugerencia. **No existe** una pantalla que cree slots vacíos.
- **Modelo UI:** `Sugerencia`, `SlotPlan`, `DisponibilidadReceta`.

---

## 7. UX y flujos

- **Dónde vive:** en Hoy (lo agendado para hoy) y en una pantalla de sugerencias dentro de Alimentación.
- **Forma:** lista de recetas ordenada por disponibilidad. Cada fila: nombre, macros por porción, "tenés todo" o "te faltan 2".
- **Aceptar:** un toque agenda para hoy; mantener ofrece elegir día.
- **El plan de la semana** es una vista secundaria y **puede estar vacía sin que eso sea un problema**. Es la diferencia entre un plan que emerge y un plan que se exige.
- **Estados:** sin recetas (AC5), todo con faltantes (AC-E2).

---

## 8. Métricas de éxito post-launch

- **La métrica que importa:** sugerencias aceptadas por semana. Si es cero, la idea no funcionó y hay que revisar si el problema son las recetas, la despensa o el orden.
- % de sugerencias aceptadas que terminan en un registro de comida.
- Slots creados vs. slots cocinados.

---

## 9. Notas / decisiones abiertas

- [ ] ¿Cuánto pesa la recencia frente a la disponibilidad (AC4)? Empezar simple: excluir lo cocinado en los últimos 3 días del top.
- [ ] ¿Se sugiere por momento del día (almuerzo vs. cena)? Requiere clasificar las recetas; quizás no haga falta.
- [x] ¿Planificador semanal? **No.** Es el anti-patrón que esta spec corrige.
- [x] ¿El plan vacío es un problema? **No.** Es el estado normal.

---

## Changelog

- 2026-08-11 — draft inicial.
