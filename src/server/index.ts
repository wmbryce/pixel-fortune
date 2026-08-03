import { publicProcedure, router } from './trpc';
import { dealHand, resolveReading } from './handlers/reading';
import { z } from 'zod';

export const appRouter = router({
  /**
   * A mutation, not a query: dealing reserves budget, so it must not be
   * refetched or replayed by the query cache.
   */
  dealHand: publicProcedure.mutation(({ ctx }) => dealHand(ctx.visitor)),
  /**
   * Takes only the opaque token from the deal. The hand lives server-side, so
   * a client cannot choose the cards the prompt is built from — which is what
   * keeps attacker-authored text out of the reading cache.
   */
  getFortune: publicProcedure
    .input(z.object({ token: z.string().min(1).max(128) }))
    .mutation(({ input }) => resolveReading(input.token)),
});

export type AppRouter = typeof appRouter;
