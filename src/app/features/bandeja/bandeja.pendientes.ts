import { Injectable, inject } from '@angular/core';

import { BandejaFacade } from '@core/facades/bandeja.facade';
import type { FuenteDePendientes, Pendiente } from '@core/models/pendiente.model';

/**
 * La bandeja, vista como pendiente.
 *
 * La spec 0003 es explícita: **la bandeja no es un destino del menú, es un
 * pendiente**. Ponerla en la navegación principal la convertiría en un lugar
 * al que hay que ir a trabajar — justo lo contrario de lo que el producto
 * promete, que es que el trabajo aparezca solo cuando existe.
 *
 * Este archivo vive en `features/bandeja/` y no en `core/`: es el dominio el
 * que se registra, no el núcleo el que sabe de dominios.
 */
@Injectable({ providedIn: 'root' })
export class BandejaPendientes implements FuenteDePendientes {
  readonly id = 'bandeja';

  private readonly facade = inject(BandejaFacade);

  async cargar(): Promise<Pendiente[]> {
    await this.facade.initialize();

    // `initialize()` no lanza: guarda el error en la señal y devuelve normal.
    // Sin este relanzado, una bandeja caída se leería como cero pendientes y
    // Hoy diría "no hay nada que hacer" — que es el peor fallo posible en esta
    // pantalla, porque el usuario cierra la app creyendo que está al día.
    const error = this.facade.error();
    if (error) throw new Error(error);

    const total = this.facade.total();
    if (total === 0) return [];

    const faltanDatos = this.facade.necesitanDatos();

    return [
      {
        tipo: 'captura',
        titulo: total === 1 ? 'Un movimiento por confirmar' : `${total} movimientos por confirmar`,
        // Lo que distingue el trabajo de un toque del que exige tipear. Callarlo
        // haría que "12 pendientes" pese lo mismo sean doce confirmaciones o
        // doce formularios.
        detalle: faltanDatos > 0 ? `${faltanDatos} necesitan que escribas el monto` : undefined,
        cantidad: total,
        ruta: '/app/bandeja',
        prioridad: 1,
      },
    ];
  }
}
