/**
 * Session Tracker
 *
 * Tracks the trader's current trading session in real-time.
 * Detects patterns within a session: overtrading, tilt, time between trades,
 * and provides contextual coaching nudges.
 *
 * Features:
 * - Session state tracking (trade count, running P&L, time between trades)
 * - Intra-session tilt detection (rapid re-entries, increasing size after losses)
 * - Contextual coaching nudges ("You're approaching your sweet spot exit window")
 * - Session summary on completion
 */

import { db } from "../../../db";
import {
  trade as tradeTable,
  openTrade as openTradeTable,
} from "../../../db/schema/trading";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import type { TraderProfileData } from "./types";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../../account-scope";

// ─── Types ──────────────────────────────────────────────────────

export interface SessionState {
  sessionStart: string; // ISO timestamp
  tradeCount: number;
  openTradeCount: number;
  closedTradeCount: number;
  wins: number;
  losses: number;
  runningPnL: number;
  avgTimeBetweenTrades: number; // seconds
  lastTradeTime: string | null;
  currentStreak: { type: "win" | "loss" | null; count: number };
  volumeProgression: number[]; // position sizes in order
  isActive: boolean;
}

export interface CoachingNudge {
  type:
    | "overtrading_warning"
    | "tilt_alert"
    | "take_a_break"
    | "size_creep"
    | "loss_recovery"
    | "session_limit"
    | "positive_reinforcement"
    | "exit_window";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  data?: Record<string, any>;
}

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

// ─── Get Current Session State ──────────────────────────────────

export async function getCurrentSessionState(
  accountId: string,
  sessionWindowHours: number = 8,
  userId?: string
): Promise<SessionState> {
  const scopedAccountIds = userId
    ? await resolveScopedAccountIds(userId, accountId)
    : [accountId];

  if (scopedAccountIds.length === 0) {
    return {
      sessionStart: new Date().toISOString(),
      tradeCount: 0,
      openTradeCount: 0,
      closedTradeCount: 0,
      wins: 0,
      losses: 0,
      runningPnL: 0,
      avgTimeBetweenTrades: 0,
      lastTradeTime: null,
      currentStreak: { type: null, count: 0 },
      volumeProgression: [],
      isActive: false,
    };
  }

  const since = new Date();
  since.setHours(since.getHours() - sessionWindowHours);

  // Get closed trades in current session window
  const closedTrades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        buildAccountScopeCondition(tradeTable.accountId, scopedAccountIds),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, since)
      )
    )
    .orderBy(tradeTable.closeTime);

  // Get open trades
  const openTrades = await db
    .select()
    .from(openTradeTable)
    .where(buildAccountScopeCondition(openTradeTable.accountId, scopedAccountIds));

  const wins = closedTrades.filter((t) => toNum(t.profit) > 0).length;
  const losses = closedTrades.filter((t) => toNum(t.profit) <= 0).length;
  const runningPnL = closedTrades.reduce(
    (s, t) => s + toNum(t.profit),
    0
  );

  // Calculate time between trades
  const tradeTimes: number[] = [];
  for (let i = 1; i < closedTrades.length; i++) {
    const prev = closedTrades[i - 1];
    const curr = closedTrades[i];
    if (prev.closeTime && curr.openTime) {
      const gap =
        new Date(curr.openTime).getTime() -
        new Date(prev.closeTime).getTime();
      if (gap > 0) tradeTimes.push(gap / 1000);
    }
  }
  const avgTimeBetween =
    tradeTimes.length > 0
      ? tradeTimes.reduce((s, v) => s + v, 0) / tradeTimes.length
      : 0;

  // Current streak
  let streakType: "win" | "loss" | null = null;
  let streakCount = 0;
  for (let i = closedTrades.length - 1; i >= 0; i--) {
    const isWin = toNum(closedTrades[i].profit) > 0;
    if (streakType === null) {
      streakType = isWin ? "win" : "loss";
      streakCount = 1;
    } else if ((isWin && streakType === "win") || (!isWin && streakType === "loss")) {
      streakCount++;
    } else {
      break;
    }
  }

  // Volume progression
  const volumes = closedTrades.map((t) => toNum(t.volume)).filter((v) => v > 0);

  const lastTrade = closedTrades[closedTrades.length - 1];
  const sessionStart =
    closedTrades.length > 0 && closedTrades[0].openTime
      ? new Date(closedTrades[0].openTime).toISOString()
      : since.toISOString();

  return {
    sessionStart,
    tradeCount: closedTrades.length + openTrades.length,
    openTradeCount: openTrades.length,
    closedTradeCount: closedTrades.length,
    wins,
    losses,
    runningPnL,
    avgTimeBetweenTrades: avgTimeBetween,
    lastTradeTime: lastTrade?.closeTime
      ? new Date(lastTrade.closeTime).toISOString()
      : null,
    currentStreak: { type: streakType, count: streakCount },
    volumeProgression: volumes,
    isActive: openTrades.length > 0 || closedTrades.length > 0,
  };
}

// ─── Generate Coaching Nudges ───────────────────────────────────

