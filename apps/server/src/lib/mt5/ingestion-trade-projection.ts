import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  brokerDealEvent,
  brokerOrderEvent,
  brokerPositionSnapshot,
  brokerSyncCheckpoint,
  brokerSymbolSpec,
} from "../../db/schema/mt5-sync";
import { trade, tradingAccount } from "../../db/schema/trading";
import { notifyEarnedAchievements } from "../achievements";
import { createNotification } from "../notifications";
import { deriveSessionTagAt } from "../session-tags";
import { generateFeedEventForTrade } from "../feed-event-generator";
import { DEFAULT_BREAKEVEN_THRESHOLD_PIPS } from "../trades/trade-outcome";
import {
  buildTradeLifecycleMetrics,
  buildTradeStateFallback,
  buildSymbolSpecMap,
  calculateExecutionQualityMetrics,
  calculatePips,
  getBaseTradeKey,
  getEventDate,
  getEventSortTimestamp,
  getExecutionContextFromBrokerMeta,
  getOrderTradeKey,
  getPipSizeForSymbolFromMap,
  getTradeKey,
  isCopiedTradeComment,
  mergeBrokerMetaExecutionContext,
  normalizeTradeSide,
  parseDate,
  pickLatestPositiveNumber,
  summarizeDealLifecycle,
  toDecimal,
  toNumber,
  toPositiveNumberOrNull,
  weightedAveragePrice,
} from "./ingestion-helpers";
import {
  type ModifiedPositionSeed,
  type Mt5ExecutionContext,
  type Mt5ProjectionTrade,
  type Mt5SymbolSpec,
  type Mt5SyncFrameInput,
  type Mt5TradeStateFallback,
  type OpenedPositionSeed,
  type RemovedOpenTradeSeed,
} from "./ingestion-types";
import { type MtSymbolSpecLike } from "./symbol-specs";

function deriveProjectedTrade(
  rows: Array<{
    remoteDealId: string;
    remoteOrderId: string | null;
    positionId: string | null;
    entryType: string | null;
    side: string | null;
    symbol: string;
    volume: unknown;
    price: unknown;
    profit: unknown;
    commission: unknown;
    swap: unknown;
    fee: unknown;
    sl: unknown;
    tp: unknown;
    eventTime: Date;
    rawPayload?: unknown;
  }>,
  tradeKeyOverride?: string,
  symbolSpecsBySymbol?: Map<string, Mt5SymbolSpec | MtSymbolSpecLike>,
  fallbackState?: Mt5TradeStateFallback | null
): Mt5ProjectionTrade | null {
  const sorted = [...rows].sort(
    (left, right) =>
      getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
      left.remoteDealId.localeCompare(right.remoteDealId)
  );

  const entryRows = sorted.filter(
    (row) => row.entryType === "in" || row.entryType === "inout"
  );
  const exitRows = sorted.filter(
    (row) =>
      row.entryType === "out" ||
      row.entryType === "inout" ||
      row.entryType === "out_by"
  );

  if (exitRows.length === 0) {
    return null;
  }

  const seed = entryRows[0] ?? sorted[0];
  const last = exitRows[exitRows.length - 1] ?? sorted[sorted.length - 1];

  if (!seed.side) {
    return null;
  }

  const tradeType = normalizeTradeSide(seed.side === "buy" ? "buy" : "sell");
  const tradeKey =
    tradeKeyOverride ??
    getTradeKey({
      positionId: seed.positionId,
      remoteOrderId: seed.remoteOrderId,
      remoteDealId: seed.remoteDealId,
    });
  const openPrice = weightedAveragePrice(
    entryRows.length > 0 ? entryRows : [seed]
  );
  const closePrice = weightedAveragePrice(
    exitRows.length > 0 ? exitRows : [last]
  );

  if (openPrice == null || closePrice == null) {
    return null;
  }

  const entryVolume = entryRows.reduce(
    (sum, row) => sum + toNumber(row.volume),
    0
  );
  const exitVolume = exitRows.reduce(
    (sum, row) => sum + toNumber(row.volume),
    0
  );
  const lifecycleSummary = summarizeDealLifecycle(
    sorted.map((row) => ({
      remoteDealId: row.remoteDealId,
      entryType: row.entryType,
      volume: row.volume,
      eventTime: row.eventTime,
    }))
  );
  const volume = lifecycleSummary.fullyClosed
    ? Math.max(entryVolume, exitVolume, toNumber(seed.volume))
    : Math.max(exitVolume, 0);
  const commissions = sorted.reduce(
    (sum, row) => sum + toNumber(row.commission) + toNumber(row.fee),
    0
  );
  const swap = sorted.reduce((sum, row) => sum + toNumber(row.swap), 0);
  const grossProfit = sorted.reduce(
    (sum, row) => sum + toNumber(row.profit),
    0
  );
  const profit = grossProfit + commissions + swap;
  const slRows = [...sorted]
    .reverse()
    .find((row) => toPositiveNumberOrNull(row.sl) != null);
  const tpRows = [...sorted]
    .reverse()
    .find((row) => toPositiveNumberOrNull(row.tp) != null);

  return {
    tradeKey,
    symbol: seed.symbol.toUpperCase(),
    tradeType,
    volume,
    openPrice,
    closePrice,
    openTime: getEventDate(entryRows[0] ?? seed),
    closeTime: getEventDate(last),
    profit,
    commissions,
    swap,
    pips: calculatePips(
      seed.symbol,
      tradeType,
      openPrice,
      closePrice,
      getPipSizeForSymbolFromMap(seed.symbol, symbolSpecsBySymbol)
    ),
    sl: pickLatestPositiveNumber(slRows?.sl, fallbackState?.sl),
    tp: pickLatestPositiveNumber(tpRows?.tp, fallbackState?.tp),
    entryDealCount: entryRows.length,
    exitDealCount: exitRows.length,
    entryVolume,
    exitVolume,
    scaleInCount: lifecycleSummary.scaleInCount,
    scaleOutCount: lifecycleSummary.scaleOutCount,
    provisional: false,
  };
}

