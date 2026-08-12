/**
 * architect.js — Linter Arquitectónico (Guardrails) v2.0
 *
 * Analiza el código fuente usando el AST real de TypeScript en lugar de Regex.
 * Esto elimina falsos positivos por imports comentados, strings, etc.
 *
 * Reglas activas (AST):
 *   1. Ningún archivo en la capa UI puede importar '@supabase/supabase-js' directamente.
 *   2. Ningún *.component.ts en features/ o shared/ puede inyectar un *Service directamente
 *      (solo Facades están permitidos en los componentes vista).
 *   3. Todo *.facade.ts y *.service.ts dentro de core/ debe tener su .spec.ts compañero.
 *   4. Todo *.component.ts debe usar ChangeDetectionStrategy.OnPush.
 *   5. Ningún archivo puede importar desde '@angular/animations'.
 *
 * Reglas activas (Regex sobre templates .html):
 *   6. Prohibido *ngIf, *ngFor, [ngClass], [ngStyle] en templates.
 *
 * Reglas activas (Regex sobre estilos .scss):
 *   7. Prohibido @keyframes en archivos SCSS dentro de src/app/.
 *
 * Regla activa (Regex sobre .ts y .html):
 *   8. Prohibido colores Tailwind hardcodeados (text-red-500, bg-blue-200, etc.).
 *
 * Uso: npm run lint:arch
 *
 * ── Al agregar una regla ─────────────────────────────────────────────────────
 * Registrarla en RULES **y** enchufarla hasta un reportError/reportWarning. Si es
 * del ratchet, el circuito completo es: add() → dsCounts → DS_RULES.
 *
 * `scripts/lib/rule-wiring.test.mjs` falla mientras la regla no esté conectada.
 * No es burocracia: una regla desconectada se ve idéntica a una que pasa —cero
 * hallazgos, build limpio— y así fue como ARCH-24 y ARCH-26 estuvieron muertas
 * sin que nadie lo notara.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// TypeScript es una dependencia de Angular. Usamos createRequire para importar
// el paquete CJS de TypeScript desde un contexto ESM de forma segura.
import { parseThemeTokens, findDeadTokenClasses, findForbiddenThemeAliases } from './lib/theme-tokens.js';
import { kebabToPascal, collectUsedIcons, parseRegisteredIcons } from './lib/icon-registry.js';
import { findIconOnlyButtonsWithoutLabel } from './lib/a11y-guardrails.js';
import { findReservedTailwindClassCollisions, findThemeTokenCollisions } from './lib/tailwind-bare-utilities.js';
import { findFillScreenRowViolations } from './lib/bento-fill-rows.js';
import { extractBentoClasses, diffBentoClasses } from './check-bento-classes.js';
import {
    isPillWhitelisted, isTypographyWhitelisted,
    findAdhocPills, findButtonSizeOverrides, findArbitraryTextSizes, findAdhocTypography,
    findAdhocInputClusters,
    buildBaseline, compareWithBaseline,
} from './lib/class-discipline.js';
import { parsearTemas, verificarPares } from './lib/contrast-check.js';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// ─── Colores de consola ───────────────────────────────────────────────────────
const red    = '\x1b[31m%s\x1b[0m';
const green  = '\x1b[32m%s\x1b[0m';
const yellow = '\x1b[33m%s\x1b[0m';
const cyan   = '\x1b[36m%s\x1b[0m';

console.log(yellow, '🔍 Iniciando Auditoría Arquitectónica (AST Mode v2.0)...');
console.log('');

// ─── Stack flags (lee blueprint.json para saltar reglas según configuración) ──
let STACK = { angular: true, tailwind: true, primeng: true, gsap: true, supabase: true };
try {
    const blueprintPath = path.join(process.cwd(), 'blueprint.json');
    if (fs.existsSync(blueprintPath)) {
        const bp = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
        if (bp.stack && typeof bp.stack === 'object') {
            STACK = { ...STACK, ...bp.stack };
        }
    }
} catch { /* fail-open: usar defaults */ }

