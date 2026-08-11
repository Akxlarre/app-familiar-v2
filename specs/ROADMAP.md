# Roadmap SDD — app-familiar v2

> Índice vivo de todas las specs del proyecto.
> Mantener actualizado: cada spec nueva o cambio de estado se refleja acá.
> Última revisión: 2026-08-11

---

## Cómo leer este roadmap

El orden **no** es una lista de deseos: es una cadena de dependencias sobre una sola regla
(R-01, `context/constraints.md`). Ninguna funcionalidad entra sin responder de dónde salen sus
datos sin que nadie los escriba. v1 tenía nueve módulos, siete de entrada manual diaria y cero
uso — este roadmap está ordenado para que cada hito produzca los datos que el siguiente consume.

Cada spec declara su **costo de entrada**, igual que los requerimientos:

| Nivel | Qué significa |
|---|---|
| 🟢 automático | El banco o la boleta escriben el dato |
| 🔵 un gesto | Una foto, un escaneo de código de barras |
| 🟡 manual con intención | El usuario ya está ahí y quiere registrarlo |
| 🔴 manual sin retorno | **No entra.** Se rediseña o se corta |

---

## Activa

| ID | Título | Owner | Activada |
|----|--------|-------|----------|
| — | (ninguna) | — | — |

---

## Hito 0 — El esqueleto vivo

> Demostrar la tesis: un correo del banco se convierte en movimiento sin que nadie escriba nada.
> **Código escrito, sin verificar contra la realidad.**

| ID | Título | Entrada | Prioridad | Estado | REQ |
|----|--------|---------|-----------|--------|-----|
| 0001 | Cadena de captura del correo bancario | 🟢 | P0 | `draft` | REQ-001, 010, 011, 012, 013, 030 |

---

## Hito 1 — Que la plata se pueda mirar

> El hito 0 produce movimientos que **no se pueden ver**: la única pantalla con datos es la
> bandeja, y la bandeja sólo muestra lo que falló. Esto cierra ese círculo y, de paso, fija el
> lenguaje visual y de navegación antes de que existan quince pantallas que unificar a posteriori.

| ID | Título | Entrada | Prioridad | Estado | REQ |
|----|--------|---------|-----------|--------|-----|
| 0002 | Lenguaje de pantallas — el contrato de UI | — | P0 | `draft` | RNF-06 |
| 0003 | Navegación y secciones | — | P0 | `draft` | RNF-02, RNF-06 |
| 0004 | Del registro al primer movimiento | 🟡 una vez | P0 | `draft` | REQ-001, REQ-010 |
| 0005 | La pantalla de la plata | 🟢 | P0 | `draft` | REQ-011, REQ-013 |
| 0006 | Cuentas y tarjetas de crédito | 🟡 una vez | P1 | `draft` | REQ-030 |
| 0007 | Compras en cuotas | 🟢 | P1 | `draft` | REQ-031 |
| 0008 | Presupuestos | 🟡 mensual | P2 | `draft` | REQ-032 |

---

## Hito 2 — Boleta → despensa

> La segunda cadena automática. Una foto produce un movimiento, ítems de despensa y precios
> observados. Es lo que hace que la despensa exista sin que nadie inventaríe nada.

| ID | Título | Entrada | Prioridad | Estado | REQ |
|----|--------|---------|-----------|--------|-----|
| 0009 | Catálogo de artículos y alias | 🟢 | P0 | `draft` | REQ-020 |
| 0010 | Boleta fotografiada | 🔵 | P0 | `draft` | REQ-014 |
| 0011 | Qué hay en casa | 🟢 | P0 | `draft` | REQ-040 |
| 0012 | Consumo inferido por recompra | 🟢 | P1 | `draft` | REQ-041 |
| 0013 | Lista de compras | 🟢 mixta | P1 | `draft` | REQ-042 |
| 0014 | Historial de precios | 🟢 | P2 | `draft` | REQ-043 |

---

## Hito 3 — Cuerpo y alimentación

> Cuerpo va **primero** aunque Alimentación sea más visible: el peso tiene un solo dueño
> (RN-08) y el objetivo calórico se deriva de él. Al revés, `calories_target` vuelve a ser una
> columna que se pudre — que es exactamente lo que pasó en v1, y por eso existían
> `last_recalibration` e `is_manual_override`.

| ID | Título | Entrada | Prioridad | Estado | REQ |
|----|--------|---------|-----------|--------|-----|
| 0015 | Serie de mediciones | 🟡 con intención | P1 | `draft` | REQ-060 |
| 0016 | Open Food Facts | 🔵 | P1 | `draft` | REQ-021 |
| 0017 | Registrar una comida | 🔵 | P1 | `draft` | REQ-050 |
| 0018 | Objetivo calórico derivado del peso | 🟢 | P1 | `draft` | REQ-051 |
| 0019 | Recetas | 🟡 una vez por receta | P2 | `draft` | REQ-052 |
| 0020 | Sugerir qué cocinar | 🟢 | P2 | `draft` | REQ-053 |

---

## Hito 4 — Entrenamiento

| ID | Título | Entrada | Prioridad | Estado | REQ |
|----|--------|---------|-----------|--------|-----|
| 0021 | Rutinas y sesiones | 🟡 con intención | P2 | `draft` | REQ-070 |

---

## Transversales (sin hito propio)

| ID | Título | Entrada | Prioridad | Estado | REQ |
|----|--------|---------|-----------|--------|-----|
| 0022 | Los dos miembros en vivo | 🟢 | P2 | `draft` | RNF-01 |
| 0023 | Gasto compartido | 🟡 confirmar | P2 | `draft` | REQ-033 |

---

## Backlog frío — lo que NO tiene spec, y por qué

> Que algo no esté acá es una decisión, no un olvido.

| Idea | Por qué no entra |
|---|---|
| Multi-hogar / multi-tenant | R-02. La app es para una familia. Agregar `household_id` al catálogo después es trivial; deduplicar al revés no |
| App nativa (Capacitor) | R-05. Web primero; nada del núcleo puede depender de un plugin |
| Compartir hacia afuera, feeds, analítica de terceros | R-06. Los alias de boletas revelan hábitos de compra: quedan en el hogar |
| Cantidades en despensa (`quantity`, `stock_minimum`) | R-03 y RN-06. Un contador necesita las dos puntas y la salida es manual: deriva hacia arriba hasta que miente |
| Plan semanal como formulario de 21 casillas | REQ-053. El plan es el **resultado** de aceptar sugerencias, no un formulario |
| Rol de administrador dentro del hogar | REQ-001. Dos personas, los mismos permisos |
| Metas de ahorro (`metas_ahorro` del dominio) | Sin fuente automática. Entra sólo si se puede derivar de los movimientos, no como formulario mensual |

---

## En progreso

| ID | Título | % tareas | Última edición |
|----|--------|----------|----------------|

---

## Done

| ID | Título | Cerrada | Verificada por |
|----|--------|---------|----------------|

---

## Archived (descartadas / superseded)

| ID | Título | Motivo | Reemplazada por |
|----|--------|--------|-----------------|

---

## Convenciones

- **IDs:** `NNNN-kebab-slug`, secuencial, nunca se reutilizan. Sin código de autor: proyecto de
  una sola persona, así que la capa de Asignaciones (`/assign-*`) no se usa.
- **Prioridad:** P0 (bloquea el hito) / P1 (necesario para cerrarlo) / P2 (mejora, puede diferirse)
- **Estado:** draft → approved → in_progress → done | archived
- **Owner:** quién es responsable de redactar + cerrar la spec
