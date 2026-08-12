import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { nombreDeCarpeta } from '@core/models/integracion.model';
import { OnboardingFacade } from './onboarding.facade';

/**
 * Paso 4 — Listo.
 *
 * Es la única prueba que el usuario tiene de que todo lo anterior sirvió para
 * algo. Por eso muestra movimientos con nombre y monto (AC11) y no un "listo"
 * con un tilde: lo segundo se puede escribir sin que nada funcione.
 *
 * **Es efímero por diseño.** `onboardingGuard` manda a Hoy exactamente cuando el
 * onboarding queda completo, así que esta pantalla sólo existe en la sesión en
 * que la corrida ocurrió. Es coherente con no persistir progreso: un resumen de
 * "lo que encontramos" mostrado una semana después no describe nada, y esos
 * datos viven en Hoy y en Plata, que sí son permanentes. Decisión cerrada en la
 * spec 0004.
 */
@Component({
  selector: 'app-paso-listo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col gap-5">
      @if (facade.corriendo()) {
        <div class="flex flex-col gap-3">
          <app-skeleton-block height="8rem" />
          <span class="micro-label">Buscando en tu correo…</span>
        </div>
      } @else if (facade.errorDeCorrida(); as mensaje) {
        <div class="flex flex-col gap-2 rounded-lg p-4" style="background: var(--state-warning-bg);" role="alert">
          <span class="item-title">{{ mensaje }}</span>
          <span class="micro-label">
            Tu correo quedó conectado igual. Se puede reintentar, y el cron lo va a hacer solo más
            tarde.
          </span>
        </div>
        <button type="button" class="btn-primary" (click)="reintentar()" data-llm-action="reintentar-corrida">
          Buscar de nuevo
        </button>
        <a routerLink="/app/hoy" class="btn-ghost text-center" data-llm-action="ir-a-hoy">Seguir sin esperar</a>
      } @else if (facade.corridaVacia()) {
        <!-- AC12: un vacío después de haber mirado no es lo mismo que un vacío
             antes de mirar, y decirle "listo" a quien no recibió nada lo deja
             sin saber si la app funciona o si su banco no está soportado. -->
        <div class="flex flex-col gap-3 rounded-lg p-4" style="background: var(--bg-subtle);">
          <div class="flex items-center gap-2">
            <app-icon name="search" [size]="18" [ariaHidden]="true" />
            <span class="item-title">No encontramos correos de tu banco todavía</span>
          </div>
          <p class="m-0 text-sm text-text-secondary">
            Buscamos en <strong>{{ carpeta() }}</strong>
            @if (facade.corrida()?.diasBuscados; as dias) { de los últimos <strong>{{ dias }} días</strong> }
            los correos de <strong>{{ banco() }}</strong>.
          </p>
        </div>

        <div class="flex flex-col gap-2 rounded-lg p-4" style="background: var(--bg-subtle);">
          <span class="micro-label">Qué se puede hacer</span>
          <ul class="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-text-secondary">
            <li>Si tus avisos llegan a otra etiqueta, cambiala en el paso anterior.</li>
            <li>Si tu banco no manda correos por cada compra, hay que activarlos desde su app.</li>
            <li>Si acaba de llegar uno, probá buscar de nuevo.</li>
          </ul>
        </div>

        <button type="button" class="btn-primary" (click)="reintentar()" data-llm-action="reintentar-corrida">
          Buscar de nuevo
        </button>
        <a routerLink="/app/hoy" class="btn-ghost text-center" data-llm-action="ir-a-hoy">Entrar igual</a>
      } @else {
        <div class="flex flex-col gap-3 rounded-lg p-4" style="background: var(--state-success-bg);">
          <div class="flex items-center gap-2">
            <app-icon name="check-circle" [size]="18" [ariaHidden]="true" />
            <span class="item-title">{{ titulo() }}</span>
          </div>
          @if (facade.pendientes() > 0) {
            <span class="micro-label">
              {{ facade.pendientes() }}
              @if (facade.pendientes() === 1) { correo necesita } @else { correos necesitan }
              que confirmes algo. Está en la bandeja, sin apuro.
            </span>
          }
        </div>

        @if (facade.encontrados().length > 0) {
          <div class="flex flex-col gap-1">
            <span class="micro-label">Lo que ya entró</span>
            @for (mov of facade.encontrados(); track mov.id) {
              <div class="flex items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-0">
                <span class="item-title truncate">{{ mov.comercio ?? 'Sin comercio' }}</span>
                <span
                  class="row-value shrink-0"
                  [class.text-success]="mov.tipo === 'ingreso'"
                >{{ mov.tipo === 'gasto' ? '−' : '' }}\${{ mov.monto | number: '1.0-0' }}</span>
              </div>
            }
          </div>
        }

        <a routerLink="/app/hoy" class="btn-primary text-center" data-llm-action="ir-a-hoy">
          Empezar a usar la app
        </a>
      }
    </div>
  `,
})
export class PasoListoComponent implements OnInit {
  protected readonly facade = inject(OnboardingFacade);

  ngOnInit(): void {
    // La corrida se dispara sola: pedirle un botón al usuario para que empiece a
    // funcionar lo que acaba de autorizar es hacerle repetir el permiso que ya dio.
    void this.facade.correrPrimeraVez();
  }

  protected reintentar(): void {
    void this.facade.reintentarCorrida();
  }

  /** Qué se buscó, para AC12. Sale de la integración real, no de un texto fijo. */
  protected carpeta(): string {
    const carpeta = this.facade.integracion()?.carpeta ?? 'INBOX';
    return nombreDeCarpeta(carpeta);
  }

  protected banco(): string {
    const bancos = this.facade.bancosConfigurados();
    return bancos.length > 0 ? bancos.join(', ') : 'tu banco';
  }

  protected titulo(): string {
    const movimientos = this.facade.corrida()?.movimientos ?? 0;
    if (movimientos === 0) return 'Ya estamos leyendo tu correo';
    return movimientos === 1
      ? 'Encontramos 1 movimiento en tu correo'
      : `Encontramos ${movimientos} movimientos en tu correo`;
  }
}
