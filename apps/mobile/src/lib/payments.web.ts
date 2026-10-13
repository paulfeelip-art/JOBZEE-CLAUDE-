/** Card payments run in the iOS and Android apps. The web preview only shows the flow. */
export async function authoriseWithSheet(_clientSecret: string): Promise<'ok' | 'cancelled' | { error: string }> {
  return { error: 'Plata cu cardul este disponibilă în aplicația de telefon.' };
}
