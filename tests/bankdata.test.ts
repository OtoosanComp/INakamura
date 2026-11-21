import { describe, expect, it } from 'vitest';
import { bankFromClabe, clabeCheckDigit, formatClabe, validateCard, validateClabe, validatePhone10 } from '../src/lib/bankdata';

describe('CLABE', () => {
  it('acepta una CLABE con dígito verificador correcto y detecta el banco', () => {
    const r = validateClabe('002010077777777771');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bankName).toBe('Banamex');
  });
  it('acepta espacios al pegar', () => {
    expect(validateClabe('002 010 07777777777 1').ok).toBe(true);
  });
  it('no basta con tener 18 dígitos', () => {
    const r = validateClabe('002010077777777772');
    expect(r.ok).toBe(false);
  });
  it('rechaza longitudes y letras', () => {
    expect(validateClabe('12345').ok).toBe(false);
    expect(validateClabe('00201007777777777A').ok).toBe(false);
  });
  it('calcula el dígito de control (pesos 3,7,1)', () => {
    // genera CLABEs válidas para varios bancos y verifica
    for (const prefix of ['012180', '072580', '638180', '722969']) {
      const body = (prefix + '01234567890').slice(0, 17);
      const clabe = body + clabeCheckDigit(body);
      expect(validateClabe(clabe).ok).toBe(true);
    }
    expect(bankFromClabe('012180')).toBe('BBVA México');
    expect(bankFromClabe('638')).toBe('Nu México');
    expect(bankFromClabe('999')).toBeNull();
  });
  it('formatea para leer', () => {
    expect(formatClabe('002010077777777771')).toBe('002 010 07777777777 1');
  });
});

describe('tarjeta y celular', () => {
  it('Luhn', () => {
    expect(validateCard('4111 1111 1111 1111')).toBeNull();
    expect(validateCard('4111 1111 1111 1112')).not.toBeNull();
    expect(validateCard('1234')).not.toBeNull();
  });
  it('celular 10 dígitos', () => {
    expect(validatePhone10('55 1234 5678')).toBeNull();
    expect(validatePhone10('12345')).not.toBeNull();
  });
});
