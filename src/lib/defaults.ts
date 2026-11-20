import type { ModeProfile, Settings } from './types';

export const ACCENTS = ['#7c3aed', '#db2777', '#2563eb', '#059669', '#ea580c', '#dc2626', '#0891b2', '#ca8a04'];

export function defaultProfile(mode: 'anime' | 'adult'): ModeProfile {
  return mode === 'anime'
    ? {
        displayName: '',
        thanks: '¡Gracias por tu compra! Nos vemos en la próxima convención ✨',
        conceptText: 'Compra',
        includeFolioInConcept: true,
        showItems: true,
        accent: '#7c3aed',
        whatsapp: '',
        links: [],
        accountId: null
      }
    : {
        displayName: '',
        thanks: 'Gracias por tu compra 🖤',
        conceptText: 'Gracias por tu compra',
        includeFolioInConcept: true,
        showItems: true,
        accent: '#db2777',
        whatsapp: '',
        links: [],
        accountId: null
      };
}

export function defaultSettings(): Settings {
  return {
    id: 'main',
    onboarded: false,
    enabledModes: ['anime'],
    currentMode: 'anime',
    folioPrefix: 'A',
    nextSeq: 1,
    profiles: { anime: defaultProfile('anime'), adult: defaultProfile('adult') }
  };
}
