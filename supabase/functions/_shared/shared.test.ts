import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import { encodeForm, signForTest, verifyStripeSignature } from './stripe.ts';
import { settlement } from './settle.ts';
import { rulesIntake, validateIntakeRequest } from './ai.ts';

Deno.test('stripe signature: valid, tampered, stale', async () => {
  const body = '{"id":"evt_1"}';
  const t = 1_800_000_000;
  const header = await signForTest(body, 'whsec_test', t);
  assert(await verifyStripeSignature(body, header, 'whsec_test', t));
  assert(!(await verifyStripeSignature(body + ' ', header, 'whsec_test', t)));
  assert(!(await verifyStripeSignature(body, header, 'whsec_other', t)));
  assert(!(await verifyStripeSignature(body, header, 'whsec_test', t + 301)));
  assert(!(await verifyStripeSignature(body, null, 'whsec_test', t)));
});

Deno.test('form encoding for Stripe', () => {
  assertEquals(encodeForm({ amount: 100, transfer_data: { destination: 'acct_1' }, metadata: { task_id: 'a b' } }),
    'amount=100&transfer_data%5Bdestination%5D=acct_1&metadata%5Btask_id%5D=a%20b');
});

Deno.test('settlement captures at most the hold', () => {
  assertEquals(settlement(15000, 15000), { amountToCapture: 15735, applicationFee: 2535, jobzerNet: 13200, serviceFee: 735, extraDue: 0 });
  const over = settlement(19000, 16000);
  assertEquals(over.amountToCapture, 16784);
  assertEquals(over.extraDue, 3000);
  assertEquals(settlement(9000, 13000).amountToCapture, 9441);
});

Deno.test('rules intake asks the category questions, then is ready', () => {
  const r0 = rulesIntake(validateIntakeRequest({ conversation: [{ who: 'me', text: 'Am de montat un birou IKEA' }], questionsAsked: 0 }));
  assertEquals(r0.category, 'mobilier');
  assert(r0.question && r0.question.options.length > 1);
  const r2 = rulesIntake(validateIntakeRequest({ conversation: [{ who: 'me', text: 'birou' }, { who: 'me', text: 'O piesă mare' }, { who: 'me', text: 'Da' }], questionsAsked: 2 }));
  assertEquals(r2.ready, true);
  assertEquals(r2.question, null);
});

Deno.test('rules intake refuses regulated work', () => {
  const r = rulesIntake(validateIntakeRequest({ conversation: [{ who: 'me', text: 'schimb o priză' }], questionsAsked: 0 }));
  assertEquals(r.regulated, true);
  assertEquals(r.ready, false);
});

Deno.test('intake input is validated', () => {
  let threw = false;
  try { validateIntakeRequest({ conversation: [] }); } catch { threw = true; }
  assert(threw);
});
