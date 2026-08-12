import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseService } from '@core/services/supabase.service';
import { BancosRepository } from './bancos.repository';

const PLANTILLAS = [
  { id: 'p1', banco: 'BancoEstado', tipo: 'cargo', remitente_patron: 'bancoestado.cl',
    asunto_patron: 'Compra', regex_monto: '\\$([\\d.]+)', regex_comercio: null,
    regex_fecha: null, regex_cuota: null, regex_tarjeta: null },
  { id: 'p2', banco: 'BancoEstado', tipo: 'cuota', remitente_patron: 'bancoestado.cl',
    asunto_patron: 'cuotas', regex_monto: '\\$([\\d.]+)', regex_comercio: null,
    regex_fecha: null, regex_cuota: '(\\d+) de (\\d+)', regex_tarjeta: null },
];

/** Doble del cliente que registra qué se insertó en cada tabla. */
function clienteFalso(opciones: { plantillas?: unknown[]; catalogo?: unknown[] } = {}) {
  const insertado: Record<string, unknown[]> = {};

  const from = vi.fn((tabla: string) => {
    if (tabla === 'cuentas') {
      return {
        insert: (fila: unknown) => {
          insertado['cuentas'] = [fila];
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'c1', nombre: 'Mi tarjeta', tipo: 'credito', banco: 'BancoEstado', last4: '4321', activa: true },
                error: null,
              }),
            }),
          };
        },
        select: () => ({ order: async () => ({ data: [], error: null }) }),
      };
    }
    if (tabla === 'plantillas_parser') {
      const resultado = { data: opciones.plantillas ?? PLANTILLAS, error: null };
      const conFiltros = {
        eq: () => conFiltros,
        order: async () => ({ data: opciones.catalogo ?? [], error: null }),
        then: (r: (v: unknown) => unknown) => Promise.resolve(resultado).then(r),
      };
      return { select: () => conFiltros };
    }
    if (tabla === 'parsers_email') {
      return {
        insert: async (filas: unknown[]) => {
          insertado['parsers_email'] = filas;
          return { error: null };
        },
      };
    }
    throw new Error(`tabla inesperada: ${tabla}`);
  });

  return { cliente: { db: { from } }, insertado };
}

function montar(opciones: Parameters<typeof clienteFalso>[0] = {}) {
  const { cliente, insertado } = clienteFalso(opciones);
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: cliente }],
  });
  return { repo: TestBed.inject(BancosRepository), insertado };
}

describe('BancosRepository', () => {
  it('agrupa el catálogo por banco contando sus plantillas', async () => {
    const { repo } = montar({
      catalogo: [{ banco: 'BancoEstado' }, { banco: 'BancoEstado' }, { banco: 'BCI' }],
    });

    expect(await repo.catalogo()).toEqual([
      { banco: 'BancoEstado', plantillas: 2 },
      { banco: 'BCI', plantillas: 1 },
    ]);
  });

  it('al crear la cuenta copia las plantillas de su banco', async () => {
    // AC14: elegir el banco configura los patrones sin que el usuario escriba
    // un solo regex.
    const { repo, insertado } = montar();

    await repo.crearCuentaConParsers('h1', {
      nombre: 'Mi tarjeta', tipo: 'credito', banco: 'BancoEstado', last4: '4321',
    });

    expect(insertado['parsers_email']).toHaveLength(2);
  });

  it('los parsers copiados apuntan a la cuenta recién creada', async () => {
    // Sin `cuenta_id`, las capturas llegan y quedan atascadas con "el parser no
    // tiene cuenta asociada" — que es el problema que AC13 describe.
    const { repo, insertado } = montar();

    await repo.crearCuentaConParsers('h1', {
      nombre: 'Mi tarjeta', tipo: 'credito', banco: 'BancoEstado', last4: null,
    });

    for (const fila of insertado['parsers_email'] as Array<Record<string, unknown>>) {
      expect(fila['cuenta_id']).toBe('c1');
      expect(fila['household_id']).toBe('h1');
    }
  });

  it('copia los regex tal cual, sin reinterpretarlos', async () => {
    // Un regex que se reescribe en el camino deja de coincidir con el que se
    // probó, y el fallo aparece recién cuando llega un correo real.
    const { repo, insertado } = montar();

    await repo.crearCuentaConParsers('h1', {
      nombre: 'x', tipo: 'credito', banco: 'BancoEstado', last4: null,
    });

    const copiadas = insertado['parsers_email'] as Array<Record<string, unknown>>;
    expect(copiadas[1]['regex_cuota']).toBe('(\\d+) de (\\d+)');
  });

  it('un banco sin plantillas crea la cuenta igual', async () => {
    // Que el catálogo no cubra un banco no puede impedir registrar la cuenta:
    // el usuario seguirá pudiendo cargar movimientos a mano.
    const { repo, insertado } = montar({ plantillas: [] });

    const cuenta = await repo.crearCuentaConParsers('h1', {
      nombre: 'Efectivo', tipo: 'efectivo', banco: 'Otro', last4: null,
    });

    expect(cuenta.id).toBe('c1');
    expect(insertado['parsers_email']).toBeUndefined();
  });
});
