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
import { getBrokerPipSize, normalizeBrokerSymbol } from "./mt5/symbol-specs";

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

interface PostExitResult {
  postExitPeakPrice: number | null;
  postExitPeakTimestamp: Date | null;
}

interface PriceWindowRow {
  time: Date;
  highBid: string | null;
  lowBid: string | null;
  highAsk: string | null;
  lowAsk: string | null;
  high: string | null;
  low: string | null;
  bidPrice: string | null;
  askPrice: string | null;
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSideSpecificHighLow(
  candle: PriceWindowRow,
  tradeType: "long" | "short"
) {
  if (tradeType === "long") {
    const bid = toNullableNumber(candle.bidPrice);
    return {
      high:
        toNullableNumber(candle.highBid) ??
        bid ??
        toNullableNumber(candle.high),
      low:
        toNullableNumber(candle.lowBid) ??
        bid ??
        toNullableNumber(candle.low),
    };
  }

  const ask = toNullableNumber(candle.askPrice);
  return {
    high:
      toNullableNumber(candle.highAsk) ??
      ask ??
      toNullableNumber(candle.high),
    low:
      toNullableNumber(candle.lowAsk) ??
      ask ??
      toNullableNumber(candle.low),
  };
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
      bidPrice: historicalPrices.bidPrice,
      askPrice: historicalPrices.askPrice,
    })
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.accountId, accountId),
        eq(historicalPrices.symbol, normalizeBrokerSymbol(symbol)),
        gte(historicalPrices.time, open),
        lte(historicalPrices.time, close),
        sql`(
          ${historicalPrices.highBid} IS NOT NULL OR
          ${historicalPrices.highAsk} IS NOT NULL OR
          ${historicalPrices.high} IS NOT NULL OR
          ${historicalPrices.bidPrice} IS NOT NULL OR
          ${historicalPrices.askPrice} IS NOT NULL
        )`
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
    const { high, low } = getSideSpecificHighLow(candle, tradeType);

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
  const pipSize = await getBrokerPipSize(accountId, symbol);

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
 * Calculate post-exit peak movement for a trade using historical price data
 * Uses the same data source as manipulation calculation (historicalPrices).
 */
