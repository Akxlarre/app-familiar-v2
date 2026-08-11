import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * ToastService - Wrapper sobre PrimeNG MessageService
 *
 * Centraliza feedback efímero con duraciones pre-configuradas.
 * NUNCA inyectar MessageService directamente en componentes UI.
 *
 * Uso:
 * ```typescript
 * private toast = inject(ToastService);
 * this.toast.success('Guardado exitosamente');
 * this.toast.error('Error al procesar', 'Detalle del error');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private messageService = inject(MessageService);

  success(summary: string, detail = ''): void {
    this.messageService.add({ severity: 'success', summary, detail, life: 3000 });
  }

  error(summary: string, detail = ''): void {
    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }

  warning(summary: string, detail = ''): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: 4000 });
  }

  info(summary: string, detail = ''): void {
    this.messageService.add({ severity: 'info', summary, detail, life: 3000 });
  }
}
