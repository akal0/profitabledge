/**
 * Live Trade Monitor
 *
 * Monitors open trades against the trader's profile and detects
 * anomalies, deviations, and pattern matches in real-time.
 *
 * Replaces the old trade-scoring.ts with profile-aware scoring.
 */

import { db } from "../../../db";
import { openTrade as openTradeTable } from "../../../db/schema/trading";
import { traderAlert } from "../../../db/schema/trader-brain";
import { eq, and } from "drizzle-orm";
import { getFullProfile } from "./trader-profile";
import type {
  TraderProfileData,
  EdgeCondition,
  LeakCondition,
  LiveTradeAlert,
  TradeScoreResult,
  AlertType,
} from "./types";

type OpenTrade = typeof openTradeTable.$inferSelect;

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

// ─── Monitor All Open Trades ────────────────────────────────────

export async function monitorOpenTrades(
  accountId: string,
  userId: string
): Promise<LiveTradeAlert[]> {
  const fullProfile = await getFullProfile(accountId, userId);
  if (!fullProfile || fullProfile.profile.totalTrades < 15) return [];

  const { profile, edges, leaks } = fullProfile;

  // Get all open trades for this account
  const openTrades = await db
    .select()
    .from(openTradeTable)
    .where(eq(openTradeTable.accountId, accountId));

  if (openTrades.length === 0) return [];

  const allAlerts: LiveTradeAlert[] = [];

  for (const trade of openTrades) {
    const anomalies = checkForAnomalies(trade, profile);
    const conditionAlerts = checkConditionMatches(trade, edges, leaks);
    allAlerts.push(...anomalies, ...conditionAlerts);
  }

  return allAlerts;
}

// ─── Score an Open Trade ────────────────────────────────────────

export function scoreOpenTradeWithProfile(
  trade: OpenTrade,
  profile: TraderProfileData,
  edges: EdgeCondition[],
  leaks: LeakCondition[]
): TradeScoreResult {
  const factors = {
    setupAlignment: scoreSetupAlignment(trade, profile),
    rrOptimality: scoreRROptimality(trade, profile),
    timeWindow: scoreTimeWindow(trade, profile),
    assetPerformance: scoreAssetPerformance(trade, profile),
    sessionAlignment: scoreSessionAlignment(trade, profile),
  };

  const weights = {
    setupAlignment: 0.25,
    rrOptimality: 0.2,
    timeWindow: 0.2,
    assetPerformance: 0.2,
    sessionAlignment: 0.15,
  };

  const totalScore =
    factors.setupAlignment.score * weights.setupAlignment +
    factors.rrOptimality.score * weights.rrOptimality +
    factors.timeWindow.score * weights.timeWindow +
    factors.assetPerformance.score * weights.assetPerformance +
    factors.sessionAlignment.score * weights.sessionAlignment;

  // Check edge/leak matches
  const edgeMatch = findConditionMatch(trade, edges);
  const leakMatch = findConditionMatch(trade, leaks);

  const recommendation = getRecommendation(
    totalScore,
    factors,
    edgeMatch,
    leakMatch as LeakCondition | null
  );

  return {
    score: Math.round(totalScore * 10) / 10,
    factors,
    edgeMatch,
    leakMatch: leakMatch as LeakCondition | null,
    recommendation,
  };
}

// ─── Anomaly Detection ──────────────────────────────────────────

