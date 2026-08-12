import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '@shared/components/icon/icon.component';
import { OnboardingFacade } from './onboarding.facade';

/**
 * Paso 1 — Tu hogar.
 *
 * Dos caminos que se excluyen: crear uno nuevo o unirse al de la pareja. No hay
 * un tercero, y por eso no es un formulario con un desplegable: son dos botones
 * grandes y una decisión.
 *
 * Al crear, lo último que se ve es el código para compartir. Es el único dato
 * de esta pantalla que el usuario necesita sacar de la app.
 */
@Component({
  selector: 'app-paso-hogar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    @if (facade.hogar(); as hogar) {
      <!-- Ya hay hogar: lo que queda es pasarle el código a la pareja -->
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style="background: var(--color-primary-tint); color: var(--color-primary);"
          >
            <app-icon name="check" [size]="20" [ariaHidden]="true" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="item-title">{{ hogar.nombre }}</span>
            <span class="micro-label">Tu hogar está creado</span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="field-label">Código para tu pareja</span>
          <div class="flex items-center gap-2">
            <code
              class="flex-1 rounded-lg px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-text-primary"
              style="background: var(--bg-subtle);"
              data-llm-description="Household invite code"
            >{{ hogar.inviteCode }}</code>
            <button
              type="button"
              class="btn-secondary"
              (click)="copiar(hogar.inviteCode)"
              data-llm-action="copiar-codigo"
            >
              @if (copiado()) { Copiado } @else { Copiar }
            </button>
          </div>
          <span class="micro-label">
            Se dicta por WhatsApp. Quien lo use verá los mismos datos que tú.
          </span>
        </div>

        <button
          type="button"
          class="btn-primary"
          (click)="facade.avanzar()"
          data-llm-action="continuar-desde-hogar"
        >
          Continuar
        </button>
      </div>
    } @else {
      <div class="flex flex-col gap-5">
        <div class="flex gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="modo() === 'crear'"
            class="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
            [style.background]="modo() === 'crear' ? 'var(--color-primary-tint)' : 'transparent'"
            [style.border-color]="modo() === 'crear' ? 'var(--color-primary)' : 'var(--border-subtle)'"
            (click)="modo.set('crear')"
            data-llm-action="elegir-crear-hogar"
          >
            Crear un hogar
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="modo() === 'unirse'"
            class="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
            [style.background]="modo() === 'unirse' ? 'var(--color-primary-tint)' : 'transparent'"
            [style.border-color]="modo() === 'unirse' ? 'var(--color-primary)' : 'var(--border-subtle)'"
            (click)="modo.set('unirse')"
            data-llm-action="elegir-unirse-hogar"
          >
            Unirme con un código
          </button>
        </div>

        @if (modo() === 'crear') {
          <div class="flex flex-col gap-2">
            <label for="nombre-hogar" class="field-label">¿Cómo se llama tu casa?</label>
            <input
              id="nombre-hogar"
              type="text"
              class="field-input"
              placeholder="Casa Pérez"
              maxlength="40"
              [(ngModel)]="nombre"
              data-llm-description="Household display name"
            />
            <span class="micro-label">Sólo para reconocerla. Se puede cambiar después.</span>
          </div>
        } @else {
          <div class="flex flex-col gap-2">
            <label for="codigo" class="field-label">Código que te pasaron</label>
            <input
              id="codigo"
              type="text"
              class="field-input text-center font-mono text-xl tracking-[0.3em] uppercase"
              placeholder="ABC123"
              maxlength="6"
              [(ngModel)]="codigo"
              data-llm-description="Household invite code to join"
            />
            <span class="micro-label">Seis caracteres, sin vocales.</span>
          </div>
        }

        @if (facade.error(); as mensaje) {
          <p class="m-0 text-sm text-danger" role="alert">{{ mensaje }}</p>
        }

        <button
          type="button"
          class="btn-primary"
          [disabled]="!puedeContinuar() || facade.guardando()"
          (click)="continuar()"
          data-llm-action="confirmar-hogar"
        >
          @if (facade.guardando()) { Guardando… } @else { Continuar }
        </button>
      </div>
    }
  `,
})
export class PasoHogarComponent {
  protected readonly facade = inject(OnboardingFacade);

  protected readonly modo = signal<'crear' | 'unirse'>('crear');
  protected readonly nombre = signal('');
  protected readonly codigo = signal('');
  protected readonly copiado = signal(false);

  protected readonly puedeContinuar = computed(() =>
    this.modo() === 'crear' ? this.nombre().trim().length >= 2 : this.codigo().trim().length === 6,
  );

  protected async continuar(): Promise<void> {
    if (this.modo() === 'crear') await this.facade.crearHogar(this.nombre().trim());
    else await this.facade.unirse(this.codigo());
  }

  protected async copiar(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      // Sin permiso de portapapeles el código sigue visible y se puede copiar a
      // mano: no hay nada que reportar al usuario.
    }
  }
}
