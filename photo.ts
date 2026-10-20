import type { LookProfile } from './profiles';

export async function renderLook(source: Blob, look: LookProfile): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo iniciar el editor de imagen.');
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const contrast = (259 * (look.contrast + 255)) / (255 * (259 - look.contrast));
  const sat = 1 + look.saturation / 100;
  const temp = look.temperature * 1.15;
  for (let i = 0; i < image.data.length; i += 4) {
    let r = image.data[i], g = image.data[i + 1], b = image.data[i + 2];
    r = contrast * (r - 128) + 128 + look.brightness + temp;
    g = contrast * (g - 128) + 128 + look.brightness;
    b = contrast * (b - 128) + 128 + look.brightness - temp;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    image.data[i] = clamp(gray + (r - gray) * sat);
    image.data[i + 1] = clamp(gray + (g - gray) * sat);
    image.data[i + 2] = clamp(gray + (b - gray) * sat);
  }
  ctx.putImageData(image, 0, 0);
  if (look.vignette > 0) {
    const radius = Math.max(canvas.width, canvas.height) * 0.78;
    const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, radius*0.25, canvas.width/2, canvas.height/2, radius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(look.vignette / 100, 0.45)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen.')), 'image/png'));
}
function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
