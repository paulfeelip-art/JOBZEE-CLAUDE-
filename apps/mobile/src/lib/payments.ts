import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

/**
 * Shows Stripe's payment sheet for a manual-capture PaymentIntent.
 * The card is only authorised here; capture happens when the client confirms the work.
 */
export async function authoriseWithSheet(clientSecret: string): Promise<'ok' | 'cancelled' | { error: string }> {
  const init = await initPaymentSheet({
    merchantDisplayName: 'Jobzee',
    paymentIntentClientSecret: clientSecret,
    returnURL: 'jobzee://stripe-redirect',
    applePay: { merchantCountryCode: 'RO' },
    googlePay: { merchantCountryCode: 'RO', testEnv: true },
  });
  if (init.error) return { error: init.error.message };
  const r = await presentPaymentSheet();
  if (r.error) return r.error.code === 'Canceled' ? 'cancelled' : { error: r.error.message };
  return 'ok';
}