const RULES = {
    'ARCH-11': {
        name: 'Dead token classes',
        doc: '.claude/rules/visual-system.md',
        fix: 'La clase no existe en @theme (src/tailwind.css) — Tailwind no genera CSS para ella. Usa un token real o agrégalo al @theme.',
    },
    'ARCH-18': {
        name: 'Forbidden bare aliases in @theme',
        doc: '.claude/rules/visual-system.md',
        fix: 'Un alias "pelado" en @theme colisiona con utilidades nativas de Tailwind. Renombra el token.',
    },
    'ARCH-21': {
        name: 'Unreviewed .bento-* class',
        doc: 'indices/STYLES.md',
        fix: 'Antes de sumar la clase al allowlist, verificá que no se resuelva con una proporción existente ni con los data-attributes de placement. El bento describe FORMAS, no contenidos: una clase nombrada por la sección que la usa es señal de que falta un data-col-span.',
    },
    'ARCH-22': {
        name: 'DS class collides with bare Tailwind utility',
        doc: '.claude/rules/visual-system.md',
        fix: 'Renombra la clase del design system: Tailwind genera su propia regla homónima en @layer utilities y se SUMA a la tuya (no la reemplaza).',
    },
    'ARCH-15': {
        name: 'Ad-hoc pill/badge',
        doc: '.claude/rules/visual-system.md',
        fix: 'Usa el componente de badge del proyecto en vez de recomponer rounded-full + micro-texto + px- a mano.',
    },
    'ARCH-16': {
        name: 'Size utilities over btn-*',
        doc: '.claude/rules/visual-system.md',
        fix: 'No pises el tamaño de un .btn-* con px-/py-/text-*/rounded-*. Si hace falta otra medida, es una variante del DS.',
    },
    'ARCH-17': {
        name: 'Arbitrary font size',
        doc: '.claude/rules/visual-system.md',
        fix: 'Reemplaza text-[NNpx] por un token de la escala tipográfica.',
    },
    'ARCH-19': {
        name: 'Ad-hoc typography cluster',
        doc: '.claude/rules/visual-system.md',
        fix: 'Usa .micro-label / .item-title / .section-eyebrow / .kpi-value en vez de recomponer el cluster de utilities.',
    },
    'ARCH-24': {
        name: 'Ad-hoc input cluster',
        doc: '.claude/rules/visual-system.md',
        fix: 'Usa .field-input (y .field-label) en vez de recomponer el cluster de borde + fondo + padding + radio sobre un campo.',
    },
    'ARCH-23': {
        name: 'Fill-screen bento cell spanning 2 rows',
        doc: '.claude/rules/visual-system.md',
        fix: 'En un grid App-like toda celda hija ocupa UNA fila: usa .bento-banner y anida adentro (KPIs como grid/flex dentro del banner). .bento-hero/.bento-feature/.bento-tall ocupan 2 filas y desbordan el template explícito.',
    },
    'ARCH-25': {
        name: 'Contrast below WCAG AA',
        doc: '.claude/rules/visual-system.md',
        fix: 'Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.',
    },
    'ARCH-26': {
        name: 'Theme token collides with a native Tailwind utility',
        doc: '.claude/rules/visual-system.md',
        fix: 'Renombra el token: un --color-X donde X es un valor de una escala nativa (base, sm, lg, xl…) genera una utilidad de COLOR que le gana a la nativa. `--color-base` hacía que `text-base` pintara texto del color del fondo.',
    },
    'A11Y-03': {
        name: 'Icon-only button without accessible name',
        doc: '.claude/rules/a11y-spec.md',
        fix: 'Un botón cuyo único contenido es un icono necesita aria-label (o texto visible con sr-only).',
    },
    'ICON-01': {
        name: 'Icon used but not registered',
        doc: '.claude/skills/design-system/SKILL.md',
        fix: 'Agrega el icono al LucideAngularModule.pick({...}) de app.config.ts — si falta, lucide lanza en RUNTIME.',
    },
    'ARCH-01': {
        name: 'No Supabase in UI',
        doc: 'docs/TECH-STACK-RULES.md#arch-01',
        fix: 'Mueve la lógica de datos a un FacadeService (@Injectable).',
    },
    'ARCH-02': {
        name: 'Facade-only injection',
        doc: 'docs/TECH-STACK-RULES.md#arch-02',
        fix: 'Los componentes vista solo deben inyectar clases tipo Facade (*FacadeService).',
    },
    'ARCH-03': {
        name: 'TDD required for core logic',
        doc: 'docs/TECH-STACK-RULES.md#arch-03',
        fix: 'Escribe el archivo .spec.ts compañero (Agentic TDD obligatorio).',
    },
    'ARCH-04': {
        name: 'OnPush required',
        doc: 'docs/TECH-STACK-RULES.md#arch-04',
        fix: 'Agrega changeDetection: ChangeDetectionStrategy.OnPush al decorador @Component.',
    },
    'ARCH-05': {
        name: 'No @angular/animations',
        doc: 'docs/TECH-STACK-RULES.md#arch-05',
        fix: 'Usa GsapAnimationsService para todas las animaciones. GSAP es obligatorio.',
    },
    'ARCH-06': {
        name: 'No legacy template directives',
        doc: 'docs/TECH-STACK-RULES.md#arch-06',
        fix: 'Usa Control Flow nativo (Angular 17+): @if/@for y bindings directos.',
    },
    'ARCH-07': {
        name: 'No @keyframes in app styles',
        doc: 'docs/TECH-STACK-RULES.md#arch-07',
        fix: 'Usa GsapAnimationsService para animaciones. GSAP es obligatorio en este proyecto.',
    },
    'ARCH-08': {
        name: 'No hardcoded Tailwind colors',
        doc: 'docs/TECH-STACK-RULES.md#arch-08',
        fix: 'Usa tokens semánticos: text-primary, text-muted, bg-surface, bg-canvas, var(--ds-brand).',
    },
    'ARCH-09': {
        name: 'Complexity warning (shared components)',
        doc: 'docs/TECH-STACK-RULES.md#arch-09',
        fix: 'Divide el componente en subcomponentes o extrae lógica a servicios/utilidades. Mantén shared/ simple.',
    },
    'ARCH-10': {
        name: 'Complexity warning (facades)',
        doc: 'docs/TECH-STACK-RULES.md#arch-10',
        fix: 'Extrae lógica a helpers/servicios y reduce inject() y métodos largos. Mantén la Facade como orquestador.',
    },
};

