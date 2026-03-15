import {
  mt5RawPayloadSchema,
  type Mt5ExecutionContext,
  type Mt5ProjectionTrade,
  type Mt5SymbolSpec,
  type Mt5TradeStateFallback,
  type RemovedOpenTradeSeed,
} from "./ingestion-types";
import {
  canonicalizeBrokerSymbol,
  normalizeBrokerSymbol,
  resolveBrokerPipSize,
  type MtSymbolSpecLike,
} from "./symbol-specs";

export function toDecimal(value: number | null | undefined): string | null {
  return value == null || Number.isNaN(value) ? null : value.toString();
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function isCopiedTradeComment(comment: string | null | undefined) {
  return typeof comment === "string" && comment.trim().startsWith("Copied:");
}

export function buildSymbolSpecMap<T extends Mt5SymbolSpec | MtSymbolSpecLike>(
  symbolSpecs: T[]
) {
  const symbolSpecsBySymbol = new Map<string, T>();

  for (const symbolSpec of symbolSpecs) {
    const normalized = normalizeBrokerSymbol(symbolSpec.symbol);
    symbolSpecsBySymbol.set(normalized, symbolSpec);

    const canonical = symbolSpec.canonicalSymbol
      ? normalizeBrokerSymbol(symbolSpec.canonicalSymbol)
      : canonicalizeBrokerSymbol(symbolSpec.symbol);
    if (!symbolSpecsBySymbol.has(canonical)) {
      symbolSpecsBySymbol.set(canonical, symbolSpec);
    }
  }

  return symbolSpecsBySymbol;
}

export function getPipSizeForSymbolFromMap(
  symbol: string,
  symbolSpecsBySymbol?: Map<string, Mt5SymbolSpec | MtSymbolSpecLike>
) {
  const normalized = normalizeBrokerSymbol(symbol);
  const direct = symbolSpecsBySymbol?.get(normalized);
  if (direct) {
    return resolveBrokerPipSize(symbol, direct);
  }

  const canonical = canonicalizeBrokerSymbol(symbol);
  const canonicalMatch = symbolSpecsBySymbol?.get(canonical);
  return resolveBrokerPipSize(symbol, canonicalMatch);
}

export function normalizeTradeSide(side: "buy" | "sell"): "long" | "short" {
  return side === "buy" ? "long" : "short";
}

export function calculatePips(
  symbol: string,
  side: "long" | "short",
  openPrice: number,
  closePrice: number,
  pipSize: number
): number {
  const delta =
    side === "long" ? closePrice - openPrice : openPrice - closePrice;
  const resolvedPipSize = pipSize > 0 ? pipSize : resolveBrokerPipSize(symbol);
  return Number((delta / resolvedPipSize).toFixed(1));
}

export function weightedAveragePrice(
  rows: Array<{ price: unknown; volume: unknown }>
): number | null {
  const totals = rows.reduce(
    (acc, row) => {
      const volume = toNumber(row.volume);
      return {
        volume: acc.volume + volume,
        notional: acc.notional + toNumber(row.price) * volume,
      };
    },
    { volume: 0, notional: 0 }
  );

  return totals.volume > 0 ? totals.notional / totals.volume : null;
}

export function getTradeKey(deal: {
  positionId: string | null;
  remoteOrderId: string | null;
  remoteDealId: string;
}): string {
  return deal.positionId || deal.remoteOrderId || deal.remoteDealId;
}

export function getOrderTradeKey(order: {
  positionId: string | null;
  remoteOrderId: string;
}): string {
  return order.positionId || order.remoteOrderId;
}

export function getBaseTradeKey(tradeKey: string): string {
  const delimiterIndex = tradeKey.indexOf("::");
  return delimiterIndex >= 0 ? tradeKey.slice(0, delimiterIndex) : tradeKey;
}

export function parseDate(value: string): Date {
  return new Date(value);
}

export function toPositiveNumberOrNull(value: unknown): number | null {
  const numeric = toNumber(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function pickLatestPositiveNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    const numeric = toPositiveNumberOrNull(value);
    if (numeric != null) {
      return numeric;
    }
  }

  return null;
}

export function pickLatestNullableNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (value == null) {
      continue;
    }

    const numeric = toNumber(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

export function summarizeDealLifecycle(
  dealRows: Array<{
    remoteDealId: string;
    entryType: string | null;
    volume: unknown;
    eventTime: Date;
  }>
) {
  const sorted = [...dealRows].sort(
    (left, right) =>
      getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
      left.remoteDealId.localeCompare(right.remoteDealId)
  );
  const epsilon = 1e-9;
  let openVolume = 0;
  let entryVolume = 0;
  let exitVolume = 0;
  let scaleInCount = 0;
  let scaleOutCount = 0;
  let partialCloseCount = 0;

  for (const row of sorted) {
    const volume = Math.max(toNumber(row.volume), 0);

    if (row.entryType === "in") {
      if (entryVolume > 0) {
        scaleInCount += 1;
      }
      entryVolume += volume;
      openVolume += volume;
      continue;
    }

    if (row.entryType === "out" || row.entryType === "out_by") {
      const priorOpenVolume = openVolume;
      exitVolume += volume;
      openVolume = Math.max(0, priorOpenVolume - volume);

      if (priorOpenVolume > epsilon && openVolume > epsilon) {
        partialCloseCount += 1;
        scaleOutCount += 1;
      }
      continue;
    }

    if (row.entryType === "inout") {
      const priorOpenVolume = openVolume;
      exitVolume += volume;
      openVolume = Math.max(0, priorOpenVolume - volume);

      if (priorOpenVolume > epsilon && openVolume > epsilon) {
        partialCloseCount += 1;
        scaleOutCount += 1;
      }

      if (entryVolume > 0 || priorOpenVolume > epsilon) {
        scaleInCount += 1;
      }
      entryVolume += volume;
      openVolume += volume;
    }
  }

  return {
    entryVolume,
    exitVolume,
    scaleInCount,
    scaleOutCount,
    partialCloseCount,
    remainingVolume: openVolume,
    fullyClosed: openVolume <= epsilon,
  };
}

export function buildTradeStateFallback(input: {
  tradeKey: string;
  removedOpenTrade?: RemovedOpenTradeSeed | null;
  latestPositionSnapshot?: {
    side: string;
    symbol: string;
    volume: unknown;
    openPrice: unknown;
    profit: unknown;
    swap: unknown;
    commission: unknown;
    sl: unknown;
    tp: unknown;
  } | null;
}): Mt5TradeStateFallback | null {
  const removedOpenTrade = input.removedOpenTrade ?? null;
  const latestPositionSnapshot = input.latestPositionSnapshot ?? null;
  const tradeType =
    removedOpenTrade?.tradeType === "long" ||
    removedOpenTrade?.tradeType === "short"
      ? removedOpenTrade.tradeType
      : latestPositionSnapshot?.side === "buy" ||
          latestPositionSnapshot?.side === "sell"
        ? normalizeTradeSide(latestPositionSnapshot.side as "buy" | "sell")
        : null;
  const fallback: Mt5TradeStateFallback = {
    tradeKey: input.tradeKey,
    symbol: removedOpenTrade?.symbol ?? latestPositionSnapshot?.symbol ?? null,
    tradeType,
    volume: pickLatestNullableNumber(
      removedOpenTrade?.volume,
      latestPositionSnapshot?.volume
    ),
    openPrice: pickLatestPositiveNumber(
      removedOpenTrade?.openPrice,
      latestPositionSnapshot?.openPrice
    ),
    openTime: removedOpenTrade?.openTime ?? null,
    sl: pickLatestPositiveNumber(
      removedOpenTrade?.sl,
      latestPositionSnapshot?.sl
    ),
    tp: pickLatestPositiveNumber(
      removedOpenTrade?.tp,
      latestPositionSnapshot?.tp
    ),
    profit: pickLatestNullableNumber(
      removedOpenTrade?.profit,
      latestPositionSnapshot?.profit
    ),
    swap: pickLatestNullableNumber(
      removedOpenTrade?.swap,
      latestPositionSnapshot?.swap
    ),
    commission: pickLatestNullableNumber(
      removedOpenTrade?.commission,
      latestPositionSnapshot?.commission
    ),
  };

  return fallback.symbol || fallback.tradeType || fallback.sl || fallback.tp
    ? fallback
    : null;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function sanitizeMt5SyncFrame(rawInput: unknown): unknown {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return rawInput;
  }

  const input = rawInput as Record<string, unknown>;
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const deals = Array.isArray(input.deals) ? input.deals : [];
  const orders = Array.isArray(input.orders) ? input.orders : [];
  const ledgerEvents = Array.isArray(input.ledgerEvents)
    ? input.ledgerEvents
    : [];
  const executionContexts = Array.isArray(input.executionContexts)
    ? input.executionContexts
    : [];
  const symbolSpecs = Array.isArray(input.symbolSpecs) ? input.symbolSpecs : [];
  const priceSnapshots = Array.isArray(input.priceSnapshots)
    ? input.priceSnapshots
    : [];

  return {
    ...input,
    positions: positions.filter((position) => {
      if (
        !position ||
        typeof position !== "object" ||
        Array.isArray(position)
      ) {
        return false;
      }

      const record = position as Record<string, unknown>;
      return (
        isNonEmptyString(record.remotePositionId) &&
        isNonEmptyString(record.symbol)
      );
    }),
    deals: deals.filter((deal) => {
      if (!deal || typeof deal !== "object" || Array.isArray(deal)) {
        return false;
      }

      const record = deal as Record<string, unknown>;
      return (
        isNonEmptyString(record.remoteDealId) && isNonEmptyString(record.symbol)
      );
    }),
    orders: orders.filter((order) => {
      if (!order || typeof order !== "object" || Array.isArray(order)) {
        return false;
      }

      const record = order as Record<string, unknown>;
      return (
        isNonEmptyString(record.eventKey) &&
        isNonEmptyString(record.remoteOrderId)
      );
    }),
    ledgerEvents: ledgerEvents.filter((event) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return false;
      }

      const record = event as Record<string, unknown>;
      const amount =
        typeof record.amount === "number"
          ? record.amount
          : Number(record.amount);

      return (
        isNonEmptyString(record.remoteDealId) &&
        isNonEmptyString(record.eventTime) &&
        Number.isFinite(amount)
      );
    }),
    executionContexts: executionContexts.filter((context) => {
      if (!context || typeof context !== "object" || Array.isArray(context)) {
        return false;
      }

      const record = context as Record<string, unknown>;
      return (
        isNonEmptyString(record.tradeKey) &&
        isNonEmptyString(record.symbol) &&
        isNonEmptyString(record.side)
      );
    }),
    symbolSpecs: symbolSpecs.filter((symbolSpec) => {
      if (
        !symbolSpec ||
        typeof symbolSpec !== "object" ||
        Array.isArray(symbolSpec)
      ) {
        return false;
      }

      const record = symbolSpec as Record<string, unknown>;
      return (
        isNonEmptyString(record.symbol) && isNonEmptyString(record.snapshotTime)
      );
    }),
    priceSnapshots: priceSnapshots.filter((snapshot) => {
      if (
        !snapshot ||
        typeof snapshot !== "object" ||
        Array.isArray(snapshot)
      ) {
        return false;
      }

      const record = snapshot as Record<string, unknown>;
      const bid =
        typeof record.bid === "number" ? record.bid : Number(record.bid);
      const ask =
        typeof record.ask === "number" ? record.ask : Number(record.ask);

      return (
        isNonEmptyString(record.symbol) &&
        isNonEmptyString(record.timestamp) &&
        Number.isFinite(bid) &&
        Number.isFinite(ask)
      );
    }),
  };
}

