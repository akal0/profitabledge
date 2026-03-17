"use client";

export type PublicProofTradeRow = {
  id: string;
  symbol?: string | null;
  tradeType?: string | null;
  volume?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  profit?: number | null;
  rr?: number | null;
  outcome?: string | null;
  openTime?: string | Date | null;
  closeTime?: string | Date | null;
  createdAt: string | Date;
  isLive?: boolean;
  durationSeconds: number;
  originType?: string | null;
  originLabel?: string | null;
  edited: boolean;
};

export type PublicProofGroupBy =
  | "symbol"
  | "day"
  | "direction"
  | "outcome"
  | "source"
  | "status";

export const PUBLIC_PROOF_GROUP_OPTIONS: Array<{
  key: PublicProofGroupBy;
  label: string;
}> = [
  { key: "symbol", label: "Symbol" },
  { key: "day", label: "Day" },
  { key: "direction", label: "Direction" },
  { key: "outcome", label: "Outcome" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
];

export type PublicProofSortValue =
  | "time:desc"
  | "time:asc"
  | "profit:desc"
  | "profit:asc"
  | "volume:desc"
  | "volume:asc"
  | "durationSeconds:desc"
  | "durationSeconds:asc"
  | "symbol:asc"
  | "symbol:desc"
  | "tradeType:asc"
  | "tradeType:desc";

export function getPublicProofTradeStatusLabel(row: PublicProofTradeRow) {
  return row.isLive ? "Live" : "Closed";
}

export function getPublicProofGroupKey(
  groupBy: PublicProofGroupBy,
  row: PublicProofTradeRow
) {
  switch (groupBy) {
    case "symbol":
      return row.symbol || "Unknown";
    case "day": {
      const timestamp = row.closeTime || row.openTime || row.createdAt;
      return new Date(timestamp).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    case "direction":
      return row.tradeType === "long"
        ? "Long"
        : row.tradeType === "short"
        ? "Short"
        : "Unknown";
    case "outcome":
      if (row.isLive) return "Live";
      if (row.outcome === "BE") return "Breakeven";
      if (row.outcome === "PW") return "Partial win";
      return row.outcome || "Unknown";
    case "source":
      return row.originLabel || "Unknown";
    case "status":
      return getPublicProofTradeStatusLabel(row);
    default:
      return "All";
  }
}

export function summarizePublicProofGroup(rows: PublicProofTradeRow[]) {
  const totalProfit = rows.reduce(
    (sum, row) => sum + Number(row.profit ?? 0),
    0
  );
  const closedRows = rows.filter((row) => !row.isLive);
  const wins = closedRows.filter(
    (row) =>
      row.outcome === "Win" ||
      row.outcome === "PW" ||
      (row.outcome == null && Number(row.profit ?? 0) > 0)
  ).length;
  const losses = closedRows.filter(
    (row) =>
      row.outcome === "Loss" ||
      (row.outcome == null && Number(row.profit ?? 0) < 0)
  ).length;
  const breakeven = closedRows.filter((row) => row.outcome === "BE").length;
  const winRate =
    closedRows.length > 0 ? Math.round((wins / closedRows.length) * 100) : 0;

  return {
    trades: rows.length,
    totalProfit,
    wins,
    losses,
    breakeven,
    winRate,
  };
}

export function getPublicProofSortBadge(sortValue?: string) {
  if (!sortValue || sortValue === "time:desc") return "";

  const labels: Record<string, string> = {
    "time:asc": "Oldest activity first",
    "time:desc": "Latest activity first",
    "profit:desc": "Highest profit and loss first",
    "profit:asc": "Lowest profit and loss first",
    "volume:desc": "Most volume first",
    "volume:asc": "Least volume first",
    "durationSeconds:desc": "Longest holds first",
    "durationSeconds:asc": "Shortest holds first",
    "symbol:asc": "A→Z symbols",
    "symbol:desc": "Z→A symbols",
    "tradeType:asc": "Longs first",
    "tradeType:desc": "Shorts first",
  };

  return labels[sortValue] || "";
}
