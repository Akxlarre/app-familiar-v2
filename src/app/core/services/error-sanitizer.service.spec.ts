import { TestBed } from '@angular/core/testing';
import { ErrorSanitizerService } from './error-sanitizer.service';

describe('ErrorSanitizerService', () => {
  let service: ErrorSanitizerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorSanitizerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('errores de red', () => {
    it('marca isNetworkError ante un fetch caído', () => {
      const r = service.sanitize(new TypeError('Failed to fetch'));
      expect(r.isNetworkError).toBe(true);
      expect(r.code).toBe('NETWORK_ERROR');
    });

    it('trata status 0 de HttpErrorResponse como error de red', () => {
      const r = service.sanitize({ name: 'HttpErrorResponse', status: 0 });
      expect(r.isNetworkError).toBe(true);
    });
  });

  describe('SQLSTATE de Postgres', () => {
    it('mapea 23505 (unique violation) a un mensaje de duplicado', () => {
      const r = service.sanitize({ code: '23505', message: 'duplicate key value' });
      expect(r.message).toContain('Ya existe un registro');
      expect(r.code).toBe('23505');
    });

    it('mapea 42501 (RLS) a falta de permisos', () => {
      const r = service.sanitize({ code: '42501' });
      expect(r.message).toContain('permisos');
    });

    it('confía en el mensaje de P0001 (RAISE EXCEPTION de negocio)', () => {
      const r = service.sanitize({ code: 'P0001', message: 'No quedan cupos disponibles.' });
      expect(r.message).toBe('No quedan cupos disponibles.');
    });
  });

  describe('seguridad', () => {
    it('NUNCA expone details ni hint del error de Supabase', () => {
      const r = service.sanitize({
        code: '23503',
        message: 'update or delete violates foreign key',
        details: 'Key (id)=(42) is still referenced from table "invoices".',
        hint: 'Drop the constraint first.',
      });
      expect(r.message).not.toContain('invoices');
      expect(r.message).not.toContain('constraint');
    });

    it('con un código desconocido muestra solo el código, sin el mensaje crudo', () => {
      const r = service.sanitize({ code: '99999', message: 'internal table scan failed' });
      expect(r.message).toContain('99999');
      expect(r.message).not.toContain('internal table scan');
    });

    it('no confía en el mensaje de errores de sistema (TypeError)', () => {
      const r = service.sanitize(new TypeError("Cannot read properties of undefined (reading 'x')"));
      expect(r.message).not.toContain('undefined');
    });

    it('sí confía en el mensaje de un Error lanzado a propósito', () => {
      const r = service.sanitize(new Error('El monto debe ser mayor a cero.'));
      expect(r.message).toBe('El monto debe ser mayor a cero.');
    });
  });

  describe('HTTP', () => {
    it('mapea 403 a falta de permisos', () => {
      const r = service.sanitize({ name: 'HttpErrorResponse', status: 403 });
      expect(r.message).toContain('permisos');
      expect(r.code).toBe(403);
    });
  });

  it('devuelve un fallback seguro ante un valor desconocido', () => {
    const r = service.sanitize({ algo: 'raro' });
    expect(r.message).toContain('error inesperado');
    expect(r.code).toBe('UNKNOWN');
  });
});
