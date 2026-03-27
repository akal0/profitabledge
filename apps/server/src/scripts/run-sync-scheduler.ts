import {
  startSyncScheduler,
  stopSyncScheduler,
} from "../lib/providers/sync-scheduler";

async function main() {
  startSyncScheduler();
  console.log("[SyncScheduler] Runner started");
  await new Promise<void>((resolve) => {
    const handleExit = () => {
      stopSyncScheduler();
      resolve();
    };

    process.once("SIGTERM", handleExit);
    process.once("SIGINT", handleExit);
  });
}

void main().catch((error) => {
  console.error("[SyncScheduler] Runner failed:", error);
  process.exitCode = 1;
});
