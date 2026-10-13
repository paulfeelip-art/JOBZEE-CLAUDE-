/** Input validation used on the client for instant feedback and again on the server. */

/** Romanian mobile number: 07xxxxxxxx, +407xxxxxxxx or 00407xxxxxxxx. Returns E.164 or null. */
export function normalizeRoMobile(input: string): string | null {
  const digits = input.replace(/[\s().-]/g, '');
  const m = /^(?:\+40|0040|40|0)(7\d{8})$/.exec(digits);
  return m ? `+40${m[1]}` : null;
}

/**
 * Romanian fiscal code (CUI/CIF) with control digit.
 * Algorithm: key 753217532, digits right-aligned, sum*10 mod 11, 10 → 0.
 */
export function isValidCui(input: string): boolean {
  const raw = input.toUpperCase().replace(/\s/g, '').replace(/^RO/, '');
  if (!/^\d{2,10}$/.test(raw)) return false;
  const control = Number(raw[raw.length - 1]);
  const body = raw.slice(0, -1).padStart(9, '0');
  const key = '753217532';
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(key[i]);
  let c = (sum * 10) % 11;
  if (c === 10) c = 0;
  return c === control;
}

/** IBAN check (ISO 13616, mod 97). Romanian IBANs are 24 characters. */
export function isValidIban(input: string): boolean {
  const iban = input.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith('RO') && iban.length !== 24) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** Free text shown to the other party must not leak contact details before a task is confirmed. */
const CONTACT_PATTERNS = [
  /(?:\+?4?0|0)\s?7\d(?:[\s.-]?\d){7}/, // RO mobile
  /[\w.+-]+@[\w-]+\.[\w.]+/, // e-mail
  /https?:\/\/|www\./i, // links
  /\b(?:whats\s?app|telegram|signal)\b/i,
];

export function containsContactDetails(text: string): boolean {
  return CONTACT_PATTERNS.some((p) => p.test(text));
}
