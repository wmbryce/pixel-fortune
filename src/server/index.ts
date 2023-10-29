import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  getTarotFortune: publicProcedure.query(async () => {
    console.log("testing this fortune");
    return [10, 20, 30];
  }),
  getTodos: publicProcedure.query(async () => {
    console.log("testing this");
    return [20, 30, 40];
  }),
});

export type AppRouter = typeof appRouter;
