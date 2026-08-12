import { describe, expect, it } from 'vitest';

import { periodoDelMes } from '@core/models/plata.model';
import { aQueryParams, desdeQueryParams, mismoFiltro } from './filtros-url.utils';

const base = { ...periodoDelMes(), cuentaId: null, categoriaId: null, tipo: null, texto: '' };

describe('aQueryParams', () => {
  it('el mes en curso no ensucia la URL', () => {
    // Es el default: escribirlo haría que abrir la pantalla dejara una URL con
    // parámetros que nadie eligió.
    const p = aQueryParams(base);

    expect(p['desde']).toBeNull();
    expect(p['hasta']).toBeNull();
  });

  it('un período distinto sí se escribe', () => {
    const p = aQueryParams({ ...base, desde: '2026-01-01', hasta: '2026-01-31' });

    expect(p['desde']).toBe('2026-01-01');
  });

  it('el texto vacío se quita del todo', () => {
    // `null` y no `''`: Angular elimina el parámetro en vez de dejar `?q=`.
    expect(aQueryParams({ ...base, texto: '   ' })['q']).toBeNull();
  });

  it('los filtros puestos se escriben', () => {
    const p = aQueryParams({ ...base, cuentaId: 'c1', categoriaId: 'g1', tipo: 'gasto', texto: 'jumbo' });

    expect(p).toMatchObject({ cuenta: 'c1', categoria: 'g1', tipo: 'gasto', q: 'jumbo' });
  });
});

describe('desdeQueryParams', () => {
  it('sin parámetros da el mes en curso', () => {
    expect(desdeQueryParams({})).toEqual(base);
  });

  it('reconstruye lo que se escribió', () => {
    const f = desdeQueryParams({ cuenta: 'c1', categoria: 'g1', tipo: 'ingreso', q: 'jumbo' });

    expect(f).toMatchObject({ cuentaId: 'c1', categoriaId: 'g1', tipo: 'ingreso', texto: 'jumbo' });
  });

  it('una fecha con formato inválido cae al default en vez de romper', () => {
    // Una URL escrita a mano tiene que dejar la pantalla usable.
    expect(desdeQueryParams({ desde: 'ayer' }).desde).toBe(base.desde);
  });

  it('un tipo inventado se descarta', () => {
    expect(desdeQueryParams({ tipo: 'cualquiera' }).tipo).toBeNull();
  });

  it('ida y vuelta conserva el filtro', () => {
    const original = { ...base, desde: '2026-01-01', hasta: '2026-01-31', tipo: 'gasto' as const, texto: 'x' };
    const params = aQueryParams(original);
    const limpios = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== null),
    ) as Record<string, string>;

    expect(desdeQueryParams(limpios)).toEqual(original);
  });
});

describe('mismoFiltro', () => {
  it('ignora los espacios del texto', () => {
    expect(mismoFiltro(base, { ...base, texto: '  ' })).toBe(true);
  });

  it('distingue un cambio real', () => {
    expect(mismoFiltro(base, { ...base, tipo: 'gasto' })).toBe(false);
  });
});