const targetDirs = [
    path.join(process.cwd(), 'src', 'app', 'features'),
    path.join(process.cwd(), 'src', 'app', 'shared'),
    path.join(process.cwd(), 'src', 'app', 'core'),
    path.join(process.cwd(), 'src', 'app', 'layout'),
];

let errors = 0;
let warnings = 0;

// ─── @theme (ARCH-11 / ARCH-18) ───────────────────────────────────────────────
// Vocabulario de clases válidas derivado de src/tailwind.css. Si no se puede
// leer, los checks que dependen de él se saltan (fail-open).
let THEME = null;
try {
    THEME = parseThemeTokens(path.join(process.cwd(), 'src', 'tailwind.css'));
} catch {
    THEME = null;
}

// ─── Iconos (ICON-01) ─────────────────────────────────────────────────────────
// Se acumulan durante el barrido y se cruzan al final contra el pick() de
// app.config.ts. Un icono usado y no registrado revienta en runtime, no compila mal.
const iconsUsed = new Set();
const iconDynamicFiles = new Set();

// ─── ARCH-15/16/17/19: disciplina de clases del DS, con ratchet ───────────────
// El baseline registra la deuda tolerada por archivo. Solo se reporta una
// REGRESIÓN (un archivo supera su cuota); así el proyecto solo puede mejorar.
// Tras limpiar deuda, re-baselinear con `npm run lint:arch -- --update-ds-baseline`.
const DS_BASELINE_PATH = path.join(process.cwd(), 'scripts', 'lib', 'class-discipline.baseline.json');
const UPDATE_DS_BASELINE = process.argv.includes('--update-ds-baseline');
const dsCounts = {
    'ARCH-15': new Map(),
    'ARCH-16': new Map(),
    'ARCH-17': new Map(),
    'ARCH-19': new Map(),
    'ARCH-24': new Map(),
};

