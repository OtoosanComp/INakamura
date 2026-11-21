/**
 * Almacenamiento local (IndexedDB). Todo vive en el teléfono; no hay servidor.
 * Esta capa es la única que toca la base de datos, para poder agregar
 * sincronización en la nube en una versión futura sin reescribir las pantallas.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BankAccount, CartLine, Mode, PayMethod, Product, Sale, SaleStatus, Settings } from './types';
import { defaultSettings, defaultProfile } from './defaults';
import { applyStatus, buildSale, SaleError } from './sale';

interface OtooDB extends DBSchema {
  settings: { key: string; value: Settings };
  products: { key: string; value: Product; indexes: { byMode: Mode } };
  accounts: { key: string; value: BankAccount };
  sales: { key: string; value: Sale; indexes: { byCreated: number } };
}

const DB_NAME = 'otoo-qr-pos';
let dbPromise: Promise<IDBPDatabase<OtooDB>> | null = null;

export function db(): Promise<IDBPDatabase<OtooDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OtooDB>(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('settings', { keyPath: 'id' });
        d.createObjectStore('products', { keyPath: 'id' }).createIndex('byMode', 'mode');
        d.createObjectStore('accounts', { keyPath: 'id' });
        d.createObjectStore('sales', { keyPath: 'id' }).createIndex('byCreated', 'createdAt');
      }
    });
  }
  return dbPromise;
}

/** Solo para pruebas */
export function _resetDbConnection() {
  dbPromise = null;
}

export function uid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  // randomUUID solo existe en HTTPS; en http local usamos getRandomValues
  const b = c.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('');
}

function normalizeSettings(s: Settings | undefined): Settings {
  const d = defaultSettings();
  if (!s) return d;
  return {
    ...d,
    ...s,
    profiles: {
      anime: { ...defaultProfile('anime'), ...s.profiles?.anime },
      adult: { ...defaultProfile('adult'), ...s.profiles?.adult }
    }
  };
}

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await (await db()).get('settings', 'main'));
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('settings', s);
}

// ---------- Productos ----------
export async function listProducts(): Promise<Product[]> {
  const all = await (await db()).getAll('products');
  return all.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function saveProduct(p: Product): Promise<void> {
  await (await db()).put('products', { ...p, updatedAt: Date.now() });
}

export async function deleteProduct(id: string): Promise<void> {
  await (await db()).delete('products', id);
}

// ---------- Cuentas ----------
export async function listAccounts(): Promise<BankAccount[]> {
  return (await db()).getAll('accounts');
}

export async function saveAccount(a: BankAccount): Promise<void> {
  await (await db()).put('accounts', a);
}

export async function deleteAccount(id: string): Promise<void> {
  const d = await db();
  await d.delete('accounts', id);
  const s = await getSettings();
  let changed = false;
  for (const m of ['anime', 'adult'] as Mode[]) {
    if (s.profiles[m].accountId === id) {
      s.profiles[m].accountId = null;
      changed = true;
    }
  }
  if (changed) await saveSettings(s);
}

// ---------- Ventas ----------
export async function listSales(): Promise<Sale[]> {
  const all = await (await db()).getAllFromIndex('sales', 'byCreated');
  return all.reverse();
}

export async function getSale(id: string): Promise<Sale | undefined> {
  return (await db()).get('sales', id);
}

export interface CreateSaleInput {
  /** id generado al abrir el cobro: si se toca dos veces "Cobrar", no se duplica la venta */
  id: string;
  mode: Mode;
  cart: CartLine[];
  accountId: string | null;
  method: PayMethod;
  appHref: string;
  now?: number;
}

/** Crea la venta en una sola transacción: folio, descuento de existencias y guardado. */
export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const d = await db();
  const existing = await d.get('sales', input.id);
  if (existing) return existing;

  const account = input.accountId ? (await d.get('accounts', input.accountId)) ?? null : null;
  const tx = d.transaction(['settings', 'products', 'sales'], 'readwrite');
  tx.done.catch(() => {
    /* el error real se lanza abajo */
  });
  try {
    const settings = normalizeSettings(await tx.objectStore('settings').get('main'));
    const productStore = tx.objectStore('products');

    // Verificar existencias con datos frescos
    const updates: Product[] = [];
    for (const line of input.cart) {
      if (!line.productId) continue;
      const p = await productStore.get(line.productId);
      if (!p) throw new SaleError(`El producto "${line.name}" ya no existe.`);
      if (!p.active) throw new SaleError(`"${p.name}" está desactivado.`);
      if (p.stock !== null) {
        if (p.stock < line.qty) throw new SaleError(`Solo quedan ${p.stock} de "${p.name}".`);
        updates.push({ ...p, stock: p.stock - line.qty, updatedAt: Date.now() });
      }
    }

    const sale = buildSale({
      id: input.id,
      seq: settings.nextSeq,
      settings,
      mode: input.mode,
      cart: input.cart,
      account,
      method: input.method,
      now: input.now ?? Date.now(),
      appHref: input.appHref
    });

    for (const u of updates) await productStore.put(u);
    await tx.objectStore('sales').add(sale);
    await tx.objectStore('settings').put({ ...settings, nextSeq: settings.nextSeq + 1 });
    await tx.done;
    return sale;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* ya terminada */
    }
    throw e;
  }
}

