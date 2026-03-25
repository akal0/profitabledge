/**
 * Digest Generator
 *
 * Generates personalized daily briefings, post-trade feedback cards,
 * and milestone reports for the proactive AI coaching system.
 *
 * Features:
 * - Morning briefing (latest closed-trade-day review + today outlook + weekly progress + focus item)
 * - Post-trade instant feedback (score, edge/leak match, comparisons, what-if)
 * - Milestone reports (at 10, 25, 50, 100, 250, 500 trades)
 */

import { db } from "../../../db";
import { trade as tradeTable } from "../../../db/schema/trading";
import { traderDigest } from "../../../db/schema/coaching";
import { eq, and, sql, gte, desc, between } from "drizzle-orm";
import { getFullProfile } from "./trader-profile";
import { scoreOpenTradeWithProfile } from "./live-monitor";
import type {
  TraderProfileData,
  EdgeCondition,
  LeakCondition,
  CondensedProfile,
} from "./types";

type ClosedTrade = typeof tradeTable.$inferSelect;

export type BriefingReviewSnapshot = {
  tradeCount: number;
  wins: number;
  winRate: number;
  pnl: number;
  bestTrade?: string;
  worstTrade?: string;
  edgeMatches: number;
  leakMatches: number;
  reviewedAt: string;
  reviewLabel: "Today's review" | "Yesterday's review" | "Latest trading day";
};

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function formatDollar(val: number): string {
  const sign = val < 0 ? "-$" : "$";
  return `${sign}${Math.abs(val).toFixed(2)}`;
}

function formatPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
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

function tradeNetPnl(trade: ClosedTrade): number {
  return (
    toNum(trade.profit) + toNum(trade.commissions) + toNum(trade.swap)
  );
}

function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatTradeSummary(trade: ClosedTrade, pnl: number): string {
  return `${trade.symbol} ${trade.tradeType} → ${formatDollar(pnl)}`;
}

function reviewLabelNarrativePrefix(
  reviewLabel: BriefingReviewSnapshot["reviewLabel"]
) {
  switch (reviewLabel) {
    case "Today's review":
      return "Today";
    case "Yesterday's review":
      return "Yesterday";
    default:
      return "On your latest trading day";
  }
}

async function getMorningReviewTrades(accountId: string) {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = addDays(todayStart, -1);

  const [latestClosedTrade] = await db
    .select({
      closeTime: tradeTable.closeTime,
    })
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    )
    .orderBy(desc(tradeTable.closeTime))
    .limit(1);

  if (!latestClosedTrade?.closeTime) {
    return null;
  }

  const latestCloseTime = new Date(latestClosedTrade.closeTime);
  const latestTradeDayStart = startOfLocalDay(latestCloseTime);
  const latestTradeIsYesterday =
    latestCloseTime >= yesterdayStart && latestCloseTime < todayStart;

  const reviewDayStart = latestTradeIsYesterday
    ? yesterdayStart
    : latestTradeDayStart;
  const reviewDayEnd = addDays(reviewDayStart, 1);

  const reviewTrades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, reviewDayStart),
        sql`${tradeTable.closeTime} < ${reviewDayEnd}`
      )
    )
    .orderBy(desc(tradeTable.closeTime));

  const reviewLabel: BriefingReviewSnapshot["reviewLabel"] =
    reviewDayStart.getTime() === todayStart.getTime()
      ? "Today's review"
      : latestTradeIsYesterday
        ? "Yesterday's review"
        : "Latest trading day";

  return {
    reviewTrades,
    reviewDayStart,
    reviewLabel,
  };
}

