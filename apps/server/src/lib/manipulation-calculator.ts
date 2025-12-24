/**
 * Manipulation Structure Calculator
 *
 * Calculates adverse price movement (manipulation) during trade execution.
 * For longs: measures how low price went from entry
 * For shorts: measures how high price went from entry
 *
 * Works for both profitable and losing trades.
 */

import { db } from "../db";
import { historicalPrices, trade } from "../db/schema/trading";
import { and, eq, gte, lte, sql } from "drizzle-orm";

interface TradeData {
  id: string;
  symbol: string;
  openPrice: number;
  closePrice: number;
  tradeType: "long" | "short";
  open: Date;
  close: Date;
}

interface ManipulationResult {
  manipulationHigh: number | null;
  manipulationLow: number | null;
  manipulationPips: number | null;
  entryPeakPrice: number | null;
  entryPeakTimestamp: Date | null;
}

/**
 * Get pip size for a symbol
 */
function getPipSizeForSymbol(symbol: string): number {
  const sym = symbol.toUpperCase();

  // JPY pairs have 2 decimal places (0.01 pip)
  if (sym.includes("JPY")) {
    return 0.01;
  }

  // Most forex pairs have 4 decimal places (0.0001 pip)
  if (
    sym.match(/^[A-Z]{6}$/) || // Standard forex pairs like EURUSD
    sym.includes("USD") ||
    sym.includes("EUR") ||
    sym.includes("GBP") ||
    sym.includes("AUD") ||
    sym.includes("NZD") ||
    sym.includes("CAD") ||
    sym.includes("CHF")
  ) {
    return 0.0001;
  }

  // Metals like XAUUSD, XAGUSD typically use 0.01
  if (sym.startsWith("XAU") || sym.startsWith("XAG")) {
    return 0.01;
  }

  // Default to 0.0001 for unknown symbols
  return 0.0001;
}

/**
 * Calculate manipulation structure for a single trade using historical price data
 */
export async function calculateManipulation(
  tradeData: TradeData,
  accountId: string
): Promise<ManipulationResult> {
  const { symbol, openPrice, tradeType, open, close } = tradeData;

  // Query historical price data for this trade's timeframe
  // We'll use 1-minute candles for granular analysis
  const priceData = await db
    .select({
      time: historicalPrices.time,
      highBid: historicalPrices.highBid,
      lowBid: historicalPrices.lowBid,
      highAsk: historicalPrices.highAsk,
      lowAsk: historicalPrices.lowAsk,
      high: historicalPrices.high,
      low: historicalPrices.low,
    })
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.symbol, symbol.toUpperCase()),
        gte(historicalPrices.time, open),
        lte(historicalPrices.time, close),
        // Prefer merged bid/ask data, but fallback to single-side data
        sql`(${historicalPrices.highBid} IS NOT NULL OR ${historicalPrices.high} IS NOT NULL)`
      )
    )
    .orderBy(historicalPrices.time);

  if (!priceData || priceData.length === 0) {
    console.warn(`No price data found for trade ${tradeData.id} (${symbol})`);
    return {
      manipulationHigh: null,
      manipulationLow: null,
      manipulationPips: null,
      entryPeakPrice: null,
      entryPeakTimestamp: null,
    };
  }

  let worstPrice: number | null = null;
  let worstTime: Date | null = null;
  let bestPrice: number | null = null;
  let bestTime: Date | null = null;

  // For longs: track lowest low (adverse) and highest high (favorable)
  // For shorts: track highest high (adverse) and lowest low (favorable)
  for (const candle of priceData) {
    // Use merged bid/ask if available, otherwise use single-side data
    const high = candle.highBid != null ? Number(candle.highBid) :
                 candle.highAsk != null ? Number(candle.highAsk) :
                 candle.high != null ? Number(candle.high) : null;

    const low = candle.lowBid != null ? Number(candle.lowBid) :
                candle.lowAsk != null ? Number(candle.lowAsk) :
                candle.low != null ? Number(candle.low) : null;

    if (tradeType === "long") {
      // Adverse movement: how low did it go
      if (low != null && (worstPrice === null || low < worstPrice)) {
        worstPrice = low;
        worstTime = candle.time;
      }

      // Favorable movement: how high did it go
      if (high != null && (bestPrice === null || high > bestPrice)) {
        bestPrice = high;
        bestTime = candle.time;
      }
    } else {
      // Short trade
      // Adverse movement: how high did it go
      if (high != null && (worstPrice === null || high > worstPrice)) {
        worstPrice = high;
        worstTime = candle.time;
      }

      // Favorable movement: how low did it go
      if (low != null && (bestPrice === null || low < bestPrice)) {
        bestPrice = low;
        bestTime = candle.time;
      }
    }
  }

  // Calculate manipulation pips (adverse movement from entry)
  let manipulationPips: number | null = null;
  const pipSize = getPipSizeForSymbol(symbol);

  if (worstPrice !== null) {
    if (tradeType === "long") {
      // For longs: entry - worst low
      const adversePips = (openPrice - worstPrice) / pipSize;
      manipulationPips = adversePips > 0 ? adversePips : 0; // Only count if it went against us
    } else {
      // For shorts: worst high - entry
      const adversePips = (worstPrice - openPrice) / pipSize;
      manipulationPips = adversePips > 0 ? adversePips : 0;
    }
  }

  return {
    manipulationHigh: tradeType === "short" ? worstPrice : (bestPrice || null),
    manipulationLow: tradeType === "long" ? worstPrice : (bestPrice || null),
    manipulationPips: manipulationPips !== null ? Number(manipulationPips.toFixed(1)) : null,
    entryPeakPrice: bestPrice,
    entryPeakTimestamp: bestTime,
  };
}

