import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { FocusOnNavigationDirective } from './focus-on-navigation.directive';

@Component({ standalone: true, template: '<h1>Hoy</h1>' })
class PaginaHoy {}

@Component({ standalone: true, template: '<h1>Bandeja</h1>' })
class PaginaBandeja {}

@Component({ standalone: true, template: '<p>Sin encabezado</p>' })
class PaginaSinH1 {}

@Component({
  standalone: true,
  imports: [FocusOnNavigationDirective, RouterOutlet],
  template: '<div appFocusOnNavigation><router-outlet /></div>',
})
class Shell {}

const tick = () => new Promise((r) => setTimeout(r, 1));

async function montar() {
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([
        { path: 'hoy', component: PaginaHoy },
        { path: 'bandeja', component: PaginaBandeja },
        { path: 'sin-h1', component: PaginaSinH1 },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  return { fixture, router: TestBed.inject(Router) };
}

describe('FocusOnNavigationDirective', () => {
  it('lleva el foco al h1 de la pantalla nueva', async () => {
    // Sin esto el foco se queda en el enlace del menú y quien navega con
    // teclado cambia de pantalla sin enterarse.
    const { fixture, router } = await montar();

    await router.navigateByUrl('/hoy');
    fixture.detectChanges();
    await tick();

    expect((document.activeElement as HTMLElement)?.textContent).toBe('Hoy');
  });

  it('vuelve a moverlo en cada navegación, no sólo en la primera', async () => {
    const { fixture, router } = await montar();

    await router.navigateByUrl('/hoy');
    fixture.detectChanges();
    await tick();

    await router.navigateByUrl('/bandeja');
    fixture.detectChanges();
    await tick();

    expect((document.activeElement as HTMLElement)?.textContent).toBe('Bandeja');
  });

  it('hace el encabezado enfocable sin meterlo en el orden de tabulación', async () => {
    const { fixture, router } = await montar();

    await router.navigateByUrl('/hoy');
    fixture.detectChanges();
    await tick();

    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  });

  it('una pantalla sin encabezado no rompe nada', async () => {
    const { fixture, router } = await montar();

    await router.navigateByUrl('/sin-h1');
    fixture.detectChanges();
    await tick();

    expect(fixture.nativeElement.textContent).toContain('Sin encabezado');
  });
});
