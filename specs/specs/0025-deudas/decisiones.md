# Decisiones — Deudas (spec 0025)

> Interrogatorio del 2026-08-12, modo propuesta. Seis decisiones de producto cerradas
> antes de escribir una línea de código, cada una con su razón y su costo aceptado.

---

## D1 — Las cuotas son una deuda, y viven adentro de Deudas

**Decidido:** Plata pasa a tener **Movimientos · Cuentas · Deudas · Presupuestos**.
Las compras en cuotas dejan de ser una subsección propia y viven dentro de Deudas,
junto a los créditos.

**Por qué:** el número que la propuesta persigue —*cuánto debo en total*— sólo puede
existir si hay un lugar que vea todas las fuentes. Con Cuotas y Deudas como
hermanas, ese total vive arbitrariamente en una de las dos, o se duplica y las dos
copias divergen.

**Costo aceptado:** llegar a las cuotas cuesta un nivel más de navegación, y
"Deudas" es una palabra más pesada que "Cuotas".

**Qué arrastra:**
- La **spec 0007** deja de ser una subsección de Plata y pasa a ser una vista dentro
  de Deudas. Sus AC5 y AC6 (total comprometido, próxima facturación) se absorben en
  el total unificado de esta spec.
- El ROADMAP cambia el orden: la 0025 va antes que la 0007.
- **Se decidió a tiempo:** los tabs de subsección de Plata todavía no existen
  (`acceptance.md` de la 0005 lo declara), así que no hay nada construido que
  reacomodar.

---

## D2 — Entran cuotas y créditos en pesos. Hipotecario e informales, no

**Decidido:** compras en cuotas, crédito de consumo y crédito automotriz. Todo en
pesos chilenos, con cuota fija.

**Fuera, y por qué:**
- **Hipotecario:** está en UF. Entrarlo rompe RB-04 (pesos, sin decimales) y obliga
  a traer el valor de la UF de una fuente externa, con un saldo en pesos que cambia
  todos los días sin que pase nada. Es una segunda moneda dentro de una app que
  declaró tener una sola.
- **Deudas informales** ("le debo a mi mamá"): sin fuente automática en ninguna de
  las dos puntas. Es el mismo motivo por el que la spec 0023 se archivó antes de
  construirse (R-01).

**Consecuencia aceptada:** quien tenga hipotecario va a ver un "cuánto debo"
incompleto. Tiene que estar **declarado en la pantalla**, no silencioso — un total
que se presenta como completo y no lo es, miente.

**Qué la reabre:** que el hipotecario aparezca por correo en pesos, o que el hogar
decida que vale la pena la segunda moneda.

---

## D3 — "Cuánto debo" es lo que falta pagar, no el saldo insoluto

**Decidido:** el total es **cuotas pendientes × monto de cuota**. Incluye los
intereses futuros, porque es plata que va a salir del bolsillo.

**Por qué:** esta app es de flujo de caja — responde *"¿me alcanza?"*, no *"¿cuánto
vale mi patrimonio?"*. Y se calcula **sin conocer la tasa**: basta cuánto es la
cuota y cuántas faltan. Una tasa mal tipeada produce un número que miente sin que
nada lo delate; no pedirla elimina esa clase entera de error.

**Costo aceptado:** el número no sirve para decidir un prepago — prepagar cuesta
menos que eso, porque perdona intereses futuros. Si algún día hace falta, entra
como dato aparte y explícito, nunca reemplazando a éste.

**Qué arrastra:** **no se pide la tasa de interés en ningún formulario.** El modelo
de datos no lleva `tasa` ni tabla de amortización. Esto simplifica D4.

---

## D4 — El alta de un crédito son cuatro campos

**Decidido:** nombre, monto de la cuota, total de cuotas y fecha de la primera.
De ahí se deriva todo: cuántas van, cuánto falta y cuándo termina.

**Por qué:** es la misma excepción que R-01 ya concede a las cuentas — manual una
vez, automático para siempre. Y no depende de que los correos de crédito traigan
"cuota N de M", que es un dato que **todavía nadie vio**: los parsers se escribieron
sin un correo real delante.

**Costo aceptado:** no se sabe el monto original pedido ni cuánto se paga de
intereses en total. Son dos números que educan, pero ninguno hace falta para el
total de D3.

**Parqueada 🌍 (necesita datos que no existen):** si los correos de cargo de crédito
resultan traer el número de cuota, el alta puede volverse automática y estos cuatro
campos pasan a ser una corrección, no un requisito. **Disparador:** el primer
crédito real capturado por `process-bank-emails`.

---

## D5 — El pago de una cuota es un gasto, pero no se presupuesta

**Decidido:** el movimiento sigue apareciendo en Plata —la plata salió, y el
"gastado este mes" tiene que coincidir con lo que salió de la cuenta— pero cae en
una categoría reservada **Deudas** que los presupuestos por categoría **no**
presupuestan.

**Por qué:** un presupuesto de Supermercado es una decisión que se toma cada mes;
una cuota es un compromiso fijo que no se puede bajar. Mezclarlos hace que el
presupuesto diga "te pasaste" cuando no había nada que elegir — y el mes que empieza
un crédito nuevo, rompe el presupuesto entero.

**Qué arrastra:**
- **Spec 0008 (presupuestos):** la propuesta automática desde la mediana de tres
  meses tiene que **excluir** la categoría Deudas, o propondría presupuestar lo
  imposible.
- **Spec 0005 (Plata):** el reparto por categoría sigue mostrando Deudas. No se
  esconde: se ve cuánto del mes se va en compromisos fijos.
- La categoría Deudas es **de sistema**, no del hogar: no se puede borrar ni
  renombrar, porque hay lógica colgando de ella.

---

## D6 — El cargo se liga al crédito aprendiendo el comercio

**Decidido:** la primera vez la app propone *"¿este cargo es tu crédito Auto?"* y el
usuario confirma. Desde ahí, todo cargo de ese comercio se liga solo.

**Por qué:** es la **misma maquinaria de `alias_comercio`** que ya funciona para
categorizar (REQ-013, RN-10) — no hay que inventar nada, y el patrón se normaliza
en SQL, que es donde ya vive. Sin ligar el cargo, la categoría Deudas de D5 no
podría asignarse sola y la promesa de "manual una vez" de D4 se rompería.

**Costo aceptado:** la primera cuota exige un toque. Si el banco cambia el texto
del correo, hay que confirmar de nuevo — pero eso ya pasa con las categorías y el
flujo de corrección existe.

**Qué arrastra:** el avance del crédito sale de **cargos realmente capturados**, no
del almanaque. Un mes sin cargo no avanza la cuenta: si el pago falló, la app no
puede fingir que ocurrió.
