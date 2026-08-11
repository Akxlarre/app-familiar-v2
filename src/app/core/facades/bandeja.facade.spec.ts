import { TestBed } from '@angular/core/testing';
import { BandejaFacade } from './bandeja.facade';
import { CapturasRepository } from '@core/repositories/capturas.repository';
import { ToastService } from '@core/services/toast.service';
import type { Captura, ResolucionCaptura } from '@core/models/captura.model';

function captura(over: Partial<Captura> = {}): Captura {
  return {
    id: crypto.randomUUID(),
    origen: 'email',
    estado: 'pendiente',
    payload: { asunto: 'Compra con tarjeta' },
    interpretado: { monto: 15990, comercio: 'JUMBO', confianza: 85 },
    motivo: null,
    intentos: 0,
    fechaOrigen: '2026-08-11T10:00:00Z',
    creadaEn: '2026-08-11T10:05:00Z',
    ...over,
  };
}

const RESOLUCION: ResolucionCaptura = {
  monto: 15990,
  comercio: 'JUMBO',
  categoriaId: 'cat-1',
  cuentaId: 'cta-1',
  fecha: '2026-08-11',
  tipo: 'gasto',
  recordarComercio: true,
};

describe('BandejaFacade', () => {
  let repo: {
    pendientes: ReturnType<typeof vi.fn>;
    resolver: ReturnType<typeof vi.fn>;
    descartar: ReturnType<typeof vi.fn>;
    reprocesar: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repo = {
      pendientes: vi.fn().mockResolvedValue([]),
      resolver: vi.fn().mockResolvedValue(undefined),
      descartar: vi.fn().mockResolvedValue(undefined),
      reprocesar: vi.fn().mockResolvedValue({ revisadas: 0, recuperadas: 0 }),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: CapturasRepository, useValue: repo },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  const crear = () => TestBed.inject(BandejaFacade);

  it('empieza vacía y sin datos', () => {
    const f = crear();
    expect(f.total()).toBe(0);
    expect(f.vacia()).toBe(false); // todavía no cargó: no es "vacía", es "sin datos"
  });

  it('carga las capturas pendientes', async () => {
    repo.pendientes.mockResolvedValue([captura(), captura()]);
    const f = crear();
    await f.initialize();
    expect(f.total()).toBe(2);
    expect(f.vacia()).toBe(false);
  });

  it('distingue bandeja vacía de bandeja sin cargar', async () => {
    const f = crear();
    await f.initialize();
    expect(f.vacia()).toBe(true);
  });

  it('pone primero lo que se resuelve con un toque', async () => {
    // Sin monto hay que tipear; con monto alcanza confirmar. Lo barato va arriba
    // o la bandeja se siente un formulario.
    const sinMonto = captura({ id: 'sin-monto', interpretado: { monto: null, comercio: 'X' } });
    const conMonto = captura({ id: 'con-monto', fechaOrigen: '2026-08-01T10:00:00Z' });
    repo.pendientes.mockResolvedValue([sinMonto, conMonto]);

    const f = crear();
    await f.initialize();

    expect(f.ordenadas().map((c) => c.id)).toEqual(['con-monto', 'sin-monto']);
  });

  it('entre iguales, primero lo más reciente', async () => {
    const vieja = captura({ id: 'vieja', fechaOrigen: '2026-08-01T10:00:00Z' });
    const nueva = captura({ id: 'nueva', fechaOrigen: '2026-08-10T10:00:00Z' });
    repo.pendientes.mockResolvedValue([vieja, nueva]);

    const f = crear();
    await f.initialize();

    expect(f.ordenadas().map((c) => c.id)).toEqual(['nueva', 'vieja']);
  });

  it('cuenta cuántas están listas para confirmar', async () => {
    repo.pendientes.mockResolvedValue([
      captura(),
      captura({ interpretado: { monto: null } }),
      captura(),
    ]);
    const f = crear();
    await f.initialize();
    expect(f.listasParaConfirmar()).toBe(2);
  });

  it('al resolver, saca la captura de la lista sin recargar', async () => {
    const a = captura({ id: 'a' });
    const b = captura({ id: 'b' });
    repo.pendientes.mockResolvedValue([a, b]);

    const f = crear();
    await f.initialize();
    repo.pendientes.mockClear();

    const ok = await f.resolver('a', RESOLUCION);

    expect(ok).toBe(true);
    expect(f.capturas().map((c) => c.id)).toEqual(['b']);
    expect(repo.pendientes).not.toHaveBeenCalled();
  });

  it('avisa que el comercio quedó aprendido', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a' })]);
    const f = crear();
    await f.initialize();

    await f.resolver('a', RESOLUCION);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('JUMBO'));
  });

  it('no promete aprendizaje si no se pidió recordar', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a' })]);
    const f = crear();
    await f.initialize();

    await f.resolver('a', { ...RESOLUCION, recordarComercio: false });

    expect(toast.success).toHaveBeenCalledWith('Movimiento creado');
  });

  it('deja pasar los mensajes de dominio del RPC', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a' })]);
    repo.resolver.mockRejectedValue(new Error('La captura ya fue procesada'));

    const f = crear();
    await f.initialize();
    const ok = await f.resolver('a', RESOLUCION);

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo crear el movimiento',
      'La captura ya fue procesada',
    );
    // La captura sigue en la bandeja: no se resolvió.
    expect(f.total()).toBe(1);
  });

  it('sanea los errores crudos de la base', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a' })]);
    repo.resolver.mockRejectedValue(
      new Error('new row violates row-level security policy for table "movimientos"'),
    );

    const f = crear();
    await f.initialize();
    await f.resolver('a', RESOLUCION);

    const detalle = toast.error.mock.calls[0][1] as string;
    expect(detalle).not.toContain('movimientos');
    expect(detalle).toContain('permisos');
  });

  it('descartar también saca de la lista', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a' }), captura({ id: 'b' })]);
    const f = crear();
    await f.initialize();

    const ok = await f.descartar('a', 'No es un movimiento');

    expect(ok).toBe(true);
    expect(repo.descartar).toHaveBeenCalledWith('a', 'No es un movimiento');
    expect(f.capturas().map((c) => c.id)).toEqual(['b']);
  });

  it('al reprocesar, recarga y avisa cuántas se recuperaron', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a', interpretado: { monto: null } })]);
    const f = crear();
    await f.initialize();

    repo.reprocesar.mockResolvedValue({ revisadas: 3, recuperadas: 2 });
    repo.pendientes.mockClear();

    await f.reprocesar();

    expect(repo.pendientes).toHaveBeenCalled(); // cambió el estado de varias a la vez
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('2'));
  });

  it('si no se recuperó ninguna, lo dice sin celebrar', async () => {
    const f = crear();
    await f.initialize();
    repo.reprocesar.mockResolvedValue({ revisadas: 4, recuperadas: 0 });

    await f.reprocesar();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('4'));
  });

  it('no dispara dos reprocesos a la vez', async () => {
    const f = crear();
    await f.initialize();
    let liberar: (v: { revisadas: number; recuperadas: number }) => void = () => {};
    repo.reprocesar.mockReturnValue(new Promise((res) => (liberar = res)));

    const primero = f.reprocesar();
    await f.reprocesar(); // mientras el primero sigue en vuelo

    expect(repo.reprocesar).toHaveBeenCalledTimes(1);
    liberar({ revisadas: 0, recuperadas: 0 });
    await primero;
    expect(f.reprocesando()).toBe(false);
  });

  it('si el reproceso falla, no deja el botón trabado', async () => {
    const f = crear();
    await f.initialize();
    repo.reprocesar.mockRejectedValue(new Error('network error'));

    await f.reprocesar();

    expect(f.reprocesando()).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('si descartar falla, la captura se queda', async () => {
    repo.pendientes.mockResolvedValue([captura({ id: 'a' })]);
    repo.descartar.mockRejectedValue(new Error('network error'));

    const f = crear();
    await f.initialize();
    const ok = await f.descartar('a', 'x');

    expect(ok).toBe(false);
    expect(f.total()).toBe(1);
  });
});
