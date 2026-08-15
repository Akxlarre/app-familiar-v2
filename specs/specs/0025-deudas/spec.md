# Spec 0025 — Deudas

> **Status:** draft
> **Created:** 2026-08-12
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟡 manual, una vez por crédito — las cuotas son 🟢
> **Hito:** 1 — que la plata se pueda mirar
> **Decisiones:** [decisiones.md](./decisiones.md) — 6 cerradas en interrogatorio
> **Modifica:** 0007, 0008

---

## 1. Contexto de negocio

**Origen:** REQ-031 (cuotas) extendido, y una pregunta que el roadmap no respondía:
*"¿cuánto debo en total?"*.

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**

El compromiso a futuro está repartido y por eso nadie lo ve entero. Las cuotas de tarjeta ya se
capturan solas desde el hito 0 — el correo dice "Cuota 3 de 12" y el parser lo extrae — pero un
crédito de consumo o automotriz no aparece en ninguna parte, aunque su cargo mensual sí llegue
por correo y se convierta en un gasto suelto que nadie relaciona con nada.

El resultado es que la app puede decir con precisión qué gastaste el mes pasado y no tiene idea
de cuánto debés. Y **cuánto debés es la pregunta que condiciona todas las demás**: si hay
$5.000.000 comprometidos en los próximos 18 meses, el presupuesto de Supermercado es una
conversación distinta.

**Hipótesis de valor:**
Un solo número —*"te faltan $5.040.000, la última cuota es en febrero de 2028"*— obtenido casi sin
escribir nada. Las cuotas ya están; los créditos cuestan cuatro campos, una vez.

**Por qué absorbe a las cuotas (D1):**
Las compras en cuotas **son** una deuda. Dejarlas como sección hermana obliga a que el total de
"cuánto debo" viva arbitrariamente en una de las dos pantallas, o a duplicarlo — y dos copias del
mismo número divergen. La spec 0007 pasa a ser la vista de cuotas dentro de esta sección.

---

## 2. User Stories

- **US1**: Como usuario, quiero un número que me diga cuánto debo en total, sumando cuotas y créditos.
- **US2**: Como usuario, quiero dar de alta un crédito de consumo o automotriz en menos de un minuto y no volver a tocarlo.
- **US3**: Como usuario, quiero ver cuánto de mi mes se va en compromisos que no puedo bajar.
- **US4**: Como usuario, quiero saber cuándo se termina cada deuda.
- **US5**: Como usuario, quiero que el cargo del banco se ligue solo a su crédito, sin marcar pagos a mano.

---

## 3. Acceptance Criteria (Gherkin)

### El total

- **AC1**: Given cuotas y créditos activos, When se abre Deudas, Then se ve **un** total de lo que falta pagar, sumando ambas fuentes.
- **AC2**: Given una deuda con cuotas pendientes, When se calcula lo que falta, Then es `cuotas pendientes × monto de cuota` — no el saldo insoluto (D3).
- **AC3**: Given el total, When se muestra, Then se ve también **cuánto sale este mes** y la fecha de la última cuota de todas.
- **AC4**: Given que el hipotecario no entra (D2), When se muestra el total, Then la pantalla **declara** que no incluye hipotecarios — un total que se presenta como completo y no lo es, miente.

### Los créditos

- **AC5**: Given un crédito nuevo, When se da de alta, Then se piden exactamente cuatro campos: nombre, monto de la cuota, total de cuotas y fecha de la primera (D4).
- **AC6**: Given un crédito dado de alta, When llega el primer cargo que podría ser suyo, Then la app **propone** ligarlos y el usuario confirma (D6).
- **AC7**: Given un cargo confirmado como de un crédito, When llega el siguiente del mismo comercio, Then se liga solo, sin preguntar.
- **AC8**: Given un crédito, When se abre, Then se ven las cuotas pagadas, las que faltan, cuánto falta en plata y la fecha de término.
- **AC9**: Given la última cuota pagada, When se listan las deudas, Then el crédito sale de las activas y queda en el historial.

### Las cuotas

- **AC10**: Given compras en cuotas activas, When se abre Deudas, Then aparecen junto a los créditos, con el mismo criterio de "lo que falta".
- **AC11**: Given una compra en cuotas, When se abre, Then se ve su detalle completo — lo que hoy define la spec 0007.

### El mes

- **AC12**: Given deudas activas, When se mira el mes en curso, Then se ve cuánto de lo gastado son compromisos fijos, distinguido del gasto discrecional.
- **AC13**: Given un pago de cuota capturado, When se ve en Plata, Then **aparece como gasto** —la plata salió— en la categoría de sistema `Deudas` (D5).

### Edge cases obligatorios

- **AC-E1**: Given un mes sin cargo capturado para un crédito activo, When se cuenta el avance, Then **no** se da la cuota por pagada: el avance sale de cargos reales, no del almanaque (D6).
- **AC-E2**: Given dos créditos con la misma cuota en el mismo banco, When llega un cargo, Then no se liga a ciegas al primero: se pregunta.
- **AC-E3**: Given una compra en cuotas que empezó antes de instalar la app, When llega su cuota 7 de 12, Then se cuenta lo que falta sin inventar las 6 anteriores (hereda AC9/AC10 de la 0007).
- **AC-E4**: Given un crédito dado de alta con datos equivocados, When se corrige, Then el avance se recalcula sin perder los cargos ya ligados.
- **AC-E5**: Given un crédito prepagado o repactado, When el usuario lo marca terminado a mano, Then sale de las activas aunque queden cuotas teóricas.

