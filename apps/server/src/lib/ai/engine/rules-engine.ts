/**
 * Rules Engine
 *
 * Evaluates trades against user-defined trading rules.
 * Generates violations, compliance scores, and AI-suggested rules.
 *
 * Rule categories:
 * - session: Allowed/disallowed trading sessions
 * - symbol: Allowed/disallowed symbols
 * - risk: Max trades per day, max consecutive losses, etc.
 * - timing: No trading during news, time restrictions
 * - setup: Min R:R, protocol alignment requirements
 * - psychology: No trading when tilted, emotional state requirements
 */

import { db } from "../../../db";
import { trade as tradeTable } from "../../../db/schema/trading";
import {
  tradingRule,
  ruleViolation,
  type TradingRuleRow,
} from "../../../db/schema/coaching";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import type { TraderProfileData, EdgeCondition, LeakCondition } from "./types";

type ClosedTrade = typeof tradeTable.$inferSelect;

// ─── Types ──────────────────────────────────────────────────────

export interface RuleEvaluationResult {
  ruleId: string;
  ruleLabel: string;
  passed: boolean;
  violation?: string;
  data?: Record<string, any>;
}

export interface ComplianceReport {
  totalRules: number;
  passedRules: number;
  violatedRules: number;
  complianceRate: number; // 0-100%
  results: RuleEvaluationResult[];
  overallStatus: "compliant" | "minor_violations" | "major_violations";
}

export interface SuggestedRule {
  category: string;
  ruleType: string;
  label: string;
  description: string;
  parameters: Record<string, any>;
  reason: string;
  confidence: number; // 0-1
}

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

// ─── Rule Evaluation ────────────────────────────────────────────

export async function evaluateTradeAgainstRules(
  trade: ClosedTrade,
  accountId: string,
  userId: string
): Promise<ComplianceReport> {
  // Get active rules
  const rules = await db
    .select()
    .from(tradingRule)
    .where(
      and(
        eq(tradingRule.accountId, accountId),
        eq(tradingRule.userId, userId),
        eq(tradingRule.isActive, true)
      )
    );

  if (rules.length === 0) {
    return {
      totalRules: 0,
      passedRules: 0,
      violatedRules: 0,
      complianceRate: 100,
      results: [],
      overallStatus: "compliant",
    };
  }

  const results: RuleEvaluationResult[] = [];

  for (const rule of rules) {
    const result = evaluateSingleRule(rule, trade, accountId);
    results.push(await result);
  }

  const passed = results.filter((r) => r.passed).length;
  const violated = results.filter((r) => !r.passed).length;
  const complianceRate = rules.length > 0 ? (passed / rules.length) * 100 : 100;

  let overallStatus: ComplianceReport["overallStatus"] = "compliant";
  if (violated >= 3 || results.some((r) => !r.passed)) {
    overallStatus = violated >= 2 ? "major_violations" : "minor_violations";
  }

  return {
    totalRules: rules.length,
    passedRules: passed,
    violatedRules: violated,
    complianceRate,
    results,
    overallStatus,
  };
}

