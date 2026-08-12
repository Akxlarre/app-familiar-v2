// Cliente mínimo de Gmail: refresco de token, listado y lectura de mensajes.
//
// Extraído de v1, donde vivía dentro de `process-bank-emails` y no se podía
// reusar. La lógica de decodificar el cuerpo en particular es delicada y es
// exactamente la que no conviene tener duplicada.

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface CredencialesGoogle {
  clientId: string;
  clientSecret: string;
}

export interface TokenRefrescado {
  accessToken: string;
  expiraEn: string;
}

export interface MensajeGmail {
  id: string;
  remitente: string;
  asunto: string;
  cuerpo: string;
  fechaInterna: Date | null;
}

/**
 * Un fallo de Gmail que **conserva el status**.
 *
 * Sin él, "Gmail no listó los mensajes: …" es indistinguible entre un token que
 * Google revocó (401 o 403, se arregla reconectando y sólo el usuario puede
 * hacerlo) y Gmail caído o sin cuota (5xx, 429, se arregla esperando). Tratar
 * los dos igual lleva a una de dos cosas malas: reintentar para siempre algo que
 * está muerto, o mandar a reconectar cada vez que Google tose.
 */
export class ErrorDeGmail extends Error {
  readonly status: number;

  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = 'ErrorDeGmail';
    this.status = status;
  }

  /** El permiso ya no sirve: ningún reintento lo arregla. */
  get esCredencialMuerta(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function credencialesGoogle(): CredencialesGoogle | null {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Canjea el `code` del consentimiento por tokens (flujo inicial). */
export async function canjearCodigo(
  cred: CredencialesGoogle,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google rechazó el código: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

/** Renueva el access token con el refresh token. */
export async function refrescarToken(
  cred: CredencialesGoogle,
  refreshToken: string,
): Promise<TokenRefrescado> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`No se pudo renovar el token: ${(await res.text()).slice(0, 200)}`);
  const t = (await res.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: t.access_token,
    expiraEn: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
  };
}

/** Un token se considera vencido 5 minutos antes de su expiración real. */
export function necesitaRefresco(accessToken: string | null, expiraEn: string | null): boolean {
  if (!accessToken) return true;
  if (!expiraEn) return false;
  return new Date(expiraEn).getTime() <= Date.now() + 5 * 60 * 1000;
}

export async function correoDeLaCuenta(accessToken: string): Promise<string | null> {
  const res = await fetch(`${GMAIL_API}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { emailAddress?: string };
  return data.emailAddress?.trim() ?? null;
}

export async function listarMensajes(
  accessToken: string,
  opciones: { maximo: number; diasAtras: number; carpeta?: string },
): Promise<string[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - opciones.diasAtras);
  const y = desde.getFullYear();
  const m = String(desde.getMonth() + 1).padStart(2, '0');
  const d = String(desde.getDate()).padStart(2, '0');

  const q = [`after:${y}/${m}/${d}`];
  if (opciones.carpeta && opciones.carpeta !== 'INBOX') q.push(`label:${opciones.carpeta}`);

  const url = `${GMAIL_API}/messages?maxResults=${opciones.maximo}&q=${encodeURIComponent(q.join(' '))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new ErrorDeGmail(`Gmail no listó los mensajes: ${(await res.text()).slice(0, 200)}`, res.status);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  return (data.messages ?? []).map((m) => m.id);
}

function decodificarBase64Url(s: string): string {
  try {
    const binario = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    // Gmail devuelve UTF-8; sin esto los acentos y la "ñ" salen rotos, que en
    // correos bancarios chilenos es la norma y no la excepción.
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

interface DetalleGmail {
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string }; parts?: unknown[] }[];
  };
  internalDate?: string;
  snippet?: string;
}

/** Recorre el árbol de partes MIME juntando todo el texto legible. */
function textoDePartes(partes: unknown[]): string {
  let texto = '';
  for (const parteRaw of partes) {
    const parte = parteRaw as { mimeType?: string; body?: { data?: string }; parts?: unknown[] };
    if (parte.body?.data && (parte.mimeType === 'text/plain' || parte.mimeType === 'text/html')) {
      texto += '\n' + decodificarBase64Url(parte.body.data).replace(/<[^>]+>/g, ' ');
    }
    // multipart/alternative anida otro nivel; v1 no bajaba y perdía el cuerpo
    // de los correos que lo usan, que son la mayoría de los bancarios.
    if (parte.parts?.length) texto += textoDePartes(parte.parts);
  }
  return texto;
}

export async function leerMensaje(
  accessToken: string,
  id: string,
): Promise<MensajeGmail | null> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const detalle = (await res.json()) as DetalleGmail;
  const cabecera = (nombre: string) =>
    detalle.payload?.headers?.find((h) => h.name.toLowerCase() === nombre)?.value ?? '';

  let cuerpo = detalle.snippet ?? '';
  if (detalle.payload?.body?.data) cuerpo += '\n' + decodificarBase64Url(detalle.payload.body.data);
  if (detalle.payload?.parts?.length) cuerpo += textoDePartes(detalle.payload.parts);

  let fechaInterna: Date | null = null;
  if (detalle.internalDate) {
    const d = new Date(parseInt(String(detalle.internalDate), 10));
    if (!isNaN(d.getTime())) fechaInterna = d;
  }

  return {
    id,
    remitente: cabecera('from'),
    asunto: cabecera('subject'),
    cuerpo,
    fechaInterna,
  };
}
