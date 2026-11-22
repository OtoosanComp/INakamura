import { Banknote, Check, CreditCard, Download, ExternalLink, QrCode, Share2, XCircle } from 'lucide-react';
import { useApp } from '../state';
import { Sheet, StatusChip } from '../components/ui';
import { formatMXN } from '../lib/money';
import { changeSaleStatus } from '../lib/db';
import { canChange } from '../lib/sale';
import { decodePayload } from '../lib/payload';
import { renderTicketPng } from '../lib/ticketImage';
import { qrToDataUrl } from '../lib/qr';
import { formatDateTime } from '../lib/share';
import { appShareFile, appShareText } from '../lib/appShare';
import { formatClabe } from '../lib/bankdata';
import { MODE_LABEL, type PayMethod, type SaleStatus } from '../lib/types';

const STATUS_TEXT: Record<SaleStatus, string> = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', CANCELADO: 'Cancelado' };

export function SaleDetail() {
  const { sales, detailSaleId, openDetail, openQr, reload, toast, settings } = useApp();
  const sale = sales.find((s) => s.id === detailSaleId);
  if (!sale) return null;
  const close = () => openDetail(null);

  const change = async (to: SaleStatus, method?: PayMethod) => {
    if (to === 'CANCELADO' && !confirm(`¿Cancelar la venta ${sale.folio}? Las existencias regresan al inventario. Esto no se puede deshacer.`)) return;
    try {
      await changeSaleStatus(sale.id, to, method);
      await reload();
      toast(`${sale.folio}: ${STATUS_TEXT[to].toLowerCase()}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const downloadTicket = async () => {
    try {
      const payload = decodePayload(new URL(sale.ticketUrl).hash.slice(1));
      const statusText =
        sale.status === 'CANCELADO' ? 'CANCELADO' : sale.status === 'PAGADO' ? (sale.method === 'efectivo' ? 'PAGADO · EFECTIVO' : sale.method === 'tarjeta' ? 'PAGADO · TARJETA' : 'PAGADO') : 'PENDIENTE DE PAGO';
      const blob = await renderTicketPng(
        { ...payload, paidWith: sale.status === 'PAGADO' && sale.method !== 'transferencia' ? sale.method : null },
        { qrDataUrl: sale.status === 'PENDIENTE' ? await qrToDataUrl(sale.ticketUrl) : undefined, status: statusText }
      );
      await appShareFile(blob, `ticket-${sale.folio}.png`, `Ticket ${sale.folio}`);
    } catch {
      toast('No se pudo crear la imagen', 'error');
    }
  };

  const shareLink = async () => {
    const seller = settings.profiles[sale.mode].displayName;
    const r = await appShareText({ title: `Ticket ${sale.folio}`, text: `Tu ticket de compra${seller ? ` con ${seller}` : ''} (${formatMXN(sale.totalCents)}):`, url: sale.ticketUrl });
    if (r === 'copied') toast('Enlace copiado');
  };

  return (
    <Sheet title={`Venta ${sale.folio}`} onClose={close}>
      <div className="detail-head">
        <StatusChip status={sale.status} method={sale.method} />
        <span className="muted">{formatDateTime(sale.createdAt)}</span>
        {settings.enabledModes.length > 1 && <span className="mini">{MODE_LABEL[sale.mode]}</span>}
        {sale.demo && <span className="mini danger">DEMO</span>}
      </div>

      <ul className="detail-items">
        {sale.items.map((i, idx) => (
          <li key={idx}>
            <span>
              {i.qty} × {i.name}
              <small className="muted"> ({formatMXN(i.unitCents)})</small>
            </span>
            <span>{formatMXN(i.qty * i.unitCents)}</span>
          </li>
        ))}
        <li className="detail-total">
          <span>Total</span>
          <strong>{formatMXN(sale.totalCents)}</strong>
        </li>
      </ul>

      {sale.account && (
        <dl className="detail-data">
          <dt>Cuenta</dt>
          <dd>
            {sale.account.bankName} · {formatClabe(sale.account.clabe)}
          </dd>
          <dt>Concepto</dt>
          <dd>{sale.concept}</dd>
          <dt>Referencia</dt>
          <dd>{sale.reference}</dd>
        </dl>
      )}

      <div className="detail-actions">
        {sale.status === 'PENDIENTE' && (
          <>
            <button className="btn success" onClick={() => change('PAGADO', 'transferencia')}>
              <Check size={20} /> Pagó por transferencia
            </button>
            <div className="row">
              <button className="btn secondary" onClick={() => change('PAGADO', 'efectivo')}>
                <Banknote size={20} /> Efectivo
              </button>
              <button className="btn secondary" onClick={() => change('PAGADO', 'tarjeta')}>
                <CreditCard size={20} /> Tarjeta
              </button>
            </div>
          </>
        )}
        {sale.status !== 'CANCELADO' && (
          <button
            className="btn secondary"
            onClick={() => {
              close();
              openQr(sale.id);
            }}
          >
            <QrCode size={20} /> Mostrar QR
          </button>
        )}
        <div className="row">
          <button className="btn secondary" onClick={shareLink}>
            <Share2 size={18} /> Enlace
          </button>
          <button className="btn secondary" onClick={downloadTicket}>
            <Download size={18} /> Imagen
          </button>
          <a className="btn secondary" href={sale.ticketUrl} target="_blank" rel="noopener">
            <ExternalLink size={18} /> Ver
          </a>
        </div>
        {canChange(sale.status, 'CANCELADO') && (
          <button className="btn ghost danger" onClick={() => change('CANCELADO')}>
            <XCircle size={20} /> Cancelar venta
          </button>
        )}
      </div>

      <h3 className="section-title">Historial</h3>
      <ul className="history">
        {sale.history.map((h, i) => (
          <li key={i}>
            <span>
              {STATUS_TEXT[h.status]}
              {h.method && h.status === 'PAGADO' ? ` (${h.method})` : ''}
            </span>
            <span className="muted">{formatDateTime(h.at)}</span>
          </li>
        ))}
      </ul>
      {sale.status !== 'PENDIENTE' && (
        <p className="field-hint">
          Nota: el QR y el enlace guardan los datos del momento en que se generaron; el cliente no ve cambios de estado posteriores.
        </p>
      )}
    </Sheet>
  );
}
