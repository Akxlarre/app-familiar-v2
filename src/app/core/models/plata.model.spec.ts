import { describe, expect, it } from 'vitest';

import type { Movimiento } from '@core/models/movimiento.model';
import { agruparPorDia, conPorcentaje, moverPeriodo, periodoDelMes } from './plata.model';

const mov = (fecha: string, monto: number, tipo: 'gasto' | 'ingreso' = 'gasto'): Movimiento => ({
  id: `${fecha}-${monto}`, monto, tipo, fecha, comercio: 'X', nota: null,
  capturaId: null, creadoEn: `${fecha}T00:00:00Z`,
});

describe('periodoDelMes', () => {
  it('va del día 1 al último del mes', () => {
    expect(periodoDelMes(new Date(2026, 1, 15))).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
  });

  it('acierta en febrero de año bisiesto', () => {
    // El día 0 del mes siguiente evita tener que saberse los bisiestos.
    expect(periodoDelMes(new Date(2028, 1, 10)).hasta).toBe('2028-02-29');
  });

  it('acierta en un mes de 31', () => {
    expect(periodoDelMes(new Date(2026, 0, 5)).hasta).toBe('2026-01-31');
  });
});

describe('moverPeriodo', () => {
  it('retrocede un mes', () => {
    expect(moverPeriodo('2026-08-01', -1)).toEqual({ desde: '2026-07-01', hasta: '2026-07-31' });
  });

  it('cruza el cambio de año hacia atrás', () => {
    expect(moverPeriodo('2026-01-01', -1)).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
  });

  it('cruza el cambio de año hacia adelante', () => {
    expect(moverPeriodo('2026-12-01', 1)).toEqual({ desde: '2027-01-01', hasta: '2027-01-31' });
  });
});

describe('agruparPorDia', () => {
  it('junta los del mismo día', () => {
    const dias = agruparPorDia([mov('2026-08-12', 100), mov('2026-08-12', 200), mov('2026-08-11', 50)]);

    expect(dias).toHaveLength(2);
    expect(dias[0].movimientos).toHaveLength(2);
  });

  it('suma sólo los gastos del día', () => {
    // Un ingreso no resta del total gastado: son dos cosas distintas y
    // mezclarlas haría que un sueldo dejara el día en negativo.
    const [dia] = agruparPorDia([mov('2026-08-12', 100), mov('2026-08-12', 900, 'ingreso')]);

    expect(dia.totalGastado).toBe(100);
  });

  it('no reordena: respeta el orden que trajo la consulta', () => {
    // Reordenar en el cliente sólo ordenaría la página cargada, no el conjunto.
    const dias = agruparPorDia([mov('2026-08-10', 1), mov('2026-08-12', 2)]);

    expect(dias.map((d) => d.fecha)).toEqual(['2026-08-10', '2026-08-12']);
  });

  it('una lista vacía da cero días', () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});

describe('conPorcentaje', () => {
  it('reparte sobre el total', () => {
    const filas = conPorcentaje([
      { categoriaId: '1', categoria: 'Supermercado', total: 750, movimientos: 3 },
      { categoriaId: '2', categoria: 'Transporte', total: 250, movimientos: 1 },
    ]);

    expect(filas[0].porcentaje).toBe(75);
    expect(filas[1].porcentaje).toBe(25);
  });

  it('sin gastos no divide por cero', () => {
    const filas = conPorcentaje([{ categoriaId: null, categoria: 'X', total: 0, movimientos: 0 }]);

    expect(filas[0].porcentaje).toBe(0);
  });
});