---

## 4. Out of scope

- ❌ **Hipotecarios (D2).** Están en UF: rompen RB-04 y meten una segunda moneda con valor que cambia a diario. Se reabre si aparecen por correo en pesos.
- ❌ **Deudas informales** ("le debo a mi mamá"). Sin fuente automática en ninguna de las dos puntas — mismo motivo por el que la 0023 se archivó (R-01).
- ❌ **Tasa de interés y tabla de amortización.** D3 eligió el número que no las necesita. Una tasa mal tipeada produce un número que miente sin que nada lo delate.
- ❌ **Simular un prepago.** Requiere la tasa. Si entra alguna vez, es un dato aparte y explícito, nunca reemplazando al total de D3.
- ❌ **Alertas de vencimiento.** No hay spec de notificaciones todavía.
- ❌ **Refinanciar / repactar como flujo.** AC-E5 lo resuelve con lo mínimo: marcar terminado y dar de alta el nuevo.

---

## 5. Dependencias

### Specs previas
- **0007 — compras en cuotas.** Deja de ser subsección de Plata y pasa a ser la vista de cuotas de esta sección. Sus AC5 y AC6 (total comprometido, próxima facturación) se absorben en AC1 y AC3 de acá.
- **0006 — cuentas.** El crédito puede vincularse a una cuenta; el cupo sigue siendo suyo.
- **0005 — Plata.** AC13 depende de que el reparto por categoría ya exista.
- **0001 — captura.** `alias_comercio` y `normalizar_comercio` son la maquinaria que AC6/AC7 reusan.

### Capacidades del proyecto que se asumen existentes
- `compras_en_cuotas` (se llena sola desde el hito 0).
- `alias_comercio` + RPC `categoria_para_comercio`, y `normalizar_comercio`.
- `categorias_gasto` con categorías de sistema (`household_id IS NULL`).
- Drawer del shell para el alta.

### Capacidades nuevas requeridas
- Tabla `deudas` (los créditos dados de alta a mano) y su vínculo con `movimientos`.
- Categoría de sistema **Deudas**, no borrable ni renombrable.
- Vista o función que **sume las dos fuentes** — es el corazón de AC1 y no puede vivir en el cliente: sumar en TypeScript lo que Postgres ya sabe agrupar es la forma de que el total y el detalle dejen de coincidir.
- `DeudasRepository` y `DeudasFacade`.

---

## 6. Datos y modelo

- **Tablas nuevas:** `deudas` — `nombre`, `monto_cuota BIGINT`, `cuotas_total INT`, `primera_fecha DATE`, `cuenta_id`, `patron_comercio TEXT`, `estado`.
- **Tablas modificadas:** `movimientos` gana `deuda_id` (nullable, `ON DELETE SET NULL`) — el espejo de `compra_cuotas_id`, que ya existe.
- **Derivado, no guardado:** cuántas cuotas van, cuánto falta y la fecha de término salen de contar los movimientos ligados. **Ninguna columna de saldo.** Un contador de saldo necesita las dos puntas y se pudre — es RN-06, y es lo que le pasó a `calories_target` en v1.
- **RLS:** por `household_id`, como todo. `GRANT` por columna donde haga falta.

---

## 7. UX y flujos

- **Pantalla:** `/app/plata/deudas`.
- **Forma:** hero con el total de lo que falta + lo que sale este mes. Debajo, una fila por deuda —créditos y compras en cuotas mezclados, ordenados por lo que falta— con barra de avance y fecha de término.
- **El alta** va en drawer, cuatro campos (AC5).
- **La confirmación de AC6** no es un formulario: es la misma forma de "¿recordar este comercio?" que ya existe al corregir una categoría.
- **AC4 no es letra chica:** si el total excluye hipotecarios, se dice en la pantalla, no en un tooltip.

---

## 8. Métricas de éxito post-launch

- El total de deuda existe y nadie lo escribió.
- Un crédito dado de alta no vuelve a tocarse: sus cuotas avanzan solas.
- El presupuesto deja de romperse el mes que empieza un crédito.

---

## 9. Notas / decisiones abiertas

Las seis decisiones de producto se cerraron antes de escribir esta spec — están en
[decisiones.md](./decisiones.md) con su razón y su costo aceptado. Queda abierto:

- [ ] 🌍 ¿Los correos de cargo de crédito traen "cuota N de M"? Si lo traen, el alta de D4 puede volverse automática y los cuatro campos pasan a ser una corrección. **Disparador:** el primer crédito real capturado por `process-bank-emails`.
- [ ] 🌍 ¿Cuántos créditos tiene el hogar de verdad? Si es uno solo, AC-E2 (dos créditos con la misma cuota) puede ser complejidad prematura. **Disparador:** el primer uso real.
- [ ] 🧑 ¿La deuda se muestra en Hoy cuando falta poco para una cuota? Depende de que exista una spec de avisos.

---

## Changelog

- 2026-08-12 — draft inicial, con las 6 decisiones de producto ya cerradas.
