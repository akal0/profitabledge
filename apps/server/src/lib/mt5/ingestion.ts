import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import {
  equitySnapshot,
  platformConnection,
  syncLog,
} from "../../db/schema/connections";
import {
  brokerAccountSnapshot,
  brokerDealEvent,
  brokerLedgerEvent,
  brokerOrderEvent,
  brokerPositionSnapshot,
  brokerSession,
  brokerSymbolSpec,
  brokerSyncCheckpoint,
} from "../../db/schema/mt5-sync";
import { openTrade, trade, tradingAccount } from "../../db/schema/trading";
import { cache, cacheKeys } from "../cache";
import { cacheNamespaces, enhancedCache } from "../enhanced-cache";
import { notifyEarnedAchievements } from "../achievements";
import { generateFeedEventForTrade } from "../feed-event-generator";
import { insertHistoricalPriceSnapshots } from "../price-ingestion";
import { createNotification } from "../notifications";
import {
  enrichProjectedMt5Trades,
  refreshRecentMt5TradeAnalytics,
} from "./enrichment";
import { syncPropAccountState } from "../prop-rule-monitor";
import { ensurePropChallengeLineageForAccount } from "../prop-challenge-lineage";
import {
  canonicalizeBrokerSymbol,
  normalizeBrokerSymbol,
  resolveBrokerPipSize,
  type MtSymbolSpecLike,
} from "./symbol-specs";
import { buildAutoPropAccountFields } from "../prop-firm-detection";
import { deriveSessionTagAt } from "../session-tags";

const mt5RawPayloadSchema = z.record(z.string(), z.unknown());
const mt5DateTimeSchema = z.string().datetime({ offset: true });
const mt5ExecutionContextSchema = z.object({
  tradeKey: z.string().min(1),
  positionId: z.string().nullable().optional(),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  lifecycleState: z.enum(["active", "post_exit"]),
  entryExpectedPrice: z.number().nullable().optional(),
  entrySpreadPips: z.number().nullable().optional(),
  lastBid: z.number().nullable().optional(),
  lastAsk: z.number().nullable().optional(),
  lastQuoteTime: mt5DateTimeSchema.nullable().optional(),
  exitReferenceBid: z.number().nullable().optional(),
  exitReferenceAsk: z.number().nullable().optional(),
  exitReferenceTime: mt5DateTimeSchema.nullable().optional(),
  closeTime: mt5DateTimeSchema.nullable().optional(),
});
const mt5SymbolSpecSchema = z.object({
  symbol: z.string().min(1),
  canonicalSymbol: z.string().nullable().optional(),
  digits: z.number().int().nullable().optional(),
  pointSize: z.number().positive().nullable().optional(),
  tickSize: z.number().positive().nullable().optional(),
  contractSize: z.number().positive().nullable().optional(),
  pipSize: z.number().positive().nullable().optional(),
  spreadPoints: z.number().int().nullable().optional(),
  spreadFloat: z.boolean().nullable().optional(),
  currencyBase: z.string().nullable().optional(),
  currencyProfit: z.string().nullable().optional(),
  currencyMargin: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  snapshotTime: mt5DateTimeSchema,
  rawPayload: mt5RawPayloadSchema.optional(),
});

