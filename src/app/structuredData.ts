export const getWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Tarot Reading App',
  applicationCategory: 'LifestyleApplication',
  description: 'Interactive tarot card reading application',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
});

export const getTarotReadingSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Tarot Reading',
  provider: {
    '@type': 'WebSite',
    name: 'Tarot Reading App',
  },
  description: 'Personalized tarot card reading service',
});