/**
 * Update manipulation data for a specific trade
 */
export async function updateTradeManipulation(
  tradeId: string,
  accountId: string
): Promise<void> {
  // Fetch trade data
  const trades = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      tradeType: trade.tradeType,
      open: trade.open,
      close: trade.close,
    })
    .from(trade)
    .where(and(eq(trade.id, tradeId), eq(trade.accountId, accountId)))
    .limit(1);

  if (!trades.length) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  const tradeData = trades[0];

  if (!tradeData.symbol || !tradeData.openPrice || !tradeData.tradeType || !tradeData.open || !tradeData.close) {
    throw new Error(`Trade ${tradeId} is missing required fields`);
  }

  const manipulation = await calculateManipulation(
    {
      id: tradeData.id,
      symbol: tradeData.symbol,
      openPrice: Number(tradeData.openPrice),
      closePrice: Number(tradeData.closePrice || 0),
      tradeType: tradeData.tradeType as "long" | "short",
      open: new Date(tradeData.open),
      close: new Date(tradeData.close || Date.now()),
    },
    accountId
  );

  // Update the trade record
  await db
    .update(trade)
    .set({
      manipulationHigh: manipulation.manipulationHigh?.toString() || null,
      manipulationLow: manipulation.manipulationLow?.toString() || null,
      manipulationPips: manipulation.manipulationPips?.toString() || null,
      entryPeakPrice: manipulation.entryPeakPrice?.toString() || null,
      entryPeakTimestamp: manipulation.entryPeakTimestamp,
    })
    .where(eq(trade.id, tradeId));
}

/**
 * Batch update manipulation data for all trades in an account
 */
export async function updateAccountManipulation(
  accountId: string,
  progressCallback?: (current: number, total: number) => void
): Promise<{ processed: number; failed: number }> {
  // Fetch all trades for this account
  const trades = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      tradeType: trade.tradeType,
      open: trade.open,
      close: trade.close,
    })
    .from(trade)
    .where(eq(trade.accountId, accountId))
    .orderBy(trade.open);

  let processed = 0;
  let failed = 0;

  for (const tradeData of trades) {
    try {
      if (!tradeData.symbol || !tradeData.openPrice || !tradeData.tradeType || !tradeData.open || !tradeData.close) {
        console.warn(`Skipping trade ${tradeData.id} - missing required fields`);
        failed++;
        continue;
      }

      const manipulation = await calculateManipulation(
        {
          id: tradeData.id,
          symbol: tradeData.symbol,
          openPrice: Number(tradeData.openPrice),
          closePrice: Number(tradeData.closePrice || 0),
          tradeType: tradeData.tradeType as "long" | "short",
          open: new Date(tradeData.open),
          close: new Date(tradeData.close),
        },
        accountId
      );

      await db
        .update(trade)
        .set({
          manipulationHigh: manipulation.manipulationHigh?.toString() || null,
          manipulationLow: manipulation.manipulationLow?.toString() || null,
          manipulationPips: manipulation.manipulationPips?.toString() || null,
          entryPeakPrice: manipulation.entryPeakPrice?.toString() || null,
          entryPeakTimestamp: manipulation.entryPeakTimestamp,
        })
        .where(eq(trade.id, tradeData.id));

      processed++;

      if (progressCallback) {
        progressCallback(processed + failed, trades.length);
      }
    } catch (error) {
      console.error(`Error processing trade ${tradeData.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}
