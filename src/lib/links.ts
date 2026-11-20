import type { LinkType } from './types';

export const LINK_TYPES: Record<LinkType, { label: string; url: (h: string) => string }> = {
  ig: { label: 'Instagram', url: (h) => `https://instagram.com/${h}` },
  tt: { label: 'TikTok', url: (h) => `https://tiktok.com/@${h}` },
  x: { label: 'X', url: (h) => `https://x.com/${h}` },
  fb: { label: 'Facebook', url: (h) => `https://facebook.com/${h}` },
  yt: { label: 'YouTube', url: (h) => `https://youtube.com/@${h}` },
  tg: { label: 'Telegram', url: (h) => `https://t.me/${h}` },
  of: { label: 'OnlyFans', url: (h) => `https://onlyfans.com/${h}` },
  fs: { label: 'Fansly', url: (h) => `https://fansly.com/${h}` },
  pt: { label: 'Patreon', url: (h) => `https://patreon.com/${h}` }
};

export const MAX_LINKS = 3;

/** Solo letras, números, punto, guion y guion bajo: evita enlaces maliciosos. */
export function sanitizeHandle(h: string): string {
  return h.trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//i, '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40);
}

export function parseLink(raw: string): { type: LinkType; handle: string; label: string; url: string } | null {
  const idx = raw.indexOf(':');
  if (idx < 1) return null;
  const type = raw.slice(0, idx) as LinkType;
  const def = LINK_TYPES[type];
  const handle = sanitizeHandle(raw.slice(idx + 1));
  if (!def || !handle) return null;
  return { type, handle, label: def.label, url: def.url(handle) };
}

export function whatsappUrl(phone10: string, text: string): string {
  const d = phone10.replace(/\D/g, '');
  const full = d.length === 10 ? `52${d}` : d;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