export async function getLatestBriefingReviewSnapshot(
  accountId: string,
  edges: EdgeCondition[] = [],
  leaks: LeakCondition[] = []
): Promise<BriefingReviewSnapshot | null> {
  const reviewData = await getMorningReviewTrades(accountId);
  if (!reviewData) {
    return null;
  }

  const { reviewTrades, reviewDayStart, reviewLabel } = reviewData;
  const reviewWins = reviewTrades.filter((trade) => tradeNetPnl(trade) > 0);
  const reviewPnL = reviewTrades.reduce(
    (sum, trade) => sum + tradeNetPnl(trade),
    0
  );

  let bestTrade: string | undefined;
  let worstTrade: string | undefined;
  if (reviewTrades.length > 0) {
    const sortedByPnl = [...reviewTrades].sort(
      (left, right) => tradeNetPnl(right) - tradeNetPnl(left)
    );
    const best = sortedByPnl[0];
    const worst = sortedByPnl[sortedByPnl.length - 1];
    bestTrade = formatTradeSummary(best, tradeNetPnl(best));
    worstTrade = formatTradeSummary(worst, tradeNetPnl(worst));
  }

  return {
    tradeCount: reviewTrades.length,
    wins: reviewWins.length,
    winRate:
      reviewTrades.length > 0
        ? (reviewWins.length / reviewTrades.length) * 100
        : 0,
    pnl: reviewPnL,
    bestTrade,
    worstTrade,
    edgeMatches: countEdgeMatches(reviewTrades, edges),
    leakMatches: countLeakMatches(reviewTrades, leaks),
    reviewedAt: reviewDayStart.toISOString(),
    reviewLabel,
  };
}

// ─── Morning Briefing ───────────────────────────────────────────

export async function generateMorningBriefing(
  accountId: string,
  userId: string
): Promise<typeof traderDigest.$inferInsert | null> {
  const fullProfile = await getFullProfile(accountId, userId);
  if (!fullProfile || fullProfile.profile.totalTrades < 5) return null;

  const { profile, edges, leaks } = fullProfile;
  const reviewSnapshot = await getLatestBriefingReviewSnapshot(
    accountId,
    edges,
    leaks
  );
  if (!reviewSnapshot) return null;

  // Get last 7 days of trades for weekly progress
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyTrades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, weekAgo)
      )
    );

  // Build outlook
  const bestSessions = profile.sessions
    .filter((s) => s.trades >= 5 && s.winRate > 55)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)
    .map((s) => s.session);

  const avoidSessions = profile.sessions
    .filter((s) => s.trades >= 5 && s.winRate < 40)
    .map((s) => s.session);

  const focusSymbols = profile.symbols
    .filter((s) => s.trades >= 5 && s.winRate > 55)
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 3)
    .map((s) => s.symbol);

  const streakContext =
    profile.currentStreak.type === "win"
      ? `You're on a ${profile.currentStreak.count}-trade win streak. Stay disciplined — your data shows overconfidence after 4+ wins.`
      : profile.currentStreak.type === "loss"
        ? `You're on a ${profile.currentStreak.count}-trade losing streak. Reduce size or take a break — recovery comes from patience.`
        : "No active streak. Fresh start today.";

  // Build weekly progress
  const weeklyWins = weeklyTrades.filter((t) => toNum(t.profit) > 0);
  const weeklyWR =
    weeklyTrades.length > 0
      ? (weeklyWins.length / weeklyTrades.length) * 100
      : 0;
  const weeklyPnL = weeklyTrades.reduce((s, t) => s + toNum(t.profit), 0);

  const vs30DayAvgWR = weeklyWR - profile.winRate;
  const vs30DayAvgPnL =
    weeklyPnL - profile.consistency.avgDailyPnL * 7;

  let trend: "improving" | "stable" | "declining" = "stable";
  if (vs30DayAvgWR > 5) trend = "improving";
  else if (vs30DayAvgWR < -5) trend = "declining";

  // Build focus item
  let focusItem: {
    title: string;
    message: string;
    type: "edge" | "leak" | "rule" | "psychology";
  };

  if (leaks.length > 0 && reviewSnapshot.leakMatches > 0) {
    focusItem = {
      title: `Stop the leak: ${leaks[0].label}`,
      message: `${reviewLabelNarrativePrefix(reviewSnapshot.reviewLabel)} you took ${reviewSnapshot.leakMatches} trade(s) matching your worst leak pattern. This pattern has a ${formatPct(leaks[0].winRate)} win rate. Avoid it today.`,
      type: "leak",
    };
  } else if (edges.length > 0) {
    focusItem = {
      title: `Focus on your edge: ${edges[0].label}`,
      message: `Your best pattern has a ${formatPct(edges[0].winRate)} win rate across ${edges[0].trades} trades. Look for this setup today.`,
      type: "edge",
    };
  } else {
    focusItem = {
      title: "Trade your plan",
      message:
        "Stick to your protocol-aligned setups. Discipline is the foundation of profitability.",
      type: "rule",
    };
  }

  // Build narrative
  const parts: string[] = [];
  if (reviewSnapshot.tradeCount > 0) {
    parts.push(
      `${reviewSnapshot.reviewLabel}: ${reviewSnapshot.tradeCount} trades, ${reviewSnapshot.wins} wins (${formatPct(reviewSnapshot.winRate)}), ${formatDollar(reviewSnapshot.pnl)} P&L.`
    );
  } else {
    parts.push("No recent closed trades to review — rest days are part of the process.");
  }
  parts.push(
    `This week: ${formatPct(weeklyWR)} win rate, ${formatDollar(weeklyPnL)} total. ${trend === "improving" ? "Trending up." : trend === "declining" ? "Watch the downtrend." : "Holding steady."}`
  );
  parts.push(`Today's focus: ${focusItem.message}`);

  return {
    accountId,
    userId,
    digestType: "morning",
    content: {
      review: {
        tradesToday: reviewSnapshot.tradeCount,
        winRate: reviewSnapshot.winRate,
        pnl: reviewSnapshot.pnl,
        bestTrade: reviewSnapshot.bestTrade,
        worstTrade: reviewSnapshot.worstTrade,
        edgeMatches: reviewSnapshot.edgeMatches,
        leakMatches: reviewSnapshot.leakMatches,
        reviewedAt: reviewSnapshot.reviewedAt,
        label: reviewSnapshot.reviewLabel,
      },
      outlook: {
        recommendedSessions: bestSessions,
        avoidSessions,
        focusSymbols,
        streakContext,
      },
      progress: {
        weeklyWinRate: weeklyWR,
        weeklyPnL,
        vs30DayAvgWR,
        vs30DayAvgPnL,
        trend,
      },
      focusItem,
      narrative: parts.join("\n\n"),
    },
  };
}

