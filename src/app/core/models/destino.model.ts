/**
 * Destino — una sección de primer nivel de la navegación.
 *
 * La spec 0003 fija cinco (Hoy · Plata · Casa · Cuerpo · Ajustes) y prohíbe
 * mostrar los que todavía no tienen contenido (AC4). Las dos cosas conviven
 * porque el orden canónico se declara acá y la **visibilidad** se deriva:
 * un destino aparece cuando su módulo se registra, no cuando alguien se acuerda
 * de descomentar su entrada.
 */
export interface Destino {
  /** Identificador estable. No se muestra. */
  id: string;
  label: string;
  /** Nombre kebab-case de lucide.dev. Debe estar en el pick() de app.config.ts (ICON-01). */
  icon: string;
  /** Ruta absoluta. NAV-01 verifica que exista en app.routes.ts. */
  routerLink: string;
}

/**
 * El orden en que se muestran los destinos que existan.
 *
 * Es una lista de **posiciones**, no de entradas visibles: estar acá no alcanza
 * para aparecer en el menú. Un destino se muestra sólo si además está
 * registrado (ver `NavegacionService`).
 *
 * El orden no es estético. Hoy va primero porque es la respuesta a "¿tengo que
 * hacer algo?"; Ajustes último porque se toca una vez y casi nunca más.
 */
export const ORDEN_DE_DESTINOS = ['hoy', 'plata', 'casa', 'cuerpo', 'ajustes'] as const;

export type IdDeDestino = (typeof ORDEN_DE_DESTINOS)[number];

/**
 * Hoy — el único destino con contenido por ahora.
 *
 * Los otros cuatro se declaran junto a su spec, no acá: tenerlos definidos y
 * comentados sería la misma lista de promesas, sólo que en otro archivo.
 */
export const DESTINO_HOY: Destino = {
  id: 'hoy',
  label: 'Hoy',
  icon: 'home',
  routerLink: '/app/hoy',
};
