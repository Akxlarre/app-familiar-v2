<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Directivas

> **Regla de Actualización:** El Agente debe sugerir adiciones a esta tabla usando `<memory_update>` cada vez que cree una directiva nueva o modifique una existente.

## Directivas de Animación / GSAP

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `AnimateInDirective` | `[appAnimateIn]` | Fade+slide de entrada para elementos bajo `@if` | — | ✅ Estable |
| `CardHoverDirective` | `[appCardHover]` | Efecto hover GSAP sobre `.card` (sombra + y:-2px) | — | ✅ Estable |
| `BentoGridLayoutDirective` | `[appBentoGridLayout]` | FLIP animado para reflows del bento-grid | — | ✅ Estable |

## Directivas de Auth / RBAC

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `HasRoleDirective` | `*appHasRole` | Renderizado condicional por rol (estructural) | `appHasRole: UserRole\|UserRole[]` | ✅ Estable |

## Directivas de UX Interactiva

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `PressFeedbackDirective` | `[appPressFeedback]` | Hover+press GSAP sobre botones y triggers | `appPressFeedback: 'full'\|'press'` | ✅ Estable |
| `SearchShortcutDirective` | `[appSearchShortcut]` | Atajo global Ctrl+K / Cmd+K → SearchPanelService | — | ✅ Estable |
| `ClickOutsideDirective` | `[appClickOutside]` | Emite evento al hacer clic fuera del elemento host | `clickOutsideEnabled: boolean` | ✅ Estable |

## Directivas de Layout

| Directiva | Selector | Propósito | Inputs | Estado |
|-----------|----------|-----------|--------|--------|
| `ModalOverlayDirective` | `[appModalOverlay]` | Teleporta el modal al overlay container (z-index > topbar) | `appModalOverlay: boolean` | ✅ Estable |

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Clase | Selector | Inputs | Outputs | Archivo |
|-------|----------|--------|---------|---------|
| `AnimateInDirective` | `[appAnimateIn]` | — | — | `src/app/core/directives/animate-in.directive.ts` |
| `BENTO_GRID_LAYOUT_CONTEXT` | `[appBentoGridLayout]` | — | — | `src/app/core/directives/bento-grid-layout.directive.ts` |
| `BentoRevealDirective` | `[appBentoReveal]` | `skipOpacity` | — | `src/app/core/directives/bento-reveal.directive.ts` |
| `CardHoverDirective` | `[appCardHover]` | — | — | `src/app/core/directives/card-hover.directive.ts` |
| `ClickOutsideDirective` | `[appClickOutside]` | `clickOutsideEnabled` | `clickOutside` | `src/app/core/directives/click-outside.directive.ts` |
| `HasRoleDirective` | `[appHasRole]` | `appHasRole` | — | `src/app/core/directives/has-role.directive.ts` |
| `ModalOverlayDirective` | `[appModalOverlay]` | `appModalOverlay` | — | `src/app/core/directives/modal-overlay.directive.ts` |
| `PressFeedbackDirective` | `[appPressFeedback]` | `appPressFeedback` | — | `src/app/core/directives/press-feedback.directive.ts` |
| `ScrollContainerDirective` | `[appScrollContainer]` | `maxHeight`, `scrollX` | — | `src/app/core/directives/scroll-container.directive.ts` |
| `ScrollRevealDirective` | `[appScrollReveal]` | `appScrollReveal` | — | `src/app/core/directives/scroll-reveal.directive.ts` |
| `SearchShortcutDirective` | `[appSearchShortcut]` | — | — | `src/app/core/directives/search-shortcut.directive.ts` |
| `StableWidthDirective` | `[appStableWidth]` | `appStableWidth` | — | `src/app/core/directives/stable-width.directive.ts` |

<!-- AUTO-GENERATED:END -->
