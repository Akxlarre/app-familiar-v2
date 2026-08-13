/**
 * Provocación de reglas — ¿cada regla del linter puede fallar?
 *
 * `rule-wiring.js` ya comprueba que toda regla registrada esté **cableada**: que
 * exista código que la reporte. Esto es el paso siguiente y es distinto: que ese
 * código, puesto delante de una violación real, efectivamente dispare.
 *
 * La diferencia no es teórica. ARCH-26 vivió con su detector escrito, sus tests
 * en verde y ningún llamador — pasaba el cableado por otro camino y no auditaba
 * nada. Una regla que nunca se pudo hacer fallar es decoración: da la sensación
 * de estar protegido, que es peor que saberse desprotegido.
 *
 * El mecanismo es un sandbox: se arma un proyecto mínimo con UN archivo que
 * viola la regla, se corre el linter con `cwd` ahí, y se exige que su salida
 * nombre la regla. El linter no necesita cambios — ya lee de `process.cwd()`.
 *
 * Las reglas sin fixture no hacen fallar esto: quedan en un baseline que **sólo
 * puede achicarse**. Exigir 25 fixtures el primer día garantizaría que alguien
 * desactive el chequeo entero.
 */

/**
 * Un fixture es el archivo más chico que viola la regla.
 *
 * Chico a propósito: si un fixture viola tres reglas, no se sabe cuál disparó, y
 * el día que una se rompa las otras dos la tapan.
 *
 * `ruta` es relativa a la raíz del sandbox.
 */
export const FIXTURES = {
  'ARCH-01': {
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>x</p>',
})
export class FixtureComponent {
  // Supabase en la UI: eso es lo que ARCH-01 prohíbe.
  private cliente = createClient('http://x', 'y');
}
`,
  },

  'ARCH-04': {
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { Component } from '@angular/core';

// Sin changeDetection: OnPush.
@Component({
  selector: 'app-fixture',
  standalone: true,
  template: '<p>x</p>',
})
export class FixtureComponent {}
`,
  },

  'ARCH-03': {
    // Lógica core sin su .spec.ts al lado.
    ruta: 'src/app/core/services/fixture.service.ts',
    contenido: `import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FixtureService {
  hacerAlgo(): number { return 1; }
}
`,
  },

  'ARCH-05': {
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { trigger } from '@angular/animations';

@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [trigger('x', [])],
  template: '<p>x</p>',
})
export class FixtureComponent {}
`,
  },
};

/**
 * Qué reglas quedaron sin fixture, y cuáles son nuevas respecto del baseline.
 *
 * Devuelve tres listas porque son tres problemas distintos:
 *
 *   · `sinFixture` — el estado actual. Informativo.
 *   · `nuevasSinFixture` — reglas agregadas después del baseline. **Fallan**: el
 *     momento de escribir el fixture es cuando se escribe la regla, no después.
 *   · `baselineObsoleto` — entradas del baseline que ya tienen fixture o que ya
 *     no existen. Un baseline que no se achica deja de ser un trinquete y pasa a
 *     ser una lista de excusas.
 */
export function auditarProvocacion({ registradas, conFixture, baseline }) {
  const tieneFixture = new Set(conFixture);
  const enBaseline = new Set(baseline);

  const sinFixture = registradas.filter((r) => !tieneFixture.has(r));
  const nuevasSinFixture = sinFixture.filter((r) => !enBaseline.has(r));
  const baselineObsoleto = baseline.filter(
    (r) => tieneFixture.has(r) || !registradas.includes(r),
  );

  return { sinFixture, nuevasSinFixture, baselineObsoleto };
}

/**
 * ¿La salida del linter nombra esta regla?
 *
 * Se busca `[ARCH-04]` con corchetes y no el ID suelto: al final de una corrida
 * fallida el linter imprime la lista de TODAS las reglas validadas, y buscar el
 * ID pelado daría positivo siempre. Es la clase de falso verde que este archivo
 * existe para evitar — y que casi se comete al escribirlo.
 */
export function disparo(salida, ruleId) {
  return salida.includes(`[${ruleId}]`);
}
