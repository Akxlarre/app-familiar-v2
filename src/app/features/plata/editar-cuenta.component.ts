import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '@shared/components/icon/icon.component';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import { TIPOS_DE_CUENTA, type TipoDeCuenta } from '@core/models/banco.model';
import type { CuentaCompleta } from '@core/models/cuenta.model';
import { CuentasFacade } from './cuentas.facade';

/**
 * Alta y edición de una cuenta.
 *
 * **El tipo se elige primero y define qué campos siguen** (AC3). Un formulario
 * con cupo y fechas de facturación apagados para una cuenta de efectivo le pide
 * al usuario que ignore la mitad de lo que ve, y lo que se ignora se completa
 * mal.
 *
 * Al editar, el tipo no se cambia: cambiarlo dejaría un `detalle_credito`
 * huérfano o una tarjeta sin él, y ninguna de las dos cosas se arregla sola.
 */
@Component({
  selector: 'app-editar-cuenta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-5">
      @if (!cuenta()) {
        <div class="flex flex-col gap-2">
          <span class="field-label">¿Qué tipo de cuenta?</span>
          <div class="grid grid-cols-2 gap-2">
            @for (opcion of tipos; track opcion.valor) {
              <button
                type="button"
                class="rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
                [style.background]="tipo() === opcion.valor ? 'var(--color-primary-tint)' : 'transparent'"
                [style.border-color]="tipo() === opcion.valor ? 'var(--color-primary)' : 'var(--border-subtle)'"
                (click)="tipo.set(opcion.valor)"
                [attr.data-llm-action]="'elegir-tipo-' + opcion.valor"
              >
                {{ opcion.etiqueta }}
              </button>
            }
          </div>
        </div>
      }

      <div class="flex flex-col gap-2">
        <label for="c-nombre" class="field-label">¿Cómo la reconocés?</label>
        <input
          id="c-nombre"
          type="text"
          class="field-input"
          placeholder="Mi tarjeta principal"
          maxlength="40"
          [(ngModel)]="nombre"
          data-llm-description="Account display name"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="c-banco" class="field-label">Banco</label>
        <select id="c-banco" class="field-input" [(ngModel)]="banco">
          <option value="">Elegí el banco</option>
          @for (b of facade.bancos(); track b) {
            <option [value]="b">{{ b }}</option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label for="c-last4" class="field-label">
          Últimos 4 dígitos <span class="text-text-muted">(opcional)</span>
        </label>
        <input
          id="c-last4"
          type="text"
          inputmode="numeric"
          class="field-input font-mono tracking-widest"
          placeholder="1234"
          maxlength="4"
          [(ngModel)]="last4"
        />
      </div>

      <!-- Sólo crédito: para las demás estos campos no existen, no están apagados -->
      @if (tipo() === 'credito') {
        <div class="flex flex-col gap-4 rounded-lg p-4" style="background: var(--bg-subtle);">
          <span class="micro-label">Datos de la tarjeta</span>

          <div class="flex flex-col gap-2">
            <label for="c-cupo" class="field-label">Cupo total</label>
            <input
              id="c-cupo"
              type="number"
              inputmode="numeric"
              class="field-input"
              placeholder="800000"
              min="0"
              [(ngModel)]="cupo"
            />
            <span class="micro-label">
              En pesos, sin puntos. Si no lo sabés, se puede dejar vacío y completar después.
            </span>
          </div>

          <div class="flex gap-3">
            <div class="flex flex-1 flex-col gap-2">
              <label for="c-facturacion" class="field-label">Día de facturación</label>
              <input
                id="c-facturacion"
                type="number"
                class="field-input"
                min="1"
                max="31"
                [(ngModel)]="diaFacturacion"
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <label for="c-vencimiento" class="field-label">Día de vencimiento</label>
              <input
                id="c-vencimiento"
                type="number"
                class="field-input"
                min="1"
                max="31"
                [(ngModel)]="diaVencimiento"
              />
            </div>
          </div>
        </div>
      }

      <!-- Vincular al parser: lo que hace que los cargos entren solos -->
      @if (cuenta(); as existente) {
        @if (parsersDelBanco().length > 0) {
          <section class="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <h3 class="micro-label m-0">Correos que entran a esta cuenta</h3>
            @for (parser of parsersDelBanco(); track parser.id) {
              <label class="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-0.5"
                  [checked]="parser.cuentaId === existente.id"
                  (change)="alternarParser(parser.id, parser.cuentaId === existente.id)"
                  [attr.data-llm-action]="'vincular-parser-' + parser.tipo"
                />
                <span class="flex flex-col gap-0.5">
                  <span class="item-title">{{ parser.banco }} · {{ parser.tipo }}</span>
                  <span class="micro-label">
                    @if (parser.asuntoPatron; as patron) {
                      Correos cuyo asunto dice "{{ patron }}"
                    } @else {
                      Todos los correos de este banco
                    }
                    @if (parser.cuentaId && parser.cuentaId !== existente.id) {
                      · ya está en otra cuenta
                    }
                  </span>
                </span>
              </label>
            }
            <span class="micro-label">
              Es lo que distingue dos tarjetas del mismo banco: cada correo tiene su asunto.
            </span>
          </section>
        }
      }

      @if (error(); as mensaje) {
        <p class="m-0 text-sm text-danger" role="alert">{{ mensaje }}</p>
      }

      <button
        type="button"
        class="btn-primary"
        [disabled]="!puedeGuardar() || guardando()"
        (click)="guardar()"
        data-llm-action="guardar-cuenta"
      >
        @if (guardando()) { Guardando… } @else if (cuenta()) { Guardar } @else { Crear cuenta }
      </button>
    </div>
  `,
})
export class EditarCuentaComponent implements OnInit {
  /** Si viene, es edición; si no, alta. */
  readonly cuenta = input<CuentaCompleta | null>(null);

  protected readonly facade = inject(CuentasFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly tipos = TIPOS_DE_CUENTA;
  protected readonly tipo = signal<TipoDeCuenta>('credito');
  protected readonly nombre = signal('');
  protected readonly banco = signal('');
  protected readonly last4 = signal('');
  protected readonly cupo = signal<number | null>(null);
  protected readonly diaFacturacion = signal<number | null>(null);
  protected readonly diaVencimiento = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly parsersDelBanco = computed(() => this.facade.parsersDe(this.banco() || null));

  protected readonly puedeGuardar = computed(
    () => this.nombre().trim().length >= 2 && this.banco().length > 0,
  );

  ngOnInit(): void {
    void this.facade.cargarAuxiliares();

    const existente = this.cuenta();
    if (!existente) return;

    this.tipo.set(existente.tipo);
    this.nombre.set(existente.nombre);
    this.banco.set(existente.banco ?? '');
    this.last4.set(existente.last4 ?? '');
    this.cupo.set(existente.credito?.cupoTotal ?? null);
    this.diaFacturacion.set(existente.credito?.diaFacturacion ?? null);
    this.diaVencimiento.set(existente.credito?.diaVencimiento ?? null);
  }

  /** Cuatro dígitos o nada: tres son un dato a medias que no calza con el correo. */
  private digitos(): string | null {
    const limpio = this.last4().replace(/\D/g, '');
    return limpio.length === 4 ? limpio : null;
  }

  private detalleCredito() {
    if (this.tipo() !== 'credito') return null;
    return {
      cupoTotal: this.cupo() || null,
      diaFacturacion: this.diaFacturacion() || null,
      diaVencimiento: this.diaVencimiento() || null,
    };
  }

  protected async guardar(): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);

    const existente = this.cuenta();
    const fallo = existente
      ? await this.facade.editar(
          existente.id,
          { nombre: this.nombre().trim(), banco: this.banco(), last4: this.digitos() },
          this.detalleCredito(),
        )
      : await this.facade.crear(
          {
            nombre: this.nombre().trim(),
            tipo: this.tipo(),
            banco: this.banco(),
            last4: this.digitos(),
          },
          this.detalleCredito(),
        );

    this.guardando.set(false);
    if (fallo) this.error.set(fallo);
    else this.drawer.close();
  }

  protected async alternarParser(parserId: string, yaVinculado: boolean): Promise<void> {
    const destino = yaVinculado ? null : (this.cuenta()?.id ?? null);
    const fallo = await this.facade.vincular(parserId, destino);
    if (fallo) this.error.set(fallo);
  }
}
