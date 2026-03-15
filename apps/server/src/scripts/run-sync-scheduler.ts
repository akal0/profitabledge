import { getServerEnv } from "../lib/env";
import { getAlphaFeatureDisabledMessage } from "@profitabledge/platform";
import { getServerAlphaFlags } from "../lib/ops/alpha-runtime";
import {
  runDueConnectionsOnce,
  startSyncScheduler,
} from "../lib/providers/sync-scheduler";

async function main() {
  getServerEnv();
  if (!getServerAlphaFlags().scheduledSync) {
    console.log(`[SyncWorker] ${getAlphaFeatureDisabledMessage("scheduledSync")}`);
    return;
  }
  console.log("[SyncWorker] Bootstrapping sync scheduler");
  await runDueConnectionsOnce();
  startSyncScheduler();
  console.log("[SyncWorker] Scheduler is running");
}

main().catch((error) => {
  console.error("[SyncWorker] Failed to start", error);
  process.exit(1);
});
