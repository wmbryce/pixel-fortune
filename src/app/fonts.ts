import { Pixelify_Sans } from 'next/font/google';

export const pixelify = Pixelify_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixelify',
  weight: ['400', '500', '600', '700'],
});
