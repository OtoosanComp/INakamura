import type { CartLine, SaleItem } from './types';

export const MAX_QTY = 999;

export function addToCart(cart: CartLine[], line: Omit<CartLine, 'qty'>, qty = 1): CartLine[] {
  if (qty <= 0) return cart;
  const existing = cart.find((l) => l.key === line.key);
  if (existing) return setQty(cart, line.key, existing.qty + qty);
  const capped = capQty(qty, line.maxQty);
  if (capped <= 0) return cart;
  return [...cart, { ...line, qty: capped }];
}

function capQty(qty: number, max: number | null): number {
  const limit = max === null ? MAX_QTY : Math.min(max, MAX_QTY);
  return Math.max(0, Math.min(Math.floor(qty), limit));
}

/** Cambia la cantidad; 0 o menos elimina la línea. Nunca deja cantidades negativas. */
export function setQty(cart: CartLine[], key: string, qty: number): CartLine[] {
  return cart
    .map((l) => (l.key === key ? { ...l, qty: capQty(qty, l.maxQty) } : l))
    .filter((l) => l.qty > 0);
}

export function removeLine(cart: CartLine[], key: string): CartLine[] {
  return cart.filter((l) => l.key !== key);
}

export function lineSubtotal(l: { unitCents: number; qty: number }): number {
  return l.unitCents * l.qty;
}

export function cartTotal(cart: { unitCents: number; qty: number }[]): number {
  return cart.reduce((sum, l) => sum + lineSubtotal(l), 0);
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}

/** Valida el carrito antes de crear la venta. Devuelve un mensaje de error o null. */
export function validateCart(cart: CartLine[]): string | null {
  if (cart.length === 0) return 'Agrega al menos un artículo.';
  for (const l of cart) {
    if (!l.name.trim()) return 'Hay un artículo sin nombre.';
    if (!Number.isInteger(l.qty) || l.qty <= 0) return `Cantidad inválida en "${l.name}".`;
    if (!Number.isInteger(l.unitCents) || l.unitCents < 0) return `Precio inválido en "${l.name}".`;
    if (l.maxQty !== null && l.qty > l.maxQty) return `Solo quedan ${l.maxQty} de "${l.name}".`;
  }
  if (cartTotal(cart) <= 0) return 'El total no puede ser $0.';
  return null;
}

/** Copia histórica: nombre y precio quedan congelados en la venta. */
export function cartToItems(cart: CartLine[]): SaleItem[] {
  return cart.map((l) => ({ productId: l.productId, name: l.name.trim(), unitCents: l.unitCents, qty: l.qty }));
}
