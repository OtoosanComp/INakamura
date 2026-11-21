import { Capacitor } from '@capacitor/core';
import { isPublicOrigin } from './payload';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim() || '';

/**
 * Dirección base para los enlaces de los tickets (lo que va dentro del QR).
 * - App web publicada (GitHub Pages, Netlify…): su propia dirección.
 * - APK o pruebas locales: la dirección pública configurada en VITE_PUBLIC_URL.
 */
export function ticketBaseHref(): string {
  const here = location.href.split('#')[0];
  if (!isNative() && isPublicOrigin(here)) return here;
  return PUBLIC_URL || here;
}

export function ticketHost(): string {
  try {
    return new URL(ticketBaseHref()).host;
  } catch {
    return '';
  }
}
