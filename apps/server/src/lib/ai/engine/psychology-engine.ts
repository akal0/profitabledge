/**
 * Psychology Engine
 *
 * Analyzes the relationship between a trader's emotional states and their performance.
 * Powers the Tiltmeter, emotion-to-PnL correlation, and mental performance scoring.
 *
 * Features:
 * - Emotion-to-outcome correlation (which emotions lead to wins vs losses)
 * - Tilt detection (revenge trading, FOMO patterns, loss chasing)
 * - Mental Performance Score (0-100 composite)
 * - Psychology-aware insight generation
 */

import { db } from "../../../db";
import {
  trade as tradeTable,
  tradingAccount,
} from "../../../db/schema/trading";
import { tradeEmotion } from "../../../db/schema/coaching";
import { journalEntry } from "../../../db/schema/journal";
import { eq, and, sql, gte, desc, inArray } from "drizzle-orm";
import type { TraderProfileData } from "./types";

// ─── Types ──────────────────────────────────────────────────────

export interface EmotionCorrelation {
  emotion: string;
  stage: string;
  trades: number;
  wins: number;
  winRate: number;
  avgProfit: number;
  avgHoldTime: number; // seconds
}

export interface TiltStatus {
  score: number; // 0-100 composure score (0 = severely tilted, 100 = perfectly disciplined)
  tiltScore: number; // 0-100 tilt severity (0 = stable, 100 = full tilt)
  level: "green" | "yellow" | "orange" | "red";
  indicators: TiltIndicator[];
  recentEmotions: { emotion: string; count: number }[];
}

export interface TiltIndicator {
  type:
    | "revenge_trading"
    | "fomo_entries"
    | "loss_chasing"
    | "overtrading"
    | "emotional_volatility"
    | "session_fatigue"
    | "single_trade_damage"
    | "daily_drawdown"
    | "capital_damage";
  severity: "low" | "medium" | "high";
  label: string;
  message: string;
  data: Record<string, any>;
}

export interface MentalPerformanceScore {
  overall: number; // 0-100
  totalScore: number; // 0-100 alias used by dashboard + assistant blocks
  components: {
    discipline: { score: number; weight: number; details: string };
    emotionManagement: { score: number; weight: number; details: string };
    consistency: { score: number; weight: number; details: string };
    recovery: { score: number; weight: number; details: string };
    selfAwareness: { score: number; weight: number; details: string };
  };
  trend: "improving" | "stable" | "declining";
  period: { days: number; trades: number };
}

