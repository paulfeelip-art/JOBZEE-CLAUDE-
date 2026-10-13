// GENERATED from packages/shared/src/tiers.ts by scripts/sync-shared.mjs. Do not edit.
/**
 * Jobzer levels. Earned only from completed work and verifications.
 * Declining or ignoring offers never lowers a level (EU Platform Work
 * Directive 2024/2831: no penalties for refusing work, transparent rules,
 * human review on request).
 */
export type TierId = 'start' | 'plus' | 'gold' | 'black';

export interface TierRule {
  done: number;
  rating: number;
  onTimePct: number;
  idVerified?: boolean;
  insured?: boolean;
}

export interface Tier {
  id: TierId;
  name: string;
  requirement: string;
  rule: TierRule;
  perks: string[];
}

export const TIERS: Tier[] = [
  {
    id: 'start', name: 'Start', requirement: 'Cont nou, cu telefonul și identitatea verificate',
    rule: { done: 0, rating: 0, onTimePct: 0 },
    perks: ['Primești sarcini din categoriile alese', 'Plata standard, gratuită, săptămânal'],
  },
  {
    id: 'plus', name: 'Plus', requirement: '10+ sarcini, notă 4,6+, 90% la timp',
    rule: { done: 10, rating: 4.6, onTimePct: 90 },
    perks: ['Sarcini de peste 300 lei', 'Insigna Plus pe profil'],
  },
  {
    id: 'gold', name: 'Gold', requirement: '50+ sarcini, notă 4,8+, 95% la timp, identitate verificată',
    rule: { done: 50, rating: 4.8, onTimePct: 95, idVerified: true },
    perks: ['Transfer instant gratuit', 'Acces la clienți firmă', 'Suport prioritar'],
  },
  {
    id: 'black', name: 'Black', requirement: '150+ sarcini, notă 4,9+, 97% la timp, asigurare de răspundere activă',
    rule: { done: 150, rating: 4.9, onTimePct: 97, idVerified: true, insured: true },
    perks: ['Clienți recurenți și sarcini premium', 'Consultant dedicat', 'Tot ce include Gold'],
  },
];

export interface JobzerStats {
  done: number;
  rating: number;
  onTimePct: number;
  idVerified: boolean;
  insured: boolean;
}

const meets = (s: JobzerStats, r: TierRule): boolean =>
  s.done >= r.done &&
  s.rating >= r.rating &&
  s.onTimePct >= r.onTimePct &&
  (!r.idVerified || s.idVerified) &&
  (!r.insured || s.insured);

export function tierIndex(s: JobzerStats): number {
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (meets(s, t.rule)) idx = i;
  });
  return idx;
}

export const tierOf = (s: JobzerStats): Tier => TIERS[tierIndex(s)] as Tier;

export interface TierProgressItem {
  label: string;
  met: boolean;
}

/** What is still missing for the next level, shown to the Jobzer. */
export function nextTierProgress(s: JobzerStats): { next: Tier; items: TierProgressItem[] } | null {
  const next = TIERS[tierIndex(s) + 1];
  if (!next) return null;
  const r = next.rule;
  const items: TierProgressItem[] = [
    { label: `${Math.min(s.done, r.done)}/${r.done} sarcini`, met: s.done >= r.done },
    { label: `notă ${s.rating.toFixed(1).replace('.', ',')} din ${r.rating.toFixed(1).replace('.', ',')}`, met: s.rating >= r.rating },
    { label: `${s.onTimePct}% la timp din ${r.onTimePct}%`, met: s.onTimePct >= r.onTimePct },
  ];
  if (r.idVerified) items.push({ label: 'identitate verificată', met: s.idVerified });
  if (r.insured) items.push({ label: 'asigurare activă', met: s.insured });
  return { next, items };
}

export type SkillLevel = 'incepator' | 'experimentat' | 'calificat';

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  incepator: 'Începător',
  experimentat: 'Experimentat',
  calificat: 'Calificat',
};

/** "Calificat" requires a certificate verified by the Jobzee team. */
export function allowedSkillLevel(requested: SkillLevel, hasVerifiedCertificate: boolean): SkillLevel {
  if (requested === 'calificat' && !hasVerifiedCertificate) return 'experimentat';
  return requested;
}
