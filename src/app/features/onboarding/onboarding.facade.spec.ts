import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { BancosRepository } from '@core/repositories/bancos.repository';
import { HogaresRepository } from '@core/repositories/hogares.repository';
import { IntegracionesRepository } from '@core/repositories/integraciones.repository';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { EstadoDeOnboarding, Hogar } from '@core/models/hogar.model';
import { CapturasRepository } from '@core/repositories/capturas.repository';
import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import type { IntegracionEmail, ResultadoDeCorrida } from '@core/models/integracion.model';
import type { Movimiento } from '@core/models/movimiento.model';
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
  alCambiarCarpeta?: (id: string, carpeta: string) => Promise<void>;
  alCorrer?: () => Promise<ResultadoDeCorrida>;
}) {
  const estados = [...(opciones.estados ?? [NADA])];
  const repo = {
    estadoDeOnboarding: vi.fn(async () => estados.length > 1 ? estados.shift()! : estados[0]),
    miHogar: vi.fn(async () => HOGAR),
    crear: vi.fn(opciones.alCrear ?? (async () => HOGAR)),
    unirse: vi.fn(opciones.alUnirse ?? (async () => HOGAR)),
  };
  let integracion: IntegracionEmail | null = {
    id: 'i1', email: 'yo@gmail.com', carpeta: 'INBOX', estado: 'activa',
    conectada: true, ultimaSync: null, ultimoError: null,
  };
  const bancosRepo = {
    catalogo: vi.fn(async () => []),
    bancosConfigurados: vi.fn(async () => ['BancoEstado']),
    crearCuentaConParsers: vi.fn(async () => undefined),
  };
  const integraciones = {
    conectarGmail: vi.fn(opciones.alConectar ?? (async () => 'yo@gmail.com')),
    mia: vi.fn(async () => integracion),
    cambiarCarpeta: vi.fn(
      opciones.alCambiarCarpeta ??
        (async (_id: string, carpeta: string) => {
          integracion = integracion ? { ...integracion, carpeta } : null;
        }),
    ),
    desconectar: vi.fn(async () => { integracion = null; }),
    primeraCorrida: vi.fn(
      opciones.alCorrer ??
        (async () => ({ capturadas: 3, movimientos: 2, motivo: null, diasBuscados: 180 })),
    ),
  };
  const movimientos = {
    ultimos: vi.fn(async () => [
      { id: 'm1', comercio: 'JUMBO MAIPU', monto: 18700, tipo: 'gasto', fecha: '2026-08-10' },
    ] as unknown as Movimiento[]),
  };
  const capturas = { pendientes: vi.fn(async () => [{ id: 'c1' }]) };
  TestBed.configureTestingModule({
    providers: [
      { provide: HogaresRepository, useValue: repo },
      { provide: BancosRepository, useValue: bancosRepo },
      { provide: IntegracionesRepository, useValue: integraciones },
      { provide: MovimientosRepository, useValue: movimientos },
      { provide: CapturasRepository, useValue: capturas },
    ],
  });
  return { facade: TestBed.inject(OnboardingFacade), repo, integraciones, movimientos, capturas, bancosRepo };
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

    it('tras conectar se queda en el paso 3 para mostrar la casilla', async () => {
      // Mismo motivo que el invite_code en AC2: el paso derivado salta a 'listo'
      // apenas la base dice que hay correo, y la casilla conectada —más la
      // etiqueta que AC8 pide poder elegir— desaparecían sin verse.
      const { facade } = montar({ estados: [CON_CUENTA, CONECTADO] });
      await facade.initialize();
      expect(facade.paso()).toBe('correo');

      await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      expect(facade.paso()).toBe('correo');
      expect(facade.integracion()?.email).toBe('yo@gmail.com');
      expect(facade.esperandoConfirmacion()).toBe(true);
    });

    it('recién al continuar se pasa al paso 4', async () => {
      const { facade } = montar({ estados: [CON_CUENTA, CONECTADO] });
      await facade.initialize();
      await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      facade.avanzar();

      expect(facade.paso()).toBe('listo');
    });

    it('si el canje falla no se retiene nada: la pantalla vuelve a ofrecer conectar', async () => {
      // Con el paso retenido y sin integración, el usuario quedaría mirando una
      // confirmación vacía en vez del botón que necesita.
      const { facade } = montar({
        estados: [CON_CUENTA],
        alConectar: async () => { throw new ErrorDeBd('invalid_grant'); },
      });
      await facade.initialize();

      await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      expect(facade.paso()).toBe('correo');
      expect(facade.esperandoConfirmacion()).toBe(false);
      expect(facade.integracion()).toBeNull();
    });

    it('cambiar la carpeta relee lo que quedó, no lo que se pidió', async () => {
      // AC8. Si el UPDATE lo rechaza el GRANT por columna o RLS, la pantalla
      // tiene que mostrar la carpeta real y no la elegida.
      const { facade, integraciones } = montar({ estados: [CON_CUENTA, CONECTADO] });
      await facade.initialize();
      await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      expect(await facade.cambiarCarpeta('CATEGORY_UPDATES')).toBeNull();

      expect(integraciones.cambiarCarpeta).toHaveBeenCalledWith('i1', 'CATEGORY_UPDATES');
      expect(facade.integracion()?.carpeta).toBe('CATEGORY_UPDATES');
    });

    it('un UPDATE rechazado no deja la pantalla mintiendo', async () => {
      const { facade } = montar({
        estados: [CON_CUENTA, CONECTADO],
        alCambiarCarpeta: async () => {
          throw new ErrorDeBd('permission denied for table integraciones_email', '42501');
        },
      });
      await facade.initialize();
      await facade.conectarCorreo('4/abc', 'http://x/onboarding');

      const mensaje = await facade.cambiarCarpeta('CATEGORY_UPDATES');

      expect(mensaje).not.toBeNull();
      expect(mensaje).not.toContain('integraciones_email');
      expect(facade.integracion()?.carpeta).toBe('INBOX');
    });

    it('la corrida corre una sola vez aunque el componente se monte de nuevo', async () => {
      // AC10. Se dispara sola al llegar al paso 4, y `@switch` puede volver a
      // crear el componente: si cada montaje disparara una corrida, conectar el
      // correo terminaría gastando la cuota de Gmail sin que nadie lo pida.
      const { facade, integraciones } = montar({ estados: [CONECTADO] });
      await facade.initialize();

      await facade.correrPrimeraVez();
      await facade.correrPrimeraVez();

      expect(integraciones.primeraCorrida).toHaveBeenCalledTimes(1);
    });

    it('reintentar sí vuelve a correr', async () => {
      const { facade, integraciones } = montar({ estados: [CONECTADO] });
      await facade.initialize();
      await facade.correrPrimeraVez();

      await facade.reintentarCorrida();

      expect(integraciones.primeraCorrida).toHaveBeenCalledTimes(2);
    });

    it('vacío después de mirar no es lo mismo que todavía no haber mirado', async () => {
      // AC12. Si los dos casos dieran el mismo `corridaVacia`, la pantalla
      // mostraría "no encontramos nada" antes de haber buscado.
      const { facade } = montar({
        estados: [CONECTADO],
        alCorrer: async () => ({ capturadas: 0, movimientos: 0, motivo: null, diasBuscados: 180 }),
      });
      await facade.initialize();

      expect(facade.corridaVacia()).toBe(false);

      await facade.correrPrimeraVez();

      expect(facade.corridaVacia()).toBe(true);
      expect(facade.corrida()?.diasBuscados).toBe(180);
    });

    it('una corrida con hallazgos trae nombre y monto, no sólo el conteo', async () => {
      // AC11. El número lo devuelve la función; lo que la pantalla muestra sale
      // de la base, que es donde están el comercio y el monto.
      const { facade } = montar({ estados: [CONECTADO] });
      await facade.initialize();

      await facade.correrPrimeraVez();

      expect(facade.corridaVacia()).toBe(false);
      expect(facade.encontrados().length).toBeGreaterThan(0);
      expect(facade.encontrados()[0].comercio).toBe('JUMBO MAIPU');
    });

    it('el vacío nombra los bancos del HOGAR, no los del catálogo', async () => {
      // AC12. El catálogo dice qué bancos la app sabría interpretar; decir que se
      // buscaron correos de nueve cuando sólo hay parsers de uno promete una
      // búsqueda que no ocurrió — y tapa justo el caso en que el usuario necesita
      // enterarse de que su banco no está configurado.
      const { facade, bancosRepo } = montar({
        estados: [CONECTADO],
        alCorrer: async () => ({ capturadas: 0, movimientos: 0, motivo: null, diasBuscados: 180 }),
      });
      await facade.initialize();

      await facade.correrPrimeraVez();

      expect(bancosRepo.bancosConfigurados).toHaveBeenCalled();
      expect(facade.bancosConfigurados()).toEqual(['BancoEstado']);
      expect(bancosRepo.catalogo).not.toHaveBeenCalled();
    });

    it('si la corrida falla, el correo sigue conectado y se puede reintentar', async () => {
      const { facade } = montar({
        estados: [CONECTADO],
        alCorrer: async () => { throw new ErrorDeBd('Edge Function returned a non-2xx status code'); },
      });
      await facade.initialize();

      await facade.correrPrimeraVez();

      expect(facade.errorDeCorrida()).not.toBeNull();
      expect(facade.corrida()).toBeNull();
      expect(facade.error()).toBeNull();
    });

    it('desconectar devuelve el paso al correo', async () => {
      // AC9. El estado vuelve a decir que no hay correo y el paso derivado
      // regresa solo: no hay que moverlo a mano.
      const { facade, integraciones } = montar({ estados: [CON_CUENTA, CONECTADO, CON_CUENTA] });
      await facade.initialize();
      await facade.conectarCorreo('4/abc', 'http://x/onboarding');
      facade.avanzar();
      expect(facade.paso()).toBe('listo');

      expect(await facade.desconectarCorreo()).toBeNull();

      expect(integraciones.desconectar).toHaveBeenCalledWith('i1');
      expect(facade.integracion()).toBeNull();
      expect(facade.paso()).toBe('correo');
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