export function checkForAnomalies(
  trade: OpenTrade,
  profile: TraderProfileData
): LiveTradeAlert[] {
  const alerts: LiveTradeAlert[] = [];

  // 1. Unusual hold time
  if (trade.openTime) {
    const holdSecs =
      (Date.now() - new Date(trade.openTime).getTime()) / 1000;

    if (
      profile.holdTime.avgWins > 0 &&
      holdSecs > profile.holdTime.avgWins * 1.5
    ) {
      alerts.push({
        alertType: "unusual_hold_time",
        severity: holdSecs > profile.holdTime.avgWins * 2.5 ? "warning" : "info",
        title: "Holding longer than usual",
        message: `This trade has been open for ${formatDuration(holdSecs)}. Your winning trades average ${formatDuration(profile.holdTime.avgWins)}. Your sweet spot is ${formatDuration(profile.holdTime.sweetSpotMin)} - ${formatDuration(profile.holdTime.sweetSpotMax)}.`,
        data: {
          currentHold: holdSecs,
          avgWinHold: profile.holdTime.avgWins,
          sweetSpot: [
            profile.holdTime.sweetSpotMin,
            profile.holdTime.sweetSpotMax,
          ],
          openTradeId: trade.id,
        },
      });
    }
  }

  // 2. Weak session
  if (trade.session) {
    const sessionProfile = profile.sessions.find(
      (s) => s.session === trade.session
    );
    if (sessionProfile && sessionProfile.winRate < 40 && sessionProfile.trades >= 5) {
      alerts.push({
        alertType: "unusual_session",
        severity: "warning",
        title: `Weak session: ${trade.session}`,
        message: `Your win rate in ${trade.session} is only ${formatPct(sessionProfile.winRate)} (${sessionProfile.trades} trades). This is one of your weaker sessions.`,
        data: {
          session: trade.session,
          winRate: sessionProfile.winRate,
          trades: sessionProfile.trades,
          openTradeId: trade.id,
        },
      });
    }
  }

  // 3. Weak or unfamiliar symbol
  if (trade.symbol) {
    const symbolProfile = profile.symbols.find(
      (s) => s.symbol === trade.symbol
    );
    if (!symbolProfile || symbolProfile.trades < 5) {
      alerts.push({
        alertType: "unusual_symbol",
        severity: "info",
        title: `Limited history: ${trade.symbol}`,
        message: `You have ${symbolProfile?.trades ?? 0} historical trades on ${trade.symbol}. Consider reducing size on unfamiliar instruments.`,
        data: {
          symbol: trade.symbol,
          historicalTrades: symbolProfile?.trades ?? 0,
          openTradeId: trade.id,
        },
      });
    } else if (symbolProfile.totalProfit < 0 && symbolProfile.trades >= 5) {
      alerts.push({
        alertType: "unusual_symbol",
        severity: "warning",
        title: `Negative history: ${trade.symbol}`,
        message: `${trade.symbol} has lost you $${Math.abs(symbolProfile.totalProfit).toFixed(2)} across ${symbolProfile.trades} trades (${formatPct(symbolProfile.winRate)} WR).`,
        data: {
          symbol: trade.symbol,
          totalProfit: symbolProfile.totalProfit,
          winRate: symbolProfile.winRate,
          openTradeId: trade.id,
        },
      });
    }
  }

  // 4. Unusual volume
  // We don't have avg volume in the profile directly, so we check against a reasonable threshold
  const vol = toNum(trade.volume);
  if (vol > 0) {
    // Simple check: volume > 2x the lot size typically seen
    // This would need enrichment from the profile in a future iteration
  }

  // 5. Protocol deviation
  if (
    trade.protocolAlignment === "against" &&
    profile.protocolStats.againstWinRate < 40 &&
    profile.protocolStats.againstCount >= 5
  ) {
    alerts.push({
      alertType: "protocol_deviation",
      severity: "critical",
      title: "Trading against your protocol",
      message: `This trade is marked "against protocol". Your against-protocol win rate is only ${formatPct(profile.protocolStats.againstWinRate)} (${profile.protocolStats.againstCount} trades). Protocol-aligned trades win at ${formatPct(profile.protocolStats.alignedWinRate)}.`,
      data: {
        protocolAlignment: trade.protocolAlignment,
        againstWR: profile.protocolStats.againstWinRate,
        alignedWR: profile.protocolStats.alignedWinRate,
        openTradeId: trade.id,
      },
    });
  }

  return alerts;
}

// ─── Condition Matching ─────────────────────────────────────────

