# Spec 0003 — Navegación y secciones

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P0
> **Costo de entrada:** — (no produce datos)
> **Hito:** 1 — que la plata se pueda mirar

---

## 1. Contexto de negocio

**Origen:** iniciativa interna. Es la otra mitad del contrato de UI (la primera es la spec 0002).

**Persona afectada:** los dos miembros del hogar.

**Problema que resuelve:**
El mapa de contextos (`context/domain.md`) tiene siete dominios y va a producir unas veinte
pantallas. v1 las colgó todas de un sidebar plano de nueve módulos, y el resultado fue que el
usuario tenía que **elegir** a qué módulo entrar antes de saber si había algo que ver — con lo
cual casi siempre entraba a uno vacío y salía.

La navegación tiene que responder otra pregunta: *¿hay algo que necesite de mí?* Si la respuesta
es no, la app no debería pedir que la explores.

**Hipótesis de valor:**
Si la primera pantalla responde "no hay nada que hacer" o "hay 3 cosas", el usuario abre la app
por costumbre y no por obligación. RNF-02 dice que una consulta habitual se responde en menos de
30 segundos incluido abrir la app: eso sólo se cumple si no hay que buscar.

---

## 2. User Stories

- **US1**: Como usuario, quiero abrir la app y ver de inmediato si algo necesita mi atención, para no tener que recorrer secciones.
- **US2**: Como usuario en el teléfono, quiero llegar a lo que uso todos los días en un toque, sin abrir un menú.
- **US3**: Como usuario, quiero que las secciones que todavía no tienen datos no ocupen lugar, para que el menú no sea una lista de promesas.

---

## 3. Acceptance Criteria (Gherkin)

### La estructura

- **AC1**: Given un usuario autenticado con hogar, When entra a `/app`, Then aterriza en Hoy — no en un menú ni en una pantalla de selección.
- **AC2**: Given la navegación, When se enumeran sus destinos, Then son exactamente cinco: **Hoy**, **Plata**, **Casa**, **Cuerpo** y **Ajustes**.
- **AC3**: Given una sección con subsecciones (ej. Plata → movimientos, cuentas, cuotas, presupuestos), When se entra, Then las subsecciones se muestran como tabs dentro de la sección, no como entradas del menú principal.
- **AC4**: Given una sección cuyo módulo todavía no está construido, When se arma el menú, Then esa entrada **no aparece** — nada de items deshabilitados con "próximamente".

### El comportamiento

- **AC5**: Given la app en desktop (≥1024px), When se navega, Then el sidebar es persistente y marca la sección activa.
- **AC6**: Given la app bajo 1024px, When se navega, Then los cinco destinos viven en una barra inferior alcanzable con el pulgar.
- **AC7**: Given una sección con más subsecciones de las que caben, When se reduce el ancho, Then los tabs colapsan a un selector.
  <br>_`subnav-tier.utils.ts` ya resuelve el cálculo._
- **AC8**: Given una navegación entre secciones, When ocurre, Then hay transición de vista y el foco del teclado va al `<h1>` de la pantalla nueva.

### Hoy — la pantalla que decide si hay que hacer algo

- **AC9**: Given un hogar sin nada pendiente, When se abre Hoy, Then dice explícitamente que no hay nada que hacer — no muestra una grilla de KPIs en cero.
- **AC10**: Given capturas sin resolver, When se abre Hoy, Then aparecen primero, con el número exacto y un acceso directo a la bandeja.
- **AC11**: Given movimientos de los últimos días, When se abre Hoy, Then se ven los últimos sin entrar a Plata.
- **AC12**: Given una pregunta pendiente de la despensa ("¿se acabó el atún?"), When se abre Hoy, Then aparece como algo a responder de un toque.
  <br>_Se activa con el hito 2; el lugar queda reservado desde ahora._

### Edge cases obligatorios

- **AC-E1**: Given un usuario autenticado **sin hogar**, When entra a `/app`, Then se lo lleva al onboarding y no a Hoy (ver spec 0004).
- **AC-E2**: Given una ruta inexistente bajo `/app`, When se navega, Then se muestra el not-found dentro del shell, sin perder la navegación.
- **AC-E3**: Given una recarga completa en una subsección, When carga la app, Then el tab correcto queda seleccionado — el estado vive en la URL, no en memoria.

