import { and, desc, eq, gte, lte, not, sql } from "drizzle-orm";

import { db } from "../../../db";
import { trade } from "../../../db/schema/trading";

type TradeDirection = "long" | "short";

type CandidateSeed = {
  accountId: string;
  tradeId?: string;
  symbol: string;
  tradeType: TradeDirection;
  volume: number;
  openPrice: number;
  closePrice?: number | null;
  openTime: Date;
  closeTime?: Date | null;
};

function toNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function priceSimilarityScore(a: number, b: number) {
  const delta = Math.abs(a - b);
  if (delta <= 0.00001) return 20;
  if (delta <= 0.0001) return 16;
  if (delta <= 0.001) return 10;
  if (delta <= 0.01) return 5;
  return 0;
}

function volumeSimilarityScore(a: number, b: number) {
  const delta = Math.abs(a - b);
  if (delta === 0) return 12;
  if (delta <= Math.max(a, b) * 0.05) return 8;
  if (delta <= Math.max(a, b) * 0.15) return 4;
  return 0;
}

function timeSimilarityScore(deltaMs: number, exact: number, close: number) {
  if (deltaMs <= 60_000) return exact;
  if (deltaMs <= 15 * 60_000) return close;
  if (deltaMs <= 60 * 60_000) return Math.max(2, Math.floor(close / 2));
  return 0;
}

function buildReasons(input: {
  symbolMatches: boolean;
  directionMatches: boolean;
  openTimeDeltaMs: number;
  closeTimeDeltaMs: number | null;
  volumeMatches: boolean;
  originType: string | null;
}) {
  const reasons: string[] = [];

  if (input.symbolMatches) reasons.push("same symbol");
  if (input.directionMatches) reasons.push("same direction");
  if (input.openTimeDeltaMs <= 15 * 60_000) reasons.push("similar open time");
  if (
    input.closeTimeDeltaMs != null &&
    input.closeTimeDeltaMs <= 15 * 60_000
  ) {
    reasons.push("similar close time");
  }
  if (input.volumeMatches) reasons.push("similar size");
  if (input.originType === "broker_sync") reasons.push("broker-synced record");
  if (input.originType === "csv_import") reasons.push("imported record");

  return reasons;
}

export async function findManualTradeReconciliationCandidates(
  input: CandidateSeed
) {
  const from = new Date(input.openTime.getTime() - 48 * 60 * 60 * 1000);
  const to = new Date(
    (input.closeTime ?? input.openTime).getTime() + 48 * 60 * 60 * 1000
  );

  const candidateRows = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      tradeType: trade.tradeType,
      volume: trade.volume,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      originType: trade.originType,
      outcome: trade.outcome,
      profit: trade.profit,
    })
    .from(trade)
    .where(
      and(
        eq(trade.accountId, input.accountId),
        eq(trade.symbol, input.symbol),
        gte(trade.openTime, from),
        lte(trade.openTime, to),
        not(eq(trade.originType, "manual_entry")),
        input.tradeId ? not(eq(trade.id, input.tradeId)) : sql`true`
      )
    )
    .orderBy(desc(trade.openTime))
    .limit(25);

  return candidateRows
    .map((row) => {
      const rowDirection =
        String(row.tradeType).toLowerCase() === "short" ? "short" : "long";
      const openPrice = toNumber(row.openPrice) ?? 0;
      const closePrice = toNumber(row.closePrice);
      const volume = toNumber(row.volume) ?? 0;
      const openTime = row.openTime ?? new Date(0);
      const closeTime = row.closeTime;
      const openTimeDeltaMs = Math.abs(
        openTime.getTime() - input.openTime.getTime()
      );
      const closeTimeDeltaMs =
        input.closeTime && closeTime
          ? Math.abs(closeTime.getTime() - input.closeTime.getTime())
          : null;

      let score = 0;
      if (row.symbol === input.symbol) score += 20;
      if (rowDirection === input.tradeType) score += 12;
      score += volumeSimilarityScore(volume, input.volume);
      score += priceSimilarityScore(openPrice, input.openPrice);
      score += timeSimilarityScore(openTimeDeltaMs, 20, 12);

      if (input.closePrice != null && closePrice != null) {
        score += priceSimilarityScore(closePrice, input.closePrice);
      }
      if (closeTimeDeltaMs != null) {
        score += timeSimilarityScore(closeTimeDeltaMs, 14, 8);
      }

      if (row.originType === "broker_sync") score += 6;
      if (row.originType === "csv_import") score += 3;

      return {
        id: row.id,
        score,
        symbol: row.symbol,
        tradeType: rowDirection,
        originType: row.originType,
        outcome: row.outcome,
        profit: toNumber(row.profit),
        openTime,
        closeTime,
        reasons: buildReasons({
          symbolMatches: row.symbol === input.symbol,
          directionMatches: rowDirection === input.tradeType,
          openTimeDeltaMs,
          closeTimeDeltaMs,
          volumeMatches: volumeSimilarityScore(volume, input.volume) >= 8,
          originType: row.originType,
        }),
      };
    })
    .filter((row) => row.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
