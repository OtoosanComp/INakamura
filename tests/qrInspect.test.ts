import { describe, expect, it } from 'vitest';
import { analyzeQrText, crc16, findClabes, parseTlv } from '../src/lib/qrInspect';

// Construye un QR de pago estilo EMVCo con CRC correcto (formato de ejemplo, no es el oficial de Banxico)
function emv(fields: [string, string][]): string {
  const body = fields.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('') + '6304';
  return body + crc16(body);
}

describe('laboratorio QR', () => {
  it('CRC-16/CCITT-FALSE (valor de referencia "123456789" = 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('lee un QR estilo EMVCo con sub-campos y verifica el CRC', () => {
    const cuenta = '0010mx.spei.qr' + '0118002010077777777771';
    const text = emv([
      ['00', '01'],
      ['26', cuenta],
      ['54', '450.00'],
      ['58', 'MX'],
      ['62', '0513Compra A-0012']
    ]);
    const a = analyzeQrText(text);
    expect(a.kind).toBe('emv');
    if (a.kind !== 'emv') return;
    expect(a.crcOk).toBe(true);
    expect(a.fields.find((f) => f.tag === '54')?.value).toBe('450.00');
    expect(a.fields.find((f) => f.tag === '26')?.children?.[1]).toMatchObject({ tag: '01', value: '002010077777777771' });
    expect(findClabes(a)).toEqual([{ clabe: '002010077777777771', bank: 'Banamex' }]);
    // un cambio en el contenido rompe el CRC
    const tampered = text.replace('450.00', '999.00');
    expect((analyzeQrText(tampered) as { crcOk: boolean }).crcOk).toBe(false);
  });

  it('reconoce URL, JSON y texto plano', () => {
    expect(analyzeQrText('https://otoosancomp.github.io/INakamura/t.html#z1').kind).toBe('url');
    expect(analyzeQrText('{"TYP":20,"v":{"DEV":"x"}}')).toMatchObject({ kind: 'json', keys: ['TYP', 'v'] });
    const plain = analyzeQrText('CLABE: 002010077777777771');
    expect(plain.kind).toBe('text');
    expect(findClabes(plain)).toEqual([{ clabe: '002010077777777771', bank: 'Banamex' }]);
  });

  it('no confunde texto que empieza con 00 pero no es TLV', () => {
    expect(parseTlv('0099abc')).toBeNull();
    expect(analyzeQrText('002010077777777771').kind).toBe('text');
  });
});