export interface PsychologyProfile {
  emotionCorrelations: EmotionCorrelation[];
  bestEmotions: EmotionCorrelation[]; // top 3 by win rate
  worstEmotions: EmotionCorrelation[]; // bottom 3 by win rate
  tiltStatus: TiltStatus;
  mentalScore: MentalPerformanceScore;
  emotionTrend: {
    dominantEmotion: string;
    emotionVariety: number; // number of distinct emotions used
    taggingRate: number; // % of trades with emotion tags
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

const TILT_INDICATOR_LABELS: Record<TiltIndicator["type"], string> = {
  revenge_trading: "Revenge trading",
  fomo_entries: "FOMO entries",
  loss_chasing: "Loss chasing",
  overtrading: "Overtrading",
  emotional_volatility: "Emotional volatility",
  session_fatigue: "Session fatigue",
  single_trade_damage: "Single-trade damage",
  daily_drawdown: "Daily drawdown",
  capital_damage: "Capital damage",
};

const BEHAVIOR_INDICATOR_TYPES = new Set<TiltIndicator["type"]>([
  "revenge_trading",
  "fomo_entries",
  "loss_chasing",
  "overtrading",
  "emotional_volatility",
  "session_fatigue",
]);

function severityPenalty(
  severity: TiltIndicator["severity"],
  weights: Record<TiltIndicator["severity"], number>
): number {
  return weights[severity];
}

function behaviorIndicatorPenalty(indicator: TiltIndicator): number {
  return severityPenalty(indicator.severity, {
    low: 8,
    medium: 16,
    high: 26,
  });
}

function capitalIndicatorPenalty(indicator: TiltIndicator): number {
  switch (indicator.type) {
    case "single_trade_damage":
      return severityPenalty(indicator.severity, {
        low: 20,
        medium: 36,
        high: 56,
      });
    case "daily_drawdown":
      return severityPenalty(indicator.severity, {
        low: 18,
        medium: 32,
        high: 52,
      });
    case "capital_damage":
      return severityPenalty(indicator.severity, {
        low: 18,
        medium: 30,
        high: 48,
      });
    default:
      return 0;
  }
}

function classifySeverity(
  value: number,
  thresholds: { low: number; medium: number; high: number }
): TiltIndicator["severity"] | null {
  if (value >= thresholds.high) return "high";
  if (value >= thresholds.medium) return "medium";
  if (value >= thresholds.low) return "low";
  return null;
}

// ─── Emotion-to-PnL Correlations ────────────────────────────────

export async function computeEmotionCorrelations(
  accountId: string,
  userId: string
): Promise<EmotionCorrelation[]> {
  // Get all emotion tags for this account
  const emotions = await db
    .select()
    .from(tradeEmotion)
    .where(
      and(
        eq(tradeEmotion.accountId, accountId),
        eq(tradeEmotion.userId, userId)
      )
    );

  if (emotions.length === 0) return [];

  // Get trade IDs that have emotion tags
  const tradeIds = [...new Set(emotions.filter((e) => e.tradeId).map((e) => e.tradeId!))];
  if (tradeIds.length === 0) return [];

  // Fetch the actual trades
  const trades = await db
    .select()
    .from(tradeTable)
    .where(inArray(tradeTable.id, tradeIds));

  const tradeMap = new Map(trades.map((t) => [t.id, t]));

  // Group emotions by (stage, emotion) → compute stats
  const groups = new Map<
    string,
    { emotion: string; stage: string; profits: number[]; holdTimes: number[]; wins: number }
  >();

  for (const em of emotions) {
    if (!em.tradeId) continue;
    const trade = tradeMap.get(em.tradeId);
    if (!trade) continue;

    const key = `${em.stage}:${em.emotion}`;
    if (!groups.has(key)) {
      groups.set(key, {
        emotion: em.emotion,
        stage: em.stage,
        profits: [],
        holdTimes: [],
        wins: 0,
      });
    }

    const group = groups.get(key)!;
    const profit = toNum(trade.profit);
    group.profits.push(profit);
    if (profit > 0) group.wins++;

    const holdSecs = toNum(trade.tradeDurationSeconds);
    if (holdSecs > 0) group.holdTimes.push(holdSecs);
  }

  const correlations: EmotionCorrelation[] = [];
  for (const group of groups.values()) {
    if (group.profits.length < 2) continue; // Need at least 2 trades

    const avgProfit =
      group.profits.reduce((s, v) => s + v, 0) / group.profits.length;
    const avgHoldTime =
      group.holdTimes.length > 0
        ? group.holdTimes.reduce((s, v) => s + v, 0) / group.holdTimes.length
        : 0;

    correlations.push({
      emotion: group.emotion,
      stage: group.stage,
      trades: group.profits.length,
      wins: group.wins,
      winRate: (group.wins / group.profits.length) * 100,
      avgProfit,
      avgHoldTime,
    });
  }

  // Sort by trade count (most data first)
  correlations.sort((a, b) => b.trades - a.trades);
  return correlations;
}

// ─── Tilt Detection ─────────────────────────────────────────────

export async function detectTiltStatus(
  accountId: string,
  userId: string,
  profile: TraderProfileData
): Promise<TiltStatus> {
  // Get recent trades (last 24h)
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const recentTrades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, since)
      )
    )
    .orderBy(desc(tradeTable.closeTime));

  const [account] = await db
    .select({
      initialBalance: tradingAccount.initialBalance,
      liveBalance: tradingAccount.liveBalance,
      liveEquity: tradingAccount.liveEquity,
    })
    .from(tradingAccount)
    .where(
      and(
        eq(tradingAccount.id, accountId),
        eq(tradingAccount.userId, userId)
      )
    )
    .limit(1);

  // Get recent emotions
  const recentEmotions = await db
    .select()
    .from(tradeEmotion)
    .where(
      and(
        eq(tradeEmotion.accountId, accountId),
        eq(tradeEmotion.userId, userId),
        gte(tradeEmotion.createdAt, since)
      )
    )
    .orderBy(desc(tradeEmotion.createdAt));

  const indicators: TiltIndicator[] = [];
  const pushIndicator = (
    type: TiltIndicator["type"],
    severity: TiltIndicator["severity"],
    message: string,
    data: Record<string, any>
  ) => {
    indicators.push({
      type,
      severity,
      label: TILT_INDICATOR_LABELS[type],
      message,
      data,
    });
  };

  const recentTradeProfits = recentTrades.map((trade) => toNum(trade.profit));
  const recentNetPnL = recentTradeProfits.reduce((sum, value) => sum + value, 0);
  const recentGrossLoss = recentTradeProfits.reduce(
    (sum, value) => sum + (value < 0 ? Math.abs(value) : 0),
    0
  );
  const worstLossTrade = recentTrades.reduce<(typeof recentTrades)[number] | null>(
    (worst, trade) => {
      const profit = toNum(trade.profit);
      if (profit >= 0) return worst;
      if (!worst) return trade;
      return Math.abs(profit) > Math.abs(toNum(worst.profit)) ? trade : worst;
    },
    null
  );
  const worstLossAbs = worstLossTrade ? Math.abs(toNum(worstLossTrade.profit)) : 0;

  const currentBalanceEstimate =
    (account?.liveBalance != null ? toNum(account.liveBalance) : null) ??
    (account?.liveEquity != null ? toNum(account.liveEquity) : null) ??
    (account?.initialBalance != null
      ? toNum(account.initialBalance) + profile.netPnL
      : null);
  const startingBalanceEstimateRaw =
    currentBalanceEstimate != null
      ? currentBalanceEstimate - recentNetPnL
      : account?.initialBalance != null
        ? toNum(account.initialBalance)
        : 0;
  const startingBalanceEstimate = Math.max(startingBalanceEstimateRaw, 0);
  const capitalBase = Math.max(
    startingBalanceEstimate,
    currentBalanceEstimate ?? 0,
    account?.initialBalance != null ? toNum(account.initialBalance) : 0,
    recentGrossLoss,
    worstLossAbs,
    1
  );

  const singleTradeLossPct =
    capitalBase > 0 ? (worstLossAbs / capitalBase) * 100 : 0;
  const dailyNetLossPct =
    capitalBase > 0 && recentNetPnL < 0
      ? (Math.abs(recentNetPnL) / capitalBase) * 100
      : 0;

  const recentTradesChronological = [...recentTrades].sort((a, b) => {
    const aTime = a.closeTime ? new Date(a.closeTime).getTime() : 0;
    const bTime = b.closeTime ? new Date(b.closeTime).getTime() : 0;
    return aTime - bTime;
  });
  let runningBalance = startingBalanceEstimate;
  let intradayPeak = startingBalanceEstimate;
  let realizedDrawdownPct = 0;
  for (const trade of recentTradesChronological) {
    runningBalance += toNum(trade.profit);
    if (runningBalance > intradayPeak) {
      intradayPeak = runningBalance;
    }
    if (intradayPeak > 0) {
      realizedDrawdownPct = Math.max(
        realizedDrawdownPct,
        ((intradayPeak - runningBalance) / intradayPeak) * 100
      );
    }
  }

  // 1. Revenge trading detection: trades taken within 3 minutes of a loss
  if (recentTrades.length >= 2) {
    let revengeCount = 0;
    for (let i = 0; i < recentTrades.length - 1; i++) {
      const current = recentTrades[i];
      const previous = recentTrades[i + 1];
      const prevProfit = toNum(previous.profit);
      if (prevProfit < 0 && current.openTime && previous.closeTime) {
        const gapMs =
          new Date(current.openTime).getTime() -
          new Date(previous.closeTime).getTime();
        if (gapMs > 0 && gapMs < 180000) {
          // Within 3 minutes
          revengeCount++;
        }
      }
    }
    if (revengeCount >= 1) {
      pushIndicator(
        "revenge_trading",
        revengeCount >= 3 ? "high" : revengeCount >= 2 ? "medium" : "low",
        `${revengeCount} trade${revengeCount === 1 ? "" : "s"} entered within 3 minutes of a loss. This suggests revenge trading.`,
        { revengeCount }
      );
    }
  }

  // 2. FOMO detection: tagged emotions include 'fomo' or 'excited'
  const fomoEmotions = recentEmotions.filter(
    (e) =>
      e.stage === "pre_entry" &&
      (e.emotion === "fomo" || e.emotion === "excited")
  );
  if (fomoEmotions.length >= 1) {
    pushIndicator(
      "fomo_entries",
      fomoEmotions.length >= 3 ? "high" : fomoEmotions.length >= 2 ? "medium" : "low",
      `${fomoEmotions.length} recent trade${fomoEmotions.length === 1 ? "" : "s"} entered with FOMO/excitement. These tend to underperform.`,
      { fomoCount: fomoEmotions.length }
    );
  }

  // 3. Loss chasing: increasing position sizes after losses
  if (recentTrades.length >= 3) {
    let chasingCount = 0;
    for (let i = 0; i < recentTrades.length - 1; i++) {
      const current = recentTrades[i];
      const previous = recentTrades[i + 1];
      if (
        toNum(previous.profit) < 0 &&
        toNum(current.volume) > toNum(previous.volume) * 1.3
      ) {
        chasingCount++;
      }
    }
    if (chasingCount >= 1) {
      pushIndicator(
        "loss_chasing",
        chasingCount >= 2 ? "high" : "low",
        `Position sizes increased after ${chasingCount} recent loss${chasingCount === 1 ? "" : "es"}. Classic loss chasing behavior.`,
        { chasingCount }
      );
    }
  }

  // 4. Overtrading
  if (
    profile.consistency.avgDailyTrades > 0 &&
    recentTrades.length > profile.consistency.avgDailyTrades * 1.25
  ) {
    pushIndicator(
      "overtrading",
      recentTrades.length > profile.consistency.avgDailyTrades * 2.5
        ? "high"
        : recentTrades.length > profile.consistency.avgDailyTrades * 1.8
          ? "medium"
          : "low",
      `${recentTrades.length} trades today vs your average of ${profile.consistency.avgDailyTrades.toFixed(1)}/day.`,
      {
        todayCount: recentTrades.length,
        avgDaily: profile.consistency.avgDailyTrades,
      }
    );
  }

  // 5. Emotional volatility: many different emotions in a short time
  const uniqueEmotions = new Set(recentEmotions.map((e) => e.emotion));
  if (recentEmotions.length >= 3 && uniqueEmotions.size >= 3) {
    pushIndicator(
      "emotional_volatility",
      recentEmotions.length >= 5 && uniqueEmotions.size >= 4 ? "medium" : "low",
      `${uniqueEmotions.size} different emotional states in your recent trades. High emotional volatility can impair decision-making.`,
      {
        emotionCount: uniqueEmotions.size,
        emotions: [...uniqueEmotions],
      }
    );
  }

  // 6. Single-trade damage: one loss consumed too much account capital
  const singleTradeDamageSeverity = classifySeverity(singleTradeLossPct, {
    low: 3,
    medium: 8,
    high: 15,
  });
  if (singleTradeDamageSeverity && worstLossTrade) {
    pushIndicator(
      "single_trade_damage",
      singleTradeDamageSeverity,
      `Your worst recent trade lost ${singleTradeLossPct.toFixed(1)}% of account capital (${worstLossAbs.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}). A single trade should not damage the account this much.`,
      {
        singleTradeLossPct,
        worstLossAbs,
        worstLossTradeId: worstLossTrade.id,
        capitalBase,
      }
    );
  }

  // 7. Daily drawdown: 24h realized PnL hit was materially damaging
  const dailyDrawdownSeverity = classifySeverity(dailyNetLossPct, {
    low: 4,
    medium: 10,
    high: 20,
  });
  if (dailyDrawdownSeverity) {
    pushIndicator(
      "daily_drawdown",
      dailyDrawdownSeverity,
      `You are down ${dailyNetLossPct.toFixed(1)}% over the last 24 hours (${Math.abs(
        recentNetPnL
      ).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}). Heavy one-day damage is a direct tilt risk.`,
      {
        dailyNetLossPct,
        recentNetPnL,
        capitalBase,
      }
    );
  }

  // 8. Capital damage: realized intraday drawdown from recent closed trades
  const capitalDamageSeverity = classifySeverity(realizedDrawdownPct, {
    low: 5,
    medium: 12,
    high: 20,
  });
  if (capitalDamageSeverity) {
    pushIndicator(
      "capital_damage",
      capitalDamageSeverity,
      `Your realized 24h drawdown reached ${realizedDrawdownPct.toFixed(
        1
      )}% from peak to trough. This kind of capital shock should meaningfully elevate the tilt meter.`,
      {
        realizedDrawdownPct,
        capitalBase,
        startingBalanceEstimate,
      }
    );
  }

  const behaviorIndicators = indicators.filter((indicator) =>
    BEHAVIOR_INDICATOR_TYPES.has(indicator.type)
  );
  const capitalIndicators = indicators.filter(
    (indicator) => !BEHAVIOR_INDICATOR_TYPES.has(indicator.type)
  );

  const behaviorPenalty = Math.min(
    45,
    behaviorIndicators.reduce(
      (sum, indicator) => sum + behaviorIndicatorPenalty(indicator),
      0
    )
  );

  let capitalPenalty = 0;
  if (capitalIndicators.length > 0) {
    const weightedCapitalPenalties = capitalIndicators
      .map((indicator) => capitalIndicatorPenalty(indicator))
      .sort((a, b) => b - a);
    const strongestCapitalPenalty = weightedCapitalPenalties[0] ?? 0;
    const supportingCapitalPenalty = weightedCapitalPenalties
      .slice(1)
      .reduce((sum, penalty) => sum + penalty, 0);
    const concentrationBonus =
      singleTradeLossPct >= 5 &&
      recentGrossLoss > 0 &&
      worstLossAbs / recentGrossLoss >= 0.7
        ? 8
        : 0;

    capitalPenalty = Math.min(
      85,
      strongestCapitalPenalty + supportingCapitalPenalty * 0.35 + concentrationBonus
    );
  }

  // `score` is a composure metric, while `tiltScore` is severity for the UI.
  let score = 100 - behaviorPenalty - capitalPenalty;
  score = Math.max(0, Math.min(100, score));
  const tiltScore = 100 - score;

  // Determine level from tilt severity
  let level: TiltStatus["level"] = "green";
  if (tiltScore >= 70) level = "red";
  else if (tiltScore >= 45) level = "orange";
  else if (tiltScore >= 20) level = "yellow";

  // Count recent emotion frequency
  const emotionCounts = new Map<string, number>();
  for (const em of recentEmotions) {
    emotionCounts.set(em.emotion, (emotionCounts.get(em.emotion) || 0) + 1);
  }
  const emotionFrequency = [...emotionCounts.entries()]
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count);

  return {
    score,
    tiltScore,
    level,
    indicators,
    recentEmotions: emotionFrequency,
  };
}

