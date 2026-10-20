export type CharacterId = 'yami' | 'tsuki';
export type LookId = 'princess-cosplayer' | 'dark-cinematic';
export interface LookProfile {
  id: LookId;
  label: string;
  description: string;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  vignette: number;
}
export const looks: Record<CharacterId, LookProfile> = {
  yami: {
    id: 'princess-cosplayer',
    label: 'Princesa · Cosplayer',
    description: 'Tonos suaves, contraste moderado y saturación natural. Evita el acabado plástico.',
    brightness: 5, contrast: 4, saturation: 7, temperature: 3, vignette: 0
  },
  tsuki: {
    id: 'dark-cinematic',
    label: 'Cine dramático',
    description: 'Contraste firme, sombras y color más contenido, inspirado en cinematografía urbana.',
    brightness: -4, contrast: 20, saturation: -14, temperature: -5, vignette: 14
  }
};