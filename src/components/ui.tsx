import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useApp, useBlobUrl } from '../state';
import type { Product, SaleStatus } from '../lib/types';

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={24} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Toast() {
  const { toastMsg } = useApp();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toastMsg) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, [toastMsg]);
  return (
    <div className={`toast ${toastMsg?.kind === 'error' ? 'error' : ''} ${visible ? 'show' : ''}`} role="status" aria-live="polite">
      {toastMsg?.text}
    </div>
  );
}

export function StatusChip({ status, method }: { status: SaleStatus; method?: string }) {
  const label = status === 'PAGADO' ? (method === 'efectivo' ? 'Pagado · efectivo' : 'Pagado') : status === 'PENDIENTE' ? 'Pendiente' : 'Cancelado';
  return <span className={`chip status-${status.toLowerCase()}`}>{label}</span>;
}

const TILE_COLORS = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#22d3ee'];

export function ProductThumb({ product, size = 56 }: { product: Pick<Product, 'name' | 'photo'>; size?: number }) {
  const url = useBlobUrl(product.photo);
  if (url) return <img className="thumb" src={url} alt="" style={{ width: size, height: size }} />;
  const color = TILE_COLORS[[...product.name].reduce((n, c) => n + c.charCodeAt(0), 0) % TILE_COLORS.length];
  const initials = product.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div className="thumb initials" style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials || '?'}
    </div>
  );
}

export function Field({ label, hint, error, children, counter }: { label: string; hint?: string; error?: string | null; children: ReactNode; counter?: string }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {counter && <span className="counter">{counter}</span>}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
