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

## 2026-08-11T15:56:47.473Z — Recuperación tras fallo ARCH

### Contexto
El linter falló y luego fue corregido. Este es el último fallo registrado (útil para evitar recaídas):

```
[33m🔍 Iniciando Auditoría Arquitectónica (AST Mode v2.0)...[0m

[36m   ℹ ICON-01: 12 archivo(s) usan [name] dinámico — no verificable estáticamente.[0m

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

[31m🚨 [ICON-01] Icon used but not registered: Iconos usados en templates pero NO registrados: loader-circle, circle-alert[0m
[36m   Archivo: src/app/app.config.ts[0m
[33m   Fix: Agrega el icono al LucideAngularModule.pick({...}) de app.config.ts — si falta, lucide lanza en RUNTIME.[0m
[36m   Doc: .claude/skills/design-system/SKILL.md[0m

[31m❌ Auditoría falló: 1 error(es), 2 advertencia(s).[0m
```

## 2026-08-11T21:37:49.977Z — Recuperación tras fallo ARCH

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
   ARCH-25 — Contrast below WCAG AA — .claude/rules/visual-system.md
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

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --text-muted sobre --bg-base da 2.33:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --text-muted sobre --bg-surface da 2.56:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --text-muted sobre --bg-subtle da 2.02:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --state-success sobre --state-success-bg da 3.15:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --state-warning sobre --state-warning-bg da 3.07:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --state-error sobre --state-error-bg da 4.41:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --state-success sobre --bg-surface da 3.3:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --state-warning sobre --bg-surface da 3.19:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --btn-primary-text sobre --btn-primary-bg da 2.77:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc
... (truncado)
```

## 2026-08-11T21:37:58.569Z — Recuperación tras fallo ARCH

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
   ARCH-25 — Contrast below WCAG AA — .claude/rules/visual-system.md
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

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --text-secondary sobre --bg-base da 1.34:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [claro] --text-secondary sobre --bg-surface da 1.48:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m❌ Auditoría falló: 2 error(es), 2 advertencia(s).[0m
```

## 2026-08-11T22:23:59.450Z — Recuperación tras fallo ARCH

### Contexto
El linter falló y luego fue corregido. Este es el último fallo registrado (útil para evitar recaídas):

```
[33m🔍 Iniciando Auditoría Arquitectónica (AST Mode v2.0)...[0m

[36m   ℹ ICON-01: 10 archivo(s) usan [name] dinámico — no verificable estáticamente.[0m
[36m   ℹ ARCH-25: 6 par(es) no evaluables (color-mix u otros).[0m

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
   ARCH-25 — Contrast below WCAG AA — .claude/rules/visual-system.md
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

[31m🚨 [ARCH-25] Contrast below WCAG AA: [oscuro] --state-success sobre --state-success-bg da 1.64:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [oscuro] --state-warning sobre --state-warning-bg da 1.58:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m🚨 [ARCH-25] Contrast below WCAG AA: [oscuro] --state-error sobre --state-error-bg da 2.51:1 (mínimo 4.5).[0m
[36m   Archivo: src/styles/tokens/_variables.scss[0m
[33m   Fix: Ajusta el token de texto o el de fondo hasta 4.5:1 (3.0:1 si el texto es grande). Que un token exista en los dos temas no significa que se pueda leer.[0m
[36m   Doc: .claude/rules/visual-system.md[0m

[31m❌ Auditoría falló: 3 error(es), 2 advertencia(s).[0m
```

