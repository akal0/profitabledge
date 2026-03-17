import { router } from "../lib/trpc";
import { proofMutationProcedures } from "./proof/mutations";
import { proofQueryProcedures } from "./proof/queries";

export const proofRouter = router({
  ...proofQueryProcedures,
  ...proofMutationProcedures,
});