export async function generateCoachingNudges(
  accountId: string,
  userId: string,
  profile: TraderProfileData
): Promise<CoachingNudge[]> {
  const session = await getCurrentSessionState(accountId, 8, userId);
  if (!session.isActive) return [];

  const nudges: CoachingNudge[] = [];

  // 1. Overtrading warning
  if (
    profile.consistency.avgDailyTrades > 0 &&
    session.closedTradeCount >= Math.ceil(profile.consistency.avgDailyTrades * 1.5)
  ) {
    nudges.push({
      type: "overtrading_warning",
      severity:
        session.closedTradeCount >=
        Math.ceil(profile.consistency.avgDailyTrades * 2)
          ? "critical"
          : "warning",
      title: "Approaching daily trade limit",
      message: `You've taken ${session.closedTradeCount} trades today. Your average is ${profile.consistency.avgDailyTrades.toFixed(1)}/day. More trades often means lower quality.`,
      data: {
        current: session.closedTradeCount,
        average: profile.consistency.avgDailyTrades,
      },
    });
  }

  // 2. Loss streak → take a break
  if (
    session.currentStreak.type === "loss" &&
    session.currentStreak.count >= 3
  ) {
    nudges.push({
      type: "take_a_break",
      severity: session.currentStreak.count >= 4 ? "critical" : "warning",
      title: "Time for a break",
      message: `${session.currentStreak.count} consecutive losses this session. Step away, review your journal, and come back fresh.`,
      data: { lossStreak: session.currentStreak.count },
    });
  }

  // 3. Position size creep (increasing after losses)
  if (session.volumeProgression.length >= 3) {
    const lastThree = session.volumeProgression.slice(-3);
    const isIncreasing =
      lastThree[1] > lastThree[0] * 1.2 &&
      lastThree[2] > lastThree[1] * 1.2;

    if (isIncreasing && session.currentStreak.type === "loss") {
      nudges.push({
        type: "size_creep",
        severity: "critical",
        title: "Position sizes increasing after losses",
        message:
          "Your position sizes are growing during a losing streak. This is classic loss-chasing behavior. Reduce to your standard size or smaller.",
        data: { recentSizes: lastThree },
      });
    }
  }

  // 4. Rapid re-entry (less than 60 seconds between trades)
  if (
    session.avgTimeBetweenTrades > 0 &&
    session.avgTimeBetweenTrades < 60 &&
    session.closedTradeCount >= 3
  ) {
    nudges.push({
      type: "tilt_alert",
      severity: "warning",
      title: "Rapid-fire entries detected",
      message: `Average ${Math.round(session.avgTimeBetweenTrades)}s between trades. Slow down — good trades need analysis time.`,
      data: { avgGap: session.avgTimeBetweenTrades },
    });
  }

  // 5. Positive reinforcement
  if (
    session.currentStreak.type === "win" &&
    session.currentStreak.count >= 3 &&
    session.runningPnL > 0
  ) {
    nudges.push({
      type: "positive_reinforcement",
      severity: "info",
      title: "Strong session",
      message: `${session.currentStreak.count}-trade win streak with $${session.runningPnL.toFixed(2)} profit. Consider locking in gains — don't give it back.`,
      data: {
        streak: session.currentStreak.count,
        pnl: session.runningPnL,
      },
    });
  }

  // 6. Session P&L deep in the red
  if (
    session.closedTradeCount >= 3 &&
    session.runningPnL < 0 &&
    Math.abs(session.runningPnL) > Math.abs(profile.avgLoss) * 3
  ) {
    nudges.push({
      type: "session_limit",
      severity: "critical",
      title: "Session loss limit approaching",
      message: `Down $${Math.abs(session.runningPnL).toFixed(2)} today (${session.losses} losses). Your average loss is $${Math.abs(profile.avgLoss).toFixed(2)}. Consider stopping for the day.`,
      data: { sessionPnL: session.runningPnL, avgLoss: profile.avgLoss },
    });
  }

  return nudges;
}

// ─── Session Summary ────────────────────────────────────────────

export async function generateSessionSummary(
  accountId: string,
  profile: TraderProfileData
): Promise<{
  session: SessionState;
  verdict: "excellent" | "good" | "average" | "poor" | "bad";
  summary: string;
  suggestions: string[];
}> {
  const session = await getCurrentSessionState(accountId);

  let verdict: "excellent" | "good" | "average" | "poor" | "bad" = "average";
  const suggestions: string[] = [];

  if (session.closedTradeCount === 0) {
    return {
      session,
      verdict: "average",
      summary: "No completed trades in this session.",
      suggestions: ["Stay patient and wait for your setup."],
    };
  }

  const winRate = (session.wins / session.closedTradeCount) * 100;

  if (winRate >= 70 && session.runningPnL > 0) verdict = "excellent";
  else if (winRate >= 55 && session.runningPnL > 0) verdict = "good";
  else if (winRate >= 45) verdict = "average";
  else if (winRate >= 30) verdict = "poor";
  else verdict = "bad";

  const summaryParts: string[] = [
    `${session.closedTradeCount} trades: ${session.wins}W / ${session.losses}L (${winRate.toFixed(0)}% WR)`,
    `P&L: ${session.runningPnL >= 0 ? "+" : ""}$${session.runningPnL.toFixed(2)}`,
  ];

  if (session.closedTradeCount > profile.consistency.avgDailyTrades * 1.5) {
    suggestions.push(
      "You took more trades than usual. Consider being more selective."
    );
  }

  if (winRate < profile.winRate - 10) {
    suggestions.push(
      `Win rate (${winRate.toFixed(0)}%) below your average (${profile.winRate.toFixed(0)}%). Review your entries.`
    );
  }

  if (session.currentStreak.type === "loss" && session.currentStreak.count >= 2) {
    suggestions.push("Ended on a losing streak. Journal about what changed.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Solid session. Document what worked in your journal.");
  }

  return {
    session,
    verdict,
    summary: summaryParts.join(" | "),
    suggestions,
  };
}
