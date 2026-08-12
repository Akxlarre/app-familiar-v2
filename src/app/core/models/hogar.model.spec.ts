import { describe, expect, it } from 'vitest';

import {
  numeroDePaso,
  onboardingCompleto,
  pasoActual,
  type EstadoDeOnboarding,
} from './hogar.model';

const nada: EstadoDeOnboarding = {
  tieneHogar: false,
  tieneCuenta: false,
  tieneCorreoConectado: false,
};

describe('pasoActual', () => {
  it('sin nada empieza por el hogar', () => {
    expect(pasoActual(nada)).toBe('hogar');
  });

  it('con hogar pero sin cuenta pide el banco', () => {
    expect(pasoActual({ ...nada, tieneHogar: true })).toBe('banco');
  });

  it('con hogar y cuenta pide el correo', () => {
    expect(pasoActual({ ...nada, tieneHogar: true, tieneCuenta: true })).toBe('correo');
  });

  it('con todo, listo', () => {
    expect(pasoActual({ tieneHogar: true, tieneCuenta: true, tieneCorreoConectado: true }))
      .toBe('listo');
  });

  it('el orden manda sobre lo que ya esté hecho', () => {
    // Alguien con correo conectado pero sin hogar sigue en el paso 1: sin hogar
    // no hay dónde guardar nada de lo que llegue.
    expect(pasoActual({ ...nada, tieneCorreoConectado: true })).toBe('hogar');
  });

  it('retomar es recalcular: el mismo estado da siempre el mismo paso', () => {
    // AC-E1. No hay nada guardado que restaurar ni que pueda quedar desfasado.
    const estado = { ...nada, tieneHogar: true };
    expect(pasoActual(estado)).toBe(pasoActual({ ...estado }));
  });
});

describe('onboardingCompleto', () => {
  it('sólo con los tres requisitos', () => {
    expect(onboardingCompleto({ tieneHogar: true, tieneCuenta: true, tieneCorreoConectado: true }))
      .toBe(true);
  });

  it('desconectar el correo lo devuelve a incompleto', () => {
    // Es justo lo que una columna `onboarding_step` no sabría.
    expect(onboardingCompleto({ tieneHogar: true, tieneCuenta: true, tieneCorreoConectado: false }))
      .toBe(false);
  });
});

describe('numeroDePaso', () => {
  it('cuenta desde 1 para el "Paso N de 4"', () => {
    expect(numeroDePaso('hogar')).toBe(1);
    expect(numeroDePaso('listo')).toBe(4);
  });
});
