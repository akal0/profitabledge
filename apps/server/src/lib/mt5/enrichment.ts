import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { brokerAccountSnapshot } from "../../db/schema/mt5-sync";
import { historicalPrices, trade } from "../../db/schema/trading";
import {
  calculateAllAdvancedMetrics,
  type TradeData,
} from "../advanced-metrics";
import {
  updateTradeManipulation,
  updateTradePostExitPeak,
} from "../manipulation-calculator";
import { getBrokerPipSize, normalizeBrokerSymbol } from "./symbol-specs";

const DEFAULT_POST_EXIT_WINDOW_SECONDS = 60 * 60;
const DEFAULT_EXECUTION_QUOTE_WINDOW_SECONDS = 30;

function toNumericString(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? null : value.toString();
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeQuoteNumber(value: string | number | null | undefined) {
  return toNullableNumber(value);
}

function normalizeQuoteRow(row: {
  time: Date;
  bidPrice: string | null;
  askPrice: string | null;
  openBid: string | null;
  closeBid: string | null;
  highBid: string | null;
  lowBid: string | null;
  openAsk: string | null;
  closeAsk: string | null;
  highAsk: string | null;
  lowAsk: string | null;
}) {
  const bid =
    normalizeQuoteNumber(row.bidPrice) ??
    normalizeQuoteNumber(row.closeBid) ??
    normalizeQuoteNumber(row.openBid) ??
    normalizeQuoteNumber(row.highBid) ??
    normalizeQuoteNumber(row.lowBid);
  const ask =
    normalizeQuoteNumber(row.askPrice) ??
    normalizeQuoteNumber(row.closeAsk) ??
    normalizeQuoteNumber(row.openAsk) ??
    normalizeQuoteNumber(row.highAsk) ??
    normalizeQuoteNumber(row.lowAsk);

  if (bid == null && ask == null) {
    return null;
  }

  return {
    time: row.time,
    bid,
    ask,
  };
}

function toTradeData(
  row: typeof trade.$inferSelect
): TradeData | null {
  if (!row.symbol || !row.tradeType || !row.openPrice) {
    return null;
  }

  return {
    id: row.id,
    symbol: row.symbol,
    tradeDirection: row.tradeType as "long" | "short",
    entryPrice: toNumber(row.openPrice),
    sl: toNullableNumber(row.sl),
    tp: toNullableNumber(row.tp),
    closePrice: toNullableNumber(row.closePrice),
    profit: toNumber(row.profit),
    commissions: toNullableNumber(row.commissions),
    swap: toNullableNumber(row.swap),
    volume: toNumber(row.volume),
    manipulationHigh: toNullableNumber(row.manipulationHigh),
    manipulationLow: toNullableNumber(row.manipulationLow),
    manipulationPips: toNullableNumber(row.manipulationPips),
    entryPeakPrice: toNullableNumber(row.entryPeakPrice),
    postExitPeakPrice: toNullableNumber(row.postExitPeakPrice),
    alphaWeightedMpe: toNullableNumber(row.alphaWeightedMpe) ?? 0.3,
    beThresholdPips: toNullableNumber(row.beThresholdPips) ?? 0.5,
  };
}

async function findNearestAccountSnapshot(accountId: string, at: Date) {
  const [before, after] = await Promise.all([
    db.query.brokerAccountSnapshot.findFirst({
      where: and(
        eq(brokerAccountSnapshot.accountId, accountId),
        lte(brokerAccountSnapshot.snapshotTime, at)
      ),
      orderBy: desc(brokerAccountSnapshot.snapshotTime),
    }),
    db.query.brokerAccountSnapshot.findFirst({
      where: and(
        eq(brokerAccountSnapshot.accountId, accountId),
        gte(brokerAccountSnapshot.snapshotTime, at)
      ),
      orderBy: asc(brokerAccountSnapshot.snapshotTime),
    }),
  ]);

  if (!before) {
    return after ?? null;
  }

  if (!after) {
    return before;
  }

  const beforeDiff = Math.abs(before.snapshotTime.getTime() - at.getTime());
  const afterDiff = Math.abs(after.snapshotTime.getTime() - at.getTime());

  return beforeDiff <= afterDiff ? before : after;
}

async function hasHistoricalCoverage(
  accountId: string,
  symbol: string,
  from: Date,
  to: Date
) {
  const rows = await db
    .select({ id: historicalPrices.id })
    .from(historicalPrices)
    .where(
        and(
          eq(historicalPrices.accountId, accountId),
          eq(historicalPrices.symbol, normalizeBrokerSymbol(symbol)),
          gte(historicalPrices.time, from),
          lte(historicalPrices.time, to)
        )
    )
    .limit(1);

  return rows.length > 0;
}

async function findNearestQuoteSnapshot(
  accountId: string,
  symbol: string,
  at: Date,
  windowSeconds: number = DEFAULT_EXECUTION_QUOTE_WINDOW_SECONDS
) {
  const windowStart = new Date(at.getTime() - windowSeconds * 1000);
  const windowEnd = new Date(at.getTime() + windowSeconds * 1000);

  const [beforeRows, afterRows] = await Promise.all([
    db
      .select({
        time: historicalPrices.time,
        bidPrice: historicalPrices.bidPrice,
        askPrice: historicalPrices.askPrice,
        openBid: historicalPrices.openBid,
        closeBid: historicalPrices.closeBid,
        highBid: historicalPrices.highBid,
        lowBid: historicalPrices.lowBid,
        openAsk: historicalPrices.openAsk,
        closeAsk: historicalPrices.closeAsk,
        highAsk: historicalPrices.highAsk,
        lowAsk: historicalPrices.lowAsk,
      })
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.accountId, accountId),
          eq(historicalPrices.symbol, normalizeBrokerSymbol(symbol)),
          gte(historicalPrices.time, windowStart),
          lte(historicalPrices.time, at)
        )
      )
      .orderBy(desc(historicalPrices.time))
      .limit(1),
    db
      .select({
        time: historicalPrices.time,
        bidPrice: historicalPrices.bidPrice,
        askPrice: historicalPrices.askPrice,
        openBid: historicalPrices.openBid,
        closeBid: historicalPrices.closeBid,
        highBid: historicalPrices.highBid,
        lowBid: historicalPrices.lowBid,
        openAsk: historicalPrices.openAsk,
        closeAsk: historicalPrices.closeAsk,
        highAsk: historicalPrices.highAsk,
        lowAsk: historicalPrices.lowAsk,
      })
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.accountId, accountId),
          eq(historicalPrices.symbol, normalizeBrokerSymbol(symbol)),
          gte(historicalPrices.time, at),
          lte(historicalPrices.time, windowEnd)
        )
      )
      .orderBy(asc(historicalPrices.time))
      .limit(1),
  ]);

  const candidates = [...beforeRows, ...afterRows]
    .map((row) => normalizeQuoteRow(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (left, right) =>
      Math.abs(left.time.getTime() - at.getTime()) -
      Math.abs(right.time.getTime() - at.getTime())
  )[0] ?? null;
}

