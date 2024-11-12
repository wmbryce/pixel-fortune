import { Pixelify_Sans, Inter } from 'next/font/google';
import type { Metadata } from 'next';
import './styles/global.css';
import './styles/output.css';
import Provider from './_trpc/Provider';

export const metadata: Metadata = {
  title: 'Pixel Fortune',
  description: 'May you be lucky and Prosperuse',
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
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