// ─── Mental Performance Score ───────────────────────────────────

export async function computeMentalPerformanceScore(
  accountId: string,
  userId: string,
  profile: TraderProfileData
): Promise<MentalPerformanceScore> {
  const since = new Date();
  since.setDate(since.getDate() - 14); // Last 2 weeks

  // Get recent trades
  const recentTrades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, since)
      )
    )
    .orderBy(desc(tradeTable.closeTime));

  // Get recent emotions
  const recentEmotions = await db
    .select()
    .from(tradeEmotion)
    .where(
      and(
        eq(tradeEmotion.accountId, accountId),
        eq(tradeEmotion.userId, userId),
        gte(tradeEmotion.createdAt, since)
      )
    );

  // 1. Discipline Score (30%): Protocol alignment + rule compliance
  let disciplineScore = 50; // default if no data
  let disciplineDetails = "Not enough data";
  if (recentTrades.length >= 3) {
    const aligned = recentTrades.filter(
      (t) => t.protocolAlignment === "aligned"
    ).length;
    const against = recentTrades.filter(
      (t) => t.protocolAlignment === "against"
    ).length;
    const alignedRate = (aligned / recentTrades.length) * 100;
    const againstPenalty = (against / recentTrades.length) * 50;
    disciplineScore = Math.round(
      Math.min(100, Math.max(0, alignedRate - againstPenalty))
    );
    disciplineDetails = `${aligned}/${recentTrades.length} protocol-aligned trades (${alignedRate.toFixed(0)}%)`;
  }

  // 2. Emotion Management Score (25%): How well emotions correlate with outcomes
  let emotionScore = 50;
  let emotionDetails = "Start tagging emotions to unlock this metric";
  if (recentEmotions.length >= 5) {
    const positiveEmotions = ["confident", "focused", "calm", "neutral"];
    const negativeEmotions = ["revenge", "fomo", "anxious", "frustrated", "stressed"];

    const positiveCount = recentEmotions.filter((e) =>
      positiveEmotions.includes(e.emotion)
    ).length;
    const negativeCount = recentEmotions.filter((e) =>
      negativeEmotions.includes(e.emotion)
    ).length;

    const positiveRate = (positiveCount / recentEmotions.length) * 100;
    emotionScore = Math.round(
      Math.min(100, Math.max(0, positiveRate - negativeCount * 5))
    );
    emotionDetails = `${positiveCount} positive vs ${negativeCount} negative emotional states`;
  }

  // 3. Consistency Score (20%): From the existing profile
  const consistencyScore = Math.round(profile.consistency.consistencyScore);
  const consistencyDetails = `Daily trade count std dev: ${profile.consistency.stdDevDailyTrades.toFixed(1)}`;

  // 4. Recovery Score (15%): How well trader recovers from losses
  let recoveryScore = 50;
  let recoveryDetails = "Not enough sequential data";
  if (recentTrades.length >= 5) {
    let recoveryWins = 0;
    let recoveryAttempts = 0;

    for (let i = 0; i < recentTrades.length - 1; i++) {
      if (toNum(recentTrades[i + 1].profit) < 0) {
        recoveryAttempts++;
        if (toNum(recentTrades[i].profit) > 0) {
          recoveryWins++;
        }
      }
    }

    if (recoveryAttempts > 0) {
      recoveryScore = Math.round((recoveryWins / recoveryAttempts) * 100);
      recoveryDetails = `Won ${recoveryWins}/${recoveryAttempts} trades after a loss`;
    }
  }

  // 5. Self-Awareness Score (10%): Based on journaling frequency + emotion tagging rate
  let awarenessScore = 0;
  let awarenessDetails = "Start journaling and tagging emotions";

  // Check journal entries
  const journalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntry)
    .where(
      and(eq(journalEntry.userId, userId), gte(journalEntry.createdAt, since))
    );

  const journalEntries = Number(journalCount[0]?.count || 0);
  const emotionTagRate =
    recentTrades.length > 0
      ? (recentEmotions.length / recentTrades.length) * 100
      : 0;

  // Journal scoring: 1 entry = 20, 3+ = 40, 7+ = 50
  const journalScore = Math.min(
    50,
    journalEntries >= 7 ? 50 : journalEntries >= 3 ? 40 : journalEntries * 20
  );
  // Emotion tag scoring: 50% tag rate = 25 pts, 100% = 50 pts
  const tagScore = Math.min(50, emotionTagRate / 2);
  awarenessScore = Math.round(journalScore + tagScore);
  awarenessDetails = `${journalEntries} journal entries, ${emotionTagRate.toFixed(0)}% trade emotion tagging rate`;

  // Calculate weighted overall score
  const overall = Math.round(
    disciplineScore * 0.3 +
      emotionScore * 0.25 +
      consistencyScore * 0.2 +
      recoveryScore * 0.15 +
      awarenessScore * 0.1
  );

  // Trend calculation (compare to previous 2 weeks — simplified)
  let trend: "improving" | "stable" | "declining" = "stable";
  if (recentTrades.length >= 5) {
    const midpoint = Math.floor(recentTrades.length / 2);
    const recentHalf = recentTrades.slice(0, midpoint);
    const olderHalf = recentTrades.slice(midpoint);

    const recentWR =
      recentHalf.filter((t) => toNum(t.profit) > 0).length /
      recentHalf.length;
    const olderWR =
      olderHalf.filter((t) => toNum(t.profit) > 0).length / olderHalf.length;

    if (recentWR > olderWR + 0.1) trend = "improving";
    else if (recentWR < olderWR - 0.1) trend = "declining";
  }

  return {
    overall,
    totalScore: overall,
    components: {
      discipline: {
        score: disciplineScore,
        weight: 0.3,
        details: disciplineDetails,
      },
      emotionManagement: {
        score: emotionScore,
        weight: 0.25,
        details: emotionDetails,
      },
      consistency: {
        score: consistencyScore,
        weight: 0.2,
        details: consistencyDetails,
      },
      recovery: {
        score: recoveryScore,
        weight: 0.15,
        details: recoveryDetails,
      },
      selfAwareness: {
        score: awarenessScore,
        weight: 0.1,
        details: awarenessDetails,
      },
    },
    trend,
    period: { days: 14, trades: recentTrades.length },
  };
}

