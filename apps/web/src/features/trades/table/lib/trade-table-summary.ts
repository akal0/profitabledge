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

  for (const row of rows) {
    const profit = toFiniteNumber(row.profit);
    const commissions = toFiniteNumber(row.commissions);
    const swap = toFiniteNumber(row.swap);
    const volume = toFiniteNumber(row.volume);

    totalPnL += profit;
    netPnL += profit - commissions - swap;
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
      continue;
    }

    if (row.outcome === "Loss") {
      losses += 1;
      continue;
    }

    if (row.outcome === "BE") {
      breakeven += 1;
    }
  }

  const closedTradesCount = wins + losses + breakeven;

  return {
    totalTrades: rows.length,
    totalPnL,
    netPnL,
    winRate: closedTradesCount > 0 ? (wins / closedTradesCount) * 100 : 0,
    avgRR: rrCount > 0 ? rrTotal / rrCount : 0,
    totalVolume,
    wins,
    losses,
    breakeven,
  };
}