function segmentProjectedTradeRows(
  baseTradeKey: string,
  rows: Array<{
    remoteDealId: string;
    remoteOrderId: string | null;
    positionId: string | null;
    entryType: string | null;
    side: string | null;
    symbol: string;
    volume: unknown;
    price: unknown;
    profit: unknown;
    commission: unknown;
    swap: unknown;
    fee: unknown;
    sl: unknown;
    tp: unknown;
    eventTime: Date;
    rawPayload?: unknown;
  }>
) {
  const sorted = [...rows].sort(
    (left, right) =>
      getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
      left.remoteDealId.localeCompare(right.remoteDealId)
  );

  const segments: Array<typeof sorted> = [];
  let current: typeof sorted = [];
  let openVolume = 0;
  const epsilon = 1e-9;

  const finalizeCurrent = () => {
    if (current.length === 0) {
      return;
    }

    const hasExit = current.some(
      (row) =>
        row.entryType === "out" ||
        row.entryType === "out_by" ||
        row.entryType === "inout"
    );
    if (hasExit) {
      segments.push(current);
    }

    current = [];
    openVolume = 0;
  };

  for (const row of sorted) {
    const volume = toNumber(row.volume);

    if (row.entryType === "in") {
      if (current.length === 0) {
        current = [row];
        openVolume = volume;
        continue;
      }

      if (openVolume <= epsilon) {
        finalizeCurrent();
        current = [row];
        openVolume = volume;
        continue;
      }

      current.push(row);
      openVolume += volume;
      continue;
    }

    if (row.entryType === "out" || row.entryType === "out_by") {
      if (current.length === 0) {
        current = [row];
      } else {
        current.push(row);
      }

      openVolume = Math.max(0, openVolume - volume);
      if (openVolume <= epsilon) {
        finalizeCurrent();
      }
      continue;
    }

    if (row.entryType === "inout") {
      if (current.length > 0) {
        current.push({ ...row, entryType: "out" });
        finalizeCurrent();
      }

      current = [{ ...row, entryType: "in" }];
      openVolume = volume;
      continue;
    }

    current.push(row);
  }

  if (current.length > 0 && current.some((row) => row.entryType === "out")) {
    finalizeCurrent();
  }

  if (segments.length <= 1) {
    return segments.map((segment) => ({
      tradeKey: baseTradeKey,
      rows: segment,
    }));
  }

  return segments.map((segment, index) => ({
    tradeKey: `${baseTradeKey}::${index + 1}`,
    rows: segment,
  }));
}

