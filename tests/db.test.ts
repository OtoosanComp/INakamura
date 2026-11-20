import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as store from '../src/lib/db';
import { account, testSettings } from './helpers';
import type { CartLine, Product } from '../src/lib/types';

const href = 'https://otoosancomp.github.io/INakamura/';

function product(id: string, stock: number | null, price = 10000): Product {
  return { id, mode: 'anime', name: `Prod ${id}`, priceCents: price, category: 'X', stock, active: true, createdAt: 1, updatedAt: 1 };
}

const line = (p: Product, qty: number): CartLine => ({ key: p.id, productId: p.id, name: p.name, unitCents: p.priceCents, qty, maxQty: p.stock });

beforeEach(async () => {
  await store.wipeAll();
  await store.saveSettings(testSettings());
  await store.saveAccount(account);
});

describe('almacenamiento', () => {
  it('folios consecutivos, descuento de existencias y no duplica', async () => {
    const p = product('p1', 5);
    await store.saveProduct(p);
    const s1 = await store.createSale({ id: 's1', mode: 'anime', cart: [line(p, 2)], accountId: 'acc1', method: 'transferencia', appHref: href });
    const again = await store.createSale({ id: 's1', mode: 'anime', cart: [line(p, 2)], accountId: 'acc1', method: 'transferencia', appHref: href });
    const s2 = await store.createSale({ id: 's2', mode: 'anime', cart: [line(p, 1)], accountId: 'acc1', method: 'efectivo', appHref: href });
    expect(s1.folio).toBe('A-0001');
    expect(again.id).toBe('s1');
    expect(s2.folio).toBe('A-0002');
    expect((await store.listSales()).length).toBe(2);
    const prods = await store.listProducts();
    expect(prods[0].stock).toBe(2);
  });

  it('no vende más de lo que hay y no deja datos a medias', async () => {
    const p = product('p1', 1);
    await store.saveProduct(p);
    await expect(store.createSale({ id: 's1', mode: 'anime', cart: [line(p, 3)], accountId: 'acc1', method: 'transferencia', appHref: href })).rejects.toThrow(/quedan 1/);
    expect(await store.listSales()).toHaveLength(0);
    expect((await store.getSettings()).nextSeq).toBe(1);
  });

  it('cancelar regresa existencias; cancelada no se puede marcar pagada', async () => {
    const p = product('p1', 3);
    await store.saveProduct(p);
    const s = await store.createSale({ id: 's1', mode: 'anime', cart: [line(p, 2)], accountId: 'acc1', method: 'transferencia', appHref: href });
    await store.changeSaleStatus(s.id, 'CANCELADO');
    expect((await store.listProducts())[0].stock).toBe(3);
    await expect(store.changeSaleStatus(s.id, 'PAGADO', 'transferencia')).rejects.toThrow();
  });

  it('cambiar el catálogo no cambia ventas anteriores', async () => {
    const p = product('p1', null, 10000);
    await store.saveProduct(p);
    await store.createSale({ id: 's1', mode: 'anime', cart: [line(p, 1)], accountId: 'acc1', method: 'transferencia', appHref: href });
    await store.saveProduct({ ...p, name: 'Otro nombre', priceCents: 99900 });
    const [sale] = await store.listSales();
    expect(sale.items[0]).toMatchObject({ name: 'Prod p1', unitCents: 10000 });
    expect(sale.totalCents).toBe(10000);
  });

  it('respaldo: exportar e importar', async () => {
    const p = product('p1', 4);
    await store.saveProduct(p);
    await store.createSale({ id: 's1', mode: 'anime', cart: [line(p, 1)], accountId: 'acc1', method: 'efectivo', appHref: href });
    const json = await store.exportBackup();
    await store.wipeAll();
    expect(await store.listSales()).toHaveLength(0);
    await store.importBackup(json);
    expect(await store.listSales()).toHaveLength(1);
    expect((await store.listProducts())[0].stock).toBe(3);
    expect((await store.getSettings()).nextSeq).toBe(2);
  });
});
