// Minimal Stripe REST client (no SDK) and webhook signature verification.
// Uses Stripe Connect destination charges with manual capture:
// the client's card is authorised at confirmation and captured on completion.

export interface StripeConfig {
  secretKey: string;
  fetchImpl?: typeof fetch;
}

function form(data: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) out.push(...form(v as Record<string, unknown>, key));
    else if (Array.isArray(v)) v.forEach((item, i) => out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export function encodeForm(data: Record<string, unknown>): string {
  return form(data).join('&');
}

export class Stripe {
  constructor(private cfg: StripeConfig) {
    if (!cfg.secretKey.startsWith('sk_test_') && Deno.env.get('JOBZEE_ALLOW_LIVE_PAYMENTS') !== 'yes') {
      // Safety net: live keys must be enabled explicitly, never by accident.
      throw new Error('Live Stripe keys are disabled. Set JOBZEE_ALLOW_LIVE_PAYMENTS=yes only for an approved production launch.');
    }
  }

  async call<T = Record<string, unknown>>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await (this.cfg.fetchImpl ?? fetch)(`https://api.stripe.com/v1${path}`, {
      method,
      headers,
      body: body ? encodeForm(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`stripe_error: ${data?.error?.code ?? res.status} ${data?.error?.message ?? ''}`);
    return data as T;
  }

  createAuthorisation(args: {
    amount: number; applicationFee: number; destination: string; taskId: string; customerEmail?: string;
  }) {
    return this.call<{ id: string; client_secret: string; status: string }>('POST', '/payment_intents', {
      amount: args.amount,
      currency: 'ron',
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: args.applicationFee,
      transfer_data: { destination: args.destination },
      on_behalf_of: args.destination,
      metadata: { task_id: args.taskId },
      receipt_email: args.customerEmail,
    }, `authorise-${args.taskId}`);
  }

  capture(intentId: string, amountToCapture: number, applicationFee: number) {
    return this.call('POST', `/payment_intents/${intentId}/capture`, {
      amount_to_capture: amountToCapture,
      application_fee_amount: applicationFee,
    }, `capture-${intentId}`);
  }

  cancel(intentId: string) {
    return this.call('POST', `/payment_intents/${intentId}/cancel`, {}, `cancel-${intentId}`);
  }

  createExpressAccount(args: { userId: string; email?: string }) {
    return this.call<{ id: string }>('POST', '/accounts', {
      type: 'express',
      country: 'RO',
      email: args.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { user_id: args.userId },
    }, `account-${args.userId}`);
  }

  accountLink(accountId: string, refreshUrl: string, returnUrl: string) {
    return this.call<{ url: string }>('POST', '/account_links', {
      account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding',
    });
  }
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Verifies the Stripe-Signature header (v1 scheme, HMAC-SHA256, 5 minute tolerance). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter((p) => p.length === 2));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`)));
  return sigs.some((s) => safeEqual(s, expected));
}

export async function signForTest(payload: string, secret: string, t: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `t=${t},v1=${hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`)))}`;
}
