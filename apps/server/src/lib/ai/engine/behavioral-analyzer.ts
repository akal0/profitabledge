/**
 * Behavioral Analyzer
 *
 * Finds the trader's edge conditions (winning combos) and
 * leak conditions (losing combos) using combinatorial statistical
 * analysis across multiple dimensions.
 *
 * No ML — pure grouping + filtering with sample-size awareness.
 */

import { db } from "../../../db";
import { trade as tradeTable } from "../../../db/schema/trading";
import { eq, and, sql } from "drizzle-orm";
import type { EdgeCondition, LeakCondition } from "./types";
import {
  CONDITION_COMBINATIONS,
  getConditionValue,
  summarizeConditionFilters,
} from "./condition-language";

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

function holdSeconds(t: ClosedTrade): number {
  if (t.tradeDurationSeconds) return toNum(t.tradeDurationSeconds);
  if (t.openTime && t.closeTime) {
    return (
      (new Date(t.closeTime).getTime() - new Date(t.openTime).getTime()) / 1000
    );
  }
  return 0;
}

// ─── Core Analysis ──────────────────────────────────────────────

interface GroupStats {
  key: string;
  filters: Record<string, string>;
  wins: number;
  losses: number;
  total: number;
  totalProfit: number;
  totalLoss: number;
}

function analyzeTradesForCombinations(
  trades: ClosedTrade[],
  dimensionCombo: readonly string[]
): GroupStats[] {
  const groups = new Map<string, GroupStats>();

  for (const t of trades) {
    // Extract dimension values
    const dimValues: Record<string, string> = {};
    let skip = false;

    for (const dim of dimensionCombo) {
      const val = getConditionValue(t, dim);
      if (val === null) {
        skip = true;
        break;
      }
      dimValues[dim] = val;
    }

    if (skip) continue;

    // Build composite key
    const key = dimensionCombo.map((d) => `${d}=${dimValues[d]}`).join(" + ");

    const entry = groups.get(key) || {
      key,
      filters: { ...dimValues },
      wins: 0,
      losses: 0,
      total: 0,
      totalProfit: 0,
      totalLoss: 0,
    };

    entry.total++;
    const profit = toNum(t.profit);
    if (profit > 0) {
      entry.wins++;
      entry.totalProfit += profit;
    } else if (profit < 0) {
      entry.losses++;
      entry.totalLoss += Math.abs(profit);
    }

    groups.set(key, entry);
  }

  return Array.from(groups.values());
}

function getConfidence(
  sampleSize: number
): "high" | "moderate" | "exploratory" {
  if (sampleSize >= 30) return "high";
  if (sampleSize >= 15) return "moderate";
  return "exploratory";
}

// ─── Public API ─────────────────────────────────────────────────

const MIN_TRADES_PER_GROUP = 8;
const MAX_EDGE_CONDITIONS = 10;
const MAX_LEAK_CONDITIONS = 10;

export async function analyzeEdgeConditions(
  accountId: string
): Promise<EdgeCondition[]> {
  const trades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    );

  if (trades.length < 20) return [];

  return findEdges(trades);
}

export async function analyzeLeakConditions(
  accountId: string
): Promise<LeakCondition[]> {
  const trades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    );

  if (trades.length < 20) return [];

  return findLeaks(trades);
}

export function findEdges(trades: ClosedTrade[]): EdgeCondition[] {
  const baselineWinRate =
    trades.length > 0
      ? (trades.filter(isWin).length / trades.length) * 100
      : 50;

  const candidates: EdgeCondition[] = [];

  for (const combo of CONDITION_COMBINATIONS) {
    const groups = analyzeTradesForCombinations(trades, combo);

    for (const group of groups) {
      if (group.total < MIN_TRADES_PER_GROUP) continue;

      const winRate = (group.wins / group.total) * 100;
      const avgProfit =
        group.wins > 0 ? group.totalProfit / group.wins : 0;

      // Edge: significantly above baseline win rate AND profitable
      if (winRate > Math.max(55, baselineWinRate + 5) && avgProfit > 0) {
        candidates.push({
          label: summarizeConditionFilters(group.filters),
          filters: group.filters,
          trades: group.total,
          winRate,
          avgProfit: group.totalProfit / group.total,
          confidence: getConfidence(group.total),
        });
      }
    }
  }

  // Rank by winRate * sqrt(tradeCount) — balances accuracy with sample size
  candidates.sort(
    (a, b) =>
      b.winRate * Math.sqrt(b.trades) - a.winRate * Math.sqrt(a.trades)
  );

  // Deduplicate: if a 1-dim edge is subset of a 2-dim edge with similar WR, keep the more specific one
  return deduplicateConditions(candidates).slice(0, MAX_EDGE_CONDITIONS);
}

export function findLeaks(trades: ClosedTrade[]): LeakCondition[] {
  const baselineWinRate =
    trades.length > 0
      ? (trades.filter(isWin).length / trades.length) * 100
      : 50;

  const candidates: LeakCondition[] = [];

  for (const combo of CONDITION_COMBINATIONS) {
    const groups = analyzeTradesForCombinations(trades, combo);

    for (const group of groups) {
      if (group.total < MIN_TRADES_PER_GROUP) continue;

      const winRate = (group.wins / group.total) * 100;
      const avgLoss =
        group.losses > 0 ? group.totalLoss / group.losses : 0;

      // Leak: significantly below baseline win rate OR consistently losing money
      if (winRate < Math.min(45, baselineWinRate - 5) && group.totalLoss > group.totalProfit) {
        candidates.push({
          label: summarizeConditionFilters(group.filters),
          filters: group.filters,
          trades: group.total,
          winRate,
          avgLoss: (group.totalLoss - group.totalProfit) / group.total,
          confidence: getConfidence(group.total),
        });
      }
    }
  }

  // Rank by severity: lowest win rate * sqrt(tradeCount)
  candidates.sort(
    (a, b) =>
      (100 - a.winRate) * Math.sqrt(a.trades) -
      (100 - b.winRate) * Math.sqrt(b.trades)
  );
  candidates.reverse();

  return deduplicateConditions(candidates).slice(0, MAX_LEAK_CONDITIONS);
}

// ─── Deduplication ──────────────────────────────────────────────

function deduplicateConditions<
  T extends { filters: Record<string, string | number>; winRate: number }
>(conditions: T[]): T[] {
  const result: T[] = [];

  for (const cond of conditions) {
    const condKeys = Object.keys(cond.filters);

    // Check if this is a superset of an existing condition with similar WR
    const isRedundant = result.some((existing) => {
      const existingKeys = Object.keys(existing.filters);

      // If existing is a subset of this condition
      const isSubset = existingKeys.every(
        (k) => cond.filters[k] === existing.filters[k]
      );

      // Similar win rate (within 5%)
      const similarWR = Math.abs(cond.winRate - existing.winRate) < 5;

      // Keep the more specific one (more dimensions)
      return isSubset && similarWR && condKeys.length <= existingKeys.length;
    });

    if (!isRedundant) {
      result.push(cond);
    }
  }

  return result;
}

// ─── Full Analysis (called during profile compute) ──────────────

export async function analyzeAllConditions(
  accountId: string
): Promise<{ edges: EdgeCondition[]; leaks: LeakCondition[] }> {
  const trades = await db
    .select()
    .from(tradeTable)
    .where(
      and(
        eq(tradeTable.accountId, accountId),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    );

  if (trades.length < 20) {
    return { edges: [], leaks: [] };
  }

  return {
    edges: findEdges(trades),
    leaks: findLeaks(trades),
  };
}