function deriveProvisionalProjectedTrade(input: {
  tradeKey: string;
  dealRows: Array<{
    remoteDealId: string;
    remoteOrderId: string | null;
    positionId: string | null;
    entryType: string | null;
    side: string | null;
    symbol: string;
    volume: unknown;
    price: unknown;
    profit: unknown;
    commission: unknown;
    swap: unknown;
    fee: unknown;
    sl: unknown;
    tp: unknown;
    eventTime: Date;
    rawPayload?: unknown;
  }>;
  orderRows: Array<{
    remoteOrderId: string;
    positionId: string | null;
    side: string | null;
    state: string | null;
    symbol: string | null;
    requestedVolume: unknown;
    price: unknown;
    sl: unknown;
    tp: unknown;
    eventTime: Date;
    rawPayload: unknown;
  }>;
  removedOpenTrade: RemovedOpenTradeSeed | null;
  symbolSpecsBySymbol?: Map<string, Mt5SymbolSpec | MtSymbolSpecLike>;
  fallbackState?: Mt5TradeStateFallback | null;
}): Mt5ProjectionTrade | null {
  const fallbackState = input.fallbackState ?? null;
  const seedTradeType =
    input.removedOpenTrade?.tradeType === "long" ||
    input.removedOpenTrade?.tradeType === "short"
      ? input.removedOpenTrade.tradeType
      : fallbackState?.tradeType ?? null;
  const entryRows = input.dealRows.filter(
    (row) => row.entryType === "in" || row.entryType === "inout"
  );
  const firstEntry = entryRows[0] ?? null;
  const tradeType =
    seedTradeType ??
    (firstEntry?.side
      ? normalizeTradeSide(firstEntry.side as "buy" | "sell")
      : null);

  if (!tradeType) {
    return null;
  }

  const closeOrderSide = tradeType === "long" ? "sell" : "buy";
  const closeOrder = [...input.orderRows]
    .filter((row) => row.side === closeOrderSide)
    .sort(
      (left, right) =>
        getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
        left.remoteOrderId.localeCompare(right.remoteOrderId)
    )
    .at(-1);

  if (!closeOrder) {
    return null;
  }

  const symbol =
    input.removedOpenTrade?.symbol ??
    fallbackState?.symbol ??
    closeOrder.symbol ??
    firstEntry?.symbol ??
    null;
  const openTime =
    input.removedOpenTrade?.openTime ??
    fallbackState?.openTime ??
    firstEntry?.eventTime ??
    null;
  const openPrice =
    input.removedOpenTrade?.openPrice != null
      ? toNumber(input.removedOpenTrade.openPrice)
      : fallbackState?.openPrice ??
        weightedAveragePrice(entryRows.length > 0 ? entryRows : []) ??
        null;

  if (!symbol || !openTime || openPrice == null) {
    return null;
  }

  const closePrice = toNumber(closeOrder.price);
  if (!Number.isFinite(closePrice) || closePrice <= 0) {
    return null;
  }

  const volume =
    input.removedOpenTrade?.volume != null
      ? toNumber(input.removedOpenTrade.volume)
      : fallbackState?.volume ?? toNumber(closeOrder.requestedVolume);
  const provisionalProfit =
    input.removedOpenTrade?.profit != null
      ? toNumber(input.removedOpenTrade.profit)
      : fallbackState?.profit ?? null;
  const provisionalSwap =
    input.removedOpenTrade?.swap != null
      ? toNumber(input.removedOpenTrade.swap)
      : fallbackState?.swap ?? null;
  const provisionalCommission =
    input.removedOpenTrade?.commission != null
      ? toNumber(input.removedOpenTrade.commission)
      : fallbackState?.commission ?? null;

  return {
    tradeKey: input.tradeKey,
    symbol: symbol.toUpperCase(),
    tradeType,
    volume,
    openPrice,
    closePrice,
    openTime,
    closeTime: closeOrder.eventTime,
    profit: provisionalProfit,
    commissions: provisionalCommission,
    swap: provisionalSwap,
    pips: calculatePips(
      symbol,
      tradeType,
      openPrice,
      closePrice,
      getPipSizeForSymbolFromMap(symbol, input.symbolSpecsBySymbol)
    ),
    sl: pickLatestPositiveNumber(
      input.removedOpenTrade?.sl,
      fallbackState?.sl,
      closeOrder.sl
    ),
    tp: pickLatestPositiveNumber(
      input.removedOpenTrade?.tp,
      fallbackState?.tp,
      closeOrder.tp
    ),
    entryDealCount: entryRows.length,
    exitDealCount: 0,
    entryVolume:
      entryRows.reduce((sum, row) => sum + toNumber(row.volume), 0) || volume,
    exitVolume: toNumber(closeOrder.requestedVolume) || volume,
    scaleInCount: Math.max(entryRows.length - 1, 0),
    scaleOutCount: 0,
    provisional: true,
  };
}

