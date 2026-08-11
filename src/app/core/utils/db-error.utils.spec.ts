import { ErrorDeBd, mensajeSeguroDeBd } from './db-error.utils';

/**
 * Lo que se prueba acá es una sola regla: **el texto crudo de PostgreSQL nunca
 * sale**. Un mensaje de Postgres nombra la tabla, la columna y el constraint que
 * falló; mostrarlo es contarle el esquema a cualquiera que rompa un formulario.
 */
describe('mensajeSeguroDeBd', () => {
  const FALLBACK = 'No se pudo guardar';

  it('mapea el SQLSTATE cuando viene', () => {
    expect(mensajeSeguroDeBd(new ErrorDeBd('duplicate key value', '23505'), FALLBACK)).toBe(
      'Ya existe un registro con estos datos.',
    );
  });

  it('nunca deja pasar el texto crudo de la base', () => {
    const crudo =
      'new row violates row-level security policy for table "movimientos" (constraint movimientos_hogar_fk)';
    const salida = mensajeSeguroDeBd(new ErrorDeBd(crudo, '42501'), FALLBACK);

    expect(salida).not.toContain('movimientos');
    expect(salida).not.toContain('constraint');
    expect(salida).toBe('No tienes permisos para realizar esta acción.');
  });

  it('deja pasar los mensajes de nuestros propios triggers', () => {
    // Un RAISE EXCEPTION nuestro está escrito para el usuario: sustituirlo por
    // "error inesperado" pierde información que le sirve.
    const salida = mensajeSeguroDeBd(
      new ErrorDeBd('La captura ya fue procesada', 'P0001'),
      FALLBACK,
      ['La captura ya fue procesada'],
    );
    expect(salida).toBe('La captura ya fue procesada');
  });

  it('el token gana sobre el SQLSTATE', () => {
    // 23514 tiene mapeo genérico; si nuestro CHECK trae además un mensaje
    // propio, ese es más específico.
    const salida = mensajeSeguroDeBd(new ErrorDeBd('El monto debe ser mayor que cero', '23514'), FALLBACK, [
      'El monto debe ser mayor que cero',
    ]);
    expect(salida).toBe('El monto debe ser mayor que cero');
  });

  it('un token que no está en el mensaje no se inventa', () => {
    const salida = mensajeSeguroDeBd(new ErrorDeBd('otra cosa', undefined), FALLBACK, [
      'La captura ya fue procesada',
    ]);
    expect(salida).toBe(FALLBACK);
  });

  it('reconoce fallas de red, que nunca traen SQLSTATE', () => {
    // supabase-js envuelve el fetch: cuando no hay conexión no hay código, sólo
    // "TypeError: Failed to fetch".
    expect(mensajeSeguroDeBd(new Error('Failed to fetch'), FALLBACK)).toContain('conexión');
    expect(mensajeSeguroDeBd(new Error('NetworkError when attempting to fetch'), FALLBACK)).toContain(
      'conexión',
    );
  });

  it('reconoce RLS por texto cuando el código no llegó', () => {
    // Este es el caso real que motivó conservar la heurística: si un repository
    // vuelve a lanzar `new Error(error.message)` y pierde el código, RLS todavía
    // se detecta.
    const salida = mensajeSeguroDeBd(
      new Error('new row violates row-level security policy for table "capturas"'),
      FALLBACK,
    );
    expect(salida).toBe('No tienes permisos para realizar esta acción.');
    expect(salida).not.toContain('capturas');
  });

  it('un SQLSTATE desconocido cae en el fallback, no en el crudo', () => {
    const salida = mensajeSeguroDeBd(new ErrorDeBd('relation "cuentas" does not exist', '42P01'), FALLBACK);
    expect(salida).toBe(FALLBACK);
    expect(salida).not.toContain('cuentas');
  });

  it('tolera cualquier cosa que no sea un error', () => {
    expect(mensajeSeguroDeBd(null, FALLBACK)).toBe(FALLBACK);
    expect(mensajeSeguroDeBd(undefined, FALLBACK)).toBe(FALLBACK);
    expect(mensajeSeguroDeBd('un string suelto', FALLBACK)).toBe(FALLBACK);
    expect(mensajeSeguroDeBd(42, FALLBACK)).toBe(FALLBACK);
  });

  it('acepta el objeto crudo de PostgREST, sin envolver', () => {
    // Un repository puede pasar el `error` de supabase-js tal cual: es un objeto
    // plano, no una instancia de Error.
    expect(mensajeSeguroDeBd({ code: '23503', message: 'violates foreign key' }, FALLBACK)).toBe(
      'Hay datos relacionados que impiden completar la operación.',
    );
  });
});

describe('ErrorDeBd', () => {
  it('conserva el SQLSTATE y sigue siendo un Error', () => {
    const e = new ErrorDeBd('duplicate key', '23505');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('duplicate key');
    expect(e.code).toBe('23505');
  });

  it('acepta no tener código', () => {
    expect(new ErrorDeBd('algo').code).toBeUndefined();
  });
});
