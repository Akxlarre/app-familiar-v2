/**
 * Validates email format using a simplified RFC 5322 regex.
 *
 * Se recorta el input antes de validar: un espacio al final es un error de tipeo
 * habitual y no debería marcar el email como inválido.
 */
export function validateEmail(email: string): boolean {
  const re =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email.trim());
}

/** Devuelve el email recortado y en minúsculas — listo para guardar y comparar. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