async function applyEntrySnapshot(tradeId: string, accountId: string, openTime: Date) {
  const snapshot = await findNearestAccountSnapshot(accountId, openTime);
  if (!snapshot) {
    return;
  }

  await db
    .update(trade)
    .set({
      entryBalance: snapshot.balance?.toString() ?? null,
      entryEquity: snapshot.equity?.toString() ?? null,
      entryMargin: snapshot.margin?.toString() ?? null,
      entryFreeMargin: snapshot.freeMargin?.toString() ?? null,
      entryMarginLevel: snapshot.marginLevel?.toString() ?? null,
    })
    .where(eq(trade.id, tradeId));
}

async function applyExecutionQualityMetrics(tradeId: string, accountId: string) {
  const current = await db.query.trade.findFirst({
    where: and(eq(trade.id, tradeId), eq(trade.accountId, accountId)),
  });

  if (
    !current?.symbol ||
    !current.tradeType ||
    !current.openTime ||
    !current.closeTime ||
    current.openPrice == null ||
    current.closePrice == null
  ) {
    return;
  }

  const [entryQuote, exitQuote] = await Promise.all([
    findNearestQuoteSnapshot(accountId, current.symbol, current.openTime),
    findNearestQuoteSnapshot(accountId, current.symbol, current.closeTime),
  ]);

  if (!entryQuote && !exitQuote) {
    return;
  }

  const pipSize = await getBrokerPipSize(accountId, current.symbol);
  const openPrice = toNumber(current.openPrice);
  const closePrice = toNumber(current.closePrice);
  const isLong = current.tradeType === "long";

  const entrySpreadPips =
    entryQuote?.bid != null && entryQuote.ask != null
      ? (entryQuote.ask - entryQuote.bid) / pipSize
      : null;
  const exitSpreadPips =
    exitQuote?.bid != null && exitQuote.ask != null
      ? (exitQuote.ask - exitQuote.bid) / pipSize
      : null;
  const entrySlippagePips =
    isLong && entryQuote?.ask != null
      ? Math.abs(openPrice - entryQuote.ask) / pipSize
      : !isLong && entryQuote?.bid != null
        ? Math.abs(entryQuote.bid - openPrice) / pipSize
        : null;
  const exitSlippagePips =
    isLong && exitQuote?.bid != null
      ? Math.abs(closePrice - exitQuote.bid) / pipSize
      : !isLong && exitQuote?.ask != null
        ? Math.abs(exitQuote.ask - closePrice) / pipSize
        : null;

  await db
    .update(trade)
    .set({
      entrySpreadPips:
        entrySpreadPips != null
          ? toNumericString(entrySpreadPips)
          : current.entrySpreadPips,
      exitSpreadPips:
        exitSpreadPips != null
          ? toNumericString(exitSpreadPips)
          : current.exitSpreadPips,
      entrySlippagePips:
        entrySlippagePips != null
          ? toNumericString(entrySlippagePips)
          : current.entrySlippagePips,
      exitSlippagePips:
        exitSlippagePips != null
          ? toNumericString(exitSlippagePips)
          : current.exitSlippagePips,
    })
    .where(eq(trade.id, tradeId));
}

