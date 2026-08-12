import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { BandejaFacade } from '@core/facades/bandeja.facade';
import { BandejaPendientes } from './bandeja.pendientes';

function crear(opciones: { total: number; necesitanDatos?: number; error?: string | null }) {
  const facade = {
    initialize: vi.fn().mockResolvedValue(undefined),
    total: signal(opciones.total),
    necesitanDatos: signal(opciones.necesitanDatos ?? 0),
    error: signal(opciones.error ?? null),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: BandejaFacade, useValue: facade }],
  });
  return { fuente: TestBed.inject(BandejaPendientes), facade };
}

describe('BandejaPendientes', () => {
  it('sin capturas no aporta ningún pendiente', async () => {
    const { fuente } = crear({ total: 0 });

    expect(await fuente.cargar()).toEqual([]);
  });

  it('reporta el número exacto, no un "tienes pendientes"', async () => {
    const { fuente } = crear({ total: 3 });
    const [pendiente] = await fuente.cargar();

    expect(pendiente.cantidad).toBe(3);
    expect(pendiente.titulo).toContain('3');
    expect(pendiente.ruta).toBe('/app/bandeja');
  });

  it('singulariza el título cuando hay una sola', async () => {
    const { fuente } = crear({ total: 1 });
    const [pendiente] = await fuente.cargar();

    expect(pendiente.titulo).toBe('Un movimiento por confirmar');
  });

  it('distingue las que exigen escribir el monto', async () => {
    // "12 pendientes" no pesa lo mismo si son doce confirmaciones de un toque
    // o doce formularios.
    const { fuente } = crear({ total: 12, necesitanDatos: 5 });
    const [pendiente] = await fuente.cargar();

    expect(pendiente.detalle).toContain('5');
  });

  it('sin capturas que exijan monto, no inventa un detalle', async () => {
    const { fuente } = crear({ total: 4, necesitanDatos: 0 });
    const [pendiente] = await fuente.cargar();

    expect(pendiente.detalle).toBeUndefined();
  });

  it('si la bandeja falló, la fuente RECHAZA en vez de decir cero', async () => {
    // `initialize()` no lanza: guarda el error y devuelve normal. Sin relanzar,
    // una bandeja caída se leería como cero pendientes y Hoy diría "no hay nada
    // que hacer" con el usuario teniendo trabajo sin ver.
    const { fuente } = crear({ total: 0, error: 'No se pudieron cargar las capturas' });

    await expect(fuente.cargar()).rejects.toThrow();
  });
});
