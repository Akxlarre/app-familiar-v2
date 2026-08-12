/**
 * rule-wiring.js — ¿Cada regla registrada puede fallar de verdad?
 *
 * Este módulo no busca violaciones en el código de la app. Busca reglas
 * **desconectadas** en el linter mismo.
 *
 * Nació de un patrón que se repitió dos veces con distinto disfraz:
 *
 * - **ARCH-24** tenía detector, tenía tests, tenía su llamada en `architect.js`
 *   — y estaba fuera de `DS_RULES`, la lista fija que decide qué se compara
 *   contra el baseline. Encontraba 3 hits y reportaba 0.
 * - **ARCH-26** tenía detector y tests, y **no lo llamaba nadie**: ni desde
 *   `architect.js` ni desde el CLI standalone. Es el detector del token que
 *   dejó los inputs del login en 1.15:1, ilegibles en producción.
 *
 * En los dos casos el linter dio verde. Una regla que no está conectada se ve
 * **exactamente igual** que una regla que pasa: cero hallazgos, build limpio.
 * Esa ambigüedad es el bug, y es la que este módulo elimina.
 *
 * ## Qué prueba y qué NO prueba
 *
 * Prueba el **cableado**: que cada ID del registro tenga un camino real hasta
 * un `reportError`/`reportWarning`. No prueba que el detector detecte bien —
 * de eso se encargan las micro-suites de cada módulo (`class-discipline.test.mjs`,
 * `contrast-check.test.mjs`, etc.).
 *
 * La división es deliberada, porque el fallo nunca fue "el detector está mal".
 * Siempre fue "el detector no está enchufado".
 *
 * Data in → data out: recibe el fuente como string, sin `fs` ni `console`.
 */

/** IDs que el registro `RULES = { ... }` declara. */
export function extraerReglasRegistradas(fuente) {
  const bloque = fuente.match(/const RULES = \{([\s\S]*?)\n\};/);
  if (!bloque) return [];
  return [...bloque[1].matchAll(/^\s*'([A-Z0-9-]+)':\s*\{/gm)].map((m) => m[1]);
}

/**
 * IDs pasados como literal a `reportError`/`reportWarning`.
 *
 * Tolera el salto de línea: muchas llamadas abren paréntesis y ponen el ID en
 * la línea siguiente.
 */
export function extraerReglasReportadas(fuente) {
  const re = /report(?:Error|Warning)\s*\(\s*(?:\/\/[^\n]*\n\s*)?'([A-Z0-9-]+)'/g;
  return [...new Set([...fuente.matchAll(re)].map((m) => m[1]))];
}

/** IDs que alimentan el ratchet vía `add('ARCH-NN', ...)` en `trackClassDiscipline`. */
export function extraerReglasAlimentadas(fuente) {
  return [...new Set([...fuente.matchAll(/\badd\(\s*'([A-Z0-9-]+)'/g)].map((m) => m[1]))];
}

/** Claves del acumulador `dsCounts`, que es lo que el ratchet sabe contar. */
export function extraerReglasAcumuladas(fuente) {
  const bloque = fuente.match(/const dsCounts = \{([\s\S]*?)\n\};/);
  if (!bloque) return [];
  return [...bloque[1].matchAll(/'([A-Z0-9-]+)':/g)].map((m) => m[1]);
}

/**
 * Cruza las cuatro listas y devuelve las inconsistencias.
 *
 * Una regla del ratchet recorre tres eslabones antes de poder reportar:
 * `add()` la cuenta → `dsCounts` la acumula → `DS_RULES` la compara contra el
 * baseline. Si falta cualquiera, la regla cuenta en silencio. Por eso se
 * verifican los tres por separado y no sólo el resultado final.
 *
 * @returns {{huerfanas: string[], fantasma: string[], ratchetIncompleto: Array<{regla: string, falta: string}>}}
 *   - `huerfanas`: registradas y sin ningún camino a un report. **ARCH-26 caía acá.**
 *   - `fantasma`: se reportan pero no están en `RULES` (sin nombre, sin doc, sin fix).
 *   - `ratchetIncompleto`: en el circuito del ratchet pero con un eslabón roto. **ARCH-24 caía acá.**
 */
export function auditarCableado({ registradas, reportadas, alimentadas, acumuladas, dsRules }) {
  const rep = new Set(reportadas);
  const ali = new Set(alimentadas);
  const acu = new Set(acumuladas);
  const ds = new Set(dsRules);

  // El ratchet reporta con un ID dinámico (`reportError(r.rule, ...)`), así que
  // una regla suya está cableada si completa los tres eslabones del circuito.
  const cableadaPorRatchet = (r) => ali.has(r) && acu.has(r) && ds.has(r);

  const huerfanas = registradas.filter((r) => !rep.has(r) && !cableadaPorRatchet(r));

  const fantasma = [...rep].filter((r) => !registradas.includes(r));

  // Cualquier regla que asome en el circuito del ratchet debe estar en los tres.
  const ratchetIncompleto = [];
  for (const r of new Set([...ali, ...acu, ...ds])) {
    if (!ali.has(r)) ratchetIncompleto.push({ regla: r, falta: "add() en trackClassDiscipline" });
    else if (!acu.has(r)) ratchetIncompleto.push({ regla: r, falta: 'dsCounts' });
    else if (!ds.has(r)) ratchetIncompleto.push({ regla: r, falta: 'DS_RULES (class-discipline.js)' });
  }

  return { huerfanas, fantasma, ratchetIncompleto };
}
