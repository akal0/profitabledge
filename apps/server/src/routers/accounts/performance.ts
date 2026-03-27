import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  convertCurrencyAmount,
  normalizeCurrencyCode,
} from "@profitabledge/contracts/currency";

import { db } from "../../db";
import { openTrade, trade, tradingAccount } from "../../db/schema/trading";
import {
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../../lib/account-scope";
import { cache, cacheKeys } from "../../lib/cache";
import {
  generateInsights as generateBrainInsights,
  saveInsights,
} from "../../lib/ai/engine";
import { computeExecutionGrade } from "../../lib/execution-grade";
import { createNotification } from "../../lib/notifications";
import {
  MAX_BREAKEVEN_THRESHOLD_PIPS,
  normalizeBreakevenThresholdPips,
  syncAccountTradeOutcomeSettings,
} from "../../lib/trades/trade-outcome";
import { protectedProcedure } from "../../lib/trpc";
import { invalidateTradeScopeCaches } from "../trades/shared";

export const metricsProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
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

    const result = await db
      .select({
        wins: sql<number>`COUNT(CASE WHEN ${trade.outcome} IN ('Win', 'PW') OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) > 0) THEN 1 END)`,
        losses: sql<number>`COUNT(CASE WHEN ${trade.outcome} = 'Loss' OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) < 0) THEN 1 END)`,
        breakeven: sql<number>`COUNT(CASE WHEN ${trade.outcome} = 'BE' OR (${trade.outcome} IS NULL AND CAST(${trade.profit} AS NUMERIC) = 0) THEN 1 END)`,
      })
      .from(trade)
      .where(buildAccountScopeCondition(trade.accountId, accountIds));

    const winsCount = result[0]?.wins ?? 0;
    const lossesCount = result[0]?.losses ?? 0;
    const breakevenCount = result[0]?.breakeven ?? 0;
    const total = winsCount + lossesCount + breakevenCount;
    return {
      wins: winsCount,
      losses: lossesCount,
      breakeven: breakevenCount,
      total,
      winrate: total > 0 ? (winsCount / total) * 100 : 0,
    };
  });

export const updateBrokerSettingsProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      brokerType: z.enum(["mt4", "mt5", "ctrader", "other"]).optional(),
      preferredDataSource: z
        .enum(["dukascopy", "alphavantage", "truefx", "broker"])
        .optional(),
      averageSpreadPips: z.number().min(0).max(100).optional(),
      breakevenThresholdPips: z
        .number()
        .min(0)
        .max(MAX_BREAKEVEN_THRESHOLD_PIPS)
        .optional(),
      initialBalance: z.number().min(0).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const account = await db
      .select({
        userId: tradingAccount.userId,
        name: tradingAccount.name,
        breakevenThresholdPips: tradingAccount.breakevenThresholdPips,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.id, input.accountId))
      .limit(1);

    if (account.length === 0) {
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

    const updates: Record<string, string | number | null> = {};
    if (input.brokerType !== undefined) updates.brokerType = input.brokerType;
    if (input.preferredDataSource !== undefined) {
      updates.preferredDataSource = input.preferredDataSource;
    }
    if (input.averageSpreadPips !== undefined) {
      updates.averageSpreadPips = input.averageSpreadPips.toString();
    }
    if (input.breakevenThresholdPips !== undefined) {
      updates.breakevenThresholdPips = normalizeBreakevenThresholdPips(
        input.breakevenThresholdPips
      ).toString();
    }
    if (input.initialBalance !== undefined) {
      updates.initialBalance = input.initialBalance.toString();
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(tradingAccount)
        .set(updates)
        .where(eq(tradingAccount.id, input.accountId));

      if (input.breakevenThresholdPips !== undefined) {
        const previousThreshold = normalizeBreakevenThresholdPips(
          account[0].breakevenThresholdPips
        );
        const nextThreshold = normalizeBreakevenThresholdPips(
          input.breakevenThresholdPips
        );

        if (previousThreshold !== nextThreshold) {
          await syncAccountTradeOutcomeSettings({
            accountId: input.accountId,
            breakevenThresholdPips: nextThreshold,
          });
          await invalidateTradeScopeCaches([input.accountId]);
        }
      }

      await createNotification({
        userId: ctx.session.user.id,
        accountId: input.accountId,
        type: "settings_updated",
        title: "Broker settings updated",
        body: `Updated broker settings for account ${
          account[0].name ?? input.accountId
        }.`,
        metadata: {
          accountId: input.accountId,
          updatedFields: Object.keys(updates),
        },
      });
    }

    return { success: true };
  });

