"use client";

export type ExportableTradeDetails = {
  id: string;
  symbol?: string | null;
  tradeDirection: "long" | "short";
  profit: number;
  open: string;
  close: string;
  volume: number;
  sl?: number | null;
  tp?: number | null;
  realisedRR?: number | null;
  outcome?: "Win" | "Loss" | "BE" | "PW" | null;
  holdSeconds?: number;
  openPrice?: number | null;
  closePrice?: number | null;
};

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function exportTradeDetails(trade: ExportableTradeDetails) {
  const symbolPart = sanitizeFilenamePart(trade.symbol || "trade");
  const fileName = `${symbolPart}-${trade.id.slice(0, 8)}.json`;
  const payload = {
    exportedAt: new Date().toISOString(),
    trade,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
