import { router } from "../lib/trpc";
import { tradeMutationProcedures } from "./trades/mutations";
import { tradeQueryProcedures } from "./trades/queries";

export const tradesRouter = router({
  ...tradeQueryProcedures,
  ...tradeMutationProcedures,
});
