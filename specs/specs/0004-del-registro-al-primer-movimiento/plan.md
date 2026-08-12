# Plan 0004 — Del registro al primer movimiento

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-12

---

## 1. Resumen ejecutivo

La cadena del hito 0 funciona por RPC y edge function, y **no tiene pantalla**. Para que un
usuario nuevo vea su primer movimiento hay que ejecutar SQL a mano: el producto entero es
inalcanzable sin acceso a la base. Esta spec construye el camino.

Cuatro pasos: **hogar → banco y cuenta → correo → primera corrida**. El cuarto no es una
felicitación: es la primera pantalla con datos reales del usuario, y es donde se decide si el
producto se entiende sin que nadie lo explique.

### Lo que se puede verificar hoy, y lo que no

Levantar Supabase local destrabó los pasos 1 y 2 por completo. Los pasos 3 y 4 dependen de dos
cosas que **no están en este entorno**:

| Dependencia | Estado | Qué bloquea |
|---|---|---|
| Credenciales de Google (`GOOGLE_CLIENT_ID`/`SECRET`) | Las tiene que crear el dueño del proyecto | AC5–AC9 |
| Edge runtime local | No arranca acá: baja paquetes de npm y el proxy TLS le da `UnknownIssuer` | AC6, AC10–AC12 |

Se construyen igual —el código no depende del entorno— pero su verificación se declara pendiente
en `acceptance.md` en vez de fingirse. Es el mismo criterio que la 0002 usó con AC-E1 y la 0003
con los tabs.

**Consecuencia de orden:** las fases van 1 → 2 → 3 → 4, así que el trabajo bloqueado queda al
final y todo lo anterior se entrega verificado.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Archivo | Qué es |
|---|---|
| `core/guards/hogar.guard.ts` + `.spec.ts` | Sin hogar → onboarding. **Cierra AC-E1 de la spec 0003** |
| `core/guards/onboarding.guard.ts` + `.spec.ts` | Con hogar → fuera del onboarding (AC-E2) |
| `core/models/hogar.model.ts` | `Hogar`, `PasoDeOnboarding` |
| `core/repositories/hogares.repository.ts` + `.spec.ts` | `create_household`, `join_household_by_code`, lectura del hogar |
| `features/onboarding/onboarding.facade.ts` + `.spec.ts` | Deriva el paso actual del estado real |
| `features/onboarding/onboarding.component.ts` + `.spec.ts` | El contenedor con el progreso |
| `features/onboarding/paso-hogar.component.ts` + `.spec.ts` | Paso 1 |
| `features/onboarding/paso-banco.component.ts` + `.spec.ts` | Paso 2 |
| `features/onboarding/paso-correo.component.ts` + `.spec.ts` | Paso 3 |
| `features/onboarding/paso-listo.component.ts` + `.spec.ts` | Paso 4 |
| `core/repositories/plantillas-parser.repository.ts` + `.spec.ts` | Catálogo de bancos |
| `supabase/migrations/…_captura_plantillas_parser.sql` | Tabla global + semilla de bancos chilenos |
| `supabase/functions/procesar-ahora/index.ts` | Dispara la corrida para un hogar (AC10) |

### Archivos a MODIFICAR

| Archivo | Cambio |
|---|---|
| `app.routes.ts` | Rutas `/onboarding/*`; `hogarGuard` sobre `/app` |
| `app.config.ts` | Registrar iconos nuevos |
| `core/services/auth.facade.ts` | Exponer si el perfil tiene hogar |
| `indices/*.md` | Sincronización |

---

## 3. Reutilización (Discovery)

### Lo que ya existe y se reutiliza tal cual

- **`create_household(p_nombre)`** y **`join_household_by_code(p_code)`**: RPCs `SECURITY DEFINER`
  con `search_path` fijo. El `invite_code` se genera en la base —6 caracteres sin vocales ni
  dígitos ambiguos— y reintenta ante colisión, que es **AC-E3 ya resuelto**.
- `gmail-oauth` y `process-bank-emails`.
- `authGuard`, `AuthFacade`, `BaseFacade`.
- Las cinco piezas del contrato de UI y el drawer con `inputs` (spec 0002).
- `mis_integraciones_email` con su columna `conectada` — ya legible tras `fix-002`.

### Lo que hay que crear, y por qué no alcanza lo existente

- **`parsers_email.household_id` es `NOT NULL`**, así que no puede alojar plantillas globales.
  Entra una tabla `plantillas_parser` sin dueño, y elegir banco **copia** sus filas al hogar. La
  spec lo decidió así a propósito: RB-01 dice que los formatos de correo cambian solos, y
  corregir un regex no puede exigir un despliegue.
- **No hay forma de disparar la corrida a demanda.** `process-bank-emails` corre por cron sobre
  todos los hogares; el paso 4 necesita ejecutarla para uno, ahora.