export async function projectClosedTrades(
  accountId: string,
  tradeKeys: string[],
  options?: {
    removedOpenTradesByKey?: Map<string, RemovedOpenTradeSeed>;
    executionContextsByTradeKey?: Map<string, Mt5ExecutionContext>;
    symbolSpecsBySymbol?: Map<string, Mt5SymbolSpec | MtSymbolSpecLike>;
  }
) {
  if (tradeKeys.length === 0) {
    return {
      tradesProjected: 0,
      tradeIds: [] as string[],
      createdTradeIds: [] as string[],
    };
  }

  const tradeKeySet = new Set(tradeKeys);
  const allRows = await db.query.brokerDealEvent.findMany({
    where: eq(brokerDealEvent.accountId, accountId),
  });
  const allOrderRows = await db.query.brokerOrderEvent.findMany({
    where: eq(brokerOrderEvent.accountId, accountId),
  });
  const existingTrades = await db.query.trade.findMany({
    where: eq(trade.accountId, accountId),
    columns: {
      id: true,
      ticket: true,
    },
  });
  const accountRow = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
    columns: {
      breakevenThresholdPips: true,
    },
  });
  const breakevenThresholdPips =
    accountRow?.breakevenThresholdPips != null
      ? Number(accountRow.breakevenThresholdPips)
      : DEFAULT_BREAKEVEN_THRESHOLD_PIPS;
  const baseTradeKeys = [...new Set([...tradeKeySet].map(getBaseTradeKey))];
  const latestPositionSnapshots = baseTradeKeys.length
    ? await db
        .selectDistinctOn([brokerPositionSnapshot.remotePositionId], {
          remotePositionId: brokerPositionSnapshot.remotePositionId,
          side: brokerPositionSnapshot.side,
          symbol: brokerPositionSnapshot.symbol,
          volume: brokerPositionSnapshot.volume,
          openPrice: brokerPositionSnapshot.openPrice,
          profit: brokerPositionSnapshot.profit,
          swap: brokerPositionSnapshot.swap,
          commission: brokerPositionSnapshot.commission,
          sl: brokerPositionSnapshot.sl,
          tp: brokerPositionSnapshot.tp,
          snapshotTime: brokerPositionSnapshot.snapshotTime,
        })
        .from(brokerPositionSnapshot)
        .where(
          and(
            eq(brokerPositionSnapshot.accountId, accountId),
            inArray(brokerPositionSnapshot.remotePositionId, baseTradeKeys)
          )
        )
        .orderBy(
          brokerPositionSnapshot.remotePositionId,
          desc(brokerPositionSnapshot.snapshotTime),
          desc(brokerPositionSnapshot.createdAt)
        )
    : [];
  const persistedSymbolSpecs =
    options?.symbolSpecsBySymbol ??
    buildSymbolSpecMap(
      await db.query.brokerSymbolSpec.findMany({
        where: eq(brokerSymbolSpec.accountId, accountId),
      })
    );

  const grouped = new Map<string, typeof allRows>();
  for (const row of allRows) {
    const key = getTradeKey({
      positionId: row.positionId ?? null,
      remoteOrderId: row.remoteOrderId ?? null,
      remoteDealId: row.remoteDealId,
    });

    if (!tradeKeySet.has(key)) {
      continue;
    }

    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const groupedOrders = new Map<string, typeof allOrderRows>();
  for (const row of allOrderRows) {
    const key = getOrderTradeKey({
      positionId: row.positionId ?? null,
      remoteOrderId: row.remoteOrderId,
    });

    if (!tradeKeySet.has(key)) {
      continue;
    }

    const bucket = groupedOrders.get(key) ?? [];
    bucket.push(row);
    groupedOrders.set(key, bucket);
  }

  const existingTradesByTicket = new Map<string, typeof existingTrades>();
  for (const existingTrade of existingTrades) {
    const ticket = existingTrade.ticket;
    if (!ticket) {
      continue;
    }

    const bucket = existingTradesByTicket.get(ticket) ?? [];
    bucket.push(existingTrade);
    existingTradesByTicket.set(ticket, bucket);
  }

  const latestPositionSnapshotByTradeKey = new Map<
    string,
    (typeof latestPositionSnapshots)[number]
  >();
  for (const snapshot of latestPositionSnapshots) {
    const current = latestPositionSnapshotByTradeKey.get(
      snapshot.remotePositionId
    );
    if (!current || current.snapshotTime < snapshot.snapshotTime) {
      latestPositionSnapshotByTradeKey.set(snapshot.remotePositionId, snapshot);
    }
  }

  let tradesProjected = 0;
  const projectedTradeIds: string[] = [];
  const createdTradeIds: string[] = [];

  const removedOpenTradesByKey = options?.removedOpenTradesByKey ?? new Map();
  const executionContextsByTradeKey =
    options?.executionContextsByTradeKey ?? new Map();

  for (const tradeKey of tradeKeySet) {
    const baseTradeKey = getBaseTradeKey(tradeKey);
    const rows = grouped.get(tradeKey) ?? [];
    const orderRows = groupedOrders.get(tradeKey) ?? [];
    const dealInputs = rows.map((row) => ({
      remoteDealId: row.remoteDealId,
      remoteOrderId: row.remoteOrderId ?? null,
      positionId: row.positionId ?? null,
      entryType: row.entryType ?? null,
      side: row.side ?? null,
      symbol: row.symbol,
      volume: row.volume,
      price: row.price,
      profit: row.profit,
      commission: row.commission,
      swap: row.swap,
      fee: row.fee,
      sl: row.sl,
      tp: row.tp,
      eventTime: row.eventTime,
      rawPayload: row.rawPayload ?? undefined,
    }));
    const orderInputs = orderRows.map((row) => ({
      remoteOrderId: row.remoteOrderId,
      positionId: row.positionId ?? null,
      side: row.side ?? null,
      state: row.state ?? null,
      orderType: row.orderType ?? null,
      symbol: row.symbol ?? null,
      requestedVolume: row.requestedVolume,
      price: row.price,
      sl: row.sl,
      tp: row.tp,
      eventTime: row.eventTime,
      rawPayload: row.rawPayload ?? null,
    }));
    const removedOpenTrade =
      removedOpenTradesByKey.get(tradeKey) ??
      removedOpenTradesByKey.get(baseTradeKey) ??
      null;
    const latestPositionSnapshot =
      latestPositionSnapshotByTradeKey.get(baseTradeKey) ?? null;
    const fallbackState = buildTradeStateFallback({
      tradeKey: baseTradeKey,
      removedOpenTrade,
      latestPositionSnapshot,
    });

    const segmentCandidates = segmentProjectedTradeRows(tradeKey, dealInputs);
    const projectedRows: Array<{
      projected: Mt5ProjectionTrade;
      lifecycleMetrics: ReturnType<typeof buildTradeLifecycleMetrics>;
      executionMetrics: ReturnType<typeof calculateExecutionQualityMetrics>;
      brokerMeta: Record<string, unknown> | null | undefined;
    }> = [];

    for (const segment of segmentCandidates) {
      const projected = deriveProjectedTrade(
        segment.rows,
        segment.tradeKey,
        persistedSymbolSpecs,
        fallbackState
      );
      if (!projected) {
        continue;
      }

      const segmentStart = getEventSortTimestamp(segment.rows[0]!);
      const segmentEnd = getEventSortTimestamp(
        segment.rows[segment.rows.length - 1]!
      );
      const segmentOrderRows =
        orderInputs.filter((row) => {
          const eventTs = getEventSortTimestamp(row);
          return eventTs >= segmentStart && eventTs <= segmentEnd;
        }) || [];
      const relevantOrderRows =
        segmentOrderRows.length > 0 ? segmentOrderRows : orderInputs;
      const lifecycleMetrics = buildTradeLifecycleMetrics({
        tradeKey: segment.tradeKey,
        tradeType: projected.tradeType,
        dealRows: segment.rows.map((row) => ({
          remoteDealId: row.remoteDealId,
          remoteOrderId: row.remoteOrderId ?? null,
          positionId: row.positionId ?? null,
          entryType: row.entryType ?? null,
          eventTime: row.eventTime,
          volume: row.volume,
          rawPayload: row.rawPayload ?? null,
        })),
        orderRows: relevantOrderRows.map((row) => ({
          remoteOrderId: row.remoteOrderId,
          positionId: row.positionId ?? null,
          state: row.state ?? null,
          orderType: row.orderType ?? null,
          sl: row.sl,
          tp: row.tp,
          rawPayload: row.rawPayload ?? null,
          eventTime: row.eventTime,
        })),
      });
      const executionContext =
        executionContextsByTradeKey.get(segment.tradeKey) ??
        executionContextsByTradeKey.get(tradeKey) ??
        getExecutionContextFromBrokerMeta(removedOpenTrade?.brokerMeta ?? null);
      const executionMetrics = calculateExecutionQualityMetrics({
        tradeType: projected.tradeType,
        symbol: projected.symbol,
        openPrice: projected.openPrice,
        closePrice: projected.closePrice,
        executionContext,
        symbolSpecsBySymbol: persistedSymbolSpecs,
      });
      const brokerMeta = mergeBrokerMetaExecutionContext(
        {
          ...(lifecycleMetrics.brokerMeta ?? {}),
          platform: "mt5",
          lifecycleBaseKey: tradeKey,
          lifecycleKey: segment.tradeKey,
          lifecycleSegmented: segment.tradeKey !== tradeKey,
          provisionalClosure: false,
        },
        executionContext
      );

      projectedRows.push({
        projected,
        lifecycleMetrics,
        executionMetrics,
        brokerMeta,
      });
    }

    if (projectedRows.length === 0) {
      const provisional = deriveProvisionalProjectedTrade({
        tradeKey,
        dealRows: dealInputs,
        orderRows: orderInputs,
        removedOpenTrade,
        symbolSpecsBySymbol: persistedSymbolSpecs,
        fallbackState,
      });

      if (provisional) {
        const lifecycleMetrics = buildTradeLifecycleMetrics({
          tradeKey,
          tradeType: provisional.tradeType,
          dealRows: dealInputs.map((row) => ({
            remoteDealId: row.remoteDealId,
            remoteOrderId: row.remoteOrderId ?? null,
            positionId: row.positionId ?? null,
            entryType: row.entryType ?? null,
            eventTime: row.eventTime,
            volume: row.volume,
            rawPayload: row.rawPayload ?? null,
          })),
          orderRows: orderInputs.map((row) => ({
            remoteOrderId: row.remoteOrderId,
            positionId: row.positionId ?? null,
            state: row.state ?? null,
            orderType: row.orderType ?? null,
            sl: row.sl,
            tp: row.tp,
            rawPayload: row.rawPayload ?? null,
            eventTime: row.eventTime,
          })),
        });
        const executionContext =
          executionContextsByTradeKey.get(tradeKey) ??
          getExecutionContextFromBrokerMeta(
            removedOpenTrade?.brokerMeta ?? null
          );
        const executionMetrics = calculateExecutionQualityMetrics({
          tradeType: provisional.tradeType,
          symbol: provisional.symbol,
          openPrice: provisional.openPrice,
          closePrice: provisional.closePrice,
          executionContext,
          symbolSpecsBySymbol: persistedSymbolSpecs,
        });
        const brokerMeta = mergeBrokerMetaExecutionContext(
          {
            ...(lifecycleMetrics.brokerMeta ?? {}),
            platform: "mt5",
            lifecycleBaseKey: tradeKey,
            lifecycleKey: tradeKey,
            lifecycleSegmented: false,
            provisionalClosure: true,
          },
          executionContext
        );

        projectedRows.push({
          projected: provisional,
          lifecycleMetrics,
          executionMetrics,
          brokerMeta,
        });
      }
    }

    if (projectedRows.length === 0) {
      continue;
    }

    const desiredTickets = new Set(
      projectedRows.map(({ projected }) => projected.tradeKey)
    );
    const staleTradeIds: string[] = [];
    for (const existingTrade of existingTrades) {
      const ticket = existingTrade.ticket;
      if (!ticket) {
        continue;
      }

      const isBaseTicket = ticket === tradeKey;
      const isSegmentTicket = ticket.startsWith(`${tradeKey}::`);
      if (!isBaseTicket && !isSegmentTicket) {
        continue;
      }

      if (!desiredTickets.has(ticket)) {
        staleTradeIds.push(existingTrade.id);
      }
    }

    if (staleTradeIds.length > 0) {
      await db.delete(trade).where(inArray(trade.id, staleTradeIds));
    }

    for (const {
      projected,
      lifecycleMetrics,
      executionMetrics,
      brokerMeta,
    } of projectedRows) {
      const { sessionTag, sessionTagColor } = deriveSessionTagAt(
        projected.openTime
      );
      const existingRows = existingTradesByTicket.get(projected.tradeKey) ?? [];
      const existingTrade = existingRows[0] ?? null;
      const duplicateTradeIds = existingRows.slice(1).map((row) => row.id);

      if (duplicateTradeIds.length > 0) {
        await db.delete(trade).where(inArray(trade.id, duplicateTradeIds));
      }

      const updatePayload = {
        ticket: projected.tradeKey,
        tradeType: projected.tradeType,
        symbol: projected.symbol,
        volume: projected.volume.toString(),
        openPrice: projected.openPrice.toString(),
        sl: toDecimal(projected.sl),
        tp: toDecimal(projected.tp),
        closePrice: projected.closePrice.toString(),
        swap: toDecimal(projected.swap),
        commissions: toDecimal(projected.commissions),
        profit: toDecimal(projected.profit),
        pips: projected.pips.toString(),
        tradeDurationSeconds: Math.round(
          (projected.closeTime.getTime() - projected.openTime.getTime()) / 1000
        ).toString(),
        openTime: projected.openTime,
        closeTime: projected.closeTime,
        open: projected.openTime.toISOString(),
        close: projected.closeTime.toISOString(),
        entryDealCount: lifecycleMetrics.entryDealCount,
        exitDealCount: lifecycleMetrics.exitDealCount,
        slModCount: lifecycleMetrics.slModCount,
        tpModCount: lifecycleMetrics.tpModCount,
        partialCloseCount: lifecycleMetrics.partialCloseCount,
        entryVolume: lifecycleMetrics.entryVolume.toString(),
        exitVolume: lifecycleMetrics.exitVolume.toString(),
        scaleInCount: lifecycleMetrics.scaleInCount,
        scaleOutCount: lifecycleMetrics.scaleOutCount,
        trailingStopDetected: lifecycleMetrics.trailingStopDetected,
        sessionTag: sessionTag ?? undefined,
        sessionTagColor,
        killzone: sessionTag,
        killzoneColor: sessionTagColor,
        brokerMeta,
        useBrokerData: 1,
        beThresholdPips: breakevenThresholdPips.toString(),
        entrySpreadPips: toDecimal(executionMetrics?.entrySpreadPips),
        exitSpreadPips: toDecimal(executionMetrics?.exitSpreadPips),
        entrySlippagePips: toDecimal(executionMetrics?.entrySlippagePips),
        exitSlippagePips: toDecimal(executionMetrics?.exitSlippagePips),
      };

      if (existingTrade) {
        await db
          .update(trade)
          .set(updatePayload)
          .where(eq(trade.id, existingTrade.id));
        projectedTradeIds.push(existingTrade.id);
      } else {
        const tradeId = crypto.randomUUID();
        await db.insert(trade).values({
          id: tradeId,
          accountId,
          manipulationHigh: null,
          manipulationLow: null,
          manipulationPips: null,
          entryPeakPrice: null,
          entryPeakTimestamp: null,
          postExitPeakPrice: null,
          postExitPeakTimestamp: null,
          postExitSamplingDuration: null,
          entryPeakDurationSeconds: null,
          postExitPeakDurationSeconds: null,
          entryBalance: null,
          entryEquity: null,
          entryMargin: null,
          entryFreeMargin: null,
          entryMarginLevel: null,
          outcome: null,
          ...updatePayload,
          createdAt: new Date(),
        });
        projectedTradeIds.push(tradeId);
        createdTradeIds.push(tradeId);
      }

      tradesProjected += 1;
    }
  }

  return { tradesProjected, tradeIds: projectedTradeIds, createdTradeIds };
}

