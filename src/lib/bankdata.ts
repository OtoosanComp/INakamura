/**
 * Validación de datos bancarios de México.
 * La CLABE tiene 18 dígitos: banco (3) + plaza (3) + cuenta (11) + dígito de control (1).
 * El dígito de control usa los pesos 3,7,1 (algoritmo publicado por Banxico).
 */

/** Códigos de banco más comunes (primeros 3 dígitos de la CLABE). Es una sugerencia: el nombre es editable. */
export const BANKS: Record<string, string> = {
  '002': 'Banamex',
  '006': 'Bancomext',
  '009': 'Banobras',
  '012': 'BBVA México',
  '014': 'Santander',
  '019': 'Banjército',
  '021': 'HSBC',
  '030': 'BanBajío',
  '036': 'Inbursa',
  '042': 'Mifel',
  '044': 'Scotiabank',
  '058': 'Banregio / Hey Banco',
  '059': 'Invex',
  '060': 'Bansi',
  '062': 'Afirme',
  '072': 'Banorte',
  '106': 'Bank of America',
  '108': 'MUFG',
  '110': 'JP Morgan',
  '112': 'Banco Monex',
  '113': 'Ve por Más',
  '127': 'Banco Azteca',
  '128': 'Autofin',
  '130': 'Compartamos',
  '132': 'Multiva',
  '133': 'Actinver',
  '135': 'Nafin',
  '136': 'Intercam',
  '137': 'BanCoppel',
  '138': 'ABC Capital',
  '140': 'Consubanco',
  '141': 'Volkswagen Bank',
  '143': 'CIBanco',
  '145': 'Banco Base',
  '147': 'Bankaool',
  '148': 'PagaTodo',
  '150': 'Inmobiliario Mexicano',
  '151': 'Dondé Banco',
  '152': 'Bancrea',
  '155': 'ICBC',
  '156': 'Sabadell',
  '157': 'Shinhan',
  '158': 'Mizuho',
  '159': 'Bank of China',
  '166': 'Banco del Bienestar',
  '638': 'Nu México',
  '646': 'STP',
  '722': 'Mercado Pago',
  '728': 'Spin by OXXO'
};

const WEIGHTS = [3, 7, 1];

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export function clabeCheckDigit(first17: string): number {
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (Number(first17[i]) * WEIGHTS[i % 3]) % 10;
  return (10 - (sum % 10)) % 10;
}

export type ClabeResult =
  | { ok: true; clabe: string; bankCode: string; bankName: string | null }
  | { ok: false; error: string };

export function validateClabe(input: string): ClabeResult {
  const clabe = onlyDigits(input);
  if (input.replace(/[\s-]/g, '') !== clabe) return { ok: false, error: 'La CLABE solo lleva números.' };
  if (clabe.length !== 18) return { ok: false, error: `La CLABE debe tener 18 dígitos (tiene ${clabe.length}).` };
  if (clabeCheckDigit(clabe.slice(0, 17)) !== Number(clabe[17]))
    return { ok: false, error: 'La CLABE no es válida (el dígito verificador no coincide). Revísala.' };
  const bankCode = clabe.slice(0, 3);
  return { ok: true, clabe, bankCode, bankName: BANKS[bankCode] ?? null };
}

export function bankFromClabe(clabe: string): string | null {
  const d = onlyDigits(clabe);
  return d.length >= 3 ? BANKS[d.slice(0, 3)] ?? null : null;
}

/** Algoritmo de Luhn para números de tarjeta. */
export function validateCard(input: string): string | null {
  const d = onlyDigits(input);
  if (input.replace(/[\s-]/g, '') !== d) return 'La tarjeta solo lleva números.';
  if (d.length < 15 || d.length > 16) return 'La tarjeta debe tener 16 dígitos.';
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0 ? null : 'El número de tarjeta no es válido. Revísalo.';
}

export function validatePhone10(input: string): string | null {
  const d = onlyDigits(input);
  return d.length === 10 ? null : 'El celular debe tener 10 dígitos.';
}

export function validateAccountNumber(input: string): string | null {
  const d = onlyDigits(input);
  if (input.replace(/[\s-]/g, '') !== d) return 'La cuenta solo lleva números.';
  return d.length >= 8 && d.length <= 20 ? null : 'El número de cuenta debe tener entre 8 y 20 dígitos.';
}

/** "002010077777777771" -> "002 010 07777777777 1" para leerla fácil (al copiar se copia sin espacios). */
export function formatClabe(clabe: string): string {
  const d = onlyDigits(clabe);
  if (d.length !== 18) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 17)} ${d.slice(17)}`;
}

export function formatGroups4(n: string): string {
  return onlyDigits(n).replace(/(\d{4})(?=\d)/g, '$1 ');
}
