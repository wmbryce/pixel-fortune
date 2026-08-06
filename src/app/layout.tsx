import { Pixelify_Sans, Inter } from 'next/font/google';
import type { Metadata } from 'next';
import './styles/global.css';
import Provider from './_trpc/Provider';
import SettingsBridge from './_components/SettingsBridge';

/**
 * Sets the reduce-motion attribute before first paint, so a stored override
 * reaches the CSS entrance on a full reload; `SettingsBridge` owns it from
 * hydration on. It restates `STORAGE_KEY` and `REDUCE_MOTION_ATTR` from
 * `_libs/settings.ts` — a server component cannot import a client module's
 * constants — and `test/settings.test.tsx` pins the restatement.
 */
const REDUCE_MOTION_BOOT = `try{if(JSON.parse(localStorage.getItem('pf-settings')).reduceMotion)document.documentElement.setAttribute('data-pf-reduce-motion','true')}catch(e){}`;

/** The deployed origin, so link previews resolve `/assets/og-image.png`. */
const SITE_URL = 'https://pixel-fortune.vercel.app';
const DESCRIPTION = 'A pixel-art tarot reading. May you be lucky and prosper.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Pixel Fortune',
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Pixel Fortune',
    title: 'Pixel Fortune',
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: '/assets/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Pixel Fortune',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pixel Fortune',
    description: DESCRIPTION,
    images: ['/assets/og-image.png'],
  },
};

const pixelify = Pixelify_Sans({
  subsets: ['latin'],
  variable: '--font-pixelify',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pixelify.variable} ${inter.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: REDUCE_MOTION_BOOT }} />
        <SettingsBridge />
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