export function getRawPayloadRecord(
  rawPayload: unknown
): Record<string, unknown> | null {
  if (
    !rawPayload ||
    typeof rawPayload !== "object" ||
    Array.isArray(rawPayload)
  ) {
    return null;
  }

  return rawPayload as Record<string, unknown>;
}

export function getRawPayloadNumber(
  rawPayload: unknown,
  ...keys: string[]
): number | null {
  const record = getRawPayloadRecord(rawPayload);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function getEventSortTimestamp(row: { eventTime: Date; rawPayload?: unknown }) {
  const millis = getRawPayloadNumber(
    row.rawPayload,
    "time_msc",
    "time_update_msc",
    "time_done_msc",
    "time_setup_msc"
  );

  if (millis != null && millis > 0) {
    return millis;
  }

  return row.eventTime.getTime();
}

export function getEventDate(row: { eventTime: Date; rawPayload?: unknown }) {
  return new Date(getEventSortTimestamp(row));
}

export function getRawPayloadString(
  rawPayload: unknown,
  ...keys: string[]
): string | null {
  const record = getRawPayloadRecord(rawPayload);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

export function normalizeMt5ReasonToken(
  rawReason: unknown,
  kind: "deal" | "order"
): string | null {
  const normalizeKnown = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^enum_/, "")
      .replace(/^deal_reason_/, "")
      .replace(/^order_reason_/, "")
      .replace(/^deal_reason/, "")
      .replace(/^order_reason/, "")
      .replace(/\s+/g, "_");

  if (typeof rawReason === "string" && rawReason.trim().length > 0) {
    const normalized = normalizeKnown(rawReason);
    if (normalized === "sl") return "stop_loss";
    if (normalized === "tp") return "take_profit";
    if (normalized === "so") return "stop_out";
    if (normalized === "vmargin") return "variation_margin";
    if (normalized === "expert") return "expert";
    if (normalized === "client") return "client";
    if (normalized === "mobile") return "mobile";
    if (normalized === "web") return "web";
    if (normalized === "rollover") return "rollover";
    if (normalized === "split") return "split";
    if (normalized === "corporate_action") return "corporate_action";
    return normalized || null;
  }

  const code = getRawPayloadNumber({ reason: rawReason }, "reason");
  if (code == null) {
    return null;
  }

  if (kind === "deal") {
    switch (code) {
      case 0:
        return "client";
      case 1:
        return "mobile";
      case 2:
        return "web";
      case 3:
        return "expert";
      case 4:
        return "stop_loss";
      case 5:
        return "take_profit";
      case 6:
        return "stop_out";
      case 7:
        return "rollover";
      case 8:
        return "variation_margin";
      case 9:
        return "split";
      case 10:
        return "corporate_action";
      default:
        return `reason_${code}`;
    }
  }

  switch (code) {
    case 0:
      return "client";
    case 1:
      return "mobile";
    case 2:
      return "web";
    case 3:
      return "expert";
    case 4:
      return "stop_loss";
    case 5:
      return "take_profit";
    case 6:
      return "stop_out";
    default:
      return `reason_${code}`;
  }
}

export function mapReasonToSource(reason: string | null): string | null {
  if (!reason) {
    return null;
  }

  switch (reason) {
    case "client":
      return "desktop";
    case "mobile":
      return "mobile";
    case "web":
      return "web";
    case "expert":
      return "automated";
    case "stop_loss":
    case "take_profit":
    case "stop_out":
    case "rollover":
    case "variation_margin":
    case "split":
    case "corporate_action":
      return "system";
    default:
      return "system";
  }
}

export function deriveExecutionMode(
  entrySource: string | null,
  magicNumber: number | null
): "manual" | "automated" | "system" | "unknown" {
  if (magicNumber != null && magicNumber !== 0) {
    return "automated";
  }

  if (!entrySource) {
    return "unknown";
  }

  if (entrySource === "automated") {
    return "automated";
  }

  if (
    entrySource === "desktop" ||
    entrySource === "mobile" ||
    entrySource === "web"
  ) {
    return "manual";
  }

  if (entrySource === "system") {
    return "system";
  }

  return "unknown";
}

export function deriveCloseReason(
  exitReason: string | null,
  exitEntryType: string | null
): string | null {
  if (exitEntryType === "out_by") {
    return "close_by";
  }

  if (exitEntryType === "inout") {
    return "reverse";
  }

  switch (exitReason) {
    case "stop_loss":
      return "stop_loss";
    case "take_profit":
      return "take_profit";
    case "stop_out":
      return "stop_out";
    case "rollover":
      return "rollover";
    case "variation_margin":
      return "variation_margin";
    case "split":
      return "split";
    case "corporate_action":
      return "corporate_action";
    case "expert":
      return "automated_close";
    case "client":
    case "mobile":
    case "web":
      return "manual_close";
    default:
      return exitReason;
  }
}

export function collectLevelTrail(
  side: "long" | "short",
  levels: Array<number | null>
) {
  let modifications = 0;
  let favorableMoves = 0;
  let previous: number | null = null;
  const normalizedTrail: number[] = [];

  for (const level of levels) {
    if (level == null || Number.isNaN(level)) {
      continue;
    }

    normalizedTrail.push(level);

    if (previous == null) {
      previous = level;
      continue;
    }

    if (Math.abs(level - previous) < Number.EPSILON * 10) {
      continue;
    }

    modifications += 1;
    if (
      (side === "long" && level > previous) ||
      (side === "short" && level < previous)
    ) {
      favorableMoves += 1;
    }
    previous = level;
  }

  return {
    modifications,
    favorableMoves,
    trail: normalizedTrail,
  };
}

export function buildTradeBrokerMeta(input: {
  tradeKey: string;
  tradeType: "long" | "short";
  dealRows: Array<{
    remoteDealId: string;
    remoteOrderId: string | null;
    positionId: string | null;
    entryType: string | null;
    eventTime: Date;
    rawPayload: unknown;
  }>;
  orderRows: Array<{
    remoteOrderId: string;
    positionId: string | null;
    state: string | null;
    orderType: string | null;
    sl: unknown;
    tp: unknown;
    rawPayload: unknown;
    eventTime: Date;
  }>;
}) {
  const sortedDeals = [...input.dealRows].sort(
    (left, right) =>
      getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
      left.remoteDealId.localeCompare(right.remoteDealId)
  );
  const sortedOrders = [...input.orderRows].sort(
    (left, right) =>
      getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
      left.remoteOrderId.localeCompare(right.remoteOrderId)
  );
  const entryRows = sortedDeals.filter(
    (row) => row.entryType === "in" || row.entryType === "inout"
  );
  const exitRows = sortedDeals.filter(
    (row) =>
      row.entryType === "out" ||
      row.entryType === "out_by" ||
      row.entryType === "inout"
  );
  const firstEntry = entryRows[0] ?? sortedDeals[0] ?? null;
  const lastExit =
    exitRows[exitRows.length - 1] ??
    sortedDeals[sortedDeals.length - 1] ??
    null;

  const entryReasonCode = firstEntry
    ? getRawPayloadNumber(firstEntry.rawPayload, "reason")
    : null;
  const lastOrder = sortedOrders[sortedOrders.length - 1] ?? null;
  const exitReasonCode =
    lastExit != null
      ? getRawPayloadNumber(lastExit.rawPayload, "reason")
      : lastOrder != null
        ? getRawPayloadNumber(lastOrder.rawPayload, "reason")
        : null;

  const entryReason = firstEntry
    ? normalizeMt5ReasonToken(
        getRawPayloadString(firstEntry.rawPayload, "reason") ?? entryReasonCode,
        "deal"
      )
    : null;
  const exitReason =
    lastExit != null
      ? normalizeMt5ReasonToken(
          getRawPayloadString(lastExit.rawPayload, "reason") ?? exitReasonCode,
          "deal"
        )
      : lastOrder != null
        ? normalizeMt5ReasonToken(
            getRawPayloadString(lastOrder.rawPayload, "reason") ?? exitReasonCode,
            "order"
          )
        : null;

  const protectionEvents = [
    ...sortedOrders.map((row) => ({
      eventTime: row.eventTime,
      rawPayload: row.rawPayload,
      sl: toNumber(row.sl),
      tp: toNumber(row.tp),
      key: `order:${row.remoteOrderId}`,
    })),
    ...sortedDeals.map((row) => ({
      eventTime: row.eventTime,
      rawPayload: row.rawPayload,
      sl: getRawPayloadNumber(row.rawPayload, "sl") ?? 0,
      tp: getRawPayloadNumber(row.rawPayload, "tp") ?? 0,
      key: `deal:${row.remoteDealId}`,
    })),
  ].sort(
    (left, right) =>
      getEventSortTimestamp(left) - getEventSortTimestamp(right) ||
      left.key.localeCompare(right.key)
  );

  const slTimeline = collectLevelTrail(
    input.tradeType,
    protectionEvents.map((row) => (row.sl === 0 ? null : row.sl))
  );
  const tpTimeline = collectLevelTrail(
    input.tradeType,
    protectionEvents.map((row) => (row.tp === 0 ? null : row.tp))
  );

  const magicNumber =
    getRawPayloadNumber(firstEntry?.rawPayload, "magic") ??
    getRawPayloadNumber(lastExit?.rawPayload, "magic") ??
    sortedOrders
      .map((row) => getRawPayloadNumber(row.rawPayload, "magic"))
      .find((value) => value != null) ??
    null;

  const entrySource = mapReasonToSource(entryReason);
  const exitSource = mapReasonToSource(exitReason);
  const executionMode = deriveExecutionMode(entrySource, magicNumber);
  const dealReasons = sortedDeals
    .map((row) =>
      normalizeMt5ReasonToken(
        getRawPayloadString(row.rawPayload, "reason") ??
          getRawPayloadNumber(row.rawPayload, "reason"),
        "deal"
      )
    )
    .filter((value): value is string => Boolean(value));
  const orderReasons = sortedOrders
    .map((row) =>
      normalizeMt5ReasonToken(
        getRawPayloadString(row.rawPayload, "reason"),
        "order"
      )
    )
    .filter((value): value is string => Boolean(value));

  return {
    slModCount: slTimeline.modifications,
    tpModCount: tpTimeline.modifications,
    trailingStopDetected:
      slTimeline.modifications >= 2 &&
      slTimeline.favorableMoves === slTimeline.modifications,
    brokerMeta: {
      platform: "mt5",
      tradeKey: input.tradeKey,
      positionId: firstEntry?.positionId ?? lastExit?.positionId ?? null,
      remoteOrderIds: [
        ...new Set(sortedDeals.map((row) => row.remoteOrderId).filter(Boolean)),
      ],
      remoteDealIds: sortedDeals.map((row) => row.remoteDealId),
      magicNumber,
      executionMode,
      entryReason,
      exitReason,
      entryReasonCode,
      exitReasonCode,
      entrySource,
      exitSource,
      closeReason: deriveCloseReason(exitReason, lastExit?.entryType ?? null),
      dealReasonTrail: dealReasons,
      orderReasonTrail: orderReasons,
      orderStateTrail: sortedOrders
        .map((row) => row.state)
        .filter((value): value is string => Boolean(value)),
      orderTypeTrail: sortedOrders
        .map((row) => row.orderType)
        .filter((value): value is string => Boolean(value)),
      slLevelTrail: slTimeline.trail,
      tpLevelTrail: tpTimeline.trail,
    } satisfies Record<string, unknown>,
  };
}

export function buildTradeLifecycleMetrics(input: {
  tradeKey: string;
  tradeType: "long" | "short";
  dealRows: Array<{
    remoteDealId: string;
    remoteOrderId: string | null;
    positionId: string | null;
    entryType: string | null;
    eventTime: Date;
    volume: unknown;
    rawPayload: unknown;
  }>;
  orderRows: Array<{
    remoteOrderId: string;
    positionId: string | null;
    state: string | null;
    orderType: string | null;
    sl: unknown;
    tp: unknown;
    rawPayload: unknown;
    eventTime: Date;
  }>;
}) {
  const entryRows = input.dealRows.filter(
    (row) => row.entryType === "in" || row.entryType === "inout"
  );
  const exitRows = input.dealRows.filter(
    (row) =>
      row.entryType === "out" ||
      row.entryType === "out_by" ||
      row.entryType === "inout"
  );
  const lifecycleSummary = summarizeDealLifecycle(
    input.dealRows.map((row) => ({
      remoteDealId: row.remoteDealId,
      entryType: row.entryType,
      volume: row.volume,
      eventTime: row.eventTime,
    }))
  );
  const tradeSignals = buildTradeBrokerMeta(input);

  return {
    entryDealCount: entryRows.length,
    exitDealCount: exitRows.length,
    entryVolume: lifecycleSummary.entryVolume,
    exitVolume: lifecycleSummary.exitVolume,
    scaleInCount: lifecycleSummary.scaleInCount,
    scaleOutCount: lifecycleSummary.scaleOutCount,
    partialCloseCount: lifecycleSummary.partialCloseCount,
    slModCount: tradeSignals.slModCount,
    tpModCount: tradeSignals.tpModCount,
    trailingStopDetected: tradeSignals.trailingStopDetected,
    brokerMeta: tradeSignals.brokerMeta,
  };
}

export function getExecutionContextFromBrokerMeta(
  brokerMeta: Record<string, unknown> | null | undefined
): Mt5ExecutionContext | null {
  if (!brokerMeta || typeof brokerMeta !== "object") {
    return null;
  }

  const candidate = brokerMeta.executionQuality;
  const parsed = mt5RawPayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }

  const tradeKey =
    typeof parsed.data.tradeKey === "string" ? parsed.data.tradeKey : null;
  const symbol = typeof parsed.data.symbol === "string" ? parsed.data.symbol : null;
  const side =
    parsed.data.side === "buy" || parsed.data.side === "sell"
      ? parsed.data.side
      : null;
  const lifecycleState =
    parsed.data.lifecycleState === "active" ||
    parsed.data.lifecycleState === "post_exit"
      ? parsed.data.lifecycleState
      : null;

  if (!tradeKey || !symbol || !side || !lifecycleState) {
    return null;
  }

  return {
    tradeKey,
    symbol,
    side,
    lifecycleState,
    positionId:
      typeof parsed.data.positionId === "string" ? parsed.data.positionId : null,
    entryExpectedPrice:
      typeof parsed.data.entryExpectedPrice === "number"
        ? parsed.data.entryExpectedPrice
        : null,
    entrySpreadPips:
      typeof parsed.data.entrySpreadPips === "number"
        ? parsed.data.entrySpreadPips
        : null,
    lastBid: typeof parsed.data.lastBid === "number" ? parsed.data.lastBid : null,
    lastAsk: typeof parsed.data.lastAsk === "number" ? parsed.data.lastAsk : null,
    lastQuoteTime:
      typeof parsed.data.lastQuoteTime === "string"
        ? parsed.data.lastQuoteTime
        : null,
    exitReferenceBid:
      typeof parsed.data.exitReferenceBid === "number"
        ? parsed.data.exitReferenceBid
        : null,
    exitReferenceAsk:
      typeof parsed.data.exitReferenceAsk === "number"
        ? parsed.data.exitReferenceAsk
        : null,
    exitReferenceTime:
      typeof parsed.data.exitReferenceTime === "string"
        ? parsed.data.exitReferenceTime
        : null,
    closeTime:
      typeof parsed.data.closeTime === "string" ? parsed.data.closeTime : null,
  };
}

