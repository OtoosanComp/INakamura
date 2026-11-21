import { defaultSettings } from '../src/lib/defaults';
import type { BankAccount, Settings } from '../src/lib/types';

export function testSettings(): Settings {
  const s = defaultSettings();
  s.onboarded = true;
  s.enabledModes = ['anime', 'adult'];
  s.profiles.anime.displayName = 'Persefone Cosplay';
  s.profiles.anime.whatsapp = '5512345678';
  s.profiles.anime.links = ['ig:persefone.cos', 'tt:persefone'];
  s.profiles.adult.displayName = 'Perse 🖤';
  s.profiles.adult.links = ['tg:perse_vip', 'of:perse'];
  return s;
}

export const account: BankAccount = {
  id: 'acc1',
  alias: 'Principal',
  bankName: 'Banamex',
  beneficiary: 'María Pérez Núñez',
  clabe: '002010077777777771',
  active: true
};
