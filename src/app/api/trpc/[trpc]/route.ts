import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/server';
import { createContext } from '@/server/context';

const handler = (req: Request) => {
  const ctx = createContext(req);
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ctx,
    // Issues the visitor cookie the rate limiter pairs with the source IP.
    responseMeta: () =>
      ctx.setCookie ? { headers: { 'set-cookie': ctx.setCookie } } : {},
  });
};

export { handler as GET, handler as POST };
