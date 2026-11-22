/**
 * Análisis del contenido de un QR (para descubrir el formato oficial del "QR para recibir" de SPEI).
 * Banxico (Guías v1.1, vigentes desde el 14/12/2026) remite al "Apéndice AS del Manual de Operación del SPEI",
 * que no está publicado. Con esta herramienta se lee un QR real generado por una app bancaria y se ve su estructura.
 */
import { validateClabe } from './bankdata';

export interface TlvField {
  tag: string;
  length: number;
  value: string;
  children?: TlvField[];
}

export type QrAnalysis =
  | { kind: 'url'; host: string; text: string }
  | { kind: 'json'; keys: string[]; text: string }
  | { kind: 'emv'; fields: TlvField[]; crcOk: boolean | null; text: string }
  | { kind: 'text'; text: string };

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF): el que usan los QR de pago EMVCo (campo 63). */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Lee una cadena TAG(2) + LARGO(2) + VALOR. Devuelve null si no tiene esa estructura completa. */
export function parseTlv(text: string): TlvField[] | null {
  const out: TlvField[] = [];
  let i = 0;
  while (i < text.length) {
    const tag = text.slice(i, i + 2);
    const lenStr = text.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) return null;
    const length = Number(lenStr);
    const value = text.slice(i + 4, i + 4 + length);
    if (value.length !== length) return null;
    out.push({ tag, length, value });
    i += 4 + length;
  }
  return out.length ? out : null;
}

// Plantillas EMVCo que contienen sub-campos: 26-51 (cuentas), 62 (datos adicionales), 64 (idioma), 80-99 (privados)
const TEMPLATE = (tag: string) => {
  const n = Number(tag);
  return (n >= 26 && n <= 51) || n === 62 || n === 64 || n >= 80;
};

export function analyzeQrText(text: string): QrAnalysis {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) {
    try {
      return { kind: 'url', host: new URL(t).host, text: t };
    } catch {
      /* sigue */
    }
  }
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t);
      return { kind: 'json', keys: typeof j === 'object' && j ? Object.keys(j) : [], text: t };
    } catch {
      /* sigue */
    }
  }
  if (t.startsWith('00')) {
    const fields = parseTlv(t);
    if (fields) {
      for (const f of fields) if (TEMPLATE(f.tag)) f.children = parseTlv(f.value) ?? undefined;
      const crcField = fields.find((f) => f.tag === '63');
      const crcOk = crcField ? crc16(t.slice(0, t.length - 4)) === crcField.value.toUpperCase() : null;
      return { kind: 'emv', fields, crcOk, text: t };
    }
  }
  return { kind: 'text', text: t };
}

/**
 * CLABEs válidas (dígito verificador correcto) dentro del QR.
 * En formatos TLV la CLABE va pegada a otros números, así que se revisa campo por campo.
 */
export function findClabes(a: QrAnalysis): { clabe: string; bank: string | null }[] {
  const candidates: string[] = [];
  if (a.kind === 'emv') {
    const walk = (fs: TlvField[]) => fs.forEach((f) => (f.children ? walk(f.children) : candidates.push(f.value)));
    walk(a.fields);
  } else {
    candidates.push(...(a.text.match(/(?<!\d)\d{18}(?!\d)/g) ?? []));
  }
  const found = new Map<string, string | null>();
  for (const c of candidates) {
    const r = validateClabe(c);
    if (r.ok) found.set(r.clabe, r.bankName);
  }
  return [...found].map(([clabe, bank]) => ({ clabe, bank }));
}
