# Lessons Learned (lint:arch)

> Se alimenta automáticamente cuando una auditoría falla y luego vuelve a pasar.

## 2026-08-11T15:24:57.568Z — Recuperación tras fallo ARCH

### Contexto
El linter falló y luego fue corregido. Este es el último fallo registrado (útil para evitar recaídas):

```
[33m🔍 Iniciando Auditoría Arquitectónica (AST Mode v2.0)...[0m

[36m   ℹ ICON-01: 10 archivo(s) usan [name] dinámico — no verificable estáticamente.[0m

[33m📋 Reglas validadas:[0m
   ARCH-11 — Dead token classes — .claude/rules/visual-system.md
   ARCH-18 — Forbidden bare aliases in @theme — .claude/rules/visual-system.md
   ARCH-21 — Unreviewed .bento-* class — indices/STYLES.md
   ARCH-22 — DS class collides with bare Tailwind utility — .claude/rules/visual-system.md
   ARCH-15 — Ad-hoc pill/badge — .claude/rules/visual-system.md
   ARCH-16 — Size utilities over btn-* — .claude/rules/visual-system.md
   ARCH-17 — Arbitrary font size — .claude/rules/visual-system.md
   ARCH-19 — Ad-hoc typography cluster — .claude/rules/visual-system.md
   ARCH-23 — Fill-screen bento cell spanning 2 rows — .claude/rules/visual-system.md
   A11Y-03 — Icon-only button without accessible name — .claude/rules/a11y-spec.md
   ICON-01 — Icon used but not registered — .claude/skills/design-system/SKILL.md
   ARCH-01 — No Supabase in UI — docs/TECH-STACK-RULES.md#arch-01
   ARCH-02 — Facade-only injection — docs/TECH-STACK-RULES.md#arch-02
   ARCH-03 — TDD required for core logic — docs/TECH-STACK-RULES.md#arch-03
   ARCH-04 — OnPush required — docs/TECH-STACK-RULES.md#arch-04
   ARCH-05 — No @angular/animations — docs/TECH-STACK-RULES.md#arch-05
   ARCH-06 — No legacy template directives — docs/TECH-STACK-RULES.md#arch-06
   ARCH-07 — No @keyframes in app styles — docs/TECH-STACK-RULES.md#arch-07
   ARCH-08 — No hardcoded Tailwind colors — docs/TECH-STACK-RULES.md#arch-08
   ARCH-09 — Complexity warning (shared components) — docs/TECH-STACK-RULES.md#arch-09
   ARCH-10 — Complexity warning (facades) — docs/TECH-STACK-RULES.md#arch-10


[33m⚠️  [ARCH-09] Complexity warning (shared components): Clase demasiado grande (1166 líneas). Límite recomendado: 200.[0m
[36m   Archivo: src/app/shared/components/section-hero/section-hero.component.ts[0m
[33m   Fix: Divide el componente en subcomponentes o extrae lógica a servicios/utilidades. Mantén shared/ simple.[0m
[36m   Doc: docs/TECH-STACK-RULES.md#arch-09[0m

[33m⚠️  [ARCH-09] Complexity warning (shared components): Clase demasiado grande (298 líneas). Límite recomendado: 200.[0m
[36m   Archivo: src/app/shared/components/tabs/tabs.component.ts[0m
[33m   Fix: Divide el componente en subcomponentes o extrae lógica a servicios/utilidades. Mantén shared/ simple.[0m
[36m   Doc: docs/TECH-STACK-RULES.md#arch-09[0m

[31m🚨 [ARCH-19] Ad-hoc typography cluster: Disciplina de clases del DS: 0 tolerado(s) → 3 ahora. Ej: micro-label[0m
[36m   Archivo: src/app/shared/components/section-hero/section-hero.component.ts[0m
[33m   Fix: Usa .micro-label / .item-title / .section-eyebrow / .kpi-value en vez de recomponer el cluster de utilities.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m❌ Auditoría falló: 1 error(es), 2 advertencia(s).[0m
```

