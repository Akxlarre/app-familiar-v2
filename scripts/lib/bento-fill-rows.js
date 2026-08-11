/**
 * bento-fill-rows.js — ARCH-23: disciplina de filas en grids App-like (fill-screen).
 *
 * Caso real que motivó esta regla: la primera documentación del patrón App-like decía
 * "Fila 2 = KPIs (.bento-square × N)" y usaba `.bento-feature` para los paneles de abajo.
 * Es falso. `.bento-grid--fill-screen-kpi` declara TRES filas explícitas
 * (`grid-template-rows: auto auto minmax(0, 1fr)`) y `.bento-hero`, `.bento-feature` y
 * `.bento-tall` ocupan DOS filas cada una (`grid-row: span 2`). Un grid de 3 filas al que
 * le pedís 5 genera filas IMPLÍCITAS que no caben en el `height` fijo: las celdas se
 * superponen y el scroll interno de `.bento-fill` deja de funcionar. En el navegador se
 * ve como celdas encimadas y contenido cortado — no como un error, que es lo peor.
 *
 * La forma correcta es la que usa autoescuela: en un grid fill-screen TODA celda hija
 * ocupa UNA sola fila. Se usa `.bento-banner` (full-width, `grid-row: span 1`) y los KPIs
 * van como grid/flex DENTRO del banner, no como celdas sueltas del bento.
 *
 * Esta regla revisa el markup y falla si un hijo DIRECTO de un grid
 * `.bento-grid--fill-screen*` ocupa más de una fila, sea por clase de proporción o por
 * `data-row-span` / `data-row-span-md`.
 *
 * Micro-suite: `node --test scripts/lib/bento-fill-rows.test.mjs`
 */

/**
 * Modificadores que fijan un `height` y un `grid-template-rows` explícito en lg+.
 * Los límites de token son a propósito: se evalúa contra el CONTENIDO de un `class`,
 * nunca contra el markup crudo (ahí la clase termina en `"`, no en espacio).
 */
export const FILL_SCREEN_GRID_RE = /(?:^|\s)bento-grid--fill-screen(?:-2|-kpi)?(?=\s|$)/;

/** Early-out barato sobre el markup crudo: sin límites de token. */
const MENTIONS_FILL_SCREEN_RE = /bento-grid--fill-screen/;

/** Clases de proporción que declaran `grid-row: span 2` en `_bento-grid.scss`. */
export const TWO_ROW_CLASSES = ['bento-hero', 'bento-feature', 'bento-tall'];

/**
 * Elementos sin cierre: no abren un nivel de anidamiento.
 * (`ng-container` / `ng-template` sí lo abren en el markup pero NO en el DOM: se tratan
 * aparte, como transparentes, porque sus hijos siguen siendo hijos directos del grid.)
 */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** No renderizan un elemento: sus hijos suben un nivel a efectos del grid. */
const TRANSPARENT_TAGS = new Set(['ng-container', 'ng-template']);

const TAG_RE = /<(\/?)([a-zA-Z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;

/** Lee el `class` ESTÁTICO. `[class]`/`[ngClass]` no son verificables estáticamente. */
export function readStaticClass(attrs) {
  const match = attrs.match(/(?:^|\s)class\s*=\s*"([^"]*)"/) ?? attrs.match(/(?:^|\s)class\s*=\s*'([^']*)'/);
  return match ? match[1] : '';
}

/** Mayor `data-row-span*` literal del elemento. 0 si no declara ninguno. */
export function readRowSpan(attrs) {
  let max = 0;
  const re = /(?:^|\s)data-row-span(?:-md)?\s*=\s*["'](\d+)["']/g;
  let m;
  while ((m = re.exec(attrs)) !== null) max = Math.max(max, Number(m[1]));
  return max;
}

/**
 * Recorre el markup manteniendo una pila de elementos y devuelve las celdas que rompen
 * el contrato de una sola fila.
 *
 * @param {string} content markup (archivo .html o el `template:` inline de un .ts)
 * @returns {Array<{ tag: string, classes: string, rowSpan: number, causes: string[] }>}
 */
export function findFillScreenRowViolations(content) {
  if (!MENTIONS_FILL_SCREEN_RE.test(content)) return [];

  const html = content.replace(/<!--[\s\S]*?-->/g, '');
  const violations = [];
  const stack = [];
  TAG_RE.lastIndex = 0;

  let m;
  while ((m = TAG_RE.exec(html)) !== null) {
    const [, closing, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();

    if (closing) {
      // Cierre tolerante a markup mal balanceado: desapila hasta el par más cercano.
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const classes = readStaticClass(attrs);

    // El padre real es el ancestro más cercano que sí renderiza un elemento.
    let parent = null;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!stack[i].transparent) {
        parent = stack[i];
        break;
      }
    }

    if (parent?.isFillGrid) {
      const rowSpan = readRowSpan(attrs);
      const causes = TWO_ROW_CLASSES.filter((cls) =>
        new RegExp(`(?:^|\\s)${cls}(?=\\s|$)`).test(classes),
      );
      if (rowSpan > 1) causes.push(`data-row-span="${rowSpan}"`);
      if (causes.length > 0) violations.push({ tag, classes, rowSpan, causes });
    }

    if (!selfClose && !VOID_TAGS.has(tag)) {
      stack.push({
        tag,
        transparent: TRANSPARENT_TAGS.has(tag),
        isFillGrid: FILL_SCREEN_GRID_RE.test(classes),
      });
    }
  }

  return violations;
}
