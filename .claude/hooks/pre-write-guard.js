#!/usr/bin/env node
/**
 * pre-write-guard.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Sistema de guardrails que se ejecuta ANTES de cada escritura de archivo.
 * Cuatro capas de protección:
 *
 *   1. FILE PROTECTION    — Bloquea edits a archivos críticos del sistema de hooks
 *   2. DISCOVERY GATE     — Obliga a leer los índices antes de escribir código fuente
 *   3. ARCHITECT GUARD    — Validación rápida de reglas arquitectónicas en el contenido nuevo
 *   4. CONTEXT INJECTION  — Inyecta contexto relevante según el tipo de archivo
 *                           (con dedup de sesión: cada categoría se inyecta solo 1 vez)
 *
 * Exit codes:
 *   0 = permitir la operación (opcionalmente con additionalContext via JSON stdout)
 *   2 = bloquear la operación (stderr se envía a Claude como feedback)
 *
 * Salida JSON (cuando se permite):
 *   { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: "..." } }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Read stack from blueprint.json (fail-open) ──────────────────────────────
let STACK = { angular: true, tailwind: true, primeng: true, gsap: false, supabase: true };
try {
  const bpPath = path.join(process.cwd(), 'blueprint.json');
  if (fs.existsSync(bpPath)) {
    const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
    if (bp.stack && typeof bp.stack === 'object') STACK = { ...STACK, ...bp.stack };
  }
} catch { /* fail-open */ }

