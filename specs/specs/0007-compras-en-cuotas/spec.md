# Spec 0007 — Compras en cuotas

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟢 automático
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** REQ-031, RB-03.

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**
En Chile se compra en cuotas por defecto, y el problema no es cada cuota: es que **nadie sabe
cuánto debe en total**. Doce compras en tres cuotas cada una son treinta y seis cargos futuros que
ninguna app muestra juntos, y el banco tampoco — el estado de cuenta muestra lo del mes.

Lo notable es que el dato ya está: el correo dice "Cuota 3 de 12" y el parser lo extrae desde el
hito 0. La tabla `compras_en_cuotas` existe y se llena sola. Falta mostrarlo.

**Hipótesis de valor:**
Ver "te quedan $840.000 comprometidos en cuotas" es información que hoy no existe en ninguna
parte, obtenida sin escribir nada. Es de las cosas que hacen que la app valga la pena por sí sola.

---

## 2. User Stories

- **US1**: Como usuario, quiero ver cuánto debo en cuotas sin haber anotado ninguna.
- **US2**: Como usuario, quiero ver las cuotas de una compra agrupadas, no doce cargos sueltos.
- **US3**: Como usuario, quiero saber cuánto me queda por pagar de cada compra y cuándo termina.
- **US4**: Como usuario, quiero ver cuánto de mi próxima facturación son cuotas de compras viejas.

---

## 3. Acceptance Criteria (Gherkin)

### Agrupar

- **AC1**: Given un correo con "Cuota 3 de 12", When se procesa, Then el movimiento queda ligado a una compra en cuotas con su número de cuota.
- **AC2**: Given varias cuotas de la misma compra, When llegan en meses distintos, Then se agrupan bajo la misma compra — mismo comercio, mismo monto de cuota, mismo total.
- **AC3**: Given una compra en cuotas, When se abre, Then se ven las cuotas ya pagadas, la actual y las que faltan, con fechas.
- **AC4**: Given dos compras del mismo comercio y mismo monto en el mismo mes, When se agrupan, Then no se fusionan en una sola.

### Mostrar

- **AC5**: ~~Total comprometido de las cuotas~~ → **absorbido por AC1 de la spec 0025.** Las cuotas son una deuda: su total no puede vivir aparte del total de deudas, o son dos copias del mismo número esperando a divergir.
- **AC6**: ~~Cuánto de la próxima facturación son cuotas~~ → **absorbido por AC3 de la spec 0025**, que muestra cuánto sale este mes sumando todas las fuentes.
- **AC7**: Given una compra terminada (última cuota pagada), When se listan, Then no aparece entre las activas pero queda en el historial.
- **AC8**: Given una compra en cuotas, When se mira un movimiento suyo en Plata, Then dice "cuota 3 de 12" y enlaza a la compra.

### Cuando el parser no alcanza

- **AC9**: Given una compra que empezó antes de instalar la app, When llega su cuota 7 de 12, Then se crea la compra con las 6 anteriores marcadas como no capturadas, sin inventar sus fechas.
- **AC10**: Given una compra incompleta, When se muestra el total comprometido, Then se distingue lo capturado de lo estimado.

### Edge cases obligatorios

- **AC-E1**: Given un correo que dice "Cuota 1 de 1", When se procesa, Then **no** se crea una compra en cuotas: es una compra normal.
- **AC-E2**: Given una compra cuya cuota cambia de monto (interés variable), When llega la siguiente, Then se agrupa igual y el total se recalcula.
- **AC-E3**: Given un movimiento en cuotas cuya captura se borra, When se recalcula, Then la compra no queda con una cuota fantasma.
- **AC-E4**: Given cuotas de una cuenta archivada, When se calcula lo comprometido, Then siguen contando: la deuda no desaparece porque se archive la tarjeta.

---

## 4. Out of scope

- ❌ **Registrar una compra en cuotas a mano.** Rompe R-01. Las que empezaron antes de la app se completan solas a medida que llegan sus cuotas (AC9).
- ❌ **Calcular el CAE o el interés.** El correo no lo trae y estimarlo sería inventar.
- ❌ **Simular prepago.** Requiere datos que el correo no da.
- ❌ **Cuotas de compras en efectivo o con casas comerciales que no mandan correo.** Sin fuente automática.

---

## 5. Dependencias

### Specs previas
- 0001 — el parser ya extrae la cuota y `compras_en_cuotas` ya se llena.
- 0005 — los movimientos enlazan a la compra.
- 0006 — las cuotas afectan el cupo de la tarjeta.

### Capacidades del proyecto que se asumen existentes
- Tablas `compras_en_cuotas` y `movimientos.compra_cuotas_id`, `movimientos.numero_cuota`.
- `extraerCuota` en `_shared/parseo.ts`, con tests.

### Capacidades nuevas requeridas
- `CuotasRepository` y `CuotasFacade`.
- Cálculo de comprometido/pendiente por compra y agregado del hogar (función pura con tests).
- Marca de cuotas **no capturadas** para compras que empezaron antes (AC9, AC10).

---

## 6. Datos y modelo

- **Tablas modificadas:** `compras_en_cuotas` probablemente necesite distinguir cuotas capturadas de inferidas. Decidir en el plan.
- **Modelo UI:** `CompraEnCuotas`, `CuotaProyectada`, `ResumenComprometido`.
- **Regla:** lo pendiente se **deriva** de las cuotas capturadas y del total; no es columna.

---

## 7. UX y flujos

- **Pantalla:** ya no es una subsección propia. Es la **vista de cuotas dentro de `/app/plata/deudas`** (spec 0025, D1). Se decidió antes de construir nada: los tabs de Plata todavía no existen.
- **Forma:** hero con comprometido total, pendiente y cuánto cae el mes que viene + panel con una fila por compra activa, ordenadas por cuánto falta.
- **Fila:** comercio, monto de cuota, progreso ("3 de 12"), total pendiente. El progreso se ve sin leer números.
- **Detalle:** drawer con la línea de tiempo de las cuotas — pagadas, la actual, las que vienen, y las que no se capturaron.
- **Estados:** vacío que explica que las cuotas aparecen solas cuando llega el correo del banco.

---

## 8. Métricas de éxito post-launch

- % de movimientos en cuotas correctamente agrupados.
- Compras con cuotas no capturadas (debería bajar con el tiempo).

---

## 9. Notas / decisiones abiertas

- [ ] 🌍 ¿La agrupación por comercio + monto + total es suficiente, o hace falta también el últimos-4 de la tarjeta? Verificar con correos reales (RB-01).
  <br>🔓 **Se desbloquea con:** correos reales de una compra en cuotas (RB-01). Si traen los últimos-4 de la tarjeta, entran a la clave de agrupación.
- [x] ¿Cómo se estima la fecha de las cuotas futuras — día de facturación de la cuenta, o mismo día del mes que la primera capturada? **Día de facturación de la cuenta.** Es el dato real; el mismo día del mes que la primera cuota es una coincidencia que se rompe en febrero.
- [x] ¿Se pueden crear cuotas a mano? **No.** El dato viene del correo o no viene.
- [x] ¿"Cuota 1 de 1" crea compra? **No.** Es una compra normal.

---

## Changelog

- 2026-08-11 — draft inicial.
