import { describe, expect, it } from 'vitest';

import {
  SCOPE_GMAIL,
  leerRespuestaDeGoogle,
  nuevoState,
  urlDeConsentimiento,
} from './consentimiento-google.utils';

const opciones = {
  clientId: '123.apps.googleusercontent.com',
  redirectUri: 'http://localhost:4292/onboarding',
  state: 'abc',
};

describe('urlDeConsentimiento', () => {
  const params = (url: string) => new URL(url).searchParams;

  it('pide access_type=offline', () => {
    // Sin esto Google no devuelve refresh token: la conexión muere en una hora
    // y la app no se entera hasta el día siguiente.
    expect(params(urlDeConsentimiento(opciones)).get('access_type')).toBe('offline');
  });

  it('fuerza prompt=consent', () => {
    // Google entrega el refresh token UNA sola vez por autorización. Reconectar
    // una cuenta ya autorizada sin esto devuelve sólo el access token, y la
    // integración se guardaría rota.
    expect(params(urlDeConsentimiento(opciones)).get('prompt')).toBe('consent');
  });

  it('pide sólo lectura de Gmail', () => {
    // La app nunca manda ni borra correos: pedir más permiso del que se usa es
    // la forma más rápida de que alguien no acepte.
    expect(params(urlDeConsentimiento(opciones)).get('scope')).toBe(SCOPE_GMAIL);
    expect(SCOPE_GMAIL).toContain('readonly');
  });

  it('lleva el redirect_uri tal cual', () => {
    // Google compara carácter por carácter con el autorizado en la consola.
    expect(params(urlDeConsentimiento(opciones)).get('redirect_uri'))
      .toBe('http://localhost:4292/onboarding');
  });

  it('pide un code, no un token implícito', () => {
    expect(params(urlDeConsentimiento(opciones)).get('response_type')).toBe('code');
  });

  it('el state viaja para poder verificarlo a la vuelta', () => {
    expect(params(urlDeConsentimiento(opciones)).get('state')).toBe('abc');
  });

  it('no incluye el client_secret', () => {
    // Es lo único que no puede salir del servidor.
    expect(urlDeConsentimiento(opciones)).not.toContain('secret');
  });
});

describe('leerRespuestaDeGoogle', () => {
  it('lee el code de una vuelta exitosa', () => {
    const r = leerRespuestaDeGoogle(new URLSearchParams('code=4/xyz&state=abc'));

    expect(r).toEqual({ code: '4/xyz', state: 'abc', error: null });
  });

  it('detecta la cancelación del usuario', () => {
    // AC-E4: cancelar tiene que explicarse y poder reintentarse, no quedar en
    // una pantalla que espera para siempre.
    const r = leerRespuestaDeGoogle(new URLSearchParams('error=access_denied&state=abc'));

    expect(r.error).toBe('access_denied');
    expect(r.code).toBeNull();
  });

  it('una vuelta sin nada no inventa datos', () => {
    expect(leerRespuestaDeGoogle(new URLSearchParams())).toEqual({
      code: null, state: null, error: null,
    });
  });
});

describe('nuevoState', () => {
  it('no se repite', () => {
    expect(nuevoState()).not.toBe(nuevoState());
  });

  it('no lleva información adentro', () => {
    // Meter el id del hogar lo publicaría en la barra de direcciones y en los
    // logs de Google.
    expect(nuevoState()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
