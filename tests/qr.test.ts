import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QR_OPTIONS, qrVersion } from '../src/lib/qr';
import { buildTicketUrl, decodePayload, type TicketPayload } from '../src/lib/payload';

/** Dibuja el QR en una imagen RGBA (como lo vería una cámara) y lo lee con jsQR. */
function renderAndRead(text: string): string | null {
  const qr = QRCode.create(text, QR_OPTIONS);
  const scale = 4;
  const margin = 4;
  const n = qr.modules.size;
  const size = (n + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return jsQR(data, size, size)?.data ?? null;
}

function sale(itemsCount: number): TicketPayload {
  const items = Array.from({ length: itemsCount }, (_, i) => ({ name: `Artículo de cosplay ${i + 1}`, qty: 1 + (i % 3), unitCents: 15000 + i * 1000 }));
  return {
    mode: 'anime',
    folio: 'A-0123',
    date: Date.now(),
    seller: 'Persefone Cosplay',
    accent: '#7c3aed',
    thanks: '¡Gracias por tu compra! Nos vemos en la próxima convención ✨',
    totalCents: items.reduce((s, i) => s + i.qty * i.unitCents, 0),
    items,
    itemCount: items.reduce((s, i) => s + i.qty, 0),
    paidCash: false,
    account: { bankName: 'BBVA México', beneficiary: 'María Fernanda Pérez Núñez', clabe: '002010077777777771', dimoPhone: '5512345678' },
    concept: 'Compra A-0123',
    reference: '0000123',
    whatsapp: '5512345678',
    links: ['ig:persefone.cosplay', 'tt:persefone'],
    demo: false
  };
}

describe('QR', () => {
  it('genera un QR que se puede leer y recuperar el ticket completo', () => {
    const p = sale(3);
    const url = buildTicketUrl('https://otoosancomp.github.io/INakamura/', p);
    const read = renderAndRead(url);
    expect(read).toBe(url);
    const decoded = decodePayload(new URL(read!).hash.slice(1));
    expect(decoded.totalCents).toBe(p.totalCents);
    expect(decoded.account?.clabe).toBe('002010077777777771');
    expect(decoded.items).toHaveLength(3);
  });

  it('cada venta produce un QR distinto', () => {
    const a = buildTicketUrl('https://x.github.io/', { ...sale(2), folio: 'A-0001' });
    const b = buildTicketUrl('https://x.github.io/', { ...sale(2), folio: 'A-0002' });
    expect(a).not.toBe(b);
  });

  it('una venta típica (hasta 5 artículos) cabe en un QR legible desde pantalla', () => {
    const url = buildTicketUrl('https://otoosancomp.github.io/INakamura/', sale(5));
    const v = qrVersion(url);
    console.log(`5 artículos: ${url.length} caracteres, QR versión ${v}`);
    expect(v).toBeLessThanOrEqual(18);
    expect(renderAndRead(url)).toBe(url);
  });

  it('ventas grandes (12 artículos) siguen siendo legibles', () => {
    const url = buildTicketUrl('https://otoosancomp.github.io/INakamura/', sale(12));
    console.log(`12 artículos: ${url.length} caracteres, QR versión ${qrVersion(url)}`);
    expect(renderAndRead(url)).toBe(url);
  });
});