// ─── Post-Trade Feedback ────────────────────────────────────────

export async function generateTradeFeedback(
  accountId: string,
  userId: string,
  closedTradeId: string
): Promise<typeof traderDigest.$inferInsert | null> {
  const fullProfile = await getFullProfile(accountId, userId);
  if (!fullProfile) return null;

  const { profile, edges, leaks } = fullProfile;

  // Get the closed trade
  const [closedTrade] = await db
    .select()
    .from(tradeTable)
    .where(eq(tradeTable.id, closedTradeId))
    .limit(1);

  if (!closedTrade) return null;

  const profit = toNum(closedTrade.profit);
  const isWin = profit > 0;
  const hold = holdSeconds(closedTrade);
  const rr = toNum(closedTrade.realisedRR);

  // Score the trade
  let score = 50; // baseline
  const factors: string[] = [];

  // Edge match check
  let edgeMatchLabel: string | null = null;
  for (const edge of edges.slice(0, 5)) {
    if (matchesTrade(closedTrade, edge.filters)) {
      edgeMatchLabel = edge.label;
      score += 15;
      factors.push(`Matched edge pattern "${edge.label}"`);
      break;
    }
  }

  // Leak match check
  let leakMatchLabel: string | null = null;
  for (const leak of leaks.slice(0, 5)) {
    if (matchesTrade(closedTrade, leak.filters)) {
      leakMatchLabel = leak.label;
      score -= 20;
      factors.push(`Matched leak pattern "${leak.label}"`);
      break;
    }
  }

  // Protocol alignment
  if (closedTrade.protocolAlignment === "aligned") {
    score += 10;
    factors.push("Protocol-aligned");
  } else if (closedTrade.protocolAlignment === "against") {
    score -= 15;
    factors.push("Against protocol");
  }

  // Hold time in sweet spot
  let holdTimeComparison = "No hold time data";
  if (hold > 0) {
    if (
      hold >= profile.holdTime.sweetSpotMin &&
      hold <= profile.holdTime.sweetSpotMax
    ) {
      score += 10;
      holdTimeComparison = `${formatDuration(hold)} — in your sweet spot (${formatDuration(profile.holdTime.sweetSpotMin)}-${formatDuration(profile.holdTime.sweetSpotMax)})`;
    } else if (hold < profile.holdTime.sweetSpotMin) {
      holdTimeComparison = `${formatDuration(hold)} — shorter than sweet spot (${formatDuration(profile.holdTime.sweetSpotMin)}-${formatDuration(profile.holdTime.sweetSpotMax)})`;
    } else {
      holdTimeComparison = `${formatDuration(hold)} — longer than sweet spot`;
    }
  }

  // RR in sweet spot
  let rrComparison = "No R:R data";
  if (rr > 0) {
    if (
      rr >= profile.rrProfile.sweetSpotMin &&
      rr <= profile.rrProfile.sweetSpotMax
    ) {
      score += 10;
      rrComparison = `${rr.toFixed(1)}R — in your sweet spot`;
    } else {
      rrComparison = `${rr.toFixed(1)}R — outside sweet spot (${profile.rrProfile.sweetSpotMin.toFixed(1)}-${profile.rrProfile.sweetSpotMax.toFixed(1)}R)`;
    }
  }

  // Win/loss bonus
  if (isWin) score += 5;
  else score -= 5;

  score = Math.max(0, Math.min(100, score));

  // What-if analysis
  let whatIf: string | null = null;
  const postExitPeak = toNum(closedTrade.postExitPeakPrice);
  const closePrice = toNum(closedTrade.closePrice);
  if (postExitPeak > 0 && closePrice > 0) {
    const normalizedDirection = String(closedTrade.tradeType || "").toLowerCase();
    const direction =
      normalizedDirection === "buy" || normalizedDirection === "long" ? 1 : -1;
    const additionalMove = (postExitPeak - closePrice) * direction;
    if (additionalMove > 0) {
      whatIf = `Price moved ${additionalMove.toFixed(2)} points further in your favor after exit.`;
    }
  }

  // AI comment
  const aiComment = buildTradeComment(
    isWin,
    score,
    edgeMatchLabel,
    leakMatchLabel,
    holdTimeComparison,
    closedTrade
  );

  return {
    accountId,
    userId,
    digestType: "trade_close",
    content: {
      tradeFeedback: {
        tradeId: closedTradeId,
        score,
        edgeMatch: edgeMatchLabel,
        leakMatch: leakMatchLabel,
        holdTimeComparison,
        rrComparison,
        whatIf,
        aiComment,
      },
      narrative: aiComment,
    },
  };
}

