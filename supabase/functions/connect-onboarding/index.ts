// POST {} by a Jobzer → Stripe Express onboarding link (identity, IBAN, tax details are collected by Stripe).
import { env, json, requireUser, serve, serviceClient, userClient } from '../_shared/http.ts';
import { Stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const user = userClient(req);
  const uid = await requireUser(user);
  const sb = serviceClient();
  const { data: j } = await sb.from('jobzers').select('payout_account_id').eq('id', uid).single();
  if (!j) return json({ error: 'not_a_jobzer' }, 409);
  const stripe = new Stripe({ secretKey: env('STRIPE_SECRET_KEY') });
  let account = j.payout_account_id as string | null;
  if (!account) {
    account = (await stripe.createExpressAccount({ userId: uid })).id;
    await sb.from('jobzers').update({ payout_account_id: account }).eq('id', uid);
  }
  const base = env('APP_RETURN_URL'); // e.g. jobzee://payouts or https://jobzee.ro/app/payouts
  const link = await stripe.accountLink(account, `${base}?refresh=1`, `${base}?done=1`);
  return json({ url: link.url });
});
