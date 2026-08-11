---
name: grill_me
description: Interroga al usuario sin tregua para cerrar decisiones — sea una propuesta nueva antes de volverla spec, o las decisiones abiertas de specs ya escritas. Usar cuando el usuario diga "interrógame", "gríllame", "estresá esta propuesta", "resolvamos las dudas", "cerremos las decisiones abiertas", o invoque /grill_me.
---

# grill_me — cerrar decisiones, una por vez

Este skill existe porque un producto no se define escribiendo specs: se define **cerrando las
decisiones que las specs dejan abiertas**. Y esas decisiones no se cierran solas ni las puede
cerrar el agente, porque dependen de cómo el usuario imagina el producto.

## Dos modos

| Modo | Cuándo | Insumo |
|---|---|---|
| **Propuesta** | El usuario plantea algo nuevo y hay que estresarlo antes de volverlo spec | Lo que acaba de decir |
| **Cierre** | Ya hay specs escritas con decisiones abiertas | Los `- [ ]` de la sección "Notas / decisiones abiertas" de cada spec |

El modo se deduce del pedido. Si el usuario dice "resolvamos las dudas" y existe `specs/`, es
**Cierre**. Si trae una idea nueva, es **Propuesta**.

---

## Regla que gobierna los dos modos

> **Una pregunta a la vez, con tu recomendación adelante.**

Preguntar varias cosas de golpe desconcierta y convierte el interrogatorio en un formulario —
que es justo lo que este producto evita en todas partes. Usá `AskUserQuestion`: opciones
clicleables, la recomendada primera y marcada como tal.

Nunca preguntes algo que puedas averiguar. Si la respuesta está en `context/domain.md`,
`context/constraints.md`, `specs/`, `indices/` o el código, **andá a buscarla**. Preguntar algo
que ya está decidido en el repo hace perder la confianza en todo el interrogatorio.

---

## Modo Cierre — el procedimiento

### 1. Triaje ANTES de preguntar

Junta las decisiones abiertas:

```bash
grep -n "^- \[ \]" specs/specs/*/spec.md
```

Y clasificá **cada una** en uno de tres cajones. Este paso no es opcional: sin él, una
planificación grande deja cuarenta o cincuenta decisiones abiertas y el interrogatorio se vuelve
inabordable.

| Cajón | Qué es | Qué hacés |
|---|---|---|
| 🧑 **Tuya** | Producto, valores, cómo se usa, cuánto se gasta. Sólo el usuario la puede contestar | **Grillás** |
| 🤖 **Mía** | Técnica, reversible, sin consecuencia visible para el usuario | **La cerrás vos** y lo informás en bloque, sin preguntar |
| 🌍 **De la realidad** | Necesita datos que todavía no existen: correos reales, meses de uso, un estado de cuenta | **La dejás parqueada** con el disparador explícito que la va a poder cerrar |

Marcá el cajón en el propio `.md`, en la línea de la decisión — `- [ ] 🧑 ¿…?`. No crees un
archivo aparte con la lista: duplicar las decisiones garantiza que las dos copias diverjan.

Antes de grillar, mostrale al usuario el recuento: *"49 abiertas — 13 tuyas, 24 mías, 12 de la
realidad. Te pregunto las 13."* Saber cuántas faltan es lo que hace que se llegue al final.

### 2. Ordená por costo de equivocarse, no por número de spec

1. **Lo irreversible primero.** Un esquema con RLS, una decisión que define una tabla, algo que
   condiciona la forma de varias specs.
2. **Lo que condiciona otras decisiones.** Cerrar una que arrastra tres es mejor que cerrar tres sueltas.
3. **Lo que sólo afecta a una pantalla.** Al final; si el usuario se cansa antes, se perdió poco.

### 3. Preguntá bien

Cada pregunta lleva:

- **La decisión, en una línea**, sin jerga técnica si la decisión no es técnica.
- **Por qué importa** — qué cambia según la respuesta. Si no lo podés explicar, probablemente sea
  una decisión 🤖 y no había que preguntarla.
- **Tu recomendación y su razón.** Un interrogatorio sin opinión le pasa el trabajo al usuario.
- **Qué se pierde** con la opción que no recomendás. Sin eso, "recomendada" es una orden disfrazada.

### 4. Escribí la respuesta en el acto

Apenas el usuario contesta, **antes de la siguiente pregunta**:

- La decisión pasa de `- [ ] 🧑 ¿…?` a `- [x] ¿…? **<lo decidido>** — <la razón, en las palabras del usuario>`.
- Si la respuesta contradice un AC, el out-of-scope o el modelo de datos de esa spec, **actualizá
  también esas secciones**. Una decisión que vive sólo en la sección 9 no cambió la spec.
- Si la respuesta afecta a otras specs, tocalas también y decilo.

Nada de "al final anoto todo". La sesión se corta, el contexto se compacta, y lo hablado se pierde.

### 5. Objetá una vez, después obedecé

Si una respuesta rompe una invariante del dominio (`context/domain.md`), una restricción
(`context/constraints.md`) o una regla del harness (`.claude/rules/`):

1. Decilo en dos frases, **citando la regla por su ID** (R-01, RN-07, RT-03…).
2. Explicá qué pasa si igual se hace.
3. Si el usuario lo reafirma, **es su decisión**: registrala, anotá la regla que queda en tensión y seguí.

No sigas grillando sobre una base que ya sabés inválida, pero tampoco discutas dos veces lo mismo.

### 6. Cerrá la sesión

Cuando el cajón 🧑 queda vacío —o el usuario dice basta— informá:

- Qué se cerró y qué cambió en las specs por eso.
- Qué cerraste vos del cajón 🤖.
- Qué quedó parqueado y **qué evento lo va a desbloquear**.
- Si alguna spec cambió tanto que hay que revisar su plan o sus tareas.

---

## Modo Propuesta — el procedimiento

Recorré el árbol de decisiones de la propuesta rama por rama, resolviendo las dependencias entre
decisiones antes que las hojas. Aplican las mismas reglas: una pregunta por vez, con
recomendación, consultando el repo antes de preguntar, escribiendo lo afirmado en el acto.

Enfocá la propuesta como un cambio de proceso o de negocio, no como una tarea técnica.

Al cerrar, la propuesta debería estar en condiciones de volverse spec con `/spec-new`.

---

## Anti-patrones

- ❌ Preguntar todo junto en una lista de veinte ítems.
- ❌ Preguntar sin recomendar.
- ❌ Grillar decisiones técnicas que el usuario no puede evaluar y no le cambian nada.
- ❌ Preguntar algo que está escrito en `context/`, `specs/` o el código.
- ❌ Guardar las respuestas al final en vez de en el acto.
- ❌ Seguir preguntando después de detectar que la base rompe una invariante.
- ❌ Insistir con una recomendación que el usuario ya rechazó.