function trackClassDiscipline(filePath, content) {
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const add = (rule, count, sample) => {
        if (count === 0) return;
        dsCounts[rule].set(rel, { count, sample });
    };

    if (!isPillWhitelisted(rel)) {
        const pills = findAdhocPills(content);
        add('ARCH-15', pills.length, pills[0]);
    }

    const overrides = findButtonSizeOverrides(content);
    add('ARCH-16', overrides.length,
        overrides[0] ? `${overrides[0].attr} (→ ${overrides[0].offenders.join(', ')})` : undefined);

    const sizes = findArbitraryTextSizes(content);
    add('ARCH-17', sizes.length, [...new Set(sizes)].join(', '));

    if (!isTypographyWhitelisted(rel)) {
        const clusters = findAdhocTypography(content);
        add('ARCH-19', clusters.length, [...new Set(clusters)].join(', '));
    }

    const inputs = findAdhocInputClusters(content);
    add('ARCH-24', inputs.length, inputs[0]);
}

function checkClassDiscipline() {
    if (UPDATE_DS_BASELINE) {
        fs.writeFileSync(DS_BASELINE_PATH, JSON.stringify(buildBaseline(dsCounts), null, 2) + '\n');
        console.log(cyan, `   ℹ Baseline de disciplina DS regenerado: ${DS_BASELINE_PATH}`);
        return;
    }

    let baseline = null;
    try {
        baseline = JSON.parse(fs.readFileSync(DS_BASELINE_PATH, 'utf-8'));
    } catch {
        // Sin baseline, tolerancia cero: cualquier hallazgo es regresión.
        baseline = { rules: {} };
    }

    const { regressions, currentTotal, baselineTotal, improved } = compareWithBaseline(dsCounts, baseline);

    for (const r of regressions) {
        reportError(r.rule, r.file,
            `Disciplina de clases del DS: ${r.was} tolerado(s) → ${r.now} ahora${r.sample ? `. Ej: ${r.sample}` : ''}`);
    }

    if (improved && baselineTotal > 0) {
        console.log(cyan,
            `   ℹ El backlog de disciplina DS bajó (${baselineTotal} → ${currentTotal}). Corre 'npm run lint:arch -- --update-ds-baseline' para fijar la mejora.`);
    }
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Comprueba si un segmento de ruta pertenece a un directorio concreto. */
function pathContainsSegment(filePath, segment) {
    return filePath.split(path.sep).includes(segment);
}

/** Recorre un nodo AST y sus descendientes en profundidad. */
function walkAst(node, visitor) {
    visitor(node);
    ts.forEachChild(node, child => walkAst(child, visitor));
}

function reportError(ruleId, filePath, message, solutionOverride) {
    const relativePath = path.relative(process.cwd(), filePath);
    const rule = RULES[ruleId];
    const ruleName = rule?.name ? `${rule.name}: ` : '';
    console.error(red, `🚨 [${ruleId}] ${ruleName}${message}`);
    console.error(cyan, `   Archivo: ${relativePath}`);
    const fix = solutionOverride || rule?.fix;
    if (fix) console.error(yellow, `   Fix: ${fix}`);
    if (rule?.doc) console.error(cyan, `   Doc: ${rule.doc}`);
    console.error('');
    errors++;
}

function reportWarning(ruleId, filePath, message, fixOverride) {
    const relativePath = path.relative(process.cwd(), filePath);
    const rule = RULES[ruleId];
    const ruleName = rule?.name ? `${rule.name}: ` : '';
    console.warn(yellow, `⚠️  [${ruleId}] ${ruleName}${message}`);
    console.warn(cyan, `   Archivo: ${relativePath}`);
    const fix = fixOverride || rule?.fix;
    if (fix) console.warn(yellow, `   Fix: ${fix}`);
    if (rule?.doc) console.warn(cyan, `   Doc: ${rule.doc}`);
    console.warn('');
    warnings++;
}

// ─── Análisis TypeScript (AST) ──────────────────────────────────────────────

function getLineSpan(sourceFile, node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
    return { startLine: start + 1, endLine: end + 1, lines: (end - start) + 1 };
}

function analyzeTypeScript(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Parsear con el compilador de TypeScript (AST real)
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
    );

    const isInFeatures = pathContainsSegment(filePath, 'features');
    const isInShared = pathContainsSegment(filePath, 'shared');
    const isInCore = pathContainsSegment(filePath, 'core');
    const isFacade = filePath.endsWith('.facade.ts') && isInCore;
    const isComponent = filePath.endsWith('.component.ts');
    const isViewComponent = isComponent && (isInFeatures || isInShared);

    // ── Regla 1: Sin importación directa de Supabase en la capa UI ──────────
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier
                .getText(sourceFile)
                .replace(/['"]/g, '');

            // Regla 1: Supabase directo en UI (skip si stack.supabase === false)
            if (STACK.supabase && specifier === '@supabase/supabase-js' && (isInFeatures || isInShared)) {
                reportError(
                    'ARCH-01', filePath,
                    'Importación directa de Supabase en capa UI',
                );
            }

            // Regla 5: @angular/animations prohibido (skip si stack.gsap === false)
            if (STACK.gsap && specifier.startsWith('@angular/animations')) {
                reportError(
                    'ARCH-05', filePath,
                    'Importación de @angular/animations detectada',
                );
            }
        }
    }

    // ── Regla 2: Sin inject(*Service) en componentes vista ──────────────────
    // Servicios de infraestructura permitidos en componentes (no son Facades pero
    // son parte del design system y no acceden a datos externos directamente).
    const ALLOWED_SERVICES_IN_COMPONENTS = ['GsapAnimationsService'];

    if (isViewComponent) {
        walkAst(sourceFile, node => {
            if (!ts.isCallExpression(node)) return;

            const callee = node.expression;
            if (!ts.isIdentifier(callee) || callee.text !== 'inject') return;
            if (node.arguments.length === 0) return;

            const argText = node.arguments[0].getText(sourceFile);

            // Dispara si el argumento termina en 'Service' pero NO en 'FacadeService'
            // y no está en la whitelist de servicios de infraestructura permitidos.
            if (
                argText.endsWith('Service') &&
                !argText.endsWith('FacadeService') &&
                !ALLOWED_SERVICES_IN_COMPONENTS.includes(argText)
            ) {
                reportError(
                    'ARCH-02', filePath,
                    `Inyección directa de '${argText}' en componente vista`,
                );
            }
        });
    }

    // ── Regla 4: OnPush obligatorio en todos los componentes ────────────────
    if (isComponent) {
        let hasComponentDecorator = false;
        let hasOnPush = false;

        walkAst(sourceFile, node => {
            // Buscar el decorador @Component
            if (ts.isDecorator(node)) {
                const expr = node.expression;
                if (ts.isCallExpression(expr)) {
                    const callee = expr.expression;
                    if (ts.isIdentifier(callee) && callee.text === 'Component') {
                        hasComponentDecorator = true;
                    }
                }
            }
        });

        if (hasComponentDecorator) {
            // Verificar si OnPush aparece en el archivo (quick check)
            hasOnPush = content.includes('ChangeDetectionStrategy.OnPush') ||
                        content.includes('changeDetection: ChangeDetectionStrategy.OnPush');

            if (!hasOnPush) {
                reportError(
                    'ARCH-04', filePath,
                    'Componente sin ChangeDetectionStrategy.OnPush',
                );
            }
        }
    }

    // ── Regla 8: Colores Tailwind hardcodeados en .ts ───────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            'ARCH-08', filePath,
            `Colores Tailwind hardcodeados detectados: ${[...new Set(colorMatches)].join(', ')}`,
        );
    }

    // ── ARCH-09 (WARNING): shared/**/*.component.ts con clase >200 líneas ────
    if (isComponent && isInShared) {
        walkAst(sourceFile, node => {
            if (!ts.isClassDeclaration(node)) return;
            const span = getLineSpan(sourceFile, node);
            if (span.lines > 200) {
                reportWarning(
                    'ARCH-09',
                    filePath,
                    `Clase demasiado grande (${span.lines} líneas). Límite recomendado: 200.`,
                );
            }
        });
    }

    // ── ARCH-10 (WARNING): facades complejas ────────────────────────────────
    if (isFacade) {
        let injectCalls = 0;
        walkAst(sourceFile, node => {
            if (!ts.isCallExpression(node)) return;
            const callee = node.expression;
            if (ts.isIdentifier(callee) && callee.text === 'inject') injectCalls++;
        });

        if (injectCalls > 5) {
            reportWarning(
                'ARCH-10',
                filePath,
                `Demasiadas llamadas a inject() (${injectCalls}). Límite recomendado: 5.`,
            );
        }

        walkAst(sourceFile, node => {
            if (!ts.isMethodDeclaration(node)) return;
            if (!node.body) return;
            const span = getLineSpan(sourceFile, node);
            if (span.lines > 50) {
                const methodName = node.name?.getText(sourceFile) || '<método>';
                reportWarning(
                    'ARCH-10',
                    filePath,
                    `Método demasiado largo: ${methodName}() (${span.lines} líneas). Límite recomendado: 50.`,
                );
            }
        });
    }
}

