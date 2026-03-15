import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

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
import { createNotification } from "../../lib/notifications";
import { protectedProcedure } from "../../lib/trpc";

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
        wins: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN 1 END)`,
        losses: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN 1 END)`,
        breakeven: sql<number>`COUNT(CASE WHEN CAST(${trade.profit} AS NUMERIC) = 0 THEN 1 END)`,
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
      initialBalance: z.number().min(0).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const account = await db
      .select({ userId: tradingAccount.userId })
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
    if (input.initialBalance !== undefined) {
      updates.initialBalance = input.initialBalance.toString();
    }

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
  });

export const liveMetricsProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().min(1) }))
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

    const totalFloatingPL = openTrades.reduce(
      (sum, openPosition) => sum + Number(openPosition.profit || 0),
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
      swap: Number(openPosition.swap || 0),
      commission: Number(openPosition.commission || 0),
      profit: Number(openPosition.profit || 0),
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
        accounts.find((account) => account.id === openPosition.accountId)?.name ??
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
      accountId: input.accountId,
      accountName: isAllAccountsScope(input.accountId)
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

    const insights = await generateBrainInsights(input.accountId, userId, "manual");
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
          "Keep trading to build your profile. We need at least 15 closed trades to generate personalized insights.",
        severity: "info" as const,
      };
    }

    const insight = insights[Math.floor(Math.random() * insights.length)];

    return {
      type: insight.category,
      title: insight.title,
      message: insight.message,
      severity: insight.severity,
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
        avgEntrySpread:
          sql<number | null>`AVG(CAST(${trade.entrySpreadPips} AS NUMERIC))`,
        avgExitSpread:
          sql<number | null>`AVG(CAST(${trade.exitSpreadPips} AS NUMERIC))`,
        avgEntrySlippage:
          sql<number | null>`AVG(CAST(${trade.entrySlippagePips} AS NUMERIC))`,
        avgExitSlippage:
          sql<number | null>`AVG(CAST(${trade.exitSlippagePips} AS NUMERIC))`,
        totalSlModifications: sql<number | null>`SUM(${trade.slModCount})`,
        totalTpModifications: sql<number | null>`SUM(${trade.tpModCount})`,
        totalPartialCloses: sql<number | null>`SUM(${trade.partialCloseCount})`,
        avgRrCaptureEfficiency:
          sql<number | null>`AVG(CAST(${trade.rrCaptureEfficiency} AS NUMERIC))`,
        avgExitEfficiency:
          sql<number | null>`AVG(CAST(${trade.exitEfficiency} AS NUMERIC))`,
        tradeCount: sql<number>`COUNT(*)`,
        tradesWithExecutionData: sql<number>`COUNT(${trade.entrySpreadPips})`,
      })
      .from(trade)
      .where(buildAccountScopeCondition(trade.accountId, accountIds));

    const row = result[0];
    let gradeScore = 100;
    const avgSpread =
      ((row?.avgEntrySpread || 0) + (row?.avgExitSpread || 0)) / 2;
    const avgSlippage =
      ((row?.avgEntrySlippage || 0) + (row?.avgExitSlippage || 0)) / 2;

    if (avgSpread > 2) gradeScore -= 15;
    else if (avgSpread > 1) gradeScore -= 5;

    if (avgSlippage > 1) gradeScore -= 20;
    else if (avgSlippage > 0.5) gradeScore -= 10;

    if (
      row?.avgRrCaptureEfficiency != null &&
      row.avgRrCaptureEfficiency < 50
    ) {
      gradeScore -= 10;
    }
    if (row?.avgExitEfficiency != null && row.avgExitEfficiency < 50) {
      gradeScore -= 10;
    }

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
        entryPeakPrice:
          sql<number | null>`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
        postExitPeakPrice:
          sql<number | null>`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
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
      const isLong = tradeRow.tradeType === "long" || tradeRow.tradeType === "buy";

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
        totalProfit:
          sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
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
  });
