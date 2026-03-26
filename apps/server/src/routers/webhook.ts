import { router, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { tradingAccount, openTrade, trade } from "../db/schema/trading";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { notifyEarnedAchievements } from "../lib/achievements";
import { updateTradePostExitPeak } from "../lib/manipulation-calculator";
import { cache, cacheKeys } from "../lib/cache";
import { createNotification } from "../lib/notifications";
import { createAutoTradeReviewEntry } from "../lib/auto-journal";
import {
  generateTradeCloseInsights,
  saveInsights,
  refreshProfileIfStale,
} from "../lib/ai/engine";
import { syncPropAccountState } from "../lib/prop-rule-monitor";
import { accountWebhookProcedures } from "./webhook/account-sync";
import { marketDataWebhookProcedures } from "./webhook/market-data";
import { preTradeWebhookProcedures } from "./webhook/pre-trade";
import { verifyApiKey } from "./webhook/shared";

/**
 * Webhook Router for MT4/MT5 Expert Advisor Integration
 *
 * This router handles incoming price data from user's Expert Advisors
 * running on their MetaTrader terminals.
 */

export const webhookRouter = router({
  ...marketDataWebhookProcedures,
  ...accountWebhookProcedures,

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
              originType: "broker_sync",
              originLabel: "Broker sync",
              originCapturedAt: new Date(),
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
                const symbol =
                  createdReviews[0].symbol ||
                  review.title.match(/\b[A-Z]{3,10}\b/)?.[0] ||
                  "Trade";
                await createNotification({
                  userId,
                  accountId,
                  type: "post_exit_ready",
                  title: `${symbol} trade has just closed`,
                  body: "We've auto-generated an entry in your journal. Make sure to review it.",
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
                title: `${createdReviews.length} trade reviews added`,
                body: "We've auto-generated journal entries for your recently closed trades. Make sure to review them.",
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

  ...preTradeWebhookProcedures,
});
