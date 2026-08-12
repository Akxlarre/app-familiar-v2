import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { HogaresRepository } from '@core/repositories/hogares.repository';
import type { EstadoDeOnboarding } from '@core/models/hogar.model';
import { hogarGuard, onboardingGuard } from './hogar.guard';

const COMPLETO: EstadoDeOnboarding = {
  tieneHogar: true,
  tieneCuenta: true,
  tieneCorreoConectado: true,
};

function montar(estado: EstadoDeOnboarding | Error) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: HogaresRepository,
        useValue: {
          estadoDeOnboarding: vi.fn(async () => {
            if (estado instanceof Error) throw estado;
            return estado;
          }),
        },
      },
    ],
  });
}

const correr = (guard: typeof hogarGuard) =>
  TestBed.runInInjectionContext(() => guard(null as never, null as never)) as Promise<boolean | UrlTree>;

const destino = (r: boolean | UrlTree) =>
  typeof r === 'boolean' ? null : TestBed.inject(Router).serializeUrl(r);

describe('hogarGuard', () => {
  it('con el onboarding terminado deja pasar', async () => {
    montar(COMPLETO);
    expect(await correr(hogarGuard)).toBe(true);
  });

  it('sin hogar manda al onboarding', async () => {
    montar({ tieneHogar: false, tieneCuenta: false, tieneCorreoConectado: false });
    expect(destino(await correr(hogarGuard))).toBe('/onboarding');
  });

  it('con hogar pero sin cuenta también manda al onboarding', async () => {
    // A medio configurar la app no tiene nada que mostrar: llevarlo a Hoy sería
    // enseñarle una pantalla vacía y dejarlo ahí.
    montar({ tieneHogar: true, tieneCuenta: false, tieneCorreoConectado: false });
    expect(destino(await correr(hogarGuard))).toBe('/onboarding');
  });

  it('si la consulta falla, deja pasar', async () => {
    // Falla hacia adelante: un guard que bloquea cuando la red se cae encierra
    // al usuario sin salida, y lo de atrás ya lo protege RLS.
    montar(new Error('la base no responde'));
    expect(await correr(hogarGuard)).toBe(true);
  });
});

describe('onboardingGuard', () => {
  it('sin terminar, deja ver el onboarding', async () => {
    montar({ tieneHogar: true, tieneCuenta: false, tieneCorreoConectado: false });
    expect(await correr(onboardingGuard)).toBe(true);
  });

  it('ya configurado, lo saca a Hoy', async () => {
    // AC-E2. Sin esto se puede volver por URL y crear un segundo hogar.
    montar(COMPLETO);
    expect(destino(await correr(onboardingGuard))).toBe('/app/hoy');
  });

  it('si la consulta falla, deja pasar', async () => {
    montar(new Error('la base no responde'));
    expect(await correr(onboardingGuard)).toBe(true);
  });
});