export const liveMetricsProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      currencyCode: z.string().trim().min(1).optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const cacheKey = cacheKeys.liveMetrics(input.accountId);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const accountIds = await resolveScopedAccountIds(
      ctx.session.user.id,
      input.accountId
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
    const targetCurrencyCode = normalizeCurrencyCode(input.currencyCode);

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
        initialCurrency: tradingAccount.initialCurrency,
      })
      .from(tradingAccount)
      .where(accountScope);

    if (accounts.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Account not found",
      });
    }

    const openTrades = await db
      .select()
      .from(openTrade)
      .where(buildAccountScopeCondition(openTrade.accountId, accountIds))
      .orderBy(desc(openTrade.openTime));

    const accountCurrencyById = new Map(
      accounts.map((account) => [
        account.id,
        normalizeCurrencyCode(account.initialCurrency),
      ])
    );

    const totalFloatingPL = openTrades.reduce(
      (sum, openPosition) =>
        sum +
        convertCurrencyAmount(
          Number(openPosition.profit || 0) + Number(openPosition.swap || 0),
          accountCurrencyById.get(openPosition.accountId),
          targetCurrencyCode
        ),
      0
    );

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
          (sum, account) =>
            sum +
            convertCurrencyAmount(
              Number(account.liveBalance || 0),
              account.initialCurrency,
              targetCurrencyCode
            ),
          0
        )
      : null;
    const liveEquity = hasFullFreshCoverage
      ? freshAccounts.reduce(
          (sum, account) =>
            sum +
            convertCurrencyAmount(
              Number(account.liveEquity || account.liveBalance || 0),
              account.initialCurrency,
              targetCurrencyCode
            ),
          0
        )
      : null;
    const liveMargin = hasFullFreshCoverage
      ? freshAccounts.reduce(
          (sum, account) =>
            sum +
            convertCurrencyAmount(
              Number(account.liveMargin || 0),
              account.initialCurrency,
              targetCurrencyCode
            ),
          0
        )
      : null;
    const liveFreeMargin = hasFullFreshCoverage
      ? freshAccounts.reduce(
          (sum, account) =>
            sum +
            convertCurrencyAmount(
              Number(account.liveFreeMargin || 0),
              account.initialCurrency,
              targetCurrencyCode
            ),
          0
        )
      : null;
    const initialBalance = accounts.reduce(
      (sum, account) =>
        sum +
        convertCurrencyAmount(
          Number(account.initialBalance || 0),
          account.initialCurrency,
          targetCurrencyCode
        ),
      0
    );

    const trades = openTrades.map((openPosition) => ({
      id: openPosition.id,
      ticket: openPosition.ticket,
      symbol: openPosition.symbol,
      tradeType: openPosition.tradeType as "long" | "short",
      volume: Number(openPosition.volume),
      openPrice: Number(openPosition.openPrice),
      openTime: openPosition.openTime.toISOString(),
      sl: openPosition.sl ? Number(openPosition.sl) : null,
      tp: openPosition.tp ? Number(openPosition.tp) : null,
      currentPrice: openPosition.currentPrice
        ? Number(openPosition.currentPrice)
        : null,
      swap: convertCurrencyAmount(
        Number(openPosition.swap || 0),
        accountCurrencyById.get(openPosition.accountId),
        targetCurrencyCode
      ),
      commission: convertCurrencyAmount(
        Number(openPosition.commission || 0),
        accountCurrencyById.get(openPosition.accountId),
        targetCurrencyCode
      ),
      profit: convertCurrencyAmount(
        Number(openPosition.profit || 0),
        accountCurrencyById.get(openPosition.accountId),
        targetCurrencyCode
      ),
      sessionTag: openPosition.sessionTag ?? null,
      sessionTagColor: openPosition.sessionTagColor ?? null,
      slModCount: openPosition.slModCount ?? null,
      tpModCount: openPosition.tpModCount ?? null,
      partialCloseCount: openPosition.partialCloseCount ?? null,
      exitDealCount: openPosition.exitDealCount ?? null,
      exitVolume: openPosition.exitVolume
        ? Number(openPosition.exitVolume)
        : null,
      entryDealCount: openPosition.entryDealCount ?? null,
      entryVolume: openPosition.entryVolume
        ? Number(openPosition.entryVolume)
        : null,
      scaleInCount: openPosition.scaleInCount ?? null,
      scaleOutCount: openPosition.scaleOutCount ?? null,
      trailingStopDetected: openPosition.trailingStopDetected ?? null,
      comment: openPosition.comment,
      magicNumber: openPosition.magicNumber,
      lastUpdatedAt: openPosition.lastUpdatedAt.toISOString(),
      accountId: openPosition.accountId,
      accountName:
        accounts.find((account) => account.id === openPosition.accountId)
          ?.name ?? null,
    }));

    const latestSync = accounts.reduce<Date | null>((latest, account) => {
      if (!account.lastSyncedAt) return latest;
      if (!latest || account.lastSyncedAt.getTime() > latest.getTime()) {
        return account.lastSyncedAt;
      }
      return latest;
    }, null);

    const result = {
      accountId: input.accountId,
      accountName: isAllAccountsScope(input.accountId)
        ? "All accounts"
        : accounts[0]?.name,
      broker: accounts.length === 1 ? accounts[0]?.broker : "Multiple brokers",
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
      currencyCode: targetCurrencyCode ?? null,
    };

    cache.set(cacheKey, result, 5000);
    return result;
  });

