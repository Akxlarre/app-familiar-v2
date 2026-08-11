# Restricciones — app-familiar v2

> Lo que el proyecto NO puede hacer, y por qué. Una restricción acá pesa más que una idea buena.
> Última revisión: 2026-08-11

---

## R-01 · La regla de oro — costo de entrada

> **Ninguna funcionalidad entra sin responder de dónde salen sus datos sin que nadie los escriba.**

Si la respuesta es "el usuario los escribe todos los días", la funcionalidad no sobrevive al
contacto con la vida real. Esto no es una preferencia de proceso: es el resultado del
experimento que ya se corrió. v1 tenía 9 módulos, 7 de entrada manual diaria, y cero uso.

Toda propuesta se clasifica antes de implementarse:

| Nivel | Qué significa | ¿Entra? |
|---|---|---|
| **Automático** | El banco o la boleta escriben el dato | Sí, prioridad máxima |
| **Un gesto** | Una foto, un escaneo de código de barras | Sí |
| **Manual con intención** | El usuario ya está ahí y quiere registrarlo (la sesión de gimnasio) | Sí, con cuidado |
| **Manual sin retorno** | Formularios recurrentes que nadie sostiene | **No.** Se rediseña o se corta |

## R-02 · Un hogar, no multi-tenant

La app es para una familia. Nada se diseña "por si algún día hay varios hogares": eso agrega
complejidad hoy a cambio de nada. El catálogo de artículos es global por conveniencia y porque
esa dirección es la reversible (agregar `household_id` y hacer backfill es trivial; deduplicar
al revés no).

## R-03 · La despensa no cuenta

No hay `quantity` ni `stock_minimum`. Ver RN-06 y RN-07 en `domain.md`. Cualquier feature que
necesite saber "cuántos quedan" está mal planteada: reformularla en términos de presencia y
cadencia de recompra.

## R-04 · Nada adivina en silencio

Una inferencia puede **preguntar**, nunca decidir sola sobre datos del usuario. Un sistema que
se equivoca sin avisar deja de merecer confianza, y recuperar esa confianza cuesta más que
haber preguntado.

## R-05 · Sin dependencias de móvil nativo para funcionar

Web primero. Nada del núcleo puede depender de un plugin de Capacitor. La cámara se usa vía web
APIs; si un día hay app nativa, mejora la experiencia pero no habilita el producto.

## R-06 · Privacidad

Es un sistema privado de una familia. No hay compartir hacia afuera, ni feeds, ni analítica de
terceros. Los alias aprendidos de boletas revelan hábitos de compra: quedan en el hogar.

---

## Restricciones técnicas

| ID | Restricción |
|---|---|
| RT-01 | Angular 21 + PrimeNG 21 + Tailwind v4 + Supabase + GSAP, sobre el boilerplate de Koa 7.0 |
| RT-02 | Las reglas arquitectónicas del harness son vinculantes: sin Supabase en la UI, solo Facades en componentes, OnPush obligatorio, sin `@angular/animations`, sin colores Tailwind hardcodeados |
| RT-03 | RLS habilitado en **todas** las tablas. Sin excepciones "temporales" |
| RT-04 | Migraciones con nombre `YYYYMMDDHHMMSS_<dominio>_<tipo>_<descripcion>.sql` e idempotentes (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) — es la convención que impone el harness |
| RT-05 | Las edge functions se portan desde v1 sin reescribirse: solo cambian los nombres de tabla |
| RT-06 | Iconos con Lucide. PrimeIcons no se instala |
| RT-07 | Toda lógica determinista vive en `scripts/`, no en prosa de reglas |

## Restricciones de negocio

> `RB-*` son restricciones. Las reglas de negocio (`RN-*`) viven en `domain.md`.

| ID | Restricción |
|---|---|
| RB-01 | Los parsers bancarios son de bancos chilenos. Los formatos de correo son específicos y frágiles: cambiarlos requiere verificar contra correos reales |
| RB-02 | Open Food Facts se consulta priorizando la instancia chilena, con fallback global para importados |
| RB-03 | Las cuotas ("Cuota 3 de 12") son parte del dominio financiero chileno y no son opcionales |
| RB-04 | Montos en pesos chilenos, sin decimales en la presentación |
