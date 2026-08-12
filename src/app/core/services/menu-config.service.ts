import { Injectable, inject } from '@angular/core';

import { NavegacionService } from '@core/services/navegacion.service';
import type { Destino } from '@core/models/destino.model';

/**
 * Item de navegación lateral.
 *
 * Es el mismo contrato que `Destino`: se conserva el alias para que el sidebar
 * no tenga que hablar del modelo de navegación.
 */
export type NavItem = Destino;

/**
 * MenuConfigService — adaptador sobre `NavegacionService`.
 *
 * **Ya no tiene una lista de items.** La tenía, y con ella una entrada a
 * `/app/settings` que nunca existió como ruta: el usuario hacía clic y caía en
 * el not-found. Ese es el modo de fallar de una lista escrita a mano — no se
 * rompe, se desincroniza, y nada avisa.
 *
 * Ahora el menú se deriva de los destinos registrados, y NAV-01 verifica en
 * cada auditoría que cada entrada resuelva a una ruta declarada.
 *
 * Para agregar una sección se registra su `Destino` (ver `DESTINO_REGISTRADO`).
 * Acá no hay nada que tocar nunca más.
 */
@Injectable({ providedIn: 'root' })
export class MenuConfigService {
  private readonly navegacion = inject(NavegacionService);

  readonly menuItems = this.navegacion.destinos;
}
