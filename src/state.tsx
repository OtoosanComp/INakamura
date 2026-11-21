import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BankAccount, CartLine, Mode, Product, Sale, Settings } from './lib/types';
import * as store from './lib/db';
import { addToCart, removeLine, setQty } from './lib/cart';

export type Tab = 'vender' | 'ventas' | 'productos' | 'ajustes';

interface AppState {
  ready: boolean;
  settings: Settings;
  products: Product[];
  accounts: BankAccount[];
  sales: Sale[];
  mode: Mode;
  tab: Tab;
  setTab: (t: Tab) => void;
  reload: () => Promise<void>;
  updateSettings: (fn: (s: Settings) => Settings) => Promise<void>;
  setMode: (m: Mode) => Promise<void>;
  cart: CartLine[];
  cartAdd: (line: Omit<CartLine, 'qty'>) => void;
  cartSetQty: (key: string, qty: number) => void;
  cartRemove: (key: string) => void;
  cartClear: () => void;
  toast: (msg: string, kind?: 'ok' | 'error') => void;
  toastMsg: { text: string; kind: 'ok' | 'error'; id: number } | null;
  /** venta abierta en la pantalla del QR */
  qrSaleId: string | null;
  openQr: (id: string | null) => void;
  detailSaleId: string | null;
  openDetail: (id: string | null) => void;
  editProduct: Product | 'new' | null;
  openProductForm: (p: Product | 'new' | null) => void;
}

const Ctx = createContext<AppState | null>(null);

/** Carrito en curso (temporal). Las ventas e inventario viven en IndexedDB, no aquí. */
const CART_KEY = 'otoo-cart-en-curso';
function loadCart(): CartLine[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CART_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.key === 'string' && Number.isInteger(l.qty) && l.qty > 0) : [];
  } catch {
    return [];
  }
}

export function useApp(): AppState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tab, setTab] = useState<Tab>('vender');
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [toastMsg, setToast] = useState<AppState['toastMsg']>(null);
  const [qrSaleId, openQr] = useState<string | null>(null);
  const [detailSaleId, openDetail] = useState<string | null>(null);
  const [editProduct, openProductForm] = useState<Product | 'new' | null>(null);
  const toastId = useRef(0);

  const reload = useCallback(async () => {
    const [s, p, a, v] = await Promise.all([store.getSettings(), store.listProducts(), store.listAccounts(), store.listSales()]);
    setSettings(s);
    setProducts(p);
    setAccounts(a);
    setSales(v);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // La venta en curso sobrevive si Android cierra la app (p. ej. al abrir la cámara o el banco)
  useEffect(() => {
    try {
      if (cart.length) localStorage.setItem(CART_KEY, JSON.stringify(cart));
      else localStorage.removeItem(CART_KEY);
    } catch {
      /* sin espacio: no es crítico */
    }
  }, [cart]);

  const updateSettings = useCallback(
    async (fn: (s: Settings) => Settings) => {
      const current = await store.getSettings();
      const next = fn(structuredClone(current));
      await store.saveSettings(next);
      setSettings(next);
    },
    []
  );

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    toastId.current++;
    setToast({ text, kind, id: toastId.current });
  }, []);

  const mode: Mode = settings ? (settings.enabledModes.includes(settings.currentMode) ? settings.currentMode : settings.enabledModes[0] ?? 'anime') : 'anime';

  const setMode = useCallback(
    async (m: Mode) => {
      setCart([]);
      await updateSettings((s) => ({ ...s, currentMode: m }));
    },
    [updateSettings]
  );

  const value = useMemo<AppState | null>(
    () =>
      settings
        ? {
            ready,
            settings,
            products,
            accounts,
            sales,
            mode,
            tab,
            setTab,
            reload,
            updateSettings,
            setMode,
            cart,
            cartAdd: (line) => setCart((c) => addToCart(c, line)),
            cartSetQty: (key, qty) => setCart((c) => setQty(c, key, qty)),
            cartRemove: (key) => setCart((c) => removeLine(c, key)),
            cartClear: () => setCart([]),
            toast,
            toastMsg,
            qrSaleId,
            openQr,
            detailSaleId,
            openDetail,
            editProduct,
            openProductForm
          }
        : null,
    [ready, settings, products, accounts, sales, mode, tab, reload, updateSettings, setMode, cart, toast, toastMsg, qrSaleId, detailSaleId, editProduct]
  );

  if (!value) return <div className="splash">Otoo QR POS</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** URL de un Blob (foto) que se libera sola. */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
