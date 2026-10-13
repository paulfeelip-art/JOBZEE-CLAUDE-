import type { PricingMode } from './money';

/**
 * Internal catalogue. Clients never pick from it: Jobzee AI maps free text and
 * photos to one of these ids. It drives matching, price hints and follow-up
 * questions when the AI is unavailable.
 */
export type CategoryId =
  | 'mobilier'
  | 'carat'
  | 'curatenie'
  | 'tehnic'
  | 'comisioane'
  | 'animale'
  | 'interventii';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
  keywords: string[];
  mode: PricingMode;
  /** Usual price range in lei for Bucharest, used as a hint only. */
  estimateLei: [number, number];
  duration: string;
  questions: Array<{ text: string; options: string[] }>;
  included: string;
  excluded: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'mobilier', label: 'Montaj mobilier', icon: 'tool', mode: 'fixed', estimateLei: [120, 190], duration: '~1 h 30 min',
    keywords: ['birou', 'dulap', 'pat', 'mobil', 'raft', 'montez', 'asamblez', 'ikea', 'comod', 'masa', 'masă', 'pax'],
    questions: [
      { text: 'Câte piese de mobilier sunt și cât de mari?', options: ['O piesă mică', 'O piesă mare', 'Mai multe piese'] },
      { text: 'Trebuie fixat ceva de perete?', options: ['Da', 'Nu', 'Nu știu'] },
    ],
    included: 'Asamblare, fixare de perete dacă ai cerut, strângerea ambalajelor',
    excluded: 'Piese lipsă, modificări ale mobilierului',
  },
  {
    id: 'carat', label: 'Cărat și mutat', icon: 'box', mode: 'hourly', estimateLei: [60, 80], duration: '~1 h',
    keywords: ['cutii', 'car', 'cărat', 'mut', 'canapea', 'frigider', 'urc', 'cobor', 'saci'],
    questions: [
      { text: 'Câte obiecte sunt și cât de grele?', options: ['Sub 10 cutii', '10–20 cutii', 'Mobilă grea'] },
      { text: 'La ce etaj și există lift?', options: ['Parter', 'Etaj, cu lift', 'Etaj, fără lift'] },
    ],
    included: 'Cărat la aceeași adresă sau până la mașină, în timpul aprobat',
    excluded: 'Transport cu mașina între adrese',
  },
  {
    id: 'curatenie', label: 'Curățenie', icon: 'broom', mode: 'hourly', estimateLei: [50, 70], duration: '~2 h',
    keywords: ['curăț', 'curat', 'curățenie', 'curatenie', 'geam', 'aspir', 'spăl', 'praf'],
    questions: [
      { text: 'Câte camere sunt?', options: ['1–2 camere', '3 camere', '4 sau mai multe'] },
      { text: 'Ai produsele și aspiratorul acasă?', options: ['Da', 'Nu, să le aducă Jobzerul'] },
    ],
    included: 'Curățenie generală în timpul aprobat',
    excluded: 'Curățenie după renovare',
  },
  {
    id: 'tehnic', label: 'Ajutor tehnic', icon: 'plug', mode: 'quote', estimateLei: [80, 150], duration: '~1 h',
    keywords: ['imprimant', 'laptop', 'wifi', 'router', 'telefon', 'configur', 'calculator', 'tv', 'printer', 'smart', 'internet'],
    questions: [
      { text: 'Ce aparat este?', options: ['Imprimantă', 'Router sau Wi-Fi', 'Laptop', 'Televizor'] },
      { text: 'E un aparat nou sau o problemă veche?', options: ['Aparat nou', 'Problemă veche'] },
    ],
    included: 'Diagnostic și configurare de bază',
    excluded: 'Piese de schimb, reparații hardware',
  },
  {
    id: 'comisioane', label: 'Cumpărături și comisioane', icon: 'bag', mode: 'fixed', estimateLei: [40, 70], duration: '~45 min',
    keywords: ['cumpăr', 'farmacie', 'colet', 'magazin', 'ridic', 'poștă', 'posta', 'livr'],
    questions: [
      { text: 'De unde trebuie ridicat?', options: ['Farmacie', 'Supermarket', 'Oficiu poștal', 'Alt loc'] },
      { text: 'Plătești produsele separat?', options: ['Da, la livrare', 'Le-am plătit online'] },
    ],
    included: 'Ridicare și livrare la ușă',
    excluded: 'Costul produselor',
  },
  {
    id: 'animale', label: 'Plante și animale', icon: 'paw', mode: 'fixed', estimateLei: [40, 60], duration: '~1 h',
    keywords: ['câine', 'caine', 'pisic', 'plimb', 'plante', 'ud ', 'animal', 'cățel'],
    questions: [
      { text: 'Ce animal și cât timp?', options: ['Câine, 30 min', 'Câine, 1 oră', 'Pisică, hrănire'] },
      { text: 'E prima dată cu un Jobzer nou?', options: ['Da', 'Nu'] },
    ],
    included: 'Plimbare sau îngrijire în intervalul stabilit',
    excluded: 'Îngrijire medicală',
  },
  {
    id: 'interventii', label: 'Mici intervenții', icon: 'hammer', mode: 'fixed', estimateLei: [80, 140], duration: '~1 h',
    keywords: ['tablou', 'gaur', 'perdea', 'agăț', 'agat', 'oglind', 'suport', 'rafturi', 'galerie'],
    questions: [
      { text: 'Ce trebuie montat?', options: ['Tablou sau oglindă', 'Perdele', 'Rafturi', 'Suport TV'] },
      { text: 'Pe ce fel de perete?', options: ['Beton sau cărămidă', 'Rigips', 'Nu știu'] },
    ],
    included: 'Montaj cu materialele tale',
    excluded: 'Lucrări electrice sau la instalații',
  },
];

/**
 * Work that legally requires an authorised specialist (for example ANRE for
 * electrical installations). Never offered to unqualified Jobzers.
 */
export const REGULATED_KEYWORDS = [
  'priz', 'electric', 'tablou electric', 'siguran', 'gaz', 'centrală', 'centrala',
  'instalați', 'instalati', 'țeav', 'teav', 'robinet', 'calorifer', 'boiler',
];

export const categoryById = (id: string): Category =>
  CATEGORIES.find((c) => c.id === id) ?? (CATEGORIES[CATEGORIES.length - 1] as Category);

export type Detection =
  | { regulated: true }
  | { regulated: false; category: CategoryId; confident: boolean };

/** Rule-based fallback used when the AI is unavailable. */
export function detectCategory(text: string): Detection {
  const t = ` ${text.toLowerCase()} `;
  if (REGULATED_KEYWORDS.some((k) => t.includes(k))) return { regulated: true };
  let best: Category | null = null;
  let score = 0;
  for (const c of CATEGORIES) {
    const s = c.keywords.filter((k) => t.includes(k)).length;
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return best
    ? { regulated: false, category: best.id, confident: true }
    : { regulated: false, category: 'interventii', confident: false };
}
