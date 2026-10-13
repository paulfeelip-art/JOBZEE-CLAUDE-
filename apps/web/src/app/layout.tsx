import type { Metadata, Viewport } from 'next';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';

export const metadata: Metadata = {
  title: 'Jobzee · Ai ceva de făcut? Găsește un Jobzer.',
  description: 'Ajutor pentru sarcini scurte, aproape de tine: montaj mobilier, cărat, curățenie, ajutor tehnic. Descrii, confirmi, plătești doar la final.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://jobzee.ro'),
  openGraph: { title: 'Jobzee', description: 'Ai ceva de făcut? Găsește un Jobzer.', locale: 'ro_RO', type: 'website' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FBF7F2' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
