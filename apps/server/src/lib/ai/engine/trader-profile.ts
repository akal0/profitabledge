/**
 * Trader Profile Builder
 *
 * Computes a comprehensive behavioral snapshot from ALL closed trades
 * for a given account. Cached in DB + in-memory for fast access.
 */

import { db } from "../../../db";
import { trade as tradeTable } from "../../../db/schema/trading";
import { traderProfile } from "../../../db/schema/trader-brain";
import { eq, and, sql, count } from "drizzle-orm";
import { cache } from "../../cache";
import {
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../../account-scope";
import { findEdges, findLeaks } from "./behavioral-analyzer";
import type {
  TraderProfileData,
  SessionProfile,
  SymbolProfile,
  HoldTimeProfile,
  RRProfile,
  ExecutionProfile,
  HourlyProfile,
  WeekdayProfile,
  ProtocolStats,
  ConsistencyProfile,
  OpportunityCostProfile,
  CondensedProfile,
  EdgeCondition,
  LeakCondition,
} from "./types";

const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory
const PROFILE_STALE_MINUTES = 30;

type ClosedTrade = typeof tradeTable.$inferSelect;

// ─── Helper ──────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / values.length);
}

function isWin(t: ClosedTrade): boolean {
  return toNum(t.profit) > 0;
}

function isLoss(t: ClosedTrade): boolean {
  return toNum(t.profit) < 0;
}

function holdSeconds(t: ClosedTrade): number {
  if (t.tradeDurationSeconds) return toNum(t.tradeDurationSeconds);
  if (t.openTime && t.closeTime) {
    return (
      (new Date(t.closeTime).getTime() - new Date(t.openTime).getTime()) / 1000
    );
  }
  return 0;
}

