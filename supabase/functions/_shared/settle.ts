// Captures the authorised payment for a completed task and records the documents.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { fees } from './rules/index.ts';
import type { Stripe } from './stripe.ts';

export interface SettleResult {
  captured: number;
  extraDue: number;
}

/** Pure money split, unit-tested. Captures at most what was authorised. */
export function settlement(finalPrice: number, held: number) {
  const workCaptured = Math.min(finalPrice, held);
  const f = fees(workCaptured);
  return {
    amountToCapture: f.total,
    applicationFee: f.service + f.commission,
    jobzerNet: f.net,
    serviceFee: f.service,
    extraDue: Math.max(0, finalPrice - held),
  };
}

export async function settleTask(sb: SupabaseClient, stripe: Stripe, taskId: string): Promise<SettleResult> {
  const { data: t, error } = await sb.from('tasks')
    .select('id, client_id, jobzer_id, final_price_bani, hold_bani, payment_intent_id, payment_status, status')
    .eq('id', taskId).single();
  if (error || !t) throw new Error(`task_not_found ${taskId}`);
  if (t.status !== 'completed') throw new Error('not_completed');
  if (t.payment_status === 'captured') return { captured: 0, extraDue: 0 };
  if (!t.payment_intent_id) throw new Error('no_payment_intent');

  const s = settlement(t.final_price_bani ?? t.hold_bani, t.hold_bani);
  await stripe.capture(t.payment_intent_id, s.amountToCapture, s.applicationFee);
  await sb.rpc('mark_payment_status', { p_task: taskId, p_status: s.extraDue > 0 ? 'requires_action' : 'captured' });

  const { data: j } = await sb.from('jobzers').select('legal_form, company_name').eq('id', t.jobzer_id).single();
  const docs = [
    { task_id: taskId, kind: 'service_invoice', issuer: 'Jobzee', recipient_id: t.client_id, amount_bani: s.serviceFee },
    j && j.legal_form !== 'persoana_fizica'
      ? { task_id: taskId, kind: 'work_invoice', issuer: j.company_name ?? 'Jobzer', recipient_id: t.client_id, amount_bani: s.amountToCapture - s.serviceFee }
      : { task_id: taskId, kind: 'receipt', issuer: 'Jobzee', recipient_id: t.client_id, amount_bani: s.amountToCapture - s.serviceFee },
    { task_id: taskId, kind: 'commission_invoice', issuer: 'Jobzee', recipient_id: t.jobzer_id, amount_bani: s.applicationFee - s.serviceFee },
  ];
  await sb.from('documents').insert(docs);
  return { captured: s.amountToCapture, extraDue: s.extraDue };
}
