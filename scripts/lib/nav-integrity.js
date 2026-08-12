/**
 * nav-integrity.js — NAV-01: el menú no puede mentir.
 *
 * Cruza los `routerLink` que declara la navegación contra las rutas que declara
 * realmente `app.routes.ts`. Una entrada que no resuelve es un callejón sin
 * salida: el usuario hace clic y cae en el not-found.
 *
 * No es hipotético. Este repo arrancó con `/app/settings` en el menú y sin esa
 * ruta en ningún lado — el bug que AC4 de la spec 0003 describe, ya presente
 * antes de escribir la regla.
 *
 * Data in → data out: recibe los dos fuentes como string, sin `fs` ni `console`.
 */

/**
 * Rutas declaradas, como paths absolutos.
 *
 * Recorre el árbol contando llaves para saber cuándo un bloque `children:`
 * termina, en vez de intentar parsear el objeto: el archivo tiene rutas dentro
 * de un ternario (`...(prod ? [] : [...])`) que no son un literal evaluable, y
 * esas también cuentan como declaradas.
 */
export function extraerRutasDeclaradas(fuenteRutas) {
  const rutas = new Set();
  let nivel = 0;
  const prefijoDe = ['']; // prefijo que rige en cada nivel de array
  const ultimoPathDe = []; // última ruta vista en cada nivel

  for (const lineaCruda of sinComentarios(fuenteRutas).split('\n')) {
    // Los literales de string se vacían antes de contar corchetes: un
    // `import('./x[y]')` no debe mover el nivel.
    const linea = lineaCruda.replace(/'[^']*'/g, "''");

    const m = lineaCruda.match(/\bpath:\s*'([^']*)'/);
    if (m) {
      const segmento = m[1];
      const completa = segmento === '' ? prefijoDe[nivel] || '/' : `${prefijoDe[nivel]}/${segmento}`;
      rutas.add(normalizar(completa));
      ultimoPathDe[nivel] = normalizar(completa);
    }

    // Sólo un array de `children:` hereda la ruta del padre. Cualquier otro
    // —el array raíz, o el `...(prod ? [] : [ … ])` de la ruta de dev— sigue
    // colgando de donde colgaba. Sin esta distinción, `/_ds` se leía como
    // `/app/_ds` por venir después de la ruta `app`.
    const abreChildren = /\bchildren\s*:/.test(linea);
    for (const caracter of linea) {
      if (caracter === '[') {
        nivel++;
        prefijoDe[nivel] = abreChildren ? (ultimoPathDe[nivel - 1] ?? '') : (prefijoDe[nivel - 1] ?? '');
        ultimoPathDe[nivel] = undefined;
      } else if (caracter === ']') {
        nivel = Math.max(0, nivel - 1);
      }
    }
  }

  return [...rutas];
}

/**
 * Vacía comentarios de bloque y de línea.
 *
 * `app.routes.ts` documenta rutas de ejemplo en su docblock (`{ path: 'admin',
 * canActivate: [roleGuard('admin')] … }`). Contarlas como declaradas haría que
 * un enlace muerto a `/admin` pasara la regla — un falso negativo, que es el
 * único error que a un linter no se le perdona.
 */
function sinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** `//app//x` → `/app/x`; sin barra final. */
function normalizar(ruta) {
  const limpia = `/${ruta}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return limpia === '' ? '/' : limpia;
}

/** `routerLink: '/app/x'` de la configuración de navegación. */
export function extraerDestinosDelMenu(fuenteMenu) {
  return [...new Set(
    [...fuenteMenu.matchAll(/routerLink:\s*'([^']+)'/g)].map((m) => normalizar(m[1])),
  )];
}

/**
 * Entradas del menú sin ruta que las respalde.
 *
 * Una ruta comodín (`**`) NO cuenta como respaldo: es justamente donde cae el
 * usuario cuando el menú miente.
 */
export function findDestinosHuerfanos(fuenteRutas, fuenteMenu) {
  const declaradas = new Set(
    extraerRutasDeclaradas(fuenteRutas).filter((r) => !r.includes('**')),
  );
  return extraerDestinosDelMenu(fuenteMenu).filter((d) => !declaradas.has(d));
}
