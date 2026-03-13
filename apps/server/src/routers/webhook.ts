import { router, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import {
  historicalPrices,
  tradingAccount,
  tradingRuleSet,
  openTrade,
  trade,
} from "../db/schema/trading";
import { apiKey } from "../db/schema/auth";
import { eq, and, inArray, notInArray, sql, gte, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { notifyEarnedAchievements } from "../lib/achievements";
import { updateTradePostExitPeak } from "../lib/manipulation-calculator";
import { cache, cacheKeys } from "../lib/cache";
import { createNotification } from "../lib/notifications";
import { createAutoTradeReviewEntry } from "../lib/auto-journal";
import { buildAutoPropAccountFields } from "../lib/prop-firm-detection";
import { ensurePropChallengeLineageForAccount } from "../lib/prop-challenge-lineage";
import { equitySnapshot } from "../db/schema/connections";
import { insertHistoricalPriceSnapshots } from "../lib/price-ingestion";
import {
  generateTradeCloseInsights,
  saveInsights,
  refreshProfileIfStale,
} from "../lib/ai/engine";
import { syncPropAccountState } from "../lib/prop-rule-monitor";
import {
  ackCopySignalExecution,
  claimPendingCopySignalsForAccount,
} from "../lib/copy-signal-queue";

/**
 * Webhook Router for MT4/MT5 Expert Advisor Integration
 *
 * This router handles incoming price data from user's Expert Advisors
 * running on their MetaTrader terminals.
 */

/**
 * Hash API key for secure storage
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

type VerifiedApiKeyCacheEntry = {
  userId: string;
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  cachedAt: number;
};

const API_KEY_CACHE_TTL_MS = Number(process.env.API_KEY_CACHE_TTL_MS ?? 60_000);
const API_KEY_LAST_USED_UPDATE_MS = Number(
  process.env.API_KEY_LAST_USED_UPDATE_MS ?? 15 * 60_000
);
const ENABLE_EA_CANDLE_INGESTION =
  process.env.ENABLE_EA_CANDLE_INGESTION !== "false";

const verifiedApiKeyCache = new Map<string, VerifiedApiKeyCacheEntry>();
const pendingApiKeyLookups = new Map<
  string,
  Promise<Omit<VerifiedApiKeyCacheEntry, "cachedAt">>
>();
const pendingApiKeyTouches = new Map<string, Promise<Date>>();

function cleanupVerifiedApiKeyCache(now: number) {
  if (verifiedApiKeyCache.size < 512) {
    return;
  }

  for (const [key, value] of verifiedApiKeyCache.entries()) {
    if (value.cachedAt + API_KEY_CACHE_TTL_MS <= now) {
      verifiedApiKeyCache.delete(key);
    }
  }
}

function isRetryableApiKeyStoreError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "";

  return (
    message.includes("data transfer quota") ||
    message.includes("HTTP status 402") ||
    message.includes("Unable to connect") ||
    message.includes("ConnectionRefused")
  );
}

async function loadVerifiedApiKey(
  hash: string
): Promise<Omit<VerifiedApiKeyCacheEntry, "cachedAt">> {
  const result = await db
    .select({
      userId: apiKey.userId,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.keyHash, hash))
    .limit(1);

  if (!result.length) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  const { userId, isActive, expiresAt, lastUsedAt } = result[0];
  return {
    userId,
    isActive,
    expiresAt: expiresAt ?? null,
    lastUsedAt: lastUsedAt ?? null,
  };
}

async function getVerifiedApiKeyRecord(
  hash: string
): Promise<Omit<VerifiedApiKeyCacheEntry, "cachedAt">> {
  const pending = pendingApiKeyLookups.get(hash);
  if (pending) {
    return pending;
  }

  const lookup = loadVerifiedApiKey(hash).finally(() => {
    pendingApiKeyLookups.delete(hash);
  });
  pendingApiKeyLookups.set(hash, lookup);
  return lookup;
}

async function touchApiKeyLastUsed(hash: string, now: number) {
  const pending = pendingApiKeyTouches.get(hash);
  if (pending) {
    return pending;
  }

  const touchTime = new Date(now);
  const update = db
    .update(apiKey)
    .set({ lastUsedAt: touchTime, updatedAt: touchTime })
    .where(eq(apiKey.keyHash, hash))
    .then(() => touchTime)
    .finally(() => {
      pendingApiKeyTouches.delete(hash);
    });
  pendingApiKeyTouches.set(hash, update);
  return update;
}

async function maybeTouchApiKeyLastUsed(
  hash: string,
  now: number,
  fallback: Date | null
) {
  try {
    return await touchApiKeyLastUsed(hash, now);
  } catch (error) {
    if (isRetryableApiKeyStoreError(error)) {
      return fallback;
    }
    throw error;
  }
}

/**
 * Verify API key and return user ID
 */
async function verifyApiKey(key: string): Promise<string> {
  const hash = hashApiKey(key);
  const now = Date.now();
  const cached = verifiedApiKeyCache.get(hash);

  if (cached && cached.cachedAt + API_KEY_CACHE_TTL_MS > now) {
    if (!cached.isActive) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "API key has been revoked",
      });
    }

    if (cached.expiresAt && cached.expiresAt.getTime() < now) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "API key has expired",
      });
    }

    const shouldTouchLastUsed =
      !cached.lastUsedAt ||
      now - cached.lastUsedAt.getTime() >= API_KEY_LAST_USED_UPDATE_MS;

    if (shouldTouchLastUsed) {
      const touchTime = await maybeTouchApiKeyLastUsed(
        hash,
        now,
        cached.lastUsedAt
      );
      cached.lastUsedAt = touchTime;
      cached.cachedAt = now;
      verifiedApiKeyCache.set(hash, cached);
    }

    return cached.userId;
  }

  const { userId, isActive, expiresAt, lastUsedAt } =
    await getVerifiedApiKeyRecord(hash);

  if (!isActive) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has been revoked",
    });
  }

  if (expiresAt && expiresAt < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has expired",
    });
  }

  const shouldTouchLastUsed =
    !lastUsedAt || now - lastUsedAt.getTime() >= API_KEY_LAST_USED_UPDATE_MS;
  const touchedAt = shouldTouchLastUsed
    ? await maybeTouchApiKeyLastUsed(hash, now, lastUsedAt)
    : lastUsedAt;

  cleanupVerifiedApiKeyCache(now);
  verifiedApiKeyCache.set(hash, {
    userId,
    isActive,
    expiresAt: expiresAt ?? null,
    lastUsedAt: touchedAt ?? null,
    cachedAt: now,
  });

  return userId;
}

