import { db } from "../db";
import { leaderboardEntry, trade, tradingAccount } from "../db/schema";
import { user as userTable } from "../db/schema/auth";
import { eq, and, gte, lte, sql, desc, ne } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Leaderboard Calculator
 *
 * Calculates quality-based leaderboard rankings that reward:
 * - Consistency over outliers
 * - Execution quality over profits
 * - Discipline over results
 * - Risk management over gains
 *
 * Philosophy: Boring traders should rank higher than flashy gamblers
 */

export type LeaderboardCategory = "consistency" | "execution" | "discipline" | "risk";
export type LeaderboardPeriod = "30d" | "90d" | "all_time";

interface ConsistencyMetrics {
  medianR: number;
  maxDrawdown: number;
  varianceR: number;
}

interface ExecutionMetrics {
  avgRRCaptureEfficiency: number;
  avgManipRREfficiency: number;
  avgExitEfficiency: number;
}

interface DisciplineMetrics {
  protocolAlignmentRate: number;
  revengeClusterRate: number;
  sessionAdherenceRate: number;
}

interface RiskMetrics {
  maxDrawdown: number;
  avgRiskPerTrade: number;
  slAdherenceRate: number;
}

/**
 * Calculate leaderboard entries for all eligible accounts
 * Run this as a background job (daily or hourly)
 */
export async function calculateLeaderboards(
  category: LeaderboardCategory,
  period: LeaderboardPeriod
): Promise<void> {
  console.log(`[Leaderboard] Calculating ${category} for ${period}`);

  // Get period dates
  const { tradeWindowStart, tradeWindowEnd, periodStart, periodEnd } =
    getPeriodDates(period);

  // Get all verified, opted-in accounts
  const accounts = await db
    .select({
      id: tradingAccount.id,
      userId: tradingAccount.userId,
      name: tradingAccount.name,
      verificationLevel: tradingAccount.verificationLevel,
      propFirmId: tradingAccount.propFirmId,
    })
    .from(tradingAccount)
    .where(
      and(
        eq(tradingAccount.socialOptIn, true),
        ne(tradingAccount.verificationLevel, "unverified")
      )
    );

  console.log(`[Leaderboard] Found ${accounts.length} eligible accounts`);

  const entries: Array<{
    accountId: string;
    userId: string;
    metrics: any;
    totalTrades: number;
  }> = [];

  // Calculate metrics for each account
  for (const account of accounts) {
    try {
      const trades = await db
        .select()
        .from(trade)
        .where(
          and(
            eq(trade.accountId, account.id),
            gte(trade.closeTime, tradeWindowStart),
            lte(trade.closeTime, tradeWindowEnd),
            sql`${trade.closeTime} IS NOT NULL`
          )
        );

      // Minimum 100 trades required
      if (trades.length < 100) {
        continue;
      }

      let metrics: any = {};

      switch (category) {
        case "consistency":
          metrics = calculateConsistencyMetrics(trades);
          break;
        case "execution":
          metrics = calculateExecutionMetrics(trades);
          break;
        case "discipline":
          metrics = calculateDisciplineMetrics(trades);
          break;
        case "risk":
          metrics = calculateRiskMetrics(trades);
          break;
      }

      entries.push({
        accountId: account.id,
        userId: account.userId,
        metrics,
        totalTrades: trades.length,
      });
    } catch (err) {
      console.error(`[Leaderboard] Error calculating for account ${account.id}:`, err);
    }
  }

  // Calculate percentiles
  const entriesWithPercentiles = calculatePercentiles(entries, category);

  // Delete old entries for this period/category
  await db
    .delete(leaderboardEntry)
    .where(
      and(
        eq(leaderboardEntry.category, category),
        eq(leaderboardEntry.period, period),
        gte(leaderboardEntry.periodStart, periodStart)
      )
    );

  // Insert new entries
  if (entriesWithPercentiles.length > 0) {
    await db.insert(leaderboardEntry).values(
      entriesWithPercentiles.map((entry) => ({
        id: nanoid(),
        accountId: entry.accountId,
        userId: entry.userId,
        period,
        periodStart,
        periodEnd,
        category,
        metricValues: entry.metrics as any,
        percentile: entry.percentile,
        percentileBand: getPercentileBand(entry.percentile),
        totalTrades: entry.totalTrades,
        sampleValid: entry.totalTrades >= 100,
        minimumTradesRequired: 100,
      }))
    );
  }

  console.log(`[Leaderboard] Calculated ${entriesWithPercentiles.length} entries`);
}

/**
 * Calculate consistency metrics
 * Rewards: Median R, low drawdown, low variance
 */
