import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { copySignal, copySlave } from "../../db/schema/copier";
import { tradingAccount } from "../../db/schema/trading";
import { protectedProcedure } from "../../lib/trpc";
import {
  parseNumeric,
  requireOwnedCopyGroup,
  requireOwnedCopySlave,
} from "./shared";

export const copierHealthProcedures = {
  getSlaveStats: protectedProcedure
    .input(
      z.object({
        slaveId: z.string(),
        days: z.number().int().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireOwnedCopySlave(ctx.session.user.id, input.slaveId);

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const stats = await db
        .select({
          totalSignals: sql<string>`COUNT(*)`,
          executedSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'executed' THEN 1 ELSE 0 END)`,
          failedSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'failed' THEN 1 ELSE 0 END)`,
          rejectedSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'rejected' THEN 1 ELSE 0 END)`,
          totalProfit: sql<string>`COALESCE(SUM(CASE WHEN ${copySignal.status} = 'executed' AND ${copySignal.signalType} = 'close' THEN ${copySignal.profit} ELSE 0 END), 0)`,
          winCount: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'executed' AND ${copySignal.signalType} = 'close' AND CAST(${copySignal.profit} AS NUMERIC) > 0 THEN 1 ELSE 0 END)`,
          lossCount: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'executed' AND ${copySignal.signalType} = 'close' AND CAST(${copySignal.profit} AS NUMERIC) < 0 THEN 1 ELSE 0 END)`,
          avgSlippage: sql<string>`COALESCE(AVG(CASE WHEN ${copySignal.status} = 'executed' THEN ${copySignal.slippagePips} END), 0)`,
        })
        .from(copySignal)
        .where(and(eq(copySignal.copySlaveId, input.slaveId), gte(copySignal.createdAt, since)));

      const recentSignals = await db
        .select()
        .from(copySignal)
        .where(and(eq(copySignal.copySlaveId, input.slaveId), gte(copySignal.createdAt, since)))
        .orderBy(desc(copySignal.createdAt))
        .limit(50);

      const result = stats[0];

      return {
        stats: {
          totalSignals: parseInt(result?.totalSignals ?? "0", 10),
          executedSignals: parseInt(result?.executedSignals ?? "0", 10),
          failedSignals: parseInt(result?.failedSignals ?? "0", 10),
          rejectedSignals: parseInt(result?.rejectedSignals ?? "0", 10),
          totalProfit: parseFloat(result?.totalProfit ?? "0"),
          winCount: parseInt(result?.winCount ?? "0", 10),
          lossCount: parseInt(result?.lossCount ?? "0", 10),
          winRate:
            parseInt(result?.winCount ?? "0", 10) +
              parseInt(result?.lossCount ?? "0", 10) >
            0
              ? (parseInt(result?.winCount ?? "0", 10) /
                  (parseInt(result?.winCount ?? "0", 10) +
                    parseInt(result?.lossCount ?? "0", 10))) *
                100
              : 0,
          avgSlippage: parseFloat(result?.avgSlippage ?? "0"),
        },
        recentSignals: recentSignals.map((signal) => ({
          id: signal.id,
          masterTicket: signal.masterTicket,
          slaveTicket: signal.slaveTicket,
          signalType: signal.signalType,
          status: signal.status,
          symbol: signal.symbol,
          tradeType: signal.tradeType,
          masterVolume: signal.masterVolume,
          slaveVolume: signal.slaveVolume,
          openPrice: signal.openPrice,
          sl: signal.sl,
          tp: signal.tp,
          executedAt: signal.executedAt,
          executedPrice: signal.executedPrice,
          slippagePips: signal.slippagePips,
          profit: signal.profit,
          errorMessage: signal.errorMessage,
          rejectionReason: signal.rejectionReason,
          createdAt: signal.createdAt,
        })),
      };
    }),

  getPerformanceAttribution: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireOwnedCopyGroup(userId, input.groupId);

      const slaves = await db
        .select({
          slave: copySlave,
          account: tradingAccount,
        })
        .from(copySlave)
        .innerJoin(tradingAccount, eq(copySlave.slaveAccountId, tradingAccount.id))
        .where(eq(copySlave.copyGroupId, input.groupId));

      const slaveStats = await Promise.all(
        slaves.map(async ({ slave, account }) => {
          const signals = await db
            .select()
            .from(copySignal)
            .where(eq(copySignal.copySlaveId, slave.id))
            .orderBy(desc(copySignal.createdAt))
            .limit(200);

          const executed = signals.filter((signal) => signal.status === "executed");
          const failed = signals.filter(
            (signal) => signal.status === "failed" || signal.status === "rejected"
          );
          const closedSignals = executed.filter(
            (signal) => signal.signalType === "close" && signal.profit != null
          );

          const totalProfit = closedSignals.reduce(
            (sum, signal) => sum + parseFloat(signal.profit?.toString() || "0"),
            0
          );
          const avgSlippage =
            executed.length > 0
              ? executed.reduce(
                  (sum, signal) =>
                    sum + Math.abs(parseFloat(signal.slippagePips?.toString() || "0")),
                  0
                ) / executed.length
              : 0;

          const wins = closedSignals.filter(
            (signal) => parseFloat(signal.profit?.toString() || "0") > 0
          );
          const winRate =
            closedSignals.length > 0 ? (wins.length / closedSignals.length) * 100 : 0;

          const tradeComparisons = closedSignals.slice(0, 20).map((signal) => ({
            masterTicket: signal.masterTicket,
            slaveTicket: signal.slaveTicket,
            symbol: signal.symbol,
            profit: parseFloat(signal.profit?.toString() || "0"),
            slippage: parseFloat(signal.slippagePips?.toString() || "0"),
            executedAt: signal.executedAt,
          }));

          return {
            slaveId: slave.id,
            accountName: account.name,
            accountId: account.id,
            isActive: slave.isActive,
            stats: {
              totalSignals: signals.length,
              executed: executed.length,
              failed: failed.length,
              closedTrades: closedSignals.length,
              totalProfit,
              winRate,
              avgSlippage,
              lastCopyAt: slave.lastCopyAt,
            },
            recentTrades: tradeComparisons,
          };
        })
      );

      const totalProfit = slaveStats.reduce((sum, slave) => sum + slave.stats.totalProfit, 0);
      const totalExecuted = slaveStats.reduce((sum, slave) => sum + slave.stats.executed, 0);
      const totalFailed = slaveStats.reduce((sum, slave) => sum + slave.stats.failed, 0);
      const executionRate =
        totalExecuted + totalFailed > 0
          ? (totalExecuted / (totalExecuted + totalFailed)) * 100
          : 0;

      return {
        groupId: input.groupId,
        summary: {
          totalProfit,
          totalExecuted,
          totalFailed,
          executionRate,
          slaveCount: slaveStats.length,
          activeSlaves: slaveStats.filter((slave) => slave.isActive).length,
        },
        slaves: slaveStats,
      };
    }),

  getCopyHealth: protectedProcedure
    .input(z.object({ groupId: z.string(), days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireOwnedCopyGroup(userId, input.groupId);

      const since = new Date(Date.now() - input.days * 86400000);

      const slaves = await db
        .select()
        .from(copySlave)
        .where(eq(copySlave.copyGroupId, input.groupId));

      const healthData = await Promise.all(
        slaves.map(async (slave) => {
          const signals = await db
            .select()
            .from(copySignal)
            .where(and(eq(copySignal.copySlaveId, slave.id), gte(copySignal.createdAt, since)))
            .orderBy(desc(copySignal.createdAt));

          const executed = signals.filter((signal) => signal.status === "executed");
          const failed = signals.filter((signal) => signal.status === "failed");
          const rejected = signals.filter((signal) => signal.status === "rejected");

          const latencies = executed
            .filter((signal) => signal.executedAt)
            .map(
              (signal) =>
                new Date(signal.executedAt!).getTime() - new Date(signal.createdAt).getTime()
            );
          const avgLatencyMs =
            latencies.length > 0
              ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
              : 0;

          const failureReasons: Record<string, number> = {};
          for (const signal of [...failed, ...rejected]) {
            const reason = signal.errorMessage || signal.rejectionReason || "Unknown";
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          }

          const slippages = executed
            .map((signal) => parseFloat(signal.slippagePips?.toString() || "0"))
            .filter((value) => value !== 0);
          const avgSlippage =
            slippages.length > 0
              ? slippages.reduce((sum, value) => sum + value, 0) / slippages.length
              : 0;
          const maxSlippage =
            slippages.length > 0 ? Math.max(...slippages.map(Math.abs)) : 0;

          return {
            slaveId: slave.id,
            slaveAccountId: slave.slaveAccountId,
            totalSignals: signals.length,
            executed: executed.length,
            failed: failed.length,
            rejected: rejected.length,
            executionRate: signals.length > 0 ? (executed.length / signals.length) * 100 : 0,
            avgLatencyMs: Math.round(avgLatencyMs),
            avgSlippage: parseFloat(avgSlippage.toFixed(2)),
            maxSlippage: parseFloat(maxSlippage.toFixed(2)),
            failureReasons,
            lastSignalAt: signals[0]?.createdAt || null,
          };
        })
      );

      const overallHealth =
        healthData.length > 0
          ? healthData.reduce((sum, item) => sum + item.executionRate, 0) /
            healthData.length
          : 0;

      return {
        groupId: input.groupId,
        period: input.days,
        overallHealthScore: parseFloat(overallHealth.toFixed(1)),
        status:
          overallHealth >= 90 ? "healthy" : overallHealth >= 70 ? "degraded" : "critical",
        slaves: healthData,
      };
    }),
};