async function applyAdvancedMetrics(tradeId: string, accountId: string) {
  const current = await db.query.trade.findFirst({
    where: and(eq(trade.id, tradeId), eq(trade.accountId, accountId)),
  });

  if (!current) {
    return;
  }

  const tradeData = toTradeData(current);
  if (!tradeData) {
    return;
  }

  const [{ value: totalTradesInAccount }] = await db
    .select({ value: count() })
    .from(trade)
    .where(eq(trade.accountId, accountId));

  const metrics = calculateAllAdvancedMetrics(
    tradeData,
    Number(totalTradesInAccount || 0),
    false
  );

  await db
    .update(trade)
    .set({
      plannedRR:
        metrics.plannedRR != null
          ? toNumericString(metrics.plannedRR)
          : current.plannedRR,
      plannedRiskPips:
        metrics.plannedRiskPips != null
          ? toNumericString(metrics.plannedRiskPips)
          : current.plannedRiskPips,
      plannedTargetPips:
        metrics.plannedTargetPips != null
          ? toNumericString(metrics.plannedTargetPips)
          : current.plannedTargetPips,
      mfePips:
        metrics.mfePips != null
          ? toNumericString(metrics.mfePips)
          : current.mfePips,
      maePips:
        metrics.maePips != null
          ? toNumericString(metrics.maePips)
          : current.maePips,
      mpeManipLegR:
        metrics.mpeManipLegR != null
          ? toNumericString(metrics.mpeManipLegR)
          : current.mpeManipLegR,
      mpeManipPE_R:
        metrics.mpeManipPE_R != null
          ? toNumericString(metrics.mpeManipPE_R)
          : current.mpeManipPE_R,
      maxRR:
        metrics.maxRR != null ? toNumericString(metrics.maxRR) : current.maxRR,
      rawSTDV:
        metrics.rawSTDV != null
          ? toNumericString(metrics.rawSTDV)
          : current.rawSTDV,
      rawSTDV_PE:
        metrics.rawSTDV_PE != null
          ? toNumericString(metrics.rawSTDV_PE)
          : current.rawSTDV_PE,
      stdvBucket: metrics.stdvBucket ?? current.stdvBucket,
      estimatedWeightedMPE_R:
        metrics.estimatedWeightedMPE_R != null
          ? toNumericString(metrics.estimatedWeightedMPE_R)
          : current.estimatedWeightedMPE_R,
      realisedRR:
        metrics.realisedRR != null
          ? toNumericString(metrics.realisedRR)
          : current.realisedRR,
      outcome: metrics.outcome ?? current.outcome,
      rrCaptureEfficiency:
        metrics.rrCaptureEfficiency != null
          ? toNumericString(metrics.rrCaptureEfficiency)
          : current.rrCaptureEfficiency,
      manipRREfficiency:
        metrics.manipRREfficiency != null
          ? toNumericString(metrics.manipRREfficiency)
          : current.manipRREfficiency,
      exitEfficiency:
        metrics.exitEfficiency != null
          ? toNumericString(metrics.exitEfficiency)
          : current.exitEfficiency,
    })
    .where(eq(trade.id, tradeId));
}

