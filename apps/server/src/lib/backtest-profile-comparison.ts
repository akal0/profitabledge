/**
 * Backtest Profile Comparison
 *
 * Computes a behavioral profile from backtest trades and compares it
 * against the user's live trading profile to surface drift.
 */

import { db } from "../db";
import { backtestSession, backtestTrade } from "../db/schema/backtest";
import { and, eq, sql, asc } from "drizzle-orm";
import { getOrComputeProfile } from "./ai/engine/trader-profile";
import type { TraderProfileData } from "./ai/engine/types";

// ─── Types ──────────────────────────────────────────────────────

export interface BacktestBehavioralProfile {
  avgHoldTimeSeconds: number;
  tradingHoursDistribution: number[]; // 24-element array
  avgTradesPerDay: number;
  winRate: number;
  profitFactor: number;
  avgRR: number;
  directionSplit: { longPct: number; shortPct: number };
  totalTrades: number;
}

export interface BehavioralDriftItem {
  dimension: string;
  label: string;
  liveValue: number;
  backtestValue: number;
  percentChange: number;
  direction: "higher" | "lower" | "similar";
  severity: "significant" | "moderate" | "minor";
  insight: string;
}

export interface ComparisonResult {
  driftItems: BehavioralDriftItem[];
  backtestProfile: BacktestBehavioralProfile;
  liveProfile: {
    avgHoldTimeSeconds: number;
    avgTradesPerDay: number;
    winRate: number;
    profitFactor: number;
    avgRR: number;
    directionSplit: { longPct: number; shortPct: number };
    totalTrades: number;
  };
  overallDriftScore: number;
  summary: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

// ─── Build Backtest Profile ─────────────────────────────────────

async function buildBacktestProfile(
  userId: string,
  sessionId?: string
): Promise<BacktestBehavioralProfile> {
  // Build filters for getting closed trades
  const sessionFilters = [eq(backtestSession.userId, userId)];
  if (sessionId) {
    sessionFilters.push(eq(backtestSession.id, sessionId));
  } else {
    sessionFilters.push(sql`${backtestSession.status} != 'archived'`);
  }

  const sessions = await db
    .select({ id: backtestSession.id })
    .from(backtestSession)
    .where(and(...sessionFilters));

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    return {
      avgHoldTimeSeconds: 0,
      tradingHoursDistribution: new Array(24).fill(0),
      avgTradesPerDay: 0,
      winRate: 0,
      profitFactor: 0,
      avgRR: 0,
      directionSplit: { longPct: 50, shortPct: 50 },
      totalTrades: 0,
    };
  }

  const trades = await db
    .select()
    .from(backtestTrade)
    .where(
      and(
        sql`${backtestTrade.sessionId} IN ${sessionIds}`,
        sql`${backtestTrade.status} != 'open'`
      )
    )
    .orderBy(asc(backtestTrade.entryTime));

  if (trades.length === 0) {
    return {
      avgHoldTimeSeconds: 0,
      tradingHoursDistribution: new Array(24).fill(0),
      avgTradesPerDay: 0,
      winRate: 0,
      profitFactor: 0,
      avgRR: 0,
      directionSplit: { longPct: 50, shortPct: 50 },
      totalTrades: 0,
    };
  }

  // Hold time
  const holdTimes = trades
    .filter((t) => t.holdTimeSeconds != null)
    .map((t) => t.holdTimeSeconds!);
  const avgHoldTimeSeconds =
    holdTimes.length > 0
      ? holdTimes.reduce((s, h) => s + h, 0) / holdTimes.length
      : 0;

  // Trading hours distribution
  const hoursDistribution = new Array(24).fill(0);
  for (const t of trades) {
    const hour = t.entryTime.getUTCHours();
    hoursDistribution[hour]++;
  }

  // Trades per day
  const uniqueDays = new Set(
    trades.map((t) => t.entryTime.toISOString().slice(0, 10))
  );
  const avgTradesPerDay =
    uniqueDays.size > 0 ? trades.length / uniqueDays.size : 0;

