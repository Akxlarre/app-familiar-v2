# Plan 0002 — Lenguaje de pantallas: el contrato de UI

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-11

---

## 1. Resumen ejecutivo

De los 14 AC de la spec, **siete ya están enforzados** por el linter arquitectónico y otros dos por
el código existente. Este track no construye un design system: **cierra la brecha entre lo que las
reglas dicen y lo que el proyecto puede verificar**, y deja una pantalla de referencia viva para
copiar en vez de reinventar.

Tres entregables: la ruta `/app/_ds` (sólo dev), el arreglo del path-scope de las reglas —que hoy
**no** se cargan al editar `features/**/*.ts`, que es donde viven los templates inline— y el cierre
de los tres AC que hoy no verifica nadie (contraste AA, limpieza de tweens, disciplina tipográfica).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/features/_ds/ds-reference.component.ts` | Smart | Pantalla de referencia: las cinco piezas armadas, con datos falsos |
| `src/app/features/_ds/ds-reference.component.spec.ts` | Test | Verifica que la referencia usa las piezas canónicas (si se pudre, el test falla) |
| `src/app/features/_ds/ds-drawer-demo.component.ts` | Dumb | El contenido del drawer que abre la referencia |
| `scripts/lib/contrast-check.js` | Guardrail | AC9: contraste AA de los pares de tokens texto/fondo, en los dos temas |
| `scripts/lib/contrast-check.test.mjs` | Test | Micro-suite del guardrail |
| `.claude/rules/screen-contract.md` | Regla | El contrato de las cinco piezas, path-scoped a `features/**` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/app.routes.ts` | Ruta `_ds` bajo `/app`, excluida en producción | AC5 — la referencia tiene que ser alcanzable en dev |
| `.claude/rules/visual-system.md` | Agregar `src/app/features/**/*.ts` a `paths:` | **Bug real:** los templates inline de `features/` no reciben la regla hoy |
| `.claude/rules/a11y-spec.md` | Idem | Mismo bug |
| `scripts/lib/class-discipline.js` | Detector ARCH-24: cluster de input ad-hoc | AC7 — `.field-input` existe pero nada impide volver a escribir el cluster |
| `scripts/architect.js` (o su wrapper) | Registrar contrast-check y ARCH-24 | Que corran en `npm run lint:arch` |
| `indices/STYLES.md` | Documentar la ruta de referencia | Descubribilidad |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

Leído: `indices/COMPONENTS.md`, `indices/STYLES.md`, `indices/USAGE-MAP.md`, `indices/DIRECTIVES.md`,
`.claude/rules/visual-system.md`, `src/styles/layout/_bento-grid.scss`.

### Lo que ya existe y se reutiliza tal cual
- `app-section-hero` — hero con banda de KPIs, `density="slim"`, skeletons.
- `app-empty-state`, `app-error-state`, `app-skeleton-block` — los tres estados.
- `LayoutDrawerService` + `LayoutDrawerComponent`, ya con soporte de `inputs`.
- `bento-grid--fill-screen`, `--fill-screen-2`, `--fill-screen-kpi` en `_bento-grid.scss`.
- `.kpi-value`, `.micro-label`, `.item-title`, `.section-eyebrow`, `.field-label`, `.field-input`.
- `BentoGridLayoutDirective`, `BentoRevealDirective`, `GsapAnimationsService`.

### Guardrails que ya cubren AC de esta spec

| AC | Ya lo enforza | Estado |
|---|---|---|
| AC3 · fill-screen sin celdas de 2 filas | ARCH-23 `bento-fill-rows.js` | ✅ |
| AC8 · sin colores Tailwind literales | ARCH-08 | ✅ |
| AC10 · tokens en los dos temas | `theme-tokens.js` | ✅ |
| AC13 · botón de icono con nombre accesible | A11Y-03 | ✅ |
| AC14 · icono registrado | ICON-01 | ✅ |
| AC7 (parcial) · clusters tipográficos | ARCH-19 | ⚠️ no cubre inputs |
| — · clases bento fuera de allowlist | ARCH-21 | ✅ |

### Lo que hay que crear, y por qué no alcanza lo existente
- **Pantalla de referencia:** no existe nada equivalente. La bandeja es conformante pero está
  acoplada a su dominio; copiar de ella arrastra `BandejaFacade`.
- **`contrast-check.js`:** `theme-tokens.js` verifica que un token exista en los dos temas, no que
  el par texto/fondo tenga contraste suficiente. Son cosas distintas.
- **ARCH-24:** `class-discipline.js` cubre pills, tamaños sobre `btn-*` y font-sizes arbitrarios.
  No cubre el cluster de input, que es el que acabamos de reemplazar por `.field-input`.

---

## 4. Modelo de datos

**N/A.** Esta spec no toca persistencia. La pantalla de referencia usa datos hardcodeados a
propósito: si dependiera de un facade, dejaría de servir como referencia el día que ese dominio cambie.

---

## 5. Arquitectura del feature

```
/app/_ds  (sólo dev)
   └─ DsReferenceComponent
        ├─ <app-section-hero density="slim" [kpis]="…">   ← pieza 1
        └─ .bento-grid--fill-screen
             └─ .bento-fill.card                           ← pieza 2 (panel que llena)
                  ├─ cabecera fija
                  ├─ cuerpo scrolleable
                  │    ├─ <ul> de filas                    ← pieza 3
                  │    ├─ <app-empty-state>                ← pieza 5
                  │    ├─ <app-error-state>
                  │    └─ <app-skeleton-block>
                  └─ pie fijo
        └─ (botón) → LayoutDrawerFacadeService.open(DsDrawerDemoComponent)  ← pieza 4
