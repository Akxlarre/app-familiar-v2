import { normalizeEmail, validateEmail } from './validation.utils';

describe('validateEmail', () => {
  it('acepta direcciones normales', () => {
    expect(validateEmail('juan@gmail.com')).toBe(true);
    expect(validateEmail('juan.perez+facturas@sub.dominio.cl')).toBe(true);
    expect(validateEmail("o'brien!raro#pero+valido@ejemplo.org")).toBe(true);
  });

  it('exige un TLD', () => {
    // El regex que venía de la cosecha aceptaba esto. `juan@gmail` es un typo:
    // el correo no llega a ninguna parte y el usuario se entera cuando no le
    // llega el mail de confirmación.
    expect(validateEmail('juan@gmail')).toBe(false);
    expect(validateEmail('juan@localhost')).toBe(false);
    expect(validateEmail('juan@gmail.c')).toBe(false);
  });

  it('rechaza lo que no es un email', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('juan')).toBe(false);
    expect(validateEmail('@gmail.com')).toBe(false);
    expect(validateEmail('juan@')).toBe(false);
    expect(validateEmail('juan@@gmail.com')).toBe(false);
    expect(validateEmail('juan perez@gmail.com')).toBe(false);
  });

  it('tolera espacios al borde, que son typos y no errores', () => {
    expect(validateEmail('  juan@gmail.com  ')).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('recorta y baja a minúsculas', () => {
    expect(normalizeEmail('  Juan.Perez@Gmail.COM ')).toBe('juan.perez@gmail.com');
  });
});
