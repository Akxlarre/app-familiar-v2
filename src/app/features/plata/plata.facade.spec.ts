import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import { ToastService } from '@core/services/toast.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { Movimiento } from '@core/models/movimiento.model';
import { PlataFacade } from './plata.facade';

const mov = (i: number, fecha = '2026-08-12'): Movimiento => ({
  id: `m${i}`, monto: 1000 + i, tipo: 'gasto', fecha, comercio: `C${i}`,
  nota: null, capturaId: 'c1', creadoEn: `${fecha}T00:00:00Z`,
});

const RESUMEN = { gastado: 5000, ingresado: 9000, saldo: 4000, movimientos: 3 };

function montar(opciones: {
  pagina?: (limite: number, saltar: number) => Promise<Movimiento[]>;
  resumenFalla?: boolean;
  categoriasFalla?: boolean;
  paginaFalla?: boolean;
} = {}) {
  const repo = {
    pagina: vi.fn(async (_f: unknown, limite: number, saltar = 0) => {
      if (opciones.paginaFalla) throw new ErrorDeBd('relation "movimientos" does not exist', '42P01');
      return opciones.pagina ? opciones.pagina(limite, saltar) : [mov(1), mov(2)];
    }),
    resumen: vi.fn(async () => {
      if (opciones.resumenFalla) throw new Error('falló');
      return RESUMEN;
    }),
    porCategoria: vi.fn(async () => {
      if (opciones.categoriasFalla) throw new Error('falló');
      return [{ categoriaId: '1', categoria: 'Supermercado', total: 5000, movimientos: 3, porcentaje: 100 }];
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MovimientosRepository, useValue: repo },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  return { facade: TestBed.inject(PlataFacade), repo };
}

describe('PlataFacade', () => {
  it('carga lista, resumen y reparto', async () => {
    const { facade } = montar();
    await facade.cargar();

    expect(facade.movimientos()).toHaveLength(2);
    expect(facade.resumen()).toEqual(RESUMEN);
    expect(facade.categorias()).toHaveLength(1);
  });

  it('si el reparto falla, la lista se ve igual', async () => {
    // El reparto es un complemento: taparlo con un error de pantalla completa
    // escondería lo que el usuario vino a mirar.
    const { facade } = montar({ categoriasFalla: true });
    await facade.cargar();

    expect(facade.movimientos()).toHaveLength(2);
    expect(facade.categorias()).toEqual([]);
    expect(facade.error()).toBeNull();
  });

  it('si la lista falla, el error nunca filtra el texto crudo de la base', async () => {
    const { facade } = montar({ paginaFalla: true });
    await facade.cargar();

    expect(facade.error()).toBeTruthy();
    expect(facade.error()).not.toContain('relation');
    expect(facade.error()).not.toContain('movimientos" does not exist');
  });

  it('agrupa por día', async () => {
    const { facade } = montar({
      pagina: async () => [mov(1, '2026-08-12'), mov(2, '2026-08-12'), mov(3, '2026-08-11')],
    });
    await facade.cargar();

    expect(facade.dias()).toHaveLength(2);
  });

  it('vacío de período no es lo mismo que "no hay datos"', async () => {
    // AC8. Antes de cargar no se sabe: decirlo sin haber preguntado es peor.
    const { facade } = montar({ pagina: async () => [] });

    expect(facade.periodoVacio()).toBe(false);
    await facade.cargar();
    expect(facade.periodoVacio()).toBe(true);
  });

  it('ver más agrega sin perder lo anterior', async () => {
    // AC4: cargar la página siguiente no puede reiniciar la lista ni la posición.
    const { facade } = montar({
      pagina: async (limite, saltar) =>
        Array.from({ length: limite }, (_, i) => mov(saltar + i)),
    });
    await facade.cargar();
    const primeros = facade.movimientos().length;

    await facade.cargarMas();

    expect(facade.movimientos().length).toBe(primeros * 2);
  });

  it('una página incompleta significa que no hay más', async () => {
    const { facade } = montar({ pagina: async () => [mov(1)] });
    await facade.cargar();

    expect(facade.hayMas()).toBe(false);
  });

  it('una respuesta que llega tarde no pisa a la carga más nueva', async () => {
    // Cambiar de filtro rápido produce respuestas fuera de orden. Sin descartar
    // las viejas, la lista termina mostrando el resultado de un filtro que el
    // usuario ya cambió.
    // En un objeto y no en un `let`: TypeScript no ve la asignación de adentro
    // del callback y estrecha la variable a `null`, con lo que `resolverPrimera?.()`
    // se volvía una llamada sobre `never` — o sea, la línea que hace correr esta
    // prueba estaba tipada como inalcanzable.
    const pendiente: { resolver?: (v: Movimiento[]) => void } = {};
    let llamadas = 0;
    const { facade } = montar({
      pagina: async () => {
        llamadas++;
        if (llamadas === 1) return new Promise<Movimiento[]>((r) => { pendiente.resolver = r; });
        return [mov(99)];
      },
    });

    const primera = facade.cargar({ texto: 'viejo' });
    const segunda = facade.cargar({ texto: 'nuevo' });
    await segunda;
    pendiente.resolver?.([mov(1), mov(2), mov(3)]);
    await primera;

    expect(facade.movimientos()).toHaveLength(1);
    expect(facade.movimientos()[0].id).toBe('m99');
  });

  it('moverMes cambia el período', async () => {
    const { facade } = montar();
    await facade.cargar({ desde: '2026-08-01', hasta: '2026-08-31' });

    await facade.moverMes(-1);

    expect(facade.filtro().desde).toBe('2026-07-01');
    expect(facade.filtro().hasta).toBe('2026-07-31');
  });

  it('limpiar filtros conserva el período', async () => {
    // El período no es un filtro más: vaciarlo dejaría la pantalla sin rango.
    const { facade } = montar();
    await facade.cargar({ desde: '2026-07-01', hasta: '2026-07-31', texto: 'jumbo' });

    await facade.limpiarFiltros();

    expect(facade.filtro().texto).toBe('');
    expect(facade.filtro().desde).toBe('2026-07-01');
  });
});

describe('PlataFacade — corregir y aprender', () => {
  function conCorreccion(opciones: { falla?: boolean; afectados?: number } = {}) {
    const repo = {
      pagina: vi.fn(async () => [mov(1)]),
      resumen: vi.fn(async () => RESUMEN),
      porCategoria: vi.fn(async () => []),
      categorias: vi.fn(async () => [{ id: 'c1', nombre: 'Supermercado', icono: null }]),
      origen: vi.fn(async () => ({
        remitente: 'banco@x.cl', asunto: 'Compra', extracto: 'texto', fechaCaptura: '2026-08-12T00:00:00Z',
      })),
      contarMismoComercio: vi.fn(async () => 3),
      recategorizar: vi.fn(async () => {
        if (opciones.falla) throw new ErrorDeBd('relation "movimientos" does not exist', '42P01');
        return opciones.afectados ?? 1;
      }),
      borrar: vi.fn(async () => true),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MovimientosRepository, useValue: repo },
        { provide: ToastService, useValue: toast },
      ],
    });
    return { facade: TestBed.inject(PlataFacade), repo, toast };
  }

  it('recategorizar recarga la lista: los números del hero cambian con la corrección', async () => {
    const { facade, repo } = conCorreccion();
    await facade.cargar();
    const antes = repo.pagina.mock.calls.length;

    await facade.recategorizar('m1', 'c1', false, false);

    expect(repo.pagina.mock.calls.length).toBeGreaterThan(antes);
  });

  it('avisa cuántos movimientos cambió cuando fueron varios', async () => {
    const { facade, toast } = conCorreccion({ afectados: 4 });
    await facade.recategorizar('m1', 'c1', true, true);

    expect(toast.success).toHaveBeenCalledWith('4 movimientos actualizados');
  });

  it('el error de guardar nunca filtra el texto crudo de la base', async () => {
    const { facade } = conCorreccion({ falla: true });
    const fallo = await facade.recategorizar('m1', 'c1', false, false);

    expect(fallo).toBeTruthy();
    expect(fallo).not.toContain('relation');
  });

  it('si el conteo de pasados falla, devuelve 0 en vez de romper', async () => {
    // Sin conteo no se ofrece aplicar a los pasados: preguntarlo a ciegas es
    // justo lo que AC11 evita.
    const { facade, repo } = conCorreccion();
    repo.contarMismoComercio.mockRejectedValueOnce(new Error('falló'));

    expect(await facade.contarMismoComercio('m1', 'c1')).toBe(0);
  });

  it('si el origen no carga, devuelve null y la corrección sigue disponible', async () => {
    const { facade, repo } = conCorreccion();
    repo.origen.mockRejectedValueOnce(new Error('falló'));

    expect(await facade.origenDe('cap1')).toBeNull();
  });

  it('borrar avisa que el correo volvió a la bandeja', async () => {
    // RN-09: una captura nunca se pierde, y el usuario tiene que saberlo para
    // no creer que borró el correo también.
    const { facade, toast } = conCorreccion();
    await facade.borrar('m1');

    expect(toast.success).toHaveBeenCalledWith('Movimiento borrado. El correo volvió a la bandeja.');
  });

  it('borrar un movimiento cargado a mano no promete una bandeja que no existe', async () => {
    const { facade, repo, toast } = conCorreccion();
    repo.borrar.mockResolvedValueOnce(false);

    await facade.borrar('m1');

    expect(toast.success).toHaveBeenCalledWith('Movimiento borrado');
  });
});
