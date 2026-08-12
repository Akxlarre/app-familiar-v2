import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '@core/services/supabase.service';
import { ErrorDeBd } from '@core/utils/db-error.utils';

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
