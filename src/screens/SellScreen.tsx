import { useMemo, useRef, useState } from 'react';
import { Banknote, Minus, PackagePlus, Plus, QrCode, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useApp } from '../state';
import { Empty, Field, ProductThumb, Sheet } from '../components/ui';
import { cartCount, cartTotal, lineSubtotal, validateCart } from '../lib/cart';
import { formatMXN, parseToCents } from '../lib/money';
import { createSale, uid } from '../lib/db';
import type { PayMethod, Product } from '../lib/types';
import { vibrate } from '../lib/share';
import { ticketBaseHref } from '../lib/platform';

export function SellScreen() {
  const { products, mode, cart, cartAdd, openProductForm } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showFree, setShowFree] = useState(false);

  const available = useMemo(() => products.filter((p) => p.mode === mode && p.active), [products, mode]);
  const categories = useMemo(() => [...new Set(available.map((p) => p.category).filter(Boolean))].sort(), [available]);
  const visible = available.filter(
    (p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.category.toLowerCase().includes(q.toLowerCase()))
  );
  const inCart = (id: string) => cart.find((l) => l.key === id)?.qty ?? 0;

  const add = (p: Product) => {
    if (p.stock !== null && inCart(p.id) >= p.stock) return;
    vibrate();
    cartAdd({ key: p.id, productId: p.id, name: p.name, unitCents: p.priceCents, maxQty: p.stock, demo: p.demo });
  };

  const count = cartCount(cart);
  const total = cartTotal(cart);

  return (
    <div className="sell">
      {available.length > 0 && (
        <div className="filters">
          <div className="search">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" inputMode="search" />
          </div>
          {categories.length > 1 && (
            <div className="chips-row">
              <button className={`chip-btn ${!cat ? 'active' : ''}`} onClick={() => setCat(null)}>
                Todo
              </button>
              {categories.map((c) => (
                <button key={c} className={`chip-btn ${cat === c ? 'active' : ''}`} onClick={() => setCat(cat === c ? null : c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {available.length === 0 ? (
        <Empty
          icon={<PackagePlus size={40} />}
          title="Aún no tienes productos aquí"
          text="Agrega lo que vas a vender. También puedes cobrar un artículo libre escribiendo solo el precio."
          action={
            <div className="empty-actions">
              <button className="btn primary" onClick={() => openProductForm('new')}>
                <Plus size={20} /> Agregar producto
              </button>
              <button className="btn ghost" onClick={() => setShowFree(true)}>
                Cobrar artículo libre
              </button>
            </div>
          }
        />
      ) : (
        <div className="grid">
          {visible.map((p) => {
            const qty = inCart(p.id);
            const soldOut = p.stock !== null && p.stock <= 0;
            const maxed = p.stock !== null && qty >= p.stock;
            return (
              <button key={p.id} className={`tile ${qty ? 'selected' : ''} ${soldOut ? 'soldout' : ''}`} onClick={() => add(p)} disabled={soldOut}>
                <ProductThumb product={p} size={64} />
                <span className="tile-name">{p.name}</span>
                <span className="tile-price">{formatMXN(p.priceCents)}</span>
                {p.stock !== null && <span className={`tile-stock ${p.stock <= 2 ? 'low' : ''}`}>{soldOut ? 'Agotado' : maxed ? 'Sin más' : `Quedan ${p.stock - qty}`}</span>}
                {qty > 0 && <span className="tile-qty">{qty}</span>}
              </button>
            );
          })}
          <button className="tile free" onClick={() => setShowFree(true)}>
            <div className="thumb initials free-icon">
              <Plus size={28} />
            </div>
            <span className="tile-name">Artículo libre</span>
            <span className="tile-price muted">Escribe el precio</span>
          </button>
        </div>
      )}

      <div className={`cartbar ${count ? 'show' : ''}`}>
        <button className="cartbar-info" onClick={() => setShowCart(true)} disabled={!count}>
          <ShoppingCart size={22} />
          <span>
            {count} artículo{count === 1 ? '' : 's'}
          </span>
          <strong>{formatMXN(total)}</strong>
        </button>
        <button className="btn primary cobrar" onClick={() => setShowCart(true)} disabled={!count}>
          Cobrar
        </button>
      </div>

      {showCart && <Checkout onClose={() => setShowCart(false)} />}
      {showFree && <FreeItem onClose={() => setShowFree(false)} />}
    </div>
  );
}

function FreeItem({ onClose }: { onClose: () => void }) {
  const { cartAdd } = useApp();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const cents = parseToCents(price);
  const valid = cents !== null && cents > 0;
  const add = () => {
    if (!valid) return;
    cartAdd({ key: `free-${uid()}`, productId: null, name: name.trim() || 'Artículo', unitCents: cents!, maxQty: null });
    vibrate();
    onClose();
  };
  return (
    <Sheet
      title="Artículo libre"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!valid} onClick={add}>
          Agregar a la venta
        </button>
      }
    >
      <Field label="Precio" error={price && !valid ? 'Escribe un precio válido, por ejemplo 150' : null}>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="$0.00" autoFocus onKeyDown={(e) => e.key === 'Enter' && add()} />
      </Field>
      <Field label="Descripción (opcional)" hint="Ej. Comisión, foto extra, descuento de paquete…">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Artículo" />
      </Field>
    </Sheet>
  );
}

function Checkout({ onClose }: { onClose: () => void }) {
  const { cart, cartSetQty, cartClear, mode, settings, accounts, reload, openQr, toast, setTab } = useApp();
  const saleId = useRef(uid()); // mismo id aunque se toque dos veces => no se duplica
  const [busy, setBusy] = useState(false);
  const active = accounts.filter((a) => a.active);
  const [accountId, setAccountId] = useState<string | null>(() => {
    const pref = settings.profiles[mode].accountId;
    return active.find((a) => a.id === pref)?.id ?? active[0]?.id ?? null;
  });
  const total = cartTotal(cart);
  const error = validateCart(cart);

  const charge = async (method: PayMethod) => {
    if (busy || error) return;
    setBusy(true);
    try {
      const sale = await createSale({
        id: saleId.current,
        mode,
        cart,
        accountId: method === 'transferencia' ? accountId : null,
        method,
        appHref: ticketBaseHref()
      });
      cartClear();
      await reload();
      vibrate(30);
      onClose();
      if (method === 'transferencia') openQr(sale.id);
      else {
        toast(`Venta ${sale.folio} pagada en efectivo · ${formatMXN(sale.totalCents)}`);
        openQr(sale.id);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
      saleId.current = uid();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Venta actual"
      onClose={onClose}
      footer={
        <div className="checkout-actions">
          {active.length === 0 ? (
            <button
              className="btn primary"
              onClick={() => {
                onClose();
                setTab('ajustes');
              }}
            >
              Agrega tu cuenta bancaria para cobrar con QR
            </button>
          ) : (
            <button className="btn primary big" disabled={busy || !!error} onClick={() => charge('transferencia')}>
              <QrCode size={24} /> Generar QR · {formatMXN(total)}
            </button>
          )}
          <button className="btn secondary" disabled={busy || !!error} onClick={() => charge('efectivo')}>
            <Banknote size={22} /> Cobrar en efectivo
          </button>
        </div>
      }
    >
      {cart.length === 0 ? (
        <p className="muted center">La venta está vacía.</p>
      ) : (
        <ul className="cart-lines">
          {cart.map((l) => (
            <li key={l.key}>
              <div className="cl-info">
                <span className="cl-name">{l.name}</span>
                <span className="muted">{formatMXN(l.unitCents)} c/u</span>
              </div>
              <div className="stepper">
                <button aria-label="Quitar uno" onClick={() => cartSetQty(l.key, l.qty - 1)}>
                  {l.qty === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                </button>
                <span>{l.qty}</span>
                <button aria-label="Agregar uno" onClick={() => cartSetQty(l.key, l.qty + 1)} disabled={l.maxQty !== null && l.qty >= l.maxQty}>
                  <Plus size={18} />
                </button>
              </div>
              <span className="cl-sub">{formatMXN(lineSubtotal(l))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-total">
        <span>Total</span>
        <strong>{formatMXN(total)}</strong>
      </div>
      {active.length > 1 && (
        <Field label="Cuenta que recibe el pago">
          <select value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value)}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.alias || a.bankName} · {a.bankName} ••{a.clabe.slice(-4)}
                {a.demo ? ' (DEMO)' : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      {error && cart.length > 0 && <p className="field-error">{error}</p>}
      {cart.length > 0 && (
        <button
          className="btn ghost danger small"
          onClick={() => {
            if (window.confirm('¿Vaciar la venta?')) {
              cartClear();
              onClose();
            }
          }}
        >
          Vaciar venta
        </button>
      )}
    </Sheet>
  );
}
