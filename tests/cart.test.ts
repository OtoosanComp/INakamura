import { describe, expect, it } from 'vitest';
import { addToCart, cartCount, cartToItems, cartTotal, removeLine, setQty, validateCart } from '../src/lib/cart';
import type { CartLine } from '../src/lib/types';

const peluca = { key: 'p1', productId: 'p1', name: 'Peluca', unitCents: 65000, maxQty: 5 };
const espada = { key: 'p2', productId: 'p2', name: 'Espada', unitCents: 48000, maxQty: null };

describe('carrito', () => {
  it('suma varios productos y cantidades', () => {
    let c: CartLine[] = [];
    c = addToCart(c, peluca);
    c = addToCart(c, espada, 2);
    c = addToCart(c, peluca);
    expect(c).toHaveLength(2);
    expect(cartCount(c)).toBe(4);
    expect(cartTotal(c)).toBe(65000 * 2 + 48000 * 2); // $2,260.00
  });
  it('no permite cantidades negativas ni pasar las existencias', () => {
    let c = addToCart([], peluca, 3);
    c = setQty(c, 'p1', -4);
    expect(c).toHaveLength(0);
    c = addToCart([], peluca, 50);
    expect(c[0].qty).toBe(5);
    c = setQty(c, 'p1', 2.7);
    expect(c[0].qty).toBe(2);
  });
  it('elimina líneas', () => {
    const c = removeLine(addToCart(addToCart([], peluca), espada), 'p1');
    expect(c.map((l) => l.key)).toEqual(['p2']);
  });
  it('valida ventas vacías, en cero o inválidas', () => {
    expect(validateCart([])).toMatch(/al menos/);
    expect(validateCart([{ ...espada, unitCents: 0, qty: 1 }])).toMatch(/\$0/);
    expect(validateCart([{ ...peluca, qty: 9 }])).toMatch(/quedan 5/);
    expect(validateCart([{ ...espada, qty: 1 }])).toBeNull();
  });
  it('copia histórica del nombre y precio', () => {
    const c = addToCart([], { ...espada, name: '  Espada  ' });
    const items = cartToItems(c);
    expect(items).toEqual([{ productId: 'p2', name: 'Espada', unitCents: 48000, qty: 1 }]);
  });
  it('agotado: no agrega', () => {
    expect(addToCart([], { ...peluca, maxQty: 0 })).toHaveLength(0);
  });
});
