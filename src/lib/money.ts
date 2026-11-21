/** Todo el dinero se maneja en centavos (enteros) para evitar errores de redondeo. */

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function formatMXN(cents: number): string {
  return fmt.format(cents / 100);
}

/** Importe sin símbolo ni comas, como lo piden las apps bancarias: 1250.00 */
export function plainAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Convierte texto como "450", "1,200.50", "$ 99.9" a centavos. Devuelve null si no es válido. */
export function parseToCents(input: string): number | null {
  const clean = input.replace(/[\s$,]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [int, dec = ''] = clean.split('.');
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : plainAmount(cents);
}