function calculateConsistencyMetrics(trades: any[]): ConsistencyMetrics {
  const rrValues = trades
    .map((t) => Number(t.realisedRR || 0))
    .filter((r) => !isNaN(r))
    .sort((a, b) => a - b);

  const medianR = rrValues.length > 0 ? rrValues[Math.floor(rrValues.length / 2)] : 0;

  // Calculate drawdown
  let runningSum = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const t of trades) {
    runningSum += Number(t.realisedRR || 0);
    if (runningSum > peak) {
      peak = runningSum;
    }
    const drawdown = peak - runningSum;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Calculate variance
  const mean = rrValues.reduce((sum, r) => sum + r, 0) / rrValues.length;
  const variance =
    rrValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rrValues.length;

  return {
    medianR,
    maxDrawdown,
    varianceR: variance,
  };
}

/**
 * Calculate execution metrics
 * Rewards: RR capture, manipulation efficiency, exit timing
 */
function calculateExecutionMetrics(trades: any[]): ExecutionMetrics {
  const rrCaptures = trades
    .map((t) => Number(t.rrCaptureEfficiency || 0))
    .filter((e) => !isNaN(e) && e > 0);

  const manipEfficiencies = trades
    .map((t) => Number(t.manipRREfficiency || 0))
    .filter((e) => !isNaN(e) && e > 0);

  const exitEfficiencies = trades
    .map((t) => Number(t.exitEfficiency || 0))
    .filter((e) => !isNaN(e) && e > 0);

  return {
    avgRRCaptureEfficiency:
      rrCaptures.length > 0 ? rrCaptures.reduce((s, e) => s + e, 0) / rrCaptures.length : 0,
    avgManipRREfficiency:
      manipEfficiencies.length > 0
        ? manipEfficiencies.reduce((s, e) => s + e, 0) / manipEfficiencies.length
        : 0,
    avgExitEfficiency:
      exitEfficiencies.length > 0
        ? exitEfficiencies.reduce((s, e) => s + e, 0) / exitEfficiencies.length
        : 0,
  };
}

/**
 * Calculate discipline metrics
 * Rewards: Protocol adherence, no revenge trading, session discipline
 */
function calculateDisciplineMetrics(trades: any[]): DisciplineMetrics {
  const alignedCount = trades.filter((t) => t.protocolAlignment === "aligned").length;
  const protocolAlignmentRate = trades.length > 0 ? alignedCount / trades.length : 0;

  // Revenge cluster detection (3+ losses in <1 hour)
  let revengeCount = 0;
  const lossTrades = trades.filter((t) => t.outcome === "Loss").sort((a, b) =>
    new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime()
  );

  for (let i = 0; i < lossTrades.length - 2; i++) {
    const t1 = new Date(lossTrades[i].closeTime).getTime();
    const t2 = new Date(lossTrades[i + 1].closeTime).getTime();
    const t3 = new Date(lossTrades[i + 2].closeTime).getTime();

    // 3 losses within 1 hour = revenge cluster
    if (t3 - t1 < 60 * 60 * 1000) {
      revengeCount++;
    }
  }

  const revengeClusterRate = trades.length > 0 ? revengeCount / trades.length : 0;

  // Session adherence (trades with session tag)
  const withSessionTag = trades.filter((t) => t.sessionTag).length;
  const sessionAdherenceRate = trades.length > 0 ? withSessionTag / trades.length : 0;

  return {
    protocolAlignmentRate,
    revengeClusterRate,
    sessionAdherenceRate,
  };
}

/**
 * Calculate risk metrics
 * Rewards: Low drawdown, consistent risk, SL adherence
 */
function calculateRiskMetrics(trades: any[]): RiskMetrics {
  // Max drawdown (same as consistency)
  let runningSum = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const t of trades) {
    runningSum += Number(t.realisedRR || 0);
    if (runningSum > peak) {
      peak = runningSum;
    }
    const drawdown = peak - runningSum;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Average risk per trade (assumes 1R = initial risk)
  const avgRiskPerTrade = 0.01; // Placeholder: would need position size data

  // SL adherence (stopped out vs hit TP or closed manually)
  const withSL = trades.filter((t) => t.sl != null).length;
  const slAdherenceRate = trades.length > 0 ? withSL / trades.length : 0;

  return {
    maxDrawdown,
    avgRiskPerTrade,
    slAdherenceRate,
  };
}

/**
 * Calculate percentiles for entries
 */
