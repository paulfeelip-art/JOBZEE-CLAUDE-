// Scheduled every few minutes (see docs/SETUP.md). Header x-cron-secret must match CRON_SECRET.
// Expires offers and invites the next Jobzers, auto-completes tasks after 48 h, publishes reviews after 14 days.
import { env, json, serviceClient } from '../_shared/http.ts';
import { Stripe } from '../_shared/stripe.ts';
import { settleTask } from '../_shared/settle.ts';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
  const sb = serviceClient();
  const stripe = new Stripe({ secretKey: env('STRIPE_SECRET_KEY') });
  const expired = await sb.rpc('expire_offers');
  const due = await sb.rpc('auto_complete_due');
  const settled: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const row of (due.data ?? []) as Array<string | { auto_complete_due: string }>) {
    const id = typeof row === 'string' ? row : row.auto_complete_due;
    try { await settleTask(sb, stripe, id); settled.push(id); }
    catch (e) { failed.push({ id, error: (e as Error).message }); }
  }
  const reviews = await sb.rpc('publish_stale_reviews');
  if (failed.length) console.error('settlement failures', failed); // surfaces in the ops console via payment_status
  return json({ expired_offers: expired.data ?? 0, auto_completed: settled.length, failed, reviews_published: reviews.data ?? 0 });
});
