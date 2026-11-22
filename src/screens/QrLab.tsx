import { useRef, useState } from 'react';
import { Copy, ImageUp } from 'lucide-react';
import { Sheet } from '../components/ui';
import { analyzeQrText, findClabes, type QrAnalysis, type TlvField } from '../lib/qrInspect';
import { copyText } from '../lib/share';
import { useApp } from '../state';

const EMV_LABELS: Record<string, string> = {
  '00': 'Versión del formato',
  '01': 'Tipo (11 = fijo, 12 = un solo pago)',
  '52': 'Giro del comercio',
  '53': 'Moneda (484 = MXN)',
  '54': 'Monto',
  '58': 'País',
  '59': 'Nombre',
  '60': 'Ciudad',
  '62': 'Datos adicionales',
  '63': 'Verificación (CRC)'
};

async function decodeImage(file: File): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Fields({ fields, depth = 0 }: { fields: TlvField[]; depth?: number }) {
  return (
    <ul className="tlv" style={{ marginLeft: depth * 14 }}>
      {fields.map((f, i) => (
        <li key={i}>
          <code>{f.tag}</code> <span className="muted">{depth === 0 ? EMV_LABELS[f.tag] ?? (Number(f.tag) >= 26 && Number(f.tag) <= 51 ? 'Datos de la cuenta' : '') : ''}</span>
          {f.children ? <Fields fields={f.children} depth={depth + 1} /> : <div className="tlv-value">{f.value}</div>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Laboratorio: lee el QR "para recibir" que generan las apps bancarias (Banxico, desde el 14/12/2026)
 * para conocer su formato y que Otoo pueda generarlo igual.
 */
export function QrLab({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QrAnalysis | null>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const text = await decodeImage(file);
      if (!text) toast('No encontré un QR en la imagen. Prueba con una captura más nítida.', 'error');
      else setResult(analyzeQrText(text));
    } catch {
      toast('No se pudo leer la imagen', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clabes = result ? findClabes(result) : [];
  const kindLabel = result
    ? { url: 'Enlace web', json: 'Datos JSON (posible CoDi)', emv: 'Formato de pago EMVCo (TLV)', text: 'Texto' }[result.kind]
    : '';

  return (
    <Sheet title="Laboratorio QR bancario" onClose={onClose}>
      <p className="field-hint">
        Desde el 14 de diciembre de 2026 las apps bancarias deben generar un <strong>QR para recibir</strong> (con CLABE y, opcionalmente, monto, concepto y referencia) y deben
        poder leerlo para llenar la transferencia sola. Su formato aún no es público.
      </p>
      <ol className="field-hint">
        <li>En tu app del banco busca “Recibir” / “Cobrar con QR”. Genera uno con monto y concepto.</li>
        <li>Descarga la imagen o toma una captura.</li>
        <li>Cárgala aquí y toca “Copiar contenido”. Mándaselo a tu desarrollador.</li>
      </ol>
      <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
        <ImageUp size={20} /> {busy ? 'Leyendo…' : 'Cargar imagen del QR'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} />

      {result && (
        <div className="lab-result">
          <p>
            <strong>Tipo:</strong> {kindLabel}
            {result.kind === 'emv' && result.crcOk !== null && <span className={`mini ${result.crcOk ? '' : 'danger'}`}>{result.crcOk ? 'CRC correcto' : 'CRC no coincide'}</span>}
          </p>
          {clabes.map((c) => (
            <p key={c.clabe}>
              <strong>CLABE encontrada:</strong> {c.clabe} {c.bank && <span className="muted">({c.bank})</span>}
            </p>
          ))}
          {result.kind === 'url' && (
            <p>
              <strong>Sitio:</strong> {result.host}
            </p>
          )}
          {result.kind === 'json' && (
            <p>
              <strong>Campos:</strong> {result.keys.join(', ')}
            </p>
          )}
          {result.kind === 'emv' && <Fields fields={result.fields} />}
          <pre className="lab-raw">{result.text}</pre>
          <button
            className="btn secondary"
            onClick={async () => {
              const ok = await copyText(result.text);
              toast(ok ? 'Contenido copiado' : 'No se pudo copiar', ok ? 'ok' : 'error');
            }}
          >
            <Copy size={18} /> Copiar contenido
          </button>
        </div>
      )}
    </Sheet>
  );
}
