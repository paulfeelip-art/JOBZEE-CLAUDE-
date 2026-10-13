import { StripeProvider } from '@stripe/stripe-react-native';

export function StripeRoot({ children }: { children: React.ReactElement | React.ReactElement[] }) {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return <>{children}</>;
  return <StripeProvider publishableKey={key} merchantIdentifier="merchant.ro.jobzee" urlScheme="jobzee">{children}</StripeProvider>;
}
