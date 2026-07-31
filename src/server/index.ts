import { publicProcedure, router } from "./trpc";
import { createTarotDeck } from "./handlers/deck";
import { TarotHandType } from "@/types";
import { generateFortune } from "./handlers/fortune";
import { z } from "zod";

export const appRouter = router({
  getTarotHand: publicProcedure.query(async () => {
    const newTarotDeck: TarotHandType = createTarotDeck();
    return newTarotDeck.slice(0, 5);
  }),
  getFortune: publicProcedure
    .input(
      z.array(
        z.object({
          id: z.number(),
          image: z.string(),
          description: z.string(),
          name: z.string(),
        })
      )
    )
    .mutation(async ({ input }) => generateFortune(input)),
});

export type AppRouter = typeof appRouter;
