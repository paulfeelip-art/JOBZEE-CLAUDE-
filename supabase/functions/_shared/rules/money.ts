// GENERATED from packages/shared/src/money.ts by scripts/sync-shared.mjs. Do not edit.
/**
 * Money rules. All amounts are integers in bani (1 leu = 100 bani) so that
 * rounding is explicit and identical on the phone, the web and the database.
 */

export const SERVICE_RATE = 0.049; // paid by the client, on top of the job price
export const SERVICE_CAP_BANI = 2_500; // max 25 lei per task
export const COMMISSION_RATE = 0.12; // taken from the Jobzer's side
export const INSTANT_PAYOUT_RATE = 0.015;
export const INSTANT_PAYOUT_MIN_BANI = 200; // 2 lei
export const LATE_CANCEL_FEE_BANI = 1_500; // 15 lei once the Jobzer has left
export const AUTO_CONFIRM_HOURS = 48;
export const DIAGNOSTIC_VISIT_BANI = 6_000; // default diagnostic visit, 60 lei

/** Round half away from zero to whole bani. */
export const roundBani = (n: number): number => Math.sign(n) * Math.round(Math.abs(n));

export const lei = (lei: number): number => roundBani(lei * 100);

export interface FeeBreakdown {
  /** Price agreed for the work, before fees. */
  price: number;
  /** Jobzee service fee paid by the client. */
  service: number;
  /** What the client is charged. */
  total: number;
  /** Jobzee commission deducted from the Jobzer's side. */
  commission: number;
  /** What the Jobzer earns before any tip. */
  net: number;
  /** Jobzee revenue on this task. */
  platform: number;
}

export function fees(priceBani: number): FeeBreakdown {
  if (!Number.isInteger(priceBani) || priceBani < 0) {
    throw new RangeError(`price must be a non-negative integer in bani, got ${priceBani}`);
  }
  const service = Math.min(roundBani(priceBani * SERVICE_RATE), SERVICE_CAP_BANI);
  const commission = roundBani(priceBani * COMMISSION_RATE);
  return {
    price: priceBani,
    service,
    total: priceBani + service,
    commission,
    net: priceBani - commission,
    platform: service + commission,
  };
}

export function instantPayoutFee(amountBani: number): number {
  if (amountBani <= 0) return 0;
  return Math.max(roundBani(amountBani * INSTANT_PAYOUT_RATE), INSTANT_PAYOUT_MIN_BANI);
}

export type PricingMode = 'fixed' | 'hourly' | 'quote';

export interface PricingInput {
  mode: PricingMode;
  /** fixed: the agreed amount. */
  amountBani?: number;
  /** hourly: rate per hour and the hour cap. */
  rateBani?: number;
  maxHours?: number;
  /** quote: the diagnostic visit price. */
  visitBani?: number;
}

/** The amount that is authorised (held) on the client's card when they confirm. */
export function amountToHold(p: PricingInput): number {
  switch (p.mode) {
    case 'fixed':
      return requirePositive(p.amountBani, 'amountBani');
    case 'hourly':
      return requirePositive(p.rateBani, 'rateBani') * requirePositive(p.maxHours, 'maxHours');
    case 'quote':
      return p.visitBani ?? DIAGNOSTIC_VISIT_BANI;
  }
}

/** Hourly jobs are billed per started quarter hour and never above the cap. */
export function hourlyCharge(rateBani: number, minutesWorked: number, maxHours: number): number {
  const quarters = Math.ceil(Math.max(0, minutesWorked) / 15);
  const raw = roundBani((rateBani * quarters) / 4);
  return Math.min(raw, rateBani * maxHours);
}

/**
 * Cancellation is free until the Jobzer has left for the address.
 * Afterwards a flat fee compensates the Jobzer for the trip.
 */
export function cancellationFee(jobzerHasLeft: boolean): number {
  return jobzerHasLeft ? LATE_CANCEL_FEE_BANI : 0;
}

export function formatLei(bani: number, decimals: 0 | 2 = 2): string {
  const value = bani / 100;
  return (
    value.toLocaleString('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' lei'
  );
}

function requirePositive(v: number | undefined, name: string): number {
  if (v === undefined || !Number.isInteger(v) || v <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return v;
}