function reportDeadTokenClasses(filePath, content) {
    if (!THEME) return;
    const dead = findDeadTokenClasses(content, THEME);
    if (dead.length === 0) return;
    const detail = dead.map(d => (d.suggestion ? `${d.cls} → ${d.suggestion}` : d.cls)).join(', ');
    reportWarning('ARCH-11', filePath, `Clases de token muertas (no existen en @theme, no generan CSS): ${detail}`);
}

/**
 * Extrae el `template:` inline de un componente y le corre los mismos checks
 * que a un .html. Sin esto, un proyecto 100% inline (como el boilerplate) pasa
 * la auditoría de templates sin que se haya revisado una sola línea de markup.
 */
function analyzeInlineTemplate(filePath, content) {
    const match = content.match(/template\s*:\s*`([\s\S]*?)`/);
    if (match) analyzeTemplateContent(match[1], filePath);
}

// ─── Análisis de Templates HTML ─────────────────────────────────────────────

function analyzeTemplate(filePath) {
    analyzeTemplateContent(fs.readFileSync(filePath, 'utf-8'), filePath);
}

/**
 * Checks sobre markup, compartidos entre archivos .html y templates INLINE de .ts.
 *
 * El boilerplate usa `template:` inline en todos sus componentes y no tiene un
 * solo .html, así que sin esta separación las reglas de template no auditaban
 * absolutamente nada.
 */
