# Spec 0005 — La pantalla de la plata

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** 🟢 automático
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** hueco detectado al cerrar el hito 0.

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**
La cadena del hito 0 crea movimientos y **no hay dónde verlos**. La única pantalla con datos es
la bandeja, y la bandeja muestra sólo lo que falló. Es decir: hoy la app enseña sus errores y
esconde sus aciertos.

Esta es además la pantalla que justifica todo el proyecto. Es el lugar donde el usuario
comprueba, sin haber escrito nada, en qué se le va la plata.

**Hipótesis de valor:**
Si la lista de movimientos se llena sola, el usuario abre la app para mirar. Ese es el
comportamiento que v1 nunca consiguió, y el único que sostiene el resto del producto.

---

## 2. User Stories

- **US1**: Como usuario, quiero ver mis movimientos del mes ordenados por fecha, sin haber anotado ninguno.
- **US2**: Como usuario, quiero saber en qué categoría se me va la plata, para decidir sin hacer cuentas.
- **US3**: Como usuario, quiero corregir la categoría de un movimiento y que el sistema aprenda para la próxima.
- **US4**: Como usuario, quiero filtrar por cuenta, categoría o texto, para responder "cuánto gasté en el súper".
- **US5**: Como usuario, quiero ver de dónde salió un movimiento — qué correo lo generó — para confiar en él.

---

## 3. Acceptance Criteria (Gherkin)

### La lista

- **AC1**: Given movimientos del hogar, When se abre Plata, Then se ven agrupados por día, más recientes primero, con comercio, monto, cuenta y categoría.
- **AC2**: Given un movimiento de ingreso y uno de gasto, When se muestran, Then se distinguen sin leer el signo — el color y la posición lo dicen.
- **AC3**: Given montos en pesos chilenos, When se muestran, Then usan punto como separador de miles y **no** tienen decimales (RB-04).
- **AC4**: Given más movimientos de los que caben, When se llega al final de la lista, Then se cargan más sin recargar la pantalla y sin perder la posición.
- **AC5**: Given un movimiento nacido de una captura, When se abre su detalle, Then se ve el correo original que lo generó.

### Los números

- **AC6**: Given el mes en curso, When se abre Plata, Then el hero muestra gastado, ingresado y saldo del período.
- **AC7**: Given los gastos del mes, When se miran por categoría, Then se ve el reparto ordenado de mayor a menor, con monto y porcentaje.
- **AC8**: Given un período sin movimientos, When se abre, Then se dice que no hay nada en ese período, distinguiéndolo de "todavía no hay datos en la app".

### Corregir y aprender

- **AC9**: Given un movimiento mal categorizado, When el usuario le cambia la categoría, Then el cambio se guarda de inmediato.
- **AC10**: Given ese cambio, When el usuario marca "recordar este comercio", Then los movimientos futuros de ese comercio usan la categoría nueva (RN-10).
- **AC11**: Given ese cambio con "recordar" marcado, When se pregunta por los movimientos **pasados** del mismo comercio, Then se ofrece aplicarlo también a ellos, y el usuario decide (R-04: nada cambia en silencio).
- **AC12**: Given un movimiento creado por error, When el usuario lo borra, Then su captura vuelve a estado revisable en vez de desaparecer (RN-09).

### Filtros

- **AC13**: Given la lista, When se filtra por cuenta, categoría, tipo o texto de comercio, Then los números del hero se recalculan sobre lo filtrado.
- **AC14**: Given un filtro aplicado, When se recarga la página, Then el filtro sigue puesto — vive en la URL.
- **AC15**: Given una búsqueda por texto, When el comercio tiene acentos o mayúsculas distintas, Then igual matchea.
  <br>_`search-filter.utils.ts` ya normaliza._

### Edge cases obligatorios

- **AC-E1**: Given un movimiento sin categoría, When se muestra, Then se ve como "sin categorizar" y se puede arreglar de un toque desde la fila.
- **AC-E2**: Given un movimiento de una cuenta borrada, When se muestra, Then no rompe la fila.
- **AC-E3**: Given un movimiento en cuotas, When se muestra en la lista, Then dice "cuota 3 de 12" y enlaza a la compra completa (spec 0007).
- **AC-E4**: Given 5.000 movimientos, When se abre la pantalla, Then el primer render cumple RNF-02 — no se traen todos.

