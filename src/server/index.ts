import { publicProcedure, router } from "./trpc";
import { createTarotDeck } from "./handlers/deck";
import { TarotHandType } from "@/types";
import { generateFortune, generateMockFortune } from "./handlers/fortune";

export const appRouter = router({
  getTarotHand: publicProcedure.query(async () => {
    const newTarotDeck: TarotHandType = createTarotDeck();
    const newHand: TarotHandType = newTarotDeck.slice(0, 5);
    return newHand;
  }),
  getFortune: publicProcedure.mutation(async (opts) => {
    try {
      const response = await generateMockFortune();
      //   const response = await generateFortune();

      return response;
    } catch (error) {
      throw error;
    }
  }),
});

export type AppRouter = typeof appRouter;
