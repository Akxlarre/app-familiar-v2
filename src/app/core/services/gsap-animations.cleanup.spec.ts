import { TestBed } from '@angular/core/testing';
import gsap from 'gsap';
import { GsapAnimationsService } from './gsap-animations.service';

/**
 * AC12 de la spec 0002: una animación de entrada no puede dejar el tween vivo
 * cuando el componente muere antes de que termine.
 *
 * Es un AC que **ninguna regla del linter puede detectar**: compila igual, no
 * rompe nada visible y sólo se manifiesta como un contador de tweens que sube
 * mientras el usuario navega. Por eso se prueba acá, contra el registro real de
 * GSAP.
 *
 * El caso difícil es `animateCounter`: anima un **objeto plano** interno, no el
 * elemento. `gsap.killTweensOf(el)` no lo alcanza, así que el componente no
 * tiene forma de matarlo sin que el servicio le devuelva un handle.
 */
describe('GsapAnimationsService — limpieza de tweens (AC12)', () => {
  let servicio: GsapAnimationsService;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(GsapAnimationsService);
    el = document.createElement('div');
    document.body.appendChild(el);
    gsap.globalTimeline.clear();
  });

  afterEach(() => {
    gsap.globalTimeline.clear();
    el.remove();
  });

  /** Tweens vivos en el timeline global. */
  const vivos = () => gsap.globalTimeline.getChildren(true, true, true).length;

  it('el entorno de test permite animar (si no, esta suite no prueba nada)', () => {
    // `shouldAnimate()` es falso con prefers-reduced-motion o fuera del browser.
    // Sin esta comprobación, todos los casos de abajo pasarían por vacío.
    expect(servicio.canAnimate()).toBe(true);
  });

  it('animateCounter devuelve un handle que se puede matar', () => {
    const antes = vivos();
    const tween = servicio.animateCounter(el, 1000);

    expect(tween).not.toBeNull();
    expect(vivos()).toBeGreaterThan(antes);

    tween!.kill();
    expect(vivos()).toBe(antes);
  });

  it('el tween del contador NO se mata con killTweensOf(el)', () => {
    // Documenta por qué hace falta el handle: el target del tween es un objeto
    // interno, no el elemento. Quien intente limpiarlo "como siempre" falla.
    const antes = vivos();
    const tween = servicio.animateCounter(el, 1000);

    gsap.killTweensOf(el);
    expect(vivos()).toBeGreaterThan(antes);

    tween!.kill();
    expect(vivos()).toBe(antes);
  });

  it('con reduced-motion no crea tween y escribe el valor final', () => {
    const sinMovimiento = TestBed.inject(GsapAnimationsService);
    // @ts-expect-error — se fuerza la guarda privada para probar la rama.
    sinMovimiento.prefersReducedMotion = true;

    const antes = vivos();
    const tween = sinMovimiento.animateCounter(el, 1234);

    expect(tween).toBeNull();
    expect(vivos()).toBe(antes);
    expect(el.textContent).toBe('1234');
  });

  it('killAll deja el timeline global limpio', () => {
    servicio.animateCounter(el, 500);
    servicio.fadeIn(el);
    expect(vivos()).toBeGreaterThan(0);

    servicio.killAll();
    expect(vivos()).toBe(0);
  });
});
