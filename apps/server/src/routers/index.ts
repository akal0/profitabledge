import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

import { uploadRouter } from "./upload";
import { accountsRouter } from "./accounts";
import { usersRouter } from "./users";
import { tradesRouter } from "./trades";

export const appRouter = router({
  upload: uploadRouter,
  accounts: accountsRouter,
  users: usersRouter,
  trades: tradesRouter,
});
export type AppRouter = typeof appRouter;
