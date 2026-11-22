import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Share2, X } from 'lucide-react';
import { useApp } from '../state';
import { plainTextQr, qrToCanvas } from '../lib/qr';
import { formatMXN, plainAmount } from '../lib/money';
import { isPublicOrigin } from '../lib/payload';
import { ticketHost } from '../lib/platform';
import { appShareText } from '../lib/appShare';
import { changeSaleStatus } from '../lib/db';
import { vibrate } from '../lib/share';
import { StatusChip } from '../components/ui';

/** Pantalla que la vendedora le muestra al cliente para que escanee. */
export function QrView() {
  const { sales, qrSaleId, openQr, reload, toast, settings } = useApp();
  const sale = sales.find((s) => s.id === qrSaleId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [plain, setPlain] = useState(false);
  const publicUrl = sale ? isPublicOrigin(sale.ticketUrl) : true;

  const text = sale ? (plain && sale.account ? plainTextQr({ clabe: sale.account.clabe, amount: plainAmount(sale.totalCents), concept: sale.concept, beneficiary: sale.account.beneficiary }) : sale.ticketUrl) : '';

  useEffect(() => {
    if (!canvas.current || !text) return;
    const width = Math.min(window.innerWidth - 48, 420);
    qrToCanvas(canvas.current, text, width).catch(() => toast('No se pudo generar el QR', 'error'));
  }, [text, toast]);

  // Mantener la pantalla encendida mientras el cliente escanea
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  if (!sale) return null;
  const close = () => openQr(null);
  const seller = settings.profiles[sale.mode].displayName;

  const markPaid = async () => {
    await changeSaleStatus(sale.id, 'PAGADO', 'transferencia');
    await reload();
    vibrate(30);
    toast(`${sale.folio} marcada como pagada ✓`);
    close();
  };

  const share = async () => {
    const r = await appShareText({ title: `Ticket ${sale.folio}`, text: `Tu ticket de compra${seller ? ` con ${seller}` : ''} (${formatMXN(sale.totalCents)}):`, url: sale.ticketUrl });
    if (r === 'copied') toast('Enlace copiado: pégalo en WhatsApp');
  };

  return (
    <div className="qr-view" role="dialog" aria-modal="true" aria-label={`QR de la venta ${sale.folio}`}>
      <header className="qr-head">
        <div>
          <strong>Folio {sale.folio}</strong> <StatusChip status={sale.status} method={sale.method} />
        </div>
        <button className="icon-btn" onClick={close} aria-label="Cerrar">
          <X size={26} />
        </button>
      </header>

      {sale.demo && <div className="banner danger">DEMOSTRACIÓN · no es una venta real</div>}
      {!publicUrl && !plain && (
        <div className="banner warn">
          <AlertTriangle size={18} /> Este QR apunta a {sale.ticketUrl.split('/')[2] || ticketHost() || 'un archivo local'}: solo abrirá en esta red. Publica la app (ver README) para usarla en la convención.
        </div>
      )}

      <div className="qr-total">{formatMXN(sale.totalCents)}</div>
      <div className="qr-box">
        <canvas ref={canvas} aria-label="Código QR" />
      </div>
      <p className="qr-hint">
        {plain
          ? 'QR de respaldo: la cámara muestra el texto con la CLABE para copiarlo (no necesita abrir página).'
          : sale.method !== 'transferencia'
            ? 'Ticket del cliente (opcional): que lo escanee para guardar su comprobante.'
            : 'Pide al cliente que lo escanee con la cámara de su celular.'}
      </p>
      {sale.account && (
        <button className="link-btn" onClick={() => setPlain(!plain)}>
          {plain ? 'Volver al QR del ticket' : '¿No le abre la página? Mostrar QR solo con CLABE'}
        </button>
      )}

      <div className="qr-actions">
        {sale.status === 'PENDIENTE' && (
          <button className="btn success big" onClick={markPaid}>
            <Check size={24} /> Ya pagó
          </button>
        )}
        <div className="row">
          <button className="btn secondary" onClick={share}>
            <Share2 size={20} /> Enviar enlace
          </button>
          <button className="btn secondary" onClick={close}>
            {sale.status === 'PENDIENTE' ? 'Revisar luego' : 'Nueva venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
