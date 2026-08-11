# Autores — Specs, Fixes y Hotfixes

> Copiar a `specs/AUTHORS.md` al activar la capa multi-dev del SDD.
> En proyectos de una sola persona este archivo es innecesario: los comandos
> `/assign-*` detectan su ausencia y siguen funcionando sin filtrar por autor.

Cuando varios devs (cada uno con su propio Claude Code) crean specs/fixes/hotfixes en
paralelo, `specs/` se commitea al repo para que el agente de cualquiera vea el trabajo de
todos. Para que ningún agente confunda el `fix-027` de una persona con el de otra, todo
ID de track lleva un **código de autor de una letra**.

## Códigos vigentes

| Código | Autor |
| ------ | ----- |
| `a`    | (nombre) |
| `b`    | (nombre) |

Si se suma alguien al equipo: agregar su código acá **antes** de que cree su primer
track, para evitar colisiones con alguien que ya esté usando esa letra.

## Formato de ID (con autor)

| Track          | Formato             | Ejemplo                       |
| -------------- | ------------------- | ----------------------------- |
| **Spec**       | `NNNN-X-slug`       | `0004-a-flujo-pago`           |
| **Fix**        | `fix-NNN-X-slug`    | `fix-052-a-select-default`    |
| **Hotfix**     | `hotfix-NNN-X-slug` | `hotfix-003-b-crash-login`    |
| **Asignación** | `ASG-X-NNN-slug`    | `ASG-b-052-validacion-email`  |

> ⚠️ Ojo con la posición del código de autor: en los tres tracks va **después** del número
> (`fix-052-a-…`), en las Asignaciones va **antes** (`ASG-b-052-…`). No es un error de tipeo:
> agrupa visualmente por persona al listar el directorio. `npm run assignments:audit`
> valida ambos formatos.

`X` = código de autor (tabla arriba, una sola letra). `NNN` / `NNNN` es el contador
**propio de ese autor en ese track** — no es un contador global del repo.

## Cómo se calcula el siguiente número

Cada autor numera de forma **independiente** por track. Ejemplo: si el autor `a` va en
`fix-050-a` y la autora `b` en `fix-070-b`, el próximo fix de `a` es `fix-051-a`
(**NO** `fix-071-a`) — la numeración de `b` no le afecta.

Antes de crear un track nuevo, Claude debe:

1. Leer el código de autor desde `.claude/author.local.json` (gitignored, uno por
   máquina/dev). Si no existe, preguntarle al humano su código y crearlo a partir de
   `.claude/author.local.json.example`.
2. Listar las carpetas existentes bajo `specs/` (y `specs/hotfixes/` para hotfixes) y
   filtrar solo las que correspondan a ese autor (ej. para `a` → `fix-NNN-a-*`, `NNNN-a-*`).
3. Tomar el número más alto encontrado para ESE autor en ESE track y sumarle 1.
4. Si no hay ninguno previo de ese autor en ese track, partir de `001` (fix/hotfix) o
   `0001` (spec).

## Por qué contador por autor y no global

Un contador global provoca que dos devs en ramas distintas saquen el mismo ID; al mergear,
git auto-resuelve sin conflicto y quedan dos tracks homónimos (fallo silencioso). El código
de autor hace que cada quien tenga su propio espacio de numeración.