// ─── Milestone Reports ──────────────────────────────────────────

export async function checkAndGenerateMilestone(
  accountId: string,
  userId: string,
  currentTradeCount: number
): Promise<typeof traderDigest.$inferInsert | null> {
  const milestones = [10, 25, 50, 100, 250, 500, 1000];
  const milestone = milestones.find((m) => currentTradeCount === m);
  if (!milestone) return null;

  const fullProfile = await getFullProfile(accountId, userId);
  if (!fullProfile) return null;

  const { profile, edges, leaks } = fullProfile;

  const highlights: string[] = [];
  const improvements: string[] = [];

  // Highlights
  if (profile.winRate > 50) {
    highlights.push(
      `Win rate: ${formatPct(profile.winRate)} — above breakeven`
    );
  }
  if (profile.profitFactor > 1) {
    highlights.push(
      `Profit factor: ${profile.profitFactor.toFixed(2)} — every $1 lost earns back $${profile.profitFactor.toFixed(2)}`
    );
  }
  if (edges.length > 0) {
    highlights.push(
      `Discovered ${edges.length} edge condition(s). Best: "${edges[0].label}" (${formatPct(edges[0].winRate)} WR)`
    );
  }
  if (
    profile.currentStreak.type === "win" &&
    profile.currentStreak.count >= 3
  ) {
    highlights.push(
      `Currently on a ${profile.currentStreak.count}-trade win streak`
    );
  }

  // Improvements
  if (profile.winRate < 50) {
    improvements.push(
      `Win rate at ${formatPct(profile.winRate)} — focus on higher-probability setups`
    );
  }
  if (leaks.length > 0) {
    improvements.push(
      `${leaks.length} leak pattern(s) detected. Worst: "${leaks[0].label}" (${formatPct(leaks[0].winRate)} WR)`
    );
  }
  if (profile.opportunityCost.pctExitingTooEarly > 50) {
    improvements.push(
      `Exiting too early on ${formatPct(profile.opportunityCost.pctExitingTooEarly)} of trades — consider trailing stops`
    );
  }

  return {
    accountId,
    userId,
    digestType: "milestone",
    content: {
      milestone: {
        milestoneName: `${milestone} Trades`,
        tradeCount: milestone,
        highlights,
        improvements,
      },
      narrative: `Congratulations on ${milestone} trades! Here's your progress summary.`,
    },
  };
}