---

## 4. Modelo de datos

**Tablas nuevas:** `plantillas_parser` — mismas columnas de regex que `parsers_email`, sin
`household_id` ni `cuenta_id`, más `banco` y `activa`. Legible por `authenticated` (es un
catálogo, no datos de nadie); escribible sólo por `service_role`.

**El estado del onboarding es derivado, nunca almacenado:**

```
¿tiene hogar?            → paso 1
¿tiene cuenta?           → paso 2
¿tiene integración?      → paso 3
todo lo anterior         → paso 4
```

Una columna `onboarding_step` miente el día que alguien desconecta su correo. Y de paso, derivarlo
**es** AC-E1 (retomar donde quedó) sin escribir nada: el paso se recalcula al entrar.

---

## 5. Arquitectura del feature

### Por qué el onboarding va fuera de `/app`

Vive en `/onboarding`, no como hija del shell. El shell monta sidebar, topbar y barra inferior —
navegación hacia secciones que el usuario todavía no puede usar. AC1 pide que **no pueda llegar a
ninguna otra pantalla hasta elegir**, y la forma de garantizarlo es que la navegación no exista,
no esconderla con CSS.

### Los dos guards son espejo

| Guard | Sobre | Si falla |
|---|---|---|
| `hogarGuard` | `/app/**` | Sin hogar → `/onboarding` |
| `onboardingGuard` | `/onboarding/**` | Con hogar completo → `/app/hoy` (AC-E2) |

Sin el segundo, un usuario ya configurado puede volver al onboarding por URL y crear un segundo
hogar. Con el primero solo, la app le muestra pantallas vacías a quien no tiene nada.

---

## 6. Restricciones aplicables

- **RNF-05:** el refresh token nunca llega al cliente. El canje pasa por la edge function, y tras
  `fix-002` la columna ni siquiera se puede leer.
- **AC7 es una restricción, no un mensaje de error:** si Google no devuelve refresh token, **no se
  guarda la integración**. Una que muere en una hora es peor que ninguna, porque el usuario cree
  que terminó.
- **`screen-contract.md`:** el onboarding es un formulario, y los formularios viven en drawers…
  salvo que acá no hay shell donde montar un drawer. **Es una tercera excepción y hay que
  declararla en la regla**, no darla por obvia.
- **R-01:** este es el único momento en que se pide escribir. Cada campo se justifica o no entra.

---

## 7. Plan de testing

| Qué | Cómo | AC |
|---|---|---|
| Derivación del paso | Unit: las cuatro combinaciones | AC-E1 |
| `hogarGuard` / `onboardingGuard` | Unit: con y sin hogar | AC1, AC-E2 |
| Crear hogar | Contra Supabase local, usuario real | AC2 |
| Unirse con código | Contra Supabase local | AC3 |
| Código inválido | Que el mensaje **no revele** si el hogar existe | AC4 |
| Copiar plantillas al elegir banco | Unit + contra la base | AC14 |
| Sin refresh token no se guarda nada | Unit sobre la respuesta del canje | AC7 |
| **Navegador** | Alta real → onboarding → hogar → Hoy | AC1, AC2, AC-E2 |

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **El paso 4 no encuentra nada y parece roto** | AC12: decir qué se buscó —carpeta, días, bancos— y qué hacer. El copy es parte del entregable, no relleno |
| Los pasos 3–4 no se pueden verificar acá | Declarado arriba y en `acceptance.md`. Se cierran cuando haya credenciales |
| El catálogo de bancos nace desactualizado | Es una tabla, no una migración: se corrige sin desplegar |
| Onboarding a medias deja usuarios atascados | El estado es derivado: retomar es recalcular, no restaurar |

---

## 9. Orden de implementación

1. **Guards y modelo del paso derivado** — lo que decide a dónde va cada usuario.
2. **Paso 1 (hogar)** + repositorio. Cierra AC-E1 de la spec 0003.
3. **Paso 2 (banco y cuenta)** + `plantillas_parser` con su semilla.
4. **Paso 3 (correo)** — UI completa; el canje queda a la espera de credenciales.
5. **Paso 4 (primera corrida)** + `procesar-ahora`.
6. Validación: lint, tests, **navegador contra la base real**, `acceptance.md`.

---

## 10. Estimación

| Fase | Tareas | Verificable hoy |
|---|---|---|
| Guards y paso derivado | 3 | Sí |
| Paso 1 — hogar | 4 | Sí |
| Paso 2 — banco y cuenta | 4 | Sí |
| Paso 3 — correo | 3 | Parcial |
| Paso 4 — primera corrida | 3 | No |
| Cierre | 4 | — |

---

## Changelog

- 2026-08-12 — plan inicial. Declara por adelantado qué fases no se pueden verificar en este
  entorno y ordena el trabajo para que lo bloqueado quede al final.
