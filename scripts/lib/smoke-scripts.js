/**
 * Clasificación y provocación de los scripts de package.json.
 *
 * Existe por dos bugs reales que vivieron meses sin que nadie los viera:
 *
 *   · `tsc --noEmit -p tsconfig.json` compila CERO archivos y sale 0, porque el
 *     tsconfig raíz del Angular CLI es solution-style. Daba verde sin mirar nada.
 *   · `node --test supabase/functions/**\/*.test.ts` falla siempre: son tests de
 *     Deno con imports por URL. El script existía, se invocaba, y lo único que
 *     producía era un error que se leía como "hay tests rotos".
 *
 * Los dos son el mismo modo de fallar: **un comando que se corre y no comprueba
 * lo que dice comprobar.** Un script que sale 0 sin haber mirado nada es peor que
 * uno ausente, porque el ausente se nota.
 *
 * De ahí las dos preguntas que hace este módulo, que son distintas:
 *
 *   1. ¿El script pasa en un proyecto sano?   → si no, está roto.
 *   2. ¿El script FALLA cuando algo está mal? → si no, es decorativo.
 *
 * La segunda es la que ningún CI hace, y es la que encuentra estos bugs.
 */

/**
 * Scripts que no se pueden correr en un smoke, y por qué.
 *
 * Se listan por patrón y no por nombre exacto para que un script nuevo caiga en
 * la clasificación correcta sin tocar esto — pero cualquiera que no matchee cae
 * en `verificable`, que es el default seguro: se corre y se mide.
 */
// `--watch(?!=)` y no `\bwatch\b`: la segunda forma matchea dentro de
// `--watch=false`, que es exactamente lo contrario de un watcher — y saltearía
// `test:ci`, el script que más importa correr. Lo cazó su propio test.
const NO_TERMINAN = /^(start|watch|dev|serve)$|serve|--watch(?!=)|--watch=true|:ui$|:headed$/;
const NECESITA_AFUERA = /^(supabase|claude|db):/;
const DESTRUCTIVO = /reset|drop|clean|prune/;

/** @typedef {'verificable'|'no-termina'|'externo'|'destructivo'} Clase */

/**
 * En qué cajón cae cada script.
 *
 * El orden importa: destructivo gana sobre externo, y externo sobre no-termina.
 * Un `supabase:reset` es las tres cosas y lo que manda es que borra datos.
 */
export function clasificar(nombre, comando) {
  if (DESTRUCTIVO.test(nombre) || DESTRUCTIVO.test(comando)) return 'destructivo';
  if (NECESITA_AFUERA.test(nombre)) return 'externo';
  if (NO_TERMINAN.test(nombre) || NO_TERMINAN.test(comando)) return 'no-termina';
  return 'verificable';
}

/**
 * Cómo se comprueba que un script NO es decorativo.
 *
 * Dos formas, porque no todos los comandos se rompen igual:
 *
 *   · `provocar` — se introduce un defecto y el script tiene que fallar. Es la
 *     única forma de detectar el caso `tsc -p tsconfig.json`, que sale 0 porque
 *     no compiló nada: sin un defecto que ignorar, verde y verde son iguales.
 *   · `contar`   — el script es un runner de tests y su salida tiene que decir
 *     cuántos corrió. Cero tests con exit 0 es el mismo engaño con otra cara.
 *
 * Un script verificable sin ninguna de las dos queda reportado como **sin
 * comprobar**: no falla el smoke, pero se ve. Lo que no se puede es que pase
 * inadvertido.
 */
export const COMPROBACIONES = {
  typecheck: { modo: 'provocar', defecto: 'tipo' },
  build: { modo: 'provocar', defecto: 'tipo' },
  'lint:arch': { modo: 'provocar', defecto: 'arquitectura' },
  'test:ci': { modo: 'contar' },
  'test:coverage': { modo: 'contar' },
  'test:functions': { modo: 'contar' },
  'lint:arch:test': { modo: 'contar' },
  'claude:test-hooks': { modo: 'contar' },
};

/**
 * Cuántos tests reportó un runner, leyendo su salida.
 *
 * Cubre los tres formatos que este stack produce —Vitest, `node --test` y
 * `deno test`— y devuelve `null` si no reconoce ninguno. `null` es "no sé", que
 * es distinto de cero: reportar 0 cuando no se supo leer la salida convertiría
 * este chequeo en el mismo falso negativo que vino a cazar.
 */
export function contarTests(salida) {
  const patrones = [
    /Tests\s+(\d+)\s+passed/i,        // Vitest
    /(\d+)\s+passed\s*\|\s*\d+\s+failed/i, // deno test
    /^#\s*pass\s+(\d+)/m,             // node --test (TAP)
    /(\d+)\s+passing/i,               // mocha
  ];
  for (const p of patrones) {
    const m = salida.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Veredicto de un script, a partir de lo que se midió.
 *
 * Se separa de la ejecución a propósito: la lógica que decide "esto está roto"
 * se puede probar sin levantar procesos, que es lo que hace que se pueda probar
 * de verdad.
 *
 * @param {object} m
 * @param {string} m.nombre
 * @param {number} m.exitLimpio      exit code corriendo el script tal cual
 * @param {string} m.salida          stdout+stderr de esa corrida
 * @param {number|null} [m.exitProvocado]  exit code con el defecto introducido
 * @returns {{estado:'ok'|'roto'|'decorativo'|'sin-comprobar', motivo:string}}
 */
export function veredicto({ nombre, exitLimpio, salida, exitProvocado }) {
  if (exitLimpio !== 0) {
    return {
      estado: 'roto',
      motivo: `sale ${exitLimpio} en un proyecto sano — el script no corre, no es que encontró algo`,
    };
  }

  const comprobacion = COMPROBACIONES[nombre];
  if (!comprobacion) {
    return { estado: 'sin-comprobar', motivo: 'pasa, pero nada garantiza que pueda fallar' };
  }

  if (comprobacion.modo === 'contar') {
    const n = contarTests(salida);
    if (n === null) {
      return { estado: 'sin-comprobar', motivo: 'no se pudo leer cuántos tests corrió' };
    }
    if (n === 0) {
      return { estado: 'decorativo', motivo: 'sale 0 habiendo corrido 0 tests' };
    }
    return { estado: 'ok', motivo: `${n} tests` };
  }

  // modo 'provocar'
  if (exitProvocado === undefined || exitProvocado === null) {
    return { estado: 'sin-comprobar', motivo: 'no se pudo introducir el defecto' };
  }
  if (exitProvocado === 0) {
    return {
      estado: 'decorativo',
      motivo: 'pasa igual con un defecto adentro — no está mirando lo que dice mirar',
    };
  }
  return { estado: 'ok', motivo: 'falla cuando tiene que fallar' };
}

/** Resumen para decidir el exit code del smoke. */
export function resumir(veredictos) {
  const cuenta = { ok: 0, roto: 0, decorativo: 0, 'sin-comprobar': 0 };
  for (const v of veredictos) cuenta[v.estado]++;
  return { ...cuenta, falla: cuenta.roto > 0 || cuenta.decorativo > 0 };
}
