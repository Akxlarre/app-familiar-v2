# Requerimientos — app-familiar v2

> Formato: ID · tipo · user story · criterios de aceptación · prioridad MoSCoW · estado.
> Cada requerimiento declara su **costo de entrada** (ver R-01 en `constraints.md`).
> Última revisión: 2026-08-11

Estados: `Draft` · `Approved` · `Implemented`

---

## Hogar

### REQ-001 · Crear hogar y unirse por código
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** manual, una vez

> Como persona que instala la app, quiero crear un hogar y darle un código a mi pareja,
> para que los dos veamos los mismos datos.

- [ ] Al registrarse sin hogar, se ofrece crear uno o unirse con código
- [ ] `create_household` genera un código único
- [ ] `join_household_by_code` asocia el perfil al hogar existente
- [ ] Un perfil pertenece exactamente a un hogar
- [ ] Ambos miembros tienen los mismos permisos — no hay rol de administrador

---

## Captura — el espinazo

### REQ-010 · Conectar la casilla de correo
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** manual, una vez

> Como usuario, quiero conectar mi Gmail una sola vez, para que mis gastos aparezcan solos.

- [ ] OAuth de Google con consentimiento explícito de alcance
- [ ] Se guarda el refresh token y se renueva sin intervención
- [ ] Se puede elegir qué carpeta o etiqueta vigilar
- [ ] Se puede desconectar, y al hacerlo se borran los tokens

### REQ-011 · Movimientos desde el correo del banco
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** **automática**

> Como usuario, quiero que un cargo de mi tarjeta aparezca como movimiento sin que yo escriba nada.

- [ ] Un proceso periódico lee los correos nuevos y aplica los parsers configurados
- [ ] Del correo se extraen monto, comercio, fecha, cuenta y número de cuota si lo hay
- [ ] Si el parser resuelve todo con confianza, se crea el movimiento
- [ ] Si algo no se resuelve, la captura queda en la bandeja — nunca se descarta sola
- [ ] Un mismo correo no genera dos movimientos aunque se procese dos veces

### REQ-012 · Bandeja única de revisión
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** confirmar

> Como usuario, quiero un solo lugar donde revisar lo que el sistema capturó y no pudo resolver.

- [ ] Correos y boletas conviven en la misma bandeja, distinguidos por origen
- [ ] Cada ítem muestra el dato crudo y lo que el sistema interpretó
- [ ] Se puede confirmar, corregir o descartar
- [ ] Corregir enseña: la próxima captura igual se resuelve sola (ver REQ-013)
- [ ] Reprocesar reintenta con la configuración actual

### REQ-013 · Aprender la categoría del comercio
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** confirmar, una vez por comercio

> Como usuario, quiero decir una sola vez que "UBER *TRIP" es Transporte y que nunca más me lo pregunte.

- [ ] Al categorizar un movimiento se guarda la asociación comercio → categoría
- [ ] Los movimientos siguientes de ese comercio se categorizan solos
- [ ] La asociación se puede editar y borrar
- [ ] El match tolera variaciones del texto del comercio

### REQ-014 · Boleta fotografiada
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** **un gesto**

> Como usuario, quiero sacarle una foto a la boleta y que se convierta en gasto y en despensa.

- [ ] Se sube la imagen y se extraen comercio, fecha, total e ítems
- [ ] Cada ítem se intenta resolver contra el catálogo usando los alias conocidos
- [ ] Lo que no resuelve se ofrece resolver a mano, y eso crea un alias nuevo
- [ ] Al confirmar se crea el movimiento, se actualiza la despensa y se registran los precios
- [ ] La imagen original queda guardada

---

## Artículos

### REQ-020 · Catálogo único
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** **automática**

> Como sistema, necesito que un artículo exista una sola vez, para que la despensa y la nutrición
> hablen del mismo objeto.

- [ ] Un artículo tiene nombre canónico, marca opcional y código de barras opcional
- [ ] Lleva `procedencia` (`manual` · `openfoodfacts` · `boleta` · `verificado`) y `creado_por`
- [ ] La faceta nutricional es opcional y 1:1
- [ ] Un solo sistema de alias, con origen
- [ ] Dos artículos se pueden fusionar, y los alias del perdedor sobreviven

### REQ-021 · Buscar alimentos en Open Food Facts
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** **un gesto**

> Como usuario, quiero escanear un código de barras y que el alimento aparezca con sus macros.

- [ ] Búsqueda por código de barras y por texto
- [ ] Se prioriza la instancia chilena, con fallback global
- [ ] El resultado se guarda en el catálogo con procedencia `openfoodfacts`
- [ ] Si ya existe un artículo con ese código, no se duplica

---

## Dinero

### REQ-030 · Cuentas
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** manual, una vez

- [ ] Débito, crédito, efectivo y billetera digital
- [ ] Las de crédito llevan cupo y días de facturación y vencimiento
- [ ] Cada cuenta puede vincularse a un correo y a una carpeta para la captura

### REQ-031 · Cuotas
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** **automática**

> Como usuario, quiero ver cuánto debo en cuotas sin haber anotado ninguna.

