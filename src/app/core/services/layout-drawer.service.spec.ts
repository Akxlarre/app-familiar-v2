import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { LayoutDrawerService } from './layout-drawer.service';

@Component({ standalone: true, template: '' })
class StubPanel {}

describe('LayoutDrawerService', () => {
  let service: LayoutDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutDrawerService);
  });

  it('arranca cerrado y sin componente', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBeNull();
  });

  it('open() inyecta el componente y abre', () => {
    service.open(StubPanel, 'Detalle', 'user');
    expect(service.isOpen()).toBe(true);
    expect(service.component()).toBe(StubPanel);
    expect(service.title()).toBe('Detalle');
    expect(service.icon()).toBe('user');
  });

  it('close() cierra pero MANTIENE el componente montado', () => {
    // Es intencional: el componente se destruye recién en clear(), después de
    // la animación de salida. Limpiarlo acá produciría un salto visual.
    service.open(StubPanel, 'Detalle');
    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBe(StubPanel);
  });

  it('clear() destruye la vista', () => {
    service.open(StubPanel, 'Detalle');
    service.close();
    service.clear();
    expect(service.component()).toBeNull();
    expect(service.title()).toBe('');
  });

  it('setActions() actualiza acciones sin cerrar el drawer', () => {
    service.open(StubPanel, 'Detalle');
    service.setActions([{ label: 'Guardar', icon: 'save', callback: () => {} }]);
    expect(service.actions().length).toBe(1);
    expect(service.isOpen()).toBe(true);
  });

  it('actions() nunca es undefined', () => {
    expect(service.actions()).toEqual([]);
  });

  it('pasa inputs al componente renderizado', () => {
    // Sin esto el drawer solo servía para pantallas sin datos: no había forma de
    // decirle a un detalle CUÁL registro mostrar.
    service.open(StubPanel, 'Detalle', 'inbox', [], { id: 'abc' });
    expect(service.inputs()).toEqual({ id: 'abc' });
  });

  it('cada nivel de la navegación lleva sus propios inputs', () => {
    service.open(StubPanel, 'Lista', undefined, [], { id: 'lista' });
    service.open(StubPanel, 'Detalle', undefined, [], { id: 'detalle' });
    expect(service.inputs()).toEqual({ id: 'detalle' });

    service.back();
    expect(service.inputs()).toEqual({ id: 'lista' });
  });

  it('abrir de cero no arrastra los inputs de la sesión anterior', () => {
    service.open(StubPanel, 'Detalle', undefined, [], { id: 'abc' });
    service.close();
    service.clear();
    service.open(StubPanel, 'Otro');
    expect(service.inputs()).toBeUndefined();
  });
});
