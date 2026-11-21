/**
 * Compartir desde la app de la vendedora.
 * En el APK (Android WebView) no existe la API web de compartir ni las descargas,
 * así que se usan los plugins nativos de Capacitor.
 */
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNative } from './platform';
import { copyText, downloadBlob, shareFile, shareOrCopy } from './share';

type Result = 'shared' | 'copied' | 'failed';

export async function appShareText(data: { title?: string; text?: string; url?: string }): Promise<Result> {
  if (!isNative()) return shareOrCopy(data);
  try {
    await Share.share({ ...data, dialogTitle: data.title ?? 'Compartir' });
    return 'shared';
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message))) return 'failed';
    return (await copyText([data.text, data.url].filter(Boolean).join(' '))) ? 'copied' : 'failed';
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

async function nativeShareFile(blob: Blob, filename: string, title: string): Promise<boolean> {
  const { uri } = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title, files: [uri], dialogTitle: title });
  } catch (e) {
    if (!/cancel/i.test(String((e as Error)?.message))) throw e;
  }
  return true;
}

/** Imagen del ticket: abre el menú de compartir (WhatsApp, Galería, etc.). */
export async function appShareFile(blob: Blob, filename: string, title: string): Promise<boolean> {
  return isNative() ? nativeShareFile(blob, filename, title) : shareFile(blob, filename, title);
}

/** Respaldo: en web se descarga; en el APK se comparte (Drive, WhatsApp, Archivos…). */
export async function appSaveFile(blob: Blob, filename: string, title: string): Promise<void> {
  if (isNative()) await nativeShareFile(blob, filename, title);
  else downloadBlob(blob, filename);
}
