import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { HogaresRepository } from '@core/repositories/hogares.repository';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { EstadoDeOnboarding, Hogar } from '@core/models/hogar.model';
import { OnboardingFacade } from './onboarding.facade';

const HOGAR: Hogar = {
  id: 'h1', nombre: 'Casa', inviteCode: 'BCDFGH',
  zonaHoraria: 'America/Santiago', creadoEn: '2026-08-12T00:00:00Z',
};

const NADA: EstadoDeOnboarding = {
  tieneHogar: false, tieneCuenta: false, tieneCorreoConectado: false,
};

function montar(opciones: {
  estados?: EstadoDeOnboarding[];
  alCrear?: () => Promise<Hogar>;
  alUnirse?: () => Promise<Hogar>;
}) {
  const estados = [...(opciones.estados ?? [NADA])];
  const repo = {
    estadoDeOnboarding: vi.fn(async () => estados.length > 1 ? estados.shift()! : estados[0]),
    miHogar: vi.fn(async () => HOGAR),
    crear: vi.fn(opciones.alCrear ?? (async () => HOGAR)),
    unirse: vi.fn(opciones.alUnirse ?? (async () => HOGAR)),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: HogaresRepository, useValue: repo }],
  });
  return { facade: TestBed.inject(OnboardingFacade), repo };
}

describe('OnboardingFacade', () => {
  it('sin hogar arranca en el paso 1', async () => {
    const { facade } = montar({});
    await facade.initialize();

    expect(facade.paso()).toBe('hogar');
    expect(facade.numero()).toBe(1);
  });

  it('retomar es recalcular: el paso sale del estado real, no de algo guardado', async () => {
    // AC-E1. Quien cierra el navegador a mitad vuelve donde estaba porque no hay
    // progreso almacenado que pueda quedar desfasado.
    const { facade } = montar({
      estados: [{ tieneHogar: true, tieneCuenta: true, tieneCorreoConectado: false }],
    });
    await facade.initialize();

    expect(facade.paso()).toBe('correo');
    expect(facade.numero()).toBe(3);
  });

  it('tras crear el hogar se queda en el paso 1 para mostrar el código', async () => {
    // AC2. El paso derivado avanza en cuanto la base cambia, y el invite_code
    // —lo único que el usuario necesita sacar de esta pantalla— desaparecía sin
    // que llegara a verlo.
    const { facade } = montar({
      estados: [NADA, { tieneHogar: true, tieneCuenta: false, tieneCorreoConectado: false }],
    });
    await facade.initialize();

    expect(await facade.crearHogar('Casa')).toBe(true);
    expect(facade.hogar()?.inviteCode).toBe('BCDFGH');
    expect(facade.paso()).toBe('hogar');
    expect(facade.esperandoConfirmacion()).toBe(true);
  });

  it('avanzar suelta el paso retenido y sigue el derivado', async () => {
    const { facade } = montar({
      estados: [NADA, { tieneHogar: true, tieneCuenta: false, tieneCorreoConectado: false }],
    });
    await facade.initialize();
    await facade.crearHogar('Casa');

    facade.avanzar();

    expect(facade.paso()).toBe('banco');
    expect(facade.esperandoConfirmacion()).toBe(false);
  });

  it('una recarga no retiene nada: el paso vuelve a salir del estado real', async () => {
    // El retén vive en memoria a propósito. Quien recarga ya vio el código, y
    // guardarlo sería inventar el progreso persistido que esta spec evitó.
    const { facade } = montar({
      estados: [{ tieneHogar: true, tieneCuenta: false, tieneCorreoConectado: false }],
    });
    await facade.initialize();

    expect(facade.paso()).toBe('banco');
  });

  it('el paso siguiente sale de releer la base, no de asumir', async () => {
    // Si el facade diera por hecho el avance, una escritura que la base rechaza
    // dejaría la pantalla adelantada respecto de la realidad.
    const { facade, repo } = montar({
      estados: [NADA, { tieneHogar: true, tieneCuenta: false, tieneCorreoConectado: false }],
    });
    await facade.initialize();
    await facade.crearHogar('Casa');

    expect(repo.estadoDeOnboarding).toHaveBeenCalledTimes(2);
  });

  it('un código inválido explica sin revelar si el hogar existe', async () => {
    // AC4. El mensaje del RPC es un contrato UI↔BD y pasa como token; lo que no
    // puede pasar es el texto crudo de Postgres.
    const { facade } = montar({
      alUnirse: async () => { throw new ErrorDeBd('Código de invitación inválido', 'P0001'); },
    });
    await facade.initialize();

    expect(await facade.unirse('XXXXXX')).toBe(false);
    expect(facade.error()).toBe('Código de invitación inválido');
    expect(facade.error()).not.toContain('households');
  });

  it('un error crudo de la base no llega al usuario', async () => {
    const { facade } = montar({
      alUnirse: async () => {
        throw new ErrorDeBd('relation "households" violates row-level security policy', '42501');
      },
    });
    await facade.initialize();
    await facade.unirse('ABC123');

    expect(facade.error()).not.toContain('households');
    expect(facade.error()).not.toContain('row-level');
  });

  it('el código se normaliza antes de mandarlo', async () => {
    // Se dicta por teléfono: llega con espacios y en minúsculas.
    const { facade, repo } = montar({});
    await facade.initialize();
    await facade.unirse('  bcdfgh  ');

    expect(repo.unirse).toHaveBeenCalledWith('BCDFGH');
  });
});
