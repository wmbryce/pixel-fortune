'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import React, { useState } from 'react';

import { trpc } from './client';
// The runtime self-origin, never the canonical `SITE_URL`: a preview
// deployment calls its own API. `_libs/origin.ts` owns both and says why.
import { selfOrigin } from '../_libs/origin';

export default function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5 * 1000 } },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: () => true,
        }),
        httpBatchLink({
          url: `${selfOrigin()}/api/trpc`,
        }),
      ],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
