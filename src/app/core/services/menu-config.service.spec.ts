import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DESTINO_REGISTRADO } from './navegacion.service';
import { MenuConfigService } from './menu-config.service';
import { DESTINO_HOY } from '@core/models/destino.model';

describe('MenuConfigService', () => {
  let service: MenuConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESTINO_REGISTRADO, useValue: DESTINO_HOY, multi: true }],
    });
    service = TestBed.inject(MenuConfigService);
  });

  it('refleja los destinos registrados, no una lista propia', () => {
    // Dejó de tener items propios: una lista escrita a mano se desincroniza de
    // las rutas sin romperse, que es como /app/settings sobrevivió en el menú.
    expect(service.menuItems()).toEqual([DESTINO_HOY]);
  });

  it('cada item tiene label, icono y ruta', () => {
    for (const item of service.menuItems()) {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.routerLink).toBeTruthy();
    }
  });

  it('los iconos son nombres de Lucide, no clases de PrimeIcons', () => {
    for (const item of service.menuItems()) {
      expect(item.icon.startsWith('pi ')).toBe(false);
    }
  });

  it('toda ruta del menú es absoluta', () => {
    for (const item of service.menuItems()) {
      expect(item.routerLink.startsWith('/')).toBe(true);
    }
  });

  it('sin destinos registrados el menú queda vacío, y está bien', () => {
    // Un menú vacío es un estado válido, no un bug: es lo que garantiza que
    // nunca aparezca una entrada a una sección inexistente (AC4). El test
    // anterior exigía "array no vacío", que es justo lo que empuja a inventar
    // entradas para llenarlo.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(TestBed.inject(MenuConfigService).menuItems()).toEqual([]);
  });
});
