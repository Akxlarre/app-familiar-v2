import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MessageService } from 'primeng/api';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  const messageMock = { add: vi.fn() };

  beforeEach(() => {
    messageMock.add.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: messageMock }],
    });
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('success() usa severity success y vida corta', () => {
    service.success('Guardado');
    expect(messageMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Guardado', life: 3000 }),
    );
  });

  it('error() vive más que el resto — el usuario necesita leerlo', () => {
    service.error('Falló', 'Detalle');
    const arg = messageMock.add.mock.calls[0][0];
    expect(arg.severity).toBe('error');
    expect(arg.detail).toBe('Detalle');
    expect(arg.life).toBeGreaterThan(3000);
  });

  it('warning() mapea a la severity "warn" de PrimeNG, no "warning"', () => {
    service.warning('Ojo');
    expect(messageMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' }),
    );
  });

  it('info() usa severity info', () => {
    service.info('Dato');
    expect(messageMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info' }),
    );
  });

  it('detail es opcional y por defecto vacío', () => {
    service.success('Solo summary');
    expect(messageMock.add.mock.calls[0][0].detail).toBe('');
  });
});