---

## 4. Out of scope

- ❌ **El contenido de cada sección.** Cada una tiene su spec.
- ❌ **Búsqueda global.** No hay volumen que la justifique todavía; entra cuando exista el catálogo (hito 2) y se note la falta.
- ❌ **Notificaciones push.** RNF y privacidad aparte; nada del núcleo depende de ellas.
- ❌ **Personalizar el orden de las secciones.** Dos usuarios, cinco destinos.

---

## 5. Dependencias

### Specs previas
- 0002 — el vocabulario de piezas. Esta spec decide **dónde** van las pantallas; aquélla, **cómo** se ven.

### Capacidades del proyecto que se asumen existentes
- `AppShellComponent` con sidebar y topbar, `LayoutService` con tiers, `subnav-tier.utils.ts`.
- `authGuard`, `guestGuard`, rutas con lazy loading y `withViewTransitions()`.
- `app-tabs` con sus tres variantes.

### Capacidades nuevas requeridas
- Pantalla **Hoy** (`features/hoy/`).
- Barra inferior de navegación en móvil.
- Guard que mande a onboarding a un usuario sin hogar.
- Un modelo de "cosas pendientes" que Hoy consulta y cada dominio alimenta, sin que Hoy dependa de todos los facades.

---

## 6. Datos y modelo

No crea tablas. Introduce un modelo UI:

```
Pendiente { tipo, titulo, detalle, cantidad, ruta, prioridad }
```

Cada dominio expone sus pendientes; **Hoy los agrega**. La dirección importa: si Hoy inyectara
un facade de cada dominio, agregar un módulo obligaría a tocar Hoy — que es cómo el dashboard de
v1 terminó dependiendo de los nueve.

---

## 7. UX y flujos

### Los cinco destinos

| Destino | Qué contiene | Por qué es de primer nivel |
|---|---|---|
| **Hoy** | Pendientes, últimos movimientos, preguntas de la despensa | Es la respuesta a "¿tengo que hacer algo?" |
| **Plata** | Movimientos · Cuentas · Cuotas · Presupuestos | El dominio con datos automáticos, el que se mira |
| **Casa** | Despensa · Lista · Precios | El otro dominio automático (hito 2) |
| **Cuerpo** | Mediciones · Comidas · Entrenamiento | Manual con intención: se entra queriendo entrar (hito 3-4) |
| **Ajustes** | Hogar y miembros · Correo · Categorías · Comercios aprendidos | Se toca una vez y casi nunca más |

> La **bandeja** no es un destino: es un pendiente. Vive en Hoy y se llega desde ahí. Ponerla en
> el menú principal la convertiría en un lugar al que hay que ir a trabajar — justo lo contrario
> de lo que el producto promete.

### Flujo principal

Abrir la app → Hoy → o no hay nada (y se cierra), o hay N pendientes → resolverlos de un toque.

### Estados especiales

- **Sin nada pendiente:** mensaje explícito. Es el estado deseable, no un vacío triste.
- **Primera vez, sin datos:** se lo lleva al onboarding (spec 0004).
- **Error de carga:** cada bloque de Hoy falla por separado; que la despensa no responda no puede dejar sin ver los movimientos.

---

## 8. Métricas de éxito post-launch

- % de sesiones que terminan en Hoy sin navegar a otra sección (alto = la app responde la pregunta sin obligar a buscar).
- Toques promedio hasta resolver un pendiente (objetivo: 1).

---

## 9. Notas / decisiones abiertas

- [x] ¿"Casa" o "Despensa"? **"Casa".** Agrupa despensa, lista y precios sin volver a renombrar cuando crezca.
- [x] ¿Entrenamiento dentro de Cuerpo o destino propio? **Dentro de Cuerpo**, como tab junto a mediciones y comidas. Es lo menos usado y seis destinos aprietan en la barra inferior. Si el uso lo justifica, sacarlo después es barato: una ruta y una entrada de menú.
- [x] ¿La bandeja va en el menú? **No.** Es un pendiente, no un lugar de trabajo.
- [x] ¿Sidebar o barra inferior en móvil? **Barra inferior.** Cinco destinos entran, y el pulgar llega.

---

## Changelog

- 2026-08-11 — draft inicial.
