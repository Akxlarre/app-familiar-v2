import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import { FUENTE_DE_PENDIENTES, type FuenteDePendientes, type Pendiente } from '@core/models/pendiente.model';
import type { Movimiento } from '@core/models/movimiento.model';
import { HoyFacade } from './hoy.facade';

const CAPTURA: Pendiente = {
  tipo: 'captura',
  titulo: '3 movimientos por confirmar',
  cantidad: 3,
  ruta: '/app/bandeja',
  prioridad: 1,
};

const MOVIMIENTO: Movimiento = {
  id: 'm1',
  monto: 12990,
  tipo: 'gasto',
  fecha: '2026-08-12',
  comercio: 'Jumbo',
  nota: null,
  capturaId: 'c1',
  creadoEn: '2026-08-12T10:00:00Z',
};

function crear(opciones: {
  pendientes?: Pendiente[];
  fuenteFalla?: boolean;
  movimientos?: Movimiento[];
  movimientosFallan?: boolean;
}) {
  const fuente: FuenteDePendientes = {
    id: 'bandeja',
    cargar: async () => {
      if (opciones.fuenteFalla) throw new Error('la base no responde');
      return opciones.pendientes ?? [];
    },
  };

  const repo = {
    ultimos: vi.fn(async () => {
      if (opciones.movimientosFallan) throw new Error('relation "movimientos" does not exist');
      return opciones.movimientos ?? [];
    }),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: FUENTE_DE_PENDIENTES, useValue: fuente, multi: true },
      { provide: MovimientosRepository, useValue: repo },
    ],
  });

  return { facade: TestBed.inject(HoyFacade), repo };
}

describe('HoyFacade', () => {
  it('carga pendientes y movimientos', async () => {
    const { facade } = crear({ pendientes: [CAPTURA], movimientos: [MOVIMIENTO] });

    await facade.initialize();

    expect(facade.totalPendientes()).toBe(3);
    expect(facade.movimientos()).toHaveLength(1);
  });

  it('si los movimientos fallan, los pendientes se ven igual', async () => {
    const { facade } = crear({ pendientes: [CAPTURA], movimientosFallan: true });

    await facade.initialize();

    expect(facade.pendientes()).toHaveLength(1);
    expect(facade.errorMovimientos()).toBeTruthy();
  });

  it('si una fuente de pendientes falla, los movimientos se ven igual', async () => {
    const { facade } = crear({ fuenteFalla: true, movimientos: [MOVIMIENTO] });

    await facade.initialize();

    expect(facade.movimientos()).toHaveLength(1);
    expect(facade.hayFuentesCaidas()).toBe(true);
  });

  it('el error de movimientos nunca filtra el texto crudo de la base', async () => {
    const { facade } = crear({ movimientosFallan: true });

    await facade.initialize();

    expect(facade.errorMovimientos()).not.toContain('relation');
    expect(facade.errorMovimientos()).not.toContain('movimientos" does not exist');
  });

  it('sin nada pendiente lo dice, pero sólo después de preguntar', async () => {
    const { facade } = crear({ pendientes: [] });

    expect(facade.sinNadaPendiente()).toBe(false);

    await facade.initialize();

    expect(facade.sinNadaPendiente()).toBe(true);
  });

  it('pide sólo los últimos movimientos, no la tabla entera', async () => {
    // Hoy es un vistazo. Traer todo para mostrar cinco es cómo una pantalla
    // rápida se vuelve lenta sin que nadie cambie su código.
    const { facade, repo } = crear({});

    await facade.initialize();

    expect(repo.ultimos).toHaveBeenCalledWith(5);
  });
});
