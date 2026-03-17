import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema/trading";
import { notification } from "../db/schema/notifications";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateFeedEventForTrade } from "../lib/feed-event-generator";
import {
  ALL_ACCOUNTS_ID,
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../lib/account-scope";
import {
  buildAutoPropAccountFields,
  syncAutoPropClassificationForUser,
} from "../lib/prop-firm-detection";
import { ensurePropChallengeLineageForAccount } from "../lib/prop-challenge-lineage";
import {
  getArchivedIdsProcedure,
  toggleArchiveProcedure,
} from "./accounts/archive-preferences";
import {
  getArchivedAccountIds,
  getUserWidgetPreferences,
  setArchivedAccountIds,
  updateUserWidgetPreferences,
} from "./accounts/shared";
import {
  generateTrackRecordProcedure,
  getTrackRecordProcedure,
} from "./accounts/track-record";
import { eaHealthProcedure, healthScoreProcedure } from "./accounts/health";
import { aggregatedStatsProcedure } from "./accounts/aggregated-stats";
import { seedSampleAccount } from "./accounts/demo-sample";
import {
  resetDemoWorkspaceForUser,
} from "./accounts/demo-workspace";
import {
  metricsProcedure,
  updateBrokerSettingsProcedure,
  liveMetricsProcedure,
  insightsProcedure,
  randomInsightProcedure,
  executionStatsProcedure,
  moneyLeftOnTableProcedure,
} from "./accounts/performance";
import {
  recentByDayProcedure,
  rangeSummaryProcedure,
  profitByAssetRangeProcedure,
  lossesByAssetRangeProcedure,
  profitByDayOverallProcedure,
  tradeCountsRangeProcedure,
  tradeCountsOverallProcedure,
  opensBoundsProcedure,
} from "./accounts/history-series";

function normalizeStringTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) return [];

  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 25)
    )
  );
}

