import { describe, expect, it } from 'vitest';
import { applyStatus, buildSale, canChange, saleToPayload, summarize } from '../src/lib/sale';
import { decodePayload } from '../src/lib/payload';
import { account, testSettings } from './helpers';
import type { CartLine } from '../src/lib/types';

const cart: CartLine[] = [
  { key: 'p1', productId: 'p1', name: 'Peluca rosa', unitCents: 65000, qty: 1, maxQty: 5 },
  { key: 'p2', productId: 'p2', name: 'Espada de foam', unitCents: 48000, qty: 2, maxQty: null }
];
const href = 'https://otoosancomp.github.io/INakamura/';

describe('ventas', () => {
  it('crea venta por transferencia: folio, total, concepto, ticket', () => {
    const s = buildSale({ id: 'v1', seq: 7, settings: testSettings(), mode: 'anime', cart, account, method: 'transferencia', now: 1000, appHref: href });
    expect(s.folio).toBe('A-0007');
    expect(s.totalCents).toBe(161000);
    expect(s.status).toBe('PENDIENTE');
    expect(s.concept).toBe('Compra A-0007');
    expect(s.reference).toBe('0000007');
    const p = decodePayload(new URL(s.ticketUrl).hash.slice(1));
    expect(p.seller).toBe('Persefone Cosplay');
    expect(p.items?.length).toBe(2);
    expect(p.account?.beneficiary).toBe('María Pérez Núñez');
  });

  it('modo oscuro: concepto anónimo y artículos ocultos si se configura', () => {
    const st = testSettings();
    st.profiles.adult.includeFolioInConcept = false;
    st.profiles.adult.showItems = false;
    const s = buildSale({ id: 'v2', seq: 1, settings: st, mode: 'adult', cart, account, method: 'transferencia', now: 1000, appHref: href });
    expect(s.concept).toBe('Gracias por tu compra');
    const p = decodePayload(new URL(s.ticketUrl).hash.slice(1));
    expect(p.items).toBeNull();
    expect(p.mode).toBe('adult');
    expect(p.seller).toBe('Perse 🖤');
    expect(p.links).toEqual(['tg:perse_vip', 'of:perse']);
  });

  it('efectivo: queda pagada y el ticket no muestra cuenta', () => {
    const s = buildSale({ id: 'v3', seq: 2, settings: testSettings(), mode: 'anime', cart, account, method: 'efectivo', now: 1000, appHref: href });
    expect(s.status).toBe('PAGADO');
    expect(s.account).toBeNull();
    const p = decodePayload(new URL(s.ticketUrl).hash.slice(1));
    expect(p.paidWith).toBe('efectivo');
    expect(p.account).toBeNull();
  });

  it('tarjeta (terminal externa): pagada, sin cuenta, ticket "Pagado con tarjeta"', () => {
    const s = buildSale({ id: 'v5', seq: 4, settings: testSettings(), mode: 'anime', cart, account, method: 'tarjeta', now: 1000, appHref: href });
    expect(s.status).toBe('PAGADO');
    expect(s.account).toBeNull();
    const p = decodePayload(new URL(s.ticketUrl).hash.slice(1));
    expect(p.paidWith).toBe('tarjeta');
    expect(p.account).toBeNull();
    expect(summarize([s]).cardCents).toBe(161000);
    expect(summarize([s]).cashCents).toBe(0);
  });

  it('transferencia sin cuenta: error', () => {
    expect(() => buildSale({ id: 'x', seq: 1, settings: testSettings(), mode: 'anime', cart, account: null, method: 'transferencia', now: 1, appHref: href })).toThrow(/cuenta/);
  });

  it('una venta cancelada nunca puede pasar a pagada', () => {
    expect(canChange('PENDIENTE', 'PAGADO')).toBe(true);
    expect(canChange('CANCELADO', 'PAGADO')).toBe(false);
    expect(canChange('PAGADO', 'PENDIENTE')).toBe(false);
    const s = buildSale({ id: 'v4', seq: 3, settings: testSettings(), mode: 'anime', cart, account, method: 'transferencia', now: 1, appHref: href });
    const c = applyStatus(s, 'CANCELADO', undefined, 2);
    expect(() => applyStatus(c, 'PAGADO', 'transferencia', 3)).toThrow();
    expect(c.history.map((h) => h.status)).toEqual(['PENDIENTE', 'CANCELADO']);
  });

  it('resumen del día', () => {
    const st = testSettings();
    const t = buildSale({ id: 'a', seq: 1, settings: st, mode: 'anime', cart, account, method: 'transferencia', now: 1, appHref: href });
    const e = buildSale({ id: 'b', seq: 2, settings: st, mode: 'anime', cart, account, method: 'efectivo', now: 1, appHref: href });
    const paid = applyStatus(t, 'PAGADO', 'transferencia', 2);
    const pend = { ...t, id: 'c' };
    const canc = applyStatus({ ...t, id: 'd' }, 'CANCELADO', undefined, 2);
    const sum = summarize([paid, e, pend, canc]);
    expect(sum.count).toBe(3);
    expect(sum.totalCents).toBe(161000 * 3);
    expect(sum.paidCents).toBe(161000 * 2);
    expect(sum.cashCents).toBe(161000);
    expect(sum.transferCents).toBe(161000);
    expect(sum.pendingCount).toBe(1);
    expect(sum.cancelledCount).toBe(1);
  });

  it('el payload respeta la copia histórica aunque cambie el perfil', () => {
    const st = testSettings();
    const s = buildSale({ id: 'h', seq: 1, settings: st, mode: 'anime', cart, account, method: 'transferencia', now: 1, appHref: href });
    expect(saleToPayload(s, st).totalCents).toBe(161000);
  });
});
