# Brief — qué se está construyendo ahora

> Se actualiza cada vez que cambia el foco. Si tiene más de 7 días sin tocarse, el hook
> `context-guardian` avisa.
> Última revisión: 2026-08-11

---

## Estado del proyecto

**Hito 0 escrito de punta a punta, sin probar contra la realidad.**

La cadena completa existe en código: casilla conectada → correo del banco → captura → bandeja →
movimiento. Está cubierta por 342 tests de front, 33 de las edge functions y 37 casos de RLS y
esquema sobre una base real. Lo que **no** se probó nunca es lo único que importa de verdad: un
correo de un banco chileno, en una cuenta de Gmail real, contra un proyecto Supabase desplegado.
Hasta que eso corra, la tesis del producto sigue sin validar.

## Lo que está construido

| Pieza | Dónde | Estado |
|---|---|---|
| Hogar: auth, `households`, `profiles`, RLS, crear y unirse por código | 11 tablas en `supabase/migrations/` | 37 casos en verde (`npm run db:test`) |
| Conectar la casilla (OAuth de Google) | `supabase/functions/gmail-oauth/` | Sin correr contra Google |
| Correo → captura → movimiento | `supabase/functions/process-bank-emails/` | Parseo con tests; el resto sin correr |
| Rescatar lo atascado con los parsers de hoy | `supabase/functions/reprocesar-capturas/` | Decisión pura con tests |
| Bandeja: confirmar de un toque y aprender el comercio | `features/bandeja/` | 17 tests de facade |
| Completar a mano lo que el parser no pudo leer | `features/bandeja/completar-captura.component.ts` | 11 tests, binding verificado contra el DOM |
| Resolver atómicamente (movimiento + captura) | RPC `resolver_captura` | 16 casos |

Requerimientos cubiertos: REQ-001, REQ-010, REQ-011, REQ-012, REQ-013, REQ-030.

## Lo siguiente, en orden

1. **Probar la cadena contra la realidad.** Necesita credenciales: un proyecto Supabase, el
   cliente OAuth de Google y una casilla con correos de banco de verdad. Es lo único que puede
   decir si los parsers portados de v1 siguen sirviendo — y es trabajo del dueño del producto,
   no del agente.
2. **Activar el SDD** (`specs/`) y escribir las specs de los hitos 1 y 2. El motor está incluido
   y dormido: sin carpeta `specs/`, el `spec-gate` deja pasar todo.
3. **Hito 1 — boleta → despensa.** Artículos y Despensa entran acá.

## Decisiones ya tomadas

- Los eventos congelan sus datos derivados; las definiciones los derivan.
- El catálogo de artículos es global; los alias aprendidos de boletas son del hogar.
- El consumo se infiere de la recompra, y nunca cambia estado sin preguntar.
- La despensa no almacena cantidades.
- Fitness se queda en el alcance: está acoplado a Alimentación por composición corporal.
- **Un solo sanitizador de errores de BD** (`mensajeSeguroDeBd`). El mensaje crudo de Postgres
  no llega al usuario ni por el toast ni por el `motivo` de una captura.
- **El reproceso no crea movimientos**: deja la captura confirmable y el usuario da el toque.
  Crear movimientos es de `resolver_captura`, que es atómico y está probado.

## Lo que no se migra de v1

Nada del frontend. 80 componentes y 54 servicios con un solo archivo de test — no hay garantías
que preservar. Sí se portaron las edge functions y los RPC, cambiando nombres de tabla.

## Riesgos abiertos

| Riesgo | Mitigación |
|---|---|
| Los parsers bancarios son frágiles y dependen del formato exacto del correo | `reprocesar-capturas` permite arreglar el regex y rescatar lo atascado sin escribir monto por monto. Sigue faltando verificarlos contra correos reales |
| El reproceso sólo ve `payload.extracto` (500 caracteres) | Un regex que necesite texto más abajo no matchea. Guardar el correo entero es peor: son datos bancarios y el payload no se borra (R-06) |
| Sin datos reales, la cadencia de recompra no se puede validar | El hito 1 sólo la implementa; la calibración necesita meses de uso |
| El OAuth de Gmail requiere credenciales y consentimiento configurados | Es el paso 1 de la lista de arriba |