function analyzeTemplateContent(content, filePath) {

    reportDeadTokenClasses(filePath, content);
    trackClassDiscipline(filePath, content);

    // ICON-01: acumular iconos usados. Los `[name]` dinámicos no son
    // verificables estáticamente, así que se cuentan aparte y solo se informa.
    const { statics, ternaryLiterals, dynamicCount } = collectUsedIcons(content);
    for (const icon of [...statics, ...ternaryLiterals]) iconsUsed.add(icon);
    if (dynamicCount > 0) iconDynamicFiles.add(filePath);

    // ARCH-23: en un grid App-like, una celda de 2 filas desborda el template
    // explícito y las filas implícitas se superponen. No lanza ningún error en
    // runtime — se ve como celdas encimadas, así que solo lo caza un linter.
    for (const { tag, causes } of findFillScreenRowViolations(content)) {
        reportError(
            'ARCH-23', filePath,
            `<${tag}> es hija directa de un grid --fill-screen y ocupa 2 filas (${causes.join(', ')})`,
        );
    }

    for (const icon of findIconOnlyButtonsWithoutLabel(content)) {
        reportError('A11Y-03', filePath, `Botón cuyo único contenido es el icono "${icon}" y no tiene aria-label`);
    }

    // ── Regla 6: Directivas deprecadas ──────────────────────────────────────
    const deprecatedDirectives = [
        { pattern: /\*ngIf/g, name: '*ngIf', replacement: '@if {}' },
        { pattern: /\*ngFor/g, name: '*ngFor', replacement: '@for {}' },
        { pattern: /\[ngClass\]/g, name: '[ngClass]', replacement: '[class.nombre]="expr"' },
        { pattern: /\[ngStyle\]/g, name: '[ngStyle]', replacement: '[style.prop]="expr"' },
    ];

    for (const { pattern, name, replacement } of deprecatedDirectives) {
        if (pattern.test(content)) {
            reportError(
                'ARCH-06', filePath,
                `Directiva deprecada ${name} detectada en template`,
                `Usa ${replacement}.`
            );
        }
    }

    // ── Regla 8: Colores Tailwind hardcodeados en .html ─────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            'ARCH-08', filePath,
            `Colores Tailwind hardcodeados en template: ${[...new Set(colorMatches)].join(', ')}`,
            'Usa tokens semánticos: text-primary, text-muted, bg-surface, bg-canvas.'
        );
    }
}

// ─── Análisis de Estilos SCSS ───────────────────────────────────────────────

