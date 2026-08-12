import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DESTINO_REGISTRADO, NavegacionService } from './navegacion.service';
import type { Destino } from '@core/models/destino.model';

const HOY: Destino = { id: 'hoy', label: 'Hoy', icon: 'home', routerLink: '/app/hoy' };
const PLATA: Destino = { id: 'plata', label: 'Plata', icon: 'wallet', routerLink: '/app/plata' };
const AJUSTES: Destino = { id: 'ajustes', label: 'Ajustes', icon: 'settings', routerLink: '/app/ajustes' };

function crear(destinos: Destino[]): NavegacionService {
  TestBed.configureTestingModule({
    providers: destinos.map((d) => ({ provide: DESTINO_REGISTRADO, useValue: d, multi: true })),
  });
  return TestBed.inject(NavegacionService);
}

describe('NavegacionService', () => {
  it('con un solo destino registrado muestra uno', () => {
    // Es el estado real del proyecto hoy: sólo Hoy tiene contenido. Un menú de
    // cinco entradas con cuatro pantallas vacías es lo que AC4 prohíbe.
    expect(crear([HOY]).destinos()).toHaveLength(1);
  });

  it('respeta el orden canónico, no el de registro', () => {
    const service = crear([AJUSTES, HOY, PLATA]);

    expect(service.destinos().map((d) => d.id)).toEqual(['hoy', 'plata', 'ajustes']);
  });

  it('un destino que no está en el orden canónico no se muestra', () => {
    // Evita que alguien agregue un sexto destino de contrabando: los destinos
    // de primer nivel son una decisión de producto, no un detalle de registro.
    const service = crear([HOY, { id: 'inventado', label: 'X', icon: 'x', routerLink: '/app/x' }]);

    expect(service.destinos().map((d) => d.id)).toEqual(['hoy']);
  });

  it('sin destinos registrados devuelve lista vacía y no revienta', () => {
    expect(crear([]).destinos()).toEqual([]);
  });

  it('registrar dos veces el mismo destino no lo duplica', () => {
    const service = crear([HOY, { ...HOY, label: 'Hoy (otra vez)' }]);

    expect(service.destinos()).toHaveLength(1);
  });

  it('esActivo marca la sección, no sólo la ruta exacta', () => {
    // /app/plata/cuentas sigue siendo Plata: si sólo marcara la ruta exacta, el
    // menú se apagaría al entrar a una subsección.
    const service = crear([PLATA]);

    expect(service.esActivo(PLATA, '/app/plata')).toBe(true);
    expect(service.esActivo(PLATA, '/app/plata/cuentas')).toBe(true);
    expect(service.esActivo(PLATA, '/app/hoy')).toBe(false);
  });

  it('esActivo no confunde un prefijo de texto con una sección', () => {
    // /app/plataforma no es /app/plata.
    const service = crear([PLATA]);

    expect(service.esActivo(PLATA, '/app/plataforma')).toBe(false);
  });
});