```

La referencia tiene un control para forzar cada estado (normal / vacío / error / cargando), porque
un estado que sólo se ve cuando falla el servidor es un estado que nadie revisa.

### Capas tocadas
- **Smart:** `features/_ds/ds-reference.component.ts`
- **Dumb:** `features/_ds/ds-drawer-demo.component.ts`
- **Guardrails:** `scripts/lib/contrast-check.js`, extensión de `class-discipline.js`
- **Harness:** `.claude/rules/screen-contract.md` y el path-scope de dos reglas existentes

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush y signals en los dos componentes nuevos
- [ ] `facades.md` — N/A: la referencia no usa facades de dominio a propósito
- [ ] `models.md` — N/A
- [x] `visual-system.md` — es literalmente el objeto de este track
- [ ] `swr-pattern.md` — N/A
- [ ] `notifications.md` — N/A
- [x] `testing-tdd.md` — specs para los dos guardrails nuevos y para la referencia
- [x] `ai-readability.md` — `data-llm-*` en los controles de la referencia
- [x] `a11y-spec.md` — la referencia es el lugar donde se prueba AC9 y AC13

---

## 7. Plan de testing

- **Unitarios:** `contrast-check.test.mjs` (pares con y sin contraste suficiente, ambos temas) y
  la extensión de `class-discipline.test.mjs` para ARCH-24.
- **De componente:** `ds-reference.component.spec.ts` verifica que la referencia usa las cinco
  piezas. Es un test contra la pudrición: si alguien la simplifica, falla.
- **QA en navegador (obligatorio):** la lección de esta sesión es que compilar no alcanza. Con
  `ng serve`, en la ruta `/app/_ds`: los cuatro estados, los dos temas, ≥1024px y <1024px, drawer
  abierto y cerrado, y `prefers-reduced-motion` forzado.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| La ruta `_ds` se filtra a producción | Media | Excluirla en la config de rutas y verificar en el bundle de `npm run build` que no aparece el chunk |
| La referencia se pudre y deja de reflejar el contrato | Alta | `ds-reference.component.spec.ts` la ata a las cinco piezas; y ARCH-24 impide reintroducir clusters |
| El contraste AA es subjetivo según qué par se compare | Media | Verificar sólo los pares declarados (texto sobre su fondo canónico), no el producto cartesiano |
| Migrar el dashboard al contrato | — | **No se hace.** Ver decisión abajo |

### Decisión de scope: el dashboard NO se migra

El dashboard de hoy viola AC1, AC5 y AC6 (usa `bento-grid` sin `--fill-screen` y `app-kpi-card`
en vez de la banda del hero). Es tentador arreglarlo acá, y sería trabajo tirado: **la spec 0003 lo
reemplaza por la pantalla Hoy.** Se deja como está y se migra cuando se construya su reemplazo.

La pantalla conformante de referencia es `/app/_ds`; la bandeja ya cumple el contrato y sirve de
segundo ejemplo, con dominio real.

---

## 9. Orden de implementación

1. **Arreglar el path-scope de las reglas** — es un bug y es barato; todo lo demás se escribe con
   las reglas ya cargándose bien.
2. `contrast-check.js` + su test, y cablearlo en `lint:arch`.
3. ARCH-24 en `class-discipline.js` + su test.
4. `screen-contract.md`.
5. Pantalla de referencia + drawer demo + spec.
6. Ruta, excluida de producción.
7. QA en navegador de los cuatro estados × dos temas × dos anchos.
8. `acceptance.md` con evidencia por AC.

---

## 10. Estimación

**M.** El grueso es la pantalla de referencia y el QA en navegador; los guardrails son chicos.

---

## Changelog

- 2026-08-11 — plan inicial.
