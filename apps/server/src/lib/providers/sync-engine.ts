/**
 * Sync Engine — core logic for syncing trades from a platform connection.
 *
 * Flow: decrypt creds → call provider → normalize trades → upsert → snapshot → log
 */
import { db } from "../../db";
import {
  platformConnection,
  equitySnapshot,
  syncLog,
} from "../../db/schema/connections";
import { trade, tradingAccount } from "../../db/schema/trading";
import { eq, and } from "drizzle-orm";
import { decryptCredentials, encryptCredentials } from "./credential-cipher";
import { getProvider } from "./registry";
import { normalizeToTradeInsert } from "./trade-normalizer";
import { notifyEarnedAchievements } from "../achievements";
import { createNotification } from "../notifications";
import { syncPropAccountState } from "../prop-rule-monitor";

export interface SyncResult {
  connectionId: string;
  status: "success" | "partial" | "error" | "skipped";
  tradesFound: number;
  tradesInserted: number;
  tradesDuplicated: number;
  errorMessage: string | null;
  durationMs: number;
}

export async function syncConnection(
  connectionId: string,
  options: {
    notifySuccess?: boolean;
    source?: "manual" | "scheduled";
  } = {}
): Promise<SyncResult> {
  const startTime = Date.now();

  const conn = await db.query.platformConnection.findFirst({
    where: eq(platformConnection.id, connectionId),
  });

  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  if (conn.isPaused) {
    return {
      connectionId,
      status: "skipped",
      tradesFound: 0,
      tradesInserted: 0,
      tradesDuplicated: 0,
      errorMessage: "Sync paused by user",
      durationMs: Date.now() - startTime,
    };
  }

  const result: SyncResult = {
    connectionId,
    status: "error",
    tradesFound: 0,
    tradesInserted: 0,
    tradesDuplicated: 0,
    errorMessage: null,
    durationMs: 0,
  };

  try {
    // Mark sync in progress
    await db
      .update(platformConnection)
      .set({ lastSyncAttemptAt: new Date(), status: "active" })
      .where(eq(platformConnection.id, connectionId));

    // Decrypt credentials
    if (!conn.encryptedCredentials || !conn.credentialIv) {
      throw new Error("Connection has no stored credentials");
    }
    let credentials = JSON.parse(
      decryptCredentials(conn.encryptedCredentials, conn.credentialIv)
    );

    // Get provider
    const provider = await getProvider(conn.provider);

    // Refresh token if expired (OAuth providers)
    if (
      conn.tokenExpiresAt &&
      conn.tokenExpiresAt < new Date() &&
      provider.refreshToken
    ) {
      credentials = await provider.refreshToken(credentials);
      const { encrypted, iv } = encryptCredentials(JSON.stringify(credentials));
      const expiresAt = credentials.expiresAt
        ? new Date(credentials.expiresAt)
        : null;
      await db
        .update(platformConnection)
        .set({
          encryptedCredentials: encrypted,
          credentialIv: iv,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(platformConnection.id, connectionId));
    }

    const config = {
      credentials,
      meta: (conn.meta ?? {}) as Record<string, unknown>,
    };

    // Verify we have a linked account
    const accountId = conn.accountId;
    if (!accountId) {
      throw new Error(
        "Connection has no linked trading account. Link an account first."
      );
    }

    // Fetch trade history since last sync
    const normalizedTrades = await provider.fetchHistory(
      config,
      conn.syncCursor,
      config.meta
    );

    result.tradesFound = normalizedTrades.length;

    // Upsert trades (check for duplicates by ticket)
    let inserted = 0;
    let duplicated = 0;

    for (const normalized of normalizedTrades) {
      const existing = await db.query.trade.findFirst({
        where: and(
          eq(trade.accountId, accountId),
          eq(trade.ticket, normalized.ticket)
        ),
        columns: { id: true },
      });

      if (existing) {
        duplicated++;
        continue;
      }

      const insertRow = normalizeToTradeInsert(normalized, accountId);
      await db.insert(trade).values(insertRow);
      inserted++;
    }

    result.tradesInserted = inserted;
    result.tradesDuplicated = duplicated;

    // Update account info (balance, equity, etc.)
    const accountInfo = await provider.fetchAccountInfo(config, config.meta);
    await db
      .update(tradingAccount)
      .set({
        liveBalance: accountInfo.balance.toString(),
        liveEquity: accountInfo.equity.toString(),
        liveMargin: accountInfo.margin?.toString() ?? null,
        liveFreeMargin: accountInfo.freeMargin?.toString() ?? null,
        lastSyncedAt: new Date(),
        isVerified: 1,
      })
      .where(eq(tradingAccount.id, accountId));

    // Write equity snapshot for today
    const today = new Date().toISOString().split("T")[0];
    await db
      .insert(equitySnapshot)
      .values({
        accountId,
        snapshotDate: today,
        balance: accountInfo.balance.toString(),
        equity: accountInfo.equity.toString(),
        source: "api",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [equitySnapshot.accountId, equitySnapshot.snapshotDate],
        set: {
          balance: accountInfo.balance.toString(),
          equity: accountInfo.equity.toString(),
          source: "api",
          updatedAt: new Date(),
        },
      });

    await syncPropAccountState(accountId, { saveAlerts: true });

    // Advance sync cursor
    const newCursor =
      normalizedTrades.length > 0
        ? new Date(
            Math.max(...normalizedTrades.map((t) => t.closeTime.getTime()))
          )
        : conn.syncCursor;

    await db
      .update(platformConnection)
      .set({
        status: "active",
        lastSyncSuccessAt: new Date(),
        lastSyncedTradeCount: inserted,
        syncCursor: newCursor,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(platformConnection.id, connectionId));

    result.status = "success";

    if (result.tradesInserted > 0) {
      try {
        await notifyEarnedAchievements({
          userId: conn.userId,
          accountId,
          source: options.source ?? "scheduled-sync",
        });
      } catch (error) {
        console.error("[SyncEngine] Achievement notification failed:", error);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    result.errorMessage = message;

    await db
      .update(platformConnection)
      .set({
        status: "error",
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(platformConnection.id, connectionId));

    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      await createNotification({
        userId: conn.userId,
        accountId: conn.accountId ?? null,
        type: "webhook_sync",
        title: "Connection sync failed",
        body: `${conn.displayName}: ${message}`,
        metadata: {
          connectionId,
          provider: conn.provider,
          displayName: conn.displayName,
          status: "error",
          errorMessage: message,
          url: "/dashboard/settings/connections",
        },
        dedupeKey: `connection-sync-error:${connectionId}:${todayKey}:${message}`,
      });
    } catch (notificationError) {
      console.error(
        "[SyncEngine] Sync failure notification failed:",
        notificationError
      );
    }
  }

  result.durationMs = Date.now() - startTime;

  // Write sync log regardless of outcome
  await db.insert(syncLog).values({
    connectionId,
    accountId: conn.accountId ?? null,
    status: result.status,
    tradesFound: result.tradesFound,
    tradesInserted: result.tradesInserted,
    tradesDuplicated: result.tradesDuplicated,
    errorMessage: result.errorMessage,
    durationMs: result.durationMs,
  });

  if (result.status === "success" && options.notifySuccess) {
    const body =
      result.tradesInserted > 0
        ? `${conn.displayName} synced ${result.tradesInserted} new trade${
            result.tradesInserted === 1 ? "" : "s"
          }.`
        : `${conn.displayName} sync completed with no new trades.`;

    try {
      await createNotification({
        userId: conn.userId,
        accountId: conn.accountId ?? null,
        type: "webhook_sync",
        title: "Connection synced",
        body,
        metadata: {
          connectionId,
          provider: conn.provider,
          displayName: conn.displayName,
          tradesInserted: result.tradesInserted,
          tradesDuplicated: result.tradesDuplicated,
          status: "success",
          url: "/dashboard/settings/connections",
        },
      });
    } catch (notificationError) {
      console.error(
        "[SyncEngine] Sync success notification failed:",
        notificationError
      );
    }
  }

  return result;
}
