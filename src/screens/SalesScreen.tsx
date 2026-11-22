import { useMemo, useState } from 'react';
import { Banknote, Check, CreditCard, Receipt, Search } from 'lucide-react';
import { useApp } from '../state';
import { Empty, StatusChip } from '../components/ui';
import { startOfDay, summarize } from '../lib/sale';
import { formatMXN } from '../lib/money';
import { changeSaleStatus } from '../lib/db';
import { formatDateTime, formatTime, vibrate } from '../lib/share';
import { MODE_LABEL, type Mode, type SaleStatus } from '../lib/types';

type Range = 'hoy' | 'ayer' | '7d' | 'todo';
const RANGES: { id: Range; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: 'todo', label: 'Todo' }
];
const STATUSES: { id: SaleStatus | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'PENDIENTE', label: 'Pendientes' },
  { id: 'PAGADO', label: 'Pagadas' },
  { id: 'CANCELADO', label: 'Canceladas' }
];

export function SalesScreen() {
  const { sales, settings, openDetail, reload, toast } = useApp();
  const [range, setRange] = useState<Range>('hoy');
  const [status, setStatus] = useState<SaleStatus | 'todas'>('todas');
  const [modeFilter, setModeFilter] = useState<Mode | 'todos'>('todos');
  const [q, setQ] = useState('');

  const inRange = useMemo(() => {
    const today = startOfDay(Date.now());
    const day = 86_400_000;
    return sales.filter((s) => {
      if (modeFilter !== 'todos' && s.mode !== modeFilter) return false;
      if (range === 'hoy') return s.createdAt >= today;
      if (range === 'ayer') return s.createdAt >= today - day && s.createdAt < today;
      if (range === '7d') return s.createdAt >= today - 6 * day;
      return true;
    });
  }, [sales, range, modeFilter]);

  const sum = summarize(inRange);
  const query = q.trim().toLowerCase();
  const list = inRange.filter(
    (s) => (status === 'todas' || s.status === status) && (!query || s.folio.toLowerCase().includes(query) || s.items.some((i) => i.name.toLowerCase().includes(query)))
  );

  const quickPaid = async (id: string, folio: string) => {
    await changeSaleStatus(id, 'PAGADO', 'transferencia');
    await reload();
    vibrate(30);
    toast(`${folio} pagada ✓`);
  };

  return (
    <div className="sales">
      <div className="chips-row">
        {RANGES.map((r) => (
          <button key={r.id} className={`chip-btn ${range === r.id ? 'active' : ''}`} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <section className="summary">
        <div className="sum-main">
          <span>Vendido</span>
          <strong>{formatMXN(sum.totalCents)}</strong>
          <span className="muted">
            {sum.count} venta{sum.count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="sum-grid">
          <div>
            <span>Cobrado</span>
            <strong className="ok">{formatMXN(sum.paidCents)}</strong>
          </div>
          <button className="sum-pending" onClick={() => setStatus('PENDIENTE')}>
            <span>Por confirmar ({sum.pendingCount})</span>
            <strong className="warn">{formatMXN(sum.pendingCents)}</strong>
          </button>
          <div>
            <span>Transferencia</span>
            <strong>{formatMXN(sum.transferCents)}</strong>
          </div>
          <div>
            <span>Efectivo</span>
            <strong>{formatMXN(sum.cashCents)}</strong>
          </div>
          {sum.cardCents > 0 && (
            <div>
              <span>Tarjeta</span>
              <strong>{formatMXN(sum.cardCents)}</strong>
            </div>
          )}
        </div>
      </section>

      <div className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio o producto" inputMode="search" />
      </div>
      <div className="chips-row">
        {STATUSES.map((s) => (
          <button key={s.id} className={`chip-btn ${status === s.id ? 'active' : ''}`} onClick={() => setStatus(s.id)}>
            {s.label}
          </button>
        ))}
        {settings.enabledModes.length > 1 &&
          (['todos', 'anime', 'adult'] as const).map((m) => (
            <button key={m} className={`chip-btn ${modeFilter === m ? 'active' : ''}`} onClick={() => setModeFilter(m)}>
              {m === 'todos' ? 'Ambos modos' : MODE_LABEL[m]}
            </button>
          ))}
      </div>

      {list.length === 0 ? (
        <Empty icon={<Receipt size={40} />} title="Sin ventas aquí" text={sales.length ? 'Prueba con otro filtro o fecha.' : 'Tus ventas aparecerán aquí.'} />
      ) : (
        <ul className="sale-list">
          {list.map((s) => (
            <li key={s.id} className={`sale-row ${s.status.toLowerCase()}`}>
              <button className="sale-main" onClick={() => openDetail(s.id)}>
                <div className="sale-top">
                  <strong>{s.folio}</strong>
                  <span className="muted">{range === 'hoy' ? formatTime(s.createdAt) : formatDateTime(s.createdAt)}</span>
                  {s.mode === 'adult' && settings.enabledModes.length > 1 && <span className="mini">+18</span>}
                  {s.demo && <span className="mini danger">DEMO</span>}
                </div>
                <span className="sale-items">
                  {s.items[0]?.name}
                  {s.items.length > 1 ? ` + ${s.items.length - 1} más` : s.items[0]?.qty > 1 ? ` ×${s.items[0].qty}` : ''}
                </span>
                <div className="sale-bottom">
                  <StatusChip status={s.status} method={s.method} />
                  {s.method === 'efectivo' && s.status === 'PAGADO' && <Banknote size={16} className="muted" />}
                  {s.method === 'tarjeta' && s.status === 'PAGADO' && <CreditCard size={16} className="muted" />}
                </div>
              </button>
              <div className="sale-side">
                <strong className="sale-total">{formatMXN(s.totalCents)}</strong>
                {s.status === 'PENDIENTE' && (
                  <button className="btn success small" onClick={() => quickPaid(s.id, s.folio)} aria-label={`Marcar ${s.folio} como pagada`}>
                    <Check size={18} /> Pagó
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
