/**
 * Datos de DEMOSTRACIÓN. La cuenta es ficticia (CLABE con formato válido pero inventada)
 * y todo queda marcado como demo: los tickets muestran un aviso "NO TRANSFERIR".
 */
import type { BankAccount, Product, Mode } from './types';
import { uid } from './db';

export const DEMO_CLABE = '002010077777777771'; // ejemplo publicado por Banxico, no es una cuenta real

export function demoAccount(): BankAccount {
  return {
    id: uid(),
    alias: 'Cuenta DEMO',
    bankName: 'Banamex',
    beneficiary: 'DEMO NO TRANSFERIR',
    clabe: DEMO_CLABE,
    active: true,
    demo: true
  };
}

const anime: [string, number, string, number | null][] = [
  ['Peluca rosa larga', 650, 'Pelucas', 5],
  ['Espada de foam', 480, 'Props', 3],
  ['Orejas de gato', 150, 'Accesorios', 12],
  ['Print A4 firmado', 120, 'Prints', null],
  ['Llavero acrílico', 80, 'Accesorios', 20],
  ['Foto con cosplayer', 50, 'Servicios', null]
];

const adult: [string, number, string, number | null][] = [
  ['Print exclusivo A4', 200, 'Prints', null],
  ['Set de fotos digital', 350, 'Digital', null],
  ['Polaroid firmada', 150, 'Prints', 10],
  ['Suscripción Telegram 1 mes', 250, 'Digital', null]
];

export function demoProducts(): Product[] {
  const now = Date.now();
  const make = (mode: Mode) => ([name, price, category, stock]: [string, number, string, number | null]): Product => ({
    id: uid(),
    mode,
    name,
    priceCents: price * 100,
    category,
    stock,
    active: true,
    demo: true,
    createdAt: now,
    updatedAt: now
  });
  return [...anime.map(make('anime')), ...adult.map(make('adult'))];
}
