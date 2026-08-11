#!/usr/bin/env node
/**
 * context-enrichment-guard.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Fase 0: Day 0 Context Seeding Guard
 *
 * Este guardrail evita el problema del "lienzo en blanco" (vacío de conocimiento de negocio).
 * Si `context/domain.md` o `indices/DATABASE.md` están vacíos o siguen siendo el template
 * sin rellenar, bloquea la escritura de código fuente y obliga a pedirle contexto al humano.
 *
 * ⚠️ OPT-IN — NO viene cableado en `.claude/settings.json` por defecto.
 *
 * Motivo: un proyecto recién generado por Koa trae `context/domain.md` e `indices/*.md` como
 * plantillas vacías por diseño. Wireado por defecto, este hook bloquearía TODA escritura de
 * código desde el minuto cero, antes de que el usuario alcance a llenar nada.
 *
 * Actívalo cuando quieras esa disciplina (recomendado en proyectos con dominio complejo),
 * agregando a `.claude/settings.json` bajo PreToolUse / matcher "Edit|Write|MultiEdit":
 *
 *   { "type": "command", "command": "node .claude/hooks/context-enrichment-guard.js" }
 */

const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Solo activamos este verificador si intentamos escribir código fuente
    const isSourceCode =
      (normalizedPath.includes('src/app/') && !normalizedPath.endsWith('.spec.ts')) ||
      normalizedPath.includes('supabase/migrations/');

    if (isSourceCode) {
      // Ubicaciones del contexto crítico, según la convención Koa:
      //   context/domain.md   → Lenguaje Ubicuo / entidades del negocio
      //   indices/DATABASE.md → modelo de datos emparejado
      const workspaceRoot = process.cwd();
      const SURFACES = [
        { path: path.join(workspaceRoot, 'context', 'domain.md'), label: 'context/domain.md (Lenguaje Ubicuo)' },
        { path: path.join(workspaceRoot, 'indices', 'DATABASE.md'), label: 'indices/DATABASE.md (modelo de datos)' },
      ];

      // Marcadores que delatan un archivo todavía sin rellenar por el humano.
      const PLACEHOLDER_MARKERS = ['[TODO]', '{{PROJECT_NAME}}', '<!-- template -->'];
      const MIN_MEANINGFUL_LENGTH = 50;

      const missingFiles = [];

      for (const surface of SURFACES) {
        if (!fs.existsSync(surface.path)) {
          missingFiles.push(`${surface.label} — falta el archivo`);
          continue;
        }
        const content = fs.readFileSync(surface.path, 'utf8').trim();
        if (content.length < MIN_MEANINGFUL_LENGTH) {
          missingFiles.push(`${surface.label} — está vacío`);
        } else if (PLACEHOLDER_MARKERS.some(marker => content.includes(marker))) {
          missingFiles.push(`${surface.label} — sigue siendo el template sin rellenar`);
        }
      }

      if (missingFiles.length > 0) {
        process.stderr.write(
          `\u{1F6A7} DAY 0 CONTEXT GUARD: Prohibido programar a ciegas en un dominio nuevo.\n\n` +
          `Este proyecto carece de Contexto de Negocio fundacional.\n` +
          `Faltan o estan incompletas estas superficies:\n` +
          missingFiles.map(f => `  - ${f}`).join('\n') + `\n\n` +
          `INSTRUCCION PARA TI (AGENTE):\n` +
          `Dile al usuario: "Alto. Este proyecto todavia no tiene contexto de negocio. Pasame un brief, ` +
          `o detallame el Lenguaje Ubicuo (vocabulario del dominio) y el modelo preliminar de datos, ` +
          `para nutrir context/domain.md e indices/DATABASE.md ANTES de que yo escriba interfaces o ` +
          `facades a ciegas."\n\n` +
          `No escribas codigo fuente hasta rellenar esa base de conocimiento.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    // Fail-open: si falla el script de validación, permitir
    process.exit(0);
  }
});
