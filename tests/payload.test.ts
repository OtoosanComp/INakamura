import { describe, expect, it } from 'vitest';
import { buildTicketUrl, decodePayload, encodePayload, isPublicOrigin, PayloadError, type TicketPayload } from '../src/lib/payload';

const base: TicketPayload = {
  mode: 'anime',
  folio: 'A-0001',
  date: 1763600000000,
  seller: 'Persefone Cosplay ✨',
  accent: '#7c3aed',
  thanks: '¡Gracias por tu compra!',
  totalCents: 65000 + 48000 * 2,
  items: [
    { name: 'Peluca rosa', qty: 1, unitCents: 65000 },
    { name: 'Espada de foam', qty: 2, unitCents: 48000 }
  ],
  itemCount: 3,
  paidWith: null,
  account: { bankName: 'Banamex', beneficiary: 'María Pérez Núñez', clabe: '002010077777777771', dimoPhone: '5512345678' },
  concept: 'Compra A-0001',
  reference: '0000001',
  whatsapp: '5512345678',
  links: ['ig:persefone'],
  demo: false
};

describe('ticket dentro del enlace', () => {
  it('codifica y decodifica sin perder datos (acentos y emojis incluidos)', () => {
    const out = decodePayload(encodePayload(base));
    expect(out).toEqual({ ...base, account: { ...base.account, card: undefined, accountNumber: undefined } });
  });
  it('es URL-safe', () => {
    expect(encodePayload(base)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('construye la URL en la misma carpeta de la app', () => {
    const url = buildTicketUrl('https://otoosancomp.github.io/INakamura/', base);
    expect(url.startsWith('https://otoosancomp.github.io/INakamura/t.html#')).toBe(true);
    const url2 = buildTicketUrl('https://otoosancomp.github.io/INakamura/index.html', base);
    expect(url2.startsWith('https://otoosancomp.github.io/INakamura/t.html#')).toBe(true);
  });
  it('modo anónimo: sin artículos', () => {
    const out = decodePayload(encodePayload({ ...base, mode: 'adult', items: null }));
    expect(out.items).toBeNull();
    expect(out.itemCount).toBe(3);
    expect(out.mode).toBe('adult');
  });
  it('rechaza enlaces dañados o manipulados', () => {
    const enc = encodePayload(base);
    expect(() => decodePayload(enc.slice(0, enc.length - 10))).toThrow(PayloadError);
    expect(() => decodePayload('hola')).toThrow(PayloadError);
    // total que no coincide con los artículos
    expect(() => decodePayload(encodePayload({ ...base, totalCents: 100 }))).toThrow(/no coincide/);
    // CLABE inválida
    expect(() => decodePayload(encodePayload({ ...base, account: { ...base.account!, clabe: '002010077777777772' } }))).toThrow(/CLABE/);
  });
  it('filtra enlaces sociales peligrosos', () => {
    const out = decodePayload(encodePayload({ ...base, links: ['ig:ok', 'zz:malo', 'ig:'] }));
    expect(out.links).toEqual(['ig:ok']);
  });
  it('detecta si el QR apunta a un sitio público', () => {
    expect(isPublicOrigin('https://otoosancomp.github.io/INakamura/')).toBe(true);
    expect(isPublicOrigin('http://localhost:5173/')).toBe(false);
    expect(isPublicOrigin('http://192.168.1.5:5173/')).toBe(false);
  });
});