async function evaluateSingleRule(
  rule: TradingRuleRow,
  trade: ClosedTrade,
  accountId: string
): Promise<RuleEvaluationResult> {
  const params = rule.parameters as Record<string, any>;
  const baseResult = { ruleId: rule.id, ruleLabel: rule.label };

  switch (rule.ruleType) {
    case "allowed_sessions": {
      const allowed = (params.allowedSessions || []) as string[];
      if (trade.sessionTag && !allowed.includes(trade.sessionTag)) {
        return {
          ...baseResult,
          passed: false,
          violation: `Traded in ${trade.sessionTag} — not in allowed sessions (${allowed.join(", ")})`,
          data: { session: trade.sessionTag, allowed },
        };
      }
      return { ...baseResult, passed: true };
    }

    case "blocked_sessions": {
      const blocked = (params.blockedSessions || []) as string[];
      if (trade.sessionTag && blocked.includes(trade.sessionTag)) {
        return {
          ...baseResult,
          passed: false,
          violation: `Traded in blocked session: ${trade.sessionTag}`,
          data: { session: trade.sessionTag, blocked },
        };
      }
      return { ...baseResult, passed: true };
    }

    case "allowed_symbols": {
      const allowed = (params.allowedSymbols || []) as string[];
      if (trade.symbol && !allowed.includes(trade.symbol)) {
        return {
          ...baseResult,
          passed: false,
          violation: `Traded ${trade.symbol} — not in allowed symbols`,
          data: { symbol: trade.symbol, allowed },
        };
      }
      return { ...baseResult, passed: true };
    }

    case "max_trades_per_day": {
      const maxTrades = params.maxTrades as number;
      if (!trade.closeTime) return { ...baseResult, passed: true };

      const dayStart = new Date(trade.closeTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tradeTable)
        .where(
          and(
            eq(tradeTable.accountId, accountId),
            sql`${tradeTable.closeTime} IS NOT NULL`,
            gte(tradeTable.closeTime, dayStart),
            sql`${tradeTable.closeTime} < ${dayEnd}`
          )
        );

      const count = Number(result?.count || 0);
      if (count > maxTrades) {
        return {
          ...baseResult,
          passed: false,
          violation: `Took ${count} trades today (max: ${maxTrades})`,
          data: { count, maxTrades },
        };
      }
      return { ...baseResult, passed: true };
    }

    case "max_consecutive_losses": {
      const maxLosses = params.maxLosses as number;
      // Check recent consecutive losses
      const recentTrades = await db
        .select()
        .from(tradeTable)
        .where(
          and(
            eq(tradeTable.accountId, accountId),
            sql`${tradeTable.closeTime} IS NOT NULL`
          )
        )
        .orderBy(desc(tradeTable.closeTime))
        .limit(maxLosses + 1);

      let consecutiveLosses = 0;
      for (const t of recentTrades) {
        if (toNum(t.profit) < 0) consecutiveLosses++;
        else break;
      }

      if (consecutiveLosses >= maxLosses) {
        return {
          ...baseResult,
          passed: false,
          violation: `${consecutiveLosses} consecutive losses (max: ${maxLosses}). Stop trading.`,
          data: { consecutiveLosses, maxLosses },
        };
      }
      return { ...baseResult, passed: true };
    }

    case "min_rr_ratio": {
      const minRR = params.minRR as number;
      const plannedRR = toNum(trade.plannedRR);
      if (plannedRR > 0 && plannedRR < minRR) {
        return {
          ...baseResult,
          passed: false,
          violation: `Planned R:R ${plannedRR.toFixed(1)} below minimum (${minRR})`,
          data: { plannedRR, minRR },
        };
      }
      return { ...baseResult, passed: true };
    }

    case "protocol_required": {
      if (trade.protocolAlignment === "against") {
        return {
          ...baseResult,
          passed: false,
          violation: "Traded against protocol (protocol alignment required)",
        };
      }
      return { ...baseResult, passed: true };
    }

    default:
      return { ...baseResult, passed: true };
  }
}

// ─── Daily Compliance Check ─────────────────────────────────────

