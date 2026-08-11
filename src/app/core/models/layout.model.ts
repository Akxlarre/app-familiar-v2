/**
 * Tier de layout — resuelto por el ancho REAL del contenedor `<main>`,
 * no por el viewport.
 *
 * La distinción importa: un drawer lateral angosta `<main>` sin cambiar el
 * viewport. Si la densidad se decidiera por viewport, el contenido no
 * reaccionaría al drawer y quedaría apretado.
 *
 * Ver `LayoutService.tier` y `core/utils/layout-tier.utils.ts`.
 */
export type LayoutTier = 'mobile' | 'tablet' | 'desktop';