export async function calculatePostExitPeak(
  tradeData: TradeData,
  accountId: string,
  windowSeconds: number
): Promise<PostExitResult> {
  const { symbol, tradeType, close } = tradeData;

  const from = new Date(close);
  const to = new Date(from.getTime() + windowSeconds * 1000);

  const priceData = await db
    .select({
      time: historicalPrices.time,
      highBid: historicalPrices.highBid,
      lowBid: historicalPrices.lowBid,
      highAsk: historicalPrices.highAsk,
      lowAsk: historicalPrices.lowAsk,
      high: historicalPrices.high,
      low: historicalPrices.low,
      bidPrice: historicalPrices.bidPrice,
      askPrice: historicalPrices.askPrice,
    })
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.accountId, accountId),
        eq(historicalPrices.symbol, normalizeBrokerSymbol(symbol)),
        gte(historicalPrices.time, from),
        lte(historicalPrices.time, to),
        sql`(
          ${historicalPrices.highBid} IS NOT NULL OR
          ${historicalPrices.highAsk} IS NOT NULL OR
          ${historicalPrices.high} IS NOT NULL OR
          ${historicalPrices.bidPrice} IS NOT NULL OR
          ${historicalPrices.askPrice} IS NOT NULL
        )`
      )
    )
    .orderBy(historicalPrices.time);

  if (!priceData || priceData.length === 0) {
    console.warn(`No post-exit price data for trade ${tradeData.id}`);
    return {
      postExitPeakPrice: null,
      postExitPeakTimestamp: null,
    };
  }

  let peakPrice: number | null = null;
  let peakTime: Date | null = null;

  for (const candle of priceData) {
    const { high, low } = getSideSpecificHighLow(candle, tradeType);

    if (tradeType === "long") {
      if (high != null && (peakPrice === null || high > peakPrice)) {
        peakPrice = high;
        peakTime = candle.time;
      }
    } else {
      if (low != null && (peakPrice === null || low < peakPrice)) {
        peakPrice = low;
        peakTime = candle.time;
      }
    }
  }

  return {
    postExitPeakPrice: peakPrice,
    postExitPeakTimestamp: peakTime,
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

/**
 * Batch update post-exit peak data for all trades in an account
 */
export async function updateAccountPostExitPeaks(
  accountId: string,
  windowSeconds: number,
  onlyMissing: boolean = true,
  progressCallback?: (current: number, total: number) => void
): Promise<{ processed: number; failed: number }> {
  const trades = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      tradeType: trade.tradeType,
      open: trade.open,
      close: trade.close,
      entryPeakTimestamp: trade.entryPeakTimestamp,
      postExitPeakTimestamp: trade.postExitPeakTimestamp,
    })
    .from(trade)
    .where(eq(trade.accountId, accountId))
    .orderBy(trade.open);

  let processed = 0;
  let failed = 0;

  for (const tradeData of trades) {
    try {
      if (
        !tradeData.symbol ||
        !tradeData.tradeType ||
        !tradeData.open ||
        !tradeData.close
      ) {
        failed++;
        continue;
      }

      if (onlyMissing && tradeData.postExitPeakTimestamp != null) {
        processed++;
        continue;
      }

      const postExit = await calculatePostExitPeak(
        {
          id: tradeData.id,
          symbol: tradeData.symbol,
          openPrice: Number(tradeData.openPrice || 0),
          closePrice: Number(tradeData.closePrice || 0),
          tradeType: tradeData.tradeType as "long" | "short",
          open: new Date(tradeData.open),
          close: new Date(tradeData.close),
        },
        accountId,
        windowSeconds
      );

      const entryPeakSeconds =
        tradeData.entryPeakTimestamp && tradeData.open
          ? Math.max(
              0,
              Math.floor(
                (new Date(tradeData.entryPeakTimestamp).getTime() -
                  new Date(tradeData.open).getTime()) /
                  1000
              )
            )
          : null;

      const postExitSeconds =
        postExit.postExitPeakTimestamp && tradeData.close
          ? Math.max(
              0,
              Math.floor(
                (new Date(postExit.postExitPeakTimestamp).getTime() -
                  new Date(tradeData.close).getTime()) /
                  1000
              )
            )
          : null;

      await db
        .update(trade)
        .set({
          postExitPeakPrice: postExit.postExitPeakPrice?.toString() || null,
          postExitPeakTimestamp: postExit.postExitPeakTimestamp || null,
          postExitSamplingDuration: windowSeconds,
          postExitPeakDurationSeconds:
            postExitSeconds != null ? postExitSeconds : null,
          entryPeakDurationSeconds:
            entryPeakSeconds != null ? entryPeakSeconds : null,
        })
        .where(eq(trade.id, tradeData.id));

      processed++;

      if (progressCallback) {
        progressCallback(processed + failed, trades.length);
      }
    } catch (error) {
      console.error(`Error processing post-exit for trade ${tradeData.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Update post-exit peak data for a single trade
 */
export async function updateTradePostExitPeak(
  tradeId: string,
  accountId: string,
  windowSeconds: number
): Promise<void> {
  const trades = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      tradeType: trade.tradeType,
      open: trade.open,
      close: trade.close,
      entryPeakTimestamp: trade.entryPeakTimestamp,
      postExitPeakTimestamp: trade.postExitPeakTimestamp,
    })
    .from(trade)
    .where(and(eq(trade.id, tradeId), eq(trade.accountId, accountId)))
    .limit(1);

  if (!trades.length) return;
  const tradeData = trades[0];

  if (!tradeData.symbol || !tradeData.tradeType || !tradeData.open || !tradeData.close) {
    return;
  }

  const postExit = await calculatePostExitPeak(
    {
      id: tradeData.id,
      symbol: tradeData.symbol,
      openPrice: Number(tradeData.openPrice || 0),
      closePrice: Number(tradeData.closePrice || 0),
      tradeType: tradeData.tradeType as "long" | "short",
      open: new Date(tradeData.open),
      close: new Date(tradeData.close),
    },
    accountId,
    windowSeconds
  );

  if (!postExit.postExitPeakTimestamp) return;

  const entryPeakSeconds =
    tradeData.entryPeakTimestamp && tradeData.open
      ? Math.max(
          0,
          Math.floor(
            (new Date(tradeData.entryPeakTimestamp).getTime() -
              new Date(tradeData.open).getTime()) /
              1000
          )
        )
      : null;

  const postExitSeconds =
    postExit.postExitPeakTimestamp && tradeData.close
      ? Math.max(
          0,
          Math.floor(
            (new Date(postExit.postExitPeakTimestamp).getTime() -
              new Date(tradeData.close).getTime()) /
              1000
          )
        )
      : null;

  await db
    .update(trade)
    .set({
      postExitPeakPrice: postExit.postExitPeakPrice?.toString() || null,
      postExitPeakTimestamp: postExit.postExitPeakTimestamp || null,
      postExitSamplingDuration: windowSeconds,
      postExitPeakDurationSeconds: postExitSeconds != null ? postExitSeconds : null,
      entryPeakDurationSeconds: entryPeakSeconds != null ? entryPeakSeconds : null,
    })
    .where(eq(trade.id, tradeData.id));
}