export async function getDailyComplianceReport(
  accountId: string,
  userId: string,
  date?: Date
): Promise<{
  date: string;
  trades: number;
  complianceRate: number;
  violations: { ruleLabel: string; violation: string }[];
}> {
  const day = date || new Date();
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dayTrades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`,
        gte(tradeTable.closeTime, dayStart),
        sql`${tradeTable.closeTime} < ${dayEnd}`
      )
    );

  if (dayTrades.length === 0) {
    return {
      date: dayStart.toISOString().slice(0, 10),
      trades: 0,
      complianceRate: 100,
      violations: [],
    };
  }

  const allViolations: { ruleLabel: string; violation: string }[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const trade of dayTrades) {
    const report = await evaluateTradeAgainstRules(trade, accountId, userId);
    totalChecks += report.totalRules;
    passedChecks += report.passedRules;
    for (const result of report.results) {
      if (!result.passed && result.violation) {
        allViolations.push({
          ruleLabel: result.ruleLabel,
          violation: result.violation,
        });
      }
    }
  }

  return {
    date: dayStart.toISOString().slice(0, 10),
    trades: dayTrades.length,
    complianceRate: totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100,
    violations: allViolations,
  };
}

// ─── Save Rule Violation ────────────────────────────────────────

export async function saveRuleViolation(
  ruleId: string,
  accountId: string,
  userId: string,
  description: string,
  tradeId?: string,
  data?: Record<string, any>
): Promise<void> {
  await db.insert(ruleViolation).values({
    ruleId,
    accountId,
    userId,
    tradeId: tradeId || null,
    description,
    data,
  });

  // Update violation count on the rule
  await db
    .update(tradingRule)
    .set({
      violationCount: sql`${tradingRule.violationCount} + 1`,
      lastViolatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tradingRule.id, ruleId));
}

// ─── AI-Suggested Rules ─────────────────────────────────────────

export function generateSuggestedRules(
  profile: TraderProfileData,
  edges: EdgeCondition[],
  leaks: LeakCondition[]
): SuggestedRule[] {
  const suggestions: SuggestedRule[] = [];

  // Suggest blocking weak sessions
  for (const session of profile.sessions) {
    if (session.trades >= 10 && session.winRate < 35 && session.totalProfit < 0) {
      suggestions.push({
        category: "session",
        ruleType: "blocked_sessions",
        label: `Avoid ${session.session} session`,
        description: `Your ${session.session} win rate is ${session.winRate.toFixed(1)}% across ${session.trades} trades with ${session.totalProfit < 0 ? "-" : ""}$${Math.abs(session.totalProfit).toFixed(2)} total P&L.`,
        parameters: { blockedSessions: [session.session] },
        reason: `Removing ${session.session} trades would improve your overall results.`,
        confidence: session.trades >= 20 ? 0.9 : 0.7,
      });
    }
  }

  // Suggest daily trade limit if overtrading hurts
  if (
    profile.consistency.avgDailyTrades > 3 &&
    profile.consistency.stdDevDailyTrades > profile.consistency.avgDailyTrades * 0.5
  ) {
    const suggestedMax = Math.ceil(profile.consistency.avgDailyTrades);
    suggestions.push({
      category: "risk",
      ruleType: "max_trades_per_day",
      label: `Max ${suggestedMax} trades per day`,
      description: `Your daily trade count varies widely (avg ${profile.consistency.avgDailyTrades.toFixed(1)} ± ${profile.consistency.stdDevDailyTrades.toFixed(1)}). Capping at ${suggestedMax} may improve consistency.`,
      parameters: { maxTrades: suggestedMax },
      reason: "High trade count variance suggests undisciplined overtrading on some days.",
      confidence: 0.8,
    });
  }

  // Suggest max consecutive losses
  if (profile.longestLossStreak >= 4) {
    suggestions.push({
      category: "risk",
      ruleType: "max_consecutive_losses",
      label: `Stop after ${Math.min(3, profile.longestLossStreak - 1)} consecutive losses`,
      description: `Your longest loss streak is ${profile.longestLossStreak}. Stopping at ${Math.min(3, profile.longestLossStreak - 1)} prevents emotional spiral.`,
      parameters: { maxLosses: Math.min(3, profile.longestLossStreak - 1) },
      reason: "Consecutive losses trigger emotional decision-making.",
      confidence: 0.85,
    });
  }

  // Suggest protocol requirement if against-protocol is clearly worse
  if (
    profile.protocolStats.againstCount >= 10 &&
    profile.protocolStats.againstWinRate < 40 &&
    profile.protocolStats.alignedWinRate > profile.protocolStats.againstWinRate + 15
  ) {
    suggestions.push({
      category: "setup",
      ruleType: "protocol_required",
      label: "Only take protocol-aligned trades",
      description: `Aligned trades: ${profile.protocolStats.alignedWinRate.toFixed(1)}% WR. Against protocol: ${profile.protocolStats.againstWinRate.toFixed(1)}% WR. The difference is significant.`,
      parameters: {},
      reason: `${(profile.protocolStats.alignedWinRate - profile.protocolStats.againstWinRate).toFixed(1)} percentage point difference in win rate between aligned and against-protocol trades.`,
      confidence: 0.9,
    });
  }

  // Suggest min R:R based on sweet spot
  if (
    profile.rrProfile.sweetSpotMin > 1 &&
    profile.rrProfile.sweetSpotWinRate > profile.winRate + 5
  ) {
    suggestions.push({
      category: "setup",
      ruleType: "min_rr_ratio",
      label: `Minimum ${profile.rrProfile.sweetSpotMin.toFixed(1)}:1 R:R`,
      description: `Your R:R sweet spot (${profile.rrProfile.sweetSpotMin.toFixed(1)}-${profile.rrProfile.sweetSpotMax.toFixed(1)}) has a ${profile.rrProfile.sweetSpotWinRate.toFixed(1)}% win rate vs your overall ${profile.winRate.toFixed(1)}%.`,
      parameters: { minRR: profile.rrProfile.sweetSpotMin },
      reason: "Trading within your R:R sweet spot significantly improves win rate.",
      confidence: 0.85,
    });
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 5);
}