export const mt5SyncFrameSchema = z.object({
  connectionId: z.string().min(1),
  session: z
    .object({
      workerHostId: z.string().min(1).optional(),
      sessionKey: z.string().min(1).optional(),
      status: z.string().min(1).optional(),
      lastError: z.string().min(1).nullable().optional(),
      heartbeatAt: mt5DateTimeSchema.optional(),
      lastLoginAt: mt5DateTimeSchema.optional(),
      meta: mt5RawPayloadSchema.optional(),
    })
    .optional(),
  account: z.object({
    login: z.string().min(1),
    serverName: z.string().min(1),
    brokerName: z.string().min(1),
    currency: z.string().min(1),
    leverage: z.number().int().nullable().optional(),
    balance: z.number(),
    equity: z.number(),
    margin: z.number().nullable().optional(),
    freeMargin: z.number().nullable().optional(),
    marginLevel: z.number().nullable().optional(),
    snapshotTime: mt5DateTimeSchema,
    rawPayload: mt5RawPayloadSchema.optional(),
  }),
  positions: z
    .array(
      z.object({
        remotePositionId: z.string().min(1),
        side: z.enum(["buy", "sell"]),
        symbol: z.string().min(1),
        volume: z.number().positive(),
        openPrice: z.number(),
        currentPrice: z.number().nullable().optional(),
        profit: z.number().nullable().optional(),
        swap: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        magicNumber: z.number().int().nullable().optional(),
        openTime: mt5DateTimeSchema,
        snapshotTime: mt5DateTimeSchema.optional(),
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  deals: z
    .array(
      z.object({
        remoteDealId: z.string().min(1),
        remoteOrderId: z.string().nullable().optional(),
        positionId: z.string().nullable().optional(),
        entryType: z.enum(["in", "out", "inout", "out_by"]),
        side: z.enum(["buy", "sell"]),
        symbol: z.string().min(1),
        volume: z.number().nonnegative(),
        price: z.number(),
        profit: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
        swap: z.number().nullable().optional(),
        fee: z.number().nullable().optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        eventTime: mt5DateTimeSchema,
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  orders: z
    .array(
      z.object({
        eventKey: z.string().min(1),
        remoteOrderId: z.string().min(1),
        positionId: z.string().nullable().optional(),
        side: z.enum(["buy", "sell"]).nullable().optional(),
        orderType: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        symbol: z.string().nullable().optional(),
        requestedVolume: z.number().nullable().optional(),
        filledVolume: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        eventTime: mt5DateTimeSchema,
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  ledgerEvents: z
    .array(
      z.object({
        remoteDealId: z.string().min(1),
        remoteOrderId: z.string().nullable().optional(),
        positionId: z.string().nullable().optional(),
        ledgerType: z.string().min(1).nullable().optional(),
        amount: z.number(),
        commission: z.number().nullable().optional(),
        swap: z.number().nullable().optional(),
        fee: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        eventTime: mt5DateTimeSchema,
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  executionContexts: z.array(mt5ExecutionContextSchema).default([]),
  symbolSpecs: z.array(mt5SymbolSpecSchema).default([]),
  priceSnapshots: z
    .array(
      z.object({
        symbol: z.string().min(1),
        bid: z.number(),
        ask: z.number(),
        timestamp: mt5DateTimeSchema,
        bidVolume: z.number().nullable().optional(),
        askVolume: z.number().nullable().optional(),
      })
    )
    .default([]),
  checkpoint: z
    .object({
      lastDealTime: mt5DateTimeSchema.optional(),
      lastDealId: z.string().optional(),
      lastOrderTime: mt5DateTimeSchema.optional(),
      lastPositionPollAt: mt5DateTimeSchema.optional(),
      lastAccountPollAt: mt5DateTimeSchema.optional(),
      lastFullReconcileAt: mt5DateTimeSchema.optional(),
    })
    .optional(),
});

export type Mt5SyncFrameInput = z.infer<typeof mt5SyncFrameSchema>;
type Mt5SymbolSpec = z.infer<typeof mt5SymbolSpecSchema>;

interface Mt5ProjectionTrade {
  tradeKey: string;
  symbol: string;
  tradeType: "long" | "short";
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: Date;
  closeTime: Date;
  profit: number | null;
  commissions: number | null;
  swap: number | null;
  pips: number;
  sl: number | null;
  tp: number | null;
  entryDealCount: number;
  exitDealCount: number;
  entryVolume: number;
  exitVolume: number;
  scaleInCount: number;
  scaleOutCount: number;
  provisional: boolean;
}

type Mt5ExecutionContext = z.infer<typeof mt5ExecutionContextSchema>;

interface Mt5TradeStateFallback {
  tradeKey: string;
  symbol: string | null;
  tradeType: "long" | "short" | null;
  volume: number | null;
  openPrice: number | null;
  openTime: Date | null;
  sl: number | null;
  tp: number | null;
  profit: number | null;
  swap: number | null;
  commission: number | null;
}

interface RemovedOpenTradeSeed {
  ticket: string;
  symbol: string | null;
  tradeType: string | null;
  volume: string | null;
  openPrice: string | null;
  currentPrice: string | null;
  openTime: Date | null;
  sl: string | null;
  tp: string | null;
  profit: string | null;
  swap: string | null;
  commission: string | null;
  comment: string | null;
  magicNumber: number | null;
  brokerMeta: Record<string, unknown> | null;
}

interface OpenedPositionSeed {
  ticket: string;
  symbol: string;
  tradeType: "buy" | "sell";
  volume: number;
  openPrice: number;
  openTime: Date;
  sl: number | null;
  tp: number | null;
  comment: string | null;
  magicNumber: number | null;
}

interface ModifiedPositionSeed {
  ticket: string;
  newSl: number | null;
  newTp: number | null;
  comment: string | null;
  magicNumber: number | null;
}

function toDecimal(value: number | null | undefined): string | null {
  return value == null || Number.isNaN(value) ? null : value.toString();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isCopiedTradeComment(comment: string | null | undefined) {
  return typeof comment === "string" && comment.trim().startsWith("Copied:");
}

function buildSymbolSpecMap<T extends Mt5SymbolSpec | MtSymbolSpecLike>(
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

function getPipSizeForSymbolFromMap(
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

function normalizeTradeSide(side: "buy" | "sell"): "long" | "short" {
  return side === "buy" ? "long" : "short";
}

function calculatePips(
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

function weightedAveragePrice(
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

function getTradeKey(deal: {
  positionId: string | null;
  remoteOrderId: string | null;
  remoteDealId: string;
}): string {
  return deal.positionId || deal.remoteOrderId || deal.remoteDealId;
}

function getOrderTradeKey(order: {
  positionId: string | null;
  remoteOrderId: string;
}): string {
  return order.positionId || order.remoteOrderId;
}

function getBaseTradeKey(tradeKey: string): string {
  const delimiterIndex = tradeKey.indexOf("::");
  return delimiterIndex >= 0 ? tradeKey.slice(0, delimiterIndex) : tradeKey;
}

function parseDate(value: string): Date {
  return new Date(value);
}

function toPositiveNumberOrNull(value: unknown): number | null {
  const numeric = toNumber(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function pickLatestPositiveNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    const numeric = toPositiveNumberOrNull(value);
    if (numeric != null) {
      return numeric;
    }
  }

  return null;
}

function pickLatestNullableNumber(...values: Array<unknown>): number | null {
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

function summarizeDealLifecycle(
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

function buildTradeStateFallback(input: {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeMt5SyncFrame(rawInput: unknown): unknown {
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

function getRawPayloadRecord(
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

function getRawPayloadNumber(
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

function getEventSortTimestamp(row: { eventTime: Date; rawPayload?: unknown }) {
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

function getEventDate(row: { eventTime: Date; rawPayload?: unknown }) {
  return new Date(getEventSortTimestamp(row));
}

function getRawPayloadString(
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

function normalizeMt5ReasonToken(
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

function mapReasonToSource(reason: string | null): string | null {
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

function deriveExecutionMode(
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

function deriveCloseReason(
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

function collectLevelTrail(
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

function buildTradeBrokerMeta(input: {
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

function buildTradeLifecycleMetrics(input: {
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

function getExecutionContextFromBrokerMeta(
  brokerMeta: Record<string, unknown> | null | undefined
): Mt5ExecutionContext | null {
  if (!brokerMeta || typeof brokerMeta !== "object") {
    return null;
  }

  const candidate = brokerMeta.executionQuality;
  const parsed = mt5ExecutionContextSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mergeBrokerMetaExecutionContext(
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

function calculateExecutionQualityMetrics(input: {
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

async function ensureMt5TradingAccount(
  connectionId: string,
  account: Mt5SyncFrameInput["account"]
) {
  const connection = await db.query.platformConnection.findFirst({
    where: eq(platformConnection.id, connectionId),
  });

  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  const accountNumber = account.login.trim();
  const brokerServer = account.serverName.trim();
  const brokerName = account.brokerName.trim();
  const { updates: autoPropFields } = await buildAutoPropAccountFields({
    broker: brokerName,
    brokerServer,
    initialBalance: account.balance,
  });

  const existing =
    connection.accountId != null
      ? await db.query.tradingAccount.findFirst({
          where: eq(tradingAccount.id, connection.accountId),
        })
      : await db.query.tradingAccount.findFirst({
          where: and(
            eq(tradingAccount.userId, connection.userId),
            eq(tradingAccount.accountNumber, accountNumber),
            eq(tradingAccount.brokerServer, brokerServer)
          ),
        });

  const commonUpdates = {
    broker: brokerName,
    brokerType: "mt5",
    brokerServer,
    accountNumber,
    liveBalance: account.balance.toString(),
    liveEquity: account.equity.toString(),
    liveMargin: toDecimal(account.margin),
    liveFreeMargin: toDecimal(account.freeMargin),
    preferredDataSource: "broker",
    isVerified: 1,
    verificationLevel: "api_verified",
    initialCurrency: account.currency.toUpperCase().slice(0, 8),
    lastSyncedAt: parseDate(account.snapshotTime),
    ...autoPropFields,
  } as const;

  if (existing) {
    await db
      .update(tradingAccount)
      .set({
        ...commonUpdates,
        initialBalance:
          existing.initialBalance == null
            ? account.balance.toString()
            : existing.initialBalance,
      })
      .where(eq(tradingAccount.id, existing.id));

    if (connection.accountId !== existing.id) {
      await db
        .update(platformConnection)
        .set({ accountId: existing.id, updatedAt: new Date() })
        .where(eq(platformConnection.id, connectionId));
    }

    if (autoPropFields.isPropAccount) {
      await ensurePropChallengeLineageForAccount(existing.id);
    }

    return {
      connection,
      accountId: existing.id,
    };
  }

  const accountId = crypto.randomUUID();
  await db.insert(tradingAccount).values({
    id: accountId,
    userId: connection.userId,
    name: connection.displayName || `${brokerName} ${accountNumber}`,
    initialBalance: account.balance.toString(),
    ...commonUpdates,
  });

  if (autoPropFields.isPropAccount) {
    await ensurePropChallengeLineageForAccount(accountId);
  }

  await db
    .update(platformConnection)
    .set({ accountId, updatedAt: new Date() })
    .where(eq(platformConnection.id, connectionId));

  return {
    connection,
    accountId,
  };
}

async function upsertBrokerSession(
  connectionId: string,
  accountId: string,
  session: Mt5SyncFrameInput["session"] | undefined
) {
  if (!session) {
    return;
  }

  await db
    .insert(brokerSession)
    .values({
      connectionId,
      accountId,
      platform: "mt5",
      workerHostId: session.workerHostId ?? null,
      sessionKey: session.sessionKey ?? null,
      status: session.status ?? "syncing",
      heartbeatAt: session.heartbeatAt
        ? parseDate(session.heartbeatAt)
        : new Date(),
      lastLoginAt: session.lastLoginAt ? parseDate(session.lastLoginAt) : null,
      lastError: session.lastError ?? null,
      meta: session.meta ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: brokerSession.connectionId,
      set: {
        accountId,
        workerHostId: session.workerHostId ?? null,
        sessionKey: session.sessionKey ?? null,
        status: session.status ?? "syncing",
        heartbeatAt: session.heartbeatAt
          ? parseDate(session.heartbeatAt)
          : new Date(),
        lastLoginAt: session.lastLoginAt
          ? parseDate(session.lastLoginAt)
          : null,
        lastError: session.lastError ?? null,
        meta: session.meta ?? null,
        updatedAt: new Date(),
      },
    });
}

async function projectAccountSnapshot(
  connectionId: string,
  accountId: string,
  account: Mt5SyncFrameInput["account"]
) {
  const snapshotTime = parseDate(account.snapshotTime);

  await db.insert(brokerAccountSnapshot).values({
    connectionId,
    accountId,
    platform: "mt5",
    login: account.login,
    serverName: account.serverName,
    brokerName: account.brokerName,
    currency: account.currency.toUpperCase().slice(0, 16),
    leverage: account.leverage ?? null,
    balance: account.balance.toString(),
    equity: account.equity.toString(),
    margin: toDecimal(account.margin),
    freeMargin: toDecimal(account.freeMargin),
    marginLevel: toDecimal(account.marginLevel),
    snapshotTime,
    rawPayload: account.rawPayload ?? null,
  });

  const dateKey = snapshotTime.toISOString().split("T")[0];

  await db
    .insert(equitySnapshot)
    .values({
      accountId,
      snapshotDate: dateKey,
      balance: account.balance.toString(),
      equity: account.equity.toString(),
      source: "api",
      updatedAt: snapshotTime,
    })
    .onConflictDoUpdate({
      target: [equitySnapshot.accountId, equitySnapshot.snapshotDate],
      set: {
        balance: account.balance.toString(),
        equity: account.equity.toString(),
        source: "api",
        updatedAt: snapshotTime,
      },
    });
}

async function projectPriceSnapshots(
  userId: string,
  accountId: string,
  priceSnapshots: Mt5SyncFrameInput["priceSnapshots"]
) {
  if (priceSnapshots.length === 0) {
    return {
      priceSnapshotsInserted: 0,
    };
  }

  try {
    const result = await insertHistoricalPriceSnapshots({
      userId,
      accountId,
      snapshots: priceSnapshots,
    });

    return {
      priceSnapshotsInserted: result.inserted,
    };
  } catch (error) {
    console.error(
      `[mt5] price snapshot persistence failed for account ${accountId}`,
      error
    );
    return {
      priceSnapshotsInserted: 0,
    };
  }
}

async function projectSymbolSpecs(
  connectionId: string,
  accountId: string,
  symbolSpecs: Mt5SyncFrameInput["symbolSpecs"]
) {
  if (symbolSpecs.length === 0) {
    return {
      symbolSpecsInserted: 0,
      symbolSpecsBySymbol: new Map<string, Mt5SymbolSpec>(),
    };
  }

  const deduped = new Map<string, Mt5SymbolSpec>();
  for (const symbolSpec of symbolSpecs) {
    const normalized = normalizeBrokerSymbol(symbolSpec.symbol);
    const existing = deduped.get(normalized);
    if (!existing || existing.snapshotTime <= symbolSpec.snapshotTime) {
      deduped.set(normalized, {
        ...symbolSpec,
        symbol: normalized,
        canonicalSymbol: symbolSpec.canonicalSymbol
          ? normalizeBrokerSymbol(symbolSpec.canonicalSymbol)
          : canonicalizeBrokerSymbol(symbolSpec.symbol),
      });
    }
  }

  const values = [...deduped.values()].map((symbolSpec) => ({
    connectionId,
    accountId,
    platform: "mt5" as const,
    symbol: normalizeBrokerSymbol(symbolSpec.symbol),
    canonicalSymbol: symbolSpec.canonicalSymbol
      ? normalizeBrokerSymbol(symbolSpec.canonicalSymbol)
      : canonicalizeBrokerSymbol(symbolSpec.symbol),
    digits: symbolSpec.digits ?? null,
    pointSize: toDecimal(symbolSpec.pointSize),
    tickSize: toDecimal(symbolSpec.tickSize),
    contractSize: toDecimal(symbolSpec.contractSize),
    pipSize: toDecimal(
      resolveBrokerPipSize(symbolSpec.symbol, symbolSpec as MtSymbolSpecLike)
    ),
    spreadPoints: symbolSpec.spreadPoints ?? null,
    spreadFloat: symbolSpec.spreadFloat ?? null,
    currencyBase: symbolSpec.currencyBase ?? null,
    currencyProfit: symbolSpec.currencyProfit ?? null,
    currencyMargin: symbolSpec.currencyMargin ?? null,
    path: symbolSpec.path ?? null,
    snapshotTime: parseDate(symbolSpec.snapshotTime),
    rawPayload: symbolSpec.rawPayload ?? null,
    ingestedAt: new Date(),
  }));

  for (const value of values) {
    await db
      .insert(brokerSymbolSpec)
      .values({
        id: crypto.randomUUID(),
        ...value,
      })
      .onConflictDoUpdate({
        target: [
          brokerSymbolSpec.platform,
          brokerSymbolSpec.accountId,
          brokerSymbolSpec.symbol,
        ],
        set: {
          connectionId: value.connectionId,
          canonicalSymbol: value.canonicalSymbol,
          digits: value.digits,
          pointSize: value.pointSize,
          tickSize: value.tickSize,
          contractSize: value.contractSize,
          pipSize: value.pipSize,
          spreadPoints: value.spreadPoints,
          spreadFloat: value.spreadFloat,
          currencyBase: value.currencyBase,
          currencyProfit: value.currencyProfit,
          currencyMargin: value.currencyMargin,
          path: value.path,
          snapshotTime: value.snapshotTime,
          rawPayload: value.rawPayload,
          ingestedAt: value.ingestedAt,
        },
      });
  }

  return {
    symbolSpecsInserted: values.length,
    symbolSpecsBySymbol: buildSymbolSpecMap([...deduped.values()]),
  };
}

async function projectOpenPositions(
  connectionId: string,
  accountId: string,
  positions: Mt5SyncFrameInput["positions"],
  snapshotTime: Date,
  executionContextsByTradeKey: Map<string, Mt5ExecutionContext>
) {
  const existingOpenTrades = await db.query.openTrade.findMany({
    where: eq(openTrade.accountId, accountId),
  });
  const existingTickets = new Set(
    existingOpenTrades.map((openPosition) => openPosition.ticket)
  );
  const existingOpenTradeByTicket = new Map(
    existingOpenTrades.map((openPosition) => [
      openPosition.ticket,
      openPosition,
    ])
  );
  const openedPositions: OpenedPositionSeed[] = [];
  const modifiedPositions: ModifiedPositionSeed[] = [];

  if (positions.length > 0) {
    const positionIds = positions.map((position) => position.remotePositionId);
    const dealRows = await db.query.brokerDealEvent.findMany({
      where: and(
        eq(brokerDealEvent.accountId, accountId),
        inArray(brokerDealEvent.positionId, positionIds)
      ),
    });
    const remoteOrderIds = [
      ...new Set(
        dealRows
          .map((row) => row.remoteOrderId)
          .filter((value): value is string => Boolean(value))
      ),
    ];
    const orderRows = await db.query.brokerOrderEvent.findMany({
      where: and(
        eq(brokerOrderEvent.accountId, accountId),
        remoteOrderIds.length > 0
          ? or(
              inArray(brokerOrderEvent.positionId, positionIds),
              inArray(brokerOrderEvent.remoteOrderId, remoteOrderIds)
            )
          : inArray(brokerOrderEvent.positionId, positionIds)
      ),
    });
    const dealRowsByPosition = new Map<string, typeof dealRows>();
    for (const row of dealRows) {
      if (!row.positionId) {
        continue;
      }

      const bucket = dealRowsByPosition.get(row.positionId) ?? [];
      bucket.push(row);
      dealRowsByPosition.set(row.positionId, bucket);
    }
    const orderRowsByPosition = new Map<string, typeof orderRows>();
    for (const row of orderRows) {
      if (!row.positionId) {
        continue;
      }

      const bucket = orderRowsByPosition.get(row.positionId) ?? [];
      bucket.push(row);
      orderRowsByPosition.set(row.positionId, bucket);
    }

    await db.insert(brokerPositionSnapshot).values(
      positions.map((position) => ({
        connectionId,
        accountId,
        platform: "mt5",
        remotePositionId: position.remotePositionId,
        side: position.side,
        symbol: position.symbol.toUpperCase(),
        volume: position.volume.toString(),
        openPrice: position.openPrice.toString(),
        currentPrice: toDecimal(position.currentPrice),
        profit: toDecimal(position.profit),
        swap: toDecimal(position.swap),
        commission: toDecimal(position.commission),
        sl: toDecimal(position.sl),
        tp: toDecimal(position.tp),
        comment: position.comment ?? null,
        magicNumber: position.magicNumber ?? null,
        snapshotTime: position.snapshotTime
          ? parseDate(position.snapshotTime)
          : snapshotTime,
        rawPayload: position.rawPayload ?? null,
      }))
    );

    const tickets = positions.map((position) => position.remotePositionId);
    const activeTicketSet = new Set(tickets);
    const removedTradeKeys = [...existingTickets].filter(
      (ticket) => !activeTicketSet.has(ticket)
    );
    const removedOpenTrades = removedTradeKeys
      .map((ticket) => existingOpenTradeByTicket.get(ticket))
      .filter((row): row is NonNullable<(typeof existingOpenTrades)[number]> =>
        Boolean(row)
      );

    for (const position of positions) {
      const tradeKey = position.remotePositionId;
      const existingOpenTrade = existingOpenTradeByTicket.get(tradeKey) ?? null;
      const nextSl = toDecimal(position.sl);
      const nextTp = toDecimal(position.tp);

      if (!existingOpenTrade) {
        openedPositions.push({
          ticket: tradeKey,
          symbol: position.symbol.toUpperCase(),
          tradeType: position.side,
          volume: position.volume,
          openPrice: position.openPrice,
          openTime: parseDate(position.openTime),
          sl: position.sl ?? null,
          tp: position.tp ?? null,
          comment: position.comment ?? null,
          magicNumber: position.magicNumber ?? null,
        });
      } else if (
        existingOpenTrade.sl !== nextSl ||
        existingOpenTrade.tp !== nextTp
      ) {
        modifiedPositions.push({
          ticket: tradeKey,
          newSl: position.sl ?? null,
          newTp: position.tp ?? null,
          comment: position.comment ?? null,
          magicNumber: position.magicNumber ?? null,
        });
      }

      const executionContext =
        executionContextsByTradeKey.get(tradeKey) ?? null;
      const tradeMetrics = buildTradeLifecycleMetrics({
        tradeKey,
        tradeType: normalizeTradeSide(position.side),
        dealRows: (dealRowsByPosition.get(position.remotePositionId) ?? []).map(
          (row) => ({
            remoteDealId: row.remoteDealId,
            remoteOrderId: row.remoteOrderId ?? null,
            positionId: row.positionId ?? null,
            entryType: row.entryType ?? null,
            eventTime: row.eventTime,
            volume: row.volume,
            rawPayload: row.rawPayload ?? null,
          })
        ),
        orderRows: (
          orderRowsByPosition.get(position.remotePositionId) ?? []
        ).map((row) => ({
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
      const { sessionTag, sessionTagColor } = deriveSessionTagAt(
        parseDate(position.openTime)
      );
      const record = {
        id: crypto.randomUUID(),
        accountId,
        ticket: tradeKey,
        symbol: position.symbol.toUpperCase(),
        tradeType: normalizeTradeSide(position.side),
        volume: position.volume.toString(),
        openPrice: position.openPrice.toString(),
        openTime: parseDate(position.openTime),
        sl: nextSl,
        tp: nextTp,
        currentPrice: toDecimal(position.currentPrice),
        swap: toDecimal(position.swap) ?? "0",
        commission: toDecimal(position.commission) ?? "0",
        profit: toDecimal(position.profit) ?? "0",
        sessionTag: sessionTag ?? undefined,
        sessionTagColor,
        slModCount: tradeMetrics.slModCount,
        tpModCount: tradeMetrics.tpModCount,
        partialCloseCount: tradeMetrics.partialCloseCount,
        entryDealCount: tradeMetrics.entryDealCount,
        exitDealCount: tradeMetrics.exitDealCount,
        entryVolume: tradeMetrics.entryVolume.toString(),
        exitVolume: tradeMetrics.exitVolume.toString(),
        scaleInCount: tradeMetrics.scaleInCount,
        scaleOutCount: tradeMetrics.scaleOutCount,
        trailingStopDetected: tradeMetrics.trailingStopDetected,
        comment: position.comment ?? null,
        magicNumber: position.magicNumber ?? null,
        brokerMeta:
          position.rawPayload && typeof position.rawPayload === "object"
            ? mergeBrokerMetaExecutionContext(
                {
                  ...(tradeMetrics.brokerMeta ?? {}),
                  platform: "mt5",
                  positionId: position.remotePositionId,
                  magicNumber: position.magicNumber ?? null,
                  sessionTag,
                  sessionTagColor,
                  raw: position.rawPayload,
                },
                executionContext
              )
            : mergeBrokerMetaExecutionContext(
                tradeMetrics.brokerMeta as Record<string, unknown> | null,
                executionContext
              ),
        lastUpdatedAt: position.snapshotTime
          ? parseDate(position.snapshotTime)
          : snapshotTime,
        createdAt: new Date(),
      };

      await db
        .insert(openTrade)
        .values(record)
        .onConflictDoUpdate({
          target: [openTrade.accountId, openTrade.ticket],
          set: {
            symbol: record.symbol,
            tradeType: record.tradeType,
            volume: record.volume,
            openPrice: record.openPrice,
            openTime: record.openTime,
            sl: record.sl,
            tp: record.tp,
            currentPrice: record.currentPrice,
            swap: record.swap,
            commission: record.commission,
            profit: record.profit,
            sessionTag: record.sessionTag,
            sessionTagColor: record.sessionTagColor,
            slModCount: record.slModCount,
            tpModCount: record.tpModCount,
            partialCloseCount: record.partialCloseCount,
            entryDealCount: record.entryDealCount,
            exitDealCount: record.exitDealCount,
            entryVolume: record.entryVolume,
            exitVolume: record.exitVolume,
            scaleInCount: record.scaleInCount,
            scaleOutCount: record.scaleOutCount,
            trailingStopDetected: record.trailingStopDetected,
            comment: record.comment,
            magicNumber: record.magicNumber,
            brokerMeta: record.brokerMeta,
            lastUpdatedAt: record.lastUpdatedAt,
          },
        });
    }

    await db
      .delete(openTrade)
      .where(
        and(
          eq(openTrade.accountId, accountId),
          notInArray(openTrade.ticket, tickets)
        )
      );

    return {
      openPositionsUpserted: positions.length,
      openedPositions,
      modifiedPositions,
      removedTradeKeys,
      removedOpenTrades,
    };
  }

  const removedOpenTrades = existingOpenTrades;
  await db.delete(openTrade).where(eq(openTrade.accountId, accountId));
  return {
    openPositionsUpserted: 0,
    openedPositions,
    modifiedPositions,
    removedTradeKeys: [...existingTickets],
    removedOpenTrades,
  };
}

async function insertDealEvents(
  connectionId: string,
  accountId: string,
  deals: Mt5SyncFrameInput["deals"],
  reconcileMode: "incremental" | "full-reconcile" = "incremental"
) {
  let inserted = 0;
  const affectedTradeKeys = new Set<string>();
  const shouldRefreshExisting = reconcileMode === "full-reconcile";

  for (const deal of deals) {
    const values = {
      connectionId,
      accountId,
      platform: "mt5",
      remoteDealId: deal.remoteDealId,
      remoteOrderId: deal.remoteOrderId ?? null,
      positionId: deal.positionId ?? null,
      entryType: deal.entryType,
      side: deal.side,
      symbol: deal.symbol.toUpperCase(),
      volume: deal.volume.toString(),
      price: deal.price.toString(),
      profit: toDecimal(deal.profit),
      commission: toDecimal(deal.commission),
      swap: toDecimal(deal.swap),
      fee: toDecimal(deal.fee),
      sl: toDecimal(deal.sl),
      tp: toDecimal(deal.tp),
      comment: deal.comment ?? null,
      rawPayload: deal.rawPayload ?? null,
      eventTime: parseDate(deal.eventTime),
    };

    const query = db.insert(brokerDealEvent).values(values);
    const result = shouldRefreshExisting
      ? await query
          .onConflictDoUpdate({
            target: [
              brokerDealEvent.platform,
              brokerDealEvent.accountId,
              brokerDealEvent.remoteDealId,
            ],
            set: {
              remoteOrderId: values.remoteOrderId,
              positionId: values.positionId,
              entryType: values.entryType,
              side: values.side,
              symbol: values.symbol,
              volume: values.volume,
              price: values.price,
              profit: values.profit,
              commission: values.commission,
              swap: values.swap,
              fee: values.fee,
              sl: values.sl,
              tp: values.tp,
              comment: values.comment,
              rawPayload: values.rawPayload,
              eventTime: values.eventTime,
            },
          })
          .returning({ id: brokerDealEvent.id })
      : await query.onConflictDoNothing().returning({ id: brokerDealEvent.id });

    if (result.length > 0) {
      inserted += 1;
      affectedTradeKeys.add(
        getTradeKey({
          positionId: deal.positionId ?? null,
          remoteOrderId: deal.remoteOrderId ?? null,
          remoteDealId: deal.remoteDealId,
        })
      );
    }
  }

  return {
    dealEventsInserted: inserted,
    affectedTradeKeys: [...affectedTradeKeys],
  };
}

async function insertOrderEvents(
  connectionId: string,
  accountId: string,
  orders: Mt5SyncFrameInput["orders"],
  reconcileMode: "incremental" | "full-reconcile" = "incremental"
) {
  let inserted = 0;
  const affectedTradeKeys = new Set<string>();
  const shouldRefreshExisting = reconcileMode === "full-reconcile";

  for (const order of orders) {
    const values = {
      connectionId,
      accountId,
      platform: "mt5",
      eventKey: order.eventKey,
      remoteOrderId: order.remoteOrderId,
      positionId: order.positionId ?? null,
      side: order.side ?? null,
      orderType: order.orderType ?? null,
      state: order.state ?? null,
      symbol: order.symbol?.toUpperCase() ?? null,
      requestedVolume: toDecimal(order.requestedVolume),
      filledVolume: toDecimal(order.filledVolume),
      price: toDecimal(order.price),
      sl: toDecimal(order.sl),
      tp: toDecimal(order.tp),
      comment: order.comment ?? null,
      rawPayload: order.rawPayload ?? null,
      eventTime: parseDate(order.eventTime),
    };

    const query = db.insert(brokerOrderEvent).values(values);
    const result = shouldRefreshExisting
      ? await query
          .onConflictDoUpdate({
            target: [
              brokerOrderEvent.platform,
              brokerOrderEvent.accountId,
              brokerOrderEvent.eventKey,
            ],
            set: {
              remoteOrderId: values.remoteOrderId,
              positionId: values.positionId,
              side: values.side,
              orderType: values.orderType,
              state: values.state,
              symbol: values.symbol,
              requestedVolume: values.requestedVolume,
              filledVolume: values.filledVolume,
              price: values.price,
              sl: values.sl,
              tp: values.tp,
              comment: values.comment,
              rawPayload: values.rawPayload,
              eventTime: values.eventTime,
            },
          })
          .returning({ id: brokerOrderEvent.id })
      : await query
          .onConflictDoNothing()
          .returning({ id: brokerOrderEvent.id });

    if (result.length > 0) {
      inserted += 1;
      affectedTradeKeys.add(
        getOrderTradeKey({
          positionId: order.positionId ?? null,
          remoteOrderId: order.remoteOrderId,
        })
      );
    }
  }

  return {
    orderEventsInserted: inserted,
    affectedTradeKeys: [...affectedTradeKeys],
  };
}

async function insertLedgerEvents(
  connectionId: string,
  accountId: string,
  ledgerEvents: Mt5SyncFrameInput["ledgerEvents"],
  reconcileMode: "incremental" | "full-reconcile" = "incremental"
) {
  let inserted = 0;
  const shouldRefreshExisting = reconcileMode === "full-reconcile";

  for (const event of ledgerEvents) {
    const values = {
      connectionId,
      accountId,
      platform: "mt5",
      remoteDealId: event.remoteDealId,
      remoteOrderId: event.remoteOrderId ?? null,
      positionId: event.positionId ?? null,
      ledgerType: event.ledgerType ?? null,
      amount: event.amount.toString(),
      commission: toDecimal(event.commission),
      swap: toDecimal(event.swap),
      fee: toDecimal(event.fee),
      comment: event.comment ?? null,
      rawPayload: event.rawPayload ?? null,
      eventTime: parseDate(event.eventTime),
    };

    const query = db.insert(brokerLedgerEvent).values(values);
    const result = shouldRefreshExisting
      ? await query
          .onConflictDoUpdate({
            target: [
              brokerLedgerEvent.platform,
              brokerLedgerEvent.accountId,
              brokerLedgerEvent.remoteDealId,
            ],
            set: {
              remoteOrderId: values.remoteOrderId,
              positionId: values.positionId,
              ledgerType: values.ledgerType,
              amount: values.amount,
              commission: values.commission,
              swap: values.swap,
              fee: values.fee,
              comment: values.comment,
              rawPayload: values.rawPayload,
              eventTime: values.eventTime,
            },
          })
          .returning({ id: brokerLedgerEvent.id })
      : await query
          .onConflictDoNothing()
          .returning({ id: brokerLedgerEvent.id });

    if (result.length > 0) {
      inserted += 1;
    }
  }

  return {
    ledgerEventsInserted: inserted,
  };
}

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

async function projectClosedTrades(
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
  const baseTradeKeys = [...new Set([...tradeKeySet].map(getBaseTradeKey))];
  const latestPositionSnapshots = baseTradeKeys.length
    ? await db.query.brokerPositionSnapshot.findMany({
        where: and(
          eq(brokerPositionSnapshot.accountId, accountId),
          inArray(brokerPositionSnapshot.remotePositionId, baseTradeKeys)
        ),
      })
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

async function collectAllMt5TradeKeysForAccount(input: {
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

async function updateCheckpoint(
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

async function emitMt5ClosedTradeSideEffects(input: {
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

async function emitMt5CopierPositionSideEffects(input: {
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

export async function ingestMt5SyncFrame(rawInput: Mt5SyncFrameInput) {
  const startedAt = Date.now();
  const input = mt5SyncFrameSchema.parse(sanitizeMt5SyncFrame(rawInput));
  const reconcileMode =
    input.session?.meta?.historyMode === "full-reconcile"
      ? "full-reconcile"
      : "incremental";
  const snapshotTime = parseDate(input.account.snapshotTime);
  const { connection, accountId } = await ensureMt5TradingAccount(
    input.connectionId,
    input.account
  );

  await upsertBrokerSession(input.connectionId, accountId, input.session);
  await projectAccountSnapshot(input.connectionId, accountId, input.account);
  const { symbolSpecsInserted, symbolSpecsBySymbol } = await projectSymbolSpecs(
    input.connectionId,
    accountId,
    input.symbolSpecs
  );
  const executionContextsByTradeKey = new Map(
    input.executionContexts.map((executionContext) => [
      executionContext.tradeKey,
      executionContext,
    ])
  );

  const { dealEventsInserted, affectedTradeKeys } = await insertDealEvents(
    input.connectionId,
    accountId,
    input.deals,
    reconcileMode
  );
  const { orderEventsInserted, affectedTradeKeys: affectedOrderTradeKeys } =
    await insertOrderEvents(
      input.connectionId,
      accountId,
      input.orders,
      reconcileMode
    );
  const { ledgerEventsInserted } = await insertLedgerEvents(
    input.connectionId,
    accountId,
    input.ledgerEvents,
    reconcileMode
  );
  const { priceSnapshotsInserted } = await projectPriceSnapshots(
    connection.userId,
    accountId,
    input.priceSnapshots
  );
  const {
    openPositionsUpserted,
    openedPositions,
    modifiedPositions,
    removedTradeKeys,
    removedOpenTrades,
  } = await projectOpenPositions(
    input.connectionId,
    accountId,
    input.positions,
    snapshotTime,
    executionContextsByTradeKey
  );
  const removedOpenTradesByKey = new Map<string, RemovedOpenTradeSeed>(
    removedOpenTrades.map((openTradeRow) => [
      openTradeRow.ticket,
      {
        ticket: openTradeRow.ticket,
        symbol: openTradeRow.symbol,
        tradeType: openTradeRow.tradeType,
        volume: openTradeRow.volume,
        openPrice: openTradeRow.openPrice,
        currentPrice: openTradeRow.currentPrice,
        openTime: openTradeRow.openTime,
        sl: openTradeRow.sl,
        tp: openTradeRow.tp,
        profit: openTradeRow.profit,
        swap: openTradeRow.swap,
        commission: openTradeRow.commission,
        comment: openTradeRow.comment,
        magicNumber: openTradeRow.magicNumber,
        brokerMeta:
          openTradeRow.brokerMeta && typeof openTradeRow.brokerMeta === "object"
            ? (openTradeRow.brokerMeta as Record<string, unknown>)
            : null,
      },
    ])
  );
  await emitMt5CopierPositionSideEffects({
    accountId,
    account: input.account,
    openedPositions,
    modifiedPositions,
    removedOpenTrades: [...removedOpenTradesByKey.values()],
  });
  const tradeKeysToProject = [
    ...new Set([
      ...affectedTradeKeys,
      ...affectedOrderTradeKeys,
      ...removedTradeKeys,
    ]),
  ];
  const fullReconcileTradeKeys =
    reconcileMode === "full-reconcile"
      ? await collectAllMt5TradeKeysForAccount({
          accountId,
          connectionId: input.connectionId,
        })
      : [];
  const projectionTradeKeys = [
    ...new Set([...tradeKeysToProject, ...fullReconcileTradeKeys]),
  ];
  const { tradesProjected, tradeIds, createdTradeIds } =
    await projectClosedTrades(accountId, projectionTradeKeys, {
      removedOpenTradesByKey,
      executionContextsByTradeKey,
      symbolSpecsBySymbol,
    });
  const { tradesEnriched } = await enrichProjectedMt5Trades({
    accountId,
    tradeIds,
  });
  const { tradesRefreshed } = await refreshRecentMt5TradeAnalytics({
    accountId,
    asOf: snapshotTime,
  });

  await updateCheckpoint(input.connectionId, accountId, input);

  const currentMeta =
    connection.meta && typeof connection.meta === "object"
      ? (connection.meta as Record<string, unknown>)
      : {};

  await db
    .update(platformConnection)
    .set({
      accountId,
      status: input.session?.lastError ? "error" : "active",
      lastError: input.session?.lastError ?? null,
      lastSyncAttemptAt: new Date(),
      lastSyncSuccessAt: new Date(),
      lastSyncedTradeCount: tradesProjected,
      meta: {
        ...currentMeta,
        mt5: {
          login: input.account.login,
          serverName: input.account.serverName,
          brokerName: input.account.brokerName,
          workerHostId: input.session?.workerHostId ?? null,
          sessionKey: input.session?.sessionKey ?? null,
          lastSnapshotAt: input.account.snapshotTime,
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(platformConnection.id, input.connectionId));

  await db.insert(syncLog).values({
    connectionId: input.connectionId,
    accountId,
    status: input.session?.lastError ? "error" : "success",
    tradesFound: input.deals.length,
    tradesInserted: tradesProjected,
    tradesDuplicated: Math.max(0, input.deals.length - dealEventsInserted),
    errorMessage: input.session?.lastError ?? null,
    durationMs: Date.now() - startedAt,
  });

  cache.invalidate(cacheKeys.liveMetrics(accountId));
  await enhancedCache.invalidateByTags([
    cacheNamespaces.TRADES,
    `account:${accountId}`,
  ]);
  await syncPropAccountState(accountId, { saveAlerts: true });

  const result = {
    connectionId: input.connectionId,
    accountId,
    dealEventsInserted,
    orderEventsInserted,
    ledgerEventsInserted,
    symbolSpecsInserted,
    priceSnapshotsInserted,
    openPositionsUpserted,
    tradesProjected,
    tradesEnriched,
    tradesRefreshed,
  };

  await emitMt5ClosedTradeSideEffects({
    userId: connection.userId,
    accountId,
    connectionDisplayName: connection.displayName,
    tradeIds: createdTradeIds,
  });

  return result;
}

export async function backfillMt5ProjectedTrades(input?: {
  accountId?: string;
  connectionId?: string;
  emitSideEffects?: boolean;
}) {
  const dealFilters: Array<ReturnType<typeof eq>> = [];
  const orderFilters: Array<ReturnType<typeof eq>> = [];
  if (input?.accountId) {
    dealFilters.push(eq(brokerDealEvent.accountId, input.accountId));
    orderFilters.push(eq(brokerOrderEvent.accountId, input.accountId));
  }
  if (input?.connectionId) {
    dealFilters.push(eq(brokerDealEvent.connectionId, input.connectionId));
    orderFilters.push(eq(brokerOrderEvent.connectionId, input.connectionId));
  }

  const dealQuery = db
    .select({
      accountId: brokerDealEvent.accountId,
      connectionId: brokerDealEvent.connectionId,
      remoteDealId: brokerDealEvent.remoteDealId,
      remoteOrderId: brokerDealEvent.remoteOrderId,
      positionId: brokerDealEvent.positionId,
    })
    .from(brokerDealEvent);

  const dealRows =
    dealFilters.length > 0
      ? await dealQuery.where(and(...dealFilters))
      : await dealQuery;
  const orderQuery = db
    .select({
      accountId: brokerOrderEvent.accountId,
      connectionId: brokerOrderEvent.connectionId,
      remoteOrderId: brokerOrderEvent.remoteOrderId,
      positionId: brokerOrderEvent.positionId,
    })
    .from(brokerOrderEvent);
  const orderRows =
    orderFilters.length > 0
      ? await orderQuery.where(and(...orderFilters))
      : await orderQuery;

  const buckets = new Map<
    string,
    { connectionId: string | null; tradeKeys: Set<string> }
  >();

  for (const row of dealRows) {
    const tradeKey = getTradeKey({
      positionId: row.positionId ?? null,
      remoteOrderId: row.remoteOrderId ?? null,
      remoteDealId: row.remoteDealId,
    });
    const bucket = buckets.get(row.accountId) ?? {
      connectionId: row.connectionId,
      tradeKeys: new Set<string>(),
    };
    bucket.tradeKeys.add(tradeKey);
    if (!bucket.connectionId) {
      bucket.connectionId = row.connectionId;
    }
    buckets.set(row.accountId, bucket);
  }

  for (const row of orderRows) {
    const tradeKey = getOrderTradeKey({
      positionId: row.positionId ?? null,
      remoteOrderId: row.remoteOrderId,
    });
    const bucket = buckets.get(row.accountId) ?? {
      connectionId: row.connectionId,
      tradeKeys: new Set<string>(),
    };
    bucket.tradeKeys.add(tradeKey);
    if (!bucket.connectionId) {
      bucket.connectionId = row.connectionId;
    }
    buckets.set(row.accountId, bucket);
  }

  let accountsProcessed = 0;
  let tradesProjected = 0;
  let tradesEnriched = 0;
  let notificationsEmitted = 0;
  const accountResults: Array<{
    accountId: string;
    connectionId: string | null;
    tradeKeys: number;
    tradesProjected: number;
    tradesEnriched: number;
    createdTradeIds: string[];
  }> = [];

  for (const [accountId, bucket] of buckets.entries()) {
    const {
      tradesProjected: projectedCount,
      tradeIds,
      createdTradeIds,
    } = await projectClosedTrades(accountId, [...bucket.tradeKeys]);
    const { tradesEnriched: enrichedCount } = await enrichProjectedMt5Trades({
      accountId,
      tradeIds,
    });

    if (
      input?.emitSideEffects &&
      createdTradeIds.length > 0 &&
      bucket.connectionId
    ) {
      const connection = await db.query.platformConnection.findFirst({
        where: eq(platformConnection.id, bucket.connectionId),
        columns: {
          userId: true,
          displayName: true,
        },
      });

      if (connection) {
        await emitMt5ClosedTradeSideEffects({
          userId: connection.userId,
          accountId,
          connectionDisplayName: connection.displayName,
          tradeIds: createdTradeIds,
        });
        notificationsEmitted += createdTradeIds.length;
      }
    }

    cache.invalidate(cacheKeys.liveMetrics(accountId));
    await enhancedCache.invalidateByTags([
      cacheNamespaces.TRADES,
      `account:${accountId}`,
    ]);

    accountsProcessed += 1;
    tradesProjected += projectedCount;
    tradesEnriched += enrichedCount;
    accountResults.push({
      accountId,
      connectionId: bucket.connectionId,
      tradeKeys: bucket.tradeKeys.size,
      tradesProjected: projectedCount,
      tradesEnriched: enrichedCount,
      createdTradeIds,
    });
  }

  return {
    accountsProcessed,
    tradesProjected,
    tradesEnriched,
    notificationsEmitted,
    accountResults,
  };
}