---

## 4. Out of scope

- ❌ **Crear un movimiento a mano.** Rompería R-01 en la pantalla que más lo representa. Si un gasto en efectivo hay que registrarlo, se decide con datos de uso, no ahora.
- ❌ **Editar el monto o la fecha** de un movimiento capturado. Corregir la categoría sí; reescribir lo que dijo el banco, no.
- ❌ **Gráficos de evolución multi-mes.** Primero que exista un mes.
- ❌ **Exportar a Excel / CSV.** Nadie lo pidió.
- ❌ **Cuentas, cuotas y presupuestos.** Son subsecciones hermanas con sus propias specs (0006, 0007, 0008).

---

## 5. Dependencias

### Specs previas
- 0001 — sin la cadena no hay movimientos que ver.
- 0002, 0003 — vocabulario de piezas y lugar en la navegación.

### Capacidades del proyecto que se asumen existentes
- Tablas `movimientos`, `cuentas`, `categorias_gasto`, `alias_comercio`, `capturas`.
- RPC `categoria_para_comercio`, función `normalizar_comercio`.
- `BaseFacade` con SWR, `createRequestGuard` (los filtros producen respuestas fuera de orden).

### Capacidades nuevas requeridas
- `MovimientosRepository` y `MovimientosFacade` con filtros y paginación.
- RPC o vista para el reparto por categoría del período (agregar en el cliente 5.000 filas viola RNF-02).
- Drawer de detalle de movimiento, con el correo de origen.
- Acción "aplicar también a los movimientos pasados de este comercio" (AC11).

---

## 6. Datos y modelo

- **Tablas:** sin cambios de esquema previstos. Puede hacer falta un índice por `(household_id, fecha DESC)`.
- **Vista o RPC nueva:** resumen por categoría y período.
- **Modelo UI:** `Movimiento`, `ResumenPeriodo`, `FiltroMovimientos`.
- **RLS:** ya cubierta por `belongs_to_household()`.

---

## 7. UX y flujos

- **Pantalla:** `/app/plata/movimientos`, tab por defecto de Plata.
- **Forma:** hero slim con los tres números del período + panel que llena con la lista agrupada por día. El reparto por categoría vive en el hero como banda, o en un segundo panel en `--fill-screen-2` cuando hay ancho.
- **Selector de período:** mes en curso por defecto, con anterior/siguiente. No un rango libre con dos calendarios: eso es un formulario.
- **Happy path:** entrar, mirar, salir. Sin tocar nada.
- **Corregir:** tocar la fila → drawer → cambiar categoría → checkbox "recordar" → guardar. Mismo patrón que la bandeja, a propósito.
- **Estados:** skeleton en primera carga; vacío distinguiendo "no hay nada este mes" de "todavía no hay datos"; error con reintento por bloque.

---

## 8. Métricas de éxito post-launch

- % de movimientos que llegan ya categorizados (sube con el uso, por REQ-013).
- Correcciones de categoría por semana (debería tender a bajar).
- Aperturas de Plata por semana — es la pantalla que mide si la app se usa para mirar.

---

## 9. Notas / decisiones abiertas

- [ ] 🤖 ¿El reparto por categoría se calcula en una vista materializada o en un RPC por período? Depende del volumen real; con un hogar probablemente alcance un RPC.
- [ ] 🧑 ¿Aplicar el alias a movimientos pasados es una sola acción o una confirmación con conteo ("se aplicará a 14 movimientos")? Con conteo parece más honesto.
- [x] ¿Se pueden crear movimientos a mano? **No en esta spec.** Es la pantalla donde R-01 se pone a prueba.
- [x] ¿Filtros en URL o en memoria? **En URL.** Recargar y perder el filtro es de las cosas que hacen que una app se sienta un prototipo.

---

## Changelog

- 2026-08-11 — draft inicial.
