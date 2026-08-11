<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Signal Stores (NgRx Signal Store)

> Este archivo solo existe si el proyecto fue generado con `--with-ngrx-signals`.
> Documenta los Signal Stores de `core/state/`.

<!-- AUTO-GENERATED:BEGIN -->
| Store | Dominio | Signals | Computed | Métodos | Estado |
|-------|---------|---------|----------|---------|--------|
| — | — | — | — | — | Sin stores aún |
<!-- AUTO-GENERATED:END -->

<!-- DETAIL:BEGIN -->
## Cuándo agregar un Store

Solo cuando el dominio cumple **al menos uno** de estos criterios:
- Estado compartido entre 2+ features
- Más de 5 signals con derived state complejo
- Necesitas `patchState()` para updates parciales atómicos

Para casos simples, usa Facade (`core/services/*.facade.ts`).
