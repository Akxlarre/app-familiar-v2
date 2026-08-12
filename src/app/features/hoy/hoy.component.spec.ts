import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Home,
  Inbox,
  LucideAngularModule,
  ShoppingCart,
} from 'lucide-angular';
import { describe, expect, it, vi } from 'vitest';

import { MovimientosRepository } from '@core/repositories/movimientos.repository';
import { FUENTE_DE_PENDIENTES, type FuenteDePendientes, type Pendiente } from '@core/models/pendiente.model';
import type { Movimiento } from '@core/models/movimiento.model';
import { HoyComponent } from './hoy.component';
import { HoyFacade } from './hoy.facade';

// Sin esto, DecimalPipe formatea 12990 como "12,990" en vez de "12.990": el
// punto es el separador de miles en Chile, y el test estaría midiendo el
// entorno de prueba en vez de la app.
registerLocaleData(localeEs);

const CAPTURA: Pendiente = {
  tipo: 'captura',
  titulo: '3 movimientos por confirmar',
  detalle: '1 necesita que escribas el monto',
  cantidad: 3,
  ruta: '/app/bandeja',
  prioridad: 1,
};

const MOVIMIENTO: Movimiento = {
  id: 'm1',
  monto: 12990,
  tipo: 'gasto',
  fecha: '2026-08-12',
  comercio: 'Jumbo',
  nota: null,
  capturaId: 'c1',
  creadoEn: '2026-08-12T10:00:00Z',
};

async function montar(opciones: {
  pendientes?: Pendiente[];
  movimientos?: Movimiento[];
}): Promise<ComponentFixture<HoyComponent>> {
  const fuente: FuenteDePendientes = {
    id: 'bandeja',
    cargar: async () => opciones.pendientes ?? [],
  };

  await TestBed.configureTestingModule({
    imports: [
      HoyComponent,
      // Un icono sin proveer no rompe el build: lucide lanza en runtime, y acá
      // el error tapaba por completo el fallo que se estaba buscando.
      LucideAngularModule.pick({
        AlertCircle,
        AlertTriangle,
        CheckCircle,
        ChevronRight,
        CreditCard,
        Home,
        Inbox,
        ShoppingCart,
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: LOCALE_ID, useValue: 'es' },
      { provide: FUENTE_DE_PENDIENTES, useValue: fuente, multi: true },
      {
        provide: MovimientosRepository,
        useValue: { ultimos: vi.fn(async () => opciones.movimientos ?? []) },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(HoyComponent);
  fixture.detectChanges(); // dispara ngOnInit

  // `ngOnInit` lanza `initialize()` sin esperarla, y `whenStable()` no alcanza:
  // en zoneless no rastrea promesas sueltas. Con un solo flush de microtareas,
  // el bloque de movimientos llegaba a resolver y el de pendientes no —lleva
  // un await más—, así que el test veía media pantalla.
  await TestBed.inject(HoyFacade).initialize();

  fixture.detectChanges();
  return fixture;
}

const texto = (fixture: ComponentFixture<HoyComponent>) =>
  fixture.nativeElement.textContent as string;

describe('HoyComponent', () => {
  it('usa las cinco piezas: hero y panel que llena', async () => {
    const fixture = await montar({ pendientes: [CAPTURA] });
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.bento-grid--fill-screen')).toBeTruthy();
    expect(raiz.querySelector('app-section-hero')).toBeTruthy();
    expect(raiz.querySelector('.bento-fill')).toBeTruthy();
  });

  it('sin nada pendiente lo dice con una frase, no con KPIs en cero', async () => {
    // AC9. Un tablero de ceros obliga a leer números para concluir lo que una
    // frase dice de una vez — que es exactamente lo que hacía v1.
    const fixture = await montar({ pendientes: [] });

    expect(texto(fixture)).toContain('No hay nada que hacer');
    expect(fixture.componentInstance['kpis']()).toEqual([]);
  });

  it('muestra el número exacto de pendientes y su acceso directo', async () => {
    const fixture = await montar({ pendientes: [CAPTURA] });
    const enlace = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-llm-action="resolver-captura"]',
    );

    expect(texto(fixture)).toContain('3 movimientos por confirmar');
    expect(enlace?.getAttribute('href')).toBe('/app/bandeja');
  });

  it('el detalle distingue lo que exige escribir el monto', async () => {
    const fixture = await montar({ pendientes: [CAPTURA] });

    expect(texto(fixture)).toContain('1 necesita que escribas el monto');
  });

  it('muestra los últimos movimientos sin entrar a Plata', async () => {
    // AC11.
    const fixture = await montar({ pendientes: [], movimientos: [MOVIMIENTO] });

    expect(texto(fixture)).toContain('Jumbo');
    expect(texto(fixture)).toContain('12.990');
  });

  it('un gasto se muestra en negativo', async () => {
    const fixture = await montar({ movimientos: [MOVIMIENTO] });

    expect(texto(fixture)).toContain('−$12.990');
  });

  it('un ingreso se muestra en positivo', async () => {
    const fixture = await montar({ movimientos: [{ ...MOVIMIENTO, tipo: 'ingreso' }] });

    expect(texto(fixture)).toContain('+$12.990');
  });

  it('sin movimientos explica cuándo llegará el primero', async () => {
    const fixture = await montar({ movimientos: [] });

    expect(texto(fixture)).toContain('El primero llega cuando el banco avise');
  });
});
