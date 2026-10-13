// POST { task_id } by the client: confirms the work and captures the payment.
import { HttpError, env, json, serve, serviceClient, userClient } from '../_shared/http.ts';
import { Stripe } from '../_shared/stripe.ts';
import { settleTask } from '../_shared/settle.ts';

serve(async (req) => {
  const { task_id } = await req.json().catch(() => ({}));
  if (typeof task_id !== 'string') throw new HttpError(400, 'task_id_required');
  const { error } = await userClient(req).rpc('complete_task', { p_task: task_id });
  if (error) throw new Error(error.message);
  const result = await settleTask(serviceClient(), new Stripe({ secretKey: env('STRIPE_SECRET_KEY') }), task_id);
  return json(result);
});