function weekdayLabel(date: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── Profile Cache Key ──────────────────────────────────────────

function profileCacheKey(accountId: string, userId?: string): string {
  if (isAllAccountsScope(accountId)) {
    return `trader-profile:${userId ?? "unknown"}:${accountId}`;
  }
  return `trader-profile:${accountId}`;
}

async function getScopedClosedTrades(
  accountId: string,
  userId: string
): Promise<ClosedTrade[]> {
  const accountIds = await resolveScopedAccountIds(userId, accountId);
  if (accountIds.length === 0) return [];

  return db
    .select()
    .from(tradeTable)
    .where(
      and(
        buildAccountScopeCondition(tradeTable.accountId, accountIds),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    )
    .orderBy(sql`${tradeTable.closeTime} ASC`);
}

async function computeProfileBundle(
  accountId: string,
  userId: string
): Promise<{
  profile: TraderProfileData;
  edges: EdgeCondition[];
  leaks: LeakCondition[];
  tradeCount: number;
}> {
  const trades = await getScopedClosedTrades(accountId, userId);

  return {
    profile: buildProfile(trades),
    edges: trades.length >= 20 ? findEdges(trades as any) : [],
    leaks: trades.length >= 20 ? findLeaks(trades as any) : [],
    tradeCount: trades.length,
  };
}

// ─── Core: Compute the Full Profile ─────────────────────────────

export async function computeTraderProfile(
  accountId: string,
  userId: string
): Promise<TraderProfileData> {
  const bundle = await computeProfileBundle(accountId, userId);
  return bundle.profile;
}

function buildProfile(trades: ClosedTrade[]): TraderProfileData {
  const winners = trades.filter(isWin);
  const losers = trades.filter(isLoss);

  // ── Overall ──
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0;
  const totalProfit = winners.reduce((s, t) => s + toNum(t.profit), 0);
  const totalLoss = Math.abs(losers.reduce((s, t) => s + toNum(t.profit), 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  const avgWin = winners.length > 0 ? totalProfit / winners.length : 0;
  const avgLossVal = losers.length > 0 ? totalLoss / losers.length : 0;
  const expectancy =
    (winRate / 100) * avgWin - (1 - winRate / 100) * avgLossVal;
  const netPnL = trades.reduce((s, t) => s + toNum(t.profit), 0);

  // ── Sessions ──
  const sessions = computeSessionProfiles(trades);

  // ── Symbols ──
  const symbols = computeSymbolProfiles(trades);

  // ── Hold Time ──
  const holdTime = computeHoldTimeProfile(trades, winners, losers);

  // ── RR Profile ──
  const rrProfile = computeRRProfile(trades);

  // ── Execution ──
  const execution = computeExecutionProfile(trades);

  // ── Hourly ──
  const hourlyProfile = computeHourlyProfile(trades);

  // ── Weekday ──
  const weekdayProfile = computeWeekdayProfile(trades);

  // ── Protocol ──
  const protocolStats = computeProtocolStats(trades);

  // ── Streaks ──
  const { currentStreak, longestWinStreak, longestLossStreak } =
    computeStreaks(trades);

  // ── Consistency ──
  const consistency = computeConsistency(trades);

  // ── Opportunity Cost ──
  const opportunityCost = computeOpportunityCost(trades, winners);

  return {
    totalTrades,
    winRate,
    profitFactor,
    expectancy,
    avgProfit: avgWin,
    avgLoss: avgLossVal,
    netPnL,
    sessions,
    symbols,
    holdTime,
    rrProfile,
    execution,
    hourlyProfile,
    weekdayProfile,
    protocolStats,
    currentStreak,
    longestWinStreak,
    longestLossStreak,
    consistency,
    opportunityCost,
  };
}

// ─── Sub-computations ───────────────────────────────────────────

function computeSessionProfiles(trades: ClosedTrade[]): SessionProfile[] {
  const map = new Map<
    string,
    { trades: ClosedTrade[]; wins: number; profit: number }
  >();

  for (const t of trades) {
    const session = t.sessionTag;
    if (!session) continue;
    const entry = map.get(session) || { trades: [], wins: 0, profit: 0 };
    entry.trades.push(t);
    if (isWin(t)) entry.wins++;
    entry.profit += toNum(t.profit);
    map.set(session, entry);
  }

  return Array.from(map.entries())
    .map(([session, data]) => ({
      session,
      trades: data.trades.length,
      wins: data.wins,
      winRate:
        data.trades.length > 0
          ? (data.wins / data.trades.length) * 100
          : 0,
      avgProfit:
        data.trades.length > 0
          ? data.profit / data.trades.length
          : 0,
      totalProfit: data.profit,
      avgHoldTime: avg(data.trades.map(holdSeconds)),
      avgRR: avg(
        data.trades
          .map((t) => toNum(t.realisedRR))
          .filter((r) => r !== 0)
      ),
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit);
}

function computeSymbolProfiles(trades: ClosedTrade[]): SymbolProfile[] {
  const map = new Map<
    string,
    { trades: ClosedTrade[]; wins: number; profit: number }
  >();

  for (const t of trades) {
    if (!t.symbol) continue;
    const entry = map.get(t.symbol) || { trades: [], wins: 0, profit: 0 };
    entry.trades.push(t);
    if (isWin(t)) entry.wins++;
    entry.profit += toNum(t.profit);
    map.set(t.symbol, entry);
  }

  return Array.from(map.entries())
    .map(([symbol, data]) => ({
      symbol,
      trades: data.trades.length,
      wins: data.wins,
      winRate:
        data.trades.length > 0
          ? (data.wins / data.trades.length) * 100
          : 0,
      avgProfit:
        data.trades.length > 0
          ? data.profit / data.trades.length
          : 0,
      totalProfit: data.profit,
      avgHoldTime: avg(data.trades.map(holdSeconds)),
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit);
}

function computeHoldTimeProfile(
  all: ClosedTrade[],
  winners: ClosedTrade[],
  losers: ClosedTrade[]
): HoldTimeProfile {
  const allTimes = all.map(holdSeconds).filter((s) => s > 0);
  const winTimes = winners.map(holdSeconds).filter((s) => s > 0);
  const lossTimes = losers.map(holdSeconds).filter((s) => s > 0);

  // Sweet spot: hold time range of winning trades within 1 std dev of mean
  const winMean = avg(winTimes);
  const winStd = stdDev(winTimes);
  const sweetSpotMin = Math.max(0, winMean - winStd);
  const sweetSpotMax = winMean + winStd;

  return {
    avgAll: avg(allTimes),
    avgWins: avg(winTimes),
    avgLosses: avg(lossTimes),
    medianAll: median(allTimes),
    medianWins: median(winTimes),
    medianLosses: median(lossTimes),
    sweetSpotMin,
    sweetSpotMax,
  };
}

function computeRRProfile(trades: ClosedTrade[]): RRProfile {
  const plannedRRs = trades.map((t) => toNum(t.plannedRR)).filter((r) => r > 0);
  const realisedRRs = trades
    .map((t) => toNum(t.realisedRR))
    .filter((r) => r !== 0);
  const maxRRs = trades.map((t) => toNum(t.maxRR)).filter((r) => r > 0);
  const captures = trades
    .map((t) => toNum(t.rrCaptureEfficiency))
    .filter((e) => e > 0);
  const exits = trades
    .map((t) => toNum(t.exitEfficiency))
    .filter((e) => e > 0);

  // Find the RR sweet spot: bucket with highest win rate (min 5 trades)
  const buckets = new Map<string, { wins: number; total: number; min: number; max: number }>();
  const bucketDefs: [string, number, number][] = [
    ["<1.5", 0, 1.5],
    ["1.5-2.5", 1.5, 2.5],
    ["2.5-3.5", 2.5, 3.5],
    [">3.5", 3.5, Infinity],
  ];

  for (const t of trades) {
    const rr = toNum(t.plannedRR);
    if (rr <= 0) continue;
    for (const [label, min, max] of bucketDefs) {
      if (rr >= min && rr < max) {
        const entry = buckets.get(label) || { wins: 0, total: 0, min, max };
        entry.total++;
        if (isWin(t)) entry.wins++;
        buckets.set(label, entry);
        break;
      }
    }
  }

  let sweetSpotMin = 1.5;
  let sweetSpotMax = 3.5;
  let sweetSpotWinRate = 0;

  for (const [, data] of buckets) {
    if (data.total >= 5) {
      const wr = (data.wins / data.total) * 100;
      if (wr > sweetSpotWinRate) {
        sweetSpotWinRate = wr;
        sweetSpotMin = data.min;
        sweetSpotMax = data.max === Infinity ? 10 : data.max;
      }
    }
  }

  return {
    avgPlannedRR: avg(plannedRRs),
    avgRealisedRR: avg(realisedRRs),
    avgMaxRR: avg(maxRRs),
    avgCaptureEfficiency: avg(captures),
    avgExitEfficiency: avg(exits),
    sweetSpotMin,
    sweetSpotMax,
    sweetSpotWinRate,
  };
}

function computeExecutionProfile(trades: ClosedTrade[]): ExecutionProfile {
  const entrySpreads = trades
    .map((t) => toNum(t.entrySpreadPips))
    .filter((v) => v > 0);
  const exitSpreads = trades
    .map((t) => toNum(t.exitSpreadPips))
    .filter((v) => v > 0);
  const entrySlippage = trades
    .map((t) => toNum(t.entrySlippagePips))
    .filter((v) => v > 0);
  const exitSlippage = trades
    .map((t) => toNum(t.exitSlippagePips))
    .filter((v) => v > 0);
  const slMods = trades.map((t) => t.slModCount ?? 0);
  const tpMods = trades.map((t) => t.tpModCount ?? 0);
  const trailingCount = trades.filter(
    (t) => t.trailingStopDetected === true
  ).length;
  const partialCount = trades.filter(
    (t) => (t.partialCloseCount ?? 0) > 0
  ).length;

  return {
    avgEntrySpread: avg(entrySpreads),
    avgExitSpread: avg(exitSpreads),
    avgEntrySlippage: avg(entrySlippage),
    avgExitSlippage: avg(exitSlippage),
    avgSLMods: avg(slMods),
    avgTPMods: avg(tpMods),
    trailingStopRate:
      trades.length > 0 ? (trailingCount / trades.length) * 100 : 0,
    partialCloseRate:
      trades.length > 0 ? (partialCount / trades.length) * 100 : 0,
  };
}

function computeHourlyProfile(trades: ClosedTrade[]): HourlyProfile[] {
  const map = new Map<number, { wins: number; total: number; profit: number }>();

  for (const t of trades) {
    const time = t.openTime || (t.open ? new Date(t.open) : null);
    if (!time) continue;
    const hour = new Date(time).getUTCHours();
    const entry = map.get(hour) || { wins: 0, total: 0, profit: 0 };
    entry.total++;
    if (isWin(t)) entry.wins++;
    entry.profit += toNum(t.profit);
    map.set(hour, entry);
  }

  return Array.from(map.entries())
    .map(([hour, data]) => ({
      hour,
      trades: data.total,
      wins: data.wins,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      avgProfit: data.total > 0 ? data.profit / data.total : 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

function computeWeekdayProfile(trades: ClosedTrade[]): WeekdayProfile[] {
  const map = new Map<
    string,
    { wins: number; total: number; profit: number }
  >();

  for (const t of trades) {
    const time = t.openTime || (t.open ? new Date(t.open) : null);
    if (!time) continue;
    const wd = weekdayLabel(new Date(time));
    const entry = map.get(wd) || { wins: 0, total: 0, profit: 0 };
    entry.total++;
    if (isWin(t)) entry.wins++;
    entry.profit += toNum(t.profit);
    map.set(wd, entry);
  }

  const order = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return order
    .filter((wd) => map.has(wd))
    .map((wd) => {
      const data = map.get(wd)!;
      return {
        weekday: wd,
        trades: data.total,
        wins: data.wins,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
        avgProfit: data.total > 0 ? data.profit / data.total : 0,
        totalProfit: data.profit,
      };
    });
}

function computeProtocolStats(trades: ClosedTrade[]): ProtocolStats {
  const groups: Record<string, { wins: number; total: number; profit: number }> = {
    aligned: { wins: 0, total: 0, profit: 0 },
    against: { wins: 0, total: 0, profit: 0 },
    discretionary: { wins: 0, total: 0, profit: 0 },
  };

  for (const t of trades) {
    const alignment = (t.protocolAlignment || "discretionary").toLowerCase();
    const key =
      alignment === "aligned"
        ? "aligned"
        : alignment === "against"
          ? "against"
          : "discretionary";
    groups[key].total++;
    if (isWin(t)) groups[key].wins++;
    groups[key].profit += toNum(t.profit);
  }

  return {
    alignedWinRate:
      groups.aligned.total > 0
        ? (groups.aligned.wins / groups.aligned.total) * 100
        : 0,
    alignedCount: groups.aligned.total,
    alignedProfit: groups.aligned.profit,
    againstWinRate:
      groups.against.total > 0
        ? (groups.against.wins / groups.against.total) * 100
        : 0,
    againstCount: groups.against.total,
    againstProfit: groups.against.profit,
    discretionaryWinRate:
      groups.discretionary.total > 0
        ? (groups.discretionary.wins / groups.discretionary.total) * 100
        : 0,
    discretionaryCount: groups.discretionary.total,
    discretionaryProfit: groups.discretionary.profit,
  };
}

function computeStreaks(
  trades: ClosedTrade[]
): {
  currentStreak: { type: "win" | "loss" | null; count: number };
  longestWinStreak: number;
  longestLossStreak: number;
} {
  let currentType: "win" | "loss" | null = null;
  let currentCount = 0;
  let longestWin = 0;
  let longestLoss = 0;

  // Process newest first for current streak
  const reversed = [...trades].reverse();

  for (const t of reversed) {
    const profit = toNum(t.profit);
    if (profit === 0) continue;
    const type: "win" | "loss" = profit > 0 ? "win" : "loss";

    if (currentType === null) {
      currentType = type;
      currentCount = 1;
    } else if (currentType === type) {
      currentCount++;
    } else {
      break;
    }
  }

  // Compute longest streaks from all trades
  let streakType: "win" | "loss" | null = null;
  let streakLen = 0;

  for (const t of trades) {
    const profit = toNum(t.profit);
    if (profit === 0) continue;
    const type: "win" | "loss" = profit > 0 ? "win" : "loss";

    if (streakType === type) {
      streakLen++;
    } else {
      streakType = type;
      streakLen = 1;
    }

    if (type === "win" && streakLen > longestWin) longestWin = streakLen;
    if (type === "loss" && streakLen > longestLoss) longestLoss = streakLen;
  }

  return {
    currentStreak: { type: currentType, count: currentCount },
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
  };
}

function computeConsistency(trades: ClosedTrade[]): ConsistencyProfile {
  // Group trades by day
  const dailyMap = new Map<string, { count: number; pnl: number }>();

  for (const t of trades) {
    const time = t.closeTime || (t.close ? new Date(t.close) : null);
    if (!time) continue;
    const day = dateKey(new Date(time));
    const entry = dailyMap.get(day) || { count: 0, pnl: 0 };
    entry.count++;
    entry.pnl += toNum(t.profit);
    dailyMap.set(day, entry);
  }

  const dailyCounts = Array.from(dailyMap.values()).map((d) => d.count);
  const dailyPnLs = Array.from(dailyMap.values()).map((d) => d.pnl);

  const avgDaily = avg(dailyCounts);
  const stdDaily = stdDev(dailyCounts);
  const avgDailyPnL = avg(dailyPnLs);
  const stdDailyPnL = stdDev(dailyPnLs);

  // Consistency score: lower std dev relative to mean = more consistent
  // Score = max(0, 100 - (cv * 100)) where cv = coefficient of variation
  const cv = avgDaily > 0 ? stdDaily / avgDaily : 1;
  const consistencyScore = Math.max(0, Math.min(100, 100 - cv * 50));

  return {
    avgDailyTrades: avgDaily,
    stdDevDailyTrades: stdDaily,
    avgDailyPnL,
    stdDevDailyPnL: stdDailyPnL,
    consistencyScore,
  };
}

function computeOpportunityCost(
  all: ClosedTrade[],
  winners: ClosedTrade[]
): OpportunityCostProfile {
  // Try pre-computed pips first, fall back to raw price calculation
  const mfeValues: number[] = [];
  const maeValues: number[] = [];
  const profitLeftValues: number[] = [];
  const postExitMoves: number[] = [];
  let exitingTooEarlyCount = 0;
  let totalWithPostExit = 0;

  const isBuy = (t: ClosedTrade) =>
    t.tradeType?.toLowerCase() === "long" || t.tradeType?.toLowerCase() === "buy";

  for (const t of all) {
    const openP = toNum(t.openPrice);
    const closeP = toNum(t.closePrice);
    const peakP = toNum(t.entryPeakPrice);
    const postPeak = toNum(t.postExitPeakPrice);
    if (!openP || !closeP) continue;

    const long = isBuy(t);

    // MFE: How far price moved in your favor during the trade
    if (peakP > 0) {
      const mfe = long ? peakP - openP : openP - peakP;
      if (mfe > 0) mfeValues.push(mfe);
    } else if (toNum(t.mfePips) > 0) {
      mfeValues.push(toNum(t.mfePips));
    }

    // MAE: from pre-computed or skip (need low/high data we don't have)
    if (toNum(t.maePips) > 0) {
      maeValues.push(toNum(t.maePips));
    }

    // Profit left on table: entry peak vs close price (how much favorable move was NOT captured)
    if (peakP > 0) {
      const leftOnTable = long ? peakP - closeP : closeP - peakP;
      if (leftOnTable > 0) {
        profitLeftValues.push(leftOnTable);
      }
    } else if (toNum(t.mfePips) > 0 && toNum(t.pips) > 0) {
      const left = toNum(t.mfePips) - toNum(t.pips);
      if (left > 0) profitLeftValues.push(left);
    }

    // Post-exit move: did price continue favorably after closing?
    if (postPeak > 0) {
      totalWithPostExit++;
      const favorableMove = long ? postPeak - closeP : closeP - postPeak;
      if (favorableMove > 0) {
        postExitMoves.push(favorableMove);
        exitingTooEarlyCount++;
      }
    }
  }

  return {
    avgMFEPips: avg(mfeValues),
    avgMAEPips: avg(maeValues),
    avgProfitLeftPips: avg(profitLeftValues),
    avgPostExitMovePips: avg(postExitMoves),
    pctExitingTooEarly:
      totalWithPostExit > 0
        ? (exitingTooEarlyCount / totalWithPostExit) * 100
        : 0,
  };
}

// ─── Get or Compute (with caching) ──────────────────────────────

export async function getOrComputeProfile(
  accountId: string,
  userId: string
): Promise<TraderProfileData> {
  if (isAllAccountsScope(accountId)) {
    const cacheKey = profileCacheKey(accountId, userId);
    const cached = cache.get<TraderProfileData>(cacheKey);
    if (cached) return cached;

    const bundle = await computeProfileBundle(accountId, userId);
    cache.set(cacheKey, bundle.profile, PROFILE_CACHE_TTL);
    return bundle.profile;
  }

  // 1. Check in-memory cache
  const cacheKey = profileCacheKey(accountId, userId);
  const cached = cache.get<TraderProfileData>(cacheKey);
  if (cached) return cached;

  // 2. Check DB
  const dbRow = await db
    .select()
    .from(traderProfile)
    .where(eq(traderProfile.accountId, accountId))
    .limit(1);

  if (dbRow[0]) {
    const row = dbRow[0];
    // Check staleness
    const minutesSinceCompute =
      (Date.now() - new Date(row.computedAt).getTime()) / 60000;

    // Get current trade count
    const [countResult] = await db
      .select({ value: count() })
      .from(tradeTable)
      .where(
        and(
          eq(tradeTable.accountId, accountId),
          sql`${tradeTable.closeTime} IS NOT NULL`
        )
      );

    const currentCount = countResult?.value ?? 0;

    if (
      minutesSinceCompute < PROFILE_STALE_MINUTES &&
      currentCount === row.tradeCountAtCompute
    ) {
      // Fresh — cache and return
      const data = row.profileData as TraderProfileData;
      cache.set(cacheKey, data, PROFILE_CACHE_TTL);
      return data;
    }
  }

  // 3. Recompute
  const bundle = await computeProfileBundle(accountId, userId);
  await saveProfile(
    accountId,
    userId,
    bundle.profile,
    bundle.edges,
    bundle.leaks
  );
  cache.set(cacheKey, bundle.profile, PROFILE_CACHE_TTL);
  return bundle.profile;
}

export async function refreshProfileIfStale(
  accountId: string,
  userId: string,
  newTradeCount: number
): Promise<TraderProfileData> {
  if (isAllAccountsScope(accountId)) {
    const bundle = await computeProfileBundle(accountId, userId);
    cache.set(profileCacheKey(accountId, userId), bundle.profile, PROFILE_CACHE_TTL);
    return bundle.profile;
  }

  const dbRow = await db
    .select()
    .from(traderProfile)
    .where(eq(traderProfile.accountId, accountId))
    .limit(1);

  if (dbRow[0] && dbRow[0].tradeCountAtCompute === newTradeCount) {
    return dbRow[0].profileData as TraderProfileData;
  }

  const bundle = await computeProfileBundle(accountId, userId);
  await saveProfile(
    accountId,
    userId,
    bundle.profile,
    bundle.edges,
    bundle.leaks
  );
  cache.set(profileCacheKey(accountId, userId), bundle.profile, PROFILE_CACHE_TTL);
  return bundle.profile;
}

export async function saveProfile(
  accountId: string,
  userId: string,
  data: TraderProfileData,
  edges: EdgeCondition[] = [],
  leaks: LeakCondition[] = []
): Promise<void> {
  if (isAllAccountsScope(accountId)) {
    cache.set(profileCacheKey(accountId, userId), data, PROFILE_CACHE_TTL);
    return;
  }

  const [countResult] = await db
    .select({ value: count() })
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    );

  const tradeCount = countResult?.value ?? 0;

  // Upsert
  const existing = await db
    .select({ id: traderProfile.id })
    .from(traderProfile)
    .where(eq(traderProfile.accountId, accountId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(traderProfile)
      .set({
        profileData: data,
        edgeConditions: edges,
        leakConditions: leaks,
        computedAt: new Date(),
        tradeCountAtCompute: tradeCount,
        updatedAt: new Date(),
      })
      .where(eq(traderProfile.accountId, accountId));
  } else {
    await db.insert(traderProfile).values({
      accountId,
      userId,
      profileData: data,
      edgeConditions: edges,
      leakConditions: leaks,
      computedAt: new Date(),
      tradeCountAtCompute: tradeCount,
    });
  }
}

// ─── Condensed Profile for AI Prompt Injection ──────────────────

export function condenseProfile(
  data: TraderProfileData,
  edges: EdgeCondition[],
  leaks: LeakCondition[]
): CondensedProfile {
  const bestSessions = data.sessions
    .filter((s) => s.trades >= 5)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)
    .map((s) => `${s.session} (${s.winRate.toFixed(0)}% WR, ${s.trades} trades)`);

  const worstSessions = data.sessions
    .filter((s) => s.trades >= 5)
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, 3)
    .map((s) => `${s.session} (${s.winRate.toFixed(0)}% WR, ${s.trades} trades)`);

  const bestSymbols = data.symbols
    .filter((s) => s.trades >= 5)
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 3)
    .map((s) => `${s.symbol} ($${s.totalProfit.toFixed(0)}, ${s.winRate.toFixed(0)}% WR)`);

  const worstSymbols = data.symbols
    .filter((s) => s.trades >= 5)
    .sort((a, b) => a.totalProfit - b.totalProfit)
    .slice(0, 3)
    .map((s) => `${s.symbol} ($${s.totalProfit.toFixed(0)}, ${s.winRate.toFixed(0)}% WR)`);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const streakStr = data.currentStreak.type
    ? `${data.currentStreak.count} ${data.currentStreak.type} streak`
    : "no active streak";

  return {
    winRate: data.winRate,
    profitFactor: data.profitFactor,
    expectancy: data.expectancy,
    totalTrades: data.totalTrades,
    bestSessions,
    worstSessions,
    bestSymbols,
    worstSymbols,
    rrSweetSpot: `${data.rrProfile.sweetSpotMin.toFixed(1)} - ${data.rrProfile.sweetSpotMax.toFixed(1)}`,
    holdTimeSweetSpot: `${formatTime(data.holdTime.sweetSpotMin)} - ${formatTime(data.holdTime.sweetSpotMax)}`,
    topEdges: edges.slice(0, 3).map((e) => e.label),
    topLeaks: leaks.slice(0, 3).map((l) => l.label),
    leavingProfitOnTable: data.opportunityCost.pctExitingTooEarly > 30 || data.opportunityCost.avgProfitLeftPips > 0,
    avgProfitLeftPips: data.opportunityCost.avgProfitLeftPips,
    pctExitingTooEarly: data.opportunityCost.pctExitingTooEarly,
    avgPostExitMove: data.opportunityCost.avgPostExitMovePips,
    tradesWithPostExitData: 0, // will be set by caller if needed
    currentStreak: streakStr,
  };
}

// ─── Get Profile + Edge/Leak from DB ────────────────────────────

export async function getFullProfile(
  accountId: string,
  userId: string
): Promise<{
  profile: TraderProfileData;
  edges: EdgeCondition[];
  leaks: LeakCondition[];
} | null> {
  if (isAllAccountsScope(accountId)) {
    const bundle = await computeProfileBundle(accountId, userId);
    cache.set(
      profileCacheKey(accountId, userId),
      bundle.profile,
      PROFILE_CACHE_TTL
    );
    return {
      profile: bundle.profile,
      edges: bundle.edges,
      leaks: bundle.leaks,
    };
  }

  const dbRow = await db
    .select()
    .from(traderProfile)
    .where(eq(traderProfile.accountId, accountId))
    .limit(1);

  if (!dbRow[0]) {
    const bundle = await computeProfileBundle(accountId, userId);
    await saveProfile(
      accountId,
      userId,
      bundle.profile,
      bundle.edges,
      bundle.leaks
    );
    return {
      profile: bundle.profile,
      edges: bundle.edges,
      leaks: bundle.leaks,
    };
  }

  return {
    profile: dbRow[0].profileData as TraderProfileData,
    edges: (dbRow[0].edgeConditions as EdgeCondition[]) || [],
    leaks: (dbRow[0].leakConditions as LeakCondition[]) || [],
  };
}
