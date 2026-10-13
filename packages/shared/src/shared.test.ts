import { describe, expect, it } from 'vitest';
import {
  amountToHold, cancellationFee, fees, hourlyCharge, instantPayoutFee, lei,
  detectCategory, categoryById,
  tierIndex, nextTierProgress, allowedSkillLevel,
  normalizeRoMobile, isValidCui, isValidIban, containsContactDetails,
  canTransition, nextStatuses, makeStartCode,
  sanitizeIntake,
} from './index';

describe('fees', () => {
  it('matches the published example: 150 lei job', () => {
    const f = fees(lei(150));
    expect(f).toEqual({ price: 15000, service: 735, total: 15735, commission: 1800, net: 13200, platform: 2535 });
  });
  it('caps the service fee at 25 lei', () => {
    expect(fees(lei(1000)).service).toBe(2500);
  });
  it('rejects fractional bani', () => {
    expect(() => fees(10.5)).toThrow(RangeError);
  });
  it('instant payout costs 1.5% with a 2 lei minimum', () => {
    expect(instantPayoutFee(lei(100))).toBe(200);
    expect(instantPayoutFee(lei(500))).toBe(750);
    expect(instantPayoutFee(0)).toBe(0);
  });
  it('holds the right amount per pricing mode', () => {
    expect(amountToHold({ mode: 'fixed', amountBani: lei(160) })).toBe(16000);
    expect(amountToHold({ mode: 'hourly', rateBani: lei(65), maxHours: 2 })).toBe(13000);
    expect(amountToHold({ mode: 'quote' })).toBe(6000);
  });
  it('bills hourly work per started quarter and never above the cap', () => {
    expect(hourlyCharge(lei(60), 50, 2)).toBe(6000); // 4 quarters
    expect(hourlyCharge(lei(60), 61, 2)).toBe(7500); // 5 quarters
    expect(hourlyCharge(lei(60), 300, 2)).toBe(12000); // capped
  });
  it('charges a late cancellation fee only after the Jobzer left', () => {
    expect(cancellationFee(false)).toBe(0);
    expect(cancellationFee(true)).toBe(1500);
  });
});

describe('catalogue', () => {
  it('detects furniture assembly', () => {
    expect(detectCategory('Am de montat un birou IKEA')).toEqual({ regulated: false, category: 'mobilier', confident: true });
  });
  it('flags regulated electrical work', () => {
    expect(detectCategory('Îmi trebuie cineva să schimbe o priză')).toEqual({ regulated: true });
  });
  it('falls back to small jobs when unsure', () => {
    expect(detectCategory('ceva ciudat')).toMatchObject({ category: 'interventii', confident: false });
  });
  it('resolves unknown ids to a safe default', () => {
    expect(categoryById('nope').id).toBe('interventii');
  });
});

describe('tiers', () => {
  const base = { done: 0, rating: 0, onTimePct: 0, idVerified: false, insured: false };
  it('starts at Start', () => expect(tierIndex(base)).toBe(0));
  it('reaches Plus with 10 good tasks', () => {
    expect(tierIndex({ ...base, done: 10, rating: 4.7, onTimePct: 92 })).toBe(1);
  });
  it('needs identity for Gold and insurance for Black', () => {
    const strong = { done: 200, rating: 4.95, onTimePct: 99, idVerified: false, insured: false };
    expect(tierIndex(strong)).toBe(1);
    expect(tierIndex({ ...strong, idVerified: true })).toBe(2);
    expect(tierIndex({ ...strong, idVerified: true, insured: true })).toBe(3);
  });
  it('lists what is missing for the next level', () => {
    const p = nextTierProgress({ ...base, done: 4, rating: 4.9, onTimePct: 100 });
    expect(p?.next.id).toBe('plus');
    expect(p?.items.map((i) => i.met)).toEqual([false, true, true]);
  });
  it('locks "Calificat" behind a verified certificate', () => {
    expect(allowedSkillLevel('calificat', false)).toBe('experimentat');
    expect(allowedSkillLevel('calificat', true)).toBe('calificat');
  });
});

describe('validation', () => {
  it('normalises Romanian mobile numbers', () => {
    expect(normalizeRoMobile('0712 345 678')).toBe('+40712345678');
    expect(normalizeRoMobile('+40 712-345-678')).toBe('+40712345678');
    expect(normalizeRoMobile('0212345678')).toBeNull();
  });
  it('checks the CUI control digit', () => {
    expect(isValidCui('RO 14399840')).toBe(true);
    expect(isValidCui('18547290')).toBe(true);
    expect(isValidCui('45123987')).toBe(false);
    expect(isValidCui('abc')).toBe(false);
  });
  it('checks IBANs with mod 97', () => {
    expect(isValidIban('RO65 BTRL RONC RT01 2345 6789')).toBe(true);
    expect(isValidIban('RO66BTRLRONCRT0123456789')).toBe(false);
    expect(isValidIban('RO65BTRL')).toBe(false);
  });
  it('spots contact details in pre-booking text', () => {
    expect(containsContactDetails('sună-mă la 0712 345 678')).toBe(true);
    expect(containsContactDetails('scrie pe ana@example.com')).toBe(true);
    expect(containsContactDetails('am lift și parcare')).toBe(false);
  });
});

describe('lifecycle', () => {
  it('only the client can confirm a match', () => {
    expect(canTransition('matched', 'confirmed', 'client')).toBe(true);
    expect(canTransition('matched', 'confirmed', 'jobzer')).toBe(false);
  });
  it('the Jobzer cannot mark a task completed', () => {
    expect(canTransition('awaiting_confirmation', 'completed', 'jobzer')).toBe(false);
    expect(canTransition('awaiting_confirmation', 'completed', 'system')).toBe(true);
  });
  it('lists next steps per actor', () => {
    expect(nextStatuses('en_route', 'jobzer')).toEqual(['in_progress', 'cancelled']);
  });
  it('start codes have four digits', () => {
    expect(makeStartCode(() => 0)).toBe('1000');
    expect(makeStartCode(() => 0.9999)).toBe('9999');
  });
});

describe('intake sanitising', () => {
  it('clamps and filters model output', () => {
    const d = sanitizeIntake(
      { reply: 'Ok', title: 'x'.repeat(100), category: 'hack', details: ['a', 1, 'b'], people: 99,
        question: { text: 'Câte?', options: ['1', '2', 3, '4', '5', '6'] }, price: { mode: 'weird', low: -5, high: 200 } },
      0,
    );
    expect(d.title).toHaveLength(60);
    expect(d.category).toBe('interventii');
    expect(d.details).toEqual(['a', 'b']);
    expect(d.people).toBe(4);
    expect(d.question?.options).toEqual(['1', '2', '4', '5']);
    expect(d.price).toMatchObject({ mode: 'fixed', lowLei: 0, highLei: 200 });
  });
  it('forces ready after three questions and drops the question', () => {
    const d = sanitizeIntake({ ready: false, question: { text: 'Încă una?', options: [] } }, 3);
    expect(d.ready).toBe(true);
    expect(d.question).toBeNull();
  });
  it('regulated work is never ready', () => {
    expect(sanitizeIntake({ regulated: true, ready: true }, 0).ready).toBe(false);
  });
  it('survives garbage', () => {
    expect(sanitizeIntake(null, 0).reply).toBe('Am notat.');
  });
});
