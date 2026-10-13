// POST { task_id, reason } by either party: cancels, then releases or charges the late fee.
import { HttpError, env, json, serve, serviceClient, userClient } from '../_shared/http.ts';
import { Stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const { task_id, reason } = await req.json().catch(() => ({}));
  if (typeof task_id !== 'string') throw new HttpError(400, 'task_id_required');
  const { data: fee, error } = await userClient(req).rpc('cancel_task', { p_task: task_id, p_reason: String(reason ?? '').slice(0, 200) });
  if (error) throw new Error(error.message);

  const sb = serviceClient();
  const { data: t } = await sb.from('tasks').select('payment_intent_id, payment_status').eq('id', task_id).single();
  if (t?.payment_intent_id && ['authorised', 'requires_action'].includes(t.payment_status)) {
    const stripe = new Stripe({ secretKey: env('STRIPE_SECRET_KEY') });
    if (fee > 0 && t.payment_status === 'authorised') {
      // The late fee goes to the Jobzer for the trip; Jobzee keeps nothing from it.
      await stripe.capture(t.payment_intent_id, fee, 0);
      await sb.rpc('mark_payment_status', { p_task: task_id, p_status: 'captured' });
    } else {
      await stripe.cancel(t.payment_intent_id);
      await sb.rpc('mark_payment_status', { p_task: task_id, p_status: 'cancelled' });
    }
  }
  return json({ fee_bani: fee });
});
