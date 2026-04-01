import { buildTradeStreakMap } from "./trade-table-view-state";
import type { TradeRow } from "./trade-table-types";

export type TradeTableSummary = {
  totalTrades: number;
  totalPnL: number;
  netPnL: number;
  winRate: number;
  avgRR: number;
  totalVolume: number;
  wins: number;
  losses: number;
  breakeven: number;
  bestTrade: number;
  currentStreakCount: number;
  currentStreakType: "win" | "loss" | null;
  expectancyPerTrade: number;
  profitFactor: number;
  worstTrade: number;
};

const toFiniteNumber = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

export function summarizeTradeRows(rows: TradeRow[]): TradeTableSummary {
  let totalPnL = 0;
  let netPnL = 0;
  let totalVolume = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let rrTotal = 0;
  let rrCount = 0;
  let grossWins = 0;
  let grossLosses = 0;
  let bestTrade = Number.NEGATIVE_INFINITY;
  let worstTrade = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const profit = toFiniteNumber(row.profit);
    const commissions = toFiniteNumber(row.commissions);
    const swap = toFiniteNumber(row.swap);
    const volume = toFiniteNumber(row.volume);

    totalPnL += profit;
    netPnL += profit + commissions + swap;
    totalVolume += volume;

    if (row.realisedRR != null && Number.isFinite(Number(row.realisedRR))) {
      rrTotal += Number(row.realisedRR);
      rrCount += 1;
    }

    if (row.isLive) {
      continue;
    }

    if (row.outcome === "Win" || row.outcome === "PW") {
      wins += 1;
      grossWins += Math.max(profit, 0);
      bestTrade = Math.max(bestTrade, profit);
      worstTrade = Math.min(worstTrade, profit);
      continue;
    }

    if (row.outcome === "Loss") {
      losses += 1;
      grossLosses += Math.abs(Math.min(profit, 0));
      bestTrade = Math.max(bestTrade, profit);
      worstTrade = Math.min(worstTrade, profit);
      continue;
    }

    if (row.outcome === "BE") {
      breakeven += 1;
      bestTrade = Math.max(bestTrade, profit);
      worstTrade = Math.min(worstTrade, profit);
    }
  }

  const closedTradesCount = wins + losses + breakeven;
  const streakByTradeId = buildTradeStreakMap(rows);
  const lastClosedTrade = [...rows]
    .filter((row) => !row.isLive && (row.outcome === "Win" || row.outcome === "PW" || row.outcome === "Loss"))
    .sort(
      (left, right) =>
        Date.parse(right.open || right.close || right.createdAtISO) -
        Date.parse(left.open || left.close || left.createdAtISO)
    )[0];
  const currentStreak = lastClosedTrade
    ? streakByTradeId[lastClosedTrade.id] ?? null
    : null;

  return {
    bestTrade: Number.isFinite(bestTrade) ? bestTrade : 0,
    currentStreakCount: currentStreak?.count ?? 0,
    currentStreakType: currentStreak?.type ?? null,
    totalTrades: rows.length,
    totalPnL,
    netPnL,
    winRate: closedTradesCount > 0 ? (wins / closedTradesCount) * 100 : 0,
    avgRR: rrCount > 0 ? rrTotal / rrCount : 0,
    totalVolume,
    wins,
    losses,
    breakeven,
    expectancyPerTrade: closedTradesCount > 0 ? totalPnL / closedTradesCount : 0,
    profitFactor:
      grossLosses > 0
        ? grossWins / grossLosses
        : grossWins > 0
        ? Number.POSITIVE_INFINITY
        : 0,
    worstTrade: Number.isFinite(worstTrade) ? worstTrade : 0,
  };
}