function analyzeStyles(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // ── Regla 7: @keyframes prohibido (skip si stack.gsap === false) ─────────
    if (STACK.gsap && /@keyframes\s/.test(content)) {
        reportError(
            'ARCH-07', filePath,
            '@keyframes detectado en archivo de estilos',
        );
    }
}

// ─── Recorrido de directorios ─────────────────────────────────────────────────

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
            continue;
        }

        // TypeScript files (excluir specs del análisis de código)
        if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
            analyzeTypeScript(fullPath);
            analyzeInlineTemplate(fullPath, fs.readFileSync(fullPath, 'utf-8'));

            // ── Regla 3: TDD — Core Services y Facades deben tener .spec.ts ──
            const isCoreLogic =
                pathContainsSegment(fullPath, 'core') &&
                (fullPath.endsWith('.facade.ts') || fullPath.endsWith('.service.ts'));

            if (isCoreLogic) {
                const specPath = fullPath.replace('.ts', '.spec.ts');
                if (!fs.existsSync(specPath)) {
                    reportError(
                        'ARCH-03', fullPath,
                        'Falta test unitario para lógica Core',
                    );
                }
            }
        }

        // HTML templates
        if (fullPath.endsWith('.html')) {
            analyzeTemplate(fullPath);
        }

        // SCSS styles (solo dentro de src/app/)
        if (fullPath.endsWith('.scss') || fullPath.endsWith('.css')) {
            analyzeStyles(fullPath);
        }
    }
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

for (const dir of targetDirs) {
    scanDirectory(dir);
}

// ─── Checks globales (una sola vez, no por archivo) ──────────────────────────

// ARCH-15/16/17/19: ratchet de disciplina DS.
checkClassDiscipline();

// ARCH-22: una clase del DS que se llama igual que una utilidad "pelada" de
// Tailwind. Tailwind genera SU regla homónima en @layer utilities y se SUMA a
// la del design system en vez de reemplazarla — el síntoma es un estilo extra
// que aparece de la nada (ej. `.overline` dibujando una línea sobre el texto).
{
    const scssPath = path.join(process.cwd(), 'src', 'styles', 'tokens', '_variables.scss');
    try {
        const scss = fs.readFileSync(scssPath, 'utf-8');
        for (const cls of findReservedTailwindClassCollisions(scss)) {
            reportError('ARCH-22', scssPath, `La clase .${cls} coincide con una utilidad bare reservada de Tailwind.`);
        }
    } catch { /* fail-open: si no existe el archivo, otro check lo señalará */ }
}

// ARCH-21: freno contra el sprawl del sistema bento. El grid creció por
// acumulación en más de un proyecto; el allowlist obliga a que cada clase nueva
// pase por una revisión explícita en vez de sumarse en silencio.
{
    const bentoScss = path.join(process.cwd(), 'src', 'styles', 'layout', '_bento-grid.scss');
    const allowlistPath = path.join(process.cwd(), 'scripts', 'lib', 'bento-classes.allowlist.json');
    try {
        const current = extractBentoClasses(fs.readFileSync(bentoScss, 'utf-8'));
        const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8')).classes;
        const { newClasses, removedClasses } = diffBentoClasses(current, allowlist);

        for (const cls of newClasses) {
            reportError('ARCH-21', bentoScss, `Clase .${cls} definida pero no aprobada en el allowlist.`);
        }
        if (removedClasses.length > 0) {
            console.log(cyan, `   ℹ ARCH-21: ${removedClasses.length} clase(s) del allowlist ya no existen en el CSS (${removedClasses.join(', ')}) — depurá el allowlist.`);
        }
    } catch { /* fail-open */ }
}

// ARCH-18: alias prohibidos dentro del propio @theme.
// ARCH-26: tokens del @theme que colisionan con una escala nativa de Tailwind.
{
    const cssPath = path.join(process.cwd(), 'src', 'tailwind.css');
    try {
        const css = fs.readFileSync(cssPath, 'utf-8');
        for (const alias of findForbiddenThemeAliases(css)) {
            reportError('ARCH-18', cssPath, `Alias prohibido en @theme: ${alias}`);
        }
        for (const c of findThemeTokenCollisions(css)) {
            reportError('ARCH-26', cssPath,
                `${c.token} genera la utilidad de color \`${c.utilidad}\`, que le gana a la nativa de la escala \`${c.prefijo}\`.`);
        }
    } catch { /* fail-open */ }
}

