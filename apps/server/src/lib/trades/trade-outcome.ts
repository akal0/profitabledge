import { eq } from "drizzle-orm";

import { db } from "../../db";
import { trade } from "../../db/schema/trading";
import { getPipSizeForSymbol } from "../dukascopy";

export const DEFAULT_BREAKEVEN_THRESHOLD_PIPS = 0.5;
export const MAX_BREAKEVEN_THRESHOLD_PIPS = 100;
const OUTCOME_BATCH_SIZE = 100;

export type TradeOutcome = "Win" | "Loss" | "BE" | "PW";

type NumericLike = number | string | null | undefined;

type TradeOutcomeInput = {
  symbol: string;
  profit: NumericLike;
  commissions?: NumericLike;
  swap?: NumericLike;
  tp?: NumericLike;
  closePrice?: NumericLike;
  entryPrice?: NumericLike;
  tradeDirection?: "long" | "short" | null;
  beThresholdPips?: NumericLike;
};

type StoredTradeOutcomeInput = {
  outcome?: string | null;
  symbol?: string | null;
  profit?: NumericLike;
  commissions?: NumericLike;
  swap?: NumericLike;
  tp?: NumericLike;
  closePrice?: NumericLike;
  openPrice?: NumericLike;
  tradeType?: string | null;
  beThresholdPips?: NumericLike;
};

function toNullableNumber(value: NumericLike) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredNumber(value: NumericLike) {
  return toNullableNumber(value) ?? 0;
}

export function normalizeBreakevenThresholdPips(value: NumericLike) {
  const parsed = toNullableNumber(value);

  if (parsed == null) {
    return DEFAULT_BREAKEVEN_THRESHOLD_PIPS;
  }

  return Math.min(Math.max(parsed, 0), MAX_BREAKEVEN_THRESHOLD_PIPS);
}

export function calculateTradeOutcome(input: TradeOutcomeInput): TradeOutcome {
  const profit = toRequiredNumber(input.profit);
  const commissions = toRequiredNumber(input.commissions);
  const swap = toRequiredNumber(input.swap);
  const tp = toNullableNumber(input.tp);
  const closePrice = toNullableNumber(input.closePrice);
  const entryPrice = toNullableNumber(input.entryPrice);
  const beThreshold = normalizeBreakevenThresholdPips(input.beThresholdPips);
  const pipSize = getPipSizeForSymbol(input.symbol);

  if (Math.abs(profit) <= beThreshold * pipSize) {
    return "BE";
  }

  const onlyCosts = Math.abs(profit) <= Math.abs(commissions + swap) * 1.1;
  if (onlyCosts) {
    return "BE";
  }

  if (
    tp != null &&
    closePrice != null &&
    entryPrice != null &&
    input.tradeDirection
  ) {
    const movedTowardTP =
      input.tradeDirection === "long"
        ? closePrice > entryPrice && closePrice < tp
        : closePrice < entryPrice && closePrice > tp;

    if (movedTowardTP && profit > 0) {
      return "PW";
    }
  }

  return profit >= 0 ? "Win" : "Loss";
}

export function resolveStoredTradeOutcome(
  input: StoredTradeOutcomeInput
): TradeOutcome {
  if (
    input.outcome === "Win" ||
    input.outcome === "Loss" ||
    input.outcome === "BE" ||
    input.outcome === "PW"
  ) {
    return input.outcome;
  }

  return calculateTradeOutcome({
    symbol: input.symbol ?? "",
    profit: input.profit,
    commissions: input.commissions,
    swap: input.swap,
    tp: input.tp,
    closePrice: input.closePrice,
    entryPrice: input.openPrice,
    tradeDirection:
      input.tradeType === "short" || input.tradeType === "sell"
        ? "short"
        : "long",
    beThresholdPips: input.beThresholdPips,
  });
}

export async function syncAccountTradeOutcomeSettings(input: {
  accountId: string;
  breakevenThresholdPips: NumericLike;
}) {
  const normalizedThreshold = normalizeBreakevenThresholdPips(
    input.breakevenThresholdPips
  );
  const thresholdValue = normalizedThreshold.toString();

  const rows = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      tradeType: trade.tradeType,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      tp: trade.tp,
      profit: trade.profit,
      commissions: trade.commissions,
      swap: trade.swap,
    })
    .from(trade)
    .where(eq(trade.accountId, input.accountId));

  for (let index = 0; index < rows.length; index += OUTCOME_BATCH_SIZE) {
    const batch = rows.slice(index, index + OUTCOME_BATCH_SIZE);

    await Promise.all(
      batch.map((row) =>
        db
          .update(trade)
          .set({
            beThresholdPips: thresholdValue,
            outcome: calculateTradeOutcome({
              symbol: row.symbol ?? "",
              profit: row.profit,
              commissions: row.commissions,
              swap: row.swap,
              tp: row.tp,
              closePrice: row.closePrice,
              entryPrice: row.openPrice,
              tradeDirection:
                row.tradeType === "short" || row.tradeType === "sell"
                  ? "short"
                  : "long",
              beThresholdPips: normalizedThreshold,
            }),
          })
          .where(eq(trade.id, row.id))
      )
    );
  }

  return {
    updatedCount: rows.length,
    breakevenThresholdPips: normalizedThreshold,
  };
}
