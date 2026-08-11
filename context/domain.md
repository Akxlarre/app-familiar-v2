# Dominio — app-familiar v2

> Lenguaje ubicuo, contextos acotados y entidades. Es la fuente de verdad sobre **cómo se llaman
> las cosas** y **qué significa cada una**. Antes de crear una entidad nueva, buscala acá.
> Última revisión: 2026-08-11

---

## Lenguaje ubicuo

La regla que v1 rompió: **un sustantivo del negocio se modela una sola vez.** Si dos módulos
necesitan la misma cosa con facetas distintas, se separa la faceta — no se duplica la cosa.

| Término | Definición | Nunca confundir con |
|---|---|---|
| **Artículo** | Algo que existe en el mundo y se puede comprar. Identidad pura: nombre, marca, código de barras. No dice si lo tenemos. | Despensa (eso es posesión) |
| **Despensa** | Lo que *este hogar* tiene. Presencia, no cantidad. | Artículo (eso es identidad) |
| **Captura** | Un dato que entró al sistema sin que nadie lo escribiera: un correo del banco, una boleta fotografiada. | Movimiento (la captura lo *produce*) |
| **Movimiento** | Plata que entró o salió de una cuenta. | Captura (el origen), Boleta (el comprobante) |
| **Boleta** | El comprobante de una compra, con su imagen y sus ítems. Puede generar un movimiento y actualizar la despensa. | Movimiento |
| **Registro de comida** | Un evento: qué comió alguien, cuándo, cuánto. Congela sus macros. | Receta (una definición) |
| **Receta** | Una definición: qué ingredientes lleva. Sus macros se derivan. | Registro (un evento) |
| **Medición** | Una fila de la serie corporal: peso, medidas, fecha. | Meta (un objetivo sobre esa serie) |
| **Alias** | Un texto alternativo que apunta a un artículo. Aprendido de boletas o traído de Open Food Facts. | — |

### Regla de oro sobre datos derivados

> **Los eventos congelan. Las definiciones derivan.**

Un `registro_comida` guarda sus macros calculados: dice qué pasó el martes, y si mañana se
corrige el alimento en Open Food Facts, el martes no cambia. Una `receta` los deriva de sus
ingredientes, porque una receta *es* su definición.

Corolario operativo: congelar permite podar el catálogo. Derivar obliga a `ON DELETE RESTRICT`
para siempre, y este catálogo se alimenta de OCR y de Open Food Facts — va a acumular basura.

---

## Mapa de contextos

```
                        ┌──────────────┐
                        │   CAPTURA    │  correo · boleta · bandeja única
                        └──┬────────┬──┘
              movimientos  │        │  boleta → ítems
                 ┌─────────┘        └────────┐
                 ▼                           ▼
          ┌────────────┐            ┌──────────────┐   qué es   ┌──────────────┐
          │   DINERO   │            │   DESPENSA   │◄───────────│  ARTÍCULOS   │
          └────────────┘            └──────┬───────┘            └──────┬───────┘
                                    qué hay │                          │ macros
                                            ▼                          │
                                   ┌─────────────────┐◄────────────────┘
                                   │  ALIMENTACIÓN   │
                                   └────────┬────────┘
                                peso → TDEE │        ┌────────────────┐
                                            ▼        │ ENTRENAMIENTO  │
                                     ┌───────────┐   └───────┬────────┘
                                     │  CUERPO   │◄──────────┘  metas
                                     └───────────┘

  ─────────────────────────────────────────────────────────────────────────────
   HOGAR — households · profiles — raíz de todo el RLS
```

**Captura** y **Artículos** están arriba porque alimentan al resto. En v1 la captura vivía
*dentro* de Finanzas, así que ningún otro módulo podía usarla.

---

## Contextos y entidades

### Hogar
Raíz de todo el RLS. Todo cuelga de acá vía `belongs_to_household()`.

| Entidad | Qué es |
|---|---|
| `households` | El hogar. Tiene `invite_code` y `timezone` |
| `profiles` | Perfil extendido de cada miembro, 1:1 con `auth.users` |

RPCs: `handle_new_user`, `get_my_household_id`, `belongs_to_household`, `create_household`,
`join_household_by_code`.

### Captura
Todo lo que produce datos sin tipeo. **Una sola bandeja de revisión** — v1 tenía dos colas
haciendo lo mismo (`email_transactions_log.pending_review` y `receipts.status`).

| Entidad | Qué es |
|---|---|
| `capturas` | La bandeja. Origen (`email`\|`boleta`), payload crudo, estado, qué produjo |
| `integraciones_email` | OAuth de Gmail por perfil, con carpeta a vigilar |
| `parsers_email` | Por banco y tipo de correo: cómo extraer monto, comercio y cuota |
| `boletas` | Imagen, comercio, fecha, total |
| `boleta_items` | Texto original de cada línea, cantidad, precio, artículo resuelto |

### Artículos
El catálogo compartido. **Global**: un código de barras es un hecho del mundo, no de un hogar.

| Entidad | Qué es |
|---|---|
| `articulos` | Identidad: nombre canónico, marca, código de barras, procedencia, verificado |
| `articulo_alias` | Sinónimos. `household_id` nullable: global si vino de Open Food Facts, del hogar si lo aprendió su boleta |
| `articulo_nutricion` | Faceta 1:1 **opcional**. Macros por 100 g. El detergente no la tiene |
| `categorias_articulo` | Alimento, limpieza, medicamento, otro |