- [ ] El parser extrae "Cuota N de M" del correo
- [ ] Se agrupan las cuotas de una misma compra
- [ ] Se ve el total comprometido y lo que queda por pagar

### REQ-032 · Presupuestos
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** manual, mensual

- [ ] Presupuesto por categoría y mes, del hogar o personal
- [ ] Se ve el porcentaje consumido en tiempo real
- [ ] Avisa al superar un umbral configurable

### REQ-033 · Gasto compartido
**Tipo** Funcional · **Prioridad** Could · **Estado** Draft · **Entrada** confirmar

- [ ] Un movimiento se puede dividir entre los miembros
- [ ] Se ve el saldo entre ambos

---

## Despensa

### REQ-040 · Qué hay en casa
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** **automática**

> Como usuario, quiero saber si tengo atún sin haber registrado que lo compré.

- [ ] La despensa se puebla desde las boletas confirmadas
- [ ] Cada artículo tiene estado, no cantidad
- [ ] Se ve la fecha de la última compra
- [ ] Se puede marcar "se acabó" en un toque

### REQ-041 · Inferir el consumo por recompra
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** **automática**

> Como usuario, quiero que el sistema deduzca que algo se terminó sin que yo se lo diga.

- [ ] Volver a comprar un artículo cierra el ciclo del anterior
- [ ] Con dos o más ciclos se calcula la cadencia de recompra
- [ ] Superada la cadencia esperada, el sistema **pregunta** si se acabó
- [ ] Nunca cambia el estado sin confirmación (R-04)

### REQ-042 · Lista de compras
**Tipo** Funcional · **Prioridad** Must · **Estado** Approved · **Entrada** mixta

- [ ] Se agregan artículos del catálogo o texto libre
- [ ] Lo agotado y lo sugerido por cadencia se proponen para agregar
- [ ] Los dos miembros la ven al mismo tiempo
- [ ] Al comprar, la boleta marca lo que estaba en la lista

### REQ-043 · Historial de precios
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** **automática**

- [ ] Cada boleta registra el precio por artículo y comercio
- [ ] Se ve la evolución y dónde está más barato

---

## Alimentación

### REQ-050 · Registrar una comida
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** un gesto

> Como usuario, quiero registrar lo que comí eligiendo de una lista corta, no buscando en un
> catálogo de millones.

- [ ] El selector prioriza lo que hay en la despensa
- [ ] Se puede escanear un código de barras
- [ ] Se puede repetir una comida guardada en un toque
- [ ] El registro congela sus macros (RN-04)

### REQ-051 · Objetivo calórico
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** manual, una vez

- [ ] El perfil define sexo, nacimiento, altura, actividad y objetivo
- [ ] El objetivo calórico se **deriva** del último peso registrado en Cuerpo
- [ ] Se puede sobrescribir a mano de forma explícita
- [ ] Al registrar un peso nuevo, el objetivo se actualiza solo

### REQ-052 · Recetas
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** manual, una vez por receta

- [ ] Los ingredientes apuntan al catálogo
- [ ] Los macros se derivan, nunca se tipean (RN-05)
- [ ] Se indica cuántos ingredientes hay en la despensa

### REQ-053 · Sugerir qué cocinar
**Tipo** Funcional · **Prioridad** Should · **Estado** Draft · **Entrada** **automática**

> Como usuario, quiero que la app me diga qué puedo cocinar con lo que tengo, en vez de pedirme
> que llene un plan semanal.

- [ ] Se proponen recetas ordenadas por cuántos ingredientes ya están en casa
- [ ] Aceptar una sugerencia la agenda
- [ ] Lo que falta se puede mandar a la lista de compras
- [ ] El plan de la semana es el resultado de aceptar sugerencias, no un formulario

---

## Cuerpo

### REQ-060 · Serie de mediciones
**Tipo** Funcional · **Prioridad** Should · **Estado** Approved · **Entrada** manual con intención

- [ ] Peso y medidas con fecha, más notas y foto opcional
- [ ] Es el **único** lugar donde se registra el peso (RN-08)
- [ ] Alimentación y Entrenamiento la leen; ninguno la copia

---

## Entrenamiento

### REQ-070 · Rutinas y sesiones
**Tipo** Funcional · **Prioridad** Could · **Estado** Approved · **Entrada** manual con intención

- [ ] Rutina personal con ejercicios, series, reps y peso objetivo
- [ ] Registro de la sesión con lo realmente hecho, incluidos RPE y RIR
- [ ] Historial y progreso por ejercicio
- [ ] Las metas de peso corporal leen de Cuerpo

---

## No funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | Los dos miembros ven los cambios del otro sin recargar (Realtime en despensa, listas y movimientos) |
| RNF-02 | Una consulta habitual se responde en menos de 30 segundos de interacción, incluido abrir la app |
| RNF-03 | RLS activo en todas las tablas; un hogar jamás ve datos de otro |
| RNF-04 | La captura periódica no pierde correos: lo que no se procesa queda pendiente y se reintenta |
| RNF-05 | Los tokens de OAuth nunca llegan al cliente |
| RNF-06 | La app es usable en móvil desde el navegador |