export async function collectAllMt5TradeKeysForAccount(input: {
  accountId: string;
  connectionId?: string;
}) {
  const dealRows = await db
    .select({
      remoteDealId: brokerDealEvent.remoteDealId,
      remoteOrderId: brokerDealEvent.remoteOrderId,
      positionId: brokerDealEvent.positionId,
    })
    .from(brokerDealEvent)
    .where(
      input.connectionId
        ? and(
            eq(brokerDealEvent.accountId, input.accountId),
            eq(brokerDealEvent.connectionId, input.connectionId)
          )
        : eq(brokerDealEvent.accountId, input.accountId)
    );

  const orderRows = await db
    .select({
      remoteOrderId: brokerOrderEvent.remoteOrderId,
      positionId: brokerOrderEvent.positionId,
    })
    .from(brokerOrderEvent)
    .where(
      input.connectionId
        ? and(
            eq(brokerOrderEvent.accountId, input.accountId),
            eq(brokerOrderEvent.connectionId, input.connectionId)
          )
        : eq(brokerOrderEvent.accountId, input.accountId)
    );

  return [
    ...new Set([
      ...dealRows.map((row) =>
        getTradeKey({
          positionId: row.positionId ?? null,
          remoteOrderId: row.remoteOrderId ?? null,
          remoteDealId: row.remoteDealId,
        })
      ),
      ...orderRows.map((row) =>
        getOrderTradeKey({
          positionId: row.positionId ?? null,
          remoteOrderId: row.remoteOrderId,
        })
      ),
    ]),
  ];
}

