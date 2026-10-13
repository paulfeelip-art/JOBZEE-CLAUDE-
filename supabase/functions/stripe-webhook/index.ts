// Stripe → Jobzee. Configure the endpoint in Stripe with the events listed in docs/SETUP.md.
// Deploy with --no-verify-jwt: Stripe authenticates with the signature instead.
import { env, json, serviceClient } from '../_shared/http.ts';
import { verifyStripeSignature } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  const payload = await req.text();
  const ok = await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET'));
  if (!ok) return json({ error: 'bad_signature' }, 400);
  const event = JSON.parse(payload);
  const sb = serviceClient();
  const obj = event.data?.object ?? {};
  const taskId: string | undefined = obj.metadata?.task_id;

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated':
      if (taskId) {
        const { error } = await sb.rpc('mark_payment_authorised', { p_task: taskId, p_intent: obj.id });
        if (error && !/transition_not_allowed/.test(error.message)) throw error; // duplicates are fine
      }
      break;
    case 'payment_intent.succeeded':
      if (taskId) await sb.rpc('mark_payment_status', { p_task: taskId, p_status: 'captured' });
      break;
    case 'payment_intent.payment_failed':
      if (taskId) await sb.rpc('mark_payment_status', { p_task: taskId, p_status: 'failed' });
      break;
    case 'payment_intent.canceled':
      if (taskId) await sb.rpc('mark_payment_status', { p_task: taskId, p_status: 'cancelled' });
      break;
    case 'account.updated':
      await sb.from('jobzers').update({ payouts_enabled: !!(obj.charges_enabled && obj.payouts_enabled) }).eq('payout_account_id', obj.id);
      break;
  }
  return json({ received: true });
});