function checkConditionMatches(
  trade: OpenTrade,
  edges: EdgeCondition[],
  leaks: LeakCondition[]
): LiveTradeAlert[] {
  const alerts: LiveTradeAlert[] = [];

  // Check leak conditions (more important to warn about)
  const leakMatch = findConditionMatch(trade, leaks);
  if (leakMatch) {
    alerts.push({
      alertType: "leak_condition_match",
      severity: "critical",
      title: "Matches a losing pattern",
      message: `This trade matches your leak pattern "${leakMatch.label}" which has only a ${formatPct(leakMatch.winRate)} win rate (${leakMatch.trades} trades). Consider your risk carefully.`,
      data: { leak: leakMatch, openTradeId: trade.id },
    });
  }

  // Check edge conditions (positive reinforcement)
  const edgeMatch = findConditionMatch(trade, edges);
  if (edgeMatch && !leakMatch) {
    alerts.push({
      alertType: "edge_condition_match",
      severity: "info",
      title: "Matches a winning pattern",
      message: `This trade matches your edge pattern "${edgeMatch.label}" with a ${formatPct(edgeMatch.winRate)} win rate (${edgeMatch.trades} trades). Trust your process.`,
      data: { edge: edgeMatch, openTradeId: trade.id },
    });
  }

  return alerts;
}

function findConditionMatch<
  T extends { filters: Record<string, string | number> }
>(trade: OpenTrade, conditions: T[]): T | null {
  for (const cond of conditions) {
    const matches = Object.entries(cond.filters).every(([dim, val]) => {
      const strVal = String(val);
      if (dim === "symbol") return trade.symbol === strVal;
      if (dim === "session") return trade.session === strVal;
      if (dim === "model") return trade.modelTag === strVal;
      if (dim === "protocol") return trade.protocolAlignment === strVal;
      if (dim === "direction") return trade.tradeType === strVal;
      // Skip bucket dimensions for open trades (we don't know final values)
      return true;
    });

    // Only match if at least one non-bucket dimension matched
    const nonBucketDims = Object.keys(cond.filters).filter(
      (d) =>
        !["rrBucket", "holdBucket", "hourBucket", "weekday"].includes(d)
    );

    if (matches && nonBucketDims.length > 0) return cond;
  }
  return null;
}

// ─── Scoring Functions ──────────────────────────────────────────

function scoreSetupAlignment(
  trade: OpenTrade,
  profile: TraderProfileData
): { score: number; reason: string } {
  if (trade.protocolAlignment === "aligned") {
    if (profile.protocolStats.alignedWinRate > 55) {
      return {
        score: 9,
        reason: `Protocol-aligned trades win at ${formatPct(profile.protocolStats.alignedWinRate)}`,
      };
    }
    return { score: 7, reason: "Aligned with your trading protocol" };
  }

  if (trade.protocolAlignment === "against") {
    return {
      score: Math.max(2, Math.min(5, profile.protocolStats.againstWinRate / 10)),
      reason: `Against-protocol trades win at ${formatPct(profile.protocolStats.againstWinRate)}`,
    };
  }

  return { score: 5, reason: "Discretionary trade" };
}

function scoreRROptimality(
  trade: OpenTrade,
  profile: TraderProfileData
): { score: number; reason: string } {
  const plannedRR = toNum(trade.sl) > 0 && toNum(trade.tp) > 0
    ? Math.abs(toNum(trade.tp) - toNum(trade.openPrice)) /
      Math.abs(toNum(trade.openPrice) - toNum(trade.sl))
    : 0;

  if (plannedRR <= 0) {
    return { score: 5, reason: "No R:R data available" };
  }

  const inSweetSpot =
    plannedRR >= profile.rrProfile.sweetSpotMin &&
    plannedRR <= profile.rrProfile.sweetSpotMax;

  if (inSweetSpot) {
    return {
      score: 9,
      reason: `R:R ${plannedRR.toFixed(1)} is in your sweet spot (${profile.rrProfile.sweetSpotMin.toFixed(1)}-${profile.rrProfile.sweetSpotMax.toFixed(1)}, ${formatPct(profile.rrProfile.sweetSpotWinRate)} WR)`,
    };
  }

  if (plannedRR < profile.rrProfile.sweetSpotMin) {
    return {
      score: 4,
      reason: `R:R ${plannedRR.toFixed(1)} is below your sweet spot (${profile.rrProfile.sweetSpotMin.toFixed(1)}-${profile.rrProfile.sweetSpotMax.toFixed(1)})`,
    };
  }

  return {
    score: 6,
    reason: `R:R ${plannedRR.toFixed(1)} is above your sweet spot — high target`,
  };
}

