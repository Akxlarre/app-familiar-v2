import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { FUENTE_DE_PENDIENTES, type FuenteDePendientes, type Pendiente } from '@core/models/pendiente.model';
import { PendientesService } from './pendientes.service';

function fuente(id: string, pendientes: Pendiente[]): FuenteDePendientes {
  return { id, cargar: async () => pendientes };
}

function fuenteQueRevienta(id: string): FuenteDePendientes {
  return {
    id,
    cargar: async () => {
      throw new Error('la base no responde');
    },
  };
}

const CAPTURA: Pendiente = {
  tipo: 'captura',
  titulo: 'Movimientos por confirmar',
  cantidad: 3,
  ruta: '/app/bandeja',
  prioridad: 1,
};

const DESPENSA: Pendiente = {
  tipo: 'despensa',
  titulo: '¿Se acabó el atún?',
  cantidad: 1,
  ruta: '/app/casa',
  prioridad: 2,
};

function crear(fuentes: FuenteDePendientes[]): PendientesService {
  TestBed.configureTestingModule({
    providers: fuentes.map((f) => ({ provide: FUENTE_DE_PENDIENTES, useValue: f, multi: true })),
  });
  return TestBed.inject(PendientesService);
}

describe('PendientesService', () => {
  it('agrega los pendientes de todas las fuentes registradas', async () => {
    const service = crear([fuente('bandeja', [CAPTURA]), fuente('despensa', [DESPENSA])]);

    await service.cargar();

    expect(service.pendientes().map((p) => p.tipo)).toEqual(['captura', 'despensa']);
  });

  it('ordena por prioridad, no por orden de registro', async () => {
    const service = crear([fuente('despensa', [DESPENSA]), fuente('bandeja', [CAPTURA])]);

    await service.cargar();

    expect(service.pendientes().map((p) => p.tipo)).toEqual(['captura', 'despensa']);
  });

  it('total suma las cantidades, no los pendientes', async () => {
    // 3 capturas + 1 pregunta = 4 cosas que hacer, en 2 bloques.
    const service = crear([fuente('bandeja', [CAPTURA]), fuente('despensa', [DESPENSA])]);

    await service.cargar();

    expect(service.total()).toBe(4);
  });

  it('una fuente que falla no se lleva a las demás', async () => {
    // Es un AC explícito de la spec 0003: que la despensa no responda no puede
    // dejar sin ver los movimientos.
    const service = crear([
      fuente('bandeja', [CAPTURA]),
      fuenteQueRevienta('despensa'),
      fuente('cuotas', [{ ...DESPENSA, tipo: 'cuota', prioridad: 3 }]),
    ]);

    await service.cargar();

    expect(service.pendientes().map((p) => p.tipo)).toEqual(['captura', 'cuota']);
    expect(service.fuentesCaidas()).toEqual(['despensa']);
  });

  it('no filtra el error crudo de la fuente que falló', async () => {
    // Lo que se expone es QUÉ fuente cayó, no su mensaje: un error de Supabase
    // trae nombres de tabla y detalles de la query.
    const service = crear([fuenteQueRevienta('despensa')]);

    await service.cargar();

    expect(JSON.stringify(service.fuentesCaidas())).not.toContain('la base no responde');
  });

  it('sin fuentes registradas devuelve lista vacía y no revienta', async () => {
    const service = crear([]);

    await service.cargar();

    expect(service.pendientes()).toEqual([]);
    expect(service.total()).toBe(0);
  });

  it('sinNadaPendiente sólo es cierto después de cargar', async () => {
    // Antes de cargar no se sabe: decir "no hay nada que hacer" sin haber
    // preguntado es peor que no decir nada.
    const service = crear([fuente('bandeja', [])]);

    expect(service.sinNadaPendiente()).toBe(false);

    await service.cargar();

    expect(service.sinNadaPendiente()).toBe(true);
  });

  it('una fuente sin pendientes no aporta bloques vacíos', async () => {
    const service = crear([fuente('bandeja', []), fuente('despensa', [DESPENSA])]);

    await service.cargar();

    expect(service.pendientes()).toHaveLength(1);
  });

  it('recargar reemplaza, no acumula', async () => {
    const service = crear([fuente('bandeja', [CAPTURA])]);

    await service.cargar();
    await service.cargar();

    expect(service.pendientes()).toHaveLength(1);
  });
});
