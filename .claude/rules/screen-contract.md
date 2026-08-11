---
paths:
  - "src/app/features/**/*.ts"
  - "src/app/features/**/*.html"
  - "src/app/shared/**/*.ts"
  - "src/app/layout/**/*.ts"
---

# Regla: el contrato de pantallas

Toda pantalla de esta app se arma con **cinco piezas y ninguna más**. No es una preferencia
estética: es lo que hace que construir la pantalla número quince cueste la mitad que la primera,
y que ninguna se sienta de otra app.

Referencia viva: `/app/_ds` (sólo en dev). Copiá de ahí en vez de reinventar.

## Las cinco piezas

| Pieza | Qué es | Cuándo |
|---|---|---|
| **Hero** | `<app-section-hero>` — título, bajada, línea de contexto y banda de KPIs | Toda pantalla de sección. `density="slim"` cuando el contenido manda |
| **Panel que llena** | Card con cabecera fija, cuerpo scrolleable y pie fijo | Toda lista o tabla |
| **Fila** | `.item-title` + `.micro-label` de contexto + valor a la derecha + acciones | Todo listado |
| **Drawer** | Detalle o formulario. Empuja el contenido en desktop, fullscreen en móvil | Todo detalle y todo formulario |
| **Estados** | Vacío que explica, error con reintento, skeleton en primera carga | **Siempre los tres** |

## Reglas de composición

1. **Una pantalla = un hero + un panel.** Si hacen falta dos paneles, es `--fill-screen-2`.

2. **Los formularios viven en drawers, no en páginas.** Hay exactamente **dos** excepciones
   declaradas, y sólo dos:
   - El **login**, que es previo al shell.
   - La **revisión de una boleta** (spec 0010): 20-40 líneas que hay que comparar contra la foto
     necesitan ancho.

   Cualquier otra excepción se discute contra esta regla **antes** de escribirse.

3. **El estado vacío no es un error.** En la bandeja, vacío es el estado *deseable* y el copy lo
   dice. Un "no hay datos" genérico desperdicia el único momento en que el usuario está mirando.

4. **Nada de modales.** El drawer del shell cubre el caso, no tapa el contexto, y en móvil ya es
   fullscreen — un modal en móvil es un drawer peor hecho.

5. **Los KPIs van en la banda del hero.** Cards sueltas encima del contenido empujan la lista
   fuera del viewport y rompen el contrato App-like.

## El contrato App-like

- **Desktop (≥1024px):** la pantalla llena el viewport y el scroll vive **dentro** del panel. El
  documento no scrollea.
- **Bajo 1024px:** la pantalla mide su contenido y la página scrollea nativo.
- En un grid `--fill-screen*`, **toda celda hija ocupa UNA fila**. `.bento-tall`, `.bento-feature`
  y `.bento-hero` ocupan dos y desbordan el `grid-template-rows` explícito: las celdas quedan
  superpuestas sin que el navegador avise. ARCH-23 lo bloquea.

## Vocabulario, no utilities

Usá las clases semánticas del DS en vez de recomponer su cluster a mano: `.kpi-value`,
`.micro-label`, `.item-title`, `.section-eyebrow`, `.field-label`, `.field-input`. ARCH-17, ARCH-19
y ARCH-24 lo enforzan.

## Lo que el linter no ve, y hay que mirar igual

Estas tres cosas **compilan perfecto** y se rompen en el navegador. Verificalas ahí, no en el diff:

1. **Contraste real.** ARCH-25 mide los pares de tokens declarados, no lo que termina pintando la
   cascada. Un `text-base` que resuelve a un color en vez de un tamaño de fuente dejó los inputs
   del login en 1.15:1 durante meses, con el linter en verde.
2. **La animación al destruir.** Un componente que muere a mitad de una animación GSAP deja el
   tween vivo. No hay regla que lo detecte.
3. **Los cuatro estados.** Vacío, error y skeleton sólo se ven cuando el servidor falla — o cuando
   los forzás a propósito, como hace la pantalla de referencia.
