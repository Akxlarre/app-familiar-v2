import type { TipoDeCuenta } from '@core/models/banco.model';

export type EstadoDeCuenta = 'activa' | 'archivada' | 'cerrada';

export interface DetalleCredito {
  cupoTotal: number | null;
  diaFacturacion: number | null;
  diaVencimiento: number | null;
}

export interface CuentaCompleta {
  id: string;
  nombre: string;
  tipo: TipoDeCuenta;
  banco: string | null;
  last4: string | null;
  estado: EstadoDeCuenta;
  credito: DetalleCredito | null;
  /** Gastado en el período en curso. Se deriva de los movimientos, no es columna. */
  usadoEnPeriodo: number;
  /** Si su banco tiene parsers vinculados. Sin ellos, sus cargos no entran solos. */
  parsersVinculados: number;
}

/** El período de facturación en curso de una tarjeta. */
export interface PeriodoFacturacion {
  desde: string;
  hasta: string;
  /** Cuándo cierra, en días. Negativo si ya cerró. */
  diasParaCierre: number;
}

export interface ResumenCupo {
  total: number;
  usado: number;
  disponible: number;
  /** 0–100. Puede pasar de 100 si se superó el cupo. */
  porcentaje: number;
  superado: boolean;
}

/** El último día del mes. `new Date(año, mes+1, 0)` lo resuelve sin tablas. */
function ultimoDiaDelMes(año: number, mes: number): number {
  return new Date(año, mes + 1, 0).getDate();
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * El período de facturación que contiene a `hoy`.
 *
 * El caso que siempre se rompe: **un día de facturación 31 en un mes de 30**
 * (AC-E2). Un `new Date(2026, 3, 31)` no lanza — desborda a mayo — así que una
 * implementación ingenua no falla, miente. Acá se recorta al último día real
 * del mes.
 *
 * El período va del día siguiente al corte anterior hasta el corte actual, que
 * es como factura una tarjeta: el corte cierra el período, no lo abre.
 */
export function periodoDeFacturacion(diaFacturacion: number, hoy = new Date()): PeriodoFacturacion {
  const corteDe = (año: number, mes: number): Date =>
    new Date(año, mes, Math.min(diaFacturacion, ultimoDiaDelMes(año, mes)));

  const año = hoy.getFullYear();
  const mes = hoy.getMonth();
  const corteEste = corteDe(año, mes);

  // Si ya pasó el corte de este mes, el período en curso cierra el mes que viene.
  const cierre = hoy > corteEste ? corteDe(año, mes + 1) : corteEste;
  const anterior = hoy > corteEste ? corteEste : corteDe(año, mes - 1);

  const inicio = new Date(anterior);
  inicio.setDate(inicio.getDate() + 1);

  const unDia = 24 * 60 * 60 * 1000;
  const soloFecha = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return {
    desde: iso(inicio),
    hasta: iso(cierre),
    diasParaCierre: Math.round((soloFecha(cierre) - soloFecha(hoy)) / unDia),
  };
}

/**
 * Cupo usado, disponible y porcentaje.
 *
 * Sin cupo declarado no hay nada que repartir: devolver 0% en vez de dividir
 * por cero (AC-E3). Una tarjeta sin cupo cargado es normal — el banco no lo
 * manda en el correo.
 */
export function resumenDeCupo(cupoTotal: number | null, usado: number): ResumenCupo | null {
  if (!cupoTotal || cupoTotal <= 0) return null;
  const porcentaje = Math.round((usado / cupoTotal) * 1000) / 10;
  return {
    total: cupoTotal,
    usado,
    // El disponible no baja de cero: "te quedan −40.000" no es información útil,
    // y el hecho de haber superado el cupo lo dice `superado`.
    disponible: Math.max(0, cupoTotal - usado),
    porcentaje,
    superado: usado > cupoTotal,
  };
}