export const insightsProcedure = protectedProcedure
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

    return insights.map((insight) => ({
      type: insight.category,
      title: insight.title,
      message: insight.message,
      severity: insight.severity,
      data: insight.data,
    }));
  });

export const randomInsightProcedure = protectedProcedure
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

    if (insights.length === 0) {
      return {
        type: "info" as const,
        title: "Getting Started",
        message:
          "Sample size isn't significant enough to generate insights.",
        severity: "info" as const,
      };
    }

    const insight = insights[Math.floor(Math.random() * insights.length)];

    return {
      type: insight.category,
      title: insight.title,
      message: insight.message,
      severity: insight.severity,
      data: insight.data ?? null,
    };
  });

export const executionStatsProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
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
        totalPartialCloses: sql<number | null>`SUM(${trade.partialCloseCount})`,
        avgRrCaptureEfficiency: sql<
          number | null
        >`AVG(CAST(${trade.rrCaptureEfficiency} AS NUMERIC))`,
        avgExitEfficiency: sql<
          number | null
        >`AVG(CAST(${trade.exitEfficiency} AS NUMERIC))`,
        tradeCount: sql<number>`COUNT(*)`,
        tradesWithExecutionData: sql<number>`COUNT(CASE WHEN ${trade.entrySpreadPips} IS NOT NULL OR ${trade.exitSpreadPips} IS NOT NULL OR ${trade.entrySlippagePips} IS NOT NULL OR ${trade.exitSlippagePips} IS NOT NULL OR ${trade.rrCaptureEfficiency} IS NOT NULL OR ${trade.exitEfficiency} IS NOT NULL THEN 1 END)`,
      })
      .from(trade)
      .where(buildAccountScopeCondition(trade.accountId, accountIds));

    const row = result[0];
    const { grade, gradeScore } = computeExecutionGrade({
      avgEntrySpread: row?.avgEntrySpread ?? null,
      avgExitSpread: row?.avgExitSpread ?? null,
      avgEntrySlippage: row?.avgEntrySlippage ?? null,
      avgExitSlippage: row?.avgExitSlippage ?? null,
      avgRrCaptureEfficiency: row?.avgRrCaptureEfficiency ?? null,
      avgExitEfficiency: row?.avgExitEfficiency ?? null,
      tradeCount: row?.tradeCount ?? 0,
      tradesWithExecutionData: row?.tradesWithExecutionData ?? 0,
    });

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
  });

export const moneyLeftOnTableProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
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

    let totalDuringTrade = 0;
    let totalAfterExit = 0;
    let tradesWithPeakData = 0;
    let tradesWithPostExitData = 0;

    for (const tradeRow of trades) {
      const isLong =
        tradeRow.tradeType === "long" || tradeRow.tradeType === "buy";

      if (tradeRow.entryPeakPrice != null && tradeRow.closePrice != null) {
        tradesWithPeakData += 1;
        const missedPips = isLong
          ? Math.max(0, tradeRow.entryPeakPrice - tradeRow.closePrice)
          : Math.max(0, tradeRow.closePrice - tradeRow.entryPeakPrice);
        totalDuringTrade += missedPips * (tradeRow.volume ?? 1) * 10;
      }

      if (tradeRow.postExitPeakPrice != null && tradeRow.closePrice != null) {
        tradesWithPostExitData += 1;
        const additionalPips = isLong
          ? Math.max(0, tradeRow.postExitPeakPrice - tradeRow.closePrice)
          : Math.max(0, tradeRow.closePrice - tradeRow.postExitPeakPrice);
        totalAfterExit += additionalPips * (tradeRow.volume ?? 1) * 10;
      }
    }

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
      totalMissed: Math.round((totalDuringTrade + totalAfterExit) * 100) / 100,
      actualProfit: Math.round(totalProfit * 100) / 100,
      potentialProfit: Math.round(potentialTotal * 100) / 100,
      captureRatio: Math.round(captureRatio * 10) / 10,
      tradesWithPeakData,
      tradesWithPostExitData,
      totalTrades: trades.length,
    };
  });