// ICON-01: iconos usados en templates vs registrados en el pick() de app.config.
// Un icono usado y no registrado NO rompe el build: lucide lanza en runtime.
if (iconsUsed.size > 0) {
    const appConfigPath = path.join(process.cwd(), 'src', 'app', 'app.config.ts');
    try {
        const registered = parseRegisteredIcons(fs.readFileSync(appConfigPath, 'utf-8'), ts);
        const missing = [...iconsUsed].filter(i => !registered.has(kebabToPascal(i)));
        if (missing.length > 0) {
            reportError('ICON-01', appConfigPath, `Iconos usados en templates pero NO registrados: ${missing.join(', ')}`);
        }
        if (iconDynamicFiles.size > 0) {
            console.log(cyan, `   ℹ ICON-01: ${iconDynamicFiles.size} archivo(s) usan [name] dinámico — no verificable estáticamente.`);
        }
    } catch { /* fail-open */ }
}

// ─── ARCH-25: contraste AA, con ratchet ──────────────────────────────────────
// Ratcheado por la misma razón que class-discipline: el proyecto arranca con
// deuda de contraste real y bloquear el build hoy no la arregla, sólo frena.
// El baseline fija cuántas fallas se toleran; una más es regresión.
const CONTRAST_BASELINE_PATH = path.join(process.cwd(), 'scripts', 'lib', 'contrast.baseline.json');
try {
    const temas = parsearTemas(path.join(process.cwd(), 'src', 'styles', 'tokens', '_variables.scss'));
    const { fallas, sinResolver } = verificarPares(temas);

    let toleradas = [];
    try {
        toleradas = JSON.parse(fs.readFileSync(CONTRAST_BASELINE_PATH, 'utf-8')).toleradas ?? [];
    } catch { /* sin baseline: tolerancia cero */ }

    if (process.argv.includes('--update-contrast-baseline')) {
        fs.writeFileSync(CONTRAST_BASELINE_PATH, JSON.stringify({
            nota: 'Deuda de contraste tolerada. Cada entrada es un par que HOY no pasa AA. Bajar esta lista es el objetivo; crecerla es una regresión.',
            toleradas: fallas.map(f => `${f.tema}:${f.fg}:${f.sobre}`),
        }, null, 2) + '\n');
        console.log(cyan, `   ℹ ARCH-25: baseline de contraste actualizado (${fallas.length} pares tolerados).`);
    } else {
        const tolerado = new Set(toleradas);
        const regresiones = fallas.filter(f => !tolerado.has(`${f.tema}:${f.fg}:${f.sobre}`));
        for (const f of regresiones) {
            reportError('ARCH-25', 'src/styles/tokens/_variables.scss',
                `[${f.tema}] ${f.fg} sobre ${f.sobre} da ${f.ratio}:1 (mínimo ${f.minimo}).`);
        }
        if (fallas.length > 0 && regresiones.length === 0) {
            console.log(cyan, `   ℹ ARCH-25: ${fallas.length} par(es) con deuda de contraste tolerada. Ver contrast.baseline.json.`);
        }
    }

    if (sinResolver.length > 0) {
        console.log(cyan, `   ℹ ARCH-25: ${sinResolver.length} par(es) no evaluables (color-mix u otros).`);
    }
} catch (e) {
    console.log(cyan, `   ℹ ARCH-25 no pudo correr: ${e.message}`);
}

console.log('');

if (errors > 0) {
    console.error(red, `❌ Auditoría falló: ${errors} error(es), ${warnings} advertencia(s).`);
    console.error('');
    console.log(yellow, '📋 Reglas validadas:');
    for (const [ruleId, meta] of Object.entries(RULES)) {
        const doc = meta.doc ? ` — ${meta.doc}` : '';
        console.log(`   ${ruleId} — ${meta.name}${doc}`);
    }
    console.log('');
    process.exit(1);
} else {
    console.log(green, `✅ Auditoría completada: ${errors} errores, ${warnings} advertencias.`);
    console.log(green, '   El proyecto cumple con todas las reglas arquitectónicas.');
}
