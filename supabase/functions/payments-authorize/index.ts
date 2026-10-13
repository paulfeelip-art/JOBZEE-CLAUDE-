// POST { task_id } by the client of a matched task → PaymentIntent client secret (manual capture).
// The task becomes "confirmed" only when Stripe reports the authorisation (see stripe-webhook).
import { HttpError, env, json, requireUser, serve, serviceClient, userClient } from '../_shared/http.ts';
import { Stripe } from '../_shared/stripe.ts';
import { fees } from '../_shared/rules/index.ts';

serve(async (req) => {
  const user = userClient(req);
  const uid = await requireUser(user);
  const { task_id } = await req.json().catch(() => ({}));
  if (typeof task_id !== 'string') throw new HttpError(400, 'task_id_required');

  // Read through RLS: proves the caller can see the task.
  const { data: t } = await user.from('tasks').select('id, client_id, jobzer_id, status, hold_bani').eq('id', task_id).single();
  if (!t || t.client_id !== uid) throw new HttpError(404, 'task_not_found');
  if (t.status !== 'matched') throw new HttpError(409, 'not_matched');

  const admin = serviceClient();
  const { data: j } = await admin.from('jobzers').select('payout_account_id, payouts_enabled').eq('id', t.jobzer_id).single();
  if (!j?.payout_account_id || !j.payouts_enabled) throw new HttpError(409, 'jobzer_payouts_not_ready');

  const f = fees(t.hold_bani);
  const stripe = new Stripe({ secretKey: env('STRIPE_SECRET_KEY') });
  const pi = await stripe.createAuthorisation({
    amount: f.total,
    applicationFee: f.service + f.commission,
    destination: j.payout_account_id,
    taskId: t.id,
  });
  await admin.from('tasks').update({ payment_intent_id: pi.id, payment_status: 'requires_action' }).eq('id', t.id);
  return json({ client_secret: pi.client_secret, amount_bani: f.total, publishable_key: Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? null });
});
