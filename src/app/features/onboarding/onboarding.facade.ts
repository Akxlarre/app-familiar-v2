import { Injectable, computed, inject, signal } from '@angular/core';

import { BancosRepository } from '@core/repositories/bancos.repository';
import { HogaresRepository } from '@core/repositories/hogares.repository';
import { IntegracionesRepository } from '@core/repositories/integraciones.repository';
import type { BancoDelCatalogo, NuevaCuenta } from '@core/models/banco.model';
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
 * Lo que devuelve `gmail-oauth`, traducido.
 *
 * Sus mensajes están escritos para quien opera el sistema —nombran variables de
 * entorno y parámetros de OAuth— así que no se muestran tal cual: acá se
 * convierten en algo que le diga al usuario si esto lo puede resolver él o no.
 * La clave es un fragmento del mensaje del servidor, no el mensaje entero.
 */
const MENSAJES_DE_GMAIL: ReadonlyArray<readonly [string, string]> = [
  [
    'Gmail sin configurar',
    'La conexión con Google todavía no está configurada en el servidor. No es algo que puedas resolver desde acá.',
  ],
  [
    'refresh_token',
    'Google no entregó el permiso permanente. Volvé a intentarlo y aceptá el acceso cuando te lo pida.',
  ],
  [
    'no pertenece a un hogar',
    'Todavía no tenés un hogar. Volvé al primer paso y creá uno.',
  ],
  [
    'dirección de la casilla',
    'Se conectó con Google pero no se pudo leer tu dirección de correo. Intentá de nuevo.',
  ],
  // Los dos rechazos de Google que NO se arreglan reintentando. Sin
  // distinguirlos, un "intentá de nuevo" manda a reintentar para siempre algo
  // que ninguna cantidad de reintentos va a cambiar.
  [
    'redirect_uri_mismatch',
    'La dirección de retorno no coincide con la autorizada en Google. Hay que corregirla en la configuración del proyecto.',
  ],
  [
    'invalid_client',
    'Las credenciales de Google del servidor no son válidas. No es algo que puedas resolver desde acá.',
  ],
  // Éste sí: el código de Google dura minutos y se usa una sola vez.
  [
    'invalid_grant',
    'El permiso de Google venció antes de usarse. Volvé a intentarlo.',
  ],
];

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
  private readonly bancos = inject(BancosRepository);
  private readonly integraciones = inject(IntegracionesRepository);

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

  private readonly _catalogo = signal<readonly BancoDelCatalogo[]>([]);
  readonly catalogo = this._catalogo.asReadonly();
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

  /** El catálogo se pide una sola vez: es una lista corta que no cambia por sesión. */
  async cargarCatalogo(): Promise<void> {
    if (this._catalogo().length > 0) return;
    try {
      this._catalogo.set(await this.bancos.catalogo());
    } catch (e) {
      this._error.set(mensajeSeguroDeBd(e, 'No se pudo cargar la lista de bancos.'));
    }
  }

  /**
   * Crea la primera cuenta y le engancha los parsers de su banco.
   *
   * No retiene el paso: acá no hay nada que el usuario necesite copiar, y
   * quedarse mirando una confirmación alarga el camino al primer movimiento.
   */
  async crearPrimeraCuenta(cuenta: NuevaCuenta): Promise<boolean> {
    const hogar = this._hogar();
    if (!hogar) {
      this._error.set('Primero hay que crear el hogar.');
      return false;
    }
    return this.guardar(async () => {
      await this.bancos.crearCuentaConParsers(hogar.id, cuenta);
    }, 'No se pudo crear la cuenta.');
  }

  /**
   * Canjea el código del consentimiento y deja la casilla conectada.
   *
   * Devuelve el mensaje del fallo en vez de ponerlo en `_error`: ese lo pinta el
   * contenedor como pantalla completa con un botón de recargar, y acá recargar
   * no sirve —el código de Google se usa una sola vez—. Lo que el usuario
   * necesita es volver a pedir el consentimiento, que es el botón del paso.
   *
   * @returns `null` si quedó conectada; el mensaje a mostrar si falló.
   */
  async conectarCorreo(code: string, redirectUri: string): Promise<string | null> {
    this._guardando.set(true);
    try {
      await this.integraciones.conectarGmail(code, redirectUri);
      // Releer y no asumir: el paso siguiente sale de lo que la base dice.
      this._estado.set(await this.repo.estadoDeOnboarding());
      return null;
    } catch (e) {
      const crudo = e instanceof Error ? e.message : '';
      const conocido = MENSAJES_DE_GMAIL.find(([fragmento]) => crudo.includes(fragmento));
      if (conocido) return conocido[1];
      return mensajeSeguroDeBd(e, 'No se pudo conectar tu correo. Intentá de nuevo.');
    } finally {
      this._guardando.set(false);
    }
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