function scoreTimeWindow(
  trade: OpenTrade,
  profile: TraderProfileData
): { score: number; reason: string } {
  if (!trade.openTime) {
    return { score: 5, reason: "No entry time data" };
  }

  const hour = new Date(trade.openTime).getUTCHours();
  const hourProfile = profile.hourlyProfile.find((h) => h.hour === hour);

  if (!hourProfile || hourProfile.trades < 3) {
    return { score: 6, reason: "Limited data for this time window" };
  }

  if (hourProfile.winRate > 60 && hourProfile.avgProfit > 0) {
    return {
      score: 9,
      reason: `${hour}:00 UTC is a strong window for you (${formatPct(hourProfile.winRate)} WR)`,
    };
  }

  if (hourProfile.winRate < 40 || hourProfile.avgProfit < 0) {
    return {
      score: 3,
      reason: `${hour}:00 UTC is a weak window (${formatPct(hourProfile.winRate)} WR)`,
    };
  }

  return {
    score: 6,
    reason: `${hour}:00 UTC: ${formatPct(hourProfile.winRate)} win rate`,
  };
}

function scoreAssetPerformance(
  trade: OpenTrade,
  profile: TraderProfileData
): { score: number; reason: string } {
  if (!trade.symbol) {
    return { score: 5, reason: "No symbol data" };
  }

  const symbolProfile = profile.symbols.find(
    (s) => s.symbol === trade.symbol
  );

  if (!symbolProfile || symbolProfile.trades < 5) {
    return { score: 5, reason: `Limited history with ${trade.symbol}` };
  }

  if (symbolProfile.winRate > 60 && symbolProfile.totalProfit > 0) {
    return {
      score: 9,
      reason: `${trade.symbol} is a strong pair for you (${formatPct(symbolProfile.winRate)} WR)`,
    };
  }

  if (symbolProfile.winRate < 40 || symbolProfile.totalProfit < 0) {
    return {
      score: 3,
      reason: `${trade.symbol} has been weak (${formatPct(symbolProfile.winRate)} WR)`,
    };
  }

  return {
    score: 6,
    reason: `${trade.symbol}: ${formatPct(symbolProfile.winRate)} win rate`,
  };
}

function scoreSessionAlignment(
  trade: OpenTrade,
  profile: TraderProfileData
): { score: number; reason: string } {
  if (!trade.session) {
    return { score: 5, reason: "No session data" };
  }

  const sessionProfile = profile.sessions.find(
    (s) => s.session === trade.session
  );

  if (!sessionProfile || sessionProfile.trades < 5) {
    return { score: 6, reason: "Limited session history" };
  }

  if (sessionProfile.winRate > 60) {
    return {
      score: 9,
      reason: `${trade.session}: ${formatPct(sessionProfile.winRate)} win rate`,
    };
  }

  if (sessionProfile.winRate < 40) {
    return {
      score: 3,
      reason: `${trade.session}: only ${formatPct(sessionProfile.winRate)} win rate`,
    };
  }

  return {
    score: 6,
    reason: `${trade.session}: ${formatPct(sessionProfile.winRate)} win rate`,
  };
}

function getRecommendation(
  score: number,
  factors: TradeScoreResult["factors"],
  edgeMatch: EdgeCondition | null,
  leakMatch: LeakCondition | null
): string {
  if (leakMatch) {
    return `This trade matches a losing pattern (${leakMatch.label}). Consider passing or reducing size significantly.`;
  }

  if (edgeMatch && score >= 7) {
    return `High-quality setup matching your edge pattern (${edgeMatch.label}). Trust your process.`;
  }

  if (score >= 8) {
    return "Strong setup matching your best patterns. Manage according to plan.";
  }

  if (score >= 6) {
    return "Acceptable setup. Watch the flagged factors and manage risk accordingly.";
  }

  return "This trade deviates from your winning patterns. Consider passing or reducing size.";
}

// ─── Save Alerts to DB ──────────────────────────────────────────

export async function saveAlerts(
  accountId: string,
  userId: string,
  alerts: LiveTradeAlert[],
  openTradeId?: string
): Promise<void> {
  if (alerts.length === 0) return;

  await db.insert(traderAlert).values(
    alerts.map((alert) => ({
      accountId,
      userId,
      openTradeId: openTradeId || (alert.data?.openTradeId as string) || null,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
    }))
  );
}
