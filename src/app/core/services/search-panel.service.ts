import { Injectable, signal } from '@angular/core';

/**
 * SearchPanelService — estado global del panel de búsqueda.
 *
 * Consumido por SearchShortcutDirective (Ctrl+K / Cmd+K).
 * Conecta la directiva de teclado con el componente de UI del buscador.
 *
 * Uso en el componente de búsqueda:
 * ```ts
 * readonly search = inject(SearchPanelService);
 * // En template: @if (search.isOpen()) { <app-search-panel /> }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class SearchPanelService {
  private _isOpen = signal(false);

  readonly isOpen = this._isOpen.asReadonly();

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggle(): void {
    this._isOpen.update((v) => !v);
  }
}
