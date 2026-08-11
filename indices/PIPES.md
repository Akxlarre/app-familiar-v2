<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Pipes

> **Regla de Actualización:** El Agente debe sugerir adiciones a esta tabla usando `<memory_update>` cada vez que cree un pipe nuevo.

## Pipes de Formateo

| Pipe | Nombre en template | Propósito | Params | Estado |
|------|--------------------|-----------|--------|--------|
| `RelativeTimePipe` | `relativeTime` | Convierte fecha a texto relativo ("hace 5 min", "ayer") | `locale` (default: `'es'`) | ✅ Estable |

<!-- DETAIL:BEGIN -->
## Pipes Nativos de Angular (Recordatorio)

> No reinventes estos — Angular ya los incluye:

| Pipe | Uso | Ejemplo |
|------|-----|---------|
| `DatePipe` | `{{ date \| date:'dd/MM/yyyy' }}` | Formateo de fechas |
| `CurrencyPipe` | `{{ amount \| currency:'CLP' }}` | Formateo de moneda |
| `DecimalPipe` | `{{ value \| number:'1.0-2' }}` | Formateo numérico |
| `TitleCasePipe` | `{{ text \| titlecase }}` | Capitalización |
| `AsyncPipe` | `{{ obs$ \| async }}` | Suscripción a observables |

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Pipe | Clase | Pure | Archivo |
|------|-------|------|---------|
| `safe` | `SafePipe` | ✅ | `src/app/core/pipes/safe.pipe.ts` |
| `relativeTime` | `RelativeTimePipe` | ❌ impure | `src/app/shared/pipes/relative-time.pipe.ts` |

<!-- AUTO-GENERATED:END -->
