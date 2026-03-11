/**
 * Sync Scheduler — periodically checks for connections due for sync
 * and runs them sequentially to avoid DB contention.
 *
 * Uses setInterval (Bun.CronJob is not yet stable).
 */
import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { syncConnection } from "./sync-engine";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function startSyncScheduler(): void {
  if (schedulerInterval) {
    return;
  }

  console.log(
    `[SyncScheduler] Starting (check every ${CHECK_INTERVAL_MS / 1000}s)`
  );

  schedulerInterval = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runDueConnections();
    } catch (err) {
      console.error("[SyncScheduler] Unhandled error:", err);
    } finally {
      isRunning = false;
    }
  }, CHECK_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGTERM", stopSyncScheduler);
  process.on("SIGINT", stopSyncScheduler);
}

export function stopSyncScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[SyncScheduler] Stopped");
  }
}

async function runDueConnections(): Promise<void> {
  // Find connections that are due for a sync
  const dueConnections = await db.query.platformConnection.findMany({
    where: and(
      eq(platformConnection.isPaused, false),
      sql`${platformConnection.syncIntervalMinutes} > 0`,
      or(
        isNull(platformConnection.lastSyncSuccessAt),
        sql`${platformConnection.lastSyncSuccessAt} < NOW() - INTERVAL '1 minute' * ${platformConnection.syncIntervalMinutes}`
      )
    ),
  });

  if (dueConnections.length === 0) return;

  console.log(
    `[SyncScheduler] ${dueConnections.length} connection(s) due for sync`
  );

  for (const conn of dueConnections) {
    try {
      const result = await syncConnection(conn.id);
      console.log(
        `[SyncScheduler] ${conn.provider}/${conn.displayName}: ${result.status}, ` +
          `${result.tradesInserted} inserted, ${result.durationMs}ms`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[SyncScheduler] Failed ${conn.id}: ${msg}`
      );
    }
  }
}
