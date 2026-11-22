import type { BankAccount, CartLine, Mode, PayMethod, Sale, Settings, SaleStatus } from './types';
import { cartToItems, cartTotal, validateCart } from './cart';
import { buildConcept, buildFolio, buildReference } from './concept';
import { buildTicketUrl, type TicketPayload } from './payload';

export interface BuildSaleArgs {
  id: string;
  seq: number;
  settings: Settings;
  mode: Mode;
  cart: CartLine[];
  account: BankAccount | null;
  method: PayMethod;
  now: number;
  appHref: string;
}

export class SaleError extends Error {}

export function buildSale(a: BuildSaleArgs): Sale {
  const err = validateCart(a.cart);
  if (err) throw new SaleError(err);
  if (a.method === 'transferencia' && !a.account) throw new SaleError('Configura una cuenta bancaria para cobrar por transferencia.');
  const profile = a.settings.profiles[a.mode];
  const folio = buildFolio(a.settings.folioPrefix, a.seq);
  const items = cartToItems(a.cart);
  const totalCents = cartTotal(items);
  const status: SaleStatus = a.method === 'transferencia' ? 'PENDIENTE' : 'PAGADO';
  const account =
    a.method === 'transferencia' && a.account
      ? {
          bankName: a.account.bankName,
          beneficiary: a.account.beneficiary,
          clabe: a.account.clabe,
          card: a.account.card,
          accountNumber: a.account.accountNumber,
          dimoPhone: a.account.dimoPhone,
          demo: a.account.demo
        }
      : null;
  const demo = Boolean(a.account?.demo) || a.cart.some((l) => l.demo);
  const concept = buildConcept(profile.conceptText, folio, profile.includeFolioInConcept);
  const reference = buildReference(a.seq);
  const sale: Sale = {
    id: a.id,
    folio,
    seq: a.seq,
    mode: a.mode,
    createdAt: a.now,
    items,
    totalCents,
    status,
    method: a.method,
    history: [{ status, method: a.method, at: a.now }],
    account,
    concept,
    reference,
    ticketUrl: '',
    demo
  };
  sale.ticketUrl = buildTicketUrl(a.appHref, saleToPayload(sale, a.settings));
  return sale;
}

export function saleToPayload(sale: Sale, settings: Settings): TicketPayload {
  const profile = settings.profiles[sale.mode];
  return {
    mode: sale.mode,
    folio: sale.folio,
    date: sale.createdAt,
    seller: profile.displayName.trim() || 'Vendedora',
    accent: profile.accent,
    thanks: profile.thanks.trim(),
    totalCents: sale.totalCents,
    items: profile.showItems ? sale.items.map((i) => ({ name: i.name, qty: i.qty, unitCents: i.unitCents })) : null,
    itemCount: sale.items.reduce((n, i) => n + i.qty, 0),
    paidWith: sale.status === 'PAGADO' && sale.method !== 'transferencia' ? sale.method : null,
    account: sale.account
      ? {
          bankName: sale.account.bankName,
          beneficiary: sale.account.beneficiary,
          clabe: sale.account.clabe,
          card: sale.account.card,
          accountNumber: sale.account.accountNumber,
          dimoPhone: sale.account.dimoPhone
        }
      : null,
    concept: sale.concept,
    reference: sale.reference,
    whatsapp: profile.whatsapp.replace(/\D/g, ''),
    links: profile.links,
    demo: sale.demo
  };
}

/**
 * Transiciones permitidas (siempre manuales):
 * PENDIENTE -> PAGADO | CANCELADO
 * PAGADO    -> CANCELADO (devolución)
 * CANCELADO -> (ninguna: una venta cancelada nunca puede presentarse como pagada)
 */
export function canChange(from: SaleStatus, to: SaleStatus): boolean {
  if (from === to) return false;
  if (from === 'CANCELADO') return false;
  if (from === 'PAGADO') return to === 'CANCELADO';
  return true;
}

export function applyStatus(sale: Sale, to: SaleStatus, method: PayMethod | undefined, now: number): Sale {
  if (!canChange(sale.status, to)) throw new SaleError(`No se puede pasar de ${sale.status} a ${to}.`);
  const m = to === 'PAGADO' ? method ?? sale.method : sale.method;
  return { ...sale, status: to, method: m, history: [...sale.history, { status: to, method: to === 'PAGADO' ? m : undefined, at: now }] };
}

export interface DaySummary {
  count: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  pendingCount: number;
  cashCents: number;
  cardCents: number;
  transferCents: number;
  cancelledCount: number;
}

export function summarize(sales: Sale[]): DaySummary {
  const s: DaySummary = { count: 0, totalCents: 0, paidCents: 0, pendingCents: 0, pendingCount: 0, cashCents: 0, cardCents: 0, transferCents: 0, cancelledCount: 0 };
  for (const x of sales) {
    if (x.status === 'CANCELADO') {
      s.cancelledCount++;
      continue;
    }
    s.count++;
    s.totalCents += x.totalCents;
    if (x.status === 'PAGADO') {
      s.paidCents += x.totalCents;
      if (x.method === 'efectivo') s.cashCents += x.totalCents;
      else if (x.method === 'tarjeta') s.cardCents += x.totalCents;
      else s.transferCents += x.totalCents;
    } else {
      s.pendingCents += x.totalCents;
      s.pendingCount++;
    }
  }
  return s;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
