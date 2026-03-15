import { router } from "../lib/trpc";
import { operationsRuntimeSupportProcedures } from "./operations/runtime-support";

export const operationsRouter = router({
  ...operationsRuntimeSupportProcedures,
});