export async function updateCheckpoint(
  connectionId: string,
  accountId: string,
  input: Mt5SyncFrameInput
) {
  const lastDeal = [...input.deals].sort((left, right) =>
    left.eventTime.localeCompare(right.eventTime)
  )[input.deals.length - 1];
  const lastOrder = [...input.orders].sort((left, right) =>
    left.eventTime.localeCompare(right.eventTime)
  )[input.orders.length - 1];

  await db
    .insert(brokerSyncCheckpoint)
    .values({
      connectionId,
      accountId,
      platform: "mt5",
      lastDealTime: input.checkpoint?.lastDealTime
        ? parseDate(input.checkpoint.lastDealTime)
        : lastDeal
        ? parseDate(lastDeal.eventTime)
        : null,
      lastDealId:
        input.checkpoint?.lastDealId ?? lastDeal?.remoteDealId ?? null,
      lastOrderTime: input.checkpoint?.lastOrderTime
        ? parseDate(input.checkpoint.lastOrderTime)
        : lastOrder
        ? parseDate(lastOrder.eventTime)
        : null,
      lastPositionPollAt: input.checkpoint?.lastPositionPollAt
        ? parseDate(input.checkpoint.lastPositionPollAt)
        : parseDate(input.account.snapshotTime),
      lastAccountPollAt: input.checkpoint?.lastAccountPollAt
        ? parseDate(input.checkpoint.lastAccountPollAt)
        : parseDate(input.account.snapshotTime),
      lastFullReconcileAt: input.checkpoint?.lastFullReconcileAt
        ? parseDate(input.checkpoint.lastFullReconcileAt)
        : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: brokerSyncCheckpoint.connectionId,
      set: {
        accountId,
        lastDealTime: input.checkpoint?.lastDealTime
          ? parseDate(input.checkpoint.lastDealTime)
          : lastDeal
          ? parseDate(lastDeal.eventTime)
          : null,
        lastDealId:
          input.checkpoint?.lastDealId ?? lastDeal?.remoteDealId ?? null,
        lastOrderTime: input.checkpoint?.lastOrderTime
          ? parseDate(input.checkpoint.lastOrderTime)
          : lastOrder
          ? parseDate(lastOrder.eventTime)
          : null,
        lastPositionPollAt: input.checkpoint?.lastPositionPollAt
          ? parseDate(input.checkpoint.lastPositionPollAt)
          : parseDate(input.account.snapshotTime),
        lastAccountPollAt: input.checkpoint?.lastAccountPollAt
          ? parseDate(input.checkpoint.lastAccountPollAt)
          : parseDate(input.account.snapshotTime),
        lastFullReconcileAt: input.checkpoint?.lastFullReconcileAt
          ? parseDate(input.checkpoint.lastFullReconcileAt)
          : null,
        updatedAt: new Date(),
      },
    });
}

