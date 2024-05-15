import { publicProcedure, router } from "./trpc";
import { createTarotDeck } from "./handlers/deck";
import { TarotHandType } from "@/types";
import { generateFortune, generateMockFortune } from "./handlers/fortune";
import { z } from "zod";

export const appRouter = router({
  getTarotHand: publicProcedure.query(async () => {
    const newTarotDeck: TarotHandType = createTarotDeck();
    const newHand: TarotHandType = newTarotDeck.slice(0, 5);
    console.log("getTarotHand: ", newHand);
    return newHand;
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
    .mutation(async ({ input }) => {
      try {
        // const response = await generateMockFortune();
        const response = await generateFortune(input);
        return response;
      } catch (error) {
        throw error;
      }
    }),
});

export type AppRouter = typeof appRouter;
