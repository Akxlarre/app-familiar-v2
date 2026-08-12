import { Injectable, computed, inject, signal } from '@angular/core';

import { HogaresRepository } from '@core/repositories/hogares.repository';
import { mensajeSeguroDeBd } from '@core/utils/db-error.utils';
import {
  numeroDePaso,
  pasoActual,
  PASOS_DE_ONBOARDING,
  type EstadoDeOnboarding,
  type Hogar,
  type PasoDeOnboarding,
} from '@core/models/hogar.model';

/**
 * Mensajes que las RPCs del hogar levantan con `RAISE EXCEPTION` a propósito.
 * Están escritos para el usuario; sustituirlos por "error inesperado" pierde
 * información que le sirve. Deben coincidir textualmente con el SQL.
 */
const MENSAJES_DEL_RPC = [
  'Se requiere sesión iniciada',
  'El perfil ya pertenece a un hogar',
  'Código de invitación inválido',
] as const;

/**
 * OnboardingFacade — el camino del registro al primer movimiento.
 *
 * El paso actual **se deriva** del estado real en cada carga. No hay progreso
 * guardado, así que retomar donde se quedó (AC-E1) no es una funcionalidad:
 * es lo que pasa por no haber inventado una columna que se desincroniza.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingFacade {
  private readonly repo = inject(HogaresRepository);

  private readonly _estado = signal<EstadoDeOnboarding | null>(null);
  private readonly _hogar = signal<Hogar | null>(null);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _guardando = signal(false);

  readonly hogar = this._hogar.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly guardando = this._guardando.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Paso retenido: el derivado avanza en cuanto la base cambia, y hay pasos que
   * tienen algo que mostrar DESPUÉS de completarse.
   *
   * Al crear el hogar, el paso siguiente pasa a ser 'banco' de inmediato — y el
   * `invite_code`, que es lo único que el usuario necesita sacar de esta
   * pantalla, desaparecía sin que llegara a verlo. AC2 pide justo lo contrario.
   */
  private readonly _retenido = signal<PasoDeOnboarding | null>(null);

  readonly paso = computed<PasoDeOnboarding>(() => {
    const retenido = this._retenido();
    if (retenido) return retenido;
    const estado = this._estado();
    return estado ? pasoActual(estado) : 'hogar';
  });

  /** Si el paso actual ya está hecho y sólo queda que el usuario lo confirme. */
  readonly esperandoConfirmacion = computed(() => {
    const estado = this._estado();
    return this._retenido() !== null && estado !== null && pasoActual(estado) !== this._retenido();
  });

  /** El usuario vio lo que había que ver: seguir. */
  avanzar(): void {
    this._retenido.set(null);
  }

  readonly numero = computed(() => numeroDePaso(this.paso()));
  readonly total = PASOS_DE_ONBOARDING.length;

  async initialize(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);
    try {
      const estado = await this.repo.estadoDeOnboarding();
      this._estado.set(estado);
      if (estado.tieneHogar) this._hogar.set(await this.repo.miHogar());
    } catch (e) {
      this._error.set(mensajeSeguroDeBd(e, 'No se pudo cargar tu configuración.'));
    } finally {
      this._cargando.set(false);
    }
  }

  async crearHogar(nombre: string): Promise<boolean> {
    // Se retiene el paso para que el código de invitación se llegue a ver.
    this._retenido.set('hogar');
    return this.guardar(async () => {
      this._hogar.set(await this.repo.crear(nombre));
    }, 'No se pudo crear el hogar.');
  }

  async unirse(codigo: string): Promise<boolean> {
    this._retenido.set('hogar');
    return this.guardar(async () => {
      this._hogar.set(await this.repo.unirse(codigo.trim().toUpperCase()));
    }, 'No se pudo unir al hogar.');
  }

  /**
   * Envuelve una escritura y **relee el estado** al terminar.
   *
   * Releer y no asumir: el paso siguiente sale de lo que la base dice, no de lo
   * que la pantalla cree haber hecho.
   */
  private async guardar(accion: () => Promise<void>, fallback: string): Promise<boolean> {
    this._guardando.set(true);
    this._error.set(null);
    try {
      await accion();
      this._estado.set(await this.repo.estadoDeOnboarding());
      return true;
    } catch (e) {
      this._error.set(mensajeSeguroDeBd(e, fallback, MENSAJES_DEL_RPC));
      return false;
    } finally {
      this._guardando.set(false);
    }
  }
}
