export const defaultMetadata = {
  title: 'Tarot Reading App',
  description:
    'Get your personalized tarot reading with our interactive tarot card experience',
  keywords:
    'tarot, fortune telling, card reading, spiritual guidance, online tarot',
  openGraph: {
    title: 'Online Tarot Reading',
    description: 'Interactive tarot card reading experience',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/assets/og-image.jpg', // You'll need to add this image
        width: 1200,
        height: 630,
        alt: 'Tarot Reading Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Online Tarot Reading',
    description: 'Get your personalized tarot reading',
    images: ['/assets/og-image.jpg'], // Same image as OpenGraph
  },
};
