import { InjectionToken } from '@angular/core';

/**
 * Pendiente — algo que espera una decisión del hogar.
 *
 * Es el modelo que hace posible que Hoy responda "¿tengo que hacer algo?" sin
 * saber nada de los dominios que producen ese trabajo.
 */
export interface Pendiente {
  /** Quién lo produjo: 'captura', 'despensa', 'cuota'… Sirve para el icono y para agrupar. */
  tipo: string;
  titulo: string;
  detalle?: string;
  /** Cuántas cosas son. La spec exige el número exacto, no un "tienes pendientes". */
  cantidad: number;
  /** A dónde lleva resolverlo. */
  ruta: string;
  /** Menor = más arriba. */
  prioridad: number;
}

/**
 * Una fuente de pendientes. La implementa cada dominio, no Hoy.
 */
export interface FuenteDePendientes {
  /** Identifica la fuente en los reportes de error. Único por dominio. */
  readonly id: string;
  cargar(): Promise<Pendiente[]>;
}

/**
 * El registro de fuentes.
 *
 * **Por qué un token multi y no una lista en un servicio:** con una lista,
 * agregar un módulo obliga a editar el archivo que la contiene, y ese archivo
 * termina importando a todos. Es exactamente cómo el dashboard de v1 acabó
 * inyectando los nueve facades del proyecto: cada módulo nuevo lo rompía, y
 * nadie quería tocarlo.
 *
 * Con `multi: true` la dirección se invierte. Cada dominio se registra a sí
 * mismo y **Hoy no importa a ninguno**:
 *
 * ```ts
 * // en app.config.ts
 * { provide: FUENTE_DE_PENDIENTES, useExisting: BandejaPendientes, multi: true }
 * ```
 *
 * Agregar un módulo = agregar un proveedor. Nunca se toca Hoy.
 */
export const FUENTE_DE_PENDIENTES = new InjectionToken<readonly FuenteDePendientes[]>(
  'fuente-de-pendientes',
);