export const accountsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1),
        broker: z.string().trim().min(1),
        brokerType: z
          .enum([
            "mt4",
            "mt5",
            "ctrader",
            "ib",
            "oanda",
            "tradovate",
            "topstepx",
            "rithmic",
            "ninjatrader",
            "other",
          ])
          .optional(),
        brokerServer: z.string().trim().min(1).optional(),
        accountNumber: z.string().trim().min(1).optional(),
        initialBalance: z.number().optional(),
        initialCurrency: z.string().optional(),
        tags: z.array(z.string().trim().min(1)).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const accountId = crypto.randomUUID();
      const brokerServer =
        input.brokerType === "mt4" || input.brokerType === "mt5"
          ? input.brokerServer ?? null
          : null;
      const { updates: autoPropFields } = await buildAutoPropAccountFields({
        broker: input.broker,
        brokerServer,
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
          brokerServer,
          accountNumber: input.accountNumber || null,
          initialBalance: input.initialBalance?.toString() || null,
          initialCurrency: input.initialCurrency || null,
          tags: normalizeStringTags(input.tags),
          ...autoPropFields,
        })
        .returning();

      if (account?.isPropAccount) {
        await ensurePropChallengeLineageForAccount(account.id);
      }

      return account;
    }),
  updateTags: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        tags: z.array(z.string().trim().min(1)).max(25),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const normalizedTags = normalizeStringTags(input.tags);

      const [account] = await db
        .update(tradingAccount)
        .set({
          tags: normalizedTags,
        })
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, ctx.session.user.id)
          )
        )
        .returning({
          id: tradingAccount.id,
          tags: tradingAccount.tags,
        });

      if (!account) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      return account;
    }),
  listTags: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ tags: tradingAccount.tags })
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, ctx.session.user.id));

    return Array.from(
      new Set(
        rows.flatMap((row) =>
          Array.isArray(row.tags)
            ? row.tags.filter((tag): tag is string => typeof tag === "string")
            : []
        )
      )
    ).sort((left, right) => left.localeCompare(right));
  }),
  delete: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const [account] = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!account) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      const currentPreferences = await getUserWidgetPreferences(
        ctx.session.user.id
      );
      const nextArchivedIds = getArchivedAccountIds(currentPreferences).filter(
        (accountId) => accountId !== input.accountId
      );

      await Promise.all([
        db.delete(tradingAccount).where(eq(tradingAccount.id, input.accountId)),
        updateUserWidgetPreferences(
          ctx.session.user.id,
          setArchivedAccountIds(currentPreferences, nextArchivedIds)
        ),
      ]);

      return { success: true };
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await syncAutoPropClassificationForUser(userId);
    const rows = await db
      .select()
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId))
      .orderBy(desc(tradingAccount.createdAt));

    if (rows.length === 0) {
      return rows;
    }

    const accountIds = rows.map((row) => row.id);
    const importRows = await db
      .select({
        accountId: notification.accountId,
        lastImportedAt: sql<Date | null>`MAX(${notification.createdAt})`,
      })
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.type, "trade_imported"),
          inArray(notification.accountId, accountIds)
        )
      )
      .groupBy(notification.accountId);

    const lastImportedAtByAccountId = new Map(
      importRows
        .filter(
          (
            row
          ): row is {
            accountId: string;
            lastImportedAt: Date | null;
          } => Boolean(row.accountId)
        )
        .map((row) => [row.accountId, row.lastImportedAt ?? null])
    );

    const accountsNeedingDerivedBalance = rows.filter(
      (row) => row.liveBalance == null && row.initialBalance != null
    );

    let profitByAccountId = new Map<string, number>();
    if (accountsNeedingDerivedBalance.length > 0) {
      const profitRows = await db
        .select({
          accountId: trade.accountId,
          totalProfit:
            sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
        })
        .from(trade)
        .where(
          inArray(
            trade.accountId,
            accountsNeedingDerivedBalance.map((row) => row.id)
          )
        )
        .groupBy(trade.accountId);

      profitByAccountId = new Map(
        profitRows.map((row) => [row.accountId, Number(row.totalProfit ?? 0)])
      );
    }

    return rows.map((row) => {
      const lastImportedAt = lastImportedAtByAccountId.get(row.id) ?? null;

      if (row.liveBalance != null || row.initialBalance == null) {
        return {
          ...row,
          lastImportedAt,
        };
      }

      const derivedLiveBalance =
        Number(row.initialBalance) + (profitByAccountId.get(row.id) ?? 0);

      if (!Number.isFinite(derivedLiveBalance)) {
        return {
          ...row,
          lastImportedAt,
        };
      }

      return {
        ...row,
        lastImportedAt,
        liveBalance: derivedLiveBalance.toString(),
      };
    });
  }),
  metrics: metricsProcedure,
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
              symbol: trade.symbol,
              tradeType: trade.tradeType,
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
              brokerType: tradingAccount.brokerType,
            })
            .from(tradingAccount)
            .where(accountScope),
        ]);

        const totalProfit = Number(agg[0]?.totalProfit ?? 0);
        const grossProfit = Number(agg[0]?.grossProfit ?? 0);
        const grossLoss = Math.abs(Number(agg[0]?.grossLoss ?? 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
        const winsCount = Number(agg[0]?.wins ?? 0);
        const lossesCount = Number(agg[0]?.losses ?? 0);
        const breakevenCount = Number(agg[0]?.breakeven ?? 0);
        const totalTrades = winsCount + lossesCount + breakevenCount;
        const winrate = totalTrades > 0 ? (winsCount / totalTrades) * 100 : 0;

        const avgWin = winsCount > 0 ? grossProfit / winsCount : 0;
        const avgLossVal = lossesCount > 0 ? grossLoss / lossesCount : 0;
        const winPct = totalTrades > 0 ? winsCount / totalTrades : 0;
        const lossPct = totalTrades > 0 ? lossesCount / totalTrades : 0;
        const expectancy = winPct * avgWin - lossPct * avgLossVal;

        const holdSumSec = Number(agg[0]?.holdSumSec ?? 0);
        const holdCountSec = Number(agg[0]?.holdCountSec ?? 0);
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
          outcome: string | null;
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

        const recentTrades = recentSorted
          .filter((r) => getOutcomeMark(r) !== "B")
          .slice(0, 5)
          .map((r) => ({
            symbol: r.symbol ?? null,
            tradeType: r.tradeType ?? null,
            profit: r.profit,
            outcome: getOutcomeMark(r) as "W" | "L",
            closeTime: r.closeTime?.toISOString() ?? r.closeRaw ?? null,
          }));

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
            Number(agg[0]?.avgLossMagnitude ?? 0)
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
        const brokerType = acctRows.find((row) => row.isVerified === 1)?.brokerType ?? acctRows[0]?.brokerType ?? null;

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
          recentTrades,
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
          brokerType,
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

  recentByDay: recentByDayProcedure,
  rangeSummary: rangeSummaryProcedure,
  profitByAssetRange: profitByAssetRangeProcedure,
  lossesByAssetRange: lossesByAssetRangeProcedure,
  profitByDayOverall: profitByDayOverallProcedure,
  tradeCountsRange: tradeCountsRangeProcedure,
  tradeCountsOverall: tradeCountsOverallProcedure,
  opensBounds: opensBoundsProcedure,
  updateBrokerSettings: updateBrokerSettingsProcedure,
  liveMetrics: liveMetricsProcedure,
  insights: insightsProcedure,
  randomInsight: randomInsightProcedure,
  executionStats: executionStatsProcedure,
  moneyLeftOnTable: moneyLeftOnTableProcedure,

  // Multi-account aggregated stats
  aggregatedStats: aggregatedStatsProcedure,

  /**
   * Account Health Score
   * Composite score (0-100) based on key trading metrics
   */
  healthScore: healthScoreProcedure,

  /**
   * EA Health Dashboard
   * Check EA sync status, latency, and connection health across accounts
   */
  eaHealth: eaHealthProcedure,

  // Archive / Unarchive an account (stores in user widgetPreferences)
  toggleArchive: toggleArchiveProcedure,

  // Get archived account IDs
  getArchivedIds: getArchivedIdsProcedure,

  // ============== VERIFIED TRACK RECORD ==============

  generateTrackRecord: generateTrackRecordProcedure,

  getTrackRecord: getTrackRecordProcedure,

  // ============== SAMPLE / DEMO ACCOUNT ==============

  resetDemoWorkspace: protectedProcedure.mutation(async ({ ctx }) => {
    return resetDemoWorkspaceForUser(ctx.session.user.id, seedSampleAccount);
  }),

  createSampleAccount: protectedProcedure.mutation(async ({ ctx }) => {
    return seedSampleAccount(ctx.session.user.id);
  }),
});
