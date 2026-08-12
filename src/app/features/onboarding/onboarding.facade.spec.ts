import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { HogaresRepository } from '@core/repositories/hogares.repository';
import { IntegracionesRepository } from '@core/repositories/integraciones.repository';
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
  alConectar?: () => Promise<string>;
}) {
  const estados = [...(opciones.estados ?? [NADA])];
  const repo = {
    estadoDeOnboarding: vi.fn(async () => estados.length > 1 ? estados.shift()! : estados[0]),
    miHogar: vi.fn(async () => HOGAR),
    crear: vi.fn(opciones.alCrear ?? (async () => HOGAR)),
    unirse: vi.fn(opciones.alUnirse ?? (async () => HOGAR)),
  };
  const integraciones = {
    conectarGmail: vi.fn(opciones.alConectar ?? (async () => 'yo@gmail.com')),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: HogaresRepository, useValue: repo },
      { provide: IntegracionesRepository, useValue: integraciones },
    ],
  });
  return { facade: TestBed.inject(OnboardingFacade), repo, integraciones };
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

  describe('conectar el correo', () => {
    const CON_CUENTA: EstadoDeOnboarding = {
      tieneHogar: true, tieneCuenta: true, tieneCorreoConectado: false,
    };
    const CONECTADO: EstadoDeOnboarding = { ...CON_CUENTA, tieneCorreoConectado: true };

    it('el redirect_uri viaja al canje: Google lo exige idéntico al del consentimiento', async () => {
      const { facade, integraciones } = montar({ estados: [CON_CUENTA, CONECTADO] });
      await facade.initialize();

      expect(await facade.conectarCorreo('4/abc', 'http://localhost:4200/onboarding')).toBeNull();
      expect(integraciones.conectarGmail).toHaveBeenCalledWith('4/abc', 'http://localhost:4200/onboarding');
    });

    it('conectado, el paso avanza porque la base lo dice', async () => {
      const { facade } = montar({ estados: [CON_CUENTA, CONECTADO] });
      await facade.initialize();
      expect(facade.paso()).toBe('correo');

      await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      expect(facade.paso()).toBe('listo');
    });

    it('el fallo se devuelve en vez de tomar la pantalla entera', async () => {
      // `_error` lo pinta el contenedor como error-state con botón de recargar, y
      // recargar acá no sirve: el código de Google se usa una sola vez. Lo que el
      // usuario necesita es el botón de volver a pedir el consentimiento.
      const { facade } = montar({
        estados: [CON_CUENTA],
        alConectar: async () => { throw new ErrorDeBd('Edge Function returned a non-2xx status code'); },
      });
      await facade.initialize();

      expect(await facade.conectarCorreo('4/abc', 'http://x/onboarding')).not.toBeNull();
      expect(facade.error()).toBeNull();
      expect(facade.paso()).toBe('correo');
    });

    it('sin refresh_token se dice qué hacer, no "error inesperado"', async () => {
      // Es el fallo recuperable más probable —pasa cuando el usuario ya había
      // autorizado antes— y el mensaje del servidor habla de prompt=consent, que
      // no le dice nada a nadie.
      const { facade } = montar({
        estados: [CON_CUENTA],
        alConectar: async () => {
          throw new ErrorDeBd(
            'Google no entregó refresh_token. Reintentá el consentimiento con prompt=consent&access_type=offline.',
          );
        },
      });
      await facade.initialize();

      const mensaje = await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      expect(mensaje).toContain('Volvé a intentarlo');
      expect(mensaje).not.toContain('prompt=consent');
    });

    it('la falta de configuración del servidor no se disfraza de error del usuario', async () => {
      const { facade } = montar({
        estados: [CON_CUENTA],
        alConectar: async () => {
          throw new ErrorDeBd('Gmail sin configurar: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET');
        },
      });
      await facade.initialize();

      const mensaje = await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      expect(mensaje).toContain('No es algo que puedas resolver');
      expect(mensaje).not.toContain('GOOGLE_CLIENT_SECRET');
    });
  });
});
