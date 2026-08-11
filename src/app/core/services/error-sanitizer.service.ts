import { Injectable } from '@angular/core';

export interface SanitizedError {
  originalError: unknown;
  message: string;
  code?: string | number;
  isNetworkError: boolean;
}

/**
 * Diccionario de códigos → mensaje para el usuario final.
 *
 * Los códigos `2xxxx`/`4xxxx` son SQLSTATE de PostgreSQL, que Supabase propaga
 * tal cual en `error.code`. Ajustá los textos al dominio del proyecto: son la
 * cara visible de los errores de base de datos.
 */
const ERROR_DICTIONARY: Record<string, string> = {
  // PostgREST / PostgreSQL
  '23505': 'Ya existe un registro con estos datos.',
  '23503': 'No se puede eliminar o modificar este registro porque está en uso por otra parte del sistema.',
  '23502': 'Faltan datos obligatorios. Revisa que el formulario esté completo.',
  '23514': 'Los datos no cumplen los requisitos de validación.',
  '42501': 'No tienes permisos para realizar esta acción.',
  '22P02': 'El formato de los datos enviados es inválido.',

  // Supabase Auth
  AuthApiError: 'Error de autenticación.',
  invalid_credentials: 'El correo electrónico o la contraseña son incorrectos.',
  user_not_found: 'Usuario no encontrado.',
  email_exists: 'El correo electrónico ya está registrado.',

  // HTTP
  '400': 'La solicitud no es válida. Por favor, verifica la información.',
  '401': 'No tienes autorización. Por favor, inicia sesión de nuevo.',
  '403': 'No tienes permisos para realizar esta acción.',
  '404': 'El recurso solicitado no fue encontrado.',
  '409': 'Existe un conflicto con el estado actual del recurso.',
  '422': 'Los datos proporcionados no son válidos.',
  '500': 'Ha ocurrido un error inesperado en el servidor. Inténtalo más tarde.',
  '502': 'Servicio temporalmente no disponible (Bad Gateway).',
  '503': 'El servicio se encuentra en mantenimiento. Inténtalo más tarde.',
  '504': 'El servidor tardó demasiado en responder.',
};

const FALLBACK = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';

/**
 * ErrorSanitizerService — Convierte cualquier error crudo (Supabase, HttpClient,
 * `Error` de JS, string suelto) en un mensaje seguro para mostrar al usuario.
 *
 * Principio: **nunca** exponer `details`, `hint` ni stack traces en la UI. Esos
 * campos filtran nombres de tablas, columnas y políticas RLS.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorSanitizerService {
  sanitize(error: any): SanitizedError {
    let message = FALLBACK;
    let code: string | number | undefined;
    let isNetworkError = false;

    // 1. Red / desconexión
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        originalError: error,
        message: 'No se pudo conectar al servidor. Verifica tu conexión a internet.',
        code: 'NETWORK_ERROR',
        isNetworkError: true,
      };
    }

    if (error?.name === 'HttpErrorResponse') {
      if (error.status === 0) {
        message = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
        isNetworkError = true;
      } else {
        code = error.status;
        message = ERROR_DICTIONARY[String(code)] ?? message;
      }
      return { originalError: error, message, code, isNetworkError };
    }

    // 2. Excepciones de negocio lanzadas por triggers con RAISE EXCEPTION.
    //    P0001 es el SQLSTATE por defecto de un RAISE sin ERRCODE explícito.
    //    Convención: esos mensajes ya vienen redactados para el usuario final,
    //    así que se confía en `error.message` en vez de mapearlo.
    if (error?.code === 'P0001' && error?.message) {
      return { originalError: error, message: error.message, code: 'P0001', isNetworkError };
    }

    // 3. Supabase / PostgREST: { code, message, details, hint }
    if (error?.code) {
      code = String(error.code);
      if (ERROR_DICTIONARY[code]) {
        message = ERROR_DICTIONARY[code];
      } else if (error.name === 'AuthApiError' || error.message?.includes('invalid credentials')) {
        message = ERROR_DICTIONARY['invalid_credentials'];
      } else {
        // Fallback seguro: se muestra el código, nunca details ni hint.
        message = `Ha ocurrido un error procesando la solicitud (${code}).`;
      }
      return { originalError: error, message, code, isNetworkError };
    }

    // 4. Error de JS. Solo se confía en el mensaje si es un `Error` lanzado a
    //    propósito; los de sistema (TypeError, ReferenceError) filtran internals.
    if (error instanceof Error) {
      if (error.constructor.name === 'Error') message = error.message;
      return { originalError: error, message, code: 'JS_ERROR', isNetworkError };
    }

    if (typeof error === 'string') {
      return { originalError: error, message: error, code: 'UNKNOWN_STRING', isNetworkError };
    }

    return { originalError: error, message, code: 'UNKNOWN', isNetworkError };
  }
}