function calculatePercentiles(
  entries: Array<{ accountId: string; userId: string; metrics: any; totalTrades: number }>,
  category: LeaderboardCategory
): Array<{ accountId: string; userId: string; metrics: any; totalTrades: number; percentile: number }> {
  // Sort by primary metric (higher is better, except drawdown/variance)
  let sorted: typeof entries;

  switch (category) {
    case "consistency":
      // Higher median R, lower drawdown, lower variance = better
      sorted = entries.sort((a, b) => {
        const scoreA =
          (a.metrics as ConsistencyMetrics).medianR -
          (a.metrics as ConsistencyMetrics).maxDrawdown -
          (a.metrics as ConsistencyMetrics).varianceR;
        const scoreB =
          (b.metrics as ConsistencyMetrics).medianR -
          (b.metrics as ConsistencyMetrics).maxDrawdown -
          (b.metrics as ConsistencyMetrics).varianceR;
        return scoreB - scoreA; // Descending
      });
      break;

    case "execution":
      // Higher efficiency = better
      sorted = entries.sort((a, b) => {
        const scoreA =
          ((a.metrics as ExecutionMetrics).avgRRCaptureEfficiency +
            (a.metrics as ExecutionMetrics).avgManipRREfficiency +
            (a.metrics as ExecutionMetrics).avgExitEfficiency) /
          3;
        const scoreB =
          ((b.metrics as ExecutionMetrics).avgRRCaptureEfficiency +
            (b.metrics as ExecutionMetrics).avgManipRREfficiency +
            (b.metrics as ExecutionMetrics).avgExitEfficiency) /
          3;
        return scoreB - scoreA; // Descending
      });
      break;

    case "discipline":
      // Higher protocol, lower revenge, higher session = better
      sorted = entries.sort((a, b) => {
        const scoreA =
          (a.metrics as DisciplineMetrics).protocolAlignmentRate -
          (a.metrics as DisciplineMetrics).revengeClusterRate +
          (a.metrics as DisciplineMetrics).sessionAdherenceRate;
        const scoreB =
          (b.metrics as DisciplineMetrics).protocolAlignmentRate -
          (b.metrics as DisciplineMetrics).revengeClusterRate +
          (b.metrics as DisciplineMetrics).sessionAdherenceRate;
        return scoreB - scoreA; // Descending
      });
      break;

    case "risk":
      // Lower drawdown, lower risk, higher SL adherence = better
      sorted = entries.sort((a, b) => {
        const scoreA =
          -(a.metrics as RiskMetrics).maxDrawdown -
          (a.metrics as RiskMetrics).avgRiskPerTrade +
          (a.metrics as RiskMetrics).slAdherenceRate;
        const scoreB =
          -(b.metrics as RiskMetrics).maxDrawdown -
          (b.metrics as RiskMetrics).avgRiskPerTrade +
          (b.metrics as RiskMetrics).slAdherenceRate;
        return scoreB - scoreA; // Descending
      });
      break;
  }

  // Assign percentiles (1 = best, 100 = worst)
  return sorted.map((entry, index) => ({
    ...entry,
    percentile: Math.ceil(((index + 1) / sorted.length) * 100),
  }));
}

/**
 * Get percentile band label
 */
function getPercentileBand(percentile: number): string {
  if (percentile <= 10) return "Top 10%";
  if (percentile <= 25) return "Top 25%";
  if (percentile <= 50) return "Top 50%";
  if (percentile <= 75) return "Top 75%";
  return "Bottom 25%";
}

/**
 * Get period dates
 */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodDates(period: LeaderboardPeriod): {
  tradeWindowStart: Date;
  tradeWindowEnd: Date;
  periodStart: string;
  periodEnd: string;
} {
  const now = new Date();
  let tradeWindowStart: Date;

  switch (period) {
    case "30d":
      tradeWindowStart = new Date(now);
      tradeWindowStart.setDate(now.getDate() - 30);
      break;
    case "90d":
      tradeWindowStart = new Date(now);
      tradeWindowStart.setDate(now.getDate() - 90);
      break;
    case "all_time":
      tradeWindowStart = new Date(2000, 0, 1);
      break;
  }

  return {
    tradeWindowStart,
    tradeWindowEnd: now,
    periodStart: toDateOnlyString(tradeWindowStart),
    periodEnd: toDateOnlyString(now),
  };
}

/**
 * Calculate all leaderboards (run as cron job)
 */
export async function calculateAllLeaderboards(): Promise<void> {
  const categories: LeaderboardCategory[] = ["consistency", "execution", "discipline", "risk"];
  const periods: LeaderboardPeriod[] = ["30d", "90d", "all_time"];

  for (const category of categories) {
    for (const period of periods) {
      try {
        await calculateLeaderboards(category, period);
      } catch (err) {
        console.error(`[Leaderboard] Failed to calculate ${category} ${period}:`, err);
      }
    }
  }

  console.log("[Leaderboard] All leaderboards calculated");
}
