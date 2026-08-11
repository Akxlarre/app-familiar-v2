import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BandejaFacade } from '@core/facades/bandeja.facade';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { Captura } from '@core/models/captura.model';

/**
 * CompletarCapturaComponent — la salida para lo que el parser no pudo leer.
 *
 * Sin esta pantalla, una captura sin monto se quedaba en la bandeja para
 * siempre: la bandeja decía "abrila para completarla" y no había con qué. Eso
 * rompía RN-09 — una captura nunca se pierde, pero tampoco se puede resolver.
 *
 * Es deliberadamente el camino LARGO. El corto —confirmar de un toque— vive en
 * la bandeja y es el que tiene que usarse el 90% de las veces. Acá se escribe a
 * mano justo lo que faltó, con lo que el parser sí entendió a la vista para no
 * tener que ir a buscar el correo.
 */
@Component({
  selector: 'app-completar-captura',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, IconComponent],
  template: `
    <form class="flex min-h-0 flex-col gap-5" (ngSubmit)="guardar()">
      <!-- Lo que el parser SÍ entendió. Es el contexto para completar el resto:
           sin esto hay que ir a abrir el correo en otra pestaña. -->
      <section class="card flex flex-col gap-2 p-4">
        <span class="micro-label">Lo que llegó</span>

        <p class="item-title break-words">
          {{ captura().payload.asunto || 'Sin asunto' }}
        </p>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          <span class="inline-flex items-center gap-1.5">
            <app-icon
              [name]="captura().origen === 'email' ? 'mail' : 'receipt'"
              [size]="14"
              [ariaHidden]="true"
            />
            {{ captura().interpretado?.banco || (captura().origen === 'email' ? 'Correo' : 'Boleta') }}
          </span>
          @if (captura().fechaOrigen; as llegada) {
            <span>· {{ llegada | date: 'd MMM y' }}</span>
          }
          @if (captura().intentos > 0) {
            <span>· {{ captura().intentos }} intento{{ captura().intentos === 1 ? '' : 's' }}</span>
          }
        </div>

        @if (captura().payload.extracto; as extracto) {
          <p class="mt-1 text-sm break-words text-text-secondary">{{ extracto }}</p>
        }

        @if (captura().motivo; as motivo) {
          <p class="micro-label micro-label--warning mt-1">{{ motivo }}</p>
        }
      </section>

      <!-- Monto: el único campo que siempre falta cuando se llega hasta acá. -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="monto">Monto</label>
        <input
          id="monto"
          name="monto"
          type="number"
          inputmode="numeric"
          step="1"
          min="1"
          class="field-input"
          [class.field-input--invalid]="tocado() && !montoValido()"
          placeholder="15990"
          autocomplete="off"
          [(ngModel)]="monto"
          (blur)="tocado.set(true)"
          [attr.aria-invalid]="tocado() && !montoValido()"
          aria-describedby="monto-ayuda"
        />
        <p id="monto-ayuda" class="text-sm text-text-muted">
          @if (montoValido()) {
            <!-- Eco formateado: el peso no tiene decimales y el punto separa
                 miles, así que ver "$15.990" confirma que se entendió bien. -->
            Se guardará como \${{ monto() | number: '1.0-0' }}
          } @else if (tocado()) {
            <span class="micro-label micro-label--error">Escribí un monto mayor que cero</span>
          } @else {
            En pesos, sin puntos ni decimales
          }
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="comercio">Comercio</label>
        <input
          id="comercio"
          name="comercio"
          type="text"
          class="field-input"
          placeholder="Dónde fue el gasto"
          autocomplete="off"
          [(ngModel)]="comercio"
        />
      </div>

      <div class="flex flex-col gap-4 sm:flex-row">
        <div class="flex flex-1 flex-col gap-1.5">
          <label class="field-label" for="fecha">Fecha</label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            class="field-input"
            [(ngModel)]="fecha"
          />
        </div>

        <div class="flex flex-1 flex-col gap-1.5">
          <label class="field-label" for="tipo">Tipo</label>
          <select id="tipo" name="tipo" class="field-input" [(ngModel)]="tipo">
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
        </div>
      </div>

      <!-- El checkbox que hace que esta pantalla se use cada vez menos: lo que
           se aprende acá no vuelve a la bandeja (REQ-013). -->
      @if (comercio().trim()) {
        <label class="flex cursor-pointer items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="recordar"
            class="mt-0.5"
            [(ngModel)]="recordar"
          />
          <span>
            Recordar este comercio
            <span class="block text-text-muted">
              La próxima compra en {{ comercio().trim() }} se categoriza sola.
            </span>
          </span>
        </label>
      }

      <div class="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
        <button type="button" class="btn-ghost" [disabled]="guardando()" (click)="cancelar()">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" [disabled]="guardando() || !montoValido()">
          @if (guardando()) { Guardando… } @else { Crear movimiento }
        </button>
      </div>
    </form>
  `,
})
export class CompletarCapturaComponent implements OnInit {
  /** La captura a completar. Llega por el `inputs` del drawer. */
  readonly captura = input.required<Captura>();

  private readonly facade = inject(BandejaFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly monto = signal<number | null>(null);
  protected readonly comercio = signal('');
  protected readonly fecha = signal(hoy());
  protected readonly tipo = signal<'gasto' | 'ingreso'>('gasto');
  protected readonly recordar = signal(false);

  /** El campo no se marca en rojo hasta que el usuario lo tocó. */
  protected readonly tocado = signal(false);
  protected readonly guardando = signal(false);

  protected readonly montoValido = computed(() => {
    const m = this.monto();
    return m !== null && Number.isFinite(m) && m > 0;
  });

  /**
   * Prellena con lo que el parser sí entendió. Va en `ngOnInit` y no en el
   * constructor porque un `input.required` todavía no tiene valor ahí.
   */
  ngOnInit(): void {
    const i = this.captura().interpretado;
    if (i?.monto) this.monto.set(i.monto);
    if (i?.comercio) this.comercio.set(i.comercio);
    if (i?.fecha) this.fecha.set(i.fecha.slice(0, 10));
    else if (this.captura().fechaOrigen) this.fecha.set(this.captura().fechaOrigen!.slice(0, 10));
    if (i?.tipo === 'pago_recibido' || i?.tipo === 'abono') this.tipo.set('ingreso');
  }

  protected cancelar(): void {
    this.drawer.close();
  }

  protected async guardar(): Promise<void> {
    if (!this.montoValido() || this.guardando()) {
      this.tocado.set(true);
      return;
    }

    this.guardando.set(true);
    try {
      const comercio = this.comercio().trim() || null;
      const ok = await this.facade.resolver(this.captura().id, {
        monto: this.monto()!,
        comercio,
        categoriaId: null,
        cuentaId: null,
        fecha: this.fecha(),
        tipo: this.tipo(),
        recordarComercio: comercio ? this.recordar() : false,
      });
      // Si falló, el drawer se queda abierto con lo escrito: el toast ya explicó
      // qué pasó y volver a tipear todo sería el peor final posible.
      if (ok) this.drawer.close();
    } finally {
      this.guardando.set(false);
    }
  }
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