export const webhookRouter = router({
  /**
   * Receive price updates from MT4/MT5 EA
   * Called by EA every N seconds (or on every tick) with current prices
   */
  priceUpdate: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountId: z.string().optional(), // Optional: link to specific trading account
        accountNumber: z.string().optional(),
        prices: z.array(
          z.object({
            symbol: z.string(),
            bid: z.number(),
            ask: z.number(),
            timestamp: z.string(), // ISO 8601 format
            bidVolume: z.number().optional(),
            askVolume: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Verify API key
        const userId = await verifyApiKey(input.apiKey);

        // Validate input
        if (!input.prices || input.prices.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No price data provided",
          });
        }

        // Rate limiting: max 100 ticks per second
        if (input.prices.length > 100) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many prices in single request (max 100)",
          });
        }

        const accounts = await db
          .select({ id: tradingAccount.id })
          .from(tradingAccount)
          .where(
            input.accountId
              ? and(
                  eq(tradingAccount.id, input.accountId),
                  eq(tradingAccount.userId, userId)
                )
              : input.accountNumber
              ? and(
                  eq(tradingAccount.userId, userId),
                  eq(tradingAccount.accountNumber, input.accountNumber)
                )
              : eq(tradingAccount.userId, userId)
          )
          .limit(input.accountId || input.accountNumber ? 1 : 2);

        if (
          !accounts.length ||
          (!input.accountId && !input.accountNumber && accounts.length !== 1)
        ) {
          return {
            success: true,
            inserted: 0,
          };
        }

        const accountId = accounts[0]?.id;
        if (!accountId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        const result = await insertHistoricalPriceSnapshots({
          userId,
          accountId,
          snapshots: input.prices,
        });

        return {
          success: true,
          inserted: result.inserted,
        };
      } catch (error) {
        console.error(`[priceUpdate] ERROR:`, error);
        throw error;
      }
    }),

  /**
   * Receive aggregated candle data from EA (for M1, M5, etc.)
   * This is more efficient for long trades
   */
  candleUpdate: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountId: z.string().optional(),
        candles: z.array(
          z.object({
            symbol: z.string(),
            timeframe: z.enum(["m1", "m5", "m15", "m30", "h1", "h4", "d1"]),
            timestamp: z.string(),
            openBid: z.number(),
            highBid: z.number(),
            lowBid: z.number(),
            closeBid: z.number(),
            openAsk: z.number(),
            highAsk: z.number(),
            lowAsk: z.number(),
            closeAsk: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      if (!ENABLE_EA_CANDLE_INGESTION) {
        return {
          success: true,
          inserted: 0,
          skipped: true,
        };
      }

      const userId = await verifyApiKey(input.apiKey);

      if (!input.candles || input.candles.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No candle data provided",
        });
      }

      const records = input.candles.map((candle) => ({
        id: nanoid(),
        userId,
        accountId: input.accountId || null,
        symbol: candle.symbol.toUpperCase(),
        timeframe: candle.timeframe,
        priceType: null,
        time: new Date(candle.timestamp),
        // OHLC with bid/ask separation
        openBid: candle.openBid.toString(),
        highBid: candle.highBid.toString(),
        lowBid: candle.lowBid.toString(),
        closeBid: candle.closeBid.toString(),
        openAsk: candle.openAsk.toString(),
        highAsk: candle.highAsk.toString(),
        lowAsk: candle.lowAsk.toString(),
        closeAsk: candle.closeAsk.toString(),
        // Legacy OHLC fields (use bid as default)
        open: candle.openBid.toString(),
        high: candle.highBid.toString(),
        low: candle.lowBid.toString(),
        close: candle.closeBid.toString(),
        // Tick fields null for candle data
        bidPrice: null,
        askPrice: null,
        bidVolume: null,
        askVolume: null,
      }));

      const inserted = await db
        .insert(historicalPrices)
        .values(records)
        .onConflictDoNothing({
          target: [
            historicalPrices.accountId,
            historicalPrices.symbol,
            historicalPrices.timeframe,
            historicalPrices.time,
          ],
        })
        .returning({ id: historicalPrices.id });

      return {
        success: true,
        inserted: inserted.length,
      };
    }),

  /**
   * Health check endpoint for EA to verify connection
   */
  ping: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      return {
        success: true,
        message: "Connection OK",
        userId,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Register/sync MT5 account from EA
   * Called when EA first starts or when account info changes
   */
  registerAccount: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        accountName: z.string().optional(),
        broker: z.string().optional(),
        brokerServer: z.string().optional(),
        initialBalance: z.number().optional(),
        currency: z.string().optional(),
        leverage: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      // Import the tradingAccount table
      const { tradingAccount } = await import("../db/schema/trading");

      // Check if account already exists for this user (by account number + broker server)
      const existing = await db
        .select({
          id: tradingAccount.id,
        })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber),
            eq(tradingAccount.brokerServer, input.brokerServer || "")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Account already exists, return it
        return {
          success: true,
          accountId: existing[0].id,
          message: "Account already registered",
        };
      }

      // Create new trading account
      const accountId = nanoid();
      const accountName = input.accountName || `MT5 ${input.accountNumber}`;
      const broker = input.broker?.toLowerCase() || "mt5";
      const { updates: autoPropFields } = await buildAutoPropAccountFields({
        broker,
        brokerServer: input.brokerServer || null,
        initialBalance: input.initialBalance ?? null,
      });

      await db.insert(tradingAccount).values({
        id: accountId,
        userId,
        name: accountName,
        broker,
        brokerServer: input.brokerServer || null,
        accountNumber: input.accountNumber,
        initialBalance: input.initialBalance?.toString() || null,
        initialCurrency: (input.currency as "$" | "£" | "€") || "$",
        brokerType: "mt5",
        ...autoPropFields,
        createdAt: new Date(),
      });

      if (autoPropFields.isPropAccount) {
        await ensurePropChallengeLineageForAccount(accountId);
      }

      await createNotification({
        userId,
        accountId,
        type: "settings_updated",
        title: "Account registered",
        body: `Account ${accountName} (${input.accountNumber}) registered.`,
        metadata: {
          accountId,
          accountNumber: input.accountNumber,
          broker,
        },
      });

      return {
        success: true,
        accountId,
        message: "Account registered successfully",
      };
    }),

  /**
   * Update account equity and status from EA
   * Called periodically (every few seconds) with current account state
   */
  updateAccountStatus: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        balance: z.number(),
        equity: z.number(),
        margin: z.number().optional(),
        freeMargin: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const userId = await verifyApiKey(input.apiKey);

        const { tradingAccount } = await import("../db/schema/trading");

        // OPTIMIZATION: Use direct update with where clause instead of select then update
        const result = await db
          .update(tradingAccount)
          .set({
            liveBalance: input.balance.toString(),
            liveEquity: input.equity.toString(),
            liveMargin: input.margin?.toString() || null,
            liveFreeMargin: input.freeMargin?.toString() || null,
            isVerified: 1, // Mark as verified (EA-synced)
            lastSyncedAt: new Date(),
          })
          .where(
            and(
              eq(tradingAccount.userId, userId),
              eq(tradingAccount.accountNumber, input.accountNumber)
            )
          )
          .returning({ id: tradingAccount.id });

        if (!result.length) {
          console.error(
            `[updateAccountStatus] Account not found: ${input.accountNumber}`
          );
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found. Please register account first.",
          });
        }

        // Invalidate cache for this account
        cache.invalidate(cacheKeys.liveMetrics(result[0].id));

        // Write daily equity snapshot (upsert — at most one row per account per day)
        const today = new Date().toISOString().split("T")[0];
        await db
          .insert(equitySnapshot)
          .values({
            accountId: result[0].id,
            snapshotDate: today,
            balance: input.balance.toString(),
            equity: input.equity.toString(),
            source: "ea",
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [equitySnapshot.accountId, equitySnapshot.snapshotDate],
            set: {
              balance: input.balance.toString(),
              equity: input.equity.toString(),
              updatedAt: new Date(),
            },
          });

        await syncPropAccountState(result[0].id, { saveAlerts: true });

        const hourKey = new Date().toISOString().slice(0, 13);
        await createNotification({
          userId,
          accountId: result[0].id,
          type: "webhook_sync",
          title: "EA sync active",
          body: `Account ${input.accountNumber} is syncing live status.`,
          metadata: {
            accountNumber: input.accountNumber,
            balance: input.balance,
            equity: input.equity,
          },
          dedupeKey: `webhook:account-status:${result[0].id}:${hourKey}`,
        });

        return {
          success: true,
          message: "Account status updated",
        };
      } catch (error) {
        console.error(`[updateAccountStatus] ERROR:`, error);
        throw error;
      }
    }),

  /**
   * Sync open trades from EA
   * Called when trades open/close/modify
   */
  syncOpenTrades: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        trades: z.array(
          z.object({
            ticket: z.string(), // MT5 ticket number
            symbol: z.string(),
            type: z.enum(["buy", "sell"]), // long/short
            volume: z.number(),
            openPrice: z.number(),
            openTime: z.string(), // ISO 8601
            sl: z.number().optional(),
            tp: z.number().optional(),
            currentPrice: z.number(),
            swap: z.number().optional(),
            commission: z.number().optional(),
            profit: z.number(),
            comment: z.string().optional(),
            magicNumber: z.number().optional(),
            sessionTag: z.string().optional(),
            sessionTagColor: z
              .string()
              .regex(/^#[0-9A-Fa-f]{6}$/)
              .optional(),
            slModCount: z.number().optional(),
            tpModCount: z.number().optional(),
            partialCloseCount: z.number().optional(),
            exitDealCount: z.number().optional(),
            exitVolume: z.number().optional(),
            entryDealCount: z.number().optional(),
            entryVolume: z.number().optional(),
            scaleInCount: z.number().optional(),
            scaleOutCount: z.number().optional(),
            trailingStopDetected: z.boolean().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const userId = await verifyApiKey(input.apiKey);

        const { tradingAccount, openTrade } = await import(
          "../db/schema/trading"
        );

        // OPTIMIZATION: Get accountId from cache or single query
        const accounts = await db
          .select({
            id: tradingAccount.id,
          })
          .from(tradingAccount)
          .where(
            and(
              eq(tradingAccount.userId, userId),
              eq(tradingAccount.accountNumber, input.accountNumber)
            )
          )
          .limit(1);

        if (!accounts.length) {
          console.error(
            `[syncOpenTrades] Account not found: ${input.accountNumber}`
          );
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        const accountId = accounts[0].id;

        // Upsert open trades and remove closed ones in a single transaction
        await db.transaction(async (tx) => {
          if (input.trades.length > 0) {
            const tickets = input.trades.map((t) => t.ticket);

            // Upsert each trade (insert or update on ticket+accountId conflict)
            for (const trade of input.trades) {
              const record = {
                id: nanoid(),
                accountId,
                ticket: trade.ticket,
                symbol: trade.symbol.toUpperCase(),
                tradeType:
                  trade.type === "buy" ? ("long" as const) : ("short" as const),
                volume: trade.volume.toString(),
                openPrice: trade.openPrice.toString(),
                openTime: new Date(trade.openTime),
                sl:
                  trade.sl != null && trade.sl > 0 ? trade.sl.toString() : null,
                tp:
                  trade.tp != null && trade.tp > 0 ? trade.tp.toString() : null,
                currentPrice: trade.currentPrice.toString(),
                swap: trade.swap?.toString() || "0",
                commission: trade.commission?.toString() || "0",
                profit: trade.profit.toString(),
                sessionTag: trade.sessionTag || null,
                sessionTagColor: trade.sessionTagColor || null,
                slModCount:
                  trade.slModCount != null
                    ? Math.round(trade.slModCount)
                    : null,
                tpModCount:
                  trade.tpModCount != null
                    ? Math.round(trade.tpModCount)
                    : null,
                partialCloseCount:
                  trade.partialCloseCount != null
                    ? Math.round(trade.partialCloseCount)
                    : null,
                exitDealCount:
                  trade.exitDealCount != null
                    ? Math.round(trade.exitDealCount)
                    : null,
                exitVolume: trade.exitVolume?.toString() || null,
                entryDealCount:
                  trade.entryDealCount != null
                    ? Math.round(trade.entryDealCount)
                    : null,
                entryVolume: trade.entryVolume?.toString() || null,
                scaleInCount:
                  trade.scaleInCount != null
                    ? Math.round(trade.scaleInCount)
                    : null,
                scaleOutCount:
                  trade.scaleOutCount != null
                    ? Math.round(trade.scaleOutCount)
                    : null,
                trailingStopDetected:
                  trade.trailingStopDetected != null
                    ? trade.trailingStopDetected
                    : null,
                comment: trade.comment || null,
                magicNumber: trade.magicNumber || null,
                lastUpdatedAt: new Date(),
                createdAt: new Date(),
              };

              await tx
                .insert(openTrade)
                .values(record)
                .onConflictDoUpdate({
                  target: [openTrade.accountId, openTrade.ticket],
                  set: {
                    symbol: record.symbol,
                    tradeType: record.tradeType,
                    volume: record.volume,
                    openPrice: record.openPrice,
                    openTime: record.openTime,
                    sl: record.sl,
                    tp: record.tp,
                    currentPrice: record.currentPrice,
                    swap: record.swap,
                    commission: record.commission,
                    profit: record.profit,
                    sessionTag: record.sessionTag,
                    sessionTagColor: record.sessionTagColor,
                    slModCount: record.slModCount,
                    tpModCount: record.tpModCount,
                    partialCloseCount: record.partialCloseCount,
                    exitDealCount: record.exitDealCount,
                    exitVolume: record.exitVolume,
                    entryDealCount: record.entryDealCount,
                    entryVolume: record.entryVolume,
                    scaleInCount: record.scaleInCount,
                    scaleOutCount: record.scaleOutCount,
                    trailingStopDetected: record.trailingStopDetected,
                    comment: record.comment,
                    magicNumber: record.magicNumber,
                    lastUpdatedAt: record.lastUpdatedAt,
                  },
                });
            }

            // Remove trades that are no longer open (closed between syncs)
            await tx
              .delete(openTrade)
              .where(
                and(
                  eq(openTrade.accountId, accountId),
                  notInArray(openTrade.ticket, tickets)
                )
              );
          } else {
            // EA reports zero open trades — clear all
            await tx
              .delete(openTrade)
              .where(eq(openTrade.accountId, accountId));
          }
        });

        // Invalidate cache for this account
        cache.invalidate(cacheKeys.liveMetrics(accountId));
        await syncPropAccountState(accountId, { saveAlerts: true });

        if (input.trades.length > 0) {
          const hourKey = new Date().toISOString().slice(0, 13);
          await createNotification({
            userId,
            accountId,
            type: "webhook_sync",
            title: "Live trades sync received",
            body: `${input.trades.length} open trades synced.`,
            metadata: {
              accountNumber: input.accountNumber,
              count: input.trades.length,
              source: "syncOpenTrades",
            },
            dedupeKey: `webhook:open-trades:${accountId}:${hourKey}`,
          });
        }

        return {
          success: true,
          synced: input.trades.length,
        };
      } catch (error) {
        console.error(`[syncOpenTrades] ERROR:`, error);
        throw error;
      }
    }),

  /**
   * Sync closed (historical) trades from EA
   * Called when EA detects new closed trades in account history
   */
  syncClosedTrades: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        trades: z.array(
          z.object({
            ticket: z.string(), // MT5 ticket number
            symbol: z.string(),
            type: z.enum(["buy", "sell"]), // long/short
            volume: z.number(),
            openPrice: z.number(),
            openTime: z.string(), // ISO 8601
            closePrice: z.number(),
            closeTime: z.string(), // ISO 8601
            sl: z.number().optional(),
            tp: z.number().optional(),
            swap: z.number().optional(),
            commission: z.number().optional(),
            profit: z.number(),
            comment: z.string().optional(),
            magicNumber: z.number().optional(),
            sessionTag: z.string().optional(),
            sessionTagColor: z
              .string()
              .regex(/^#[0-9A-Fa-f]{6}$/)
              .optional(),
            // Manipulation structure data (calculated by EA during trade)
            manipulationHigh: z.number().optional(), // Highest price during trade
            manipulationLow: z.number().optional(), // Lowest price during trade
            manipulationPips: z.number().optional(), // Adverse movement in pips
            entryPeakPrice: z.number().optional(), // Best price during trade (max favorable)
            entryPeakTimestamp: z.string().optional(), // When peak was reached
            postExitPeakPrice: z.number().optional(), // Best price after exit (max favorable)
            postExitPeakTimestamp: z.string().optional(), // When post-exit peak was reached
            postExitSamplingDuration: z.number().optional(), // Seconds sampled after exit
            entrySpreadPips: z.number().optional(), // Spread at entry
            exitSpreadPips: z.number().optional(), // Spread at exit
            entrySlippagePips: z.number().optional(), // Entry slippage in pips (absolute)
            exitSlippagePips: z.number().optional(), // Exit slippage in pips (absolute)
            slModCount: z.number().optional(), // SL modifications count
            tpModCount: z.number().optional(), // TP modifications count
            partialCloseCount: z.number().optional(), // Partial closes (count)
            exitDealCount: z.number().optional(), // Exit deals count
            exitVolume: z.number().optional(), // Exit volume summed across deals
            entryDealCount: z.number().optional(), // Entry deals count
            entryVolume: z.number().optional(), // Entry volume summed across deals
            scaleInCount: z.number().optional(), // Scale-in count
            scaleOutCount: z.number().optional(), // Scale-out count
            trailingStopDetected: z.boolean().optional(), // Trailing stop detection
            entryBalance: z.number().optional(), // Account balance at entry
            entryEquity: z.number().optional(), // Account equity at entry
            entryMargin: z.number().optional(), // Account margin at entry
            entryFreeMargin: z.number().optional(), // Free margin at entry
            entryMarginLevel: z.number().optional(), // Margin level at entry
            entryPeakDurationSeconds: z.number().optional(), // Seconds to entry peak
            postExitPeakDurationSeconds: z.number().optional(), // Seconds to post-exit peak
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      let stage = "verifyApiKey";
      try {
        const userId = await verifyApiKey(input.apiKey);

        stage = "importSchema";
        const { tradingAccount, trade } = await import("../db/schema/trading");

        stage = "findAccount";
        // Find the account
        const accounts = await db
          .select({
            id: tradingAccount.id,
          })
          .from(tradingAccount)
          .where(
            and(
              eq(tradingAccount.userId, userId),
              eq(tradingAccount.accountNumber, input.accountNumber)
            )
          )
          .limit(1);

        if (!accounts.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        const accountId = accounts[0].id;

        stage = "normalizeTrades";
        const normalizedTrades = input.trades.map((t) => ({
          ...t,
          ticket: String(t.ticket || ""),
          symbolUpper: t.symbol.toUpperCase(),
        }));

        if (normalizedTrades.length === 0) {
          return { success: true, synced: 0, skipped: 0 };
        }

        stage = "buildLookupArrays";
        const postExitReadyCount = normalizedTrades.filter(
          (t) => t.postExitPeakTimestamp != null
        ).length;
        const tickets = normalizedTrades
          .map((t) => t.ticket)
          .filter((t) => t.length > 0);
        const symbols = normalizedTrades.map((t) => t.symbolUpper);
        const openTimes = normalizedTrades.map((t) => new Date(t.openTime));
        const closeTimes = normalizedTrades.map((t) => new Date(t.closeTime));

        stage = "selectExistingByTicket";
        const existingByTicket =
          tickets.length > 0
            ? await db
                .select({
                  id: trade.id,
                  ticket: trade.ticket,
                })
                .from(trade)
                .where(
                  and(
                    eq(trade.accountId, accountId),
                    inArray(trade.ticket, tickets)
                  )
                )
            : [];

        stage = "selectExistingByKey";
        const existingByKey =
          symbols.length > 0 && openTimes.length > 0 && closeTimes.length > 0
            ? await db
                .select({
                  id: trade.id,
                  symbol: trade.symbol,
                  openTime: trade.openTime,
                  closeTime: trade.closeTime,
                  profit: trade.profit,
                  ticket: trade.ticket,
                })
                .from(trade)
                .where(
                  and(
                    eq(trade.accountId, accountId),
                    inArray(trade.symbol, symbols),
                    inArray(
                      trade.openTime,
                      openTimes.filter((t): t is Date => t != null) as Date[]
                    ),
                    inArray(
                      trade.closeTime,
                      closeTimes.filter((t): t is Date => t != null) as Date[]
                    )
                  )
                )
            : [];

        stage = "buildMaps";
        const ticketMap = new Map(
          existingByTicket.map((t) => [t.ticket, t.id])
        );
        const keyMap = new Map(
          existingByKey.map((t) => [
            `${t.symbol}-${
              t.openTime ? new Date(t.openTime).toISOString() : "null"
            }-${t.closeTime ? new Date(t.closeTime).toISOString() : "null"}-${
              t.profit
            }`,
            { id: t.id, ticket: t.ticket },
          ])
        );

        stage = "buildUpserts";
        const inserts: typeof normalizedTrades = [];
        const updates: Array<{
          id: string;
          data: Record<string, any>;
          hasRichData: boolean;
        }> = [];

        for (const t of normalizedTrades) {
          const hasRichData =
            t.manipulationHigh != null ||
            t.manipulationLow != null ||
            t.manipulationPips != null ||
            t.entryPeakPrice != null ||
            t.postExitPeakPrice != null ||
            t.entryPeakTimestamp != null ||
            t.postExitPeakTimestamp != null ||
            t.entrySpreadPips != null ||
            t.exitSpreadPips != null ||
            t.entrySlippagePips != null ||
            t.exitSlippagePips != null ||
            t.entryBalance != null ||
            t.entryEquity != null ||
            t.entryMargin != null ||
            t.entryFreeMargin != null ||
            t.entryMarginLevel != null ||
            t.entryPeakDurationSeconds != null ||
            t.postExitPeakDurationSeconds != null;
          const safeTicket = t.ticket || `${t.symbolUpper}-${t.openTime}`;
          const key = `${t.symbolUpper}-${new Date(
            t.openTime
          ).toISOString()}-${new Date(t.closeTime).toISOString()}-${t.profit}`;
          const existingId =
            (safeTicket ? ticketMap.get(safeTicket) : undefined) ||
            keyMap.get(key)?.id;

          const baseData = {
            ticket: safeTicket,
            symbol: t.symbolUpper,
            tradeType:
              t.type === "buy" ? "long" : ("short" as "long" | "short"),
            open: undefined, // Legacy CSV field - not used for EA-synced trades
            close: undefined, // Legacy CSV field - not used for EA-synced trades
            openTime: new Date(t.openTime),
            closeTime: new Date(t.closeTime),
            openPrice: t.openPrice.toString(),
            closePrice: t.closePrice.toString(),
            volume: t.volume.toString(),
            sl: t.sl != null && t.sl > 0 ? t.sl.toString() : undefined,
            tp: t.tp != null && t.tp > 0 ? t.tp.toString() : undefined,
            swap: t.swap?.toString() ?? undefined,
            commissions: t.commission?.toString() ?? undefined,
            profit: t.profit.toString(),
            sessionTag: t.sessionTag ?? undefined,
            sessionTagColor: t.sessionTagColor ?? undefined,
            killzone: t.sessionTag ?? undefined,
            killzoneColor: t.sessionTagColor ?? undefined,
            manipulationHigh:
              t.manipulationHigh != null
                ? t.manipulationHigh.toString()
                : undefined,
            manipulationLow:
              t.manipulationLow != null
                ? t.manipulationLow.toString()
                : undefined,
            manipulationPips:
              t.manipulationPips != null
                ? t.manipulationPips.toString()
                : undefined,
            entryPeakPrice:
              t.entryPeakPrice != null
                ? t.entryPeakPrice.toString()
                : undefined,
            entryPeakTimestamp:
              t.entryPeakTimestamp != null
                ? new Date(t.entryPeakTimestamp)
                : undefined,
            postExitPeakPrice:
              t.postExitPeakPrice != null
                ? t.postExitPeakPrice.toString()
                : undefined,
            postExitPeakTimestamp:
              t.postExitPeakTimestamp != null
                ? new Date(t.postExitPeakTimestamp)
                : undefined,
            postExitSamplingDuration:
              t.postExitSamplingDuration != null
                ? Math.round(t.postExitSamplingDuration)
                : undefined,
            entrySpreadPips:
              t.entrySpreadPips != null
                ? t.entrySpreadPips.toString()
                : undefined,
            exitSpreadPips:
              t.exitSpreadPips != null
                ? t.exitSpreadPips.toString()
                : undefined,
            entrySlippagePips:
              t.entrySlippagePips != null
                ? t.entrySlippagePips.toString()
                : undefined,
            exitSlippagePips:
              t.exitSlippagePips != null
                ? t.exitSlippagePips.toString()
                : undefined,
            slModCount:
              t.slModCount != null ? Math.round(t.slModCount) : undefined,
            tpModCount:
              t.tpModCount != null ? Math.round(t.tpModCount) : undefined,
            partialCloseCount:
              t.partialCloseCount != null
                ? Math.round(t.partialCloseCount)
                : undefined,
            exitDealCount:
              t.exitDealCount != null ? Math.round(t.exitDealCount) : undefined,
            exitVolume:
              t.exitVolume != null ? t.exitVolume.toString() : undefined,
            entryDealCount:
              t.entryDealCount != null
                ? Math.round(t.entryDealCount)
                : undefined,
            entryVolume:
              t.entryVolume != null ? t.entryVolume.toString() : undefined,
            scaleInCount:
              t.scaleInCount != null ? Math.round(t.scaleInCount) : undefined,
            scaleOutCount:
              t.scaleOutCount != null ? Math.round(t.scaleOutCount) : undefined,
            trailingStopDetected:
              t.trailingStopDetected != null
                ? t.trailingStopDetected
                : undefined,
            entryBalance:
              t.entryBalance != null ? t.entryBalance.toString() : undefined,
            entryEquity:
              t.entryEquity != null ? t.entryEquity.toString() : undefined,
            entryMargin:
              t.entryMargin != null ? t.entryMargin.toString() : undefined,
            entryFreeMargin:
              t.entryFreeMargin != null
                ? t.entryFreeMargin.toString()
                : undefined,
            entryMarginLevel:
              t.entryMarginLevel != null
                ? t.entryMarginLevel.toString()
                : undefined,
            entryPeakDurationSeconds:
              t.entryPeakDurationSeconds != null
                ? Math.round(t.entryPeakDurationSeconds)
                : undefined,
            postExitPeakDurationSeconds:
              t.postExitPeakDurationSeconds != null
                ? Math.round(t.postExitPeakDurationSeconds)
                : undefined,
          };

          if (!existingId) {
            inserts.push(t);
          } else {
            updates.push({ id: existingId, data: baseData, hasRichData });
          }
        }

        stage = "applyUpdates";
        if (updates.length > 0) {
          for (const update of updates) {
            if (!update.data) continue;
            if (!update.hasRichData) continue;
            const cleaned = Object.fromEntries(
              Object.entries(update.data).filter(
                ([, value]) => value !== undefined
              )
            );
            if (Object.keys(cleaned).length === 0) continue;
            await db
              .update(trade)
              .set({ ...cleaned })
              .where(eq(trade.id, update.id));
          }
        }

        stage = "applyInserts";
        const insertedRecords: Array<{ id: string; ticket: string }> = [];
        if (inserts.length > 0) {
          const records = inserts.map((t) => {
            const openTime = new Date(t.openTime);
            const closeTime = new Date(t.closeTime);
            const durationSeconds = Math.floor(
              (closeTime.getTime() - openTime.getTime()) / 1000
            );

            return {
              id: nanoid(),
              accountId,
              // Map to correct schema field names
              ticket: String(t.ticket),
              symbol: t.symbol.toUpperCase(),
              tradeType:
                t.type === "buy" ? "long" : ("short" as "long" | "short"),
              open: null, // Legacy CSV field - not used for EA-synced trades
              close: null, // Legacy CSV field - not used for EA-synced trades
              openTime: openTime,
              closeTime: closeTime,
              openPrice: t.openPrice.toString(),
              closePrice: t.closePrice.toString(),
              volume: t.volume.toString(),
              // MT5 sends 0 when no SL/TP is set, so treat 0 as null
              sl: t.sl != null && t.sl > 0 ? t.sl.toString() : null,
              tp: t.tp != null && t.tp > 0 ? t.tp.toString() : null,
              swap: t.swap?.toString() || "0",
              commissions: t.commission?.toString() || "0",
              profit: t.profit.toString(),
              pips: null, // Calculate if needed
              tradeDurationSeconds: durationSeconds.toString(),
              useBrokerData: 1, // Mark as broker data
              sessionTag: t.sessionTag || null,
              sessionTagColor: t.sessionTagColor || null,
              killzone: t.sessionTag || null,
              killzoneColor: t.sessionTagColor || null,
              // Manipulation structure data from EA
              manipulationHigh: t.manipulationHigh?.toString() || null,
              manipulationLow: t.manipulationLow?.toString() || null,
              manipulationPips: t.manipulationPips?.toString() || null,
              entryPeakPrice: t.entryPeakPrice?.toString() || null,
              entryPeakTimestamp: t.entryPeakTimestamp
                ? new Date(t.entryPeakTimestamp)
                : null,
              postExitPeakPrice: t.postExitPeakPrice?.toString() || null,
              postExitPeakTimestamp: t.postExitPeakTimestamp
                ? new Date(t.postExitPeakTimestamp)
                : null,
              postExitSamplingDuration:
                t.postExitSamplingDuration != null
                  ? Math.round(t.postExitSamplingDuration)
                  : null,
              entrySpreadPips: t.entrySpreadPips?.toString() || null,
              exitSpreadPips: t.exitSpreadPips?.toString() || null,
              entrySlippagePips: t.entrySlippagePips?.toString() || null,
              exitSlippagePips: t.exitSlippagePips?.toString() || null,
              slModCount:
                t.slModCount != null ? Math.round(t.slModCount) : null,
              tpModCount:
                t.tpModCount != null ? Math.round(t.tpModCount) : null,
              partialCloseCount:
                t.partialCloseCount != null
                  ? Math.round(t.partialCloseCount)
                  : null,
              exitDealCount:
                t.exitDealCount != null ? Math.round(t.exitDealCount) : null,
              exitVolume: t.exitVolume?.toString() || null,
              entryDealCount:
                t.entryDealCount != null ? Math.round(t.entryDealCount) : null,
              entryVolume: t.entryVolume?.toString() || null,
              scaleInCount:
                t.scaleInCount != null ? Math.round(t.scaleInCount) : null,
              scaleOutCount:
                t.scaleOutCount != null ? Math.round(t.scaleOutCount) : null,
              trailingStopDetected:
                t.trailingStopDetected != null ? t.trailingStopDetected : null,
              entryBalance: t.entryBalance?.toString() || null,
              entryEquity: t.entryEquity?.toString() || null,
              entryMargin: t.entryMargin?.toString() || null,
              entryFreeMargin: t.entryFreeMargin?.toString() || null,
              entryMarginLevel: t.entryMarginLevel?.toString() || null,
              entryPeakDurationSeconds:
                t.entryPeakDurationSeconds != null
                  ? Math.round(t.entryPeakDurationSeconds)
                  : null,
              postExitPeakDurationSeconds:
                t.postExitPeakDurationSeconds != null
                  ? Math.round(t.postExitPeakDurationSeconds)
                  : null,
              createdAt: new Date(),
            };
          });

          const inserted = await db
            .insert(trade)
            .values(records)
            .returning({ id: trade.id, ticket: trade.ticket });
          for (const record of inserted) {
            insertedRecords.push({
              id: record.id as string,
              ticket: record.ticket as string,
            });
          }

          // Generate feed events for closed trades (async, don't block)
          if (inserted.length > 0) {
            Promise.all(
              inserted.map((t) =>
                import("../lib/feed-event-generator").then((m) =>
                  m
                    .generateFeedEventForTrade(t.id as string)
                    .catch((err) =>
                      console.error("Feed event generation failed:", err)
                    )
                )
              )
            ).catch((err) => console.error("Feed event batch failed:", err));
          }

          await syncPropAccountState(accountId, { saveAlerts: true });
        }

        stage = "autoBackfillPostExit";
        let autoBackfillCount = 0;
        if (normalizedTrades.length <= 5) {
          for (const t of normalizedTrades) {
            if (t.postExitPeakTimestamp != null) continue;
            const safeTicket = t.ticket || `${t.symbolUpper}-${t.openTime}`;
            const updated = updates.find((u) => u.data.ticket === safeTicket);
            const inserted = insertedRecords.find(
              (r) => r.ticket === safeTicket
            );
            const tradeId = updated?.id || inserted?.id;
            if (!tradeId) continue;
            try {
              await updateTradePostExitPeak(tradeId, accountId, 3600);
              autoBackfillCount += 1;
            } catch (err) {
              console.warn(
                "[syncClosedTrades] auto backfill failed",
                safeTicket,
                err
              );
            }
          }
        }

        if (insertedRecords.length > 0) {
          await createNotification({
            userId,
            accountId,
            type: "trade_closed",
            title: "Trades closed",
            body: `${insertedRecords.length} trades closed on account ${input.accountNumber}.`,
            metadata: {
              accountNumber: input.accountNumber,
              count: insertedRecords.length,
              tickets: insertedRecords.map((record) => record.ticket),
            },
          });

          void notifyEarnedAchievements({
            userId,
            accountId,
            source: "webhook-sync",
          }).catch((error) => {
            console.error("[Webhook] Achievement notification failed:", error);
          });

          // Fire-and-forget: Generate trade close insights + refresh profile
          const tradeIds = insertedRecords.map((r) => r.id).filter(Boolean);
          Promise.all([
            // Generate insights for each closed trade
            ...tradeIds.map((tradeId) =>
              generateTradeCloseInsights(accountId, userId, tradeId)
                .then((insights) =>
                  insights.length > 0
                    ? saveInsights(
                        accountId,
                        userId,
                        insights,
                        "trade_close",
                        tradeId
                      )
                    : undefined
                )
                .catch((e) =>
                  console.error("[Webhook] Insight generation failed:", e)
                )
            ),
            Promise.all(
              tradeIds.map((tradeId) =>
                createAutoTradeReviewEntry({ userId, tradeId }).catch((e) => {
                  console.error("[Webhook] Auto journal generation failed:", e);
                  return null;
                })
              )
            ).then(async (reviewResults) => {
              const createdReviews = reviewResults.filter(
                (result): result is NonNullable<typeof result> =>
                  Boolean(result?.created && result.entry)
              );

              if (createdReviews.length === 0) {
                return;
              }

              if (createdReviews.length === 1) {
                const review = createdReviews[0].entry;
                await createNotification({
                  userId,
                  accountId,
                  type: "post_exit_ready",
                  title: "Trade review ready",
                  body: `${review.title} has been added to your journal.`,
                  metadata: {
                    accountId,
                    accountNumber: input.accountNumber,
                    journalEntryId: review.id,
                    linkedTradeIds: review.linkedTradeIds,
                    url: `/dashboard/journal?entryId=${review.id}&entryType=trade_review`,
                  },
                  dedupeKey: `auto-trade-review:${review.id}`,
                });
                return;
              }

              await createNotification({
                userId,
                accountId,
                type: "post_exit_ready",
                title: `${createdReviews.length} trade reviews ready`,
                body: "Auto-generated post-trade reviews have been added to your journal.",
                metadata: {
                  accountId,
                  accountNumber: input.accountNumber,
                  count: createdReviews.length,
                  journalEntryIds: createdReviews.map(
                    (review) => review.entry.id
                  ),
                  url: "/dashboard/journal?entryType=trade_review",
                },
                dedupeKey: `auto-trade-review-batch:${accountId}:${createdReviews
                  .map((review) => review.entry.id)
                  .sort()
                  .join(",")}`,
              });
            }),
            // Refresh profile if stale
            refreshProfileIfStale(
              accountId,
              userId,
              insertedRecords.length
            ).catch((e) =>
              console.error("[Webhook] Profile refresh failed:", e)
            ),
          ]).catch((e) =>
            console.error("[Webhook] Post-close tasks failed:", e)
          );
        }

        if (postExitReadyCount > 0 || autoBackfillCount > 0) {
          const total = postExitReadyCount + autoBackfillCount;
          await createNotification({
            userId,
            accountId,
            type: "post_exit_ready",
            title: "Post-exit metrics updated",
            body: `${total} trades updated with post-exit metrics.`,
            metadata: {
              accountNumber: input.accountNumber,
              count: total,
              fromWebhook: postExitReadyCount,
              backfilled: autoBackfillCount,
            },
          });
        }

        return {
          success: true,
          synced: inserts.length,
          skipped: input.trades.length - inserts.length,
        };
      } catch (error) {
        console.error("[syncClosedTrades] failed at", stage, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `syncClosedTrades failed at ${stage}`,
        });
      }
    }),

  // ============== TRADE COPIER ENDPOINTS ==============

  /**
   * Get pending copy signals for a slave account
   * Called by slave EA to check for signals to execute
   */
  getCopySignals: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      // Find the account
      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        return { signals: [] };
      }

      const accountId = accounts[0].id;
      const signals = await claimPendingCopySignalsForAccount(accountId);

      return {
        signals,
      };
    }),

  /**
   * Acknowledge copy signal execution
   * Called by slave EA after executing (or failing to execute) a signal
   */
  ackCopySignal: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        signalId: z.string().min(1),
        success: z.boolean(),
        slaveTicket: z.string().optional(),
        executedPrice: z.number().optional(),
        slippagePips: z.number().optional(),
        profit: z.number().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await verifyApiKey(input.apiKey);
      return ackCopySignalExecution({
        signalId: input.signalId,
        success: input.success,
        slaveTicket: input.slaveTicket,
        executedPrice: input.executedPrice,
        slippagePips: input.slippagePips,
        profit: input.profit,
        errorMessage: input.errorMessage,
      });
    }),

  /**
   * Notify server that a master trade was opened
   * Called by master EA when a new trade is detected
   */
  masterTradeOpen: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        trade: z.object({
          ticket: z.string(),
          symbol: z.string(),
          type: z.enum(["buy", "sell"]),
          volume: z.number(),
          openPrice: z.number(),
          sl: z.number().optional(),
          tp: z.number().optional(),
          sessionTag: z.string().optional(),
        }),
        accountMetrics: z.object({
          balance: z.number(),
          equity: z.number(),
          initialBalance: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const { tradingAccount } = await import("../db/schema/trading");
      const { processMasterTradeOpen } = await import("../lib/copy-engine");

      // Find the master account
      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const masterAccountId = accounts[0].id;

      await processMasterTradeOpen(
        masterAccountId,
        {
          ticket: input.trade.ticket,
          symbol: input.trade.symbol,
          tradeType: input.trade.type,
          volume: input.trade.volume,
          openPrice: input.trade.openPrice,
          sl: input.trade.sl,
          tp: input.trade.tp,
          sessionTag: input.trade.sessionTag,
        },
        {
          balance: input.accountMetrics.balance,
          equity: input.accountMetrics.equity,
          initialBalance:
            input.accountMetrics.initialBalance ?? input.accountMetrics.balance,
        }
      );

      return { success: true };
    }),

  /**
   * Notify server that a master trade was closed
   * Called by master EA when a trade is closed
   */
  masterTradeClose: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        ticket: z.string(),
        closePrice: z.number(),
        profit: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const { tradingAccount } = await import("../db/schema/trading");
      const { processMasterTradeClose } = await import("../lib/copy-engine");

      // Find the master account
      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      await processMasterTradeClose(
        accounts[0].id,
        input.ticket,
        input.closePrice,
        input.profit
      );

      return { success: true };
    }),

  /**
   * Notify server that a master trade SL/TP was modified
   * Called by master EA when SL or TP changes
   */
  masterTradeModify: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        ticket: z.string(),
        newSl: z.number().optional(),
        newTp: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const { tradingAccount } = await import("../db/schema/trading");
      const { processMasterTradeModify } = await import("../lib/copy-engine");

      // Find the master account
      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      await processMasterTradeModify(
        accounts[0].id,
        input.ticket,
        input.newSl ?? null,
        input.newTp ?? null
      );

      return { success: true };
    }),

  /**
   * Pre-Trade Evaluation - EA sends proposed trade for rule check before execution
   * Returns allow/warn/block decision based on active rule sets
   */
  evaluatePreTrade: publicProcedure
    .input(
      z.object({
        apiKey: z.string(),
        accountNumber: z.string(),
        symbol: z.string(),
        direction: z.enum(["buy", "sell"]),
        volume: z.number(),
        sl: z.number().optional(),
        tp: z.number().optional(),
        spread: z.number().optional(),
        entryPrice: z.number().optional(),
        accountBalance: z.number().optional(),
        accountEquity: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      // Find the account
      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        return { decision: "allow" as const, violations: [], warnings: [] };
      }

      const accountId = accounts[0].id;

      // Get active rule sets for this account (or global ones)
      const ruleSets = await db
        .select()
        .from(tradingRuleSet)
        .where(
          and(
            eq(tradingRuleSet.userId, userId),
            eq(tradingRuleSet.isActive, true)
          )
        );

      // Filter to account-specific or global rule sets
      const applicableRules = ruleSets.filter(
        (rs) => !rs.accountId || rs.accountId === accountId
      );

      if (!applicableRules.length) {
        return { decision: "allow" as const, violations: [], warnings: [] };
      }

      const violations: { rule: string; ruleSet: string; message: string }[] =
        [];
      const warnings: { rule: string; ruleSet: string; message: string }[] = [];

      // Get today's trade count and open trade count for daily/concurrent limits
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [dailyTradeCount] = await db
        .select({ count: count() })
        .from(trade)
        .where(
          and(eq(trade.accountId, accountId), gte(trade.openTime, todayStart))
        );

      const [openTradeCount] = await db
        .select({ count: count() })
        .from(openTrade)
        .where(eq(openTrade.accountId, accountId));

      const currentDay = new Date().getDay(); // 0-6

      for (const ruleSet of applicableRules) {
        const rules = ruleSet.rules as Record<string, unknown>;
        const rsName = ruleSet.name;

        // SL required
        if (rules.requireSL && !input.sl) {
          violations.push({
            rule: "requireSL",
            ruleSet: rsName,
            message: "Stop loss is required",
          });
        }

        // TP required
        if (rules.requireTP && !input.tp) {
          violations.push({
            rule: "requireTP",
            ruleSet: rsName,
            message: "Take profit is required",
          });
        }

        // Max spread
        if (rules.maxEntrySpreadPips && input.spread) {
          if (input.spread > (rules.maxEntrySpreadPips as number)) {
            violations.push({
              rule: "maxEntrySpreadPips",
              ruleSet: rsName,
              message: `Spread ${input.spread.toFixed(1)} exceeds max ${
                rules.maxEntrySpreadPips
              } pips`,
            });
          }
        }

        // Allowed symbols
        if (
          rules.allowedSymbols &&
          (rules.allowedSymbols as string[]).length > 0
        ) {
          const allowed = (rules.allowedSymbols as string[]).map((s) =>
            s.toUpperCase()
          );
          if (!allowed.includes(input.symbol.toUpperCase())) {
            violations.push({
              rule: "allowedSymbols",
              ruleSet: rsName,
              message: `${input.symbol} is not in allowed symbols list`,
            });
          }
        }

        // Blocked symbols
        if (
          rules.blockedSymbols &&
          (rules.blockedSymbols as string[]).length > 0
        ) {
          const blocked = (rules.blockedSymbols as string[]).map((s) =>
            s.toUpperCase()
          );
          if (blocked.includes(input.symbol.toUpperCase())) {
            violations.push({
              rule: "blockedSymbols",
              ruleSet: rsName,
              message: `${input.symbol} is blocked`,
            });
          }
        }

        // Allowed days
        if (rules.allowedDays && (rules.allowedDays as number[]).length > 0) {
          if (!(rules.allowedDays as number[]).includes(currentDay)) {
            violations.push({
              rule: "allowedDays",
              ruleSet: rsName,
              message: `Trading not allowed on this day`,
            });
          }
        }

        // Max daily trades
        if (rules.maxDailyTrades) {
          if (
            (dailyTradeCount?.count ?? 0) >= (rules.maxDailyTrades as number)
          ) {
            violations.push({
              rule: "maxDailyTrades",
              ruleSet: rsName,
              message: `Daily trade limit reached (${dailyTradeCount?.count}/${rules.maxDailyTrades})`,
            });
          }
        }

        // Max concurrent trades
        if (rules.maxConcurrentTrades) {
          if (
            (openTradeCount?.count ?? 0) >=
            (rules.maxConcurrentTrades as number)
          ) {
            violations.push({
              rule: "maxConcurrentTrades",
              ruleSet: rsName,
              message: `Max concurrent trades reached (${openTradeCount?.count}/${rules.maxConcurrentTrades})`,
            });
          }
        }

        // Min planned RR check
        if (rules.minPlannedRR && input.sl && input.tp && input.entryPrice) {
          const riskPips = Math.abs(input.entryPrice - input.sl);
          const rewardPips = Math.abs(input.tp - input.entryPrice);
          const plannedRR = riskPips > 0 ? rewardPips / riskPips : 0;
          if (plannedRR < (rules.minPlannedRR as number)) {
            violations.push({
              rule: "minPlannedRR",
              ruleSet: rsName,
              message: `Planned RR ${plannedRR.toFixed(2)} below minimum ${
                rules.minPlannedRR
              }`,
            });
          }
        }

        // Max position size percent
        if (
          rules.maxPositionSizePercent &&
          input.accountBalance &&
          input.entryPrice &&
          input.sl
        ) {
          const riskPerUnit = Math.abs(input.entryPrice - input.sl);
          const totalRisk = riskPerUnit * input.volume * 100000; // Approximate for forex
          const riskPercent = (totalRisk / input.accountBalance) * 100;
          if (riskPercent > (rules.maxPositionSizePercent as number)) {
            warnings.push({
              rule: "maxPositionSizePercent",
              ruleSet: rsName,
              message: `Position risk ~${riskPercent.toFixed(1)}% exceeds max ${
                rules.maxPositionSizePercent
              }%`,
            });
          }
        }

        // Max daily loss check
        if (rules.maxDailyLossPercent && input.accountBalance) {
          const [dailyPnl] = await db
            .select({
              total: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS DECIMAL)), 0)`,
            })
            .from(trade)
            .where(
              and(
                eq(trade.accountId, accountId),
                gte(trade.openTime, todayStart)
              )
            );
          const dailyLossPct =
            (Math.abs(Math.min(0, Number(dailyPnl?.total ?? 0))) /
              input.accountBalance) *
            100;
          if (dailyLossPct >= (rules.maxDailyLossPercent as number) * 0.8) {
            if (dailyLossPct >= (rules.maxDailyLossPercent as number)) {
              violations.push({
                rule: "maxDailyLossPercent",
                ruleSet: rsName,
                message: `Daily loss limit reached (${dailyLossPct.toFixed(
                  1
                )}%/${rules.maxDailyLossPercent}%)`,
              });
            } else {
              warnings.push({
                rule: "maxDailyLossPercent",
                ruleSet: rsName,
                message: `Approaching daily loss limit (${dailyLossPct.toFixed(
                  1
                )}%/${rules.maxDailyLossPercent}%)`,
              });
            }
          }
        }
      }

      // Determine decision
      const decision =
        violations.length > 0
          ? "block"
          : warnings.length > 0
          ? "warn"
          : "allow";

      return { decision, violations, warnings };
    }),
});
