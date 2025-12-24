import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

import { uploadRouter } from "./upload";
import { accountsRouter } from "./accounts";
import { usersRouter } from "./users";
import { tradesRouter } from "./trades";
import { webhookRouter } from "./webhook";
import { apiKeysRouter } from "./api-keys";

export const appRouter = router({
  upload: uploadRouter,
  accounts: accountsRouter,
  users: usersRouter,
  trades: tradesRouter,
  webhook: webhookRouter,
  apiKeys: apiKeysRouter,
});
export type AppRouter = typeof appRouter;
