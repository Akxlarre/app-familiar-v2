import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideAngularModule, Mail, Receipt } from 'lucide-angular';
import { CompletarCapturaComponent } from './completar-captura.component';
import { BandejaFacade } from '@core/facades/bandeja.facade';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import type { Captura } from '@core/models/captura.model';

function captura(over: Partial<Captura> = {}): Captura {
  return {
    id: 'cap-1',
    origen: 'email',
    estado: 'requiere_revision',
    payload: { asunto: 'Compra con tarjeta', extracto: 'No se pudo leer el monto' },
    interpretado: { monto: null, comercio: 'JUMBO', banco: 'BancoEstado' },
    motivo: 'El parser no encontró el monto',
    intentos: 2,
    fechaOrigen: '2026-08-09T10:00:00Z',
    creadaEn: '2026-08-09T10:05:00Z',
    ...over,
  };
}

describe('CompletarCapturaComponent', () => {
  let facade: { resolver: ReturnType<typeof vi.fn> };
  let drawer: { close: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<CompletarCapturaComponent>;

  function montar(c: Captura = captura()) {
    fixture = TestBed.createComponent(CompletarCapturaComponent);
    fixture.componentRef.setInput('captura', c);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      monto: { set: (v: number | null) => void; (): number | null };
      comercio: { set: (v: string) => void; (): string };
      fecha: { set: (v: string) => void; (): string };
      tipo: { set: (v: 'gasto' | 'ingreso') => void };
      recordar: { set: (v: boolean) => void };
      montoValido: () => boolean;
      guardar: () => Promise<void>;
    };
  }

  beforeEach(() => {
    facade = { resolver: vi.fn().mockResolvedValue(true) };
    drawer = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [LucideAngularModule.pick({ Mail, Receipt })],
      providers: [
        { provide: BandejaFacade, useValue: facade },
        { provide: LayoutDrawerFacadeService, useValue: drawer },
      ],
    });
  });

  it('prellena con lo que el parser sí entendió', () => {
    const c = montar();
    // El monto es justo lo que faltaba; el comercio sí se leyó y no debería
    // haber que volver a escribirlo.
    expect(c.monto()).toBeNull();
    expect(c.comercio()).toBe('JUMBO');
    expect(c.fecha()).toBe('2026-08-09');
  });

  it('usa la fecha interpretada por sobre la de llegada', () => {
    // El correo puede llegar días después de la compra.
    const c = montar(
      captura({ interpretado: { monto: null, fecha: '2026-08-01' }, fechaOrigen: '2026-08-09T10:00:00Z' }),
    );
    expect(c.fecha()).toBe('2026-08-01');
  });

  it('reconoce un ingreso por el tipo interpretado', async () => {
    const c = montar(captura({ interpretado: { monto: null, tipo: 'abono' } }));
    c.monto.set(5000);
    await c.guardar();
    expect(facade.resolver).toHaveBeenCalledWith('cap-1', expect.objectContaining({ tipo: 'ingreso' }));
  });

  it('no guarda sin monto', async () => {
    const c = montar();
    await c.guardar();
    expect(facade.resolver).not.toHaveBeenCalled();
    expect(drawer.close).not.toHaveBeenCalled();
  });

  it('no guarda con monto cero ni negativo', async () => {
    const c = montar();
    c.monto.set(0);
    expect(c.montoValido()).toBe(false);
    await c.guardar();
    c.monto.set(-100);
    expect(c.montoValido()).toBe(false);
    await c.guardar();
    expect(facade.resolver).not.toHaveBeenCalled();
  });

  it('guarda y cierra el drawer', async () => {
    const c = montar();
    c.monto.set(15990);
    await c.guardar();

    expect(facade.resolver).toHaveBeenCalledWith('cap-1', {
      monto: 15990,
      comercio: 'JUMBO',
      categoriaId: null,
      cuentaId: null,
      fecha: '2026-08-09',
      tipo: 'gasto',
      recordarComercio: false,
    });
    expect(drawer.close).toHaveBeenCalled();
  });

  it('si falla, deja el drawer abierto con lo escrito', async () => {
    // Volver a tipear todo después de un error es el peor final posible.
    facade.resolver.mockResolvedValue(false);
    const c = montar();
    c.monto.set(15990);
    await c.guardar();

    expect(drawer.close).not.toHaveBeenCalled();
    expect(c.monto()).toBe(15990);
  });

  it('no promete aprender un comercio vacío', async () => {
    // El checkbox se esconde sin comercio, pero si quedó marcado y después se
    // borró el texto, prometer aprendizaje sería mentira.
    const c = montar(captura({ interpretado: { monto: null, comercio: null } }));
    c.monto.set(3000);
    c.recordar.set(true);
    await c.guardar();

    expect(facade.resolver).toHaveBeenCalledWith(
      'cap-1',
      expect.objectContaining({ comercio: null, recordarComercio: false }),
    );
  });

  it('recuerda el comercio cuando se pidió', async () => {
    const c = montar();
    c.monto.set(3000);
    c.recordar.set(true);
    await c.guardar();

    expect(facade.resolver).toHaveBeenCalledWith(
      'cap-1',
      expect.objectContaining({ comercio: 'JUMBO', recordarComercio: true }),
    );
  });

  it('muestra el contexto de lo que llegó', () => {
    montar();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Compra con tarjeta');
    expect(texto).toContain('BancoEstado');
    expect(texto).toContain('El parser no encontró el monto');
  });

  it('el input del monto está atado al signal', async () => {
    // `[(ngModel)]` sobre un signal compila igual si no funciona: esto verifica
    // el binding de verdad, en el DOM. `NgForm` registra sus controles en un
    // microtask, así que hay que esperar la estabilización antes de leer.
    const c = montar();
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#monto')!;
    input.value = '15990';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(c.monto()).toBe(15990);
    expect(c.montoValido()).toBe(true);
  });
});
