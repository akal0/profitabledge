import { router } from "../lib/trpc";

import { aiIntelligenceProcedures } from "./ai/intelligence";
import { aiLogReportProcedures } from "./ai/logs-reports";
import { aiPsychologyRuleProcedures } from "./ai/psychology-rules";
import { aiTraderBrainProcedures } from "./ai/trader-brain";

export const aiRouter = router({
  ...aiLogReportProcedures,
  ...aiTraderBrainProcedures,
  ...aiPsychologyRuleProcedures,
  ...aiIntelligenceProcedures,
});
