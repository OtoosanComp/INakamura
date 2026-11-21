import { describe, expect, it } from 'vitest';
import { formatMXN, parseToCents, plainAmount } from '../src/lib/money';

describe('dinero', () => {
  it('convierte texto a centavos', () => {
    expect(parseToCents('450')).toBe(45000);
    expect(parseToCents('1,200.50')).toBe(120050);
    expect(parseToCents('$ 99.9')).toBe(9990);
    expect(parseToCents('0.05')).toBe(5);
    expect(parseToCents('-5')).toBeNull();
    expect(parseToCents('abc')).toBeNull();
    expect(parseToCents('1.234')).toBeNull();
    expect(parseToCents('')).toBeNull();
  });
  it('formatea importes', () => {
    expect(plainAmount(45000)).toBe('450.00');
    expect(plainAmount(5)).toBe('0.05');
    expect(plainAmount(120050)).toBe('1200.50');
    expect(formatMXN(120050)).toMatch(/\$1,200\.50/);
  });
  it('evita errores de punto flotante', () => {
    // 0.1 + 0.2 en flotantes = 0.30000000000000004
    expect(parseToCents('0.1')! + parseToCents('0.2')!).toBe(30);
  });
});
