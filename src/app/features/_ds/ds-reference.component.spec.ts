import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertCircle, LucideAngularModule, Inbox, Layers, Mail, Receipt } from 'lucide-angular';
import { DsReferenceComponent } from './ds-reference.component';
import { DsDrawerDemoComponent } from './ds-drawer-demo.component';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';

/**
 * Este spec existe contra la **pudrición**, no contra un bug.
 *
 * Una pantalla de referencia sólo sirve mientras siga siendo fiel al contrato.
 * Si alguien la simplifica —le saca el pie fijo, deja de forzar los estados,
 * cambia el hero por unas cards— deja de servir en silencio y todo el mundo
 * sigue copiando de ella. Acá se ata a las cinco piezas.
 */
registerLocaleData(localeEs);

describe('DsReferenceComponent', () => {
  let fixture: ComponentFixture<DsReferenceComponent>;
  let drawer: { open: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';

  beforeEach(() => {
    drawer = { open: vi.fn(), close: vi.fn() };
    TestBed.configureTestingModule({
      // `app-error-state` usa alert-circle; sin registrarlo, lucide lanza en runtime.
      imports: [LucideAngularModule.pick({ AlertCircle, Inbox, Layers, Mail, Receipt })],
      providers: [
        { provide: LayoutDrawerFacadeService, useValue: drawer },
        // El TestBed no hereda el LOCALE_ID de app.config: sin esto, DecimalPipe
        // formatea a la yanqui y el test mide algo que el usuario nunca ve.
        { provide: LOCALE_ID, useValue: 'es' },
      ],
    });
    fixture = TestBed.createComponent(DsReferenceComponent);
    fixture.detectChanges();
  });

  // ── Las cinco piezas ───────────────────────────────────────────────────────

  it('pieza 1 — el hero, con su banda de KPIs', () => {
    expect(el().querySelector('app-section-hero')).toBeTruthy();
  });

  it('pieza 2 — el panel que llena, en un grid fill-screen', () => {
    expect(el().querySelector('.bento-grid--fill-screen')).toBeTruthy();
    expect(el().querySelector('.bento-fill')).toBeTruthy();
  });

  it('el panel tiene cabecera fija, cuerpo scrolleable y pie fijo', () => {
    // El contrato App-like: el scroll vive DENTRO del panel, no en el documento.
    expect(el().querySelector('.overflow-y-auto')).toBeTruthy();
    expect(texto()).toContain('El pie queda fijo');
  });

  it('pieza 3 — filas de lista con el vocabulario del DS', () => {
    expect(el().querySelectorAll('li').length).toBeGreaterThan(0);
    expect(el().querySelector('.item-title')).toBeTruthy();
    expect(el().querySelector('.micro-label')).toBeTruthy();
  });

  it('pieza 4 — el drawer, y le pasa datos', () => {
    const abrir = el().querySelector<HTMLButtonElement>('[data-llm-action^="ds-abrir-"]')!;
    abrir.click();

    expect(drawer.open).toHaveBeenCalled();
    const [componente, , , , inputs] = drawer.open.mock.calls[0];
    expect(componente).toBe(DsDrawerDemoComponent);
    // Sin `inputs`, el drawer sólo sirve para pantallas sin datos.
    expect(inputs).toEqual(expect.objectContaining({ titulo: expect.any(String) }));
  });

  // ── Pieza 5: los cuatro estados, forzables ─────────────────────────────────

  function forzar(estado: string) {
    el().querySelector<HTMLButtonElement>(`[data-llm-action="ds-estado-${estado}"]`)!.click();
    fixture.detectChanges();
  }

  it('los cuatro estados se pueden forzar desde la pantalla', () => {
    // Es lo que hace útil a la referencia: vacío, error y skeleton normalmente
    // sólo se ven cuando el servidor falla, así que nadie los revisa.
    for (const e of ['normal', 'vacio', 'error', 'cargando']) {
      expect(el().querySelector(`[data-llm-action="ds-estado-${e}"]`)).toBeTruthy();
    }
  });

  it('estado vacío — muestra el empty-state con copy que explica', () => {
    forzar('vacio');
    expect(el().querySelector('app-empty-state')).toBeTruthy();
    expect(el().querySelector('li')).toBeNull();
  });

  it('estado error — muestra el error-state', () => {
    forzar('error');
    expect(el().querySelector('app-error-state')).toBeTruthy();
  });

  it('estado cargando — muestra skeletons', () => {
    forzar('cargando');
    expect(el().querySelectorAll('app-skeleton-block').length).toBeGreaterThan(0);
  });

  it('vuelve a normal después de recorrer los estados', () => {
    forzar('error');
    forzar('normal');
    expect(el().querySelectorAll('li').length).toBeGreaterThan(0);
  });

  // ── Casos límite que la referencia tiene que exhibir ───────────────────────

  it('incluye un texto largo que trunca (AC-E2)', () => {
    const largos = [...el().querySelectorAll('.item-title')].filter(
      (n) => (n.textContent ?? '').length > 60,
    );
    expect(largos.length).toBeGreaterThan(0);
    expect(largos[0].classList.contains('truncate')).toBe(true);
  });

  it('incluye un monto de nueve cifras (AC-E3)', () => {
    expect(texto()).toContain('123.456.789');
  });
});
