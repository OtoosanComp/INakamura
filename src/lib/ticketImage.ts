/**
 * Dibuja el ticket como imagen PNG (para guardar o mandar por WhatsApp).
 * Sin librerías: canvas puro. Lo usan la app de la vendedora y la página del cliente.
 */
import type { TicketPayload } from './payload';
import { formatMXN } from './money';
import { formatClabe } from './bankdata';
import { formatDateTime } from './share';

const W = 600;
const PAD = 40;

export async function renderTicketPng(p: TicketPayload, opts: { qrDataUrl?: string; status?: string } = {}): Promise<Blob> {
  const scale = 2;
  const dark = p.mode === 'adult';
  const bg = dark ? '#121016' : '#ffffff';
  const fg = dark ? '#f4f1f8' : '#17141c';
  const muted = dark ? '#a9a1b5' : '#6b6475';
  const line = dark ? '#2c2734' : '#e6e1ec';

  // Medimos alto aproximado primero
  const rows = p.items?.length ?? 1;
  const height = 420 + rows * 52 + (p.account ? 230 : 60) + (opts.qrDataUrl ? 340 : 0) + (p.thanks ? 70 : 0) + (p.demo ? 60 : 0);

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, height);

  const font = (size: number, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  let y = 0;

  // Franja de color
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 0, W, 10);
  y = 60;

  if (p.demo) {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(PAD, y - 30, W - PAD * 2, 44);
    ctx.fillStyle = '#fff';
    ctx.font = font(18, 700);
    ctx.textAlign = 'center';
    ctx.fillText('DEMOSTRACIÓN — NO TRANSFERIR', W / 2, y);
    y += 60;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = fg;
  ctx.font = font(28, 800);
  ctx.fillText(fit(ctx, p.seller, W - PAD * 2), W / 2, y);
  y += 30;
  ctx.fillStyle = muted;
  ctx.font = font(16);
  ctx.fillText(`Folio ${p.folio} · ${formatDateTime(p.date)}`, W / 2, y);
  y += 26;
  if (opts.status) {
    ctx.fillStyle = p.accent;
    ctx.font = font(16, 700);
    ctx.fillText(opts.status, W / 2, y);
    y += 22;
  }
  y += 10;
  hr();

  ctx.textAlign = 'left';
  if (p.items) {
    for (const it of p.items) {
      ctx.fillStyle = fg;
      ctx.font = font(18, 600);
      ctx.fillText(fit(ctx, it.name, W - PAD * 2 - 140), PAD, y + 22);
      ctx.textAlign = 'right';
      ctx.fillText(formatMXN(it.unitCents * it.qty), W - PAD, y + 22);
      ctx.textAlign = 'left';
      ctx.fillStyle = muted;
      ctx.font = font(14);
      ctx.fillText(`${it.qty} × ${formatMXN(it.unitCents)}`, PAD, y + 42);
      y += 52;
    }
  } else {
    ctx.fillStyle = fg;
    ctx.font = font(18, 600);
    ctx.fillText(`${p.itemCount} artículo${p.itemCount === 1 ? '' : 's'}`, PAD, y + 26);
    y += 52;
  }
  y += 8;
  hr();

  ctx.fillStyle = fg;
  ctx.font = font(22, 700);
  ctx.fillText('TOTAL', PAD, y + 34);
  ctx.textAlign = 'right';
  ctx.font = font(34, 800);
  ctx.fillText(formatMXN(p.totalCents), W - PAD, y + 36);
  ctx.textAlign = 'left';
  y += 64;

  if (p.paidWith) {
    ctx.fillStyle = '#16a34a';
    ctx.font = font(18, 700);
    ctx.fillText(p.paidWith === 'tarjeta' ? 'Pagado con tarjeta' : 'Pagado en efectivo', PAD, y + 10);
    y += 40;
  } else if (p.account) {
    hr();
    const field = (label: string, value: string) => {
      ctx.fillStyle = muted;
      ctx.font = font(14);
      ctx.fillText(label, PAD, y + 18);
      ctx.fillStyle = fg;
      ctx.font = font(18, 600);
      ctx.fillText(fit(ctx, value, W - PAD * 2), PAD, y + 42);
      y += 54;
    };
    field('Banco', p.account.bankName);
    field('Beneficiario', p.account.beneficiary);
    field('CLABE', formatClabe(p.account.clabe));
    field('Concepto', p.concept);
  }

  if (opts.qrDataUrl) {
    const img = await loadImage(opts.qrDataUrl);
    const size = 300;
    ctx.fillStyle = '#fff';
    ctx.fillRect((W - size) / 2 - 10, y + 10, size + 20, size + 20);
    ctx.drawImage(img, (W - size) / 2, y + 20, size, size);
    y += size + 40;
  }

  if (p.thanks) {
    ctx.textAlign = 'center';
    ctx.fillStyle = fg;
    ctx.font = font(17, 500);
    ctx.fillText(fit(ctx, p.thanks, W - PAD * 2), W / 2, y + 30);
    y += 50;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = muted;
  ctx.font = font(12);
  ctx.fillText('Ticket digital de venta · No es comprobante fiscal (CFDI) · Otoo QR POS', W / 2, height - 20);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));

  function hr() {
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 12;
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
