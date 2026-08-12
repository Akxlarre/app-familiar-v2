import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { OnboardingFacade } from './onboarding.facade';
import { PasoBancoComponent } from './paso-banco.component';
import { PasoCorreoComponent } from './paso-correo.component';
import { PasoListoComponent } from './paso-listo.component';
import { PasoHogarComponent } from './paso-hogar.component';

/**
 * OnboardingComponent — los cuatro pasos hasta el primer movimiento.
 *
 * Vive **fuera** del shell, no como hija de `/app`. AC1 pide que el usuario no
 * pueda llegar a ninguna otra pantalla hasta elegir, y la forma de garantizarlo
 * es que la navegación no exista — no esconderla con CSS.
 *
 * Por eso también es la **tercera excepción** a la regla de que los formularios
 * viven en drawers (`screen-contract.md`): acá no hay shell donde montar uno.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ErrorStateComponent,
    SkeletonBlockComponent,
    PasoHogarComponent,
    PasoBancoComponent,
    PasoCorreoComponent,
    PasoListoComponent,
  ],
  template: `
    <div class="flex min-h-[100dvh] items-center justify-center bg-canvas p-4">
      <div class="w-full max-w-[520px] rounded-xl border border-border-subtle bg-surface p-8 shadow-lg">
        <header class="mb-6 flex flex-col gap-2">
          <span class="micro-label">Paso {{ facade.numero() }} de {{ facade.total }}</span>
          <h1 class="m-0 font-display text-2xl font-bold text-text-primary">{{ titulo() }}</h1>
          <p class="m-0 text-sm text-text-secondary">{{ bajada() }}</p>

          <!-- El progreso se ve, no se cuenta: cuatro barras dicen cuánto falta
               de un vistazo, que es lo que hace que alguien termine. -->
          <div class="mt-2 flex gap-1.5" aria-hidden="true">
            @for (i of [1, 2, 3, 4]; track i) {
              <span
                class="h-1 flex-1 rounded-full transition-colors"
                [style.background]="i <= facade.numero() ? 'var(--color-primary)' : 'var(--border-subtle)'"
              ></span>
            }
          </div>
        </header>

        @if (facade.cargando()) {
          <app-skeleton-block height="12rem" />
        } @else if (facade.error(); as mensaje) {
          <app-error-state [message]="mensaje" (retry)="recargar()" />
        } @else {
          @switch (facade.paso()) {
            @case ('hogar') { <app-paso-hogar /> }
            @case ('banco') { <app-paso-banco /> }
            @case ('correo') { <app-paso-correo /> }
            @default { <app-paso-listo /> }
          }
        }
      </div>
    </div>
  `,
})
export class OnboardingComponent implements OnInit {
  protected readonly facade = inject(OnboardingFacade);

  private static readonly TITULOS: Record<string, [string, string]> = {
    hogar: ['Tu hogar', 'Creá uno nuevo o unite al de tu pareja con un código.'],
    banco: ['Tu banco', 'Para saber a qué tarjeta corresponde cada cargo.'],
    correo: ['Tu correo', 'Es de donde salen los movimientos, sin que escribas nada.'],
    listo: ['Listo', 'Esto es lo que encontramos en tu correo.'],
  };

  protected titulo(): string {
    return OnboardingComponent.TITULOS[this.facade.paso()][0];
  }

  protected bajada(): string {
    return OnboardingComponent.TITULOS[this.facade.paso()][1];
  }

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected recargar(): void {
    void this.facade.initialize();
  }
}
