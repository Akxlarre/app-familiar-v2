import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '@core/services/toast.service';
import { ErrorSanitizerService } from '@core/services/error-sanitizer.service';

/**
 * GlobalErrorHandler — Atrapa las excepciones no manejadas del frontend.
 *
 * Sin esto, un `TypeError` dentro de un componente deja la app "congelada" sin
 * ninguna señal para el usuario: la vista queda a medio renderizar y el error
 * solo aparece en la consola, que nadie mira.
 *
 * Se registra en `app.config.ts`:
 * ```ts
 * { provide: ErrorHandler, useClass: GlobalErrorHandler }
 * ```
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(ErrorSanitizerService);

  handleError(error: unknown): void {
    // Siempre a consola: es lo que necesita quien depura.
    console.error('[GlobalErrorHandler] Unhandled exception:', error);

    // A la UI va solo el mensaje saneado, nunca el error crudo.
    const { message } = this.sanitizer.sanitize(error);
    this.toast.error('Error', message);
  }
}
