/**
 * Validación de email.
 *
 * Hay UNA implementación a propósito. Cosechando de autoescuela llegó un
 * `email.utils.ts` con su propia versión de estas dos funciones y otro regex: el
 * login habría aceptado `juan@gmail` y el input del formulario lo habría
 * rechazado, en la misma app.
 */

/**
 * Regex de RFC 5322 simplificado, con una exigencia extra: el dominio DEBE
 * terminar en un TLD de al menos dos letras. Sin eso `juan@gmail` pasa, y un
 * email sin TLD no llega a ninguna parte — es un typo, no una dirección rara.
 */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Se recorta el input antes de validar: un espacio al final es un error de tipeo
 * habitual y no debería marcar el email como inválido.
 */
export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Devuelve el email recortado y en minúsculas — listo para guardar y comparar. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
