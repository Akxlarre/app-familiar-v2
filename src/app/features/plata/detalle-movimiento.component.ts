import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { LayoutDrawerFacadeService } from '@core/services/layout-drawer.facade.service';
import type { Movimiento } from '@core/models/movimiento.model';
import type { Categoria, OrigenDelMovimiento } from '@core/models/plata.model';
import { PlataFacade } from './plata.facade';

/**
 * Detalle de un movimiento: de dónde salió y cómo corregirlo.
 *
 * Es la pantalla que hace que la app **mejore con el uso**. Corregir una
 * categoría arregla una fila; marcar "recordar" arregla todas las futuras de
 * ese comercio (REQ-013, RN-10), y es lo que hace que la bandeja se vacíe sola
 * con el tiempo.
 *
 * Aplicar el cambio a los movimientos pasados se **ofrece con el número a la
 * vista**, nunca se hace solo: reescribir historial en silencio es exactamente
 * lo que R-04 prohíbe.
 */
@Component({
  selector: 'app-detalle-movimiento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col gap-5">
      <!-- Lo que dijo el banco. No se edita: corregir la categoría sí,
           reescribir el monto o la fecha no. -->
      <div class="flex flex-col gap-1">
        <span class="micro-label">{{ movimiento().tipo === 'ingreso' ? 'Ingreso' : 'Gasto' }}</span>
        <span class="kpi-value" [class.text-success]="movimiento().tipo === 'ingreso'">
          {{ movimiento().tipo === 'ingreso' ? '+$' : '−$'
          }}{{ movimiento().monto | number: '1.0-0' }}
        </span>
        <span class="item-title">{{ movimiento().comercio ?? 'Sin comercio' }}</span>
        <span class="micro-label">{{ movimiento().fecha | date: 'EEEE d \\'de\\' MMMM \\'de\\' y' }}</span>
      </div>

      <!-- Categoría: lo único editable -->
      <div class="flex flex-col gap-2">
        <label for="categoria" class="field-label">Categoría</label>
        <select
          id="categoria"
          class="field-input"
          [(ngModel)]="categoriaElegida"
          (ngModelChange)="alCambiarCategoria()"
          data-llm-description="Expense category for this movement"
        >
          <option value="">Sin categorizar</option>
          @for (cat of categorias(); track cat.id) {
            <option [value]="cat.id">{{ cat.nombre }}</option>
          }
        </select>
      </div>

      @if (cambioPendiente()) {
        <div class="flex flex-col gap-3 rounded-lg p-4" style="background: var(--bg-subtle);">
          <label class="flex cursor-pointer items-start gap-3">
            <input type="checkbox" [(ngModel)]="recordar" (ngModelChange)="alMarcarRecordar()" class="mt-0.5" />
            <span class="flex flex-col gap-0.5">
              <span class="item-title">Recordar este comercio</span>
              <span class="micro-label">
                Los próximos de {{ movimiento().comercio }} se categorizan solos.
              </span>
            </span>
          </label>

          <!-- El conteo a la vista: el usuario decide sabiendo cuánto cambia -->
          @if (recordar() && pasados() > 0) {
            <label class="flex cursor-pointer items-start gap-3">
              <input type="checkbox" [(ngModel)]="aplicarPasados" class="mt-0.5" />
              <span class="flex flex-col gap-0.5">
                <span class="item-title">
                  Aplicar también a los {{ pasados() }} anteriores
                </span>
                <span class="micro-label">
                  Cambia movimientos que ya están registrados. Podés dejarlo sin marcar.
                </span>
              </span>
            </label>
          }

          @if (error(); as mensaje) {
            <p class="m-0 text-sm text-danger" role="alert">{{ mensaje }}</p>
          }

          <button
            type="button"
            class="btn-primary"
            [disabled]="guardando()"
            (click)="guardar()"
            data-llm-action="guardar-categoria"
          >
            @if (guardando()) { Guardando… } @else { Guardar }
          </button>
        </div>
      }

      <!-- De dónde salió: lo que permite confiar en un dato que nadie escribió -->
      <section class="flex flex-col gap-2">
        <h3 class="micro-label m-0">De dónde salió</h3>

        @if (cargandoOrigen()) {
          <app-skeleton-block height="5rem" />
        } @else if (origen(); as o) {
          <div class="flex flex-col gap-2 rounded-lg p-4" style="background: var(--bg-subtle);">
            <div class="flex items-center gap-2">
              <app-icon name="mail" [size]="14" [ariaHidden]="true" />
              <span class="micro-label truncate">{{ o.remitente ?? 'Remitente desconocido' }}</span>
            </div>
            @if (o.asunto; as asunto) {
              <span class="item-title">{{ asunto }}</span>
            }
            @if (o.extracto; as extracto) {
              <p class="m-0 font-mono text-xs text-text-secondary">{{ extracto }}</p>
            }
            <span class="micro-label">Capturado el {{ o.fechaCaptura | date: 'd MMM y, HH:mm' }}</span>
          </div>
        } @else {
          <p class="m-0 text-sm text-text-muted">
            Este movimiento se cargó a mano: no tiene un correo de origen.
          </p>
        }
      </section>

      <!-- Borrar: la captura vuelve a la bandeja, no se pierde -->
      <section class="flex flex-col gap-2 border-t border-border-subtle pt-4">
        @if (!confirmandoBorrado()) {
          <button
            type="button"
            class="btn-ghost self-start text-danger"
            (click)="confirmandoBorrado.set(true)"
            data-llm-action="pedir-borrar-movimiento"
          >
            Borrar este movimiento
          </button>
        } @else {
          <div class="flex flex-col gap-3">
            <p class="m-0 text-sm text-text-secondary">
              @if (movimiento().capturaId) {
                El correo vuelve a la bandeja para revisarlo de nuevo. No se pierde.
              } @else {
                Se cargó a mano, así que no hay correo al que volver.
              }
            </p>
            <div class="flex gap-2">
              <button type="button" class="btn-ghost" (click)="confirmandoBorrado.set(false)">
                Cancelar
              </button>
              <button
                type="button"
                class="btn-primary"
                [disabled]="guardando()"
                (click)="borrar()"
                data-llm-action="confirmar-borrar-movimiento"
              >
                Borrar
              </button>
            </div>
          </div>
        }
      </section>
    </div>
  `,
})
export class DetalleMovimientoComponent implements OnInit {
  /** El movimiento a mostrar. Llega por los `inputs` del drawer (spec 0002). */
  readonly movimiento = input.required<Movimiento>();
  readonly categorias = input.required<readonly Categoria[]>();
  private readonly facade = inject(PlataFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly categoriaElegida = signal('');
  protected readonly recordar = signal(false);
  protected readonly aplicarPasados = signal(false);
  protected readonly pasados = signal(0);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmandoBorrado = signal(false);

  protected readonly origen = signal<OrigenDelMovimiento | null>(null);
  protected readonly cargandoOrigen = signal(false);

  private categoriaOriginal = '';

  /** Sólo se ofrece guardar si algo cambió. */
  protected readonly cambioPendiente = computed(
    () => this.categoriaElegida() !== this.categoriaOriginal,
  );

  ngOnInit(): void {
    const capturaId = this.movimiento().capturaId;
    if (capturaId) void this.cargarOrigen(capturaId);
  }

  private async cargarOrigen(capturaId: string): Promise<void> {
    this.cargandoOrigen.set(true);
    try {
      this.origen.set(await this.facade.origenDe(capturaId));
    } finally {
      this.cargandoOrigen.set(false);
    }
  }

  protected alCambiarCategoria(): void {
    this.error.set(null);
    // Cambiar de categoría invalida el conteo anterior: es de otra categoría.
    this.aplicarPasados.set(false);
    this.pasados.set(0);
    if (this.recordar()) void this.contarPasados();
  }

  protected alMarcarRecordar(): void {
    if (this.recordar()) void this.contarPasados();
    else {
      this.aplicarPasados.set(false);
      this.pasados.set(0);
    }
  }

  private async contarPasados(): Promise<void> {
    const categoria = this.categoriaElegida();
    if (!categoria) return;
    this.pasados.set(await this.facade.contarMismoComercio(this.movimiento().id, categoria));
  }

  protected async guardar(): Promise<void> {
    const categoria = this.categoriaElegida();
    if (!categoria) {
      this.error.set('Hay que elegir una categoría');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    const fallo = await this.facade.recategorizar(
      this.movimiento().id, categoria, this.recordar(), this.aplicarPasados(),
    );
    this.guardando.set(false);

    if (fallo) this.error.set(fallo);
    else this.drawer.close();
  }

  protected async borrar(): Promise<void> {
    this.guardando.set(true);
    const fallo = await this.facade.borrar(this.movimiento().id);
    this.guardando.set(false);

    if (fallo) {
      this.error.set(fallo);
      this.confirmandoBorrado.set(false);
    } else {
      this.drawer.close();
    }
  }
}