export async function emitMt5ClosedTradeSideEffects(input: {
  userId: string;
  accountId: string;
  connectionDisplayName: string;
  tradeIds: string[];
}) {
  const tradeIds = [...new Set(input.tradeIds.filter(Boolean))];
  if (tradeIds.length === 0) {
    return;
  }

  const trades = await db.query.trade.findMany({
    where: and(
      eq(trade.accountId, input.accountId),
      inArray(trade.id, tradeIds)
    ),
  });
  const createdTrades = trades;

  if (createdTrades.length === 0) {
    return;
  }

  await createNotification({
    userId: input.userId,
    accountId: input.accountId,
    type: "trade_closed",
    title:
      createdTrades.length === 1
        ? `${createdTrades[0]?.symbol ?? "Trade"} closed`
        : `${createdTrades.length} MT5 trades closed`,
    body:
      createdTrades.length === 1
        ? `${input.connectionDisplayName} synced a closed trade from ${
            createdTrades[0]?.symbol ?? "your MT5 account"
          }.`
        : `${input.connectionDisplayName} synced ${createdTrades.length} closed trades.`,
    metadata: {
      source: "mt5-terminal",
      tradeIds,
    },
    dedupeKey: `mt5-trade-closed:${input.accountId}:${tradeIds
      .sort()
      .join(",")}`,
  });

  void notifyEarnedAchievements({
    userId: input.userId,
    accountId: input.accountId,
    source: "mt5-terminal",
  }).catch((error) => {
    console.error("[MT5] Achievement notification failed:", error);
  });

  for (const tradeId of tradeIds) {
    void generateFeedEventForTrade(tradeId).catch((error) => {
      console.error("[mt5] feed event generation failed", tradeId, error);
    });
  }
}

