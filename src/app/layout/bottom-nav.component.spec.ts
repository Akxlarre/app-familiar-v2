import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Home, Inbox, LucideAngularModule, Wallet } from 'lucide-angular';
import { describe, expect, it } from 'vitest';

import { BottomNavComponent } from './bottom-nav.component';
import { DESTINO_REGISTRADO } from '@core/services/navegacion.service';
import { DESTINO_HOY } from '@core/models/destino.model';
import type { Destino } from '@core/models/destino.model';

@Component({ standalone: true, template: '' })
class Stub {}

const PLATA: Destino = { id: 'plata', label: 'Plata', icon: 'wallet', routerLink: '/app/plata' };

async function montar(destinos: Destino[]) {
  TestBed.configureTestingModule({
    imports: [BottomNavComponent, LucideAngularModule.pick({ Home, Inbox, Wallet })],
    providers: [
      // Con `provideRouter([])` ninguna navegación resuelve y `router.url` se
      // queda en '/': el test estaría midiendo un router que no navega.
      provideRouter([
        { path: 'app/hoy', component: Stub },
        { path: 'app/plata/cuentas', component: Stub },
      ]),
      ...destinos.map((d) => ({ provide: DESTINO_REGISTRADO, useValue: d, multi: true })),
    ],
  });
  const fixture = TestBed.createComponent(BottomNavComponent);
  fixture.detectChanges();
  return { fixture, router: TestBed.inject(Router) };
}

describe('BottomNavComponent', () => {
  it('muestra los destinos registrados, los mismos que el sidebar', async () => {
    const { fixture } = await montar([DESTINO_HOY, PLATA]);
    const enlaces = (fixture.nativeElement as HTMLElement).querySelectorAll('a');

    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].textContent).toContain('Hoy');
  });

  it('sin destinos no dibuja la barra', async () => {
    // Una barra vacía ocuparía alto y taparía contenido a cambio de nada.
    const { fixture } = await montar([]);

    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });

  it('marca el destino activo con aria-current', async () => {
    const { fixture, router } = await montar([DESTINO_HOY, PLATA]);

    await router.navigateByUrl('/app/hoy');
    fixture.detectChanges();

    const activos = (fixture.nativeElement as HTMLElement).querySelectorAll('[aria-current="page"]');
    expect(activos).toHaveLength(1);
    expect(activos[0].textContent).toContain('Hoy');
  });

  it('sigue marcando la sección dentro de una subsección', async () => {
    // /app/plata/cuentas sigue siendo Plata: si sólo marcara la ruta exacta, la
    // barra se apagaría al entrar a un tab.
    const { fixture, router } = await montar([DESTINO_HOY, PLATA]);

    await router.navigateByUrl('/app/plata/cuentas');
    fixture.detectChanges();

    const activos = (fixture.nativeElement as HTMLElement).querySelectorAll('[aria-current="page"]');
    expect(activos[0]?.textContent).toContain('Plata');
  });

  it('cada destino lleva su texto visible, no sólo el icono', async () => {
    // Un icono suelto no tiene nombre accesible y obliga a adivinar (A11Y-03).
    const { fixture } = await montar([DESTINO_HOY, PLATA]);

    for (const a of (fixture.nativeElement as HTMLElement).querySelectorAll('a')) {
      expect(a.textContent?.trim()).toBeTruthy();
    }
  });

  it('la barra se anuncia como navegación', async () => {
    const { fixture } = await montar([DESTINO_HOY]);
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav');

    expect(nav?.getAttribute('aria-label')).toBeTruthy();
  });
});
