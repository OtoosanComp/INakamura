import { describe, expect, it } from 'vitest';
import { buildConcept, buildFolio, buildReference, sanitizeConcept } from '../src/lib/concept';

describe('concepto y folio', () => {
  it('quita acentos y símbolos que rechazan los bancos', () => {
    expect(sanitizeConcept('Gracias por tu compra 🖤 ñandú!')).toBe('Gracias por tu compra nandu');
  });
  it('máximo 40 caracteres', () => {
    expect(buildConcept('x'.repeat(80), 'A-0001', true).length).toBeLessThanOrEqual(40);
    expect(buildConcept('x'.repeat(80), 'A-0001', true).endsWith('A-0001')).toBe(true);
  });
  it('anonimato: concepto sin folio', () => {
    expect(buildConcept('Gracias por tu compra', 'A-0001', false)).toBe('Gracias por tu compra');
  });
  it('folio y referencia numérica de 7 dígitos', () => {
    expect(buildFolio('ab', 12)).toBe('AB-0012');
    expect(buildFolio('', 1)).toBe('A-0001');
    expect(buildReference(12)).toBe('0000012');
    expect(buildReference(12)).toHaveLength(7);
  });
});