> Los alias aprendidos de boletas son una huella de lo que compra el hogar. Por eso llevan
> `household_id` aunque el artículo sea global.

### Dinero

| Entidad | Qué es |
|---|---|
| `cuentas` | Débito, crédito, efectivo, billetera digital. Con titular y correo vinculado |
| `detalle_credito` | 1:1 con cuentas de crédito: cupo, día de facturación y de vencimiento |
| `categorias_gasto` | Taxonomía única. **No hay tags** — v1 tenía dos y era el mismo error que `products`/`foods` |
| `movimientos` | Monto, fecha, comercio, cuenta, categoría, captura de origen |
| `alias_comercio` | Aprende que "UBER *TRIP" es Transporte. Se enseña una vez |
| `compras_en_cuotas` | El correo del banco dice "Cuota 3 de 12": se extrae, no se tipea |
| `presupuestos` | Por categoría y mes. `profile_id` nullable para presupuesto personal |
| `metas_ahorro` | Objetivo, actual, fecha límite |
| `divisiones_movimiento` | Un gasto repartido entre los dos |

### Despensa
**Sin cantidad.** Un contador necesita las dos puntas: la entrada es automática (boleta) y la
salida es manual, así que deriva siempre hacia arriba hasta que miente.

| Entidad | Qué es |
|---|---|
| `despensa` | Estado (`disponible`\|`por_acabarse`\|`agotado`), ubicación, vencimiento, última compra |
| `movimientos_despensa` | Log: compra, agotado, confirmación, descarte |
| `listas_compra` | Lista del hogar, opcionalmente originada en un plan |
| `items_lista` | Artículo o texto libre, marcado, precio pagado, origen |
| `precios_observados` | Artículo, comercio, precio, fecha. Se llena desde las boletas |

**Cómo se infiere el consumo**, en orden de confianza:
1. **Recompra** (automática) — volver a comprar algo cierra el ciclo del anterior. Con dos o
   tres ciclos se conoce la cadencia, y de ahí sale la sugerencia de compra sin ningún mínimo
   configurado a mano.
2. **Registro de comida** (refuerzo) — evidencia secundaria.
3. **"Se acabó"** (manual) — un toque.

> **La despensa nunca adivina en silencio, pregunta.** Con evidencia suficiente muestra
> "¿se acabó el atún?" y se responde sí o no.

### Alimentación

| Entidad | Qué es |
|---|---|
| `perfil_nutricional` | Sexo, nacimiento, altura, actividad, objetivo, reparto de macros. **Sin peso** — lo lee de Cuerpo |
| `registro_comida` | Evento. Congela sus macros |
| `comidas_guardadas` + `items_comida_guardada` | Repetir una comida en un toque |
| `recetas` | Definición. **Sin columnas nutricionales** — se derivan |
| `ingredientes_receta` | Apunta al catálogo, con cantidad y unidad |
| `planes_comida` + `slots_plan` | **Resultado** de aceptar sugerencias, no formulario de 21 casillas |

`calories_target` no es columna almacenada: se deriva del último peso registrado. En v1 era una
columna que se pudría, y por eso existían `last_recalibration` e `is_manual_override`.

### Cuerpo
Existe para que el peso tenga **un solo dueño**. En v1 vivía en tres tablas.

| Entidad | Qué es |
|---|---|
| `mediciones` | Fecha, peso, cintura, cadera, pecho, brazos, piernas, notas, foto |

Alimentación la lee para el TDEE. Entrenamiento la lee para las metas de peso. Ninguno la copia.

### Entrenamiento
Entrada manual, pero del tipo que sí se sostiene: estás en el gimnasio, entre series, con
intención de registrar.

| Entidad | Qué es |
|---|---|
| `ejercicios` | Catálogo global: nombre, grupo muscular, técnica |
| `rutinas` + `ejercicios_rutina` | Rutina personal con series, reps y peso objetivo |
| `sesiones` + `series_sesion` | Lo que realmente se hizo, con RPE y RIR |
| `records_personales` | Caché de PRs |
| `metas` | PR, peso corporal, consistencia o compartida |

---

## Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Todo dato del hogar cuelga de `household_id` y se protege con RLS vía `belongs_to_household()` |
| RN-02 | Un artículo se identifica por código de barras cuando lo tiene; si no, por nombre canónico + marca |
| RN-03 | Los alias con origen `boleta` pertenecen a un hogar y no se comparten |
| RN-04 | Un registro de comida congela sus macros al crearse |
| RN-05 | Una receta nunca almacena macros: los deriva de sus ingredientes |
| RN-06 | La despensa no almacena cantidades, solo estado |
| RN-07 | Ninguna inferencia cambia el estado de la despensa sin confirmación del usuario |
| RN-08 | El peso corporal se registra solo en `mediciones`; ningún otro contexto lo copia |
| RN-09 | Una captura queda en la bandeja hasta que se confirma o se descarta — nunca se pierde |
| RN-10 | Categorizar un comercio una vez alcanza: la próxima vez se aplica solo |
