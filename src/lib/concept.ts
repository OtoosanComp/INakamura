/** Reglas para concepto y referencia de una transferencia SPEI. */

export const CONCEPT_MAX = 40; // límite SPEI
export const CONCEPT_TEXT_MAX = 30; // deja espacio para " FOLIO"
export const THANKS_MAX = 120;
export const NAME_MAX = 40;

/** Muchas apps bancarias rechazan acentos y símbolos en el concepto. */
export function sanitizeConcept(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/[^A-Za-z0-9 .,-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CONCEPT_MAX);
}

export function buildConcept(text: string, folio: string, includeFolio: boolean): string {
  const base = text.trim() || 'Compra';
  return sanitizeConcept(includeFolio ? `${base.slice(0, CONCEPT_TEXT_MAX)} ${folio}` : base);
}

/** Referencia numérica SPEI: hasta 7 dígitos. */
export function buildReference(seq: number): string {
  return String(seq % 10_000_000).padStart(7, '0');
}

export function sanitizeFolioPrefix(p: string): string {
  return p.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'A';
}

export function buildFolio(prefix: string, seq: number): string {
  return `${sanitizeFolioPrefix(prefix)}-${String(seq).padStart(4, '0')}`;
}
