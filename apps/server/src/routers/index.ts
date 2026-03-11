import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

import { uploadRouter } from "./upload";
import { accountsRouter } from "./accounts";
import { usersRouter } from "./users";
import { tradesRouter } from "./trades";
import { webhookRouter } from "./webhook";
import { apiKeysRouter } from "./api-keys";
import { viewsRouter } from "./views";
import { aiRouter } from "./ai";
import { copierRouter } from "./copier";
import { notificationsRouter } from "./notifications";
import { goalsRouter } from "./goals";
import { propFirmsRouter } from "./prop-firms";
import { pnlCardsRouter } from "./pnl-cards";
import { socialRouter } from "./social-redesign";
import { journalRouter } from "./journal";
import { alertsRouter } from "./alerts";
import { rulesRouter } from "./rules";
import { marketDataRouter } from "./market-data";
import { watchlistRouter, tradeNotesRouter } from "./watchlist";
import { connectionsRouter } from "./connections";
import { backtestRouter } from "./backtest";
import { workerRouter } from "./worker";

export const appRouter = router({
  upload: uploadRouter,
  accounts: accountsRouter,
  users: usersRouter,
  trades: tradesRouter,
  webhook: webhookRouter,
  apiKeys: apiKeysRouter,
  views: viewsRouter,
  ai: aiRouter,
  copier: copierRouter,
  notifications: notificationsRouter,
  goals: goalsRouter,
  propFirms: propFirmsRouter,
  pnlCards: pnlCardsRouter,
  social: socialRouter,
  journal: journalRouter,
  alerts: alertsRouter,
  rules: rulesRouter,
  marketData: marketDataRouter,
  watchlist: watchlistRouter,
  tradeNotes: tradeNotesRouter,
  connections: connectionsRouter,
  backtest: backtestRouter,
  worker: workerRouter,
});
export type AppRouter = typeof appRouter;
