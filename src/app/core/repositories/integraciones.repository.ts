import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';
import type { IntegracionEmail, ResultadoDeCorrida } from '@core/models/integracion.model';

/**
 * IntegracionesRepository — la casilla de correo conectada.
 *
 * El canje del código va por edge function y no por RPC porque necesita el
 * `client_secret` de Google, que no puede vivir en el cliente: cualquiera que
 * abra las devtools lo tendría. La función corre en el servidor, canjea, y lo
 * único que vuelve es la dirección conectada.
 *
 * Por eso mismo el cliente nunca ve `refresh_token`: se lee `mis_integraciones_email`,
 * que expone `conectada` (columna generada) en vez del token.
 */
@Injectable({ providedIn: 'root' })
export class IntegracionesRepository {
  private client = inject(SupabaseService).db;

  /**
   * Canjea el código del consentimiento por tokens y guarda la integración.
   *
   * El `redirectUri` viaja de nuevo porque Google lo exige idéntico al que se
   * usó para pedir el consentimiento: es su forma de comprobar que quien canjea
   * es quien pidió.
   *
   * @returns La dirección de la casilla que quedó conectada.
   */
  async conectarGmail(code: string, redirectUri: string): Promise<string> {
    const { data, error } = await this.client.functions.invoke('gmail-oauth', {
      body: { code, redirect_uri: redirectUri },
    });

    if (error) throw new ErrorDeBd(await mensajeDeLaFuncion(error));

    const r = (data ?? {}) as { ok?: boolean; email?: string };
    if (!r.ok || !r.email) throw new ErrorDeBd('La función no confirmó la conexión');
    return r.email;
  }

  /**
   * Dispara la primera corrida sin esperar al cron (AC10).
   *
   * El hogar NO viaja en el pedido: lo resuelve la función desde el JWT. Si
   * saliera de acá, cualquiera podría disparar la corrida de otro hogar.
   */
  async primeraCorrida(): Promise<ResultadoDeCorrida> {
    const { data, error } = await this.client.functions.invoke('procesar-ahora', { body: {} });

    if (error) throw new ErrorDeBd(await mensajeDeLaFuncion(error));

    const r = (data ?? {}) as {
      capturadas?: number;
      movimientos?: number;
      motivo?: string | null;
      buscado?: { diasAtras?: number; maximo?: number };
    };
    return {
      capturadas: r.capturadas ?? 0,
      movimientos: r.movimientos ?? 0,
      motivo: r.motivo ?? null,
      // Los días los decide el servidor: repetirlos acá sería una segunda verdad
      // que se desincroniza el día que alguien cambie la constante.
      diasBuscados: r.buscado?.diasAtras ?? null,
    };
  }

  /** La casilla del usuario, o null si todavía no conectó ninguna. */
  async mia(): Promise<IntegracionEmail | null> {
    const { data, error } = await this.client
      .from('mis_integraciones_email')
      .select('id, email, carpeta, estado, conectada, ultima_sync, ultimo_error')
      .maybeSingle();

    if (error) throw new ErrorDeBd(error.message, error.code);
    return data ? aDominio(data as FilaIntegracion) : null;
  }

  /**
   * Cambia la etiqueta que se vigila (AC8).
   *
   * `carpeta` es la única columna que el cliente puede escribir: el GRANT es por
   * columna justamente para que este método no pueda tocar una credencial ni por
   * error de tipeo.
   */
  async cambiarCarpeta(id: string, carpeta: string): Promise<void> {
    const { error } = await this.client
      .from('integraciones_email')
      .update({ carpeta })
      .eq('id', id);

    if (error) throw new ErrorDeBd(error.message, error.code);
  }

  /**
   * Desconecta la casilla (AC9): se borra la fila y con ella los dos tokens.
   *
   * Borrar y no marcar `estado='revocada'`: dejar la fila conserva el refresh
   * token, y "desconectado" tiene que significar que la credencial ya no existe.
   * Las capturas ya creadas no dependen de esta fila y sobreviven.
   */
  async desconectar(id: string): Promise<void> {
    const { error } = await this.client
      .from('integraciones_email')
      .delete()
      .eq('id', id);

    if (error) throw new ErrorDeBd(error.message, error.code);
  }
}

interface FilaIntegracion {
  id: string;
  email: string;
  carpeta: string;
  estado: IntegracionEmail['estado'];
  conectada: boolean;
  ultima_sync: string | null;
  ultimo_error: string | null;
}

function aDominio(fila: FilaIntegracion): IntegracionEmail {
  return {
    id: fila.id,
    email: fila.email,
    carpeta: fila.carpeta,
    estado: fila.estado,
    conectada: fila.conectada,
    ultimaSync: fila.ultima_sync,
    ultimoError: fila.ultimo_error,
  };
}

/**
 * `FunctionsHttpError` trae el motivo real en el **cuerpo** de la respuesta, no
 * en `.message` —que dice siempre "Edge Function returned a non-2xx status
 * code"—. Sin leerlo, un "faltan GOOGLE_CLIENT_ID" se vuelve indistinguible de
 * cualquier otra falla, que es exactamente cuando hace falta saberlo.
 *
 * El texto igual pasa por `mensajeSeguroDeBd` antes de llegar a la pantalla.
 */
async function mensajeDeLaFuncion(error: unknown): Promise<string> {
  const contexto = (error as { context?: Response }).context;
  if (contexto && typeof contexto.json === 'function') {
    try {
      const cuerpo = (await contexto.json()) as { error?: string };
      if (cuerpo?.error) return cuerpo.error;
    } catch {
      // Cuerpo no-JSON: queda el mensaje genérico, que es mejor que nada.
    }
  }
  return (error as { message?: string }).message ?? 'Falló la conexión con el servidor';
}
