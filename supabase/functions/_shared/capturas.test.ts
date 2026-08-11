/**
 * Pruebas del replanteo de capturas.
 *
 *   node --test supabase/functions/_shared/capturas.test.ts
 *
 * El escenario que justifica todo: se arregla un regex y quedan capturas viejas
 * atascadas en la bandeja. Lo que se verifica acá es que el reproceso tome
 * exactamente la misma decisión que el proceso original habría tomado con las
 * reglas nuevas — ni más optimista ni más conservador.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  motivoSeguro,
  replantearCaptura,
  type CapturaReinterpretable,
  type ParserActivo,
} from './capturas.ts';

const PARSER: ParserActivo = {
  id: 'p1',
  banco: 'BancoEstado',
  tipo: 'cargo',
  remitente_patron: 'bancoestado.cl',
  asunto_patron: 'Compra',
  regex_monto: 'por \\$([\\d.,]+)',
  regex_comercio: 'en (.+?) el',
  regex_fecha: null,
  regex_cuota: null,
  regex_tarjeta: null,
  cuenta_id: 'cta-1',
};

function captura(over: Partial<CapturaReinterpretable> = {}): CapturaReinterpretable {
  return {
    id: 'cap-1',
    parser_id: 'p1',
    payload: {
      remitente: 'enviodigital@bancoestado.cl',
      asunto: 'Compra con tarjeta',
      extracto: 'Compra por $15.990 en JUMBO el 09/08/2026',
    },
    interpretado: { monto: null, confianza: 0 },
    ...over,
  };
}

test('con el regex arreglado, la captura se recupera', () => {
  const r = replantearCaptura(captura(), [PARSER]);
  assert.equal(r.resuelta, true);
  assert.equal(r.motivo, null);
  assert.equal(r.datos?.monto, 15990);
  assert.equal(r.datos?.comercio, 'JUMBO');
});

test('si el regex sigue sin leer el monto, no se recupera', () => {
  const roto: ParserActivo = { ...PARSER, regex_monto: 'total: ([\\d.]+)' };
  const r = replantearCaptura(captura(), [roto]);
  assert.equal(r.resuelta, false);
  assert.equal(r.motivo, 'No se pudo leer el monto');
  // Igual devuelve lo que sí pudo leer: el comercio sirve aunque falte el monto.
  assert.equal(r.datos?.comercio, 'JUMBO');
});

test('re-elige el parser en vez de confiar en parser_id', () => {
  // El arreglo puede haber sido agregar un parser NUEVO para ese remitente.
  // Reusar parser_id dejaría la captura atascada con las reglas viejas.
  const nuevo: ParserActivo = { ...PARSER, id: 'p2' };
  const r = replantearCaptura(captura({ parser_id: 'viejo-borrado' }), [nuevo]);
  assert.equal(r.parser?.id, 'p2');
  assert.equal(r.resuelta, true);
});

test('sin parser que reconozca el correo, se dice por qué', () => {
  const ajeno: ParserActivo = { ...PARSER, remitente_patron: 'otrobanco.cl' };
  const r = replantearCaptura(captura(), [ajeno]);
  assert.equal(r.resuelta, false);
  assert.equal(r.parser, null);
  assert.equal(r.motivo, 'Ningún parser activo reconoce este correo');
});

test('sin parsers activos tampoco explota', () => {
  const r = replantearCaptura(captura(), []);
  assert.equal(r.resuelta, false);
  assert.equal(r.motivo, 'Ningún parser activo reconoce este correo');
});

test('sin extracto no hay nada que reinterpretar', () => {
  // Una captura de boleta, o una vieja guardada antes de que se guardara el
  // cuerpo. Decirlo es mejor que reportar "ningún parser reconoce el correo".
  const r = replantearCaptura(captura({ payload: { remitente: 'x', asunto: 'y' } }), [PARSER]);
  assert.equal(r.resuelta, false);
  assert.equal(r.motivo, 'No quedó texto del correo para reinterpretar');

  const vacio = replantearCaptura(captura({ payload: { extracto: '   ' } }), [PARSER]);
  assert.equal(vacio.motivo, 'No quedó texto del correo para reinterpretar');

  const nulo = replantearCaptura(captura({ payload: null }), [PARSER]);
  assert.equal(nulo.motivo, 'No quedó texto del correo para reinterpretar');
});

test('con monto pero sin cuenta en el parser, sigue sin resolverse', () => {
  const sinCuenta: ParserActivo = { ...PARSER, cuenta_id: null };
  const r = replantearCaptura(captura(), [sinCuenta]);
  assert.equal(r.resuelta, false);
  assert.equal(r.motivo, 'El parser no tiene cuenta asociada');
  // El monto leído no se pierde: la bandeja lo va a mostrar igual.
  assert.equal(r.datos?.monto, 15990);
});

test('el punto sigue siendo separador de miles al reprocesar', () => {
  // Es el bug de v1 que dividía todos los montos por mil. Que el reproceso lo
  // reintroduzca sería peor que no reprocesar.
  const r = replantearCaptura(
    captura({ payload: { ...captura().payload, extracto: 'Compra por $1.234.567 en X el 1/1' } }),
    [PARSER],
  );
  assert.equal(r.datos?.monto, 1234567);
});

test('motivoSeguro nunca devuelve el texto crudo de Postgres', () => {
  assert.equal(motivoSeguro('23503'), 'La cuenta o la categoría de este parser ya no existe');
  assert.equal(motivoSeguro('42501'), 'El sistema no tiene permiso para crear el movimiento');
  assert.equal(motivoSeguro('40001'), 'No se pudo crear el movimiento automáticamente');
  assert.equal(motivoSeguro(undefined), 'No se pudo crear el movimiento automáticamente');
  // No hay forma de que un mensaje de Postgres se cuele: no recibe el mensaje.
  assert.ok(!motivoSeguro('23503').includes('constraint'));
});
