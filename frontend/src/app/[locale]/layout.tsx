import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Providers } from '@/components/providers';
import { isRtl, LOCALES } from '@/i18n';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  title: 'DAR ERP — Construction Platform',
  description:
    'Enterprise Construction ERP for DAR Trading & Contracting: scheduling, cost control, procurement, HR, QHSE and AI insights.',
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const dir = isRtl(params.locale) ? 'rtl' : 'ltr';
  return (
    <html lang={params.locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} ${arabic.variable} ${dir === 'rtl' ? 'font-arabic' : 'font-sans'}`}>
        <Providers locale={params.locale}>{children}</Providers>
      </body>
    </html>
  );
}
