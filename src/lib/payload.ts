/**
 * Ticket dentro del QR (sin servidor).
 *
 * El QR contiene un enlace a la página pública del ticket: https://.../t.html#DATOS
 * DATOS = JSON compacto en base64url. Va después del "#", así que el navegador NO lo envía
 * al servidor que aloja la página: los datos viajan solo del teléfono de la vendedora al del cliente.
 */
import type { Mode } from './types';
import { validateClabe } from './bankdata';
import { cartTotal } from './cart';
import { sanitizeHandle, LINK_TYPES } from './links';
import { deflateSync, inflateSync, strToU8 } from 'fflate';

export const PAYLOAD_VERSION = 1;

export interface TicketItem {
  name: string;
  qty: number;
  unitCents: number;
}

export interface TicketAccount {
  bankName: string;
  beneficiary: string;
  clabe: string;
  card?: string;
  accountNumber?: string;
  dimoPhone?: string;
}

export interface TicketPayload {
  mode: Mode;
  folio: string;
  date: number; // epoch ms (se guarda con precisión de segundos)
  seller: string;
  accent: string; // #rrggbb
  thanks: string;
  totalCents: number;
  items: TicketItem[] | null; // null = artículos ocultos (anonimato)
  itemCount: number;
  paidCash: boolean;
  account: TicketAccount | null;
  concept: string;
  reference: string;
  whatsapp: string;
  links: string[];
  demo: boolean;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Formato "z" + deflate + base64url: ~40% más corto => QR menos denso y más fácil de escanear. */
function packJson(json: string): string {
  return 'z' + bytesToBase64Url(deflateSync(strToU8(json), { level: 9 }));
}

function unpackJson(encoded: string): string {
  if (encoded[0] !== 'z') throw new PayloadError('Formato desconocido.');
  const bytes = inflateSync(base64UrlToBytes(encoded.slice(1)));
  if (bytes.length > 20000) throw new PayloadError('El enlace es demasiado grande.');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodePayload(p: TicketPayload): string {
  const acct = p.account
    ? [p.account.bankName, p.account.beneficiary, p.account.clabe, p.account.card ?? '', p.account.accountNumber ?? '', p.account.dimoPhone ?? '']
    : 0;
  const items = p.items ? p.items.map((i) => [i.name, i.qty, i.unitCents]) : 0;
  const arr = [
    PAYLOAD_VERSION,
    p.mode === 'adult' ? 1 : 0,
    p.folio,
    Math.floor(p.date / 1000),
    p.seller,
    p.accent.replace('#', ''),
    p.thanks,
    p.totalCents,
    items,
    p.itemCount,
    p.paidCash ? 1 : 0,
    acct,
    p.concept,
    p.reference,
    p.whatsapp,
    p.links,
    p.demo ? 1 : 0
  ];
  return packJson(JSON.stringify(arr));
}

export class PayloadError extends Error {}

const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function decodePayload(encoded: string): TicketPayload {
  let arr: unknown;
  try {
    arr = JSON.parse(unpackJson(encoded.trim()));
  } catch {
    throw new PayloadError('El enlace está incompleto o dañado.');
  }
  if (!Array.isArray(arr) || arr.length < 17) throw new PayloadError('El enlace está incompleto o dañado.');
  const [v, m, folio, dateSec, seller, accent, thanks, total, items, itemCount, paid, acct, concept, reference, whatsapp, links, demo] = arr;
  if (v !== PAYLOAD_VERSION) throw new PayloadError('Este ticket es de una versión no compatible.');
  if (!isStr(folio, 20) || !isInt(dateSec) || !isStr(seller, 60) || !isStr(thanks, 200) || !isInt(total) || !isInt(itemCount))
    throw new PayloadError('El ticket tiene datos inválidos.');
  if (!isStr(accent, 6) || !/^[0-9a-fA-F]{6}$/.test(accent)) throw new PayloadError('El ticket tiene datos inválidos.');
  if (!isStr(concept, 40) || !isStr(reference, 7) || !/^\d{0,7}$/.test(reference) || !isStr(whatsapp, 15) || !/^\d*$/.test(whatsapp))
    throw new PayloadError('El ticket tiene datos inválidos.');

  let parsedItems: TicketItem[] | null = null;
  if (items !== 0) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw new PayloadError('El ticket tiene artículos inválidos.');
    parsedItems = items.map((it) => {
      if (!Array.isArray(it) || !isStr(it[0], 80) || !isInt(it[1]) || it[1] === 0 || !isInt(it[2]))
        throw new PayloadError('El ticket tiene artículos inválidos.');
      return { name: it[0], qty: it[1], unitCents: it[2] };
    });
    if (cartTotal(parsedItems) !== total) throw new PayloadError('El total no coincide con los artículos.');
  }
  if (total <= 0) throw new PayloadError('El ticket tiene un total inválido.');

  let account: TicketAccount | null = null;
  if (acct !== 0) {
    if (!Array.isArray(acct) || acct.length < 6 || !acct.every((x) => isStr(x, 80))) throw new PayloadError('Los datos bancarios son inválidos.');
    const [bankName, beneficiary, clabe, card, accountNumber, dimoPhone] = acct as string[];
    if (!validateClabe(clabe).ok) throw new PayloadError('La CLABE del ticket no es válida.');
    if (![card, accountNumber, dimoPhone].every((x) => /^\d*$/.test(x))) throw new PayloadError('Los datos bancarios son inválidos.');
    account = {
      bankName,
      beneficiary,
      clabe,
      card: card || undefined,
      accountNumber: accountNumber || undefined,
      dimoPhone: dimoPhone || undefined
    };
  }
  if (!account && paid !== 1) throw new PayloadError('El ticket no tiene datos de pago.');

  const safeLinks = Array.isArray(links)
    ? links
        .filter((l): l is string => isStr(l, 60))
        .filter((l) => l.split(':')[0] in LINK_TYPES && sanitizeHandle(l.slice(l.indexOf(':') + 1)).length > 0)
        .slice(0, 3)
    : [];

  return {
    mode: m === 1 ? 'adult' : 'anime',
    folio,
    date: dateSec * 1000,
    seller,
    accent: `#${accent}`,
    thanks,
    totalCents: total,
    items: parsedItems,
    itemCount,
    paidCash: paid === 1,
    account,
    concept,
    reference,
    whatsapp,
    links: safeLinks,
    demo: demo === 1
  };
}

/** Construye la URL del ticket relativa a donde está publicada la app. */
export function buildTicketUrl(appHref: string, p: TicketPayload): string {
  const url = new URL('t.html', appHref);
  url.hash = encodePayload(p);
  return url.toString();
}

/** ¿El QR apunta a un sitio público? (localhost o IP local solo funcionan en la misma red) */
export function isPublicOrigin(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:') return false;
    return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);
  } catch {
    return false;
  }
}