// ─── Full Psychology Profile ────────────────────────────────────

export async function computePsychologyProfile(
  accountId: string,
  userId: string,
  profile: TraderProfileData
): Promise<PsychologyProfile> {
  const [correlations, tiltStatus, mentalScore] = await Promise.all([
    computeEmotionCorrelations(accountId, userId),
    detectTiltStatus(accountId, userId, profile),
    computeMentalPerformanceScore(accountId, userId, profile),
  ]);

  // Get pre-entry correlations for best/worst sorting
  const preEntryCorrelations = correlations.filter(
    (c) => c.stage === "pre_entry" && c.trades >= 3
  );

  const bestEmotions = [...preEntryCorrelations]
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3);
  const worstEmotions = [...preEntryCorrelations]
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, 3);

  // Emotion trend
  const allEmotions = correlations;
  const dominantEmotion =
    allEmotions.length > 0
      ? allEmotions.sort((a, b) => b.trades - a.trades)[0].emotion
      : "none";
  const emotionVariety = new Set(allEmotions.map((c) => c.emotion)).size;

  // Tagging rate
  const emotionCount = correlations.reduce((s, c) => s + c.trades, 0);
  const taggingRate =
    profile.totalTrades > 0
      ? Math.min(100, (emotionCount / profile.totalTrades) * 100)
      : 0;

  return {
    emotionCorrelations: correlations,
    bestEmotions,
    worstEmotions,
    tiltStatus,
    mentalScore,
    emotionTrend: {
      dominantEmotion,
      emotionVariety,
      taggingRate,
    },
  };
}
