# Spec 0023 — Gasto compartido

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟡 confirmar
> **Hito:** transversal — la última de la lista, y con razón

---

## 1. Contexto de negocio

**Origen:** REQ-033, el único requerimiento marcado `Could` y `Draft` del discovery.

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**
Dos personas que comparten gastos pero no todas las cuentas terminan llevando la cuenta en la
cabeza o en una nota: *"vos pagaste el súper, yo pago la luz"*. El movimiento ya está capturado y
sabe de qué cuenta salió; falta decir de quién era ese gasto.

**Pero hay que decir por qué está última en el roadmap**, y no es por complejidad técnica:

1. Es **la única spec que introduce una tensión** con el modelo. Todo el producto asume un hogar
   con visión compartida y sin roles (REQ-001). Un saldo entre miembros introduce "lo tuyo" y "lo
   mío" en un sistema diseñado para "lo nuestro".
2. Para una pareja que comparte todo, es innecesario. Para una que no, es imprescindible. Y esa
   decisión no la toma el diseño: la toman los usuarios reales.
3. El costo de entrada es "confirmar" en el papel, pero en la práctica es **decidir en cada
   movimiento** si se divide y cómo. Aplicado a todos los gastos, es R-01 en su peor forma.

Por eso entra sólo si, después de meses de uso, la falta se nota.

**Hipótesis de valor:**
Si un movimiento se puede marcar como compartido en un toque y el saldo se calcula solo, se deja
de llevar la cuenta a mano. Si hay que decidirlo en cada gasto, no se sostiene.

---

## 2. User Stories

- **US1**: Como usuario, quiero marcar que un gasto se divide entre los dos.
- **US2**: Como usuario, quiero ver quién le debe a quién y cuánto.
- **US3**: Como usuario, quiero que los gastos de ciertas categorías se dividan solos, para no decidirlo cada vez.
- **US4**: Como usuario, quiero saldar la cuenta y empezar de nuevo.

---

## 3. Acceptance Criteria (Gherkin)

### Dividir

- **AC1**: Given un movimiento, When se marca como compartido, Then se divide 50/50 por defecto.
- **AC2**: Given un movimiento compartido, When se ajusta la proporción, Then las partes suman siempre el total.
- **AC3**: Given un movimiento, When se divide, Then se registra quién lo pagó (la cuenta lo dice) y a quién le corresponde cada parte.

### Que no haya que decidir cada vez

- **AC4**: Given una categoría marcada como compartida por defecto (supermercado, cuentas), When entra un movimiento de esa categoría, Then se divide solo.
- **AC5**: Given esa división automática, When ocurre, Then se puede deshacer en un toque desde el movimiento.
- **AC6**: Given una cuenta marcada como compartida, When entra un movimiento de esa cuenta, Then se divide solo.

> AC4 y AC6 son la única forma de que esta spec no viole R-01. Sin ellas, dividir es un formulario
> aplicado a cada gasto, y no sobrevive.

### El saldo

- **AC7**: Given movimientos compartidos, When se consulta el saldo, Then dice quién le debe a quién y cuánto, en una sola frase.
- **AC8**: Given un saldo, When se salda, Then se registra el pago y el saldo vuelve a cero, conservando el historial.
- **AC9**: Given un saldo, When se mira su detalle, Then se ve qué movimientos lo componen.

### Edge cases obligatorios

- **AC-E1**: Given un movimiento compartido que se borra, When ocurre, Then el saldo se recalcula.
- **AC-E2**: Given un movimiento en cuotas compartido, When se calcula el saldo, Then cuenta **la cuota del mes**, no el total (coherente con AC-E1 de la spec 0008).
- **AC-E3**: Given un ingreso, When se intenta dividir, Then se permite: un reembolso compartido existe.
- **AC-E4**: Given un saldo saldado, When entra un movimiento compartido viejo por reproceso, Then no se altera un saldo ya cerrado — se suma al período siguiente.

---

## 4. Out of scope

- ❌ **Más de dos personas.** R-02: la app es para una familia de dos.
- ❌ **Integración con apps de pago.** Saldar es registrar que se pagó, no ejecutar la transferencia.
- ❌ **Dividir un ítem específico de una boleta.** Granularidad que nadie mantiene.
- ❌ **Recordatorios de deuda.** Un sistema que le manda notificaciones a alguien para que le pague a su pareja es un error de producto.
- ❌ **Historial de saldos con gráficos.** Un número y su detalle alcanzan.

---

## 5. Dependencias

### Specs previas
- 0005 — los movimientos. **Bloqueante duro.**
- 0006 — las cuentas dicen quién pagó.
- 0007 — para AC-E2.
- **Bloqueante de producto:** meses de uso real que digan si esto hace falta. Es la única spec del roadmap cuya construcción está condicionada a evidencia de uso, no a una dependencia técnica.

### Capacidades del proyecto que se asumen existentes
- `divisiones_movimiento` ya está en el modelo de dominio.

### Capacidades nuevas requeridas
- Tabla `divisiones_movimiento`, más un registro de saldos saldados.
- Marca de "compartido por defecto" en categorías y cuentas (AC4, AC6).
- Cálculo del saldo — función pura con tests.

---

## 6. Datos y modelo

- **Tablas nuevas:** `divisiones_movimiento` y un registro de liquidaciones.
- **Modelo UI:** `DivisionMovimiento`, `SaldoEntreMiembros`.
- **Regla:** el saldo se **deriva** de las divisiones menos las liquidaciones. Ninguna columna de saldo acumulado.

---

## 7. UX y flujos

- **Dónde vive:** un bloque en Plata, no una sección propia.
- **Dividir:** un switch en el detalle del movimiento. La proporción sólo aparece si se toca "no es mitad y mitad" — el 99% de las veces es mitad y mitad.
- **El saldo:** una frase. *"Ana te debe $34.500."* Con su detalle a un toque.
- **Saldar:** un botón que registra el pago.
- **Estados:** sin divisiones, se explica en una línea qué hace esto y cómo activarlo por categoría.

---

## 8. Métricas de éxito post-launch

- **La métrica que decide si esta spec debía existir:** movimientos divididos por mes. Si es cero después de dos meses, se archiva.
- % dividido automáticamente vs. a mano (si "a mano" domina, R-01 va a ganar esta discusión).

---

## 9. Notas / decisiones abiertas

- [ ] **¿Esta spec debería construirse?** Requiere evidencia de uso, no una decisión de diseño. Revisar después de tres meses con datos reales.
- [ ] ¿El saldo se cierra por mes o es continuo? Continuo es más simple; por mes se parece más a cómo se salda en la vida real.
- [x] ¿Más de dos personas? **No.** R-02.
- [x] ¿Recordatorios de deuda? **No.**

---

## Changelog

- 2026-08-11 — draft inicial.
