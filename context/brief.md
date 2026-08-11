# Brief — qué se está construyendo ahora

> Se actualiza cada vez que cambia el foco. Si tiene más de 7 días sin tocarse, el hook
> `context-guardian` avisa.
> Última revisión: 2026-08-11

---

## Estado del proyecto

**Arrancando.** El discovery está hecho: visión, dominio, requerimientos y restricciones están
escritos y decididos. Todavía no hay código.

## Foco actual

**Hito 0 — el esqueleto vivo.**

El objetivo no es un módulo completo: es una cadena end-to-end que demuestre la tesis del
producto. Concretamente, que un correo del banco se convierta en un movimiento visible sin que
nadie escriba nada.

Eso obliga a levantar, en orden:

1. **Hogar** — auth, `households`, `profiles`, RLS y los RPC de creación y unión por código.
2. **Captura** — `capturas`, `integraciones_email`, `parsers_email`, y la edge function
   `process-bank-emails` portada desde v1.
3. **Dinero, lo mínimo** — `cuentas`, `categorias_gasto`, `movimientos`, `alias_comercio`.
4. **La bandeja** — la pantalla de revisión, que es donde el usuario confirma y el sistema aprende.

Requerimientos que cubre: REQ-001, REQ-010, REQ-011, REQ-012, REQ-013, REQ-030.

## Por qué este hito y no otro

Es la única secuencia que valida la tesis antes de invertir en superficie. Si el correo del banco
no llega a ser un movimiento sin intervención, el resto del producto no importa — v1 ya demostró
qué pasa cuando se construyen nueve módulos sobre una premisa que no se probó.

Los otros contextos quedan explícitamente para después: Artículos y Despensa entran con el hito 1
(boleta → despensa), y Alimentación, Cuerpo y Entrenamiento después de eso.

## Decisiones ya tomadas

- Los eventos congelan sus datos derivados; las definiciones los derivan.
- El catálogo de artículos es global; los alias aprendidos de boletas son del hogar.
- El consumo se infiere de la recompra, y nunca cambia estado sin preguntar.
- La despensa no almacena cantidades.
- Fitness se queda en el alcance: está acoplado a Alimentación por composición corporal.

## Lo que no se migra de v1

Nada del frontend. 80 componentes y 54 servicios con un solo archivo de test — no hay garantías
que preservar. Sí se portan las 6 edge functions y los 5 RPC, cambiando solo nombres de tabla.

## Riesgos abiertos

| Riesgo | Mitigación |
|---|---|
| Los parsers bancarios son frágiles y dependen del formato exacto del correo | Portar los de v1 tal cual y verificar contra correos reales antes de confiar en ellos |
| Sin datos reales, la cadencia de recompra no se puede validar | El hito 1 solo la implementa; la calibración necesita meses de uso |
| El OAuth de Gmail requiere credenciales y consentimiento configurados | Es prerequisito del hito 0, no se puede diferir |
