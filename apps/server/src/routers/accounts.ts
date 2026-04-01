import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema/trading";
import { notification } from "../db/schema/notifications";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateFeedEventForTrade } from "../lib/feed-event-generator";
import {
  convertCurrencyAmount,
  normalizeCurrencyCode,
} from "@profitabledge/contracts/currency";
import {
  ALL_ACCOUNTS_ID,
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../lib/account-scope";
import {
  buildAutoPropAccountFields,
  ensureRecentAutoPropClassificationForUser,
} from "../lib/prop-firm-detection";
import { ensurePropChallengeLineageForAccount } from "../lib/prop-challenge-lineage";
import { createNotification } from "../lib/notifications";
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
import {
  provisionDemoWorkspaceAccount,
  seedSampleAccount,
} from "./accounts/demo-sample";
import { resetDemoWorkspaceForUser } from "./accounts/demo-workspace";
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
            "dxtrade",
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

      const [accountCountRow] = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.userId, ctx.session.user.id));

      if (Number(accountCountRow?.count ?? 0) <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't delete your only account.",
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
    await ensureRecentAutoPropClassificationForUser(userId);
    const rows = await db
      .select()
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId))
      .orderBy(desc(tradingAccount.createdAt));

    if (rows.length === 0) {
      return rows;
    }

    const accountIds = rows.map((row) => row.id);
    const accountsNeedingDerivedBalance = rows.filter(
      (row) => row.liveBalance == null && row.initialBalance != null
    );
    const [importRows, profitRows] = await Promise.all([
      db
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
        .groupBy(notification.accountId),
      accountsNeedingDerivedBalance.length > 0
        ? db
            .select({
              accountId: trade.accountId,
              totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
            })
            .from(trade)
            .where(
              inArray(
                trade.accountId,
                accountsNeedingDerivedBalance.map((row) => row.id)
              )
            )
            .groupBy(trade.accountId)
        : Promise.resolve([]),
    ]);

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
    const profitByAccountId = new Map(
      profitRows.map((row) => [row.accountId, Number(row.totalProfit ?? 0)])
    );

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
    .input(
      z.object({
        accountId: z.string().min(1),
        currencyCode: z.string().trim().min(1).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const accountIds = await resolveScopedAccountIds(
          ctx.session.user.id,
          input.accountId
        );
        const targetCurrencyCode = normalizeCurrencyCode(input.currencyCode);

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
        const [aggRows, recentRows, acctRows] = await Promise.all([
          db
            .select({
              accountId: trade.accountId,
              totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
              grossProfit: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
              grossLossAbs: sql<number>`COALESCE(SUM(ABS(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END)), 0)`,
              wins: sql<number>`COUNT(CASE WHEN ${trade.outcome} IN ('Win', 'PW') OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) > 0) THEN 1 END)`,
              losses: sql<number>`COUNT(CASE WHEN ${trade.outcome} = 'Loss' OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) < 0) THEN 1 END)`,
              breakeven: sql<number>`COUNT(CASE WHEN ${trade.outcome} = 'BE' OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) = 0) THEN 1 END)`,
              holdSumSec: sql<number>`COALESCE(SUM(CAST(NULLIF(${trade.tradeDurationSeconds}, '') AS NUMERIC)), 0)`,
              holdCountSec: sql<number>`COALESCE(COUNT(NULLIF(${trade.tradeDurationSeconds}, '')), 0)`,
            })
            .from(trade)
            .where(tradeScope)
            .groupBy(trade.accountId),
          db
            .select({
              accountId: trade.accountId,
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
              id: tradingAccount.id,
              initialBalance: sql<
                string | null
              >`${tradingAccount.initialBalance}`,
              initialCurrency: tradingAccount.initialCurrency,
              isVerified: tradingAccount.isVerified,
              liveBalance: tradingAccount.liveBalance,
              liveEquity: tradingAccount.liveEquity,
              lastSyncedAt: tradingAccount.lastSyncedAt,
              brokerType: tradingAccount.brokerType,
            })
            .from(tradingAccount)
            .where(accountScope),
        ]);

        const accountCurrencyById = new Map(
          acctRows.map((row) => [
            row.id,
            normalizeCurrencyCode(row.initialCurrency),
          ])
        );

        const totalProfit = aggRows.reduce((sum, row) => {
          return (
            sum +
            convertCurrencyAmount(
              Number(row.totalProfit ?? 0),
              accountCurrencyById.get(row.accountId),
              targetCurrencyCode
            )
          );
        }, 0);
        const grossProfit = aggRows.reduce((sum, row) => {
          return (
            sum +
            convertCurrencyAmount(
              Number(row.grossProfit ?? 0),
              accountCurrencyById.get(row.accountId),
              targetCurrencyCode
            )
          );
        }, 0);
        const grossLoss = aggRows.reduce((sum, row) => {
          return (
            sum +
            Math.abs(
              convertCurrencyAmount(
                Number(row.grossLossAbs ?? 0),
                accountCurrencyById.get(row.accountId),
                targetCurrencyCode
              )
            )
          );
        }, 0);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
        const winsCount = aggRows.reduce(
          (sum, row) => sum + Number(row.wins ?? 0),
          0
        );
        const lossesCount = aggRows.reduce(
          (sum, row) => sum + Number(row.losses ?? 0),
          0
        );
        const breakevenCount = aggRows.reduce(
          (sum, row) => sum + Number(row.breakeven ?? 0),
          0
        );
        const totalTrades = winsCount + lossesCount + breakevenCount;
        const winrate = totalTrades > 0 ? (winsCount / totalTrades) * 100 : 0;

        const avgWin = winsCount > 0 ? grossProfit / winsCount : 0;
        const avgLossVal = lossesCount > 0 ? grossLoss / lossesCount : 0;
        const winPct = totalTrades > 0 ? winsCount / totalTrades : 0;
        const lossPct = totalTrades > 0 ? lossesCount / totalTrades : 0;
        const expectancy = winPct * avgWin - lossPct * avgLossVal;

        const holdSumSec = aggRows.reduce(
          (sum, row) => sum + Number(row.holdSumSec ?? 0),
          0
        );
        const holdCountSec = aggRows.reduce(
          (sum, row) => sum + Number(row.holdCountSec ?? 0),
          0
        );
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
            profit: convertCurrencyAmount(
              r.profit,
              accountCurrencyById.get(r.accountId),
              targetCurrencyCode
            ),
            outcome: getOutcomeMark(r) as "W" | "L",
            closeTime: r.closeTime?.toISOString() ?? r.closeRaw ?? null,
          }));

        let streak = 0;
        for (const r of recentSorted) {
          if (getOutcomeMark(r) === "W") streak += 1;
          else break;
        }
        const winStreak = streak;

        // Approximate average R multiple from normalized portfolio totals.
        let averageRMultiple: number | null = null;
        if (lossesCount > 0 && grossLoss > 0) {
          const avgLossMag = Math.max(1e-9, grossLoss / lossesCount);
          const expectancyPerTrade =
            totalTrades > 0 ? totalProfit / totalTrades : 0;
          averageRMultiple = expectancyPerTrade / avgLossMag;
        }

        const initialBalanceNum = acctRows.reduce((sum, row) => {
          return (
            sum +
            convertCurrencyAmount(
              row.initialBalance != null ? Number(row.initialBalance) : 0,
              row.initialCurrency,
              targetCurrencyCode
            )
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
        const liveEquity = hasFullFreshLiveCoverage
          ? freshAccounts.reduce(
              (sum, row) =>
                sum +
                convertCurrencyAmount(
                  Number(row.liveEquity || row.liveBalance || 0),
                  row.initialCurrency,
                  targetCurrencyCode
                ),
              0
            )
          : null;
        const convertedLiveBalance = hasFullFreshLiveCoverage
          ? freshAccounts.reduce(
              (sum, row) =>
                sum +
                convertCurrencyAmount(
                  Number(row.liveBalance || 0),
                  row.initialCurrency,
                  targetCurrencyCode
                ),
              0
            )
          : null;
        const accountBalance =
          hasFullFreshLiveCoverage && convertedLiveBalance != null
            ? convertedLiveBalance
            : initialBalanceNum + totalProfit;
        const isVerified = acctRows.some((row) => row.isVerified === 1);
        const isLiveDataFresh = hasFullFreshLiveCoverage;
        const brokerType =
          acctRows.find((row) => row.isVerified === 1)?.brokerType ??
          acctRows[0]?.brokerType ??
          null;

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
          liveBalance: convertedLiveBalance,
          liveEquity,
          lastSyncedAt: freshestSyncedAt?.toISOString() || null,
          isLiveDataFresh,
          brokerType,
          currencyCode: targetCurrencyCode ?? null,
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
    const result = (await resetDemoWorkspaceForUser(
      ctx.session.user.id,
      provisionDemoWorkspaceAccount
    )) as {
      account?: {
        id: string;
        name: string;
        broker: string;
        brokerType: string | null;
      };
      resetCount?: number;
    };

    if (result.account) {
      await createNotification({
        userId: ctx.session.user.id,
        accountId: result.account.id,
        type: "system_update",
        title: "Preparing demo workspace",
        body: `${result.account.name} is being refreshed in the background.`,
        metadata: {
          kind: "demo_workspace_generating",
          status: "processing",
          accountId: result.account.id,
          accountName: result.account.name,
          broker: result.account.broker,
          url: "/dashboard",
        },
      });
    }

    return {
      account: result.account,
      resetCount: result.resetCount,
      tradeCount: 0,
      openTradeCount: 0,
      isHydrating: true,
    };
  }),

  createSampleAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await provisionDemoWorkspaceAccount(ctx.session.user.id);

    if (result.account) {
      await createNotification({
        userId: ctx.session.user.id,
        accountId: result.account.id,
        type: "system_update",
        title: "Preparing demo workspace",
        body: `${result.account.name} is being prepared in the background.`,
        metadata: {
          kind: "demo_workspace_generating",
          status: "processing",
          accountId: result.account.id,
          accountName: result.account.name,
          broker: result.account.broker,
          url: "/dashboard",
        },
      });
    }

    return {
      ...result,
      tradeCount: 0,
      openTradeCount: 0,
      isHydrating: true,
    };
  }),

  hydrateDemoWorkspace: protectedProcedure
    .input(
      z.object({
        accountId: z.string().trim().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await db
        .select({
          name: tradingAccount.name,
          broker: tradingAccount.broker,
        })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      try {
        const hydrated = await seedSampleAccount(ctx.session.user.id, {
          accountId: input.accountId,
          provisionShell: false,
        });

        await createNotification({
          userId: ctx.session.user.id,
          accountId: input.accountId,
          type: "system_update",
          title: "Demo workspace ready",
          body: account?.name
            ? `${account.name} is ready with ${hydrated.tradeCount} trades and ${hydrated.openTradeCount} live positions.`
            : `Your demo workspace is ready with ${hydrated.tradeCount} trades and ${hydrated.openTradeCount} live positions.`,
          metadata: {
            kind: "demo_workspace_ready",
            accountId: input.accountId,
            accountName: account?.name ?? null,
            broker: account?.broker ?? null,
            tradeCount: hydrated.tradeCount,
            openTradeCount: hydrated.openTradeCount,
            url: "/dashboard",
          },
        });

        return hydrated;
      } catch (error) {
        await createNotification({
          userId: ctx.session.user.id,
          accountId: input.accountId,
          type: "system_update",
          title: "Demo workspace failed",
          body:
            error instanceof Error
              ? error.message
              : "Demo workspace generation failed.",
          metadata: {
            kind: "demo_workspace_failed",
            accountId: input.accountId,
            accountName: account?.name ?? null,
            broker: account?.broker ?? null,
            url: "/dashboard",
          },
        });

        throw error;
      }
    }),
});