// SEC-04: Limit stdin to 10 MB to prevent memory exhaustion (DoS) from crafted hook inputs.
const MAX_STDIN_BYTES = 10 * 1024 * 1024;
let data = '';
let dataSize = 0;
process.stdin.on('data', chunk => {
  dataSize += chunk.length;
  if (dataSize > MAX_STDIN_BYTES) {
    process.stderr.write('pre-write-guard: stdin payload exceeds 10 MB limit — aborting (fail-open).\n');
    process.exit(0);
  }
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    const newContent = input.tool_input?.new_string || input.tool_input?.content || '';
    const toolName = input.tool_name || '';
    const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
    const normalizedPath = filePath.replace(/\\/g, '/');

    // ═══════════════════════════════════════════════════════════════════════
    // 1. FILE PROTECTION — Archivos del sistema de guardrails
    // ═══════════════════════════════════════════════════════════════════════
    const protectedPatterns = [
      '.claude/hooks/',
      '.claude/settings.json',
      '.claude/settings.local.json',
      'scripts/architect.js',
    ];

    for (const pattern of protectedPatterns) {
      if (normalizedPath.includes(pattern)) {
        process.stderr.write(
          `\u{1F6E1}\u{FE0F} FILE PROTECTOR: ${path.basename(filePath)} es parte del sistema de guardrails.\n` +
          `No se permite modificar archivos en: ${pattern}\n` +
          `Si necesitas cambiar la configuracion de hooks, pide al humano que lo haga manualmente.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. DISCOVERY GATE — Leer índices antes de escribir código fuente
    // ═══════════════════════════════════════════════════════════════════════
    const isSourceCode =
      (normalizedPath.includes('src/app/') && !normalizedPath.endsWith('.spec.ts')) ||
      normalizedPath.includes('supabase/migrations/');

    if (isSourceCode) {
      const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
      if (!fs.existsSync(flagPath)) {
        process.stderr.write(
          `\u{1F50D} DISCOVERY GATE: Debes leer los indices del proyecto ANTES de escribir codigo.\n` +
          `Lee al menos uno de estos archivos primero:\n` +
          `  - indices/COMPONENTS.md\n` +
          `  - indices/SERVICES.md\n` +
          `  - indices/FACADES.md\n` +
          `  - indices/MODELS.md\n` +
          `  - indices/DATABASE.md\n` +
          `  - indices/ANTI-PATTERNS.md\n` +
          `  - indices/DIRECTIVES.md\n` +
          `  - indices/STYLES.md\n` +
          `  - indices/PIPES.md\n` +
          `  - indices/LAYOUTS.md\n` +
          `Esto te ayudara a reutilizar lo que ya existe y no duplicar trabajo.\n` +
          `El bloqueo se levantara automaticamente cuando leas cualquier archivo de indices/.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. ARCHITECT GUARD — Validación rápida de reglas en contenido nuevo
    // ═══════════════════════════════════════════════════════════════════════

    const violations = [];

    // --- TypeScript / HTML checks (solo en src/app/) ---
    if (normalizedPath.includes('src/app/') && (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.html'))) {

      // Directivas Angular deprecadas
      if (newContent.includes('*ngIf'))
        violations.push('Usa @if {} en vez de *ngIf (Angular 17+ control flow)');
      if (newContent.includes('*ngFor'))
        violations.push('Usa @for {} en vez de *ngFor (Angular 17+ control flow)');
      if (/\[ngClass\]/.test(newContent))
        violations.push('Usa [class.nombre]="expr" en vez de [ngClass]');
      if (/\[ngStyle\]/.test(newContent))
        violations.push('Usa [style.prop]="expr" en vez de [ngStyle]');

      // Decoradores deprecados
      if (/@Input\s*\(/.test(newContent))
        violations.push('Usa input() signal en vez de @Input() decorator');
      if (/@Output\s*\(/.test(newContent))
        violations.push('Usa output() signal en vez de @Output() decorator');

      // ARCH-11: supabase.types.ts es auto-generado — no editar manualmente
      if (/core\/models\/supabase\.types\.ts/.test(normalizedPath))
        violations.push(
          '[ARCH-11] supabase.types.ts es AUTO-GENERADO.\n' +
          '     No lo edites manualmente: ejecuta npm run supabase:types para regenerarlo.\n' +
          '     Las interfaces en dto/ deben EXTENDER de supabase.types.ts.'
        );

            // Import directo de Supabase en capa UI
      if (
        STACK.supabase &&
        (normalizedPath.includes('features/') || normalizedPath.includes('shared/')) &&
        newContent.includes('@supabase/supabase-js')
      )
        violations.push('No importar @supabase/supabase-js en la capa UI. Usa un FacadeService.');

      // @angular/animations prohibido siempre
      if (newContent.includes('@angular/animations'))
        violations.push('No usar @angular/animations. Usa GsapAnimationsService (con GSAP) o CSS transitions/View Transitions API (sin GSAP).');

      // OnPush check — solo para Write (archivo completo) en .component.ts
      if (
        toolName === 'Write' &&
        normalizedPath.endsWith('.component.ts') &&
        newContent.includes('@Component') &&
        !newContent.includes('OnPush')
      )
        violations.push(
          'Falta changeDetection: ChangeDetectionStrategy.OnPush en el componente.\n' +
          '     Importa { ChangeDetectionStrategy } de @angular/core.'
        );

      // Colores Tailwind hardcodeados
      const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/;
      if (hardcodedColorRe.test(newContent))
        violations.push(
          'No usar colores Tailwind hardcodeados (ej: text-red-500, bg-blue-200).\n' +
          '     Usa tokens semanticos: text-primary, text-muted, bg-surface, bg-base, var(--ds-brand).'
        );

      // Dumb component con inject de Facade
      if (normalizedPath.includes('shared/') && normalizedPath.endsWith('.component.ts')) {
        if (/inject\s*\(\s*\w*Facade/.test(newContent))
          violations.push(
            'Componentes en shared/ son Dumb: no deben inyectar Facades.\n' +
            '     Solo usan input() y output(). Mueve la logica a un Smart component en features/.'
          );
      }

      // MessageService directo en componentes UI
      if (
        (normalizedPath.includes('features/') || normalizedPath.includes('shared/') || normalizedPath.includes('layout/')) &&
        normalizedPath.endsWith('.component.ts') &&
        /inject\s*\(\s*MessageService\s*\)/.test(newContent)
      )
        violations.push(
          'No inyectar MessageService de PrimeNG directamente en componentes.\n' +
          '     Usa ToastService (core/services/toast.service.ts) para toasts efimeros.\n' +
          '     Ver: .claude/rules/notifications.md'
        );

      // ARCH-12: Repository boundary — Facades no acceden a la BD directamente
      if (
        STACK.supabase &&
        normalizedPath.includes('.facade.') &&
        (/\bclient\.from\s*\(/.test(newContent) || /\bdb\.from\s*\(/.test(newContent))
      )
        violations.push(
          '[ARCH-12] No llamar .db.from() ni .client.from() directamente en un Facade.\n' +
          '     Crea o reutiliza un Repository en core/repositories/ e inyectalo en el Facade.\n' +
          '     Ejemplo: inject(ProductosRepository).findAll()\n' +
          '     Ver: .claude/rules/facades.md'
        );

      // LLM-01: Botones submit sin data-llm-action (solo en features/)
      // Los formularios son puntos de mutación críticos — el agente debe saber qué acción realizan.
      if (normalizedPath.includes('features/')) {
        const submitBtnMatches = newContent.match(/<button[^>]*type="submit"[^>]*>/g) || [];
        const submitBtnsWithoutLlm = submitBtnMatches.filter(b => !b.includes('data-llm-action'));
        if (submitBtnsWithoutLlm.length > 0)
          violations.push(
            '[LLM-01] Boton type="submit" sin data-llm-action detectado.\n' +
            '     Los botones de mutacion necesitan semántica explicita para agentes IA.\n' +
            '     Ejemplo: <button type="submit" data-llm-action="crear-producto">\n' +
            '     Ver: .claude/rules/ai-readability.md'
          );
      }

      // LLM-02: Botones destructivos sin data-llm-action (features/ y shared/)
      // Botones con aria-label que indica eliminacion/borrado.
      if (normalizedPath.includes('features/') || normalizedPath.includes('shared/')) {
        const destructiveBtnRe = /<button[^>]*aria-label="[^"]*(?:eliminar|delete|borrar|remove|remov)[^"]*"[^>]*>/gi;
        const destructiveBtns = newContent.match(destructiveBtnRe) || [];
        const destructiveBtnsWithoutLlm = destructiveBtns.filter(b => !b.includes('data-llm-action'));
        if (destructiveBtnsWithoutLlm.length > 0)
          violations.push(
            '[LLM-02] Boton destructivo sin data-llm-action detectado.\n' +
            '     Los botones de eliminacion/borrado necesitan semantica explicita para agentes IA.\n' +
            '     Ejemplo: <button aria-label="Eliminar producto" data-llm-action="delete-producto">\n' +
            '     Ver: .claude/rules/ai-readability.md'
          );
      }
    }


    // --- A11Y checks (solo en templates HTML de src/app/) ---
    if (normalizedPath.includes('src/app/') && normalizedPath.endsWith('.html')) {
      // A11Y-01: <app-icon> sin aria-label standalone (self-closing sin texto hermano)
      const iconTagRe = /<app-icon(?![^>]*aria-label)[^>]*\/>/g;
      if (iconTagRe.test(newContent))
        violations.push(
          '[A11Y-01] <app-icon> sin aria-label detectado.\n' +
          '     Si es icono de accion: aniade [attr.aria-label]="Descripcion".\n' +
          '     Si hay texto hermano visible, usa ariaHidden="true".\n' +
          '     Ver: .claude/rules/a11y-spec.md'
        );

      // A11Y-02: <p-table> sin aria-label ni caption
      const ptableRe = /<p-table\b(?![^>]*aria-label)[^>]*>/;
      if (ptableRe.test(newContent) && !newContent.includes('pTemplate="caption"'))
        violations.push(
          '[A11Y-02] <p-table> sin aria-label ni caption.\n' +
          '     Aniade [attr.aria-label]="Nombre de la tabla" o usa pTemplate="caption".\n' +
          '     Ver: .claude/rules/a11y-spec.md'
        );
    }
    // --- SCSS / CSS checks (solo en src/) ---
    if (normalizedPath.includes('src/') && (normalizedPath.endsWith('.scss') || normalizedPath.endsWith('.css'))) {
      // @keyframes: BLOQUEADO en componentes solo si el proyecto usa GSAP
      const isComponentStyle = normalizedPath.includes('src/app/');
      if (STACK.gsap && isComponentStyle && /@keyframes\s/.test(newContent))
        violations.push(
          'No usar @keyframes en estilos de componente (proyecto usa GSAP).\n' +
          '     Para animaciones de entrada: GsapAnimationsService.\n' +
          '     Para loops de estado: usar .indicator-live o .badge-pulse del design system.'
        );

      const hardcodedColorRe =
        /(?:text|bg|border|ring)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/;
      if (hardcodedColorRe.test(newContent))
        violations.push('No usar colores Tailwind hardcodeados en SCSS. Usa var(--ds-*) tokens.');
    }

    // --- SEC-T03: Secrets in environment files ---
    if (normalizedPath.includes('src/environments/')) {
      // Detect real Supabase JWT (eyJ...) or project URL hardcoded in environment files.
      // Placeholders like "your-anon-key-here" are fine; real JWTs are not.
      const hasHardcodedJwt = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(newContent);
      const hasRealSupabaseUrl = /https:\/\/[a-z]{20}\.supabase\.co/.test(newContent);
      if (hasHardcodedJwt || hasRealSupabaseUrl)
        violations.push(
          '[SEC] Credencial Supabase detectada en environment file.\n' +
          '     NUNCA hardcodear JWTs ni URLs de proyecto en archivos commiteados.\n' +
          '     Usa variables de entorno en CI/CD e inyectalas en el build.\n' +
          '     Ver: src/environments/environment.prod.ts (instrucciones de configuracion)'
        );
    }

    // --- SQL migration checks ---
    if (normalizedPath.includes('supabase/migrations/')) {
      const fileName = path.basename(filePath);

      if (toolName === 'Write' && !/^\d{14}_\w+\.sql$/.test(fileName))
        violations.push(
          'Nombre de migracion invalido. Formato: YYYYMMDDHHMMSS_dominio_tipo_descripcion.sql\n' +
          '     Ejemplo: 20250301120000_auth_create_profiles.sql'
        );

      if (/CREATE\s+TABLE/i.test(newContent) && !/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(newContent))
        violations.push(
          'Toda tabla nueva DEBE tener RLS activado.\n' +
          '     Agrega: ALTER TABLE nombre ENABLE ROW LEVEL SECURITY;'
        );
    }

    // --- Reportar violaciones ---
    if (violations.length > 0) {
      process.stderr.write(
        `\u{1F6A8} ARCHITECT GUARD: Violaciones detectadas en ${path.basename(filePath)}:\n` +
        violations.map(v => `  \u274C ${v}`).join('\n') +
        `\nCorrige el codigo antes de escribirlo.`
      );
      process.exit(2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. CONTEXT INJECTION — Inyectar contexto relevante (con dedup de sesión)
    // ═══════════════════════════════════════════════════════════════════════
    // Cada categoría de archivo se inyecta UNA SOLA VEZ por sesión.
    // Las reglas arquitectónicas ya se cargan vía path-scoped rules (.claude/rules/).
    // Aquí solo se inyecta lo que las reglas no cubren: nombres de componentes
    // existentes, clases de botones, refs a índices, stack-specific reminders.

    // Determinar categoría de contexto para dedup
    const ctxCategory = normalizedPath.includes('features/') ? 'features'
      : normalizedPath.includes('shared/') ? 'shared'
      : normalizedPath.includes('layout/') ? 'layout'
      : normalizedPath.includes('core/repositories/') ? 'repositories'
      : normalizedPath.includes('core/facades/') ? 'facades'
      : normalizedPath.includes('core/services/') ? 'services'
      : normalizedPath.includes('core/utils/') ? 'utils'
      : normalizedPath.includes('core/directives/') ? 'directives'
      : normalizedPath.includes('supabase/migrations/') ? 'migrations'
      : normalizedPath.endsWith('.html') ? 'html'
      : (normalizedPath.endsWith('.scss') || normalizedPath.endsWith('.css')) ? 'scss'
      : null;

    // Dedup: si ya inyectamos esta categoría en esta sesión, salir sin contexto
    if (ctxCategory) {
      const ctxFlag = path.join(os.tmpdir(), `koa-ctx-${ctxCategory}-${sessionId}.flag`);
      if (fs.existsSync(ctxFlag)) {
        process.exit(0);
      }
      fs.writeFileSync(ctxFlag, new Date().toISOString());
    }

    const contextParts = [];

    // --- Componentes Angular (features/ o shared/) ---
    if (normalizedPath.endsWith('.component.ts')) {
      if (normalizedPath.includes('features/')) {
        contextParts.push(
          'SMART component (features/) — reglas completas en: architecture.md + visual-system.md.',
          'Componentes disponibles en shared/ (no recrear):',
          '  <app-kpi-card [value] label [trend] /> | <app-empty-state message /> | <app-alert-card title />',
          '  <app-drawer [isOpen] title /> | <app-icon name="kebab-case" [size]="20" /> | <skeleton-block variant />',
          'Clases de boton: btn-primary | btn-secondary | btn-ghost (definidas en tailwind.css).',
          'Toast: inject(ToastService) → toast.success() / toast.error(). NUNCA inject(MessageService).',
          ...(STACK.gsap
            ? ['Animaciones: inject(GsapAnimationsService) en ngAfterViewInit.']
            : ['Animaciones: CSS transitions (.animate-fade-in-up) o View Transitions API.']),
          'Layout: consulta LAYOUTS.md → identifica el arquetipo (dashboard/list/detail/form/auth/analytics/settings/onboarding) antes de estructurar la vista.',
          'Indices: COMPONENTS.md (que existe) | ANTI-PATTERNS.md (que evitar) | LAYOUTS.md (arquetipo de página).',
          '[CONTEXTO] context/domain.md — entidades y reglas de negocio del proyecto.',
          'Skills bajo demanda: /angular-component | /angular-signals | /design-system.',
          '[CONTEXTO] context/brief.md — objetivo de la sesión actual. context/domain.md — entidades del negocio.'
        );
      }
      if (normalizedPath.includes('shared/')) {
        contextParts.push(
          'DUMB component (shared/) — solo input() y output(). SIN inject() de Facades.',
          'Si recibe data async: crear {nombre}-skeleton.component.ts colocated.',
          'Clases semanticas (no Tailwind generico):',
          '  .kpi-value / .kpi-label | .surface-hero | .surface-glass | .indicator-live | .badge-pulse',
          '  .card / .card-accent (1 por seccion) / .card-tinted',
          'Iconos: <app-icon name="kebab-case" /> SIEMPRE. PROHIBIDO emojis o SVG inline.',
          'Indices: COMPONENTS.md (que existe) | ANTI-PATTERNS.md (que evitar).'
        );
      }
      if (normalizedPath.includes('layout/')) {
        contextParts.push(
          'LAYOUT component — puede inyectar services de core/ directamente.',
          'Dark mode: ThemeService con [data-mode="dark"]. PrimeNG: darkModeSelector ".fake-dark-mode".'
        );
      }
    }

    // --- Repositories ---
    if (normalizedPath.includes('core/repositories/') && normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.spec.ts')) {
      contextParts.push(
        'REPOSITORY (core/repositories/) — UNICO lugar donde se llama .db.from().',
        'Un metodo por query. Retorna datos tipados o null. NUNCA retorna el objeto Supabase raw.',
        'Naming: {dominio}.repository.ts. Interface del row colocada en el mismo archivo.',
        'Los Facades inyectan el Repository. La UI NUNCA lo inyecta directamente.',
        'DEBE tener .spec.ts companero (mockear SupabaseService con { db: clientMock }).'
      );
    }

    // --- Facades de dominio (core/facades/) ---
    if (normalizedPath.includes('core/facades/') && normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.spec.ts')) {
      contextParts.push(
        'FACADE DE DOMINIO (core/facades/) — reglas completas en: facades.md + swr-pattern.md (auto-cargadas).',
        'OBLIGATORIO extender BaseFacade<T> de @core/facades/base.facade.',
        'Inyectar Repositories (core/repositories/) para queries. NUNCA llamar .db.from() directamente.',
        'Mutaciones: patron optimistic-first (prev = _data(), optimistic update, catch → _data.set(prev)).',
        'Toast: inject(ToastService) para feedback. NUNCA inject(MessageService).',
        'DEBE tener .spec.ts companero.'
      );
    }

    // --- Core Services (core/services/) ---
    if (normalizedPath.includes('core/services/') && normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.spec.ts')) {
      if (normalizedPath.includes('.facade.')) {
        // AuthFacade — excepción documentada: no extiende BaseFacade, gestiona sesión
        contextParts.push(
          'AUTH FACADE (core/services/) — excepcion: gestiona sesion de usuario, no datos de dominio.',
          'No extiende BaseFacade. Usa onAuthStateChange() de SupabaseService.',
          'Los Facades de dominio van en core/facades/, no aqui.'
        );
      } else if (normalizedPath.includes('.service.')) {
        contextParts.push(
          'CORE SERVICE — la UI NUNCA lo inyecta directamente (solo via Facades).',
          'RxJS para flujos async internos. DEBE tener .spec.ts companero.'
        );
      }
    }

    // --- Migraciones SQL ---
    if (normalizedPath.includes('supabase/migrations/')) {
      contextParts.push(
        'MIGRACION SQL — reglas completas en: database.md (auto-cargada).',
        'Naming: YYYYMMDDHHMMSS_dominio_tipo_descripcion.sql',
        'Idempotente: CREATE TABLE IF NOT EXISTS. SIEMPRE: ALTER TABLE x ENABLE ROW LEVEL SECURITY;',
        'Documenta la tabla nueva en indices/DATABASE.md.'
      );
    }

    // --- Templates HTML ---
    if (normalizedPath.includes('src/app/') && normalizedPath.endsWith('.html')) {
      contextParts.push(
        'Template Angular — reglas completas en: architecture.md + ai-readability.md (auto-cargadas).',
        'Control flow: @if / @for / @switch. Bindings: [class.x] / [style.x].',
        'Semántica IA: data-llm-action en botones de mutación | data-llm-description en inputs críticos.',
        'Iconos: <app-icon name="..." /> SIEMPRE. Botones: btn-primary | btn-secondary | btn-ghost.',
        ...(STACK.gsap
          ? ['Bento: .bento-grid + [appBentoGridLayout]. Animaciones: GsapAnimationsService.']
          : ['Bento: .bento-grid + [appBentoGridLayout]. Animaciones: .animate-fade-in-up.']),
        'PrimeNG: imports standalone (Button, Select, Table — no modules).'
      );
    }

    // --- Estilos SCSS ---
    if (normalizedPath.includes('src/') && (normalizedPath.endsWith('.scss') || normalizedPath.endsWith('.css'))) {
      contextParts.push(
        'Estilos — reglas completas en: visual-system.md (auto-cargada).',
        'Tokens: var(--*) de _variables.scss. NO hex hardcodeados.',
        'Layouts: .page-centered / .page-narrow / .page-wide. Grids: .bento-grid.',
        ...(STACK.gsap
          ? ['Motion en src/app/: NO @keyframes. GSAP para entradas, View Transitions para rutas.']
          : ['Motion: @keyframes permitido. Clases: .animate-fade-in-up / .animate-fade-in / .animate-stagger.']),
        'Consulta indices/STYLES.md para lista completa de tokens y helpers.'
      );
    }

    // --- Pure Utils ---
    if (normalizedPath.includes('core/utils/') && normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.spec.ts')) {
      contextParts.push(
        'FUNCION PURA (core/utils/) — sin inject(), sin signal(), sin side effects.',
        'Naming: {dominio}.utils.ts. Export via barrel core/utils/index.ts.',
        'DEBE tener .spec.ts companero.'
      );
    }

    // --- Directivas ---
    if (normalizedPath.includes('core/directives/') && normalizedPath.endsWith('.ts')) {
      contextParts.push(
        'DIRECTIVA (core/directives/) — documentar en indices/DIRECTIVES.md.',
        'Usar host bindings, inject() para DI.'
      );
    }

    // --- Emitir contexto si hay algo relevante ---
    if (contextParts.length > 0) {
      // Si existe memoria de fallos del linter, mencionar
      try {
        const lessonsPath = path.join(process.cwd(), '.claude', 'temp', 'LESSONS_LEARNED.md');
        if (fs.existsSync(lessonsPath)) {
          contextParts.push(
            '[MEMORIA] .claude/temp/LESSONS_LEARNED.md existe — revisa patrones que ya fallaron antes de repetirlos.'
          );
        }
      } catch (_) { /* ignore */ }

      const context = contextParts.join('\n');
      const output = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: context
        }
      });
      process.stdout.write(output);
    }

    process.exit(0);
  } catch (e) {
    // Si el hook falla por error interno, permitir la operación (fail-open)
    process.exit(0);
  }
});
