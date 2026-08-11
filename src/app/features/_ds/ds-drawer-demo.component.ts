import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';

/**
 * Pieza 4 del contrato: el drawer.
 *
 * Existe para demostrar dos cosas que se olvidan al armar la quinta pantalla:
 * que el drawer **recibe datos** (`input()` vía el `inputs` del servicio), y que
 * los formularios se arman con `.field-label` / `.field-input` y no con un
 * cluster de utilities a mano (ARCH-24).
 */
@Component({
  selector: 'app-ds-drawer-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <form class="flex flex-col gap-5" (ngSubmit)="cerrar()">
      <section class="card flex flex-col gap-2 p-4">
        <span class="micro-label">Dato recibido</span>
        <p class="item-title">{{ titulo() }}</p>
        <p class="text-sm text-text-muted">
          Llegó por el <code>inputs</code> de <code>LayoutDrawerFacadeService.open()</code>. Sin
          eso, el drawer sólo sirve para pantallas sin datos.
        </p>
      </section>

      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="ds-nombre">Un campo</label>
        <input
          id="ds-nombre"
          name="ds-nombre"
          type="text"
          class="field-input"
          placeholder="Escribí algo"
          [(ngModel)]="valor"
        />
        <p class="text-sm text-text-muted">
          Usa <code>.field-input</code>. Recomponer su cluster a mano lo bloquea ARCH-24.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="ds-invalido">Un campo con error</label>
        <input
          id="ds-invalido"
          name="ds-invalido"
          type="text"
          class="field-input field-input--invalid"
          value="valor inválido"
          aria-invalid="true"
        />
        <p class="micro-label micro-label--error">El modificador se aplica sólo si ya se tocó</p>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
        <button type="button" class="btn-ghost" (click)="cerrar()" data-llm-action="ds-cancelar">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" data-llm-action="ds-guardar">Guardar</button>
      </div>
    </form>
  `,
})
export class DsDrawerDemoComponent {
  /** Lo que la pantalla de referencia le pasa al abrirlo. */
  readonly titulo = input<string>('(sin dato)');

  private readonly drawer = inject(LayoutDrawerFacadeService);
  protected readonly valor = signal('');

  protected cerrar(): void {
    this.drawer.close();
  }
}