export async function emitMt5CopierPositionSideEffects(input: {
  accountId: string;
  account: Mt5SyncFrameInput["account"];
  openedPositions: OpenedPositionSeed[];
  modifiedPositions: ModifiedPositionSeed[];
  removedOpenTrades: RemovedOpenTradeSeed[];
}) {
  const openedPositions = input.openedPositions.filter(
    (position) => !isCopiedTradeComment(position.comment)
  );
  const modifiedPositions = input.modifiedPositions.filter(
    (position) => !isCopiedTradeComment(position.comment)
  );
  const removedOpenTrades = input.removedOpenTrades.filter(
    (tradeSeed) => !isCopiedTradeComment(tradeSeed.comment)
  );

  if (
    openedPositions.length === 0 &&
    modifiedPositions.length === 0 &&
    removedOpenTrades.length === 0
  ) {
    return;
  }

  const {
    findGroupsForMaster,
    processMasterTradeOpen,
    processMasterTradeClose,
    processMasterTradeModify,
  } = await import("../copy-engine");

  const activeGroupIds = await findGroupsForMaster(input.accountId);
  if (activeGroupIds.length === 0) {
    return;
  }

  const masterMetrics = {
    balance: input.account.balance,
    equity: input.account.equity,
    initialBalance: input.account.balance,
  };

  for (const position of openedPositions) {
    const { sessionTag } = deriveSessionTagAt(position.openTime);
    await processMasterTradeOpen(
      input.accountId,
      {
        ticket: position.ticket,
        symbol: position.symbol,
        tradeType: position.tradeType,
        volume: position.volume,
        openPrice: position.openPrice,
        sl: position.sl ?? undefined,
        tp: position.tp ?? undefined,
        sessionTag: sessionTag ?? undefined,
      },
      masterMetrics
    );
  }

  for (const position of modifiedPositions) {
    await processMasterTradeModify(
      input.accountId,
      position.ticket,
      position.newSl,
      position.newTp
    );
  }

  for (const removedTrade of removedOpenTrades) {
    await processMasterTradeClose(
      input.accountId,
      removedTrade.ticket,
      toNumber(removedTrade.currentPrice ?? removedTrade.openPrice),
      toNumber(removedTrade.profit)
    );
  }
}
