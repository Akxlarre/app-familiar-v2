# Spec 0008 — Presupuestos

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟡 manual, mensual — **la spec más frágil del hito**
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** REQ-032.

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**
Ver en qué se va la plata (spec 0005) responde el pasado. El presupuesto es lo único que responde
el futuro: *¿me alcanza para lo que queda del mes?*

**Pero esta spec está en riesgo por R-01**, y hay que decirlo antes de escribir una línea:
"presupuesto por categoría y mes" es literalmente un formulario mensual, que es la categoría de
funcionalidad que mató a v1. Si cada mes hay que sentarse a llenar doce montos, no se sostiene —
sin importar lo útil que suene.

Por eso esta spec entra **sólo** con una condición: los montos se **proponen** a partir del
historial, y el usuario ajusta. La entrada deja de ser "escribir doce números" y pasa a ser
"aceptar o corregir lo que ya sabemos de vos".

**Hipótesis de valor:**
Si el presupuesto del mes se propone solo desde los tres meses anteriores, mantenerlo cuesta un
toque y el aviso de "vas a pasarte" llega a tiempo.

---

## 2. User Stories

- **US1**: Como usuario, quiero saber si voy bien o mal de plata este mes, sin hacer cuentas.
- **US2**: Como usuario, quiero que el presupuesto se proponga solo desde lo que gasté antes, para no llenar un formulario cada mes.
- **US3**: Como usuario, quiero que me avise cuando me esté acercando al límite de una categoría, no cuando ya me pasé.
- **US4**: Como usuario, quiero un presupuesto personal además del compartido, para lo mío.

---

## 3. Acceptance Criteria (Gherkin)

### El presupuesto se propone solo

- **AC1**: Given tres meses de movimientos categorizados, When empieza un mes nuevo, Then el sistema **propone** un presupuesto por categoría basado en la mediana de esos meses.
- **AC2**: Given esa propuesta, When el usuario la revisa, Then puede aceptarla entera de un toque o ajustar categoría por categoría.
- **AC3**: Given menos de dos meses de historial, When se abre presupuestos, Then se dice que todavía no hay con qué proponer y se ofrece escribirlo a mano, sin fingir una propuesta.
- **AC4**: Given un presupuesto vigente, When empieza el mes siguiente, Then se arrastra el del mes anterior — no se vuelve a cero ni se pide llenarlo de nuevo.

### Seguimiento

- **AC5**: Given un presupuesto por categoría, When se registran movimientos, Then el porcentaje consumido se actualiza sin recargar.
- **AC6**: Given una categoría con presupuesto, When se supera el umbral configurado, Then se avisa una vez — no en cada movimiento.
- **AC7**: Given el mes en curso, When se mira el resumen, Then se ve cuánto queda disponible y cuántos días faltan.
- **AC8**: Given una categoría sin presupuesto, When se gasta en ella, Then aparece en el resumen como "sin presupuesto" y se puede agregar de un toque.

### Personal vs. del hogar

- **AC9**: Given un presupuesto del hogar, When cualquiera de los dos gasta, Then consume del mismo presupuesto.
- **AC10**: Given un presupuesto personal, When gasta el otro miembro, Then no lo consume.
- **AC11**: Given un presupuesto personal, When lo mira el otro miembro, Then lo ve — el hogar comparte todo (REQ-001), "personal" define de quién descuenta, no quién lo ve.

### Edge cases obligatorios

- **AC-E1**: Given un movimiento en cuotas, When consume presupuesto, Then descuenta **la cuota del mes**, no el total de la compra.
- **AC-E2**: Given un ingreso en una categoría con presupuesto, When se calcula el consumo, Then no lo aumenta.
- **AC-E3**: Given una categoría borrada con presupuesto asignado, When se muestra el resumen, Then no rompe.
- **AC-E4**: Given un movimiento recategorizado, When cambia de categoría, Then los dos presupuestos se recalculan.

---

## 4. Out of scope

- ❌ **Presupuesto por comercio o por artículo.** Granularidad que nadie mantiene.
- ❌ **Presupuestos anuales o por semana.** El mes es la unidad del dominio (facturación, sueldo).
- ❌ **Metas de ahorro.** `metas_ahorro` existe en el dominio pero no tiene fuente automática: entra sólo si se puede derivar de los movimientos. Está en el backlog frío del roadmap.
- ❌ **Alertas push.** El aviso vive en Hoy.
- ❌ **Proyección de fin de mes con tendencia.** Primero que exista un presupuesto que alguien mantenga.

---

## 5. Dependencias

### Specs previas
- 0005 — sin movimientos categorizados no hay ni seguimiento ni propuesta.
- 0003 — el aviso vive en Hoy como pendiente.
- **Bloqueante blando:** conviene tener 2–3 meses de datos reales antes de construir esto. Sin historial, AC1 no se puede ni probar.

### Capacidades del proyecto que se asumen existentes
- Tabla `presupuestos` con `profile_id` nullable.
- Movimientos categorizados y el resumen por categoría de la spec 0005.

### Capacidades nuevas requeridas
- Cálculo de la propuesta (mediana por categoría de los últimos N meses) — función pura con tests.
- Arrastre del presupuesto al mes siguiente.
- Registro de "ya avisé de esta categoría este mes" para no repetir el aviso (AC6).
- Consumo que entienda cuotas (AC-E1).

---

## 6. Datos y modelo

- **Tablas:** `presupuestos` ya existe. Puede faltar el umbral de aviso y la marca de aviso emitido.
- **Modelo UI:** `Presupuesto`, `ConsumoPresupuesto`, `PropuestaPresupuesto`.
- **Regla:** el consumo se **deriva** de los movimientos del mes. Ninguna columna `gastado`.

---

## 7. UX y flujos

- **Pantalla:** `/app/plata/presupuestos`.
- **Forma:** hero con disponible del mes y días restantes + panel con una fila por categoría, barra de consumo y monto restante. Rojo sólo cuando ya se pasó; el umbral es amarillo.
- **Armar el mes:** un solo drawer con las categorías precargadas con la propuesta. Aceptar todo es un botón. **No** hay pantalla de "crear presupuesto" vacía.
- **Estados:** sin historial → se explica y se ofrece manual (AC3). Sin presupuesto → se ofrece la propuesta, no un formulario en blanco.

---

## 8. Métricas de éxito post-launch

- **La métrica que decide si esta spec sobrevive:** % de meses con presupuesto vigente después del tercer mes. Si cae, R-01 tenía razón y hay que rediseñar o cortar.
- % de propuestas aceptadas sin editar.

---

## 9. Notas / decisiones abiertas

- [x] ¿Mediana o promedio recortado para la propuesta? **Mediana.** Aguanta el mes con la compra grande sin recortes arbitrarios.
- [x] ¿El umbral de aviso es global (80%) o por categoría? **Global al 80%, editable.** Una decisión menos por categoría; si alguien lo necesita distinto en una, se agrega después.
- [x] **¿Esta spec debería existir?** **Sí, con la condición del encabezado:** los montos se proponen desde el historial y el usuario ajusta. Nunca un formulario en blanco. Se revisa a los tres meses de uso real y si el presupuesto no se mantiene solo, se archiva — sería una victoria de R-01, no un fracaso.
- [x] ¿Las cuotas consumen el total o la cuota? **La cuota del mes.** El total ya se ve en la spec 0007.

---

## Changelog

- 2026-08-11 — draft inicial.