async function enrichMt5TradeById(input: {
  accountId: string;
  tradeId: string;
  postExitWindowSeconds: number;
}) {
  const current = await db.query.trade.findFirst({
    where: and(eq(trade.id, input.tradeId), eq(trade.accountId, input.accountId)),
  });

  if (!current?.symbol || !current.openTime || !current.closeTime) {
    return false;
  }

  await applyEntrySnapshot(input.tradeId, input.accountId, current.openTime);
  await applyExecutionQualityMetrics(input.tradeId, input.accountId);

  const hasTradeWindow = await hasHistoricalCoverage(
    input.accountId,
    current.symbol,
    current.openTime,
    current.closeTime
  );

  if (hasTradeWindow) {
    await updateTradeManipulation(input.tradeId, input.accountId);
  }

  const hasPostExitWindow = await hasHistoricalCoverage(
    input.accountId,
    current.symbol,
    current.closeTime,
    new Date(
      current.closeTime.getTime() + input.postExitWindowSeconds * 1000
    )
  );

  if (hasPostExitWindow) {
    await updateTradePostExitPeak(
      input.tradeId,
      input.accountId,
      input.postExitWindowSeconds
    );
  }

  await applyAdvancedMetrics(input.tradeId, input.accountId);
  return true;
}

export async function enrichProjectedMt5Trades(input: {
  accountId: string;
  tradeIds: string[];
  postExitWindowSeconds?: number;
}) {
  const tradeIds = [...new Set(input.tradeIds.filter(Boolean))];
  if (tradeIds.length === 0) {
    return { tradesEnriched: 0 };
  }

  const postExitWindowSeconds =
    input.postExitWindowSeconds ?? DEFAULT_POST_EXIT_WINDOW_SECONDS;
  let tradesEnriched = 0;

  for (const tradeId of tradeIds) {
    const enriched = await enrichMt5TradeById({
      accountId: input.accountId,
      tradeId,
      postExitWindowSeconds,
    });
    if (enriched) {
      tradesEnriched += 1;
    }
  }

  return { tradesEnriched };
}

export async function refreshRecentMt5TradeAnalytics(input: {
  accountId: string;
  asOf?: Date;
  postExitWindowSeconds?: number;
  limit?: number;
}) {
  const asOf = input.asOf ?? new Date();
  const postExitWindowSeconds =
    input.postExitWindowSeconds ?? DEFAULT_POST_EXIT_WINDOW_SECONDS;
  const windowStart = new Date(asOf.getTime() - postExitWindowSeconds * 1000);
  const limit = Math.max(input.limit ?? 25, 1);

  const recentTrades = await db
    .select({ id: trade.id })
    .from(trade)
    .where(
      and(
        eq(trade.accountId, input.accountId),
        gte(trade.closeTime, windowStart),
        lte(trade.closeTime, asOf),
        eq(trade.useBrokerData, 1)
      )
    )
    .orderBy(desc(trade.closeTime))
    .limit(limit);

  let tradesRefreshed = 0;

  for (const row of recentTrades) {
    const enriched = await enrichMt5TradeById({
      accountId: input.accountId,
      tradeId: row.id,
      postExitWindowSeconds,
    });
    if (enriched) {
      tradesRefreshed += 1;
    }
  }

  return {
    tradesRefreshed,
  };
}