// ─── Save Digest ────────────────────────────────────────────────

export async function saveDigest(
  digest: typeof traderDigest.$inferInsert
): Promise<void> {
  await db.insert(traderDigest).values(digest);
}

// ─── Internal Helpers ───────────────────────────────────────────

function matchesTrade(
  trade: ClosedTrade,
  filters: Record<string, string | number>
): boolean {
  return Object.entries(filters).every(([dim, val]) => {
    const strVal = String(val);
    if (dim === "symbol") return trade.symbol === strVal;
    if (dim === "session") return trade.sessionTag === strVal;
    if (dim === "model") return trade.modelTag === strVal;
    if (dim === "protocol") return trade.protocolAlignment === strVal;
    if (dim === "direction") return trade.tradeType === strVal;
    return true;
  });
}

function countEdgeMatches(
  trades: ClosedTrade[],
  edges: EdgeCondition[]
): number {
  let count = 0;
  for (const trade of trades) {
    for (const edge of edges.slice(0, 5)) {
      if (matchesTrade(trade, edge.filters)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function countLeakMatches(
  trades: ClosedTrade[],
  leaks: LeakCondition[]
): number {
  let count = 0;
  for (const trade of trades) {
    for (const leak of leaks.slice(0, 5)) {
      if (matchesTrade(trade, leak.filters)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function buildTradeComment(
  isWin: boolean,
  score: number,
  edgeMatch: string | null,
  leakMatch: string | null,
  holdComparison: string,
  trade: ClosedTrade
): string {
  const parts: string[] = [];

  if (isWin && score >= 70) {
    parts.push("Solid trade execution.");
  } else if (isWin && score < 70) {
    parts.push("A win, but the setup quality could be better.");
  } else if (!isWin && leakMatch) {
    parts.push(
      `This loss was expected — it matched your leak pattern "${leakMatch}". Consider removing this setup.`
    );
  } else if (!isWin && score >= 50) {
    parts.push(
      "A loss on a reasonable setup. Not every trade will win — trust the process."
    );
  } else {
    parts.push(
      "This trade had multiple red flags. Review what pulled you in."
    );
  }

  if (edgeMatch) {
    parts.push(`Matched your edge: "${edgeMatch}".`);
  }

  return parts.join(" ");
}
