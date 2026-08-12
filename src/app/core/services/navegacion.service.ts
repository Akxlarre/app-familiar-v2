import { Injectable, InjectionToken, computed, inject } from '@angular/core';

import { ORDEN_DE_DESTINOS, type Destino } from '@core/models/destino.model';

/**
 * Registro de destinos de primer nivel.
 *
 * Cada módulo que tiene contenido se registra acá. La navegación **no** tiene
 * una lista de secciones: la deriva de lo registrado.
 *
 * ```ts
 * // en app.config.ts
 * { provide: DESTINO_REGISTRADO, useValue: DESTINO_HOY, multi: true }
 * ```
 */
export const DESTINO_REGISTRADO = new InjectionToken<readonly Destino[]>('destino-registrado');

/**
 * NavegacionService — qué secciones existen hoy.
 *
 * La spec 0003 enumera cinco destinos y a la vez prohíbe mostrar entradas de
 * módulos que no existen (AC4). No es una contradicción: el orden de los cinco
 * es una decisión de producto y vive en `ORDEN_DE_DESTINOS`, pero **aparecer**
 * depende de estar registrado.
 *
 * Por eso el menú no puede quedar desactualizado: no hay nada que actualizar.
 * Un módulo nuevo enciende su destino registrándose, y uno que se saca
 * desaparece del menú solo. Es lo contrario de v1, que tenía nueve entradas
 * fijas y siete llevaban a pantallas donde no había nada.
 */
@Injectable({ providedIn: 'root' })
export class NavegacionService {
  /** `optional`: un proyecto sin destinos registrados es válido, no un error. */
  private readonly registrados = inject<readonly Destino[]>(DESTINO_REGISTRADO, {
    optional: true,
  }) ?? [];

  /**
   * Los destinos visibles, en el orden canónico.
   *
   * Un id fuera de `ORDEN_DE_DESTINOS` se ignora: los destinos de primer nivel
   * son una decisión de producto, no algo que se agregue registrando.
   */
  readonly destinos = computed<Destino[]>(() => {
    const porId = new Map<string, Destino>();
    for (const destino of this.registrados) {
      if (!porId.has(destino.id)) porId.set(destino.id, destino);
    }
    return ORDEN_DE_DESTINOS.map((id) => porId.get(id)).filter((d): d is Destino => d !== undefined);
  });

  /**
   * Si la url actual pertenece a este destino.
   *
   * Compara por segmento y no por prefijo de texto: `/app/plataforma` no es
   * `/app/plata`, y marcar la sección equivocada es peor que no marcar ninguna.
   */
  esActivo(destino: Destino, url: string): boolean {
    const limpia = url.split('?')[0].split('#')[0];
    return limpia === destino.routerLink || limpia.startsWith(`${destino.routerLink}/`);
  }
}
