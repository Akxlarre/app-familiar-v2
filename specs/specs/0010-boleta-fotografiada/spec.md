# Spec 0010 — Boleta fotografiada

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** 🔵 un gesto
> **Hito:** 2 — boleta → despensa

---

## 1. Contexto de negocio

**Origen:** REQ-014.

**Persona afectada:** quien hace las compras.

**Problema que resuelve:**
El correo del banco dice *gastaste $47.320 en Jumbo*. No dice **qué compraste**. Toda la mitad
del producto que tiene que ver con la casa —despensa, lista, precios, y después alimentación—
depende de saber qué había adentro de esa compra, y no existe ninguna fuente automática para eso.

La boleta es la única. Y es el segundo —y último— gesto que el producto le pide al usuario:
sacar una foto en la fila de la caja. A cambio, se puebla la despensa, se registran los precios y
la lista de compras se marca sola.

**Hipótesis de valor:**
Una foto de tres segundos produce entre diez y cuarenta datos. Es la mejor relación
esfuerzo/resultado de todo el producto, y la única forma de que la despensa exista sin que nadie
inventaríe nada.

---

## 2. User Stories

- **US1**: Como usuario, quiero sacarle una foto a la boleta y que se convierta en gasto y en despensa.
- **US2**: Como usuario, quiero que los ítems que ya compré antes se reconozcan solos.
- **US3**: Como usuario, quiero resolver a mano sólo lo que el sistema no reconoció, y que aprenda.
- **US4**: Como usuario, quiero que la boleta quede guardada por si tengo que reclamar.
- **US5**: Como usuario, quiero que la boleta se ligue al movimiento que ya entró por el correo del banco, en vez de duplicar el gasto.

---

## 3. Acceptance Criteria (Gherkin)

### Subir y leer

- **AC1**: Given una foto de boleta desde la cámara o la galería, When se sube, Then se guarda en Storage y se crea una `captura` con origen `boleta` antes de intentar interpretarla (RN-09).
- **AC2**: Given una boleta subida, When se procesa, Then se extraen comercio, fecha, total e ítems con su texto original, cantidad y precio.
- **AC3**: Given el OCR falla o no reconoce nada, When termina, Then la captura queda en la bandeja con el motivo, y la imagen no se pierde.
- **AC4**: Given una boleta procesada, When el usuario la abre, Then puede ver la imagen original junto a lo interpretado.

### Resolver ítems

- **AC5**: Given un ítem cuyo texto ya tiene alias del hogar, When se procesa, Then resuelve solo al artículo correspondiente (spec 0009).
- **AC6**: Given un ítem que no resuelve, When el usuario lo asocia a un artículo, Then se crea el alias y el siguiente igual resuelve solo.
- **AC7**: Given un ítem que no corresponde a ningún artículo (bolsa, propina, descuento), When el usuario lo marca como ignorable, Then no entra a la despensa y no vuelve a preguntarse.
- **AC8**: Given una boleta con ítems sin resolver, When se confirma igual, Then se crea el movimiento y entran a despensa **sólo** los resueltos.

### Confirmar

- **AC9**: Given una boleta confirmada, When termina, Then se crea el movimiento, se actualiza la despensa, se registran los precios observados y se marcan los ítems de la lista de compras.
- **AC10**: Given ese conjunto de escrituras, When una falla, Then no queda a medias — es atómico.
- **AC11**: Given un movimiento ya creado por el correo del banco para esa misma compra, When se confirma la boleta, Then se ligan en vez de crear un segundo gasto.
- **AC12**: Given una boleta sin movimiento bancario asociado (pago en efectivo), When se confirma, Then se crea el movimiento con la cuenta de efectivo.

### Edge cases obligatorios

- **AC-E1**: Given una foto borrosa o cortada, When el OCR devuelve un total que no cuadra con la suma de los ítems, Then se avisa antes de confirmar y no se corrige en silencio (R-04).
- **AC-E2**: Given una boleta con el mismo artículo dos veces, When se procesa, Then son dos líneas, no una con cantidad 2 — la despensa no cuenta (R-03) pero el precio observado sí necesita ambas.
- **AC-E3**: Given la misma boleta subida dos veces, When se procesa, Then se detecta como duplicada por comercio, fecha y total, y se pregunta.
- **AC-E4**: Given una boleta de un comercio que no es supermercado (farmacia, ferretería), When se procesa, Then igual funciona: los ítems que no son alimento van al catálogo con su categoría.
- **AC-E5**: Given un usuario sin conexión al sacar la foto, When vuelve la conexión, Then la subida se reintenta y la foto no se pierde.

