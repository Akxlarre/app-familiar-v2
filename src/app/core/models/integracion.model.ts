/**
 * La casilla de correo conectada.
 *
 * Nunca incluye tokens: el cliente lee `mis_integraciones_email`, que expone
 * `conectada` —una columna generada— en vez del refresh token (fix-002).
 */
export interface IntegracionEmail {
  id: string;
  email: string;
  carpeta: string;
  estado: 'activa' | 'expirada' | 'revocada';
  conectada: boolean;
  ultimaSync: string | null;
  ultimoError: string | null;
}

/**
 * Lo que devuelve la primera corrida (spec 0004, AC10–AC12).
 *
 * `diasBuscados` viaja desde el servidor y no es una constante del cliente: AC12
 * exige decir dónde se buscó cuando no se encontró nada, y ese número tiene que
 * ser el que de verdad se usó.
 */
export interface ResultadoDeCorrida {
  capturadas: number;
  movimientos: number;
  motivo: string | null;
  diasBuscados: number | null;
}

/**
 * Las etiquetas de sistema de Gmail, que son fijas y no dependen de la cuenta.
 *
 * La alternativa —escribir el nombre a mano— falla en silencio: una etiqueta mal
 * tipeada no da error, simplemente no aparece ningún correo nunca. Con una lista
 * cerrada eso no puede pasar.
 *
 * Quien use una etiqueta propia (un filtro que manda los correos del banco a
 * "Bancos") todavía puede escribirla; la diferencia es que elegirla es el camino
 * por defecto y escribirla, el excepcional.
 */
export const ETIQUETAS_DE_GMAIL: ReadonlyArray<{ id: string; nombre: string; ayuda?: string }> = [
  { id: 'INBOX', nombre: 'Recibidos', ayuda: 'Lo habitual' },
  { id: 'CATEGORY_UPDATES', nombre: 'Actualizaciones', ayuda: 'Gmail suele mandar acá los avisos del banco' },
  { id: 'CATEGORY_PERSONAL', nombre: 'Principal' },
  { id: 'CATEGORY_PROMOTIONS', nombre: 'Promociones' },
  { id: 'CATEGORY_FORUMS', nombre: 'Foros' },
  { id: 'CATEGORY_SOCIAL', nombre: 'Social' },
];

/** Cómo mostrar una carpeta que puede ser de sistema o propia del usuario. */
export function nombreDeCarpeta(id: string): string {
  return ETIQUETAS_DE_GMAIL.find((e) => e.id === id)?.nombre ?? id;
}
