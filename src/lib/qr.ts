import QRCode from 'qrcode';

/** Nivel M (15% de corrección): buen balance entre tamaño y lectura desde una pantalla. */
export const QR_OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 3 };

export async function qrToCanvas(canvas: HTMLCanvasElement, text: string, width: number) {
  await QRCode.toCanvas(canvas, text, { ...QR_OPTIONS, width, color: { dark: '#000000', light: '#ffffff' } });
}

export function qrToDataUrl(text: string, width = 600): Promise<string> {
  return QRCode.toDataURL(text, { ...QR_OPTIONS, width });
}

/** Versión del QR (1-40). Más alta = más denso. Arriba de ~25 cuesta leerlo de una pantalla. */
export function qrVersion(text: string): number {
  return QRCode.create(text, QR_OPTIONS).version;
}

/** QR de respaldo en texto plano (sin internet): la cámara del cliente permite copiar el texto. */
export function plainTextQr(d: { clabe: string; amount: string; concept: string; beneficiary: string }): string {
  return `CLABE: ${d.clabe}\nBeneficiario: ${d.beneficiary}\nImporte: ${d.amount}\nConcepto: ${d.concept}`;
}
