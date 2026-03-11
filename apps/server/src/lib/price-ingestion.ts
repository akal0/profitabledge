import { db } from "../db";
import { historicalPrices } from "../db/schema/trading";

export interface PriceSnapshotInput {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string | Date;
  bidVolume?: number | null;
  askVolume?: number | null;
}

const UNCHANGED_PRICE_HEARTBEAT_MS = Number(
  process.env.HISTORICAL_PRICE_HEARTBEAT_MS ?? 60_000
);

const recentQuoteCache = new Map<
  string,
  {
    bid: number;
    ask: number;
    storedAtMs: number;
  }
>();

function toDecimal(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? null : value.toString();
}

function parseSnapshotTime(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldPersistQuoteSnapshot(input: {
  accountId: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}) {
  const cacheKey = `${input.accountId}:${input.symbol}`;
  const existing = recentQuoteCache.get(cacheKey);
  const timestampMs = input.timestamp.getTime();

  if (
    existing &&
    existing.bid === input.bid &&
    existing.ask === input.ask &&
    timestampMs - existing.storedAtMs < UNCHANGED_PRICE_HEARTBEAT_MS
  ) {
    return false;
  }

  recentQuoteCache.set(cacheKey, {
    bid: input.bid,
    ask: input.ask,
    storedAtMs: timestampMs,
  });

  if (recentQuoteCache.size > 10_000) {
    const cutoff = Date.now() - UNCHANGED_PRICE_HEARTBEAT_MS * 4;
    for (const [key, value] of recentQuoteCache.entries()) {
      if (value.storedAtMs < cutoff) {
        recentQuoteCache.delete(key);
      }
    }
  }

  return true;
}

export async function insertHistoricalPriceSnapshots(input: {
  userId: string;
  accountId: string;
  snapshots: PriceSnapshotInput[];
}) {
  const deduped = new Map<string, PriceSnapshotInput>();

  for (const snapshot of input.snapshots) {
    const symbol = snapshot.symbol.trim().toUpperCase();
    const parsedTime = parseSnapshotTime(snapshot.timestamp);

    if (
      !symbol ||
      parsedTime == null ||
      !Number.isFinite(snapshot.bid) ||
      !Number.isFinite(snapshot.ask) ||
      !shouldPersistQuoteSnapshot({
        accountId: input.accountId,
        symbol,
        bid: snapshot.bid,
        ask: snapshot.ask,
        timestamp: parsedTime,
      })
    ) {
      continue;
    }

    deduped.set(`${symbol}:${parsedTime.toISOString()}`, {
      ...snapshot,
      symbol,
      timestamp: parsedTime,
    });
  }

  const values = [...deduped.values()].map((snapshot) => ({
    id: crypto.randomUUID(),
    userId: input.userId,
    accountId: input.accountId,
    symbol: snapshot.symbol.trim().toUpperCase(),
    timeframe: "tick",
    priceType: null,
    time: snapshot.timestamp instanceof Date
      ? snapshot.timestamp
      : new Date(snapshot.timestamp),
    open: null,
    high: null,
    low: null,
    close: null,
    bidPrice: snapshot.bid.toString(),
    askPrice: snapshot.ask.toString(),
    bidVolume: toDecimal(snapshot.bidVolume),
    askVolume: toDecimal(snapshot.askVolume),
    openBid: null,
    highBid: null,
    lowBid: null,
    closeBid: null,
    openAsk: null,
    highAsk: null,
    lowAsk: null,
    closeAsk: null,
  }));

  if (values.length === 0) {
    return { inserted: 0 };
  }

  const insertedRows = await db
    .insert(historicalPrices)
    .values(values)
    .onConflictDoNothing({
      target: [
        historicalPrices.accountId,
        historicalPrices.symbol,
        historicalPrices.timeframe,
        historicalPrices.time,
      ],
    })
    .returning({ id: historicalPrices.id });

  return {
    inserted: insertedRows.length,
  };
}
