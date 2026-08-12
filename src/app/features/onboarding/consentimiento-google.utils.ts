/**
 * La URL del consentimiento de Google.
 *
 * Función pura para poder probar los dos parámetros de los que depende todo:
 * sin `access_type=offline` y `prompt=consent`, Google devuelve un access token
 * que **muere en una hora y ningún refresh token**. La integración parecería
 * funcionar y dejaría de hacerlo al día siguiente, sin error visible (AC5, AC7).
 */

/** Sólo lectura: la app nunca manda ni borra correos. */
export const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.readonly';

const AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth';

export interface OpcionesDeConsentimiento {
  clientId: string;
  redirectUri: string;
  /** Vuelve tal cual en la respuesta: sirve para saber que el ida y vuelta es nuestro. */
  state: string;
}

export function urlDeConsentimiento(o: OpcionesDeConsentimiento): string {
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'code',
    scope: SCOPE_GMAIL,
    // Sin esto no hay refresh token y la conexión dura una hora.
    access_type: 'offline',
    // Google entrega el refresh token **una sola vez** por autorización. Sin
    // `consent`, reconectar una cuenta ya autorizada devuelve sólo el access
    // token, y la integración se guardaría rota.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: o.state,
  });
  return `${AUTORIZACION}?${params.toString()}`;
}

/** Lo que Google devuelve en la vuelta, ya interpretado. */
export interface RespuestaDeGoogle {
  code: string | null;
  state: string | null;
  /** `access_denied` cuando el usuario cancela (AC-E4). */
  error: string | null;
}

export function leerRespuestaDeGoogle(params: URLSearchParams): RespuestaDeGoogle {
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
  };
}

/**
 * Un `state` opaco y de un solo uso.
 *
 * No lleva información: sólo tiene que coincidir a la vuelta. Meter el id del
 * hogar acá lo publicaría en la barra de direcciones y en los logs de Google.
 */
export function nuevoState(): string {
  return crypto.randomUUID();
}
