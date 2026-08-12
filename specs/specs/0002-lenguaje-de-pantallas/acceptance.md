# Acceptance 0002 — Lenguaje de pantallas: el contrato de UI

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verificado:** 2026-08-12
> **Método:** tests automáticos + QA en navegador real (Chromium, Playwright), 18 comprobaciones.

---

## Por qué la evidencia de navegador manda

Esta spec existe porque el contrato de UI no se puede verificar leyendo el diff. Durante su
implementación **el linter y los tests estuvieron en verde mientras la app tenía texto invisible en
producción**, y la captura de pantalla mostró una fila rota que ningún test detectaba.

Por eso los AC visuales llevan medición del navegador —el color que **pinta**, el ancho que
**ocupa**— y no la clase que dice el markup.

---

## Los 14 AC

| AC | Qué exige | Estado | Evidencia |
|---|---|---|---|
| **AC1** | Desktop: llena el viewport, el documento no scrollea | ✅ | Navegador 1400px, ambos temas: `documentoScrollea: false`, sin scroll horizontal |
| **AC2** | Bajo 1024px: la página scrollea nativo | ✅ | Navegador 390px: `documentoScrollea: true`, sin scroll horizontal |
| **AC3** | Ninguna celda de un `--fill-screen` abarca 2 filas | ✅ | ARCH-23 (`bento-fill-rows.js`) en verde sobre todo `src/` |
| **AC4** | El drawer **empuja** el contenido en desktop | ✅ | Medido: `main` de **1160px → 530px** al abrir |
| **AC5** | Toda pantalla usa las cinco piezas y sólo esas | ✅ | `ds-reference.component.spec.ts` (12 casos) + `screen-contract.md` |
| **AC6** | Los KPIs van en la banda del hero | ✅ | La referencia y la bandeja lo cumplen; documentado en la regla |
| **AC7** | Vocabulario semántico, no clusters de utilities | ✅ | ARCH-19 + **ARCH-24 nuevo** (cluster de input). Login migrado a `.field-input` |
| **AC8** | Sin colores Tailwind literales | ✅ | ARCH-08 en verde |
| **AC9** | Contraste AA en los dos temas | ✅ | **ARCH-25 nuevo**: 30/30 pares ≥4.5:1, baseline vacío. Navegador: `item-title` 19.9:1 (claro) y 16.12:1 (oscuro); `micro-label` 7.73:1 y 6.91:1 |
| **AC10** | Todo token de color existe en los dos temas | ✅ | `theme-tokens.js` en verde |
| **AC11** | `prefers-reduced-motion`: sin animación, callbacks igual | ✅ | Auditados los 11 métodos con `onComplete`. Navegador con `reducedMotion: 'reduce'`: contenido visible, drawer abre y **su callback de cierre corre** |
| **AC12** | Ningún tween vivo al destruir el componente | ✅ | `gsap-animations.cleanup.spec.ts` (5 casos, escritos primero y en rojo). Corregidos `kpi-card`, `section-hero`, `layout-drawer` y `killAll()` |
| **AC13** | Botón de sólo icono con nombre accesible | ✅ | A11Y-03 en verde |
| **AC14** | Icono usado = icono registrado | ✅ | ICON-01 en verde |
| **AC-E1** | 500 filas en móvil dentro del presupuesto de RNF-02 | ⬜ | **Sin verificar.** Ninguna pantalla tiene ese volumen todavía; se mide con la lista de movimientos (spec 0005) |
| **AC-E2** | Dato largo trunca sin romper el layout | ✅ | Navegador 1100px: `scrollWidth > clientWidth` en el título (trunca de verdad), fila de 44px, sin scroll horizontal |
| **AC-E3** | Monto de 9 cifras no desborda | ✅ | `$123.456.789` en la referencia, sin desborde ni scroll horizontal |

---

## Lo que la verificación encontró

Ocho defectos reales, ninguno detectable leyendo el código:

| # | Defecto | Cómo apareció |
|---|---|---|
| 1 | **Los inputs del login en 1.15:1 — texto invisible** | Midiendo el color pintado. `--color-base` en el `@theme` hacía que `text-base` fuera una utilidad de COLOR y le ganara a la de tamaño de fuente |
| 2 | Botón primario en 2.77:1 (claro) y 2.14:1 (oscuro) | ARCH-25, recién escrito |
| 3 | `--text-muted` ilegible sobre todo fondo, en ambos temas | ARCH-25 |
| 4 | `environment.prod.ts` **nunca se usaba** (sin `fileReplacements`) | Al querer excluir la ruta de dev del build |
| 5 | El wrapper de `lint:arch` no reenviaba los flags | Al intentar fijar el baseline |
| 6 | Las reglas de UI no se cargaban en `features/**/*.ts` | Revisando el path-scope antes de escribir |
| 7 | `DS_RULES` ignoraba ARCH-24: contaba y no reportaba | El detector encontraba 3 hits y el linter decía 0 |
| 8 | `animateCounter` dejaba un tween imposible de matar | Auditando AC12 |

Y dos de layout que **sólo se vieron en la captura**: el título largo partía la fila en dos
(faltaba `min-w-0`), y `.kpi-value` en una fila se comía el ancho del título — de ahí salió
`.row-value`.

---

## Lo que queda declarado, no cumplido

- **AC-E1** no se verificó: no hay pantalla con 500 filas. Se mide con la spec 0005.
- **El chunk de `/_ds` se emite en producción** (2,72 kB gzip). esbuild no constant-foldea
  `environment.production` a través del acceso a propiedad, así que el ternario queda en runtime.
  La ruta **es inalcanzable** (el array evalúa a `[]`), que era el requisito real; el chunk queda
  huérfano y nunca se pide.
- **La referencia va fuera de `authGuard`**, distinto de lo planeado. Una referencia de diseño que
  exige credenciales de producción para mirarse es la que se queda sin QA en navegador.

---

## Comandos de verificación

```bash
npm run test:ci        # 359 tests
npm run lint:arch      # 0 errores, 2 advertencias (ARCH-09 de section-hero y tabs, heredadas)
node --test scripts/lib/*.test.mjs          # 26 casos
node scripts/lib/class-discipline.test.mjs  # incluye ARCH-24
node scripts/lib/tailwind-bare-utilities.test.mjs  # incluye ARCH-26
ng serve && node qa-matriz.mjs              # 18 comprobaciones en navegador
```
