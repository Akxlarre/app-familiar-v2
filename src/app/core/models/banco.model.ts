/**
 * Un banco del catálogo, con cuántas plantillas de parser aporta.
 *
 * El usuario elige de una lista y nunca ve un regex: escribir patrones es
 * mantenimiento, no onboarding (spec 0004, AC14).
 */
export interface BancoDelCatalogo {
  banco: string;
  /** Cuántos tipos de correo sabe interpretar: cargo, cuota, abono… */
  plantillas: number;
}

/** Tipos de cuenta que el hogar puede tener. */
export type TipoDeCuenta = 'debito' | 'credito' | 'efectivo' | 'billetera_digital';

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoDeCuenta;
  banco: string | null;
  /** Últimos cuatro dígitos. Es lo que aparece en los correos del banco. */
  last4: string | null;
  activa: boolean;
}

/** Lo mínimo para crear la primera cuenta durante el onboarding. */
export interface NuevaCuenta {
  nombre: string;
  tipo: TipoDeCuenta;
  banco: string;
  last4: string | null;
}

export const TIPOS_DE_CUENTA: ReadonlyArray<{ valor: TipoDeCuenta; etiqueta: string }> = [
  { valor: 'credito', etiqueta: 'Tarjeta de crédito' },
  { valor: 'debito', etiqueta: 'Tarjeta de débito' },
  { valor: 'billetera_digital', etiqueta: 'Billetera digital' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
] as const;
