# Spec 0006 — Cuentas y tarjetas de crédito

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P1
> **Costo de entrada:** 🟡 manual, una vez por cuenta
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** REQ-030.

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**
La cuenta es lo que le da sentido al cargo. Sin ella, "gastaste $15.990" no responde la pregunta
real, que es *"¿de dónde salió y cuánto me queda de cupo"*. Y hay una razón técnica más urgente:
`process-bank-emails` saca la cuenta del parser (`cuenta_id`), y si el parser no tiene cuenta
asociada, **la captura queda en la bandeja aunque el monto se haya leído perfecto**. Hoy no hay
forma de crear una cuenta desde la app.

En v1 la cuenta se adivinaba por nombre de banco + correo, y todo lo que no calzaba quedaba en
revisión. Acá se decide explícitamente una vez y no se vuelve a tocar.

**Hipótesis de valor:**
Configurar cuentas es un costo de entrada aceptable —se paga una vez— porque habilita que todo lo
demás sea automático. Es la excepción que R-01 permite: manual, una vez, a cambio de automatismo
permanente.

---

## 2. User Stories

- **US1**: Como usuario, quiero registrar mis cuentas y tarjetas para saber de dónde sale cada gasto.
- **US2**: Como usuario con tarjeta de crédito, quiero ver cuánto cupo me queda sin entrar al banco.
- **US3**: Como usuario, quiero saber cuándo se factura y cuándo se vence mi tarjeta, para no pagar interés por olvido.
- **US4**: Como usuario, quiero vincular una cuenta al parser de su banco para que los cargos entren solos.
- **US5**: Como usuario, quiero ver el saldo de mis cuentas de débito y efectivo.

---

## 3. Acceptance Criteria (Gherkin)

### Cuentas

- **AC1**: Given un hogar, When se crea una cuenta, Then se elige entre débito, crédito, efectivo y billetera digital, con nombre, banco y titular.
- **AC2**: Given una cuenta de crédito, When se crea, Then se piden cupo total, día de facturación y día de vencimiento.
- **AC3**: Given una cuenta que no es de crédito, When se crea, Then **no** se piden esos campos — no se muestra un formulario con la mitad de los campos apagados.
- **AC4**: Given una cuenta con movimientos, When se intenta borrar, Then se ofrece archivarla en vez de borrarla, y los movimientos históricos no se pierden.
- **AC5**: Given una cuenta archivada, When se listan las cuentas, Then no aparece por defecto pero sus movimientos siguen visibles en Plata.

### Crédito

- **AC6**: Given una tarjeta con cupo y movimientos del período, When se abre, Then se ve cupo usado, disponible y porcentaje.
- **AC7**: Given una tarjeta con día de facturación, When se abre, Then se ve el período de facturación en curso y cuándo cierra.
- **AC8**: Given una tarjeta con compras en cuotas, When se calcula lo comprometido, Then incluye las cuotas futuras y se distingue de lo ya facturado (detalle en spec 0007).
- **AC9**: Given un cupo superado, When se muestra, Then el estado es visible sin leer números.

### Captura

- **AC10**: Given una cuenta y el banco al que pertenece, When se vincula a un parser, Then los cargos de ese correo entran con esa cuenta sin intervención.
- **AC11**: Given un parser sin cuenta asociada, When se listan las cuentas, Then se avisa que hay capturas atascadas por eso, con acceso directo a resolverlo.
- **AC12**: Given una cuenta recién vinculada a un parser, When se toca "reintentar", Then las capturas que estaban atascadas por falta de cuenta se recuperan (usa `reprocesar-capturas` de la spec 0001).

### Edge cases obligatorios

- **AC-E1**: Given dos cuentas del mismo banco (débito y crédito), When llega un correo, Then el parser distingue por su patrón de asunto y no manda todo a la primera.
- **AC-E2**: Given un día de facturación 31 en un mes de 30 días, When se calcula el período, Then se usa el último día del mes.
- **AC-E3**: Given un cupo en cero o nulo, When se muestra el disponible, Then no se divide por cero.
- **AC-E4**: Given una cuenta de otro miembro del hogar, When se lista, Then se ve — el hogar comparte todo, no hay cuentas privadas (REQ-001: mismos permisos).

---

## 4. Out of scope

- ❌ **Conciliación bancaria.** No hay API de bancos chilenos; el correo es la única fuente.
- ❌ **Saldo real de la cuenta de débito.** El correo informa cargos, no saldo. Mostrar un saldo calculado a partir de cargos parciales sería mentir.
- ❌ **Editar los regex del parser.** El usuario vincula cuenta ↔ banco; los patrones son mantenimiento.
- ❌ **Múltiples monedas.** Pesos chilenos (RB-04).
- ❌ **Transferencias entre cuentas propias.** Sin fuente automática que las distinga de un gasto.

---

## 5. Dependencias

### Specs previas
- 0001 — `cuentas`, `detalle_credito` y `parsers_email` ya existen.
- 0005 — comparte la sección Plata.
- 0004 — el onboarding crea la primera cuenta con una versión mínima de este formulario.

### Capacidades del proyecto que se asumen existentes
- Tablas `cuentas`, `detalle_credito`, `parsers_email`, `movimientos`.
- Edge function `reprocesar-capturas`.
- Drawer del shell con `inputs`.

### Capacidades nuevas requeridas
- `CuentasRepository` y `CuentasFacade`.
- Columna o convención de **archivado** en `cuentas` (AC4).
- Cálculo de período de facturación (función pura, con tests: los meses de 30/31 días y febrero son el caso que siempre se rompe).
- Aviso de "parsers sin cuenta" cruzando `parsers_email` con `cuentas`.

---

## 6. Datos y modelo

- **Tablas modificadas:** `cuentas` — falta `archivada` (o `estado`). Decidirlo en el plan.
- **Modelo UI:** `Cuenta`, `DetalleCredito`, `PeriodoFacturacion`, `ResumenCupo`.
- **RLS:** ya cubierta.
- **Regla:** el cupo usado se **deriva** de los movimientos del período; no es columna. Una columna de saldo se pudre igual que `calories_target` en v1.

---

## 7. UX y flujos

- **Pantalla:** `/app/plata/cuentas`.
- **Forma:** hero con totales (cupo disponible del hogar, nº de cuentas) + panel con una fila por cuenta. Las de crédito muestran barra de cupo; las demás, sólo el movimiento del mes.
- **Crear y editar:** drawer. El tipo de cuenta se elige **primero** y define qué campos siguen (AC3).
- **Detalle:** drawer con cupo, período de facturación, últimos movimientos y el parser vinculado.
- **Estados:** vacío con el motivo real ("sin cuentas, los cargos del banco quedan atascados en la bandeja") y acción directa a crear la primera.

---

## 8. Métricas de éxito post-launch

- Capturas atascadas por "El parser no tiene cuenta asociada" (objetivo: 0).
- % de movimientos con cuenta asignada.

---

## 9. Notas / decisiones abiertas

- [ ] 🤖 ¿`archivada BOOLEAN` o `estado TEXT`? Estado deja lugar a "cerrada por el banco", que es distinto de archivada por el usuario.
- [ ] 🌍 ¿El cupo usado incluye cuotas futuras? El banco las descuenta del cupo al comprar; mostrarlo distinto confundiría. Verificar contra un estado de cuenta real.
- [x] ¿Saldo de débito? **No.** El correo informa cargos, no saldo.
- [x] ¿Cuentas privadas por miembro? **No.** El hogar comparte todo (REQ-001).

---

## Changelog

- 2026-08-11 — draft inicial.
