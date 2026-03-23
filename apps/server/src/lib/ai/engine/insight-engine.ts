/**
 * Insight Engine
 *
 * Generates proactive, profile-aware insights from trading data.
 * Replaces the basic ai-insights.ts with smarter, contextual analysis.
 *
 * Triggers: scheduled (every 30 min), trade_close, manual
 */

import { db } from "../../../db";
import { trade as tradeTable } from "../../../db/schema/trading";
import { traderInsight } from "../../../db/schema/trader-brain";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
  isAllAccountsScope,
} from "../../account-scope";
import { calculateNormalizedPipsFromPriceDelta } from "../../dukascopy";
import { getFullProfile } from "./trader-profile";
import {
  describeConditionPredicate,
  describeConditionTrades,
  matchesConditionFilters,
} from "./condition-language";
import type {
  TraderProfileData,
  EdgeCondition,
  LeakCondition,
  InsightResult,
  InsightCategory,
  InsightSeverity,
} from "./types";

type ClosedTrade = typeof tradeTable.$inferSelect;

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function isWin(t: ClosedTrade): boolean {
  return toNum(t.profit) > 0;
}

function isLongTrade(t: ClosedTrade): boolean {
  return (
    t.tradeType?.toLowerCase() === "long" ||
    t.tradeType?.toLowerCase() === "buy"
  );
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

function formatDollar(val: number): string {
  const sign = val < 0 ? "-$" : "$";
  return `${sign}${Math.abs(val).toFixed(2)}`;
}

function formatCountNoun(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// ─── Get Recent Trades ──────────────────────────────────────────

async function getRecentTrades(
  accountId: string,
  userId: string,
  days: number
): Promise<ClosedTrade[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const accountIds = await resolveScopedAccountIds(userId, accountId);

  if (accountIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(tradeTable)
    .where(
      and(
        buildAccountScopeCondition(tradeTable.accountId, accountIds),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, since)
      )
    )
    .orderBy(desc(tradeTable.closeTime));
}

async function getLatestClosedTrades(
  accountId: string,
  userId: string,
  limit: number
): Promise<ClosedTrade[]> {
  const accountIds = await resolveScopedAccountIds(userId, accountId);

  if (accountIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(tradeTable)
    .where(
      and(
        buildAccountScopeCondition(tradeTable.accountId, accountIds),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    )
    .orderBy(desc(tradeTable.closeTime))
    .limit(limit);
}

// ─── Main Insight Generator ─────────────────────────────────────

export async function generateInsights(
  accountId: string,
  userId: string,
  trigger: "scheduled" | "trade_close" | "manual"
): Promise<InsightResult[]> {
  const fullProfile = await getFullProfile(accountId, userId);
  if (!fullProfile) return [];

  const { profile, edges, leaks } = fullProfile;

  // Manual trigger is more lenient — useful when user explicitly requests insights
  const minTotalTrades = trigger === "manual" ? 5 : 15;
  const lookbackDays = trigger === "manual" ? 30 : 7;
  const minRecentTrades = trigger === "manual" ? 1 : 3;

  if (profile.totalTrades < minTotalTrades) return [];

  let recentTrades = await getRecentTrades(accountId, userId, lookbackDays);
  if (trigger === "manual" && recentTrades.length < minRecentTrades) {
    recentTrades = await getLatestClosedTrades(accountId, userId, 30);
  }
  if (recentTrades.length < minRecentTrades) return [];

  const insights: InsightResult[] = [];

  // Run all insight generators
  insights.push(...generateBehavioralInsights(recentTrades, profile));
  insights.push(...generateEfficiencyInsights(recentTrades, profile));
  insights.push(...generateRiskInsights(recentTrades, profile));
  insights.push(...generatePatternInsights(recentTrades, edges, leaks));
  insights.push(...generateAnomalyInsights(recentTrades, profile));
  insights.push(...generatePositiveInsights(recentTrades, profile));

  return insights;
}

export async function generateTradeCloseInsights(
  accountId: string,
  userId: string,
  closedTradeId: string
): Promise<InsightResult[]> {
  const fullProfile = await getFullProfile(accountId, userId);
  if (!fullProfile) return [];

  const { profile, edges, leaks } = fullProfile;
  if (profile.totalTrades < 15) return [];

  // Get the closed trade
  const [closedTrade] = await db
    .select()
    .from(tradeTable)
    .where(eq(tradeTable.id, closedTradeId))
    .limit(1);

  if (!closedTrade) return [];

  const insights: InsightResult[] = [];

  // Compare this specific trade against the profile
  insights.push(
    ...generateTradeSpecificInsights(closedTrade, profile, edges, leaks)
  );

  return insights;
}

// ─── Save Insights to DB ────────────────────────────────────────

export async function saveInsights(
  accountId: string,
  userId: string,
  insights: InsightResult[],
  trigger: string,
  triggeredBy?: string
): Promise<void> {
  if (insights.length === 0) return;
  if (isAllAccountsScope(accountId)) return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Insights expire after 7 days

  await db.insert(traderInsight).values(
    insights.map((insight) => ({
      accountId,
      userId,
      category: insight.category,
      severity: insight.severity,
      title: insight.title,
      message: insight.message,
      recommendation: insight.recommendation,
      data: insight.data,
      triggerType: trigger,
      triggeredBy: triggeredBy || null,
      expiresAt,
    }))
  );
}

// ─── 1. Behavioral Insights ────────────────────────────────────

function generateBehavioralInsights(
  recent: ClosedTrade[],
  profile: TraderProfileData
): InsightResult[] {
  const insights: InsightResult[] = [];

  // Overtrading detection
  const recentDailyMap = new Map<string, number>();
  for (const t of recent) {
    const day = t.closeTime
      ? new Date(t.closeTime).toISOString().slice(0, 10)
      : null;
    if (day) recentDailyMap.set(day, (recentDailyMap.get(day) || 0) + 1);
  }
  const recentAvgDaily =
    recentDailyMap.size > 0
      ? Array.from(recentDailyMap.values()).reduce((s, v) => s + v, 0) /
        recentDailyMap.size
      : 0;

  if (
    profile.consistency.avgDailyTrades > 0 &&
    recentAvgDaily > profile.consistency.avgDailyTrades * 1.5
  ) {
    insights.push({
      category: "behavioral",
      severity: "warning",
      title: "Increased trade frequency",
      message: `You're averaging ${recentAvgDaily.toFixed(1)} trades/day this week, up from your usual ${profile.consistency.avgDailyTrades.toFixed(1)}/day. More trades don't always mean more profit.`,
      recommendation:
        "Review whether the extra trades are meeting your setup criteria. Quality over quantity.",
      data: {
        recentAvg: recentAvgDaily,
        profileAvg: profile.consistency.avgDailyTrades,
      },
    });
  }

  // Hold time drift
  const recentHoldTimes = recent.map(holdSeconds).filter((s) => s > 0);
  const recentAvgHold =
    recentHoldTimes.length > 0
      ? recentHoldTimes.reduce((s, v) => s + v, 0) / recentHoldTimes.length
      : 0;

  if (profile.holdTime.avgAll > 0 && recentAvgHold > 0) {
    const holdDrift =
      ((recentAvgHold - profile.holdTime.avgAll) / profile.holdTime.avgAll) *
      100;

    if (Math.abs(holdDrift) > 25) {
      const direction = holdDrift > 0 ? "longer" : "shorter";
      const winningHoldComparison =
        recentAvgHold > profile.holdTime.avgWins
          ? "above your winning average"
          : "below your winning average";

      insights.push({
        category: "behavioral",
        severity: "info",
        title: `Hold times trending ${direction}`,
        message: `Your average hold time this week is ${formatDuration(recentAvgHold)} — ${Math.abs(holdDrift).toFixed(0)}% ${direction} than usual (${formatDuration(profile.holdTime.avgAll)}). This is ${winningHoldComparison} of ${formatDuration(profile.holdTime.avgWins)}.`,
        recommendation:
          profile.holdTime.avgWins > profile.holdTime.avgLosses
            ? "Your winners tend to be held longer. Consider being more patient with trades."
            : "Your winners tend to be quicker. Consider tighter management on extended holds.",
        data: {
          recentAvgHold,
          profileAvgHold: profile.holdTime.avgAll,
          winAvgHold: profile.holdTime.avgWins,
          drift: holdDrift,
        },
      });
    }
  }

  // Session drift
  const recentSessionMap = new Map<string, number>();
  for (const t of recent) {
    if (t.sessionTag)
      recentSessionMap.set(
        t.sessionTag,
        (recentSessionMap.get(t.sessionTag) || 0) + 1
      );
  }

  for (const sessionProfile of profile.sessions) {
    if (sessionProfile.winRate < 40 && sessionProfile.trades >= 5) {
      const recentCount = recentSessionMap.get(sessionProfile.session) || 0;
      if (recentCount >= 3) {
        insights.push({
          category: "behavioral",
          severity: "warning",
          title: `Active in your weakest session`,
          message: `You took ${recentCount} trades in ${sessionProfile.session} this week. Historically, your win rate in this session is only ${formatPct(sessionProfile.winRate)} (${sessionProfile.trades} trades).`,
          recommendation: `Consider reducing or avoiding ${sessionProfile.session}. Focus on your stronger sessions.`,
          data: {
            session: sessionProfile.session,
            recentCount,
            historicalWR: sessionProfile.winRate,
          },
        });
        break; // Only show one session warning
      }
    }
  }

  return insights;
}

// ─── 2. Efficiency Insights ────────────────────────────────────

function generateEfficiencyInsights(
  recent: ClosedTrade[],
  profile: TraderProfileData
): InsightResult[] {
  const insights: InsightResult[] = [];

  // Profit left on table
  const recentWinners = recent.filter(isWin);
  if (recentWinners.length >= 3) {
    const profitLeftValues: number[] = [];
    for (const t of recentWinners) {
      const openP = toNum(t.openPrice);
      const closeP = toNum(t.closePrice);
      const peakP = toNum(t.entryPeakPrice);
      const long = isLongTrade(t);
      const mfe =
        openP > 0 && peakP > 0
          ? calculateNormalizedPipsFromPriceDelta(
              long ? peakP - openP : openP - peakP,
              t.symbol
            )
          : toNum(t.mfePips);
      const pips =
        openP > 0 && closeP > 0
          ? calculateNormalizedPipsFromPriceDelta(
              long ? closeP - openP : openP - closeP,
              t.symbol
            )
          : toNum(t.pips);
      if (mfe > 0 && pips > 0) {
        const left = mfe - pips;
        if (left > 0) {
          profitLeftValues.push(left);
        }
      }
    }

    if (profitLeftValues.length >= 3) {
      const avgLeft =
        profitLeftValues.reduce((s, v) => s + v, 0) / profitLeftValues.length;

      if (avgLeft > 5) {
        insights.push({
          category: "efficiency",
          severity: "info",
          title: "Profit left on the table",
          message: `In your last ${profitLeftValues.length} winning trades, you left an average of ${avgLeft.toFixed(1)} pips on the table (MFE vs actual capture). Your historical average is ${profile.opportunityCost.avgProfitLeftPips.toFixed(1)} pips.`,
          recommendation:
            "Consider using trailing stops or partial closes to capture more of the move.",
          data: {
            recentAvgLeft: avgLeft,
            profileAvgLeft: profile.opportunityCost.avgProfitLeftPips,
          },
        });
      }
    }
  }

  // Capture efficiency drop
  const recentCaptures = recent
    .map((t) => toNum(t.rrCaptureEfficiency))
    .filter((e) => e > 0);

  if (recentCaptures.length >= 5 && profile.rrProfile.avgCaptureEfficiency > 0) {
    const recentAvgCapture =
      recentCaptures.reduce((s, v) => s + v, 0) / recentCaptures.length;
    const drop = profile.rrProfile.avgCaptureEfficiency - recentAvgCapture;

    if (drop > 10) {
      insights.push({
        category: "efficiency",
        severity: "warning",
        title: "Capture efficiency declining",
        message: `Your R:R capture efficiency dropped to ${formatPct(recentAvgCapture)} this week, down from your average of ${formatPct(profile.rrProfile.avgCaptureEfficiency)}. You're capturing less of each available move.`,
        recommendation:
          "Review your exit strategy. Are you cutting winners too short or letting losers run?",
        data: {
          recentCapture: recentAvgCapture,
          profileCapture: profile.rrProfile.avgCaptureEfficiency,
          drop,
        },
      });
    }
  }

  return insights;
}

// ─── 3. Risk Insights ──────────────────────────────────────────

function generateRiskInsights(
  recent: ClosedTrade[],
  profile: TraderProfileData
): InsightResult[] {
  const insights: InsightResult[] = [];

  // MAE increasing
  const recentMAEs = recent.map((t) => toNum(t.maePips)).filter((v) => v > 0);
  if (recentMAEs.length >= 5 && profile.opportunityCost.avgMAEPips > 0) {
    const recentAvgMAE =
      recentMAEs.reduce((s, v) => s + v, 0) / recentMAEs.length;
    const increase =
      ((recentAvgMAE - profile.opportunityCost.avgMAEPips) /
        profile.opportunityCost.avgMAEPips) *
      100;

    if (increase > 30) {
      insights.push({
        category: "risk",
        severity: "warning",
        title: "Drawdowns getting deeper",
        message: `Your average MAE (max adverse excursion) this week is ${recentAvgMAE.toFixed(1)} pips — ${increase.toFixed(0)}% higher than your usual ${profile.opportunityCost.avgMAEPips.toFixed(1)} pips. Trades are going further against you before recovering.`,
        recommendation:
          "Consider tightening your stop losses or being more selective with entries.",
        data: {
          recentMAE: recentAvgMAE,
          profileMAE: profile.opportunityCost.avgMAEPips,
          increase,
        },
      });
    }
  }

  // Volume anomaly
  const recentVolumes = recent
    .map((t) => toNum(t.volume))
    .filter((v) => v > 0);
  if (recentVolumes.length >= 5) {
    const recentAvgVol =
      recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
    // Compare against all trades' average volume from recent
    const allVolumes = recent.map((t) => toNum(t.volume)).filter((v) => v > 0);
    const overallAvg =
      allVolumes.length > 0
        ? allVolumes.reduce((s, v) => s + v, 0) / allVolumes.length
        : recentAvgVol;

    // We can't easily get historic avg volume from the profile, so use a simple heuristic
    if (recentAvgVol > overallAvg * 1.8) {
      insights.push({
        category: "risk",
        severity: "warning",
        title: "Position sizes increasing",
        message: `Your average position size has been notably larger recently. Bigger sizes amplify both gains and losses.`,
        recommendation:
          "Ensure your position sizing aligns with your risk management rules.",
        data: { recentAvgVol },
      });
    }
  }

  return insights;
}

// ─── 4. Pattern Insights ───────────────────────────────────────

function generatePatternInsights(
  recent: ClosedTrade[],
  edges: EdgeCondition[],
  leaks: LeakCondition[]
): InsightResult[] {
  const insights: InsightResult[] = [];

  // Highlight top edge condition
  if (edges.length > 0) {
    const topEdge = edges[0];
    const matchingRecent = recent.filter((t) =>
      matchesConditionFilters(t, topEdge.filters)
    );

    if (matchingRecent.length > 0) {
      const edgePredicate = describeConditionPredicate(topEdge.filters);
      insights.push({
        category: "pattern",
        severity: "positive",
        title: "Trading in your edge",
        message: `Your best trades ${edgePredicate}, with a win rate of ${formatPct(topEdge.winRate)} (${topEdge.trades} trades). You took ${formatCountNoun(matchingRecent.length, "matching trade")} this week.`,
        recommendation:
          "Keep prioritizing this type of setup when it appears and note what made it work.",
        data: { edge: topEdge, recentMatches: matchingRecent.length },
      });
    }
  }

  // Warn about leak conditions
  if (leaks.length > 0) {
    for (const leak of leaks.slice(0, 2)) {
      const matchingRecent = recent.filter((t) =>
        matchesConditionFilters(t, leak.filters)
      );

      if (matchingRecent.length >= 2) {
        const leakPredicate = describeConditionPredicate(leak.filters);
        insights.push({
          category: "pattern",
          severity: "warning",
          title: "Repeating a losing pattern",
          message: `You took ${matchingRecent.length} trades that ${leakPredicate} this week. This pattern only has a ${formatPct(leak.winRate)} win rate historically (${leak.trades} trades). Be careful, you're repeating a losing pattern.`,
          recommendation:
            "Review this setup in the trades table and tighten the filters you allow yourself to take.",
          data: { leak, recentMatches: matchingRecent.length },
        });
        break; // Only show one leak warning per cycle
      }
    }
  }

  return insights;
}

// ─── 5. Anomaly Insights ───────────────────────────────────────

function generateAnomalyInsights(
  recent: ClosedTrade[],
  profile: TraderProfileData
): InsightResult[] {
  const insights: InsightResult[] = [];

  // New symbols
  const profileSymbols = new Set(profile.symbols.map((s) => s.symbol));
  const recentSymbols = new Set(recent.map((t) => t.symbol).filter(Boolean));
  const newSymbols = [...recentSymbols].filter((s) => !profileSymbols.has(s!));

  if (newSymbols.length >= 2) {
    insights.push({
      category: "anomaly",
      severity: "info",
      title: "Exploring new symbols",
      message: `You traded ${formatCountNoun(newSymbols.length, "new symbol")} this week: ${newSymbols.join(", ")}. New symbols do not have enough personal history yet for reliable pattern analysis.`,
      recommendation:
        "Reduce position size on unfamiliar instruments until you build a track record.",
      data: { newSymbols },
    });
  }

  return insights;
}

// ─── 6. Positive Reinforcement ─────────────────────────────────

function generatePositiveInsights(
  recent: ClosedTrade[],
  profile: TraderProfileData
): InsightResult[] {
  const insights: InsightResult[] = [];

  // Win streak
  if (
    profile.currentStreak.type === "win" &&
    profile.currentStreak.count >= 3
  ) {
    insights.push({
      category: "positive",
      severity: "positive",
      title: `${profile.currentStreak.count}-trade win streak!`,
      message: `You're on a ${profile.currentStreak.count}-trade winning streak. Stay disciplined and stick to your process.`,
      recommendation:
        "Don't let the streak make you overconfident. Maintain your risk management.",
      data: { streak: profile.currentStreak.count },
    });
  }

  // Recent win rate improvement
  const recentWR =
    recent.length > 0
      ? (recent.filter(isWin).length / recent.length) * 100
      : 0;

  if (recent.length >= 5 && recentWR > profile.winRate + 10) {
    insights.push({
      category: "positive",
      severity: "positive",
      title: "Win rate improving",
      message: `Your win rate this week is ${formatPct(recentWR)} — up from your overall ${formatPct(profile.winRate)}. Whatever you're doing differently, it's working.`,
      recommendation: "Identify what changed and document it in your journal.",
      data: { recentWR, profileWR: profile.winRate },
    });
  }

  return insights;
}

// ─── Trade-Specific Insights (on close) ─────────────────────────

function generateTradeSpecificInsights(
  trade: ClosedTrade,
  profile: TraderProfileData,
  edges: EdgeCondition[],
  leaks: LeakCondition[]
): InsightResult[] {
  const insights: InsightResult[] = [];
  const profit = toNum(trade.profit);
  const wasWin = profit > 0;

  // Check if trade matched an edge condition
  for (const edge of edges.slice(0, 3)) {
    const matches = matchesConditionFilters(trade, edge.filters);

    if (matches) {
      const edgeDescription = describeConditionTrades(edge.filters);
      insights.push({
        category: "pattern",
        severity: wasWin ? "positive" : "info",
        title: wasWin
          ? "Edge condition — another win"
          : "Edge condition — rare miss",
        message: `This trade matched one of your strongest patterns. Historically, ${edgeDescription} win ${formatPct(edge.winRate)} of the time (${edge.trades} trades). ${wasWin ? "The pattern continues to hold." : "Not every strong pattern wins every time, but the odds are still in your favor."}`,
        recommendation: wasWin
          ? "Keep trading this pattern."
          : "One loss doesn't invalidate the edge. Stick to the process.",
        data: { edge, wasWin, profit },
      });
      break;
    }
  }

  // Check if trade matched a leak condition
  for (const leak of leaks.slice(0, 3)) {
    const matches = matchesConditionFilters(trade, leak.filters);

    if (matches && !wasWin) {
      const leakDescription = describeConditionTrades(leak.filters);
      insights.push({
        category: "pattern",
        severity: "warning",
        title: "Leak pattern — expected loss",
        message: `This trade matched one of your weakest patterns. Historically, ${leakDescription} win only ${formatPct(leak.winRate)} of the time (${leak.trades} trades).`,
        recommendation:
          "Review whether this setup belongs in your Edge at all, or if it needs tighter filters.",
        data: { leak, profit },
      });
      break;
    }
  }

  // Hold time comparison
  const hold = holdSeconds(trade);
  if (hold > 0 && profile.holdTime.avgWins > 0) {
    if (wasWin && hold < profile.holdTime.sweetSpotMin) {
      insights.push({
        category: "efficiency",
        severity: "info",
        title: "Quick exit on a winner",
        message: `This win was held for ${formatDuration(hold)}, shorter than your winning sweet spot (${formatDuration(profile.holdTime.sweetSpotMin)} - ${formatDuration(profile.holdTime.sweetSpotMax)}). You may have left profit on the table.`,
        recommendation: "Consider holding winners longer to capture more of the move.",
        data: { holdTime: hold, sweetSpot: profile.holdTime },
      });
    }
  }

  // Capture efficiency on this trade
  const capture = toNum(trade.rrCaptureEfficiency);
  if (capture > 0 && wasWin && capture < 30) {
    insights.push({
      category: "efficiency",
      severity: "info",
      title: "Low capture on this win",
      message: `You captured only ${formatPct(capture)} of the available R:R on this trade. Your average is ${formatPct(profile.rrProfile.avgCaptureEfficiency)}.`,
      recommendation:
        "Review your exit timing. A trailing stop or partial close strategy may help.",
      data: { capture, avgCapture: profile.rrProfile.avgCaptureEfficiency },
    });
  }

  return insights;
}