  // Win rate
  const pnls = trades.map((t) => toNum(t.pnl));
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const winRate =
    trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  // Profit factor
  const totalWins = wins.reduce((s, p) => s + p, 0);
  const totalLosses = Math.abs(losses.reduce((s, p) => s + p, 0));
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

  // Average RR
  const rrs = trades
    .filter((t) => t.realizedRR != null)
    .map((t) => toNum(t.realizedRR));
  const avgRR =
    rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

  // Direction split
  const longCount = trades.filter((t) => t.direction === "long").length;
  const shortCount = trades.filter((t) => t.direction === "short").length;
  const total = longCount + shortCount;
  const directionSplit = {
    longPct: total > 0 ? (longCount / total) * 100 : 50,
    shortPct: total > 0 ? (shortCount / total) * 100 : 50,
  };

  return {
    avgHoldTimeSeconds,
    tradingHoursDistribution: hoursDistribution,
    avgTradesPerDay,
    winRate,
    profitFactor: Math.min(profitFactor, 999),
    avgRR,
    directionSplit,
    totalTrades: trades.length,
  };
}

// ─── Compare Profiles ───────────────────────────────────────────

export async function compareBacktestToLive(
  userId: string,
  accountId: string,
  sessionId?: string
): Promise<ComparisonResult> {
  // Build backtest profile
  const btProfile = await buildBacktestProfile(userId, sessionId);

  if (btProfile.totalTrades < 5) {
    return {
      driftItems: [],
      backtestProfile: btProfile,
      liveProfile: {
        avgHoldTimeSeconds: 0,
        avgTradesPerDay: 0,
        winRate: 0,
        profitFactor: 0,
        avgRR: 0,
        directionSplit: { longPct: 50, shortPct: 50 },
        totalTrades: 0,
      },
      overallDriftScore: 0,
      summary: "Not enough backtest trades for comparison (minimum 5).",
    };
  }

  // Get live profile
  let liveProfileData: TraderProfileData;
  try {
    liveProfileData = await getOrComputeProfile(accountId, userId);
  } catch {
    return {
      driftItems: [],
      backtestProfile: btProfile,
      liveProfile: {
        avgHoldTimeSeconds: 0,
        avgTradesPerDay: 0,
        winRate: 0,
        profitFactor: 0,
        avgRR: 0,
        directionSplit: { longPct: 50, shortPct: 50 },
        totalTrades: 0,
      },
      overallDriftScore: 0,
      summary: "Could not compute live profile. Need more live trades.",
    };
  }

  if (liveProfileData.totalTrades < 10) {
    return {
      driftItems: [],
      backtestProfile: btProfile,
      liveProfile: {
        avgHoldTimeSeconds: 0,
        avgTradesPerDay: 0,
        winRate: 0,
        profitFactor: 0,
        avgRR: 0,
        directionSplit: { longPct: 50, shortPct: 50 },
        totalTrades: 0,
      },
      overallDriftScore: 0,
      summary: "Not enough live trades for comparison (minimum 10).",
    };
  }

  // Extract live values
  const liveHoldTime = liveProfileData.holdTime.avgAll;
  const liveTradesPerDay = liveProfileData.consistency?.avgDailyTrades ?? 0;
  const liveWinRate = liveProfileData.winRate;
  const livePF = liveProfileData.profitFactor;
  const liveAvgRR = liveProfileData.rrProfile?.avgRealisedRR ?? 0;

  // Direction from live
  const liveLongTrades = liveProfileData.symbols?.reduce(
    (s, sym) => s + sym.trades,
    0
  ) ?? liveProfileData.totalTrades;
  // Approximate from sessions if available
  let liveLongPct = 50;
  let liveShortPct = 50;
  if (liveProfileData.sessions && liveProfileData.sessions.length > 0) {
    // Use overall trades as approximation
    liveLongPct = 50;
    liveShortPct = 50;
  }

  const liveProfile = {
    avgHoldTimeSeconds: liveHoldTime,
    avgTradesPerDay: liveTradesPerDay,
    winRate: liveWinRate,
    profitFactor: Math.min(livePF, 999),
    avgRR: liveAvgRR,
    directionSplit: { longPct: liveLongPct, shortPct: liveShortPct },
    totalTrades: liveProfileData.totalTrades,
  };

  // Build drift items
  const driftItems: BehavioralDriftItem[] = [];

  // 1. Hold Time
  if (liveHoldTime > 0 && btProfile.avgHoldTimeSeconds > 0) {
    const ratio = btProfile.avgHoldTimeSeconds / liveHoldTime;
    const pctChange = (ratio - 1) * 100;
    const severity = Math.abs(pctChange) > 50 ? "significant" : Math.abs(pctChange) > 20 ? "moderate" : "minor";
    const direction = pctChange > 5 ? "higher" : pctChange < -5 ? "lower" : "similar";

    let insight = "";
    if (direction === "higher") {
      insight = `You hold ${ratio.toFixed(1)}x longer in backtest (avg ${formatTime(btProfile.avgHoldTimeSeconds)}) vs live (avg ${formatTime(liveHoldTime)}). This may indicate more patience without real money pressure.`;
    } else if (direction === "lower") {
      insight = `Your backtest hold time (${formatTime(btProfile.avgHoldTimeSeconds)}) is ${Math.abs(pctChange).toFixed(0)}% shorter than live (${formatTime(liveHoldTime)}). You may be cutting winners early when practicing.`;
    } else {
      insight = `Hold times are similar between backtest (${formatTime(btProfile.avgHoldTimeSeconds)}) and live (${formatTime(liveHoldTime)}).`;
    }

    driftItems.push({
      dimension: "hold_time",
      label: "Hold Time",
      liveValue: liveHoldTime,
      backtestValue: btProfile.avgHoldTimeSeconds,
      percentChange: pctChange,
      direction,
      severity,
      insight,
    });
  }

  // 2. Trade Frequency
  if (liveTradesPerDay > 0 && btProfile.avgTradesPerDay > 0) {
    const ratio = btProfile.avgTradesPerDay / liveTradesPerDay;
    const pctChange = (ratio - 1) * 100;
    const severity = Math.abs(pctChange) > 30 ? "significant" : Math.abs(pctChange) > 15 ? "moderate" : "minor";
    const direction = pctChange > 5 ? "higher" : pctChange < -5 ? "lower" : "similar";

    let insight = "";
    if (direction === "higher") {
      insight = `You take ${btProfile.avgTradesPerDay.toFixed(1)} trades/day in backtest vs ${liveTradesPerDay.toFixed(1)} live. The increased volume in backtest may not reflect realistic live conditions.`;
    } else if (direction === "lower") {
      insight = `You're more selective in backtest (${btProfile.avgTradesPerDay.toFixed(1)}/day) vs live (${liveTradesPerDay.toFixed(1)}/day). Consider applying this discipline to live trading.`;
    } else {
      insight = `Trade frequency is similar between backtest and live trading.`;
    }

    driftItems.push({
      dimension: "trade_frequency",
      label: "Trade Frequency",
      liveValue: liveTradesPerDay,
      backtestValue: btProfile.avgTradesPerDay,
      percentChange: pctChange,
      direction,
      severity,
      insight,
    });
  }

  // 3. Win Rate
  if (liveWinRate > 0) {
    const ppDiff = btProfile.winRate - liveWinRate;
    const severity = Math.abs(ppDiff) > 10 ? "significant" : Math.abs(ppDiff) > 5 ? "moderate" : "minor";
    const direction = ppDiff > 2 ? "higher" : ppDiff < -2 ? "lower" : "similar";

    let insight = "";
    if (direction === "higher") {
      insight = `Your backtest win rate (${btProfile.winRate.toFixed(1)}%) is ${ppDiff.toFixed(0)}pp higher than live (${liveWinRate.toFixed(1)}%). This gap often narrows when emotions and real risk are involved.`;
    } else if (direction === "lower") {
      insight = `Your backtest win rate (${btProfile.winRate.toFixed(1)}%) is ${Math.abs(ppDiff).toFixed(0)}pp lower than live (${liveWinRate.toFixed(1)}%). You might be taking more experimental trades in practice.`;
    } else {
      insight = `Win rates are consistent between backtest and live trading.`;
    }

    driftItems.push({
      dimension: "win_rate",
      label: "Win Rate",
      liveValue: liveWinRate,
      backtestValue: btProfile.winRate,
      percentChange: ppDiff,
      direction,
      severity,
      insight,
    });
  }

  // 4. Average RR
  if (liveAvgRR !== 0 && btProfile.avgRR !== 0) {
    const diff = btProfile.avgRR - liveAvgRR;
    const severity = Math.abs(diff) > 0.5 ? "significant" : Math.abs(diff) > 0.2 ? "moderate" : "minor";
    const direction = diff > 0.1 ? "higher" : diff < -0.1 ? "lower" : "similar";

    let insight = "";
    if (direction === "higher") {
      insight = `Average R:R in backtest (${btProfile.avgRR.toFixed(2)}R) is higher than live (${liveAvgRR.toFixed(2)}R). Your trade management may be better without live pressure.`;
    } else if (direction === "lower") {
      insight = `Average R:R in backtest (${btProfile.avgRR.toFixed(2)}R) is lower than live (${liveAvgRR.toFixed(2)}R). Consider focusing on entries that match your best live setups.`;
    } else {
      insight = `Risk-reward ratios are consistent between backtest and live trading.`;
    }

    driftItems.push({
      dimension: "rr_ratio",
      label: "Avg R:R",
      liveValue: liveAvgRR,
      backtestValue: btProfile.avgRR,
      percentChange: liveAvgRR !== 0 ? ((diff / Math.abs(liveAvgRR)) * 100) : 0,
      direction,
      severity,
      insight,
    });
  }

  // 5. Profit Factor
  if (livePF > 0 && livePF < 999 && btProfile.profitFactor > 0 && btProfile.profitFactor < 999) {
    const ratio = btProfile.profitFactor / livePF;
    const pctChange = (ratio - 1) * 100;
    const severity = Math.abs(pctChange) > 40 ? "significant" : Math.abs(pctChange) > 20 ? "moderate" : "minor";
    const direction = pctChange > 10 ? "higher" : pctChange < -10 ? "lower" : "similar";

    driftItems.push({
      dimension: "profit_factor",
      label: "Profit Factor",
      liveValue: livePF,
      backtestValue: btProfile.profitFactor,
      percentChange: pctChange,
      direction,
      severity,
      insight: direction === "similar"
        ? "Profit factor is consistent across backtest and live."
        : `Backtest PF (${btProfile.profitFactor.toFixed(2)}) is ${direction} than live (${livePF.toFixed(2)}).`,
    });
  }

  // Calculate overall drift score (0-100)
  const significantItems = driftItems.filter((d) => d.severity !== "minor");
  const weights: Record<string, number> = {
    hold_time: 0.2,
    trade_frequency: 0.2,
    win_rate: 0.2,
    rr_ratio: 0.2,
    profit_factor: 0.2,
  };

  let weightedDrift = 0;
  let totalWeight = 0;
  for (const item of driftItems) {
    const weight = weights[item.dimension] ?? 0.1;
    const normalizedDrift = Math.min(100, Math.abs(item.percentChange));
    weightedDrift += normalizedDrift * weight;
    totalWeight += weight;
  }
  const overallDriftScore = totalWeight > 0 ? Math.round(weightedDrift / totalWeight) : 0;

  // Generate summary
  const significantDrifts = driftItems.filter((d) => d.severity === "significant");
  let summary = "";
  if (significantDrifts.length === 0) {
    summary = "Your backtest behavior closely matches your live trading patterns. This consistency suggests your practice is realistic and translatable.";
  } else if (significantDrifts.length === 1) {
    summary = `Notable difference in ${significantDrifts[0].label.toLowerCase()}: ${significantDrifts[0].insight}`;
  } else {
    const dims = significantDrifts.map((d) => d.label.toLowerCase()).join(", ");
    summary = `Significant behavioral differences detected in ${dims}. Your backtest trading style differs from your live patterns in these areas.`;
  }

  return {
    driftItems,
    backtestProfile: btProfile,
    liveProfile,
    overallDriftScore,
    summary,
  };
}
