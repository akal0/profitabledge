"use client";

import { summarizeTradeRows } from "@/features/trades/table/lib/trade-table-summary";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

export type TradeTableGroupBy =
  | "symbol"
  | "session"
  | "day"
  | "direction"
  | "outcome";

export const TRADE_TABLE_GROUP_OPTIONS: Array<{
  key: TradeTableGroupBy;
  label: string;
}> = [
  { key: "symbol", label: "Symbol" },
  { key: "session", label: "Session" },
  { key: "day", label: "Day" },
  { key: "direction", label: "Direction" },
  { key: "outcome", label: "Outcome" },
];

export function getTradeTableGroupKey(
  groupBy: TradeTableGroupBy,
  row: TradeRow
): string {
  switch (groupBy) {
    case "symbol":
      return row.symbol || "Unknown";
    case "session":
      return row.sessionTag || "Untagged";
    case "day":
      return row.open
        ? new Date(row.open).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Unknown";
    case "direction":
      return row.tradeDirection === "long" ? "Long" : "Short";
    case "outcome":
      if (row.isLive) {
        return "Live";
      }
      if (row.outcome === "BE") {
        return "Breakeven";
      }
      if (row.outcome === "PW") {
        return "Partial win";
      }
      return row.outcome || "Unknown";
    default:
      return "All";
  }
}

export function summarizeTradeGroup(rows: TradeRow[]) {
  const summary = summarizeTradeRows(rows);

  return {
    trades: summary.totalTrades,
    totalProfit: summary.totalPnL,
    wins: summary.wins,
    losses: summary.losses,
    breakeven: summary.breakeven,
    winRate: Math.round(summary.winRate),
  };
}
