import { router } from "../lib/trpc";
import { tradeManualProcedures } from "./trades/manual";
import { tradeMutationProcedures } from "./trades/mutations";
import { tradeQueryProcedures } from "./trades/queries";

export const tradesRouter = router({
  ...tradeQueryProcedures,
  ...tradeMutationProcedures,
  ...tradeManualProcedures,
});
