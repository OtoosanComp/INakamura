/** Modos de venta: convención anime normal o "modo oscuro" (+18). */
export type Mode = 'anime' | 'adult';

export const MODE_LABEL: Record<Mode, string> = {
  anime: 'Convención',
  adult: 'Modo oscuro +18'
};

export interface Product {
  id: string;
  mode: Mode;
  name: string;
  priceCents: number;
  category: string;
  /** null = sin control de existencias */
  stock: number | null;
  active: boolean;
  photo?: Blob;
  demo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SaleItem {
  productId: string | null;
  name: string;
  unitCents: number;
  qty: number;
}

export type SaleStatus = 'PENDIENTE' | 'PAGADO' | 'CANCELADO';
/** tarjeta = cobrada con una terminal o app externa (Clip, Mercado Pago Tap to Pay, etc.) */
export type PayMethod = 'transferencia' | 'efectivo' | 'tarjeta';

export const METHOD_LABEL: Record<PayMethod, string> = { transferencia: 'transferencia', efectivo: 'efectivo', tarjeta: 'tarjeta' };

export interface StatusChange {
  status: SaleStatus;
  method?: PayMethod;
  at: number;
}

export interface BankAccount {
  id: string;
  alias: string;
  bankName: string;
  beneficiary: string;
  clabe: string;
  accountNumber?: string;
  card?: string;
  dimoPhone?: string;
  active: boolean;
  demo?: boolean;
}

/** Copia histórica de la cuenta usada en la venta. */
export type AccountSnapshot = Omit<BankAccount, 'id' | 'active' | 'alias'>;

export interface Sale {
  id: string;
  folio: string;
  seq: number;
  mode: Mode;
  createdAt: number;
  items: SaleItem[];
  totalCents: number;
  status: SaleStatus;
  method: PayMethod;
  history: StatusChange[];
  account: AccountSnapshot | null;
  concept: string;
  reference: string;
  ticketUrl: string;
  demo: boolean;
}

export type LinkType = 'ig' | 'tt' | 'x' | 'fb' | 'yt' | 'tg' | 'of' | 'fs' | 'pt';

export interface ModeProfile {
  displayName: string;
  /** Mensaje que ve el cliente en su ticket */
  thanks: string;
  /** Texto del concepto de la transferencia (sale en el estado de cuenta del cliente) */
  conceptText: string;
  includeFolioInConcept: boolean;
  /** Mostrar los nombres de los artículos al cliente */
  showItems: boolean;
  accent: string;
  whatsapp: string;
  links: string[]; // "ig:usuario"
  accountId: string | null;
}

export interface Settings {
  id: 'main';
  onboarded: boolean;
  enabledModes: Mode[];
  currentMode: Mode;
  folioPrefix: string;
  nextSeq: number;
  profiles: Record<Mode, ModeProfile>;
}

export interface CartLine {
  key: string;
  productId: string | null;
  name: string;
  unitCents: number;
  qty: number;
  /** existencias máximas permitidas (null = sin límite) */
  maxQty: number | null;
  demo?: boolean;
}
