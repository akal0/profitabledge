import { router, protectedProcedure, publicProcedure } from "../lib/trpc";
import { db } from "../db";
import { aiActionLog, aiChatMessage, aiReport } from "../db/schema/ai";
import {
  goal as goalTable,
  openTrade,
  performanceAlert,
  performanceAlertRule,
  propChallengeRule,
  propDailySnapshot,
  tradingAccount,
  trade,
} from "../db/schema/trading";
import { user as userTable } from "../db/schema/auth";
import { and, desc, eq, gte, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { cache, cacheKeys } from "../lib/cache";
import { createNotification } from "../lib/notifications";
import { equitySnapshot } from "../db/schema/connections";
import { backtestSession, backtestTrade } from "../db/schema/backtest";
import {
  tradeChecklistResult,
  tradeChecklistTemplate,
  traderDigest,
} from "../db/schema/coaching";
import { journalEntry, tradeMedia, tradeNote } from "../db/schema/journal";
import { tradeAnnotation } from "../db/schema/social-redesign";
import { calculateAllAdvancedMetrics } from "../lib/advanced-metrics";
import { createAutoTradeReviewEntry } from "../lib/auto-journal";
import { generateFeedEventForTrade } from "../lib/feed-event-generator";
import {
  generateMorningBriefing,
  generateTradeFeedback,
} from "../lib/ai/engine/digest-generator";
import {
  ALL_ACCOUNTS_ID,
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../lib/account-scope";
import {
  generateInsights as generateBrainInsights,
  saveInsights,
  getFullProfile,
  condenseProfile,
} from "../lib/ai/engine";
import {
  buildAutoPropAccountFields,
  syncAutoPropClassificationForUser,
} from "../lib/prop-firm-detection";

export const accountsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        broker: z.string().min(1),
        brokerType: z.enum(["mt4", "mt5", "ctrader", "ib", "oanda"]).optional(),
        initialBalance: z.number().optional(),
        initialCurrency: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const accountId = crypto.randomUUID();
      const { updates: autoPropFields } = await buildAutoPropAccountFields({
        broker: input.broker,
        brokerServer: null,
        initialBalance: input.initialBalance ?? null,
      });

      const [account] = await db
        .insert(tradingAccount)
        .values({
          id: accountId,
          userId,
          name: input.name,
          broker: input.broker,
          brokerType: input.brokerType || null,
          initialBalance: input.initialBalance?.toString() || null,
          initialCurrency: input.initialCurrency || null,
          ...autoPropFields,
        })
        .returning();

      return account;
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await syncAutoPropClassificationForUser(userId);
    const rows = await db
      .select()
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId))
      .orderBy(desc(tradingAccount.createdAt));
    return rows;
  }),
  metrics: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const accountId = input.accountId;

      const result = await db
        .select({
          wins: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN 1 END)`,
          losses: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN 1 END)`,
          breakeven: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) = 0 THEN 1 END)`,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId));

      const winsCount = result[0]?.wins ?? 0;
      const lossesCount = result[0]?.losses ?? 0;
      const breakevenCount = result[0]?.breakeven ?? 0;
      const total = winsCount + lossesCount + breakevenCount;
      const winrate = total > 0 ? (winsCount / total) * 100 : 0;
      return {
        wins: winsCount,
        losses: lossesCount,
        breakeven: breakevenCount,
        total,
        winrate,
      };
    }),
  stats: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      try {
        const accountIds = await resolveScopedAccountIds(
          ctx.session.user.id,
          input.accountId
        );

        if (accountIds.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Account not found",
          });
        }

        const tradeScope = buildAccountScopeCondition(
          trade.accountId,
          accountIds
        );
        const accountScope =
          accountIds.length === 1
            ? eq(tradingAccount.id, accountIds[0])
            : inArray(tradingAccount.id, accountIds);

        // Single aggregation query for all core stats (replaces 6 separate queries)
        const [agg, recentRows, acctRows] = await Promise.all([
          db
            .select({
              totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
              grossProfit: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
              grossLoss: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
              wins: sql<number>`COUNT(CASE WHEN ${trade.outcome} IN ('Win', 'PW') OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) > 0) THEN 1 END)`,
              losses: sql<number>`COUNT(CASE WHEN ${trade.outcome} = 'Loss' OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) < 0) THEN 1 END)`,
              breakeven: sql<number>`COUNT(CASE WHEN ${trade.outcome} = 'BE' OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) = 0) THEN 1 END)`,
              avgLossMagnitude: sql<number>`COALESCE(AVG(ABS(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) END)), 0)`,
              holdSumSec: sql<number>`COALESCE(SUM(CAST(NULLIF(${trade.tradeDurationSeconds}, '') AS NUMERIC)), 0)`,
              holdCountSec: sql<number>`COALESCE(COUNT(NULLIF(${trade.tradeDurationSeconds}, '')), 0)`,
            })
            .from(trade)
            .where(tradeScope),
          db
            .select({
              profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
              outcome: trade.outcome,
              closeRaw: sql<string | null>`${trade.close}`,
              closeTime: trade.closeTime,
              createdAt: trade.createdAt,
            })
            .from(trade)
            .where(tradeScope)
            .orderBy(desc(trade.createdAt))
            .limit(500),
          db
            .select({
              initialBalance: sql<
                string | null
              >`${tradingAccount.initialBalance}`,
              isVerified: tradingAccount.isVerified,
              liveBalance: tradingAccount.liveBalance,
              liveEquity: tradingAccount.liveEquity,
              lastSyncedAt: tradingAccount.lastSyncedAt,
            })
            .from(tradingAccount)
            .where(accountScope),
        ]);

        const totalProfit = agg[0]?.totalProfit ?? 0;
        const grossProfit = agg[0]?.grossProfit ?? 0;
        const grossLoss = Math.abs(agg[0]?.grossLoss ?? 0);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
        const winsCount = agg[0]?.wins ?? 0;
        const lossesCount = agg[0]?.losses ?? 0;
        const breakevenCount = agg[0]?.breakeven ?? 0;
        const totalTrades = winsCount + lossesCount + breakevenCount;
        const winrate = totalTrades > 0 ? (winsCount / totalTrades) * 100 : 0;

        const avgWin = winsCount > 0 ? grossProfit / winsCount : 0;
        const avgLossVal = lossesCount > 0 ? grossLoss / lossesCount : 0;
        const winPct = totalTrades > 0 ? winsCount / totalTrades : 0;
        const lossPct = totalTrades > 0 ? lossesCount / totalTrades : 0;
        const expectancy = winPct * avgWin - lossPct * avgLossVal;

        const holdSumSec = agg[0]?.holdSumSec ?? 0;
        const holdCountSec = agg[0]?.holdCountSec ?? 0;
        const averageHoldSeconds =
          holdCountSec > 0 ? holdSumSec / holdCountSec : 0;

        // Get trade close time: prefer closeTime (EA-synced), fallback to close (CSV), then createdAt
        const getCloseTime = (row: {
          closeTime: Date | null;
          closeRaw: string | null;
          createdAt: Date;
        }): number => {
          if (row.closeTime) return row.closeTime.getTime();
          if (row.closeRaw) {
            const cleaned = row.closeRaw
              .replace(/[^0-9\-: T]/g, "")
              .replace("T", " ")
              .trim();
            const d = new Date(cleaned);
            if (!isNaN(d.getTime())) return d.getTime();
          }
          return row.createdAt.getTime();
        };

        const recentSorted = recentRows
          .map((r) => ({ ...r, ts: getCloseTime(r) }))
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 100);

        const getOutcomeMark = (row: {
          outcome: "Win" | "Loss" | "BE" | "PW" | null;
          profit: number;
        }): "W" | "L" | "B" => {
          if (row.outcome === "Win" || row.outcome === "PW") return "W";
          if (row.outcome === "Loss") return "L";
          if (row.outcome === "BE") return "B";
          if (row.profit > 0) return "W";
          if (row.profit < 0) return "L";
          return "B";
        };

        const recentOutcomes = recentSorted
          .map(getOutcomeMark)
          .filter((outcome): outcome is "W" | "L" => outcome !== "B")
          .slice(0, 5);

        let streak = 0;
        for (const r of recentSorted) {
          if (getOutcomeMark(r) === "W") streak += 1;
          else break;
        }
        const winStreak = streak;

        // Approximate average R multiple using pre-computed avgLossMagnitude
        let averageRMultiple: number | null = null;
        if (lossesCount > 0) {
          const avgLossMag = Math.max(
            1e-9,
            Number(agg[0]?.avgLossMagnitude || 0)
          );
          const expectancyPerTrade =
            totalTrades > 0 ? totalProfit / totalTrades : 0;
          averageRMultiple = expectancyPerTrade / avgLossMag;
        }

        const initialBalanceNum = acctRows.reduce((sum, row) => {
          return (
            sum + (row.initialBalance != null ? Number(row.initialBalance) : 0)
          );
        }, 0);

        const freshestSyncedAt = acctRows.reduce<Date | null>((latest, row) => {
          if (!row.lastSyncedAt) return latest;
          if (!latest || row.lastSyncedAt.getTime() > latest.getTime()) {
            return row.lastSyncedAt;
          }
          return latest;
        }, null);

        const freshAccounts = acctRows.filter((row) => {
          return (
            row.isVerified === 1 &&
            row.lastSyncedAt &&
            Date.now() - row.lastSyncedAt.getTime() < 5 * 60 * 1000 &&
            row.liveBalance != null
          );
        });
        const hasFullFreshLiveCoverage =
          acctRows.length > 0 && freshAccounts.length === acctRows.length;
        const liveBalance = hasFullFreshLiveCoverage
          ? freshAccounts.reduce(
              (sum, row) => sum + Number(row.liveBalance || 0),
              0
            )
          : null;
        const liveEquity = hasFullFreshLiveCoverage
          ? freshAccounts.reduce(
              (sum, row) =>
                sum + Number(row.liveEquity || row.liveBalance || 0),
              0
            )
          : null;
        const accountBalance =
          hasFullFreshLiveCoverage && liveBalance != null
            ? liveBalance
            : initialBalanceNum + totalProfit;
        const isVerified = acctRows.some((row) => row.isVerified === 1);
        const isLiveDataFresh = hasFullFreshLiveCoverage;

        return {
          totalProfit,
          profitFactor,
          grossProfit,
          grossLoss,
          wins: winsCount,
          losses: lossesCount,
          breakeven: breakevenCount,
          winrate,
          winStreak,
          recentOutcomes,
          averageRMultiple,
          averageHoldSeconds,
          initialBalance: initialBalanceNum,
          accountBalance,
          expectancy,
          // Live metrics (only present for EA-synced accounts)
          isVerified,
          liveBalance,
          liveEquity,
          lastSyncedAt: freshestSyncedAt?.toISOString() || null,
          isLiveDataFresh,
          accountScope: isAllAccountsScope(input.accountId)
            ? ALL_ACCOUNTS_ID
            : input.accountId,
        };
      } catch (e) {
        console.error("[accounts.stats] error:", e);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute stats",
        });
      }
    }),

  recentByDay: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        days: z.number().min(1).max(31).optional(),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const accountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (accountIds.length === 0) return [] as const;
      const maxWindowDays = input.days ?? 42; // Allow up to 6 weeks for full month view

      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          openRaw: sql<string | null>`${trade.open}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, accountIds))
        .orderBy(desc(trade.createdAt))
        .limit(2000);

      // Extract Y-M-D: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const extractYmd = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): string => {
        if (row.openTime) {
          return row.openTime.toISOString().slice(0, 10);
        }
        if (row.openRaw) {
          const m = String(row.openRaw).match(
            /(\d{4})[-\/](\d{2})[-\/](\d{2})/
          );
          if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        }
        return new Date(row.createdAt.getTime()).toISOString().slice(0, 10);
      };

      // Derive day keys (Y-M-D) directly from raw open timestamps to avoid timezone drift
      const tradeDays = rows.map((r) => ({
        ymd: extractYmd(r),
        profit: Number(r.profit || 0),
      }));

      if (tradeDays.length === 0) return [] as const;

      // Determine range (Y-M-D inclusive)
      const ymdCompare = (a: string, b: string) => a.localeCompare(b);
      let minYmd = tradeDays.reduce(
        (m, r) => (ymdCompare(r.ymd, m) < 0 ? r.ymd : m),
        tradeDays[0].ymd
      );
      let maxYmd = tradeDays.reduce(
        (m, r) => (ymdCompare(r.ymd, m) > 0 ? r.ymd : m),
        tradeDays[0].ymd
      );
      let startYmd: string;
      let endYmd: string;
      if (input.startISO && input.endISO) {
        startYmd = String(input.startISO).slice(0, 10);
        endYmd = String(input.endISO).slice(0, 10);
      } else {
        endYmd = maxYmd;
        // compute start as last N-1 days before end
        const endD = new Date(`${endYmd}T00:00:00Z`);
        const startD = new Date(endD.getTime());
        const window = Math.min(input.days ?? maxWindowDays, maxWindowDays);
        startD.setUTCDate(endD.getUTCDate() - (window - 1));
        startYmd = startD.toISOString().slice(0, 10);
      }
      // Clamp to data bounds
      if (ymdCompare(startYmd, minYmd) < 0) startYmd = minYmd;
      if (ymdCompare(endYmd, maxYmd) > 0) endYmd = maxYmd;

      // Build continuous day keys from start..end
      const buckets: string[] = [];
      {
        const startD = new Date(`${startYmd}T00:00:00Z`);
        const endD = new Date(`${endYmd}T00:00:00Z`);
        for (
          let d = new Date(startD.getTime());
          d.getTime() <= endD.getTime();
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          buckets.push(d.toISOString().slice(0, 10));
        }
      }

      // Aggregate by day key
      const dayMap = new Map<string, { totalProfit: number; count: number }>();
      for (const t of tradeDays) {
        if (ymdCompare(t.ymd, startYmd) < 0 || ymdCompare(t.ymd, endYmd) > 0)
          continue;
        const prev = dayMap.get(t.ymd) || { totalProfit: 0, count: 0 };
        dayMap.set(t.ymd, {
          totalProfit: prev.totalProfit + t.profit,
          count: prev.count + 1,
        });
      }

      const byDay = buckets.map((ymd) => ({
        dateISO: ymd,
        totalProfit: dayMap.get(ymd)?.totalProfit || 0,
        count: dayMap.get(ymd)?.count || 0,
      }));

      const totalAbs = byDay.reduce(
        (acc, d) => acc + Math.abs(d.totalProfit),
        0
      );
      const withPct = byDay.map((d) => ({
        ...d,
        percent: totalAbs > 0 ? (d.totalProfit / totalAbs) * 100 : 0,
        dayNumber: Number(d.dateISO.slice(8, 10)),
      }));

      return withPct;
    }),

  rangeSummary: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().min(1),
        endISO: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const startYmd = String(input.startISO).slice(0, 10);
      const endYmd = String(input.endISO).slice(0, 10);
      const maxRows = 5000;

      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          openRaw: sql<string | null>`${trade.open}`,
          closeRaw: sql<string | null>`${trade.close}`,
          openTime: trade.openTime,
          closeTime: trade.closeTime,
          tradeDurationSeconds: trade.tradeDurationSeconds,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt))
        .limit(maxRows);

      if (!rows.length) {
        return {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          largestTrade: null,
          largestLoss: null,
        } as const;
      }

      const parseTimestamp = (raw: string | null): Date | null => {
        if (!raw) return null;
        const direct = new Date(raw);
        if (!isNaN(direct.getTime())) return direct;
        const cleaned = String(raw)
          .trim()
          .replace(/[./]/g, "-")
          .replace(/[^0-9\-: T]/g, "")
          .replace("T", " ")
          .trim();
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d;
        const m = String(raw).match(/(\d{4})[-\/.](\d{2})[-\/.](\d{2})/);
        if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
        return null;
      };

      const extractYmd = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): string => {
        if (row.openTime) {
          return row.openTime.toISOString().slice(0, 10);
        }
        if (row.openRaw) {
          const m = String(row.openRaw).match(
            /(\d{4})[-\/.](\d{2})[-\/.](\d{2})/
          );
          if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        }
        return new Date(row.createdAt.getTime()).toISOString().slice(0, 10);
      };

      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): Date => {
        return row.openTime || parseTimestamp(row.openRaw) || row.createdAt;
      };

      const getCloseTime = (row: {
        closeTime: Date | null;
        closeRaw: string | null;
        createdAt: Date;
      }): Date | null => {
        return row.closeTime || parseTimestamp(row.closeRaw) || null;
      };

      let totalTrades = 0;
      let wins = 0;
      let losses = 0;
      let largestTrade: number | null = null;
      let largestLoss: number | null = null;
      let holdSumSeconds = 0;
      let holdCount = 0;

      for (const row of rows) {
        const ymd = extractYmd(row);
        if (ymd < startYmd || ymd > endYmd) continue;
        const profit = Number(row.profit || 0);
        totalTrades += 1;
        if (profit > 0) wins += 1;
        if (profit < 0) losses += 1;
        if (profit > 0 && (largestTrade == null || profit > largestTrade)) {
          largestTrade = profit;
        }
        if (profit < 0 && (largestLoss == null || profit < largestLoss)) {
          largestLoss = profit;
        }

        const durationRaw = row.tradeDurationSeconds;
        let holdSeconds = durationRaw ? Number(durationRaw) : NaN;
        const hasDuration = Number.isFinite(holdSeconds) && holdSeconds > 0;
        if (!hasDuration) {
          const close = getCloseTime(row);
          if (!close) continue;
          const open = getOpenTime(row);
          if (!open) continue;
          const diff = Math.floor((close.getTime() - open.getTime()) / 1000);
          holdSeconds = diff > 0 ? diff : NaN;
        }
        if (Number.isFinite(holdSeconds) && holdSeconds > 0) {
          holdSumSeconds += holdSeconds;
          holdCount += 1;
        }
      }

      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const avgHoldSeconds = holdCount > 0 ? holdSumSeconds / holdCount : null;

      return {
        totalTrades,
        wins,
        losses,
        winRate,
        largestTrade,
        largestLoss,
        avgHoldSeconds,
      } as const;
    }),

  // Aggregate profit by asset (symbol) within a selected date range
  profitByAssetRange: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const accountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (accountIds.length === 0) return [] as const;
      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          symbol: trade.symbol,
          openRaw: sql<string | null>`${trade.open}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, accountIds))
        .orderBy(desc(trade.createdAt));

      // Get trade open time: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): number => {
        // EA-synced trades have openTime set
        if (row.openTime) return row.openTime.getTime();
        // Legacy CSV trades have open as text
        if (row.openRaw) {
          const cleaned = row.openRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d.getTime();
        }
        // Fallback to createdAt
        return row.createdAt.getTime();
      };

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (input.startISO && input.endISO) {
        startDate = new Date(input.startISO);
        endDate = new Date(input.endISO);
      }

      // Normalize to inclusive day bounds if provided
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      const bySymbol = new Map<string, number>();
      for (const r of rows) {
        const ts = getOpenTime(r);
        if (startDate && endDate) {
          if (ts < startDate.getTime() || ts > endDate.getTime()) continue;
        }
        const key = (r.symbol || "(Unknown)").trim();
        bySymbol.set(key, (bySymbol.get(key) ?? 0) + Number(r.profit || 0));
      }

      const result = Array.from(bySymbol.entries()).map(([symbol, total]) => ({
        symbol,
        totalProfit: total,
      }));

      // Sort by absolute profit desc for clearer ranking
      result.sort((a, b) => Math.abs(b.totalProfit) - Math.abs(a.totalProfit));
      return result;
    }),

  // Aggregate losses by asset (profit losses, commissions, swaps) within an optional date range
  lossesByAssetRange: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const accountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (accountIds.length === 0) return [] as const;
      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          commissions: sql<number>`CAST(${trade.commissions} AS NUMERIC)`,
          swap: sql<number>`CAST(${trade.swap} AS NUMERIC)`,
          symbol: trade.symbol,
          openRaw: sql<string | null>`${trade.open}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, accountIds))
        .orderBy(desc(trade.createdAt));

      // Get trade open time: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): number => {
        if (row.openTime) return row.openTime.getTime();
        if (row.openRaw) {
          const cleaned = row.openRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d.getTime();
        }
        return row.createdAt.getTime();
      };

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (input.startISO && input.endISO) {
        startDate = new Date(input.startISO);
        endDate = new Date(input.endISO);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const bySymbol = new Map<
        string,
        { profitLoss: number; commissionsLoss: number; swapLoss: number }
      >();
      for (const r of rows) {
        const ts = getOpenTime(r);
        if (startDate && endDate) {
          if (ts < startDate.getTime() || ts > endDate.getTime()) continue;
        }
        const key = (r.symbol || "(Unknown)").trim();
        const profitLoss =
          Number(r.profit || 0) < 0 ? Math.abs(Number(r.profit || 0)) : 0;
        const commissionsLoss =
          Number(r.commissions || 0) < 0
            ? Math.abs(Number(r.commissions || 0))
            : 0;
        const swapLoss =
          Number(r.swap || 0) < 0 ? Math.abs(Number(r.swap || 0)) : 0;
        if (!bySymbol.has(key))
          bySymbol.set(key, { profitLoss: 0, commissionsLoss: 0, swapLoss: 0 });
        const agg = bySymbol.get(key)!;
        agg.profitLoss += profitLoss;
        agg.commissionsLoss += commissionsLoss;
        agg.swapLoss += swapLoss;
      }

      const result = Array.from(bySymbol.entries())
        .map(([symbol, v]) => ({
          symbol,
          profitLoss: v.profitLoss,
          commissionsLoss: v.commissionsLoss,
          swapLoss: v.swapLoss,
          totalLoss: v.profitLoss + v.commissionsLoss + v.swapLoss,
        }))
        .filter((r) => r.totalLoss > 0)
        .sort((a, b) => b.totalLoss - a.totalLoss);

      return result;
    }),

  // Daily profit over the entire account history (or a provided range)
  profitByDayOverall: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          openRaw: sql<string | null>`${trade.open}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId));

      // Get trade open time: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): Date => {
        if (row.openTime) return row.openTime;
        if (row.openRaw) {
          const cleaned = row.openRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        }
        return row.createdAt;
      };

      if (!rows.length)
        return {
          byDay: [] as {
            dateISO: string;
            totalProfit: number;
            count: number;
          }[],
        } as const;

      const dates = rows.map((r) => getOpenTime(r));
      let minDate = dates.reduce(
        (m, d) => (d.getTime() < m.getTime() ? d : m),
        dates[0]
      );
      let maxDate = dates.reduce(
        (m, d) => (d.getTime() > m.getTime() ? d : m),
        dates[0]
      );

      // Clamp to provided range if given
      if (input.startISO) {
        const s = new Date(input.startISO);
        if (!isNaN(s.getTime())) minDate = s;
      }
      if (input.endISO) {
        const e = new Date(input.endISO);
        if (!isNaN(e.getTime())) maxDate = e;
      }
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);

      const toISODate = (d: Date) =>
        new Date(d.getTime()).toISOString().slice(0, 10);
      const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };

      // Seed continuous day buckets
      const sumMap = new Map<string, number>();
      const countMap = new Map<string, number>();
      {
        const cursor = new Date(minDate);
        while (cursor.getTime() <= maxDate.getTime()) {
          const key = toISODate(cursor);
          sumMap.set(key, 0);
          countMap.set(key, 0);
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const d = getOpenTime(rows[i]);
        if (d.getTime() < minDate.getTime() || d.getTime() > maxDate.getTime())
          continue;
        const key = toISODate(startOfDay(d));
        sumMap.set(key, (sumMap.get(key) ?? 0) + Number(rows[i].profit || 0));
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
      }

      const byDay = Array.from(sumMap.entries()).map(
        ([dateISO, totalProfit]) => ({
          dateISO,
          totalProfit,
          count: countMap.get(dateISO) ?? 0,
        })
      );
      byDay.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

      return { byDay } as const;
    }),

  // Trade counts by day/week/month within a selected range
  tradeCountsRange: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().min(1),
        endISO: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const startDate = new Date(input.startISO);
      const endDate = new Date(input.endISO);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt));

      // Get trade open time: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): Date => {
        if (row.openTime) return row.openTime;
        if (row.openRaw) {
          const cleaned = row.openRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        }
        return row.createdAt;
      };

      // Helpers
      const toISODate = (d: Date) =>
        new Date(d.getTime()).toISOString().slice(0, 10);
      const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const startOfWeekMon = (d: Date) => {
        const x = startOfDay(d);
        const day = x.getDay(); // 0 Sun .. 6 Sat
        const diff = day === 0 ? -6 : 1 - day; // move to Monday
        x.setDate(x.getDate() + diff);
        return x;
      };
      const startOfMonth = (d: Date) => {
        const x = startOfDay(d);
        x.setDate(1);
        return x;
      };

      const dayMap = new Map<string, number>();
      const weekMap = new Map<string, number>();
      const monthMap = new Map<string, number>();

      for (const r of rows) {
        const d = getOpenTime(r);
        if (
          d.getTime() < startDate.getTime() ||
          d.getTime() > endDate.getTime()
        )
          continue;
        const dayKey = toISODate(d);
        const weekKey = toISODate(startOfWeekMon(d));
        const monthKey = toISODate(startOfMonth(d)).slice(0, 7); // YYYY-MM
        dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
        weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
        monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
      }

      const byDay = Array.from(dayMap.entries())
        .map(([dateISO, count]) => ({ dateISO, count }))
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      const byWeek = Array.from(weekMap.entries())
        .map(([startISO, count]) => ({ startISO, count }))
        .sort((a, b) => a.startISO.localeCompare(b.startISO));
      const byMonth = Array.from(monthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return { byDay, byWeek, byMonth } as const;
    }),

  // Trade counts over the entire account history (overall), with continuous buckets
  tradeCountsOverall: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt));

      // Get trade open time: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): Date => {
        if (row.openTime) return row.openTime;
        if (row.openRaw) {
          const cleaned = row.openRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        }
        return row.createdAt;
      };

      if (!rows.length) return { byDay: [], byWeek: [], byMonth: [] } as const;

      const dates = rows.map((r) => getOpenTime(r));
      let minDate = dates.reduce(
        (m, d) => (d.getTime() < m.getTime() ? d : m),
        dates[0]
      );
      let maxDate = dates.reduce(
        (m, d) => (d.getTime() > m.getTime() ? d : m),
        dates[0]
      );
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);

      const toISODate = (d: Date) =>
        new Date(d.getTime()).toISOString().slice(0, 10);
      const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const startOfWeekMon = (d: Date) => {
        const x = startOfDay(d);
        const day = x.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        x.setDate(x.getDate() + diff);
        return x;
      };
      const startOfMonth = (d: Date) => {
        const x = startOfDay(d);
        x.setDate(1);
        return x;
      };

      // Seed continuous day buckets
      const byDayMap = new Map<string, number>();
      {
        const cursor = new Date(minDate);
        while (cursor.getTime() <= maxDate.getTime()) {
          byDayMap.set(toISODate(cursor), 0);
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      // Count trades per day
      for (const d of dates) {
        const key = toISODate(d);
        byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
      }

      // Build continuous week buckets (Monday-start) from min..max
      const byWeekMap = new Map<string, number>();
      {
        const firstWeekStart = startOfWeekMon(minDate);
        const lastWeekStart = startOfWeekMon(maxDate);
        const cursor = new Date(firstWeekStart);
        while (cursor.getTime() <= lastWeekStart.getTime()) {
          byWeekMap.set(toISODate(cursor), 0);
          cursor.setDate(cursor.getDate() + 7);
        }
        // Tally days into weeks
        for (const [dayISO, cnt] of byDayMap.entries()) {
          const d = new Date(dayISO);
          const wk = toISODate(startOfWeekMon(d));
          byWeekMap.set(wk, (byWeekMap.get(wk) ?? 0) + (cnt || 0));
        }
      }

      // Build continuous month buckets from min..max
      const byMonthMap = new Map<string, number>();
      {
        const firstMonth = startOfMonth(minDate);
        const lastMonth = startOfMonth(maxDate);
        const cursor = new Date(firstMonth);
        while (cursor.getTime() <= lastMonth.getTime()) {
          const key = toISODate(cursor).slice(0, 7);
          byMonthMap.set(key, 0);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        for (const [dayISO, cnt] of byDayMap.entries()) {
          const d = new Date(dayISO);
          const key = toISODate(startOfMonth(d)).slice(0, 7);
          byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + (cnt || 0));
        }
      }

      const byDay = Array.from(byDayMap.entries()).map(([dateISO, count]) => ({
        dateISO,
        count,
      }));
      const byWeek = Array.from(byWeekMap.entries()).map(
        ([startISO, count]) => ({ startISO, count })
      );
      const byMonth = Array.from(byMonthMap.entries()).map(
        ([month, count]) => ({ month, count })
      );

      return { byDay, byWeek, byMonth } as const;
    }),

  opensBounds: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const accountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (accountIds.length === 0) {
        const now = new Date().toISOString();
        return { minISO: now, maxISO: now } as const;
      }
      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          closeRaw: sql<string | null>`${trade.close}`,
          openTime: trade.openTime, // Use proper timestamp field for EA-synced trades
          closeTime: trade.closeTime, // Use proper timestamp field for EA-synced trades
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, accountIds));

      // Get trade open time: prefer openTime (EA-synced), fallback to open (CSV), then createdAt
      const getOpenTime = (row: {
        openTime: Date | null;
        openRaw: string | null;
        createdAt: Date;
      }): number => {
        if (row.openTime) return row.openTime.getTime();
        if (row.openRaw) {
          const cleaned = row.openRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d.getTime();
        }
        return row.createdAt.getTime();
      };

      // Get trade close time: prefer closeTime (EA-synced), fallback to close (CSV), then createdAt
      const getCloseTime = (row: {
        closeTime: Date | null;
        closeRaw: string | null;
        createdAt: Date;
      }): number => {
        if (row.closeTime) return row.closeTime.getTime();
        if (row.closeRaw) {
          const cleaned = row.closeRaw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d.getTime();
        }
        return row.createdAt.getTime();
      };

      const opens = rows.map((r) => getOpenTime(r));
      const closes = rows.map((r) => getCloseTime(r));
      const minTs = opens.reduce(
        (min, ts) => (min === 0 || ts < min ? ts : min),
        0
      );
      const maxTs = closes.reduce((max, ts) => (ts > max ? ts : max), 0);
      return {
        minISO: new Date(minTs || Date.now()).toISOString(),
        maxISO: new Date(maxTs || Date.now()).toISOString(),
      } as const;
    }),

  /**
   * Update broker settings for an account
   */
  updateBrokerSettings: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        brokerType: z.enum(["mt4", "mt5", "ctrader", "other"]).optional(),
        preferredDataSource: z
          .enum(["dukascopy", "alphavantage", "truefx", "broker"])
          .optional(),
        averageSpreadPips: z.number().min(0).max(100).optional(),
        initialBalance: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.accountId))
        .limit(1);

      if (!account.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (account[0].userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this account",
        });
      }

      // Update account settings
      const updates: any = {};
      if (input.brokerType !== undefined) updates.brokerType = input.brokerType;
      if (input.preferredDataSource !== undefined)
        updates.preferredDataSource = input.preferredDataSource;
      if (input.averageSpreadPips !== undefined)
        updates.averageSpreadPips = input.averageSpreadPips.toString();
      if (input.initialBalance !== undefined)
        updates.initialBalance = input.initialBalance.toString();

      if (Object.keys(updates).length > 0) {
        await db
          .update(tradingAccount)
          .set(updates)
          .where(eq(tradingAccount.id, input.accountId));

        await createNotification({
          userId: ctx.session.user.id,
          accountId: input.accountId,
          type: "settings_updated",
          title: "Broker settings updated",
          body: `Updated broker settings for account ${input.accountId}.`,
          metadata: {
            accountId: input.accountId,
            updatedFields: Object.keys(updates),
          },
        });
      }

      return { success: true };
    }),

  /**
   * Get live account metrics from EA
   * Returns live balance, equity, margin, open trades, and sync status
   */
  liveMetrics: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const accountId = input.accountId;

      // Check cache first (5 second TTL for live data)
      const cacheKey = cacheKeys.liveMetrics(accountId);
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        // Import openTrade table
        const { openTrade } = await import("../db/schema/trading");
        const accountIds = await resolveScopedAccountIds(
          ctx.session.user.id,
          accountId
        );

        if (accountIds.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        const accountScope =
          accountIds.length === 1
            ? eq(tradingAccount.id, accountIds[0])
            : inArray(tradingAccount.id, accountIds);

        // Fetch account with live metrics
        const accounts = await db
          .select({
            id: tradingAccount.id,
            userId: tradingAccount.userId,
            name: tradingAccount.name,
            broker: tradingAccount.broker,
            brokerType: tradingAccount.brokerType,
            isVerified: tradingAccount.isVerified,
            liveBalance: tradingAccount.liveBalance,
            liveEquity: tradingAccount.liveEquity,
            liveMargin: tradingAccount.liveMargin,
            liveFreeMargin: tradingAccount.liveFreeMargin,
            lastSyncedAt: tradingAccount.lastSyncedAt,
            initialBalance: tradingAccount.initialBalance,
          })
          .from(tradingAccount)
          .where(accountScope);

        if (!accounts.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        // Fetch open trades for this account
        const openTrades = await db
          .select()
          .from(openTrade)
          .where(buildAccountScopeCondition(openTrade.accountId, accountIds))
          .orderBy(desc(openTrade.openTime));

        // Calculate total floating P&L from open trades
        const totalFloatingPL = openTrades.reduce((sum, trade) => {
          return sum + Number(trade.profit || 0);
        }, 0);

        // Parse numeric fields
        const freshAccounts = accounts.filter((account) => {
          return (
            account.isVerified === 1 &&
            account.lastSyncedAt &&
            Date.now() - account.lastSyncedAt.getTime() < 5 * 60 * 1000
          );
        });

        const hasFullFreshCoverage =
          accounts.length > 0 && freshAccounts.length === accounts.length;

        const liveBalance = hasFullFreshCoverage
          ? freshAccounts.reduce(
              (sum, account) => sum + Number(account.liveBalance || 0),
              0
            )
          : null;
        const liveEquity = hasFullFreshCoverage
          ? freshAccounts.reduce(
              (sum, account) =>
                sum + Number(account.liveEquity || account.liveBalance || 0),
              0
            )
          : null;
        const liveMargin = hasFullFreshCoverage
          ? freshAccounts.reduce(
              (sum, account) => sum + Number(account.liveMargin || 0),
              0
            )
          : null;
        const liveFreeMargin = hasFullFreshCoverage
          ? freshAccounts.reduce(
              (sum, account) => sum + Number(account.liveFreeMargin || 0),
              0
            )
          : null;
        const initialBalance = accounts.reduce(
          (sum, account) => sum + Number(account.initialBalance || 0),
          0
        );

        // Map open trades to frontend format
        const trades = openTrades.map((trade) => ({
          id: trade.id,
          ticket: trade.ticket,
          symbol: trade.symbol,
          tradeType: trade.tradeType as "long" | "short",
          volume: Number(trade.volume),
          openPrice: Number(trade.openPrice),
          openTime: trade.openTime.toISOString(),
          sl: trade.sl ? Number(trade.sl) : null,
          tp: trade.tp ? Number(trade.tp) : null,
          currentPrice: trade.currentPrice ? Number(trade.currentPrice) : null,
          swap: Number(trade.swap || 0),
          commission: Number(trade.commission || 0),
          profit: Number(trade.profit || 0),
          sessionTag: trade.sessionTag ?? null,
          sessionTagColor: trade.sessionTagColor ?? null,
          slModCount: trade.slModCount ?? null,
          tpModCount: trade.tpModCount ?? null,
          partialCloseCount: trade.partialCloseCount ?? null,
          exitDealCount: trade.exitDealCount ?? null,
          exitVolume: trade.exitVolume ? Number(trade.exitVolume) : null,
          entryDealCount: trade.entryDealCount ?? null,
          entryVolume: trade.entryVolume ? Number(trade.entryVolume) : null,
          scaleInCount: trade.scaleInCount ?? null,
          scaleOutCount: trade.scaleOutCount ?? null,
          trailingStopDetected: trade.trailingStopDetected ?? null,
          comment: trade.comment,
          magicNumber: trade.magicNumber,
          lastUpdatedAt: trade.lastUpdatedAt.toISOString(),
          accountId: trade.accountId,
          accountName:
            accounts.find((account) => account.id === trade.accountId)?.name ??
            null,
        }));

        const latestSync = accounts.reduce<Date | null>((latest, account) => {
          if (!account.lastSyncedAt) return latest;
          if (!latest || account.lastSyncedAt.getTime() > latest.getTime()) {
            return account.lastSyncedAt;
          }
          return latest;
        }, null);

        const result = {
          accountId,
          accountName: isAllAccountsScope(accountId)
            ? "All Accounts"
            : accounts[0]?.name,
          broker:
            accounts.length === 1 ? accounts[0]?.broker : "Multiple brokers",
          brokerType: accounts.length === 1 ? accounts[0]?.brokerType : null,
          isVerified: accounts.some((account) => account.isVerified === 1),
          liveBalance,
          liveEquity,
          liveMargin,
          liveFreeMargin,
          initialBalance,
          lastSyncedAt: latestSync?.toISOString() || null,
          openTrades: trades,
          totalFloatingPL,
          openTradesCount: trades.length,
        };

        // Cache result for 5 seconds (live data should be fresh but not hammer DB)
        cache.set(cacheKey, result, 5000);

        return result;
      } catch (error) {
        console.error("[liveMetrics] ERROR:", error);
        throw error;
      }
    }),

  // AI Insights
  insights: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const accountIds = await resolveScopedAccountIds(userId, input.accountId);
      if (accountIds.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      const insights = await generateBrainInsights(
        input.accountId,
        userId,
        "manual"
      );
      if (insights.length > 0 && !isAllAccountsScope(input.accountId)) {
        await saveInsights(input.accountId, userId, insights, "manual");
      }
      return insights.map((i) => ({
        type: i.category,
        title: i.title,
        message: i.message,
        severity: i.severity,
        data: i.data,
      }));
    }),

  randomInsight: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const accountIds = await resolveScopedAccountIds(userId, input.accountId);
      if (accountIds.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      // Use the new profile-based insights
      const fullProfile = await getFullProfile(input.accountId, userId);
      if (!fullProfile) {
        return {
          type: "info" as const,
          title: "Getting Started",
          message:
            "Keep trading to build your profile. We need at least 15 closed trades to generate personalized insights.",
          severity: "info" as const,
        };
      }

      const condensed = condenseProfile(
        fullProfile.profile,
        fullProfile.edges,
        fullProfile.leaks
      );

      // Return a profile-based random insight
      const possibleInsights = [];

      if (condensed.topEdges.length > 0) {
        possibleInsights.push({
          type: "positive" as const,
          title: "Your Best Edge",
          message: `Your strongest pattern: ${condensed.topEdges[0]}. Focus on setups matching this pattern.`,
          severity: "positive" as const,
        });
      }

      if (condensed.topLeaks.length > 0) {
        possibleInsights.push({
          type: "warning" as const,
          title: "Leak to Address",
          message: `Watch out for: ${condensed.topLeaks[0]}. This pattern is costing you money.`,
          severity: "warning" as const,
        });
      }

      if (condensed.leavingProfitOnTable) {
        possibleInsights.push({
          type: "efficiency" as const,
          title: "Profit Left on Table",
          message: `You're leaving an average of ${condensed.avgProfitLeftPips.toFixed(
            1
          )} pips on the table. Consider trailing stops or partial closes.`,
          severity: "info" as const,
        });
      }

      possibleInsights.push({
        type: "info" as const,
        title: "Profile Summary",
        message: `${condensed.totalTrades} trades | ${condensed.winRate.toFixed(
          1
        )}% WR | PF ${condensed.profitFactor.toFixed(2)} | ${
          condensed.currentStreak
        }`,
        severity: "info" as const,
      });

      return possibleInsights[
        Math.floor(Math.random() * possibleInsights.length)
      ];
    }),

  // Execution quality stats for Execution Scorecard widget
  executionStats: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const accountIds = await resolveScopedAccountIds(userId, input.accountId);

      if (accountIds.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      // Aggregate execution metrics
      const result = await db
        .select({
          avgEntrySpread: sql<
            number | null
          >`AVG(CAST(${trade.entrySpreadPips} AS NUMERIC))`,
          avgExitSpread: sql<
            number | null
          >`AVG(CAST(${trade.exitSpreadPips} AS NUMERIC))`,
          avgEntrySlippage: sql<
            number | null
          >`AVG(CAST(${trade.entrySlippagePips} AS NUMERIC))`,
          avgExitSlippage: sql<
            number | null
          >`AVG(CAST(${trade.exitSlippagePips} AS NUMERIC))`,
          totalSlModifications: sql<number | null>`SUM(${trade.slModCount})`,
          totalTpModifications: sql<number | null>`SUM(${trade.tpModCount})`,
          totalPartialCloses: sql<
            number | null
          >`SUM(${trade.partialCloseCount})`,
          avgRrCaptureEfficiency: sql<
            number | null
          >`AVG(CAST(${trade.rrCaptureEfficiency} AS NUMERIC))`,
          avgExitEfficiency: sql<
            number | null
          >`AVG(CAST(${trade.exitEfficiency} AS NUMERIC))`,
          tradeCount: sql<number>`COUNT(*)`,
          tradesWithExecutionData: sql<number>`COUNT(${trade.entrySpreadPips})`,
        })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, accountIds));

      const row = result[0];

      // Calculate execution grade (A-F) based on metrics
      let gradeScore = 100;
      const avgSpread =
        ((row?.avgEntrySpread || 0) + (row?.avgExitSpread || 0)) / 2;
      const avgSlippage =
        ((row?.avgEntrySlippage || 0) + (row?.avgExitSlippage || 0)) / 2;

      // Deduct points for high spread/slippage
      if (avgSpread > 2) gradeScore -= 15;
      else if (avgSpread > 1) gradeScore -= 5;

      if (avgSlippage > 1) gradeScore -= 20;
      else if (avgSlippage > 0.5) gradeScore -= 10;

      // Factor in efficiency metrics if available
      if (
        row?.avgRrCaptureEfficiency != null &&
        row.avgRrCaptureEfficiency < 50
      )
        gradeScore -= 10;
      if (row?.avgExitEfficiency != null && row.avgExitEfficiency < 50)
        gradeScore -= 10;

      const grade =
        gradeScore >= 90
          ? "A"
          : gradeScore >= 80
          ? "B"
          : gradeScore >= 70
          ? "C"
          : gradeScore >= 60
          ? "D"
          : "F";

      return {
        avgEntrySpread: row?.avgEntrySpread ?? null,
        avgExitSpread: row?.avgExitSpread ?? null,
        avgEntrySlippage: row?.avgEntrySlippage ?? null,
        avgExitSlippage: row?.avgExitSlippage ?? null,
        totalSlModifications: row?.totalSlModifications ?? 0,
        totalTpModifications: row?.totalTpModifications ?? 0,
        totalPartialCloses: row?.totalPartialCloses ?? 0,
        avgRrCaptureEfficiency: row?.avgRrCaptureEfficiency ?? null,
        avgExitEfficiency: row?.avgExitEfficiency ?? null,
        tradeCount: row?.tradeCount ?? 0,
        tradesWithExecutionData: row?.tradesWithExecutionData ?? 0,
        grade,
        gradeScore,
      };
    }),

  // Money left on table stats using peak price data
  moneyLeftOnTable: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const accountIds = await resolveScopedAccountIds(userId, input.accountId);

      if (accountIds.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      // Get trades with peak data to calculate missed profit
      // For longs: money left = (entryPeakPrice - closePrice) if entryPeakPrice > closePrice
      // For shorts: money left = (closePrice - entryPeakPrice) if closePrice > entryPeakPrice
      const trades = await db
        .select({
          id: trade.id,
          tradeType: trade.tradeType,
          openPrice: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
          closePrice: sql<number | null>`CAST(${trade.closePrice} AS NUMERIC)`,
          entryPeakPrice: sql<
            number | null
          >`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
          postExitPeakPrice: sql<
            number | null
          >`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
          profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
          volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
          symbol: trade.symbol,
          outcome: trade.outcome,
        })
        .from(trade)
        .where(
          and(
            buildAccountScopeCondition(trade.accountId, accountIds),
            sql`${trade.entryPeakPrice} IS NOT NULL OR ${trade.postExitPeakPrice} IS NOT NULL`
          )
        );

      let totalDuringTrade = 0; // Missed during trade (didn't close at peak)
      let totalAfterExit = 0; // Missed after exit (could have stayed in longer)
      let tradesWithPeakData = 0;
      let tradesWithPostExitData = 0;

      for (const t of trades) {
        const isLong = t.tradeType === "long" || t.tradeType === "buy";

        // Money left during trade
        if (t.entryPeakPrice != null && t.closePrice != null) {
          tradesWithPeakData++;
          let missedPips = 0;
          if (isLong) {
            missedPips = Math.max(0, t.entryPeakPrice - t.closePrice);
          } else {
            missedPips = Math.max(0, t.closePrice - t.entryPeakPrice);
          }
          // Convert to approximate USD (simplified - assumes 1 pip = $10 for standard lot)
          // In real implementation, would use proper pip value calculation
          const lotSize = t.volume ?? 1;
          totalDuringTrade += missedPips * lotSize * 10;
        }

        // Money left after exit (post-exit peak vs close)
        if (t.postExitPeakPrice != null && t.closePrice != null) {
          tradesWithPostExitData++;
          let additionalPips = 0;
          if (isLong) {
            additionalPips = Math.max(0, t.postExitPeakPrice - t.closePrice);
          } else {
            additionalPips = Math.max(0, t.closePrice - t.postExitPeakPrice);
          }
          const lotSize = t.volume ?? 1;
          totalAfterExit += additionalPips * lotSize * 10;
        }
      }

      // Get total actual profit for comparison
      const profitResult = await db
        .select({
          totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
        })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, accountIds));

      const totalProfit = profitResult[0]?.totalProfit ?? 0;
      const potentialTotal = totalProfit + totalDuringTrade + totalAfterExit;
      const captureRatio =
        potentialTotal > 0 ? (totalProfit / potentialTotal) * 100 : 100;

      return {
        totalMissedDuringTrade: Math.round(totalDuringTrade * 100) / 100,
        totalMissedAfterExit: Math.round(totalAfterExit * 100) / 100,
        totalMissed:
          Math.round((totalDuringTrade + totalAfterExit) * 100) / 100,
        actualProfit: Math.round(totalProfit * 100) / 100,
        potentialProfit: Math.round(potentialTotal * 100) / 100,
        captureRatio: Math.round(captureRatio * 10) / 10,
        tradesWithPeakData,
        tradesWithPostExitData,
        totalTrades: trades.length,
      };
    }),

  // Multi-account aggregated stats
  aggregatedStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get all accounts for user
    const accounts = await db
      .select({
        id: tradingAccount.id,
        name: tradingAccount.name,
        broker: tradingAccount.broker,
        initialBalance: tradingAccount.initialBalance,
        isVerified: tradingAccount.isVerified,
        liveBalance: tradingAccount.liveBalance,
        liveEquity: tradingAccount.liveEquity,
        lastSyncedAt: tradingAccount.lastSyncedAt,
        isPropAccount: tradingAccount.isPropAccount,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId));

    if (accounts.length === 0) {
      return {
        accounts: [],
        totals: {
          totalBalance: 0,
          totalEquity: 0,
          totalProfit: 0,
          totalTrades: 0,
          totalWins: 0,
          totalLosses: 0,
          overallWinRate: 0,
          overallProfitFactor: null as number | null,
          overallExpectancy: 0,
        },
      };
    }

    const accountIds = accounts.map((a) => a.id);

    // Aggregate stats across all accounts in one query
    const [agg] = await db
      .select({
        totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
        grossProfit: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
        grossLoss: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN ABS(CAST(${trade.profit} AS NUMERIC)) ELSE 0 END), 0)`,
        wins: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN 1 END)`,
        losses: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN 1 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(trade)
      .where(inArray(trade.accountId, accountIds));

    // Per-account stats for comparison table
    const perAccountStats = await db
      .select({
        accountId: trade.accountId,
        totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
        wins: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN 1 END)`,
        losses: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN 1 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(trade)
      .where(inArray(trade.accountId, accountIds))
      .groupBy(trade.accountId);

    const totalProfit = agg?.totalProfit ?? 0;
    const grossProfit = agg?.grossProfit ?? 0;
    const grossLoss = agg?.grossLoss ?? 0;
    const wins = agg?.wins ?? 0;
    const losses = agg?.losses ?? 0;
    const totalTrades = agg?.total ?? 0;

    // Compute totals across accounts
    let totalBalance = 0;
    let totalEquity = 0;
    for (const acct of accounts) {
      const ib = Number(acct.initialBalance || 0);
      const acctStats = perAccountStats.find((s) => s.accountId === acct.id);
      const acctProfit = acctStats?.totalProfit ?? 0;
      const isVerified = acct.isVerified === 1;
      const isFresh =
        isVerified &&
        acct.lastSyncedAt &&
        Date.now() - acct.lastSyncedAt.getTime() < 5 * 60 * 1000;

      if (isFresh && acct.liveBalance) {
        totalBalance += Number(acct.liveBalance);
        totalEquity += Number(acct.liveEquity || acct.liveBalance);
      } else {
        totalBalance += ib + acctProfit;
        totalEquity += ib + acctProfit;
      }
    }

    const accountsWithStats = accounts.map((acct) => {
      const stats = perAccountStats.find((s) => s.accountId === acct.id);
      const ib = Number(acct.initialBalance || 0);
      const profit = stats?.totalProfit ?? 0;
      const w = stats?.wins ?? 0;
      const l = stats?.losses ?? 0;
      const t = stats?.total ?? 0;
      return {
        id: acct.id,
        name: acct.name,
        broker: acct.broker,
        isPropAccount: acct.isPropAccount,
        isVerified: acct.isVerified === 1,
        totalTrades: t,
        wins: w,
        losses: l,
        winRate: t > 0 ? (w / t) * 100 : 0,
        totalProfit: profit,
        balance: ib + profit,
        contribution:
          totalProfit !== 0 ? (profit / Math.abs(totalProfit)) * 100 : 0,
      };
    });

    return {
      accounts: accountsWithStats,
      totals: {
        totalBalance,
        totalEquity,
        totalProfit,
        totalTrades,
        totalWins: wins,
        totalLosses: losses,
        overallWinRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
        overallProfitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
        overallExpectancy: totalTrades > 0 ? totalProfit / totalTrades : 0,
      },
    };
  }),

  /**
   * Account Health Score
   * Composite score (0-100) based on key trading metrics
   */
  healthScore: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const accountIds = await resolveScopedAccountIds(userId, input.accountId);

      if (accountIds.length === 0) {
        return null;
      }

      const accountScope = buildAccountScopeCondition(
        tradingAccount.id,
        accountIds
      );
      const tradeScope = buildAccountScopeCondition(
        trade.accountId,
        accountIds
      );

      const accounts = await db
        .select({
          id: tradingAccount.id,
          liveBalance: tradingAccount.liveBalance,
          initialBalance: tradingAccount.initialBalance,
        })
        .from(tradingAccount)
        .where(accountScope);

      // Get recent trades (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const trades = await db
        .select()
        .from(trade)
        .where(and(tradeScope, gte(trade.openTime, ninetyDaysAgo)))
        .orderBy(trade.openTime);

      if (trades.length < 5) {
        return {
          score: 0,
          factors: {},
          message: "Need at least 5 trades in the last 90 days",
        };
      }

      const pnls = trades.map((t) => parseFloat(t.profit?.toString() || "0"));
      const wins = pnls.filter((p) => p > 0);
      const losses = pnls.filter((p) => p < 0);
      const winRate = (wins.length / trades.length) * 100;
      const grossWin = wins.reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
      const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 5 : 0;
      const rrs = trades
        .map((t) => parseFloat(t.realisedRR?.toString() || "0"))
        .filter((r) => r !== 0);
      const avgRR =
        rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

      // Daily P&L for consistency
      const dailyPnls: Record<string, number> = {};
      for (const t of trades) {
        if (!t.openTime) continue;
        const day = new Date(t.openTime).toISOString().split("T")[0];
        dailyPnls[day] =
          (dailyPnls[day] || 0) + parseFloat(t.profit?.toString() || "0");
      }
      const dpVals = Object.values(dailyPnls);
      const greenDays = dpVals.filter((p) => p > 0).length;
      const greenDayRate =
        dpVals.length > 0 ? (greenDays / dpVals.length) * 100 : 0;

      // Max drawdown approximation
      let peak = 0;
      let maxDD = 0;
      let equity = 0;
      for (const p of pnls) {
        equity += p;
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDD) maxDD = dd;
      }
      const balance =
        accounts.reduce((sum, account) => {
          const value =
            account.liveBalance?.toString() ||
            account.initialBalance?.toString() ||
            "0";
          return sum + parseFloat(value);
        }, 0) || 10000;
      const ddPct = balance > 0 ? (maxDD / balance) * 100 : 0;

      // Score components (0-20 each, max 100)
      const wrScore = Math.min(20, (winRate / 60) * 20);
      const pfScore = Math.min(20, (Math.min(pf, 3) / 3) * 20);
      const rrScore = Math.min(20, (Math.min(Math.max(avgRR, 0), 3) / 3) * 20);
      const consistencyScore = Math.min(20, (greenDayRate / 70) * 20);
      const ddScore = Math.min(20, Math.max(0, 20 - (ddPct / 15) * 20)); // Lower DD = higher score

      const totalScore = Math.round(
        wrScore + pfScore + rrScore + consistencyScore + ddScore
      );

      return {
        score: totalScore,
        grade:
          totalScore >= 80
            ? "A"
            : totalScore >= 65
            ? "B"
            : totalScore >= 50
            ? "C"
            : totalScore >= 35
            ? "D"
            : "F",
        factors: {
          winRate: {
            score: Math.round(wrScore),
            value: winRate,
            label: "Win Rate",
          },
          profitFactor: {
            score: Math.round(pfScore),
            value: pf,
            label: "Profit Factor",
          },
          riskReward: {
            score: Math.round(rrScore),
            value: avgRR,
            label: "Avg R:R",
          },
          consistency: {
            score: Math.round(consistencyScore),
            value: greenDayRate,
            label: "Consistency",
          },
          drawdown: {
            score: Math.round(ddScore),
            value: ddPct,
            label: "Drawdown Control",
          },
        },
        trades: trades.length,
        period: "90 days",
      };
    }),

  /**
   * EA Health Dashboard
   * Check EA sync status, latency, and connection health across accounts
   */
  eaHealth: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const accounts = await db
      .select({
        id: tradingAccount.id,
        name: tradingAccount.name,
        accountNumber: tradingAccount.accountNumber,
        broker: tradingAccount.broker,
        isVerified: tradingAccount.isVerified,
        lastSyncedAt: tradingAccount.lastSyncedAt,
        liveBalance: tradingAccount.liveBalance,
        liveEquity: tradingAccount.liveEquity,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId));

    const now = new Date();

    const eaAccounts = accounts
      .filter((a) => a.lastSyncedAt) // Only EA-connected accounts
      .map((a) => {
        const lastSync = new Date(a.lastSyncedAt!);
        const secondsAgo = Math.floor(
          (now.getTime() - lastSync.getTime()) / 1000
        );
        const minutesAgo = Math.floor(secondsAgo / 60);

        let status: "connected" | "stale" | "disconnected";
        if (minutesAgo < 2) status = "connected";
        else if (minutesAgo < 10) status = "stale";
        else status = "disconnected";

        return {
          id: a.id,
          name: a.name,
          accountNumber: a.accountNumber,
          broker: a.broker,
          isVerified: a.isVerified,
          lastSyncedAt: lastSync.toISOString(),
          secondsAgo,
          status,
          balance: parseFloat(a.liveBalance?.toString() || "0"),
          equity: parseFloat(a.liveEquity?.toString() || "0"),
        };
      });

    const connected = eaAccounts.filter((a) => a.status === "connected").length;
    const stale = eaAccounts.filter((a) => a.status === "stale").length;
    const disconnected = eaAccounts.filter(
      (a) => a.status === "disconnected"
    ).length;

    return {
      accounts: eaAccounts,
      summary: {
        total: eaAccounts.length,
        connected,
        stale,
        disconnected,
        overallStatus:
          disconnected > 0 ? "issue" : stale > 0 ? "warning" : "healthy",
      },
    };
  }),

  // Archive / Unarchive an account (stores in user widgetPreferences)
  toggleArchive: protectedProcedure
    .input(z.object({ accountId: z.string(), archive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Verify ownership
      const acc = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, userId)
          )
        )
        .limit(1);
      if (acc.length === 0)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });

      // Get current preferences
      const rows = await db
        .select({ widgetPreferences: userTable.widgetPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const prefs = (rows[0]?.widgetPreferences as any) || {};
      const archived: string[] = Array.isArray(prefs.archivedAccounts)
        ? prefs.archivedAccounts
        : [];

      let next: string[];
      if (input.archive) {
        next = archived.includes(input.accountId)
          ? archived
          : [...archived, input.accountId];
      } else {
        next = archived.filter((id: string) => id !== input.accountId);
      }

      await db
        .update(userTable)
        .set({
          widgetPreferences: { ...prefs, archivedAccounts: next },
        })
        .where(eq(userTable.id, userId));

      return { ok: true, archivedAccounts: next };
    }),

  // Get archived account IDs
  getArchivedIds: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await db
      .select({ widgetPreferences: userTable.widgetPreferences })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    const prefs = (rows[0]?.widgetPreferences as any) || {};
    return {
      archivedAccounts: Array.isArray(prefs.archivedAccounts)
        ? (prefs.archivedAccounts as string[])
        : [],
    };
  }),

  // ============== VERIFIED TRACK RECORD ==============

  generateTrackRecord: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const accounts = await db
        .select()
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, userId)
          )
        )
        .limit(1);
      if (!accounts.length) throw new TRPCError({ code: "NOT_FOUND" });
      const account = accounts[0];

      // Get trades
      const allTrades = await db
        .select()
        .from(trade)
        .where(eq(trade.accountId, input.accountId))
        .orderBy(desc(trade.closeTime));

      if (allTrades.length < 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Need at least 10 trades for a verified track record",
        });
      }

      // Compute stats
      const profits = allTrades.map((t: any) =>
        parseFloat(t.profit?.toString() || "0")
      );
      const totalPnl = profits.reduce((s: number, v: number) => s + v, 0);
      const wins = allTrades.filter(
        (t: any) => t.outcome === "Win" || t.outcome === "PW"
      ).length;
      const winRate = Math.round((wins / allTrades.length) * 1000) / 10;

      const grossProfit = profits
        .filter((p) => p > 0)
        .reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(
        profits.filter((p) => p < 0).reduce((s, p) => s + p, 0)
      );
      const profitFactor =
        grossLoss > 0
          ? Math.round((grossProfit / grossLoss) * 100) / 100
          : grossProfit > 0
          ? 999
          : 0;

      const rrs = allTrades
        .filter((t: any) => t.realisedRR != null)
        .map((t: any) => parseFloat(t.realisedRR));
      const avgRR =
        rrs.length > 0
          ? Math.round(
              (rrs.reduce((s: number, v: number) => s + v, 0) / rrs.length) *
                100
            ) / 100
          : 0;

      // Max drawdown
      let peak = 0;
      let maxDD = 0;
      let running = 0;
      for (const p of profits) {
        running += p;
        if (running > peak) peak = running;
        const dd = peak - running;
        if (dd > maxDD) maxDD = dd;
      }

      const firstDate =
        allTrades[allTrades.length - 1]?.openTime ||
        allTrades[allTrades.length - 1]?.closeTime;
      const lastDate = allTrades[0]?.closeTime || allTrades[0]?.openTime;

      const stats = {
        totalTrades: allTrades.length,
        winRate,
        profitFactor,
        avgRR,
        totalPnl: Math.round(totalPnl * 100) / 100,
        maxDrawdown: Math.round(maxDD * 100) / 100,
        startDate: firstDate?.toISOString().slice(0, 10) || "",
        endDate: lastDate?.toISOString().slice(0, 10) || "",
        verificationLevel: account.isVerified === 1 ? "ea_synced" : "manual",
      };

      // Generate verification hash
      const hashInput = `${input.accountId}|${stats.totalTrades}|${stats.winRate}|${stats.profitFactor}|${stats.totalPnl}|${stats.startDate}|${stats.endDate}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(hashInput)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const verificationHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);

      // Generate share ID
      const shareId = `vtr_${verificationHash}`;

      // Store in user's widget preferences
      const userRows = await db
        .select({ widgetPreferences: userTable.widgetPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const prefs = (userRows[0]?.widgetPreferences as any) || {};
      const trackRecords = Array.isArray(prefs.trackRecords)
        ? prefs.trackRecords
        : [];

      // Upsert
      const existing = trackRecords.findIndex(
        (r: any) => r.accountId === input.accountId
      );
      const record = {
        accountId: input.accountId,
        accountName: account.name,
        broker: account.broker,
        shareId,
        verificationHash,
        stats,
        generatedAt: new Date().toISOString(),
      };
      if (existing >= 0) {
        trackRecords[existing] = record;
      } else {
        trackRecords.push(record);
      }

      await db
        .update(userTable)
        .set({ widgetPreferences: { ...prefs, trackRecords } })
        .where(eq(userTable.id, userId));

      return { shareId, verificationHash, stats };
    }),

  getTrackRecord: publicProcedure
    .input(z.object({ shareId: z.string() }))
    .query(async ({ input }) => {
      // Search all users' widget preferences for this track record
      const allUsers = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          username: userTable.username,
          image: userTable.image,
          widgetPreferences: userTable.widgetPreferences,
        })
        .from(userTable);

      for (const u of allUsers) {
        const prefs = (u.widgetPreferences as any) || {};
        const trackRecords = Array.isArray(prefs.trackRecords)
          ? prefs.trackRecords
          : [];
        const record = trackRecords.find(
          (r: any) => r.shareId === input.shareId
        );
        if (record) {
          return {
            ...record,
            trader: {
              name: u.name,
              username: u.username,
              image: u.image,
            },
          };
        }
      }

      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Track record not found",
      });
    }),

  // ============== SAMPLE / DEMO ACCOUNT ==============

  resetDemoWorkspace: protectedProcedure.mutation(async ({ ctx }) => {
    return resetDemoWorkspaceForUser(ctx.session.user.id);
  }),

  createSampleAccount: protectedProcedure.mutation(async ({ ctx }) => {
    return seedSampleAccount(ctx.session.user.id);
  }),
});

const DEMO_ACCOUNT_NAME = "Demo Account";
const DEMO_BROKER = "ProfitEdge Demo";
const DEMO_BROKER_SERVER = "ProfitEdge-Demo01";
const DEMO_ACCOUNT_PREFIX = "DEMO-";
const DEMO_REPORT_DESCRIPTION =
  "Seeded assistant history for the ProfitEdge demo workspace.";

function isSeededDemoAccount(account: {
  name: string | null;
  broker: string | null;
  brokerServer: string | null;
  accountNumber: string | null;
}) {
  return (
    account.name === DEMO_ACCOUNT_NAME &&
    account.broker === DEMO_BROKER &&
    account.brokerServer === DEMO_BROKER_SERVER &&
    (account.accountNumber?.startsWith(DEMO_ACCOUNT_PREFIX) ?? false)
  );
}

async function resetDemoWorkspaceForUser(userId: string) {
  const demoAccounts = await db
    .select({
      id: tradingAccount.id,
      name: tradingAccount.name,
      broker: tradingAccount.broker,
      brokerServer: tradingAccount.brokerServer,
      accountNumber: tradingAccount.accountNumber,
    })
    .from(tradingAccount)
    .where(eq(tradingAccount.userId, userId));

  const demoAccountIds = demoAccounts
    .filter(isSeededDemoAccount)
    .map((account) => account.id);

  if (demoAccountIds.length > 0) {
    const demoTradeRows = await db
      .select({ id: trade.id })
      .from(trade)
      .where(inArray(trade.accountId, demoAccountIds));
    const demoTradeIds = demoTradeRows.map((row) => row.id);

    const tradeReviewEntries = await db
      .select({
        id: journalEntry.id,
        linkedTradeIds: journalEntry.linkedTradeIds,
        accountIds: journalEntry.accountIds,
      })
      .from(journalEntry)
      .where(
        and(
          eq(journalEntry.userId, userId),
          eq(journalEntry.entryType, "trade_review")
        )
      );

    const entryIdsToDelete = tradeReviewEntries
      .filter((entry) => {
        const linkedTradeIds = Array.isArray(entry.linkedTradeIds)
          ? entry.linkedTradeIds
          : [];
        const accountIds = Array.isArray(entry.accountIds)
          ? entry.accountIds
          : [];

        return (
          linkedTradeIds.some((tradeId) => demoTradeIds.includes(tradeId)) ||
          accountIds.some((accountId) => demoAccountIds.includes(accountId))
        );
      })
      .map((entry) => entry.id);

    if (entryIdsToDelete.length > 0) {
      await db
        .delete(journalEntry)
        .where(inArray(journalEntry.id, entryIdsToDelete));
    }

    const demoReports = await db
      .select({ id: aiReport.id })
      .from(aiReport)
      .where(
        and(
          eq(aiReport.userId, userId),
          inArray(aiReport.accountId, demoAccountIds)
        )
      );
    const demoReportIds = demoReports.map((row) => row.id);

    if (demoReportIds.length > 0) {
      const demoMessageRows = await db
        .select({ id: aiChatMessage.id })
        .from(aiChatMessage)
        .where(inArray(aiChatMessage.reportId, demoReportIds));
      const demoMessageIds = demoMessageRows.map((row) => row.id);

      if (demoMessageIds.length > 0) {
        await db
          .delete(aiActionLog)
          .where(
            and(
              eq(aiActionLog.userId, userId),
              inArray(aiActionLog.messageId, demoMessageIds)
            )
          );
      }

      await db
        .delete(aiReport)
        .where(
          and(eq(aiReport.userId, userId), inArray(aiReport.id, demoReportIds))
        );
    }

    await db
      .delete(tradingAccount)
      .where(
        and(
          eq(tradingAccount.userId, userId),
          inArray(tradingAccount.id, demoAccountIds)
        )
      );
  }

  const seeded = await seedSampleAccount(userId);
  return {
    ...seeded,
    resetCount: demoAccountIds.length,
  };
}

async function seedSampleAccount(userId: string) {
  const accountId = crypto.randomUUID();
  const now = Date.now();
  const nowDate = new Date(now);
  const initialBalance = 100_000;
  const tradeCount = 120;
  const openTradeCount = 3;
  const accountNumber = `${DEMO_ACCOUNT_PREFIX}${Math.floor(
    10_000_000 + Math.random() * 90_000_000
  )}`;

  const symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "XAUUSD"] as const;
  const sessions = ["London", "New York", "Asian"] as const;
  const models = [
    "Liquidity Raid",
    "Breaker Block",
    "Supply Zone",
    "Trend Continuation",
  ] as const;
  const alignments = ["aligned", "against", "discretionary"] as const;
  const sessionColors: Record<(typeof sessions)[number], string> = {
    London: "#3B82F6",
    "New York": "#F97316",
    Asian: "#8B5CF6",
  };
  const modelColors: Record<(typeof models)[number], string> = {
    "Liquidity Raid": "#14B8A6",
    "Breaker Block": "#F59E0B",
    "Supply Zone": "#EF4444",
    "Trend Continuation": "#22C55E",
  };
  const basePrices: Record<(typeof symbols)[number], number> = {
    EURUSD: 1.085,
    GBPUSD: 1.27,
    USDJPY: 150.5,
    AUDUSD: 0.655,
    XAUUSD: 2050,
  };
  const pipSizes: Record<(typeof symbols)[number], number> = {
    EURUSD: 0.0001,
    GBPUSD: 0.0001,
    USDJPY: 0.01,
    AUDUSD: 0.0001,
    XAUUSD: 0.1,
  };
  const pipValuePerLot: Record<(typeof symbols)[number], number> = {
    EURUSD: 10,
    GBPUSD: 10,
    USDJPY: 6.67,
    AUDUSD: 10,
    XAUUSD: 10,
  };

  const formatPrice = (symbol: (typeof symbols)[number], value: number) =>
    value.toFixed(symbol === "XAUUSD" ? 2 : symbol === "USDJPY" ? 3 : 5);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(Math.random() * items.length)];
  const roundTo = (value: number, decimals = 2) =>
    Number(value.toFixed(decimals));
  const formatDay = (date: Date) => date.toISOString().slice(0, 10);
  const startOfUtcDay = (date: Date) => {
    const next = new Date(date);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  };
  const subtractUtcMonths = (date: Date, months: number) => {
    const next = startOfUtcDay(date);
    next.setUTCMonth(next.getUTCMonth() - months);
    return next;
  };
  const previousTradingDay = (date: Date) => {
    const previous = startOfUtcDay(date);
    previous.setUTCDate(previous.getUTCDate() - 1);
    while (previous.getUTCDay() === 0 || previous.getUTCDay() === 6) {
      previous.setUTCDate(previous.getUTCDate() - 1);
    }
    return previous;
  };
  const getTradingDaysBetween = (start: Date, end: Date) => {
    const days: Date[] = [];
    const cursor = startOfUtcDay(start);
    const endDay = startOfUtcDay(end);

    while (cursor.getTime() <= endDay.getTime()) {
      if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) {
        days.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  };
  const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const randBetween = (min: number, max: number) =>
    min + Math.random() * (max - min);
  const weightedPick = <T>(
    items: readonly T[],
    getWeight: (item: T) => number
  ) => {
    const weighted = items.map((item) => ({
      item,
      weight: Math.max(0.01, getWeight(item)),
    }));
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return weighted[weighted.length - 1]!.item;
  };
  const createDemoTradeImage = ({
    symbol,
    title,
    accent,
    subtitle,
    metric,
  }: {
    symbol: string;
    title: string;
    accent: string;
    subtitle: string;
    metric: string;
  }) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
        <rect width="1280" height="720" rx="24" fill="#0b0d10"/>
        <rect x="24" y="24" width="1232" height="672" rx="20" fill="#111418" stroke="#1f252d"/>
        <text x="64" y="96" fill="#7b8794" font-family="Arial, sans-serif" font-size="24">${symbol}</text>
        <text x="64" y="154" fill="#f8fafc" font-family="Arial, sans-serif" font-size="46" font-weight="700">${title}</text>
        <text x="64" y="206" fill="#94a3b8" font-family="Arial, sans-serif" font-size="22">${subtitle}</text>
        <rect x="64" y="252" width="1152" height="320" rx="18" fill="#0f1720" stroke="#1e293b"/>
        <path d="M96 504 C180 430 260 462 340 390 S520 308 612 344 S788 484 886 418 S1030 286 1180 324" stroke="${accent}" stroke-width="10" fill="none" stroke-linecap="round"/>
        <circle cx="1180" cy="324" r="10" fill="${accent}"/>
        <rect x="64" y="608" width="250" height="56" rx="14" fill="${accent}" fill-opacity="0.18" stroke="${accent}" />
        <text x="92" y="645" fill="${accent}" font-family="Arial, sans-serif" font-size="26" font-weight="700">${metric}</text>
      </svg>`
    )}`;
  type DemoPhase = {
    name: "foundation" | "leak-cluster" | "recovery" | "refined-edge";
    endIndex: number;
    baseEdge: number;
    discipline: number;
    sameDayProbability: number;
    revengeRisk: number;
    sessionWeights: Record<(typeof sessions)[number], number>;
    modelWeights: Record<(typeof models)[number], number>;
    alignmentWeights: Record<(typeof alignments)[number], number>;
  };
  const sessionOrder: Record<(typeof sessions)[number], number> = {
    Asian: 0,
    London: 1,
    "New York": 2,
  };
  const sessionWindows: Record<
    (typeof sessions)[number],
    { startHour: number; endHour: number }
  > = {
    Asian: { startHour: 0, endHour: 5 },
    London: { startHour: 7, endHour: 11 },
    "New York": { startHour: 13, endHour: 17 },
  };
  const phaseConfigs: DemoPhase[] = [
    {
      name: "foundation",
      endIndex: 27,
      baseEdge: 0.05,
      discipline: 0.72,
      sameDayProbability: 0.78,
      revengeRisk: 0.24,
      sessionWeights: { London: 1.5, "New York": 1.1, Asian: 0.7 },
      modelWeights: {
        "Liquidity Raid": 1.45,
        "Breaker Block": 1.2,
        "Supply Zone": 0.9,
        "Trend Continuation": 0.75,
      },
      alignmentWeights: { aligned: 1.55, discretionary: 0.95, against: 0.55 },
    },
    {
      name: "leak-cluster",
      endIndex: 53,
      baseEdge: -0.12,
      discipline: 0.32,
      sameDayProbability: 0.9,
      revengeRisk: 0.62,
      sessionWeights: { London: 0.9, "New York": 1.45, Asian: 1.2 },
      modelWeights: {
        "Liquidity Raid": 0.85,
        "Breaker Block": 0.95,
        "Supply Zone": 1.15,
        "Trend Continuation": 1.45,
      },
      alignmentWeights: { aligned: 0.7, discretionary: 1.2, against: 1.35 },
    },
    {
      name: "recovery",
      endIndex: 87,
      baseEdge: 0.03,
      discipline: 0.82,
      sameDayProbability: 0.72,
      revengeRisk: 0.14,
      sessionWeights: { London: 1.55, "New York": 1.0, Asian: 0.55 },
      modelWeights: {
        "Liquidity Raid": 1.5,
        "Breaker Block": 1.15,
        "Supply Zone": 0.9,
        "Trend Continuation": 0.7,
      },
      alignmentWeights: { aligned: 1.65, discretionary: 0.85, against: 0.45 },
    },
    {
      name: "refined-edge",
      endIndex: tradeCount - 1,
      baseEdge: 0.12,
      discipline: 0.9,
      sameDayProbability: 0.8,
      revengeRisk: 0.08,
      sessionWeights: { London: 1.65, "New York": 1.15, Asian: 0.4 },
      modelWeights: {
        "Liquidity Raid": 1.65,
        "Breaker Block": 1.25,
        "Supply Zone": 0.75,
        "Trend Continuation": 0.6,
      },
      alignmentWeights: { aligned: 1.8, discretionary: 0.75, against: 0.3 },
    },
  ];
  const forcedOutcomes = new Map<number, "win" | "loss" | "breakeven">([
    [28, "loss"],
    [29, "loss"],
    [30, "loss"],
    [31, "loss"],
    [43, "loss"],
    [44, "breakeven"],
    [45, "loss"],
    [61, "win"],
    [62, "win"],
    [63, "win"],
    [95, "win"],
    [96, "win"],
    [97, "win"],
    [108, "win"],
  ]);
  const getPhaseConfig = (index: number) =>
    phaseConfigs.find((phase) => index <= phase.endIndex) ??
    phaseConfigs.at(-1)!;
  const buildSessionTimestamp = (
    day: Date,
    session: (typeof sessions)[number]
  ) => {
    const window = sessionWindows[session];
    const timestamp = new Date(day);
    const hour =
      window.startHour +
      Math.floor(Math.random() * (window.endHour - window.startHour + 1));
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    timestamp.setUTCHours(hour, minute, second, 0);
    return timestamp.getTime();
  };
  const closedTradeWindowStart = subtractUtcMonths(nowDate, 6);
  const closedTradeWindowEnd = previousTradingDay(nowDate);
  const availableTradingDays =
    getTradingDaysBetween(closedTradeWindowStart, closedTradeWindowEnd);

  const closedTrades: (typeof trade.$inferInsert)[] = [];
  let runningBalance = initialBalance;
  let currentTradingDayIndex = 0;
  let currentTradingDay = new Date(
    availableTradingDays[currentTradingDayIndex] ?? closedTradeWindowEnd
  );
  const lastTradingDayIndex = Math.max(availableTradingDays.length - 1, 0);
  let previousCloseTs: number | null = null;
  let previousSession: (typeof sessions)[number] | null = null;
  let previousOutcome: "win" | "loss" | "breakeven" | null = null;
  let consecutiveLosses = 0;
  let consecutiveWins = 0;

  for (let i = 0; i < tradeCount; i++) {
    const phase = getPhaseConfig(i);
    let session = weightedPick(
      sessions,
      (candidate) => phase.sessionWeights[candidate]
    );
    const isRevengeTrade =
      previousOutcome === "loss" &&
      previousSession !== null &&
      Math.random() < phase.revengeRisk &&
      consecutiveLosses < 4;
    if (isRevengeTrade && previousSession) {
      session = previousSession;
    }

    const model = weightedPick(
      models,
      (candidate) => phase.modelWeights[candidate]
    );
    const alignment = weightedPick(
      alignments,
      (candidate) => phase.alignmentWeights[candidate]
    );
    const symbol = weightedPick(symbols, (candidate) => {
      let weight = 1;
      if (
        session === "London" &&
        (candidate === "EURUSD" ||
          candidate === "GBPUSD" ||
          candidate === "XAUUSD")
      ) {
        weight += 0.9;
      }
      if (
        session === "New York" &&
        (candidate === "XAUUSD" ||
          candidate === "AUDUSD" ||
          candidate === "USDJPY")
      ) {
        weight += 0.75;
      }
      if (
        session === "Asian" &&
        (candidate === "USDJPY" || candidate === "AUDUSD")
      ) {
        weight += 0.8;
      }
      if (phase.name === "refined-edge" && candidate === "EURUSD") {
        weight += 0.35;
      }
      if (phase.name === "leak-cluster" && candidate === "GBPUSD") {
        weight += 0.45;
      }
      return weight;
    });
    const longBias =
      session === "London" ? 0.58 : session === "New York" ? 0.52 : 0.46;
    const tradeDirection = Math.random() < longBias ? "long" : "short";
    const directionFactor = tradeDirection === "long" ? 1 : -1;
    const isGold = symbol === "XAUUSD";
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const pricePrecision =
      symbol === "XAUUSD" ? 2 : symbol === "USDJPY" ? 3 : 5;
    const previousSessionOrder =
      previousSession != null ? sessionOrder[previousSession] : -1;
    const sessionPosition = sessionOrder[session];
    const openNewDay =
      i === 0 ||
      (!isRevengeTrade &&
        (sessionPosition <= previousSessionOrder ||
          Math.random() > phase.sameDayProbability));
    if (i > 0 && openNewDay) {
      currentTradingDayIndex = Math.min(
        lastTradingDayIndex,
        currentTradingDayIndex + (Math.random() < 0.18 ? 2 : 1)
      );
      currentTradingDay = new Date(
        availableTradingDays[currentTradingDayIndex] ?? currentTradingDay
      );
    }

    let openTs: number =
      isRevengeTrade && previousCloseTs
        ? previousCloseTs + (4 + Math.floor(Math.random() * 9)) * 60 * 1000
        : buildSessionTimestamp(currentTradingDay, session);
    if (previousCloseTs && openTs <= previousCloseTs) {
      if (currentTradingDayIndex < lastTradingDayIndex) {
        currentTradingDayIndex += 1;
        currentTradingDay = new Date(
          availableTradingDays[currentTradingDayIndex] ?? currentTradingDay
        );
        openTs = buildSessionTimestamp(currentTradingDay, session);
      } else {
        openTs = previousCloseTs + (4 + Math.floor(Math.random() * 9)) * 60 * 1000;
      }
    }

    const holdSeconds = 12 * 60 + Math.floor(Math.random() * (6 * 60 * 60));
    const closeTs: number = openTs + holdSeconds * 1000;
    const openTime = new Date(openTs);
    const closeTime = new Date(closeTs);
    const volume = roundTo(
      isGold ? 0.2 + Math.random() * 0.8 : 0.2 + Math.random() * 1.2,
      2
    );
    const openPrice =
      basePrices[symbol] +
      (Math.random() - 0.5) *
        pipSize *
        (isGold ? 300 : symbol === "USDJPY" ? 220 : 180);
    let plannedRR = roundTo(
      phase.name === "refined-edge"
        ? 1.8 + Math.random() * 1.2
        : phase.name === "leak-cluster"
        ? 1.2 + Math.random() * 1.0
        : 1.4 + Math.random() * 1.3,
      2
    );
    if (model === "Liquidity Raid") plannedRR = roundTo(plannedRR + 0.18, 2);
    if (alignment === "against") plannedRR = roundTo(plannedRR - 0.12, 2);
    const riskPips = roundTo(
      isGold ? 45 + Math.random() * 85 : 12 + Math.random() * 28,
      1
    );
    const targetPips = roundTo(riskPips * plannedRR, 1);
    let edgeScore = phase.baseEdge;
    edgeScore +=
      session === "London" ? 0.11 : session === "New York" ? 0.02 : -0.11;
    edgeScore +=
      alignment === "aligned"
        ? 0.14
        : alignment === "discretionary"
        ? -0.03
        : -0.18;
    edgeScore +=
      model === "Liquidity Raid"
        ? 0.1
        : model === "Breaker Block"
        ? 0.05
        : model === "Supply Zone"
        ? -0.01
        : -0.08;
    if (
      session === "London" &&
      model === "Liquidity Raid" &&
      alignment === "aligned"
    ) {
      edgeScore += 0.16;
    }
    if (
      session === "New York" &&
      model === "Breaker Block" &&
      alignment === "aligned"
    ) {
      edgeScore += 0.08;
    }
    if (session === "Asian" && model === "Trend Continuation") {
      edgeScore -= 0.2;
    }
    if (
      session === "New York" &&
      alignment !== "aligned" &&
      (symbol === "GBPUSD" || symbol === "XAUUSD")
    ) {
      edgeScore -= 0.16;
    }
    if (
      phase.name === "refined-edge" &&
      session === "London" &&
      symbol === "EURUSD"
    ) {
      edgeScore += 0.08;
    }
    if (phase.name === "leak-cluster" && alignment !== "aligned") {
      edgeScore -= 0.08;
    }
    if (tradeDirection === "long" && session === "Asian") {
      edgeScore -= 0.03;
    }
    if (consecutiveLosses >= 2) {
      edgeScore += phase.name === "leak-cluster" ? -0.06 : -0.02;
    }
    if (consecutiveWins >= 3 && phase.name === "refined-edge") {
      edgeScore += 0.03;
    }

    const forcedOutcome = forcedOutcomes.get(i) ?? null;
    const winProbability = clampNumber(0.24, 0.82, 0.51 + edgeScore);
    const breakevenProbability = forcedOutcome
      ? 0
      : phase.name === "leak-cluster"
      ? 0.05
      : 0.08;

    let outcomeBucket: "win" | "loss" | "breakeven";
    if (forcedOutcome) {
      outcomeBucket = forcedOutcome;
    } else {
      const resultRoll = Math.random();
      if (resultRoll < winProbability) {
        outcomeBucket = "win";
      } else if (resultRoll < winProbability + breakevenProbability) {
        outcomeBucket = "breakeven";
      } else {
        outcomeBucket = "loss";
      }
    }

    let realisedRRSeed: number;
    if (outcomeBucket === "win") {
      const minWinRR =
        phase.name === "refined-edge"
          ? 1.2
          : phase.name === "foundation"
          ? 0.85
          : phase.name === "recovery"
          ? 0.95
          : 0.65;
      const maxWinRR =
        phase.name === "refined-edge"
          ? 2.8
          : phase.name === "foundation"
          ? 2.15
          : phase.name === "recovery"
          ? 2.25
          : 1.65;
      realisedRRSeed = roundTo(
        randBetween(minWinRR, maxWinRR) +
          (alignment === "aligned" ? 0.1 : -0.06) +
          (session === "London" ? 0.08 : 0),
        2
      );
    } else if (outcomeBucket === "breakeven") {
      realisedRRSeed = roundTo((Math.random() - 0.5) * 0.18, 2);
    } else {
      const baseLoss =
        alignment === "aligned"
          ? randBetween(0.35, 0.85)
          : randBetween(0.75, 1.12);
      realisedRRSeed = -roundTo(
        Math.min(
          1.3,
          baseLoss +
            (phase.name === "leak-cluster" ? 0.08 : 0) +
            (session === "Asian" && model === "Trend Continuation" ? 0.06 : 0)
        ),
        2
      );
    }

    const resultPips = roundTo(riskPips * realisedRRSeed, 1);
    const closePrice = openPrice + directionFactor * resultPips * pipSize;
    const sl = openPrice - directionFactor * riskPips * pipSize;
    const tp = openPrice + directionFactor * targetPips * pipSize;

    const favorablePips =
      resultPips >= 0
        ? Math.max(
            resultPips,
            roundTo(
              riskPips * (Math.abs(realisedRRSeed) + 0.2 + Math.random() * 0.8),
              1
            )
          )
        : roundTo(riskPips * (0.15 + Math.random() * 0.9), 1);
    const adversePips =
      resultPips < 0
        ? Math.max(
            Math.abs(resultPips),
            roundTo(riskPips * (0.7 + Math.random() * 0.5), 1)
          )
        : roundTo(riskPips * (0.12 + Math.random() * 0.75), 1);
    const postExitContinuationPips = roundTo(
      riskPips *
        (resultPips >= 0
          ? 0.15 + Math.random() * 0.9
          : 0.1 + Math.random() * 0.5),
      1
    );

    const entryPeakPrice =
      tradeDirection === "long"
        ? openPrice + favorablePips * pipSize
        : openPrice - favorablePips * pipSize;
    const postExitPeakPrice =
      tradeDirection === "long"
        ? closePrice + postExitContinuationPips * pipSize
        : closePrice - postExitContinuationPips * pipSize;
    const manipulationHigh =
      tradeDirection === "long"
        ? openPrice + favorablePips * pipSize
        : openPrice + adversePips * pipSize;
    const manipulationLow =
      tradeDirection === "long"
        ? openPrice - adversePips * pipSize
        : openPrice - favorablePips * pipSize;

    const poorExecutionBias =
      phase.name === "leak-cluster" || alignment !== "aligned";
    const commissionCost = roundTo(volume * (isGold ? 7.2 : 6.1), 2);
    const swapValue = roundTo(
      (Math.random() - 0.72) *
        volume *
        (holdSeconds / 86_400) *
        (isGold ? 5.5 : 1.8),
      2
    );
    const grossProfit = resultPips * volume * pipValue;
    const netProfit = roundTo(grossProfit - commissionCost + swapValue, 2);
    const entryMargin = roundTo(
      (volume * (isGold ? 100 : 100_000) * openPrice) / 100,
      2
    );
    const entryEquity = roundTo(
      runningBalance + (Math.random() - 0.5) * 250,
      2
    );
    const entryFreeMargin = roundTo(entryEquity - entryMargin, 2);
    const entryMarginLevel =
      entryMargin > 0 ? roundTo((entryEquity / entryMargin) * 100, 2) : null;
    const entryPeakDurationSeconds = Math.max(
      90,
      Math.min(
        holdSeconds - 60,
        Math.round(holdSeconds * (0.18 + Math.random() * 0.55))
      )
    );
    const postExitPeakDurationSeconds =
      5 * 60 + Math.floor(Math.random() * 55 * 60);
    const postExitSamplingDuration = Math.max(
      3600,
      postExitPeakDurationSeconds + 300
    );
    const entryPeakTimestamp = new Date(
      openTs + entryPeakDurationSeconds * 1000
    );
    const postExitPeakTimestamp = new Date(
      closeTs + postExitPeakDurationSeconds * 1000
    );
    const entrySpreadPips = roundTo(
      isGold
        ? 2.2 + Math.random() * (poorExecutionBias ? 2.6 : 1.6)
        : 0.4 + Math.random() * (poorExecutionBias ? 1.8 : 1.1),
      1
    );
    const exitSpreadPips = roundTo(
      entrySpreadPips + (Math.random() - 0.3) * (poorExecutionBias ? 0.8 : 0.5),
      1
    );
    const entrySlippagePips = roundTo(
      Math.random() *
        (poorExecutionBias ? (isGold ? 2.1 : 0.9) : isGold ? 1.1 : 0.35),
      1
    );
    const exitSlippagePips = roundTo(
      Math.random() *
        (poorExecutionBias ? (isGold ? 2.4 : 1.1) : isGold ? 1.2 : 0.45),
      1
    );
    const scaleInCount =
      Math.random() > (poorExecutionBias ? 0.68 : 0.82) ? 1 : 0;
    const scaleOutCount =
      Math.random() > (alignment === "aligned" ? 0.78 : 0.64) ? 1 : 0;
    const partialCloseCount =
      scaleOutCount > 0 ? 1 + Math.floor(Math.random() * 2) : 0;
    const entryDealCount = 1 + scaleInCount;
    const exitDealCount = 1 + partialCloseCount;
    const exitVolume = roundTo(
      Math.max(volume - (partialCloseCount > 0 ? volume * 0.15 : 0), 0.01),
      2
    );
    const alphaWeightedMpe = 0.3;
    const beThresholdPips = isGold ? 1 : 0.5;

    const advanced = calculateAllAdvancedMetrics(
      {
        id: `${accountId}-${i}`,
        symbol,
        tradeDirection,
        entryPrice: openPrice,
        sl,
        tp,
        closePrice,
        profit: netProfit,
        commissions: commissionCost,
        swap: swapValue,
        volume,
        manipulationHigh,
        manipulationLow,
        manipulationPips: null,
        entryPeakPrice,
        postExitPeakPrice,
        alphaWeightedMpe,
        beThresholdPips,
      },
      tradeCount,
      true
    );

    const tradeId = crypto.randomUUID();
    closedTrades.push({
      id: tradeId,
      accountId,
      ticket: `SIM-${String(i + 1).padStart(5, "0")}`,
      open: openTime.toISOString(),
      tradeType: tradeDirection,
      volume: volume.toFixed(2),
      symbol,
      openPrice: formatPrice(symbol, openPrice),
      sl: formatPrice(symbol, sl),
      tp: formatPrice(symbol, tp),
      close: closeTime.toISOString(),
      closePrice: formatPrice(symbol, closePrice),
      swap: swapValue.toFixed(2),
      commissions: commissionCost.toFixed(2),
      profit: netProfit.toFixed(2),
      pips: resultPips.toFixed(1),
      tradeDurationSeconds: holdSeconds.toString(),
      openTime,
      closeTime,
      useBrokerData: 1,
      manipulationHigh: formatPrice(symbol, manipulationHigh),
      manipulationLow: formatPrice(symbol, manipulationLow),
      manipulationPips:
        advanced.manipulationPips != null
          ? advanced.manipulationPips.toFixed(1)
          : null,
      entryPeakPrice: formatPrice(symbol, entryPeakPrice),
      entryPeakTimestamp,
      postExitPeakPrice: formatPrice(symbol, postExitPeakPrice),
      postExitPeakTimestamp,
      postExitSamplingDuration,
      entrySpreadPips: entrySpreadPips.toFixed(1),
      exitSpreadPips: exitSpreadPips.toFixed(1),
      entrySlippagePips: entrySlippagePips.toFixed(1),
      exitSlippagePips: exitSlippagePips.toFixed(1),
      slModCount: poorExecutionBias
        ? 2 + Math.floor(Math.random() * 3)
        : Math.floor(Math.random() * 2),
      tpModCount:
        alignment === "aligned"
          ? Math.floor(Math.random() * 2)
          : 1 + Math.floor(Math.random() * 2),
      partialCloseCount,
      exitDealCount,
      exitVolume: exitVolume.toFixed(2),
      entryDealCount,
      entryVolume: volume.toFixed(2),
      scaleInCount,
      scaleOutCount,
      trailingStopDetected:
        alignment === "aligned" ? Math.random() > 0.48 : Math.random() > 0.74,
      entryPeakDurationSeconds,
      postExitPeakDurationSeconds,
      entryBalance: runningBalance.toFixed(2),
      entryEquity: entryEquity.toFixed(2),
      entryMargin: entryMargin.toFixed(2),
      entryFreeMargin: entryFreeMargin.toFixed(2),
      entryMarginLevel:
        entryMarginLevel != null ? entryMarginLevel.toFixed(2) : null,
      alphaWeightedMpe: alphaWeightedMpe.toFixed(2),
      beThresholdPips: beThresholdPips.toFixed(2),
      sessionTag: session,
      sessionTagColor: sessionColors[session],
      modelTag: model,
      modelTagColor: modelColors[model],
      protocolAlignment: alignment,
      outcome: advanced.outcome,
      plannedRR:
        advanced.plannedRR != null ? advanced.plannedRR.toFixed(2) : null,
      plannedRiskPips:
        advanced.plannedRiskPips != null
          ? advanced.plannedRiskPips.toFixed(1)
          : null,
      plannedTargetPips:
        advanced.plannedTargetPips != null
          ? advanced.plannedTargetPips.toFixed(1)
          : null,
      mfePips: advanced.mfePips != null ? advanced.mfePips.toFixed(1) : null,
      maePips: advanced.maePips != null ? advanced.maePips.toFixed(1) : null,
      mpeManipLegR:
        advanced.mpeManipLegR != null ? advanced.mpeManipLegR.toFixed(2) : null,
      mpeManipPE_R:
        advanced.mpeManipPE_R != null ? advanced.mpeManipPE_R.toFixed(2) : null,
      maxRR: advanced.maxRR != null ? advanced.maxRR.toFixed(2) : null,
      rawSTDV: advanced.rawSTDV != null ? advanced.rawSTDV.toFixed(2) : null,
      rawSTDV_PE:
        advanced.rawSTDV_PE != null ? advanced.rawSTDV_PE.toFixed(2) : null,
      stdvBucket: advanced.stdvBucket,
      estimatedWeightedMPE_R:
        advanced.estimatedWeightedMPE_R != null
          ? advanced.estimatedWeightedMPE_R.toFixed(2)
          : null,
      realisedRR:
        advanced.realisedRR != null ? advanced.realisedRR.toFixed(2) : null,
      rrCaptureEfficiency:
        advanced.rrCaptureEfficiency != null
          ? advanced.rrCaptureEfficiency.toFixed(2)
          : null,
      manipRREfficiency:
        advanced.manipRREfficiency != null
          ? advanced.manipRREfficiency.toFixed(2)
          : null,
      exitEfficiency:
        advanced.exitEfficiency != null
          ? advanced.exitEfficiency.toFixed(2)
          : null,
      killzone: session,
      killzoneColor: sessionColors[session],
      createdAt: closeTime,
    });

    runningBalance = roundTo(runningBalance + netProfit, 2);
    previousCloseTs = closeTs;
    previousSession = session;
    previousOutcome = outcomeBucket;
    if (outcomeBucket === "loss") {
      consecutiveLosses += 1;
      consecutiveWins = 0;
    } else if (outcomeBucket === "win") {
      consecutiveWins += 1;
      consecutiveLosses = 0;
    } else {
      consecutiveWins = 0;
      consecutiveLosses = 0;
    }
  }

  const liveOpenTrades: (typeof openTrade.$inferInsert)[] = [];
  let totalFloatingPnl = 0;
  let totalOpenMargin = 0;

  for (let i = 0; i < openTradeCount; i++) {
    const symbol = pick(symbols);
    const session = pick(sessions);
    const direction = Math.random() > 0.5 ? "long" : "short";
    const directionFactor = direction === "long" ? 1 : -1;
    const isGold = symbol === "XAUUSD";
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const volume = roundTo(
      isGold ? 0.2 + Math.random() * 0.6 : 0.2 + Math.random() * 1.0,
      2
    );
    const openPrice =
      basePrices[symbol] +
      (Math.random() - 0.5) *
        pipSize *
        (isGold ? 160 : symbol === "USDJPY" ? 120 : 100);
    const riskPips = roundTo(
      isGold ? 40 + Math.random() * 55 : 10 + Math.random() * 18,
      1
    );
    const targetPips = roundTo(riskPips * (1.6 + Math.random() * 1.2), 1);
    const openTs = now - (20 * 60 * 1000 + Math.random() * 8 * 60 * 60 * 1000);
    const currentPips = roundTo((Math.random() - 0.2) * riskPips * 0.9, 1);
    const currentPrice = openPrice + directionFactor * currentPips * pipSize;
    const sl = openPrice - directionFactor * riskPips * pipSize;
    const tp = openPrice + directionFactor * targetPips * pipSize;
    const commission = roundTo(volume * (isGold ? 3.4 : 2.8), 2);
    const swap = roundTo((Math.random() - 0.65) * volume * 0.8, 2);
    const floatingPnl = roundTo(
      currentPips * volume * pipValue - commission + swap,
      2
    );
    const margin = roundTo(
      (volume * (isGold ? 100 : 100_000) * openPrice) / 100,
      2
    );

    totalFloatingPnl += floatingPnl;
    totalOpenMargin += margin;

    liveOpenTrades.push({
      id: crypto.randomUUID(),
      accountId,
      ticket: `LIVE-${String(i + 1).padStart(4, "0")}`,
      symbol,
      tradeType: direction,
      volume: volume.toFixed(2),
      openPrice: formatPrice(symbol, openPrice),
      openTime: new Date(openTs),
      sl: formatPrice(symbol, sl),
      tp: formatPrice(symbol, tp),
      currentPrice: formatPrice(symbol, currentPrice),
      swap: swap.toFixed(2),
      commission: commission.toFixed(2),
      profit: floatingPnl.toFixed(2),
      sessionTag: session,
      sessionTagColor: sessionColors[session],
      slModCount: Math.floor(Math.random() * 2),
      tpModCount: Math.floor(Math.random() * 2),
      partialCloseCount: Math.random() > 0.8 ? 1 : 0,
      entryDealCount: 1,
      exitDealCount: 0,
      entryVolume: volume.toFixed(2),
      exitVolume: "0.00",
      scaleInCount: 0,
      scaleOutCount: 0,
      trailingStopDetected: Math.random() > 0.6,
      comment: `Live demo ${session} setup`,
      magicNumber: 1000 + i,
      lastUpdatedAt: nowDate,
      createdAt: new Date(openTs),
    });
  }

  const liveBalance = roundTo(runningBalance, 2);
  const liveEquity = roundTo(liveBalance + totalFloatingPnl, 2);
  const liveMargin = roundTo(totalOpenMargin, 2);
  const liveFreeMargin = roundTo(liveEquity - liveMargin, 2);

  const closedTradesByDay = new Map<
    string,
    { profit: number; count: number; closeTimes: Date[] }
  >();
  for (const row of closedTrades) {
    const dateKey = formatDay(row.closeTime as Date);
    const existing = closedTradesByDay.get(dateKey) || {
      profit: 0,
      count: 0,
      closeTimes: [],
    };
    existing.profit += Number(row.profit || 0);
    existing.count += 1;
    existing.closeTimes.push(row.closeTime as Date);
    closedTradesByDay.set(dateKey, existing);
  }

  const snapshots: (typeof equitySnapshot.$inferInsert)[] = [];
  const propSnapshots: (typeof propDailySnapshot.$inferInsert)[] = [];
  let rollingBalance = initialBalance;
  let bestDayProfit = -Infinity;
  let maxHighEquity = initialBalance;
  const samplePropRuleRows = await db
    .select({
      id: propChallengeRule.id,
      propFirmId: propChallengeRule.propFirmId,
      phases: propChallengeRule.phases,
    })
    .from(propChallengeRule)
    .where(eq(propChallengeRule.active, true))
    .limit(1);
  const samplePropRule = samplePropRuleRows[0];
  const propPhase =
    (
      samplePropRule?.phases as Array<Record<string, unknown>> | undefined
    )?.find((phase) => Number(phase.order ?? 0) === 1) ||
    (
      samplePropRule?.phases as Array<Record<string, unknown>> | undefined
    )?.[0] ||
    null;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);
    const dateKey = formatDay(date);
    const dayData = closedTradesByDay.get(dateKey) || {
      profit: 0,
      count: 0,
      closeTimes: [],
    };
    const startingBalance = rollingBalance;
    const dailyProfit = roundTo(dayData.profit, 2);
    const endingBalance = roundTo(startingBalance + dailyProfit, 2);
    const floatingForDay = dayOffset === 0 ? totalFloatingPnl : 0;
    const endingEquity = roundTo(endingBalance + floatingForDay, 2);
    const dailyHighWaterMark = roundTo(
      Math.max(startingBalance, endingBalance, endingEquity) +
        (dayData.count > 0 ? Math.random() * 180 : 0),
      2
    );
    const lowEquity = roundTo(
      Math.min(startingBalance, endingBalance, endingEquity) -
        (dayData.count > 0 ? Math.random() * 140 : 0),
      2
    );
    const dailyDrawdown = roundTo(
      Math.max(0, dailyHighWaterMark - lowEquity),
      2
    );
    const dailyDrawdownPercent = roundTo(
      dailyHighWaterMark > 0 ? (dailyDrawdown / dailyHighWaterMark) * 100 : 0,
      2
    );

    snapshots.push({
      accountId,
      snapshotDate: dateKey,
      balance: endingBalance.toFixed(2),
      equity: endingEquity.toFixed(2),
      floatingPnl: floatingForDay.toFixed(2),
      highEquity: dailyHighWaterMark.toFixed(2),
      lowEquity: lowEquity.toFixed(2),
      closedTradesCount: dayData.count,
      dailyRealizedPnl: dailyProfit.toFixed(2),
      source: "manual",
      createdAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
      updatedAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
    });

    if (samplePropRule && propPhase) {
      propSnapshots.push({
        id: crypto.randomUUID(),
        accountId,
        date: dateKey,
        startingBalance: startingBalance.toFixed(2),
        startingEquity: startingBalance.toFixed(2),
        endingBalance: endingBalance.toFixed(2),
        endingEquity: endingEquity.toFixed(2),
        dailyProfit: dailyProfit.toFixed(2),
        dailyProfitPercent: roundTo(
          (dailyProfit / initialBalance) * 100,
          2
        ).toFixed(2),
        dailyHighWaterMark: dailyHighWaterMark.toFixed(2),
        dailyDrawdown: dailyDrawdown.toFixed(2),
        dailyDrawdownPercent: dailyDrawdownPercent.toFixed(2),
        tradesCount: dayData.count,
        isTradingDay: dayData.count > 0,
        breachedDailyLoss: false,
        breachedMaxLoss: false,
        createdAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
      });
    }

    maxHighEquity = Math.max(maxHighEquity, dailyHighWaterMark);
    bestDayProfit = Math.max(bestDayProfit, dailyProfit);
    rollingBalance = endingBalance;
  }

  const tradingDays = snapshots.filter(
    (snapshot) => (snapshot.closedTradesCount || 0) > 0
  ).length;
  const currentProfit = roundTo(liveBalance - initialBalance, 2);
  const currentProfitPct = roundTo((currentProfit / initialBalance) * 100, 2);
  const propPhaseStartDate = new Date(now);
  propPhaseStartDate.setDate(propPhaseStartDate.getDate() - 21);

  const [account] = await db
    .insert(tradingAccount)
    .values({
      id: accountId,
      userId,
      name: DEMO_ACCOUNT_NAME,
      broker: DEMO_BROKER,
      brokerType: "mt5",
      brokerServer: DEMO_BROKER_SERVER,
      accountNumber,
      preferredDataSource: "broker",
      averageSpreadPips: "1.20",
      initialBalance: initialBalance.toFixed(2),
      initialCurrency: "USD",
      isVerified: 1,
      liveBalance: liveBalance.toFixed(2),
      liveEquity: liveEquity.toFixed(2),
      liveMargin: liveMargin.toFixed(2),
      liveFreeMargin: liveFreeMargin.toFixed(2),
      lastSyncedAt: nowDate,
      isPropAccount: Boolean(samplePropRule && propPhase),
      propFirmId: samplePropRule?.propFirmId ?? null,
      propChallengeRuleId: samplePropRule?.id ?? null,
      propCurrentPhase: propPhase ? Number(propPhase.order ?? 1) : null,
      propPhaseStartDate: propPhase ? formatDay(propPhaseStartDate) : null,
      propPhaseStartBalance: propPhase ? initialBalance.toFixed(2) : null,
      propPhaseStartEquity: propPhase ? initialBalance.toFixed(2) : null,
      propDailyHighWaterMark: propPhase ? liveEquity.toFixed(2) : null,
      propPhaseHighWaterMark: propPhase ? maxHighEquity.toFixed(2) : null,
      propPhaseCurrentProfit: propPhase ? currentProfit.toFixed(2) : null,
      propPhaseCurrentProfitPercent: propPhase
        ? currentProfitPct.toFixed(2)
        : null,
      propPhaseTradingDays: propPhase ? tradingDays : 0,
      propPhaseStatus: propPhase ? "active" : null,
      propPhaseBestDayProfit:
        propPhase && Number.isFinite(bestDayProfit)
          ? bestDayProfit.toFixed(2)
          : null,
      propPhaseBestDayProfitPercent:
        propPhase && Number.isFinite(bestDayProfit)
          ? roundTo((bestDayProfit / initialBalance) * 100, 2).toFixed(2)
          : null,
      propManualOverride: false,
      propDetectedFirmId: samplePropRule?.propFirmId ?? null,
      verificationLevel: propPhase ? "prop_verified" : "ea_synced",
      socialOptIn: true,
      socialVisibleSince: new Date(now - 14 * 24 * 60 * 60 * 1000),
      followerCount: 12,
      feedEventCount: 0,
    })
    .returning();

  for (let i = 0; i < closedTrades.length; i += 25) {
    await db.insert(trade).values(closedTrades.slice(i, i + 25));
  }

  if (liveOpenTrades.length > 0) {
    await db.insert(openTrade).values(liveOpenTrades);
  }

  for (let i = 0; i < snapshots.length; i += 25) {
    await db.insert(equitySnapshot).values(snapshots.slice(i, i + 25));
  }

  if (propSnapshots.length > 0) {
    for (let i = 0; i < propSnapshots.length; i += 25) {
      await db.insert(propDailySnapshot).values(propSnapshots.slice(i, i + 25));
    }
  }

  const checklistTemplateId = crypto.randomUUID();
  await db.insert(tradeChecklistTemplate).values({
    id: checklistTemplateId,
    accountId,
    userId,
    name: "Demo Pre-Trade Checklist",
    description: "Seeded checklist for the demo account",
    strategyTag: "Liquidity Raid",
    items: [
      { label: "Session bias is clear", isRequired: true, category: "context" },
      {
        label: "Risk is defined before entry",
        isRequired: true,
        category: "risk",
      },
      {
        label: "Entry matches model criteria",
        isRequired: true,
        category: "execution",
      },
      {
        label: "News and liquidity context checked",
        isRequired: false,
        category: "context",
      },
    ],
    isDefault: true,
  });

  const checklistSeedTrades = closedTrades.slice(-36);
  const checklistRows: (typeof tradeChecklistResult.$inferInsert)[] =
    checklistSeedTrades.map((row, index) => {
      const completionRate = Math.max(
        50,
        Math.min(100, 72 + ((index % 5) - 2) * 8 + Math.random() * 12)
      );
      const completedItems = Array.from({ length: 4 }, (_, itemIndex) => ({
        itemIndex,
        checked: itemIndex < Math.round((completionRate / 100) * 4),
        timestamp: new Date(
          (row.openTime as Date).getTime() - (4 - itemIndex) * 60 * 1000
        ).toISOString(),
      }));

      return {
        id: crypto.randomUUID(),
        templateId: checklistTemplateId,
        tradeId: row.id,
        accountId,
        userId,
        completedItems,
        completionRate: completionRate.toFixed(2),
        createdAt: new Date((row.openTime as Date).getTime() - 5 * 60 * 1000),
      };
    });

  if (checklistRows.length > 0) {
    await db.insert(tradeChecklistResult).values(checklistRows);
  }

  const reviewTradeIds = closedTrades
    .slice(-36)
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));
  for (const tradeId of reviewTradeIds) {
    await createAutoTradeReviewEntry({ userId, tradeId });
  }

  const feedTradeIds = closedTrades
    .slice(-24)
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));
  for (const tradeId of feedTradeIds) {
    await generateFeedEventForTrade(tradeId).catch((error) => {
      console.error(
        "[createSampleAccount] feed event generation failed",
        error
      );
    });
  }

  const richTradeSeedRows = closedTrades.slice(-18).reverse();
  const mediaRows: (typeof tradeMedia.$inferInsert)[] = [];
  const noteRows: (typeof tradeNote.$inferInsert)[] = [];
  const annotationRows: (typeof tradeAnnotation.$inferInsert)[] = [];

  richTradeSeedRows.forEach((row, index) => {
    if (!row.id) return;
    const symbol = row.symbol || "TRADE";
    const pnl = Number(row.profit || 0);
    const realizedRR = Number(row.realisedRR || 0);
    const session = row.sessionTag || "London";
    const model = row.modelTag || "Discretionary";
    const closeTime = (row.closeTime as Date) || nowDate;
    const entryAccent = pnl >= 0 ? "#14b8a6" : "#f59e0b";
    const analysisAccent = pnl >= 0 ? "#22c55e" : "#f43f5e";
    const tradeLabel = `${symbol} ${String(row.tradeType || "").toUpperCase()}`;
    const noteText = [
      `${tradeLabel} in ${session} using ${model}.`,
      pnl >= 0
        ? `Execution stayed patient and realized ${realizedRR.toFixed(2)}R.`
        : `Loss came from weak follow-through after entry and closed at ${realizedRR.toFixed(
            2
          )}R.`,
      `Next focus: ${
        pnl >= 0
          ? "repeat the same process without adding risk"
          : "tighten qualification before the click"
      }.`,
    ].join(" ");

    mediaRows.push(
      {
        id: crypto.randomUUID(),
        tradeId: row.id,
        userId,
        mediaType: "image",
        url: createDemoTradeImage({
          symbol,
          title: "Entry Context",
          accent: entryAccent,
          subtitle: `${session} session · ${model} · ${tradeLabel}`,
          metric: `Risk ${Number(row.plannedRiskPips || 0).toFixed(1)} pips`,
        }),
        thumbnailUrl: null,
        fileName: `${symbol.toLowerCase()}-entry-context.svg`,
        fileSize: 24_000,
        mimeType: "image/svg+xml",
        width: 1280,
        height: 720,
        altText: `${symbol} entry context screenshot`,
        caption: `${session} setup context`,
        description: `Seeded entry screenshot showing the setup context for ${tradeLabel}.`,
        isEntryScreenshot: true,
        isExitScreenshot: false,
        isAnalysis: false,
        sortOrder: 0,
        createdAt: new Date(closeTime.getTime() - 10 * 60 * 1000),
      },
      {
        id: crypto.randomUUID(),
        tradeId: row.id,
        userId,
        mediaType: "image",
        url: createDemoTradeImage({
          symbol,
          title: "Post-Trade Review",
          accent: analysisAccent,
          subtitle: `${
            pnl >= 0 ? "Winner managed" : "Loss reviewed"
          } · ${session}`,
          metric: `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`,
        }),
        thumbnailUrl: null,
        fileName: `${symbol.toLowerCase()}-post-trade-review.svg`,
        fileSize: 26_000,
        mimeType: "image/svg+xml",
        width: 1280,
        height: 720,
        altText: `${symbol} analysis screenshot`,
        caption: "Post-trade markup",
        description: `Seeded post-trade review screenshot for ${tradeLabel}.`,
        isEntryScreenshot: false,
        isExitScreenshot: index % 3 === 0,
        isAnalysis: true,
        sortOrder: 1,
        createdAt: new Date(closeTime.getTime() - 2 * 60 * 1000),
      }
    );

    noteRows.push({
      id: crypto.randomUUID(),
      tradeId: row.id,
      userId,
      content: [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: noteText,
        },
      ],
      htmlContent: `<p>${noteText}</p>`,
      plainTextContent: noteText,
      wordCount: noteText.split(/\s+/).filter(Boolean).length,
      createdAt: new Date(closeTime.getTime() - 90 * 1000),
      updatedAt: new Date(closeTime.getTime() - 90 * 1000),
    });

    annotationRows.push({
      id: crypto.randomUUID(),
      tradeId: row.id,
      userId,
      content:
        pnl >= 0
          ? `${session} ${model} execution stayed within plan and paid as expected.`
          : `${session} trade slipped away after entry. Qualification needs to be tighter next time.`,
      annotationType:
        pnl >= 0
          ? "execution_note"
          : index % 2 === 0
          ? "rule_note"
          : "learning_note",
      isPublic: index < 6 && pnl >= 0,
      createdAt: new Date(closeTime.getTime() - 60 * 1000),
      editableUntil: new Date(closeTime.getTime() + 4 * 60 * 1000),
      editedAt: null,
    });
  });

  if (mediaRows.length > 0) {
    for (let i = 0; i < mediaRows.length; i += 25) {
      await db.insert(tradeMedia).values(mediaRows.slice(i, i + 25));
    }
  }

  if (noteRows.length > 0) {
    for (let i = 0; i < noteRows.length; i += 25) {
      await db.insert(tradeNote).values(noteRows.slice(i, i + 25));
    }
  }

  if (annotationRows.length > 0) {
    for (let i = 0; i < annotationRows.length; i += 25) {
      await db.insert(tradeAnnotation).values(annotationRows.slice(i, i + 25));
    }
  }

  const alignedTradeCount = closedTrades.filter(
    (row) => row.protocolAlignment === "aligned"
  ).length;
  const totalLosses = closedTrades.filter(
    (row) => Number(row.profit || 0) < 0
  ).length;
  const sortedClosedTrades = [...closedTrades].sort(
    (a, b) => (a.closeTime as Date).getTime() - (b.closeTime as Date).getTime()
  );
  let properBreaks = 0;
  for (let i = 0; i < sortedClosedTrades.length - 1; i++) {
    if (Number(sortedClosedTrades[i].profit || 0) >= 0) continue;
    const gapMinutes =
      ((sortedClosedTrades[i + 1].openTime as Date).getTime() -
        (sortedClosedTrades[i].closeTime as Date).getTime()) /
      60000;
    if (gapMinutes >= 15) properBreaks++;
  }

  const checklistCompletionRate =
    checklistRows.length > 0
      ? checklistRows.reduce(
          (sum, row) => sum + Number(row.completionRate || 0),
          0
        ) / checklistRows.length
      : 0;
  const journalRate = (reviewTradeIds.length / closedTrades.length) * 100;
  const ruleCompliance = (alignedTradeCount / closedTrades.length) * 100;
  const edgeTradeRate = 100;
  const breakAfterLoss =
    totalLosses > 0 ? (properBreaks / totalLosses) * 100 : 100;
  const winRate =
    (closedTrades.filter((row) => Number(row.profit || 0) > 0).length /
      closedTrades.length) *
    100;
  const totalProfit = closedTrades.reduce(
    (sum, row) => sum + Number(row.profit || 0),
    0
  );
  const averageRR =
    closedTrades.reduce((sum, row) => sum + Number(row.realisedRR || 0), 0) /
    closedTrades.length;

  const tradeDayKeys = [...closedTradesByDay.keys()].sort();
  const fallbackGoalDay =
    closedTrades.at(-1)?.closeTime instanceof Date
      ? formatDay(closedTrades.at(-1)!.closeTime as Date)
      : formatDay(previousTradingDay(nowDate));
  const latestTradeDayKey = tradeDayKeys.at(-1) ?? fallbackGoalDay;
  const latestTradeDayIndex = Math.max(tradeDayKeys.length - 1, 0);
  const getTradeDayKeyAt = (ratio: number) =>
    tradeDayKeys[
      Math.max(
        0,
        Math.min(
          latestTradeDayIndex,
          Math.floor(latestTradeDayIndex * clampNumber(ratio, 0, 1))
        )
      )
    ] ?? latestTradeDayKey;
  const getTradeDayKeyWithOffset = (startKey: string, offset: number) => {
    const startIndex = Math.max(0, tradeDayKeys.indexOf(startKey));
    return (
      tradeDayKeys[
        Math.max(
          0,
          Math.min(latestTradeDayIndex, startIndex + Math.max(0, offset))
        )
      ] ?? latestTradeDayKey
    );
  };
  const buildGoalWindow = ({
    startRatio,
    spanTradingDays,
    currentValue,
    targetValue,
    progressLabel,
    startValue = 0,
  }: {
    startRatio: number;
    spanTradingDays: number;
    currentValue: number;
    targetValue: number;
    progressLabel: string;
    startValue?: number;
  }) => {
    const startDate = getTradeDayKeyAt(startRatio);
    const deadline = getTradeDayKeyWithOffset(startDate, spanTradingDays);
    const deadlineIndex = Math.max(0, tradeDayKeys.indexOf(deadline));
    const status =
      latestTradeDayIndex > deadlineIndex
        ? currentValue >= targetValue
          ? "achieved"
          : "failed"
        : "active";
    const progressDate = status === "active" ? latestTradeDayKey : deadline;
    const startIndex = Math.max(0, tradeDayKeys.indexOf(startDate));
    const progressIndex = Math.max(startIndex, tradeDayKeys.indexOf(progressDate));
    const midpointDate = getTradeDayKeyWithOffset(
      startDate,
      Math.max(1, Math.floor((progressIndex - startIndex) / 2))
    );
    const midpointValue = roundTo(
      startValue + (currentValue - startValue) * 0.55,
      2
    );
    const progressHistory = [
      { label: "start", value: roundTo(startValue, 2), at: startDate },
      { label: "checkpoint", value: midpointValue, at: midpointDate },
      {
        label: progressLabel,
        value: roundTo(currentValue, 2),
        at: progressDate,
      },
    ].filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.at === entry.at) === index
    );

    return {
      startDate,
      deadline,
      status,
      completedAt:
        status === "active" ? null : new Date(`${deadline}T18:00:00.000Z`),
      progressHistory,
    } as const;
  };

  const monthlyProfitWindow = buildGoalWindow({
    startRatio: 0.16,
    spanTradingDays: 22,
    currentValue: totalProfit,
    targetValue: 3500,
    progressLabel: "profit",
    startValue: 0,
  });
  const weeklyJournalWindow = buildGoalWindow({
    startRatio: 0.93,
    spanTradingDays: 5,
    currentValue: journalRate,
    targetValue: 60,
    progressLabel: "journaled",
    startValue: Math.max(0, journalRate - 18),
  });
  const weeklyRuleWindow = buildGoalWindow({
    startRatio: 0.58,
    spanTradingDays: 5,
    currentValue: ruleCompliance,
    targetValue: 75,
    progressLabel: "compliance",
    startValue: Math.max(0, ruleCompliance - 16),
  });
  const weeklyChecklistWindow = buildGoalWindow({
    startRatio: 0.74,
    spanTradingDays: 5,
    currentValue: checklistCompletionRate,
    targetValue: 85,
    progressLabel: "checklist",
    startValue: Math.max(0, checklistCompletionRate - 14),
  });
  const weeklyBreakWindow = buildGoalWindow({
    startRatio: 0.97,
    spanTradingDays: 5,
    currentValue: breakAfterLoss,
    targetValue: 80,
    progressLabel: "post-loss pause",
    startValue: Math.max(0, breakAfterLoss - 25),
  });
  const monthlyWinRateWindow = buildGoalWindow({
    startRatio: 0.36,
    spanTradingDays: 22,
    currentValue: winRate,
    targetValue: 55,
    progressLabel: "win-rate",
    startValue: Math.max(0, winRate - 7),
  });
  const monthlyRRWindow = buildGoalWindow({
    startRatio: 0.82,
    spanTradingDays: 22,
    currentValue: averageRR,
    targetValue: 1.5,
    progressLabel: "avg-r",
    startValue: Math.max(0.6, averageRR - 0.35),
  });

  const goals: (typeof goalTable.$inferInsert)[] = [
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "profit",
      targetValue: "3500",
      currentValue: totalProfit.toFixed(2),
      startDate: monthlyProfitWindow.startDate,
      deadline: monthlyProfitWindow.deadline,
      status: monthlyProfitWindow.status,
      title: "Build a $3.5k month without stretching risk",
      description: "Demo target seeded to exercise the outcome-goal dashboard.",
      achievements: ["Process first", "No oversized recovery trades"],
      progressHistory: monthlyProfitWindow.progressHistory,
      isCustom: false,
      completedAt: monthlyProfitWindow.completedAt,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "weekly",
      targetType: "journalRate",
      targetValue: "60",
      currentValue: journalRate.toFixed(2),
      startDate: weeklyJournalWindow.startDate,
      deadline: weeklyJournalWindow.deadline,
      status: weeklyJournalWindow.status,
      title: "Review at least 60% of trades this week",
      description: "Close the reflection gap between execution and review.",
      progressHistory: weeklyJournalWindow.progressHistory,
      isCustom: false,
      completedAt: weeklyJournalWindow.completedAt,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "weekly",
      targetType: "ruleCompliance",
      targetValue: "75",
      currentValue: ruleCompliance.toFixed(2),
      startDate: weeklyRuleWindow.startDate,
      deadline: weeklyRuleWindow.deadline,
      status: weeklyRuleWindow.status,
      title: "Keep rule compliance above 75%",
      description: "Use the process scorecard to tighten discipline.",
      progressHistory: weeklyRuleWindow.progressHistory,
      isCustom: false,
      completedAt: weeklyRuleWindow.completedAt,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "weekly",
      targetType: "checklistCompletion",
      targetValue: "85",
      currentValue: checklistCompletionRate.toFixed(2),
      startDate: weeklyChecklistWindow.startDate,
      deadline: weeklyChecklistWindow.deadline,
      status: weeklyChecklistWindow.status,
      title: "Complete 85% of pre-trade checklist items",
      description: "Make execution deliberate before the click.",
      progressHistory: weeklyChecklistWindow.progressHistory,
      isCustom: false,
      completedAt: weeklyChecklistWindow.completedAt,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "weekly",
      targetType: "breakAfterLoss",
      targetValue: "80",
      currentValue: breakAfterLoss.toFixed(2),
      startDate: weeklyBreakWindow.startDate,
      deadline: weeklyBreakWindow.deadline,
      status: weeklyBreakWindow.status,
      title: "Pause properly after losses",
      description: "Protect the next trade from emotional carryover.",
      progressHistory: weeklyBreakWindow.progressHistory,
      isCustom: false,
      completedAt: weeklyBreakWindow.completedAt,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "winRate",
      targetValue: "55",
      currentValue: winRate.toFixed(2),
      startDate: monthlyWinRateWindow.startDate,
      deadline: monthlyWinRateWindow.deadline,
      status: monthlyWinRateWindow.status,
      title: "Hold win rate above 55%",
      description:
        "Use this as a stability checkpoint, not a reason to force trades.",
      progressHistory: monthlyWinRateWindow.progressHistory,
      isCustom: false,
      completedAt: monthlyWinRateWindow.completedAt,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "rr",
      targetValue: "1.50",
      currentValue: averageRR.toFixed(2),
      startDate: monthlyRRWindow.startDate,
      deadline: monthlyRRWindow.deadline,
      status: monthlyRRWindow.status,
      title: "Keep average R above 1.5",
      description:
        "Measure whether the model and exits still support positive asymmetry.",
      progressHistory: monthlyRRWindow.progressHistory,
      isCustom: false,
      completedAt: monthlyRRWindow.completedAt,
    },
  ];

  await db.insert(goalTable).values(goals);

  const alertRules: (typeof performanceAlertRule.$inferInsert)[] = [
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Daily loss warning",
      ruleType: "daily_loss",
      thresholdValue: "3",
      thresholdUnit: "percent",
      alertSeverity: "warning",
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 120,
      lastTriggeredAt: new Date(now - 6 * 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Loss streak breaker",
      ruleType: "loss_streak",
      thresholdValue: "3",
      thresholdUnit: "count",
      alertSeverity: "critical",
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 240,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Consecutive green days",
      ruleType: "consecutive_green",
      thresholdValue: "3",
      thresholdUnit: "count",
      alertSeverity: "info",
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 720,
    },
  ];

  await db.insert(performanceAlertRule).values(alertRules);

  await db.insert(performanceAlert).values([
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      ruleId: alertRules[0].id,
      alertType: "daily_loss",
      severity: "warning",
      title: "Daily loss getting tight",
      message:
        "The demo account hit 2.4% drawdown intraday. Reduce size before the next push.",
      currentValue: "2.4",
      thresholdValue: "3",
      acknowledged: false,
      metadata: { source: "demo-seed", session: "New York" },
      createdAt: new Date(now - 5 * 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      ruleId: alertRules[1].id,
      alertType: "loss_streak",
      severity: "critical",
      title: "Three-loss cluster detected",
      message:
        "Losses stacked without enough cooldown. Treat the next session as execution rehab, not recovery.",
      currentValue: "3",
      thresholdValue: "3",
      acknowledged: false,
      metadata: {
        source: "demo-seed",
        reviewPath: "/dashboard/journal?entryType=trade_review",
      },
      createdAt: new Date(now - 26 * 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      ruleId: alertRules[2].id,
      alertType: "consecutive_green",
      severity: "info",
      title: "Consistency streak",
      message:
        "Three positive days in a row. Maintain process instead of pressing for size.",
      currentValue: "3",
      thresholdValue: "3",
      acknowledged: true,
      metadata: { source: "demo-seed" },
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
    },
  ]);

  const makeBacktestTrades = (
    sessionId: string,
    symbol: "EURUSD" | "XAUUSD",
    basePrice: number,
    timeframeMinutes: number,
    tradeTotal: number,
    startingBalance: number,
    startAt: Date
  ) => {
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const isGold = symbol === "XAUUSD";
    const rows: (typeof backtestTrade.$inferInsert)[] = [];
    let balance = startingBalance;
    let wins = 0;
    let losses = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let peakBalance = startingBalance;
    let maxDrawdown = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let holdSecondsTotal = 0;
    const pnlSeries: number[] = [];

    for (let i = 0; i < tradeTotal; i++) {
      const direction = Math.random() > 0.45 ? "long" : "short";
      const directionFactor = direction === "long" ? 1 : -1;
      const entryTime = new Date(
        startAt.getTime() + i * timeframeMinutes * 18 * 60 * 1000
      );
      const entryPrice =
        basePrice + (Math.random() - 0.5) * pipSize * (isGold ? 120 : 80);
      const slPips = roundTo(
        isGold ? 35 + Math.random() * 45 : 10 + Math.random() * 16,
        1
      );
      const tpPips = roundTo(slPips * (1.4 + Math.random() * 1.4), 1);
      const volume = roundTo(
        isGold ? 0.2 + Math.random() * 0.4 : 0.2 + Math.random() * 0.8,
        2
      );
      const mfePips = roundTo(tpPips * (0.5 + Math.random() * 0.7), 1);
      const maePips = roundTo(slPips * (0.2 + Math.random() * 0.6), 1);
      const resultSeed = Math.random();
      const realizedRR =
        resultSeed < 0.56
          ? roundTo(0.9 + Math.random() * 1.8, 2)
          : -roundTo(0.35 + Math.random() * 0.65, 2);
      const pnlPips = roundTo(slPips * realizedRR, 1);
      const exitPrice = entryPrice + directionFactor * pnlPips * pipSize;
      const holdTimeSeconds = 8 * 60 + Math.floor(Math.random() * 90 * 60);
      const exitTime = new Date(entryTime.getTime() + holdTimeSeconds * 1000);
      const pnl = roundTo(pnlPips * volume * pipValue, 2);
      const pnlPercent = roundTo((pnl / balance) * 100, 2);
      const isWin = pnl > 0;

      rows.push({
        id: crypto.randomUUID(),
        sessionId,
        direction,
        entryPrice: formatPrice(symbol, entryPrice),
        entryTime,
        entryTimeUnix: Math.floor(entryTime.getTime() / 1000),
        entryBalance: balance.toFixed(2),
        exitPrice: formatPrice(symbol, exitPrice),
        exitTime,
        exitTimeUnix: Math.floor(exitTime.getTime() / 1000),
        exitType: isWin ? "tp" : "sl",
        sl: formatPrice(
          symbol,
          entryPrice - directionFactor * slPips * pipSize
        ),
        tp: formatPrice(
          symbol,
          entryPrice + directionFactor * tpPips * pipSize
        ),
        slPips: slPips.toFixed(1),
        tpPips: tpPips.toFixed(1),
        riskPercent: "1.00",
        volume: volume.toFixed(2),
        pipValue: pipValue.toFixed(2),
        status: "closed",
        pnl: pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2),
        pnlPips: pnlPips.toFixed(1),
        realizedRR: realizedRR.toFixed(2),
        mfePips: mfePips.toFixed(1),
        maePips: maePips.toFixed(1),
        holdTimeSeconds,
        notes: isWin
          ? "Held the winner without cutting it early."
          : "Entry was valid but execution deteriorated after the first adverse push.",
        tags: [
          symbol,
          direction,
          isWin ? "A-setup" : "execution-review",
          i % 3 === 0 ? "London" : "New York",
        ],
        entryIndicatorValues: {
          rsi: roundTo(38 + Math.random() * 28, 2),
          macd: roundTo((Math.random() - 0.5) * 1.8, 3),
          macdSignal: roundTo((Math.random() - 0.5) * 1.4, 3),
          atr: roundTo(
            isGold ? 8 + Math.random() * 6 : 0.0008 + Math.random() * 0.0012,
            isGold ? 2 : 5
          ),
          ema1: roundTo(
            entryPrice + (Math.random() - 0.5) * pipSize * 24,
            isGold ? 2 : symbol === "USDJPY" ? 3 : 5
          ),
        },
        createdAt: exitTime,
      });

      balance = roundTo(balance + pnl, 2);
      peakBalance = Math.max(peakBalance, balance);
      maxDrawdown = Math.max(maxDrawdown, roundTo(peakBalance - balance, 2));
      pnlSeries.push(pnl);
      holdSecondsTotal += holdTimeSeconds;

      if (isWin) {
        wins++;
        grossProfit += pnl;
        currentWinStreak++;
        currentLossStreak = 0;
      } else {
        losses++;
        grossLoss += Math.abs(pnl);
        currentLossStreak++;
        currentWinStreak = 0;
      }
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    }

    const finalBalance = balance;
    const totalPnL = roundTo(finalBalance - startingBalance, 2);
    const totalPnLPercent = roundTo((totalPnL / startingBalance) * 100, 2);
    const winRate = tradeTotal > 0 ? roundTo((wins / tradeTotal) * 100, 2) : 0;
    const profitFactor =
      grossLoss > 0 ? roundTo(grossProfit / grossLoss, 2) : null;
    const maxDrawdownPercent =
      peakBalance > 0 ? roundTo((maxDrawdown / peakBalance) * 100, 2) : 0;
    const averageRR =
      rows.reduce((sum, row) => sum + Number(row.realizedRR || 0), 0) /
      rows.length;
    const averageWin = wins > 0 ? roundTo(grossProfit / wins, 2) : 0;
    const averageLoss = losses > 0 ? roundTo(grossLoss / losses, 2) : 0;
    const largestWin = roundTo(Math.max(...pnlSeries), 2);
    const largestLoss = roundTo(Math.min(...pnlSeries), 2);
    const mean =
      pnlSeries.reduce((sum, value) => sum + value, 0) / pnlSeries.length;
    const variance =
      pnlSeries.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(pnlSeries.length, 1);
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? roundTo(mean / stdDev, 2) : null;

    return {
      trades: rows,
      summary: {
        finalBalance,
        totalPnL,
        totalPnLPercent,
        totalTrades: tradeTotal,
        winningTrades: wins,
        losingTrades: losses,
        winRate,
        profitFactor,
        maxDrawdown,
        maxDrawdownPercent,
        sharpeRatio,
        averageRR: roundTo(averageRR, 2),
        averageWin,
        averageLoss,
        largestWin,
        largestLoss,
        longestWinStreak,
        longestLoseStreak: longestLossStreak,
        averageHoldTimeSeconds: Math.round(holdSecondsTotal / rows.length),
      },
    };
  };

  const backtestSeeds = [
    {
      id: crypto.randomUUID(),
      name: "London Momentum Drill",
      description: "Replay focused on structured London continuation entries.",
      symbol: "EURUSD" as const,
      timeframe: "m5" as const,
      initialBalance: 10000,
      startDate: new Date(now - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(now - 52 * 24 * 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      name: "XAUUSD Reversal Replay",
      description:
        "Completed gold replay with tagged execution notes and mixed conditions.",
      symbol: "XAUUSD" as const,
      timeframe: "m15" as const,
      initialBalance: 15000,
      startDate: new Date(now - 34 * 24 * 60 * 60 * 1000),
      endDate: new Date(now - 28 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const [index, seed] of backtestSeeds.entries()) {
    const generated = makeBacktestTrades(
      seed.id,
      seed.symbol,
      basePrices[seed.symbol],
      seed.timeframe === "m5" ? 5 : 15,
      index === 0 ? 26 : 18,
      seed.initialBalance,
      seed.startDate
    );

    await db.insert(backtestSession).values({
      id: seed.id,
      userId,
      name: seed.name,
      description: seed.description,
      status: "completed",
      symbol: seed.symbol,
      timeframe: seed.timeframe,
      startDate: seed.startDate,
      endDate: seed.endDate,
      initialBalance: seed.initialBalance.toFixed(2),
      currency: "USD",
      riskPercent: "1.00",
      defaultSLPips: seed.symbol === "XAUUSD" ? 60 : 20,
      defaultTPPips: seed.symbol === "XAUUSD" ? 120 : 40,
      finalBalance: generated.summary.finalBalance.toFixed(2),
      finalEquity: generated.summary.finalBalance.toFixed(2),
      totalPnL: generated.summary.totalPnL.toFixed(2),
      totalPnLPercent: generated.summary.totalPnLPercent.toFixed(2),
      totalTrades: generated.summary.totalTrades,
      winningTrades: generated.summary.winningTrades,
      losingTrades: generated.summary.losingTrades,
      winRate: generated.summary.winRate.toFixed(2),
      profitFactor:
        generated.summary.profitFactor != null
          ? generated.summary.profitFactor.toFixed(2)
          : null,
      maxDrawdown: generated.summary.maxDrawdown.toFixed(2),
      maxDrawdownPercent: generated.summary.maxDrawdownPercent.toFixed(2),
      sharpeRatio:
        generated.summary.sharpeRatio != null
          ? generated.summary.sharpeRatio.toFixed(2)
          : null,
      averageRR: generated.summary.averageRR.toFixed(2),
      averageWin: generated.summary.averageWin.toFixed(2),
      averageLoss: generated.summary.averageLoss.toFixed(2),
      largestWin: generated.summary.largestWin.toFixed(2),
      largestLoss: generated.summary.largestLoss.toFixed(2),
      longestWinStreak: generated.summary.longestWinStreak,
      longestLoseStreak: generated.summary.longestLoseStreak,
      averageHoldTimeSeconds: generated.summary.averageHoldTimeSeconds,
      indicatorConfig: {
        ema1: { enabled: true, period: 20, color: "#14B8A6" },
        sma1: { enabled: true, period: 50, color: "#F59E0B" },
        rsi: { enabled: true, period: 14 },
        atr: { enabled: true, period: 14 },
      },
      lastCandleIndex: generated.summary.totalTrades * 12,
      playbackSpeed: "4",
      dataSource: "simulated",
      completedAt: new Date(seed.endDate.getTime() + 3 * 60 * 60 * 1000),
    });

    for (let i = 0; i < generated.trades.length; i += 25) {
      await db.insert(backtestTrade).values(generated.trades.slice(i, i + 25));
    }
  }

  const aggregateProfitBy = (
    key: "symbol" | "sessionTag" | "modelTag" | "protocolAlignment"
  ) => {
    const totals = new Map<
      string,
      { totalProfit: number; trades: number; wins: number }
    >();

    for (const row of closedTrades) {
      const label = row[key];
      if (!label) continue;

      const current = totals.get(label) || {
        totalProfit: 0,
        trades: 0,
        wins: 0,
      };
      const profit = Number(row.profit || 0);
      current.totalProfit += profit;
      current.trades += 1;
      if (profit > 0) current.wins += 1;
      totals.set(label, current);
    }

    return [...totals.entries()]
      .map(([label, stats]) => ({
        label,
        totalProfit: roundTo(stats.totalProfit, 2),
        trades: stats.trades,
        winRate:
          stats.trades > 0 ? roundTo((stats.wins / stats.trades) * 100, 1) : 0,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);
  };

  const symbolLeaders = aggregateProfitBy("symbol");
  const sessionLeaders = aggregateProfitBy("sessionTag");
  const modelLeaders = aggregateProfitBy("modelTag");
  const protocolLeaders = aggregateProfitBy("protocolAlignment");

  const bestSymbol = symbolLeaders[0];
  const weakestSymbol = symbolLeaders.at(-1);
  const bestSession = sessionLeaders[0];
  const weakestSession = sessionLeaders.at(-1);
  const bestModel = modelLeaders[0];
  const weakestProtocol =
    protocolLeaders.find((row) => row.label !== "aligned") ||
    protocolLeaders.at(-1);

  const seededWeeklyDigest: typeof traderDigest.$inferInsert = {
    id: crypto.randomUUID(),
    accountId,
    userId,
    digestType: "weekly",
    content: {
      review: {
        tradesToday: closedTrades.length,
        winRate,
        pnl: totalProfit,
        bestTrade: bestSymbol
          ? `${bestSymbol.label} led with $${bestSymbol.totalProfit.toFixed(2)}`
          : undefined,
        worstTrade: weakestSymbol
          ? `${
              weakestSymbol.label
            } dragged with $${weakestSymbol.totalProfit.toFixed(2)}`
          : undefined,
        edgeMatches: alignedTradeCount,
        leakMatches: totalLosses,
      },
      progress: {
        weeklyWinRate: winRate,
        weeklyPnL: totalProfit,
        vs30DayAvgWR: roundTo(winRate - 52, 1),
        vs30DayAvgPnL: roundTo(totalProfit - 2100, 2),
        trend: totalProfit >= 0 ? "improving" : "declining",
      },
      focusItem: weakestProtocol
        ? {
            title: `Tighten ${weakestProtocol.label} execution`,
            message: `${weakestProtocol.label} trades are underperforming. Bring them back to rule-aligned size and session quality.`,
            type: weakestProtocol.label === "aligned" ? "edge" : "rule",
          }
        : {
            title: "Protect the edge",
            message:
              "Keep leaning into the conditions that are already paying you.",
            type: "edge",
          },
      narrative: [
        `Weekly checkpoint: ${
          closedTrades.length
        } seeded trades, ${winRate.toFixed(
          1
        )}% win rate, and $${totalProfit.toFixed(2)} total P&L.`,
        bestSession
          ? `${
              bestSession.label
            } is the cleanest session so far at ${bestSession.winRate.toFixed(
              1
            )}% win rate across ${bestSession.trades} trades.`
          : "No clear session edge yet.",
        weakestSession
          ? `${weakestSession.label} needs review before you size it up again.`
          : "Session quality is holding up.",
      ].join(" "),
    },
    createdAt: new Date(now - 12 * 60 * 60 * 1000),
  };

  await db.insert(traderDigest).values(seededWeeklyDigest);

  const morningDigest = await generateMorningBriefing(accountId, userId);
  if (morningDigest) {
    await db.insert(traderDigest).values({
      ...morningDigest,
      id: crypto.randomUUID(),
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    });
  }

  const lastClosedTradeId = closedTrades.at(-1)?.id;
  if (lastClosedTradeId) {
    const tradeFeedbackDigest = await generateTradeFeedback(
      accountId,
      userId,
      lastClosedTradeId
    );
    if (tradeFeedbackDigest) {
      await db.insert(traderDigest).values({
        ...tradeFeedbackDigest,
        id: crypto.randomUUID(),
        createdAt: new Date(now - 35 * 60 * 1000),
      });
    }
  }

  const seededReports = [
    {
      id: crypto.randomUUID(),
      title: "Find my edge right now",
      description: DEMO_REPORT_DESCRIPTION,
      createdAt: new Date(now - 20 * 60 * 60 * 1000),
      updatedAt: new Date(now - 19 * 60 * 60 * 1000),
      intent: "edge_analysis",
      prompt:
        "What is my edge right now, and where should I focus if I want to press only on quality?",
      response: [
        bestSession
          ? `${
              bestSession.label
            } is your cleanest session so far with ${bestSession.winRate.toFixed(
              1
            )}% wins across ${bestSession.trades} trades.`
          : "Session quality is still mixed.",
        bestSymbol
          ? `${
              bestSymbol.label
            } is your best symbol at $${bestSymbol.totalProfit.toFixed(
              2
            )} total profit.`
          : "There is no standout symbol yet.",
        bestModel
          ? `${bestModel.label} is the strongest model in the sample, so it deserves first look when conditions line up.`
          : "Model quality is still clustering too tightly to rank cleanly.",
      ].join(" "),
      actionTitle: "Rank edge conditions",
      actionResult: {
        bestSession,
        bestSymbol,
        bestModel,
      },
    },
    {
      id: crypto.randomUUID(),
      title: "Leak review",
      description: DEMO_REPORT_DESCRIPTION,
      createdAt: new Date(now - 8 * 60 * 60 * 1000),
      updatedAt: new Date(now - 7 * 60 * 60 * 1000),
      intent: "leak_analysis",
      prompt: "Where am I leaking money, and what should I cut first?",
      response: [
        weakestSymbol
          ? `${
              weakestSymbol.label
            } is the first asset to review because it is dragging the sample at $${weakestSymbol.totalProfit.toFixed(
              2
            )}.`
          : "No single asset leak stands out yet.",
        weakestSession
          ? `${weakestSession.label} is the weakest session by P&L, so reduce size there until the execution quality improves.`
          : "Session leakage is not isolated to one block yet.",
        weakestProtocol
          ? `${weakestProtocol.label} trades are the discipline leak to remove first.`
          : "Discipline leakage is not yet clear enough to isolate.",
      ].join(" "),
      actionTitle: "Map money leaks",
      actionResult: {
        weakestSymbol,
        weakestSession,
        weakestProtocol,
      },
    },
  ] as const;

  for (const reportSeed of seededReports) {
    await db.insert(aiReport).values({
      id: reportSeed.id,
      userId,
      accountId,
      title: reportSeed.title,
      description: reportSeed.description,
      createdAt: reportSeed.createdAt,
      updatedAt: reportSeed.updatedAt,
    });

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();

    await db.insert(aiChatMessage).values([
      {
        id: userMessageId,
        reportId: reportSeed.id,
        role: "user",
        content: reportSeed.prompt,
        intent: reportSeed.intent,
        confidence: "0.99",
        status: "completed",
        createdAt: reportSeed.createdAt,
      },
      {
        id: assistantMessageId,
        reportId: reportSeed.id,
        role: "assistant",
        content: reportSeed.response,
        intent: reportSeed.intent,
        confidence: "0.99",
        data: {
          seeded: true,
          summary: reportSeed.actionResult,
        },
        status: "completed",
        createdAt: reportSeed.updatedAt,
      },
    ]);

    await db.insert(aiActionLog).values({
      id: crypto.randomUUID(),
      userId,
      messageId: assistantMessageId,
      title: reportSeed.actionTitle,
      intent: reportSeed.intent,
      userMessage: reportSeed.prompt,
      status: "completed",
      result: reportSeed.actionResult,
      startedAt: reportSeed.createdAt,
      completedAt: reportSeed.updatedAt,
    });
  }

  return {
    account,
    tradeCount: closedTrades.length,
    openTradeCount: liveOpenTrades.length,
  };
}
