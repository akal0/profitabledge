import { router } from "../lib/trpc";

import { uploadRouter } from "./upload";
import { accountsRouter } from "./accounts";
import { usersRouter } from "./users";
import { tradesRouter } from "./trades";
import { webhookRouter } from "./webhook";
import { apiKeysRouter } from "./api-keys";
import { aiKeysRouter } from "./ai-keys";
import { viewsRouter } from "./views";
import { aiRouter } from "./ai";
import { notificationsRouter } from "./notifications";
import { goalsRouter } from "./goals";
import { propFirmsRouter } from "./prop-firms";
import { pnlCardsRouter } from "./pnl-cards";
import { socialRouter } from "./social-redesign";
import { journalRouter } from "./journal";
import { edgesRouter } from "./edges";
import { alertsRouter } from "./alerts";
import { rulesRouter } from "./rules";
import { marketDataRouter } from "./market-data";
import { watchlistRouter, tradeNotesRouter } from "./watchlist";
import { connectionsRouter } from "./connections";
import { workerRouter } from "./worker";
import { operationsRouter } from "./operations";
import { billingRouter } from "./billing";
import { symbolMappingsRouter } from "./symbol-mappings";
import { proofRouter } from "./proof";
import { reportsRouter } from "./reports";

export const appRouter = router({
  upload: uploadRouter,
  accounts: accountsRouter,
  users: usersRouter,
  trades: tradesRouter,
  webhook: webhookRouter,
  apiKeys: apiKeysRouter,
  aiKeys: aiKeysRouter,
  views: viewsRouter,
  ai: aiRouter,
  notifications: notificationsRouter,
  goals: goalsRouter,
  propFirms: propFirmsRouter,
  pnlCards: pnlCardsRouter,
  social: socialRouter,
  journal: journalRouter,
  edges: edgesRouter,
  alerts: alertsRouter,
  rules: rulesRouter,
  marketData: marketDataRouter,
  watchlist: watchlistRouter,
  tradeNotes: tradeNotesRouter,
  connections: connectionsRouter,
  worker: workerRouter,
  operations: operationsRouter,
  billing: billingRouter,
  symbolMappings: symbolMappingsRouter,
  proof: proofRouter,
  reports: reportsRouter,
});
export type AppRouter = typeof appRouter;
