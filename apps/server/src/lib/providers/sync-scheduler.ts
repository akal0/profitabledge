/**
 * Sync Scheduler — periodically checks for connections due for sync
 * and runs them sequentially to avoid DB contention.
 *
 * Uses setInterval (Bun.CronJob is not yet stable).
 */
import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";
import { and, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { syncConnection } from "./sync-engine";
import { WORKER_MANAGED_PROVIDERS } from "../mt5/constants";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let schedulerStartedAt: string | null = null;
let lastRunStartedAt: string | null = null;
let lastRunCompletedAt: string | null = null;
let lastRunDueCount = 0;
let lastRunSucceededCount = 0;
let lastRunFailedCount = 0;
let lastRunConnectionIds: string[] = [];
let lastError: string | null = null;

type SyncSchedulerRunSummary = {
  dueCount: number;
  succeededCount: number;
  failedCount: number;
  connectionIds: string[];
};

function registerSignalHandlers() {
  process.off("SIGTERM", stopSyncScheduler);
  process.off("SIGINT", stopSyncScheduler);
  process.on("SIGTERM", stopSyncScheduler);
  process.on("SIGINT", stopSyncScheduler);
}

export async function runDueConnectionsOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  lastRunStartedAt = new Date().toISOString();
  lastError = null;
  try {
    const summary = await runDueConnections();
    lastRunDueCount = summary.dueCount;
    lastRunSucceededCount = summary.succeededCount;
    lastRunFailedCount = summary.failedCount;
    lastRunConnectionIds = summary.connectionIds;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error("[SyncScheduler] Unhandled error:", err);
  } finally {
    lastRunCompletedAt = new Date().toISOString();
    isRunning = false;
  }
}

export function startSyncScheduler(): void {
  if (schedulerInterval) {
    return;
  }

  console.log(
    `[SyncScheduler] Starting (check every ${CHECK_INTERVAL_MS / 1000}s)`
  );
  schedulerStartedAt = new Date().toISOString();

  void runDueConnectionsOnce();

  schedulerInterval = setInterval(() => {
    void runDueConnectionsOnce();
  }, CHECK_INTERVAL_MS);

  registerSignalHandlers();
}

export function stopSyncScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[SyncScheduler] Stopped");
  }
}

export function getSyncSchedulerStatus() {
  return {
    checkIntervalMs: CHECK_INTERVAL_MS,
    started: schedulerInterval !== null,
    startedAt: schedulerStartedAt,
    isRunning,
    lastRunStartedAt,
    lastRunCompletedAt,
    lastRunDueCount,
    lastRunSucceededCount,
    lastRunFailedCount,
    lastRunConnectionIds: [...lastRunConnectionIds],
    lastError,
  };
}

async function runDueConnections(): Promise<SyncSchedulerRunSummary> {
  // Find connections that are due for a sync
  const dueConnections = await db.query.platformConnection.findMany({
    where: and(
      eq(platformConnection.isPaused, false),
      notInArray(platformConnection.provider, [...WORKER_MANAGED_PROVIDERS]),
      sql`${platformConnection.syncIntervalMinutes} > 0`,
      or(
        isNull(platformConnection.lastSyncSuccessAt),
        sql`${platformConnection.lastSyncSuccessAt} < NOW() - INTERVAL '1 minute' * ${platformConnection.syncIntervalMinutes}`
      )
    ),
  });

  if (dueConnections.length === 0) {
    return {
      dueCount: 0,
      succeededCount: 0,
      failedCount: 0,
      connectionIds: [],
    };
  }

  console.log(
    `[SyncScheduler] ${dueConnections.length} connection(s) due for sync`
  );

  let succeededCount = 0;
  let failedCount = 0;

  for (const conn of dueConnections) {
    try {
      const result = await syncConnection(conn.id);
      if (result.status === "success" || result.status === "partial") {
        succeededCount += 1;
      } else {
        failedCount += 1;
      }
      console.log(
        `[SyncScheduler] ${conn.provider}/${conn.displayName}: ${result.status}, ` +
          `${result.tradesInserted} inserted, ${result.durationMs}ms`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failedCount += 1;
      console.error(
        `[SyncScheduler] Failed ${conn.id}: ${msg}`
      );
    }
  }

  return {
    dueCount: dueConnections.length,
    succeededCount,
    failedCount,
    connectionIds: dueConnections.map((connection) => connection.id),
  };
}
