import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

import { uploadRouter } from "./upload";
import { accountsRouter } from "./accounts";
import { usersRouter } from "./users";

export const appRouter = router({
  upload: uploadRouter,
  accounts: accountsRouter,
  users: usersRouter,
});
export type AppRouter = typeof appRouter;
