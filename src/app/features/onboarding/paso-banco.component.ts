import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TIPOS_DE_CUENTA, type TipoDeCuenta } from '@core/models/banco.model';
import { OnboardingFacade } from './onboarding.facade';

/**
 * Paso 2 — Tu banco y tu primera cuenta.
 *
 * Es el paso que el usuario **no sabe que necesita**, así que se explica en una
 * línea antes de pedir nada: sin cuenta, las capturas del correo llegan y
 * quedan atascadas con "el parser no tiene cuenta asociada" (AC13).
 *
 * Elegir el banco de la lista copia sus patrones al hogar. El usuario nunca ve
 * un regex: escribirlos es mantenimiento, no onboarding (AC14).
 */
@Component({
  selector: 'app-paso-banco',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col gap-5">
      <p class="m-0 rounded-lg px-4 py-3 text-sm text-text-secondary" style="background: var(--bg-subtle);">
        Para saber a qué tarjeta corresponde cada cargo. Con esto, los correos de tu banco se
        convierten en movimientos solos.
      </p>

      <div class="flex flex-col gap-2">
        <label for="banco" class="field-label">¿Con qué banco?</label>
        <select
          id="banco"
          class="field-input"
          [(ngModel)]="banco"
          data-llm-description="Bank whose email parsers will be copied"
        >
          <option value="">Elegí tu banco</option>
          @for (opcion of facade.catalogo(); track opcion.banco) {
            <option [value]="opcion.banco">{{ opcion.banco }}</option>
          }
        </select>
        @if (facade.catalogo().length === 0) {
          <span class="micro-label">Cargando bancos…</span>
        }
      </div>

      <div class="flex flex-col gap-2">
        <label for="tipo-cuenta" class="field-label">¿Qué tipo de cuenta?</label>
        <select id="tipo-cuenta" class="field-input" [(ngModel)]="tipo">
          @for (opcion of tipos; track opcion.valor) {
            <option [value]="opcion.valor">{{ opcion.etiqueta }}</option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label for="nombre-cuenta" class="field-label">¿Cómo la reconocés?</label>
        <input
          id="nombre-cuenta"
          type="text"
          class="field-input"
          placeholder="Mi tarjeta principal"
          maxlength="40"
          [(ngModel)]="nombre"
          data-llm-description="Account display name"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="last4" class="field-label">Últimos 4 dígitos <span class="text-text-muted">(opcional)</span></label>
        <input
          id="last4"
          type="text"
          inputmode="numeric"
          class="field-input font-mono tracking-widest"
          placeholder="1234"
          maxlength="4"
          [(ngModel)]="last4"
          data-llm-description="Last four digits of the card"
        />
        <span class="micro-label">
          Es lo que aparece en los correos del banco. Ayuda a distinguir dos tarjetas del mismo banco.
        </span>
      </div>

      @if (facade.error(); as mensaje) {
        <p class="m-0 text-sm text-danger" role="alert">{{ mensaje }}</p>
      }

      <button
        type="button"
        class="btn-primary"
        [disabled]="!puedeContinuar() || facade.guardando()"
        (click)="continuar()"
        data-llm-action="crear-primera-cuenta"
      >
        @if (facade.guardando()) { Guardando… } @else { Continuar }
      </button>
    </div>
  `,
})
export class PasoBancoComponent implements OnInit {
  protected readonly facade = inject(OnboardingFacade);
  protected readonly tipos = TIPOS_DE_CUENTA;

  protected readonly banco = signal('');
  protected readonly tipo = signal<TipoDeCuenta>('credito');
  protected readonly nombre = signal('');
  protected readonly last4 = signal('');

  // El `last4` es opcional, así que no entra: exigirlo aquí sería un campo más
  // entre el usuario y su primer movimiento.
  protected readonly puedeContinuar = computed(
    () => this.banco().length > 0 && this.nombre().trim().length >= 2,
  );

  ngOnInit(): void {
    void this.facade.cargarCatalogo();
  }

  protected async continuar(): Promise<void> {
    const digitos = this.last4().replace(/\D/g, '');
    await this.facade.crearPrimeraCuenta({
      nombre: this.nombre().trim(),
      tipo: this.tipo(),
      banco: this.banco(),
      // Cuatro dígitos o nada: tres serían un dato a medias que después no calza
      // con lo que dice el correo.
      last4: digitos.length === 4 ? digitos : null,
    });
  }
}