/** Cambio de estado manual. Al cancelar se regresan las existencias. */
export async function changeSaleStatus(id: string, to: SaleStatus, method?: PayMethod): Promise<Sale> {
  const d = await db();
  const tx = d.transaction(['sales', 'products'], 'readwrite');
  const sale = await tx.objectStore('sales').get(id);
  if (!sale) throw new SaleError('La venta no existe.');
  const updated = applyStatus(sale, to, method, Date.now());
  if (to === 'CANCELADO') {
    for (const item of sale.items) {
      if (!item.productId) continue;
      const p = await tx.objectStore('products').get(item.productId);
      if (p && p.stock !== null) await tx.objectStore('products').put({ ...p, stock: p.stock + item.qty, updatedAt: Date.now() });
    }
  }
  await tx.objectStore('sales').put(updated);
  await tx.done;
  return updated;
}

// ---------- Respaldo ----------
interface BackupFile {
  app: 'otoo-qr-pos';
  version: 1;
  exportedAt: number;
  settings: Settings;
  accounts: BankAccount[];
  products: (Omit<Product, 'photo'> & { photo?: string })[];
  sales: Sale[];
}

async function blobToDataUrl(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (const x of buf) bin += String.fromCharCode(x);
  return `data:${b.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob | undefined {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url);
  if (!m) return undefined;
  const bin = atob(m[2]);
  return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: m[1] });
}

export async function exportBackup(): Promise<string> {
  const d = await db();
  const products = await d.getAll('products');
  const file: BackupFile = {
    app: 'otoo-qr-pos',
    version: 1,
    exportedAt: Date.now(),
    settings: await getSettings(),
    accounts: await d.getAll('accounts'),
    products: await Promise.all(products.map(async (p) => ({ ...p, photo: p.photo ? await blobToDataUrl(p.photo) : undefined }))),
    sales: await d.getAll('sales')
  };
  return JSON.stringify(file);
}

export async function importBackup(json: string): Promise<void> {
  let file: BackupFile;
  try {
    file = JSON.parse(json);
  } catch {
    throw new Error('El archivo no es un respaldo válido.');
  }
  if (file?.app !== 'otoo-qr-pos' || file.version !== 1) throw new Error('El archivo no es un respaldo de Otoo QR POS.');
  const d = await db();
  const tx = d.transaction(['settings', 'products', 'accounts', 'sales'], 'readwrite');
  await Promise.all([tx.objectStore('products').clear(), tx.objectStore('accounts').clear(), tx.objectStore('sales').clear()]);
  await tx.objectStore('settings').put(normalizeSettings(file.settings));
  for (const a of file.accounts ?? []) await tx.objectStore('accounts').put(a);
  for (const p of file.products ?? []) await tx.objectStore('products').put({ ...p, photo: p.photo ? dataUrlToBlob(p.photo) : undefined });
  for (const s of file.sales ?? []) await tx.objectStore('sales').put(s);
  await tx.done;
}

export async function wipeAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['settings', 'products', 'accounts', 'sales'], 'readwrite');
  await Promise.all(['settings', 'products', 'accounts', 'sales'].map((s) => tx.objectStore(s as 'sales').clear()));
  await tx.done;
}

export async function removeDemoData(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['products', 'accounts', 'sales'], 'readwrite');
  for (const p of await tx.objectStore('products').getAll()) if (p.demo) await tx.objectStore('products').delete(p.id);
  for (const a of await tx.objectStore('accounts').getAll()) if (a.demo) await tx.objectStore('accounts').delete(a.id);
  for (const s of await tx.objectStore('sales').getAll()) if (s.demo) await tx.objectStore('sales').delete(s.id);
  await tx.done;
  const s = await getSettings();
  const ids = new Set((await listAccounts()).map((a) => a.id));
  for (const m of ['anime', 'adult'] as Mode[]) if (s.profiles[m].accountId && !ids.has(s.profiles[m].accountId!)) s.profiles[m].accountId = null;
  await saveSettings(s);
}

/** Pide al navegador no borrar los datos si el teléfono se queda sin espacio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
