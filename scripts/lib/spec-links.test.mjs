import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extraerModifica, extraerAbsorbidoPor, auditarEnlaces } from './spec-links.js';

describe('extraerModifica', () => {
  test('lee la declaración de la cabecera', () => {
    assert.deepEqual(extraerModifica('> **Modifica:** 0007, 0008\n'), ['0007', '0008']);
  });

  test('sin la línea, no declara nada', () => {
    assert.deepEqual(extraerModifica('# Spec 0025\n\nTexto cualquiera.'), []);
  });

  test('"ninguna" es una respuesta válida, no una lista vacía por olvido', () => {
    assert.deepEqual(extraerModifica('> **Modifica:** ninguna\n'), []);
  });

  test('las menciones del cuerpo NO son declaraciones', () => {
    // La sección "Dependencias" nombra media docena de specs. Tratarlas como
    // declaraciones llenaría el chequeo de falsos positivos hasta que alguien
    // lo apague — que es como muere un guardrail.
    const spec = `# Spec 0025

## 5. Dependencias
- 0007 — compras en cuotas.
- 0006 — cuentas.
- 0005 — Plata.`;
    assert.deepEqual(extraerModifica(spec), []);
  });
});

describe('extraerAbsorbidoPor', () => {
  test('reconoce que un AC se fue a otra spec', () => {
    const s = '- **AC5**: ~~Total comprometido~~ → **absorbido por AC1 de la spec 0025.**';
    assert.deepEqual(extraerAbsorbidoPor(s), ['0025']);
  });

  test('reconoce las otras formas de decir lo mismo', () => {
    assert.deepEqual(extraerAbsorbidoPor('reemplazado por la spec 0030'), ['0030']);
    assert.deepEqual(extraerAbsorbidoPor('movido a spec 0031'), ['0031']);
  });

  test('no confunde una dependencia con una absorción', () => {
    assert.deepEqual(extraerAbsorbidoPor('Depende de la spec 0005 para el reparto.'), []);
  });
});

describe('auditarEnlaces', () => {
  test('un enlace con las dos puntas está bien', () => {
    const r = auditarEnlaces([
      { id: '0025', fuente: '> **Modifica:** 0007\n' },
      { id: '0007', fuente: 'AC5 absorbido por AC1 de la spec 0025.' },
    ]);
    assert.deepEqual(r.sinAcuse, []);
    assert.deepEqual(r.sinDeclarar, []);
  });

  test('declarar que se modifica algo que no acusa recibo es el bug que motivó esto', () => {
    // Al cerrar "las cuotas viven adentro de Deudas" hubo que editar la 0007 a
    // mano. Si se olvidaba, la 0007 seguía prometiendo un total que ya vive en
    // otra spec — y no se notaba hasta construirla.
    const r = auditarEnlaces([
      { id: '0025', fuente: '> **Modifica:** 0007\n' },
      { id: '0007', fuente: 'Spec sin tocar, feliz de la vida.' },
    ]);
    assert.deepEqual(r.sinAcuse, [{ de: '0025', a: '0007' }]);
  });

  test('la dirección inversa también: editar abajo sin registrar arriba', () => {
    // Alguien tachó un AC de la 0007 y no lo anotó en la 0025. La mitad del
    // enlace que casi nadie mira.
    const r = auditarEnlaces([
      { id: '0025', fuente: '> **Modifica:** ninguna\n' },
      { id: '0007', fuente: 'AC5 absorbido por AC1 de la spec 0025.' },
    ]);
    assert.deepEqual(r.sinDeclarar, [{ modificada: '0007', por: '0025' }]);
  });

  test('modificar una spec que no existe', () => {
    const r = auditarEnlaces([{ id: '0025', fuente: '> **Modifica:** 0099\n' }]);
    assert.deepEqual(r.inexistentes, [{ de: '0025', a: '0099' }]);
  });

  test('una spec que se declara modificándose a sí misma se ignora, no explota', () => {
    const r = auditarEnlaces([{ id: '0025', fuente: '> **Modifica:** 0025\n' }]);
    assert.deepEqual(r, { inexistentes: [], sinAcuse: [], sinDeclarar: [] });
  });
});