export function mergeBrokerMetaExecutionContext(
  brokerMeta: Record<string, unknown> | null | undefined,
  executionContext: Mt5ExecutionContext | null | undefined
): Record<string, unknown> | null | undefined {
  if (!executionContext) {
    return brokerMeta;
  }

  return {
    ...(brokerMeta ?? {}),
    executionQuality: executionContext,
  };
}

export function calculateExecutionQualityMetrics(input: {
  tradeType: "long" | "short";
  symbol: string;
  openPrice: number;
  closePrice: number;
  executionContext: Mt5ExecutionContext | null | undefined;
  symbolSpecsBySymbol?: Map<string, Mt5SymbolSpec | MtSymbolSpecLike>;
}) {
  const executionContext = input.executionContext;
  if (!executionContext) {
    return null;
  }

  const pipSize = getPipSizeForSymbolFromMap(
    input.symbol,
    input.symbolSpecsBySymbol
  );
  if (pipSize <= 0) {
    return null;
  }

  const isLong = input.tradeType === "long";
  const entrySpreadPips = executionContext.entrySpreadPips ?? null;
  const exitSpreadPips =
    executionContext.exitReferenceBid != null &&
    executionContext.exitReferenceAsk != null
      ? (executionContext.exitReferenceAsk -
          executionContext.exitReferenceBid) /
        pipSize
      : executionContext.lastBid != null && executionContext.lastAsk != null
        ? (executionContext.lastAsk - executionContext.lastBid) / pipSize
        : null;
  const entrySlippagePips =
    executionContext.entryExpectedPrice != null
      ? isLong
        ? Math.abs(input.openPrice - executionContext.entryExpectedPrice) /
          pipSize
        : Math.abs(executionContext.entryExpectedPrice - input.openPrice) /
          pipSize
      : null;
  const exitSlippagePips =
    executionContext.exitReferenceBid != null ||
    executionContext.exitReferenceAsk != null
      ? isLong
        ? executionContext.exitReferenceBid != null
          ? Math.abs(input.closePrice - executionContext.exitReferenceBid) /
            pipSize
          : null
        : executionContext.exitReferenceAsk != null
          ? Math.abs(executionContext.exitReferenceAsk - input.closePrice) /
            pipSize
          : null
      : executionContext.lastBid != null || executionContext.lastAsk != null
        ? isLong
          ? executionContext.lastBid != null
            ? Math.abs(input.closePrice - executionContext.lastBid) / pipSize
            : null
          : executionContext.lastAsk != null
            ? Math.abs(executionContext.lastAsk - input.closePrice) / pipSize
            : null
        : null;

  return {
    entrySpreadPips,
    exitSpreadPips,
    entrySlippagePips,
    exitSlippagePips,
  };
}