---

## 4. Out of scope

- ❌ **Escribir una boleta a mano.** Rompe R-01. Si no hay foto, no hay boleta.
- ❌ **Boleta electrónica por correo (DTE del SII).** Fuente automática interesantísima y una spec propia; no se mezcla con OCR de foto.
- ❌ **Editar el total o el comercio** interpretados. Corregir la asociación de un ítem sí; reescribir el comprobante, no.
- ❌ **Dividir la boleta entre miembros.** Es la spec 0023.
- ❌ **Reconocer marcas por logo.** Sobre-ingeniería.

---

## 5. Dependencias

### Specs previas
- 0009 — sin catálogo no hay contra qué resolver los ítems. **Bloqueante duro.**
- 0001 — reusa `capturas` y la bandeja: la boleta es el segundo origen, no una cola nueva. v1 tenía dos colas haciendo lo mismo.
- 0005, 0006 — el movimiento resultante y su cuenta.

### Capacidades del proyecto que se asumen existentes
- `capturas` con `origen = 'boleta'` y `payload.imagen`.
- Bandeja con su drawer de completar.
- Storage de Supabase.

### Capacidades nuevas requeridas
- Bucket de Storage con RLS por hogar.
- **Servicio de OCR.** Decisión abierta: modelo multimodal vía edge function, o un OCR clásico + parseo de líneas. Es el mayor riesgo técnico del hito.
- Tablas `boletas` y `boleta_items`.
- Edge function `procesar-boleta`.
- RPC atómico de confirmación (movimiento + despensa + precios + lista), hermano de `resolver_captura`.
- Captura desde cámara vía web API (R-05: nada de Capacitor).

---

## 6. Datos y modelo

- **Tablas nuevas:** `boletas` (imagen, comercio, fecha, total), `boleta_items` (texto original, cantidad, precio, artículo resuelto).
- **Modelo UI:** `Boleta`, `ItemBoleta`, `ResolucionBoleta`.
- **Storage:** la imagen no se borra al confirmar (AC4, REQ-014).
- **Atomicidad:** AC10 exige un RPC. Cuatro escrituras desde el cliente dejan estados imposibles el día que una falla.

---

## 7. UX y flujos

- **Entrada:** botón de acción en Casa y en Hoy. Cámara directa, sin pasos intermedios.
- **Mientras procesa:** la app no se bloquea. La captura queda en la bandeja y avisa cuando terminó.
- **Revisar:** una pantalla propia (no un drawer: hay demasiado que mirar). Imagen a un lado, ítems al otro. Los resueltos vienen marcados; el foco está en los que no.
- **Resolver un ítem:** drawer con búsqueda en el catálogo, "crear artículo" e "ignorar".
- **Confirmar:** un botón que dice lo que va a pasar — "Crear gasto de $47.320 y sumar 12 artículos a la despensa".
- **Estados:** subiendo, procesando, listo para revisar, error de OCR con la imagen intacta.

---

## 8. Métricas de éxito post-launch

- % de ítems que resuelven solos (sube con los alias; **la métrica del hito**).
- Boletas subidas por semana. Si tiende a cero, el gesto no se sostuvo y hay que repensar el hito 2 entero.
- Tiempo entre subir y confirmar.

---

## 9. Notas / decisiones abiertas

- [x] **OCR: cuál.** **Modelo multimodal**, empezando por el más barato que funcione. Un modelo que ve la imagen entiende el layout irregular de una boleta chilena; un OCR de líneas sería RB-01 otra vez pero peor. El costo por uso es despreciable a 4-8 boletas por mes, pero **se mide con boletas reales antes de fijar el modelo** — y la edge function lo deja intercambiable a propósito.
- [x] ¿Cómo se liga la boleta al movimiento del banco (AC11)? **Comercio normalizado + fecha ±2 días + total exacto.** Con match único se liga solo; con varios o ninguno se pregunta (R-04).
- [x] ¿La revisión es pantalla o drawer? **Pantalla propia.** Una boleta de súper trae 20-40 líneas y hay que compararlas contra la foto: eso necesita ancho. Es la **única excepción declarada** a "los formularios viven en drawers" (spec 0002, regla de composición 2), y está anotada allá.
- [x] ¿Boleta y correo comparten bandeja? **Sí.** Una sola cola de revisión — es el error explícito que se corrigió de v1.
- [x] ¿Se puede escribir una boleta a mano? **No.**

---

## Changelog

- 2026-08-11 — draft inicial.
