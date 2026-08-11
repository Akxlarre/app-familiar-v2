/**
 * Pruebas del parseo de correos bancarios.
 *
 * Son funciones puras sin APIs de Deno, así que corren con Node:
 *   node --test supabase/functions/_shared/parseo.test.ts
 *
 * El caso que motiva la mitad de esta suite: en Chile el punto es separador de
 * MILES, no decimal. v1 usaba `parseFloat("15.990")`, que devuelve 15.99 —
 * dividía todos los montos por mil sin que nada fallara.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  montoChileno,
  normalizarComercio,
  extraerDatos,
  elegirParser,
  fechaEnZona,
} from './parseo.ts';

// ─── montoChileno ────────────────────────────────────────────────────────────

test('el punto es separador de miles, no decimal', () => {
  assert.equal(montoChileno('$15.990'), 15990);
  assert.equal(montoChileno('1.234.567'), 1234567);
  assert.equal(montoChileno('$ 4.500'), 4500);
  // Lo que hacía v1 con parseFloat:
  assert.notEqual(montoChileno('15.990'), 15.99);
});

test('acepta montos sin separadores', () => {
  assert.equal(montoChileno('15990'), 15990);
  assert.equal(montoChileno('$990'), 990);
});

test('descarta los decimales cuando el banco los escribe', () => {
  assert.equal(montoChileno('12.500,00'), 12500);
  assert.equal(montoChileno('$1.990,50'), 1990);
});

test('tolera el sufijo ".-" y los espacios', () => {
  assert.equal(montoChileno('$ 4.500.-'), 4500);
  assert.equal(montoChileno('  $  33.000  '), 33000);
});

test('devuelve el valor absoluto — el signo lo da el tipo de movimiento', () => {
  assert.equal(montoChileno('-15.990'), 15990);
});

test('sin dígitos devuelve null', () => {
  assert.equal(montoChileno(''), null);
  assert.equal(montoChileno('monto no disponible'), null);
});

// ─── normalizarComercio ──────────────────────────────────────────────────────

test('dos cargos del mismo comercio caen en el mismo alias', () => {
  assert.equal(normalizarComercio('UBER   *TRIP 123'), normalizarComercio('uber *trip 456'));
});

test('quita tildes para que no dependan de cómo lo escriba el banco', () => {
  assert.equal(normalizarComercio('FARMACIA CRUZ VERDE'), 'FARMACIA CRUZ VERDE');
  assert.equal(normalizarComercio('Café Altura'), 'CAFE ALTURA');
});

test('los números de transacción no ensucian el patrón', () => {
  assert.equal(normalizarComercio('JUMBO 0451'), 'JUMBO');
});

// ─── extraerDatos ────────────────────────────────────────────────────────────

const REGLAS_CARGO = {
  regex_monto: 'por\\s+\\$?([\\d.,]+)',
  regex_comercio: 'en\\s+([A-Za-zÁÉÍÓÚÑ0-9*\\s]+?)\\s+el\\b',
  regex_cuota: 'cuota\\s+(\\d+)\\s+de\\s+(\\d+)',
  regex_tarjeta: 'terminada\\s+en\\s+(\\d{4})',
};

const CORREO_CARGO =
  'Te informamos de una compra por $15.990 en JUMBO MAIPU el 11/08/2026 ' +
  'con tu tarjeta terminada en 4321.';

test('extrae monto, comercio y tarjeta de un cargo típico', () => {
  const d = extraerDatos(CORREO_CARGO, REGLAS_CARGO);
  assert.equal(d.monto, 15990);
  assert.equal(d.comercio, 'JUMBO MAIPU');
  assert.equal(d.tarjeta, '4321');
  assert.equal(d.cuotasTotal, null);
});

test('extrae la cuota cuando el correo la trae', () => {
  const d = extraerDatos(
    'Compra por $120.000 en FALABELLA el 11/08/2026, cuota 3 de 12.',
    REGLAS_CARGO,
  );
  assert.equal(d.monto, 120000);
  assert.equal(d.cuotaActual, 3);
  assert.equal(d.cuotasTotal, 12);
});

test('la confianza baja cuando falta el comercio', () => {
  const conTodo = extraerDatos(CORREO_CARGO, REGLAS_CARGO);
  const soloMonto = extraerDatos('Cargo por $9.900 realizado.', REGLAS_CARGO);
  assert.ok(conTodo.confianza > soloMonto.confianza);
  assert.equal(soloMonto.comercio, null);
  assert.equal(soloMonto.monto, 9900);
});

test('sin monto la confianza es cero — no hay nada que registrar', () => {
  const d = extraerDatos('Tu estado de cuenta ya está disponible.', REGLAS_CARGO);
  assert.equal(d.monto, null);
  assert.equal(d.confianza, 0);
});

test('una regex inválida en la configuración no tumba el resto', () => {
  const d = extraerDatos(CORREO_CARGO, {
    ...REGLAS_CARGO,
    regex_comercio: '([sin cerrar',
  });
  assert.equal(d.monto, 15990, 'el monto se sigue extrayendo');
  assert.equal(d.comercio, null);
});

// ─── elegirParser ────────────────────────────────────────────────────────────

const PARSERS = [
  { id: 'cargo', remitente_patron: '@bancoejemplo.cl', asunto_patron: 'Compra con tarjeta' },
  { id: 'abono', remitente_patron: '@bancoejemplo.cl', asunto_patron: 'Transferencia recibida' },
  { id: 'generico', remitente_patron: '@otrobanco.cl', asunto_patron: null },
];

test('el asunto desempata entre parsers del mismo remitente', () => {
  assert.equal(
    elegirParser(PARSERS, 'Banco <avisos@bancoejemplo.cl>', 'Compra con tarjeta de crédito')?.id,
    'cargo',
  );
  assert.equal(
    elegirParser(PARSERS, 'Banco <avisos@bancoejemplo.cl>', 'Transferencia recibida de Ana')?.id,
    'abono',
  );
});

test('sin coincidencia de asunto NO usa un parser que exige asunto', () => {
  // v1 caía al primero de la lista, y así un "pago recibido" se registraba como
  // cargo — el movimiento quedaba con el signo invertido.
  assert.equal(
    elegirParser(PARSERS, 'Banco <avisos@bancoejemplo.cl>', 'Tu estado de cuenta'),
    null,
  );
});

test('un parser sin asunto acepta cualquier correo de su remitente', () => {
  assert.equal(elegirParser(PARSERS, 'avisos@otrobanco.cl', 'Lo que sea')?.id, 'generico');
});

test('remitente desconocido no matchea nada', () => {
  assert.equal(elegirParser(PARSERS, 'newsletter@tienda.com', 'Oferta'), null);
});

// ─── fechaEnZona ─────────────────────────────────────────────────────────────

test('usa la zona del hogar, no la del servidor', () => {
  // 11-ago-2026 02:30 UTC es todavía el 10 en Santiago (UTC-4).
  const d = new Date('2026-08-11T02:30:00Z');
  assert.equal(fechaEnZona(d, 'America/Santiago'), '2026-08-10');
  assert.equal(fechaEnZona(d, 'UTC'), '2026-08-11');
});

test('una zona inválida no rompe: cae a UTC', () => {
  const d = new Date('2026-08-11T12:00:00Z');
  assert.equal(fechaEnZona(d, 'No/Existe'), '2026-08-11');
});
