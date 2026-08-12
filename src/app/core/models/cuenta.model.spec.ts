import { describe, expect, it } from 'vitest';

import { periodoDeFacturacion, resumenDeCupo } from './cuenta.model';

describe('periodoDeFacturacion', () => {
  it('antes del corte, el período cierra este mes', () => {
    // Corte el 15; hoy es 10 de marzo → cierra el 15 de marzo.
    const p = periodoDeFacturacion(15, new Date(2026, 2, 10));

    expect(p.desde).toBe('2026-02-16');
    expect(p.hasta).toBe('2026-03-15');
    expect(p.diasParaCierre).toBe(5);
  });

  it('pasado el corte, el período cierra el mes siguiente', () => {
    const p = periodoDeFacturacion(15, new Date(2026, 2, 20));

    expect(p.desde).toBe('2026-03-16');
    expect(p.hasta).toBe('2026-04-15');
  });

  it('el día del corte todavía pertenece al período que cierra', () => {
    // El corte cierra el período, no lo abre.
    const p = periodoDeFacturacion(15, new Date(2026, 2, 15));

    expect(p.hasta).toBe('2026-03-15');
    expect(p.diasParaCierre).toBe(0);
  });

  it('día 31 en un mes de 30 usa el último día real', () => {
    // AC-E2. `new Date(2026, 3, 31)` no lanza: desborda a mayo. Una versión
    // ingenua no falla, miente.
    const p = periodoDeFacturacion(31, new Date(2026, 3, 10));

    expect(p.hasta).toBe('2026-04-30');
  });

  it('día 31 en febrero usa el 28', () => {
    const p = periodoDeFacturacion(31, new Date(2026, 1, 10));

    expect(p.hasta).toBe('2026-02-28');
  });

  it('día 31 en febrero bisiesto usa el 29', () => {
    const p = periodoDeFacturacion(31, new Date(2028, 1, 10));

    expect(p.hasta).toBe('2028-02-29');
  });

  it('cruza el cambio de año hacia atrás', () => {
    const p = periodoDeFacturacion(5, new Date(2026, 0, 3));

    expect(p.desde).toBe('2025-12-06');
    expect(p.hasta).toBe('2026-01-05');
  });

  it('cruza el cambio de año hacia adelante', () => {
    const p = periodoDeFacturacion(5, new Date(2026, 11, 20));

    expect(p.desde).toBe('2026-12-06');
    expect(p.hasta).toBe('2027-01-05');
  });

  it('el período siempre empieza el día siguiente al corte anterior', () => {
    // Sin el +1, el corte anterior quedaría contado en dos períodos.
    const p = periodoDeFacturacion(28, new Date(2026, 5, 10));

    expect(p.desde).toBe('2026-05-29');
    expect(p.hasta).toBe('2026-06-28');
  });
});

describe('resumenDeCupo', () => {
  it('reparte el cupo', () => {
    const r = resumenDeCupo(1_000_000, 250_000);

    expect(r).toMatchObject({ disponible: 750_000, porcentaje: 25, superado: false });
  });

  it('sin cupo declarado devuelve null en vez de dividir por cero', () => {
    // AC-E3. Una tarjeta sin cupo cargado es normal: el banco no lo manda.
    expect(resumenDeCupo(null, 5000)).toBeNull();
    expect(resumenDeCupo(0, 5000)).toBeNull();
  });

  it('el disponible no baja de cero', () => {
    // "Te quedan −40.000" no es información: que se superó lo dice `superado`.
    const r = resumenDeCupo(100_000, 140_000);

    expect(r?.disponible).toBe(0);
    expect(r?.superado).toBe(true);
    expect(r?.porcentaje).toBe(140);
  });

  it('cupo justo al límite no cuenta como superado', () => {
    expect(resumenDeCupo(100_000, 100_000)?.superado).toBe(false);
  });
});
