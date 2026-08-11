# Visión — app-familiar v2

> Documento vivo. Se actualiza cuando cambia la estrategia de producto, no cuando cambia el código.
> Última revisión: 2026-08-11

---

## El problema

La gestión del hogar vive en la memoria y la conversación. El dinero se va sin visibilidad,
las boletas se acumulan sin revisar, y coordinar una casa depende de que alguien se acuerde
de todo. Eso genera fricción en la pareja y decisiones a ciegas.

## Qué es

Un centro de control del hogar para **una pareja que comparte la gestión 50/50**. No hay
administrador y usuario pasivo: los dos son dueños del sistema por igual.

- **Usuarios**: 2–3 personas, cómodas con tecnología.
- **Uso**: micro-consultas a lo largo del día, ~30 segundos cada una.
- **Plataforma**: web primero.
- **Emoción central**: placer. Abrir la app tiene que dar gusto, no ser una tarea pendiente.
- **Personalidad**: amigo organizado. Cercano y directo, nunca corporativo.

### Qué NO es

- No es genérica. Tiene que sentirse hecha para esta familia.
- No es una herramienta empresarial. Es del hogar, y se siente cálida.
- No es una red social. Es privada, punto.
- No es abrumadora. **Si genera más carga mental de la que resuelve, fracasó.**

---

## Por qué existe una v2 — el post-mortem de v1

**v1 se construyó completa y nunca se usó.** 47 tablas, 80 componentes, 6 edge functions,
28 migraciones, 9 módulos. No se abandonó por falta de ganas ni por bugs: se abandonó porque
era insostenible de alimentar.

De los 9 módulos, **7 dependían de que dos personas escribieran datos todos los días**: dar de
alta cada producto y bajar su cantidad al consumirlo, registrar cada gasto a mano, llenar 21
casillas de plan semanal, anotar cada comida en gramos, cargar peso y repeticiones set por set.

El sistema era casi todo **entrada**, no consulta. Para llegar a una consulta útil de 30 segundos
había que pagar antes semanas de tipeo fiel de dos personas. La visión decía "micro-consultas de
30 segundos" y el producto pedía media hora diaria de carga.

El repositorio se detuvo el 25 de febrero de 2026, el mismo día que aterrizó el cuarto módulo de
captura manual en 48 horas.

### Lo que v1 sí hizo bien

Las 6 edge functions —lo más sofisticado del repositorio— existían todas para lo mismo: **que
nadie escriba nada.** Correos del banco parseados por cron, boletas leídas por Gemini, alimentos
buscados en Open Food Facts. El instinto correcto ya estaba, pero era una feature adentro de un
módulo en vez de ser el centro del producto.

---

## La tesis de v2

**La captura automática es el espinazo, y los módulos son vistas sobre lo que capturó.**

La pregunta que ordena todo el producto es *¿de dónde salen estos datos sin que nadie los
escriba?* Lo manual queda para **confirmar**, no para escribir.

Consecuencias de diseño que se derivan de eso:

| v1 pedía | v2 hace |
|---|---|
| dar de alta productos y mantener cantidades | la boleta abastece la despensa; el consumo se infiere de la recompra |
| registrar cada gasto | el correo del banco crea el movimiento |
| categorizar cada transacción | se aprende del comercio la primera vez y se recuerda |
| llenar 21 casillas de plan semanal | el sistema sugiere con lo que hay en la despensa |
| tipear macros receta por receta | se derivan del catálogo |

## Anti-objetivos

- **No multi-hogar.** Es para una familia. Cualquier cosa que exista "por si algún día"
  agrega complejidad hoy a cambio de nada.
- **No app móvil nativa en v2.0.** Web primero, otra vez — pero ahora sin depender de plugins
  de Capacitor para que el producto funcione.
- **No paridad con v1 como meta.** v1 tenía 9 módulos y cero uso. La meta es uso, no cobertura.

## Cómo se sabe si funcionó

La métrica no es cuántos módulos hay. Es si **la app se abre sin que nadie tenga que alimentarla
primero**: si a la semana de no tocarla los datos siguen estando al día, la tesis se cumplió.
