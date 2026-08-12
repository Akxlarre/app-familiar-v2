import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { environment } from '../../../environments/environment';
import { OnboardingFacade } from './onboarding.facade';
import { leerRespuestaDeGoogle, nuevoState, urlDeConsentimiento } from './consentimiento-google.utils';

/** Dónde se guarda el `state` mientras el usuario está en Google. */
const CLAVE_STATE = 'onboarding.google.state';

/**
 * Paso 3 — Tu correo.
 *
 * Es el paso que hace que todo lo demás sea automático: sin él la app está
 * vacía, y por eso el onboarding no deja seguir sin conectarlo (decisión de la
 * spec 0004, revisable cuando exista la boleta del hito 2).
 *
 * El consentimiento **sale de la app**: el usuario va a Google y vuelve. Por
 * eso el `state` se guarda en `sessionStorage` — al volver, la aplicación se
 * reconstruye desde cero y no queda nada en memoria que comparar.
 */
@Component({
  selector: 'app-paso-correo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col gap-5">
      @if (canjeando()) {
        <div class="flex flex-col gap-3">
          <app-skeleton-block height="4rem" />
          <span class="micro-label">Conectando tu correo…</span>
        </div>
      } @else {
        <div class="flex flex-col gap-3 rounded-lg p-4" style="background: var(--bg-subtle);">
          <div class="flex items-center gap-2">
            <app-icon name="mail" [size]="18" [ariaHidden]="true" />
            <span class="item-title">Sólo lectura</span>
          </div>
          <p class="m-0 text-sm text-text-secondary">
            La app lee los correos que te manda tu banco para convertirlos en movimientos.
            No puede enviar, responder ni borrar nada.
          </p>
        </div>

        @if (error(); as mensaje) {
          <!-- role=alert porque el error aparece al VOLVER de Google, sin que el
               usuario haya tocado nada en esta pantalla: sin anunciarlo, quien
               usa lector de pantalla vuelve a un paso que parece intacto. -->
          <div
            class="flex flex-col gap-2 rounded-lg p-4"
            style="background: var(--state-warning-bg);"
            role="alert"
          >
            <span class="item-title">{{ mensaje }}</span>
            <span class="micro-label">Tu hogar y tu cuenta ya están guardados: no se pierde nada.</span>
          </div>
        }

        @if (!configurado()) {
          <div class="flex flex-col gap-2 rounded-lg p-4" style="background: var(--state-warning-bg);">
            <span class="item-title">Falta configurar el acceso a Google</span>
            <span class="micro-label">
              El proyecto todavía no tiene su client ID. Es cosa de una vez, y va en
              <code>environment.ts</code>.
            </span>
          </div>
        }

        <button
          type="button"
          class="btn-primary"
          [disabled]="!configurado()"
          (click)="conectar()"
          data-llm-action="conectar-correo"
        >
          Conectar mi correo
        </button>

        <span class="micro-label">
          Te va a llevar a Google y volver acá. Podés cancelar y seguir después.
        </span>
      }
    </div>
  `,
})
export class PasoCorreoComponent implements OnInit {
  protected readonly facade = inject(OnboardingFacade);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly canjeando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly configurado = computed(() => environment.google.clientId.length > 0);

  /**
   * Tiene que coincidir **carácter por carácter** con el URI autorizado en la
   * consola de Google, así que se arma del origen real y no de una constante
   * que se olvida al cambiar de puerto.
   */
  private redirectUri(): string {
    return `${window.location.origin}/onboarding`;
  }

  ngOnInit(): void {
    const params = this.ruta.snapshot.queryParamMap;
    const respuesta = leerRespuestaDeGoogle(
      new URLSearchParams(params.keys.map((k) => [k, params.get(k) ?? '']) as [string, string][]),
    );

    if (respuesta.error) {
      // AC-E4: cancelar se explica y se puede reintentar, con el hogar ya creado.
      this.error.set(
        respuesta.error === 'access_denied'
          ? 'No se completó el permiso en Google. Podés intentarlo de nuevo.'
          : 'Google devolvió un error al pedir el permiso.',
      );
      this.limpiarUrl();
      return;
    }

    if (respuesta.code) void this.canjear(respuesta.code, respuesta.state);
  }

  /**
   * Saca `code` y `state` de la barra de direcciones.
   *
   * El código de autorización se canjea una sola vez, así que dejarlo en la URL
   * no habilita nada — pero queda en el historial, en el título de la pestaña y
   * en cualquier captura de pantalla que el usuario mande pidiendo ayuda. Es
   * gratis no dejarlo ahí.
   *
   * `replaceUrl` para que el botón "atrás" no vuelva a la URL con el código.
   */
  private limpiarUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {},
      replaceUrl: true,
    });
  }

  protected conectar(): void {
    const state = nuevoState();
    sessionStorage.setItem(CLAVE_STATE, state);
    window.location.href = urlDeConsentimiento({
      clientId: environment.google.clientId,
      redirectUri: this.redirectUri(),
      state,
    });
  }

  private async canjear(code: string, state: string | null): Promise<void> {
    const esperado = sessionStorage.getItem(CLAVE_STATE);
    sessionStorage.removeItem(CLAVE_STATE);

    // Si el `state` no coincide, la vuelta no salió de acá: no se canjea.
    if (!state || state !== esperado) {
      this.error.set('La respuesta de Google no corresponde a esta sesión. Intentá de nuevo.');
      this.limpiarUrl();
      return;
    }

    this.canjeando.set(true);
    const fallo = await this.facade.conectarCorreo(code, this.redirectUri());
    this.canjeando.set(false);
    this.limpiarUrl();
    if (fallo) this.error.set(fallo);
  }
}
