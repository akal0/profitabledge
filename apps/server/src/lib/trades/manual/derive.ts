import type { tradingAccount } from "../../../db/schema/trading";
import {
  calculateNormalizedPipsFromPriceDelta,
  getContractSizeForSymbol,
  getPipSizeForSymbol,
  normalizePipValue,
} from "../../dukascopy";
import { getTradeOriginLabel } from "../../public-proof/trust";
import { calculateTradeOutcome } from "../trade-outcome";
import { normalizeTradeTags } from "../tags";

type AccountRow = typeof tradingAccount.$inferSelect;

type ManualTradeCommonInput = {
  accountId: string;
  symbol: string;
  tradeType: "long" | "short";
  volume: number;
  openPrice: number;
  openTime: string | Date;
  sl?: number | null;
  tp?: number | null;
  commissions?: number | null;
  swap?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  customTags?: string[] | null;
};

export type ManualClosedTradeInput = ManualTradeCommonInput & {
  closePrice?: number | null;
  closeTime: string | Date;
  profit?: number | null;
};

export type ManualOpenTradeInput = ManualTradeCommonInput & {
  currentPrice?: number | null;
  profit?: number | null;
  comment?: string | null;
};

export const MANUAL_OPEN_TICKET_PREFIX = "manual:";

function assertFinitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
}

export function parseManualTradeDate(value: string | Date, label: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return date;
}

function toOptionalNumber(value?: number | null) {
  return value == null || !Number.isFinite(value) ? null : value;
}

function normalizeManualTradeSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Symbol is required");
  }
  return normalized;
}

export function deriveClosedTradeClosePrice(input: {
  tradeType: "long" | "short";
  openPrice: number;
  volume: number;
  symbol: string;
  profit: number;
}) {
  const contractSize = getContractSizeForSymbol(input.symbol);
  const priceMove = input.profit / (input.volume * contractSize);

  return input.tradeType === "long"
    ? input.openPrice + priceMove
    : input.openPrice - priceMove;
}

export function deriveClosedTradeProfit(input: {
  tradeType: "long" | "short";
  openPrice: number;
  closePrice: number;
  volume: number;
  symbol: string;
}) {
  const contractSize = getContractSizeForSymbol(input.symbol);
  const priceDiff =
    input.tradeType === "long"
      ? input.closePrice - input.openPrice
      : input.openPrice - input.closePrice;

  return priceDiff * input.volume * contractSize;
}

function buildPlannedRiskFields(input: {
  symbol: string;
  openPrice: number;
  sl?: number | null;
  tp?: number | null;
}) {
  if (input.sl == null || input.tp == null) {
    return {
      plannedRR: null,
      plannedRiskPips: null,
      plannedTargetPips: null,
    };
  }

  const pipSize = getPipSizeForSymbol(input.symbol);
  const plannedRiskPips = normalizePipValue(
    Math.abs(input.openPrice - input.sl) / pipSize,
    input.symbol
  );
  const plannedTargetPips = normalizePipValue(
    Math.abs(input.tp - input.openPrice) / pipSize,
    input.symbol
  );
  const plannedRR =
    plannedRiskPips > 0 ? plannedTargetPips / plannedRiskPips : null;

  return {
    plannedRR,
    plannedRiskPips,
    plannedTargetPips,
  };
}

function buildManualTradeMetadata(mode: "open" | "closed") {
  return {
    manualEntry: true,
    manualMode: mode,
    source: "manual_workspace",
  } satisfies Record<string, unknown>;
}

export function buildManualClosedTradeInsert(input: {
  tradeId: string;
  account: AccountRow;
  values: ManualClosedTradeInput;
}) {
  const symbol = normalizeManualTradeSymbol(input.values.symbol);
  assertFinitePositive(input.values.volume, "Volume");
  assertFinitePositive(input.values.openPrice, "Open price");

  const openTime = parseManualTradeDate(input.values.openTime, "Open time");
  const closeTime = parseManualTradeDate(input.values.closeTime, "Close time");

  if (closeTime <= openTime) {
    throw new Error("Close time must be after open time");
  }

  const explicitClosePrice = toOptionalNumber(input.values.closePrice);
  const explicitProfit = toOptionalNumber(input.values.profit);

  if (explicitClosePrice == null && explicitProfit == null) {
    throw new Error("Enter an exit price or a P&L value");
  }

  const closePrice =
    explicitClosePrice ??
    deriveClosedTradeClosePrice({
      tradeType: input.values.tradeType,
      openPrice: input.values.openPrice,
      volume: input.values.volume,
      symbol,
      profit: explicitProfit ?? 0,
    });
  const profit =
    explicitProfit ??
    deriveClosedTradeProfit({
      tradeType: input.values.tradeType,
      openPrice: input.values.openPrice,
      closePrice,
      volume: input.values.volume,
      symbol,
    });

  const durationSeconds = Math.floor(
    (closeTime.getTime() - openTime.getTime()) / 1000
  );
  const priceDiff =
    input.values.tradeType === "long"
      ? closePrice - input.values.openPrice
      : input.values.openPrice - closePrice;
  const pips = calculateNormalizedPipsFromPriceDelta(priceDiff, symbol);
  const planned = buildPlannedRiskFields({
    symbol,
    openPrice: input.values.openPrice,
    sl: input.values.sl,
    tp: input.values.tp,
  });
  const outcome = calculateTradeOutcome({
    symbol,
    profit,
    commissions: input.values.commissions ?? 0,
    swap: input.values.swap ?? 0,
    tp: input.values.tp ?? null,
    closePrice,
    entryPrice: input.values.openPrice,
    tradeDirection: input.values.tradeType,
    beThresholdPips: input.account.breakevenThresholdPips,
  });

  return {
    insertValues: {
      id: input.tradeId,
      accountId: input.values.accountId,
      ticket: `${MANUAL_OPEN_TICKET_PREFIX}${input.tradeId}`,
      symbol,
      tradeType: input.values.tradeType,
      volume: input.values.volume.toString(),
      openPrice: input.values.openPrice.toString(),
      closePrice: closePrice.toString(),
      openTime,
      closeTime,
      open: openTime.toISOString(),
      close: closeTime.toISOString(),
      sl: input.values.sl?.toString() || null,
      tp: input.values.tp?.toString() || null,
      profit: profit.toString(),
      pips: pips.toString(),
      commissions: input.values.commissions?.toString() || null,
      swap: input.values.swap?.toString() || null,
      tradeDurationSeconds: durationSeconds.toString(),
      beThresholdPips: input.account.breakevenThresholdPips,
      outcome,
      originType: "manual_entry" as const,
      originLabel: getTradeOriginLabel("manual_entry"),
      originCapturedAt: new Date(),
      sessionTag: input.values.sessionTag || null,
      modelTag: input.values.modelTag || null,
      customTags: normalizeTradeTags(input.values.customTags),
      plannedRR: planned.plannedRR?.toString() ?? null,
      plannedRiskPips: planned.plannedRiskPips?.toString() ?? null,
      plannedTargetPips: planned.plannedTargetPips?.toString() ?? null,
      brokerMeta: {
        ...buildManualTradeMetadata("closed"),
        manualModelTag: input.values.modelTag || null,
        manualCustomTags: normalizeTradeTags(input.values.customTags),
      },
    },
    summary: {
      id: input.tradeId,
      symbol,
      profit,
      pips,
      outcome,
      closePrice,
      openTime,
      closeTime,
      derivedProfit: explicitProfit == null,
      derivedClosePrice: explicitClosePrice == null,
    },
  };
}

export function buildManualOpenTradeInsert(input: {
  openTradeId: string;
  values: ManualOpenTradeInput;
}) {
  const symbol = normalizeManualTradeSymbol(input.values.symbol);
  assertFinitePositive(input.values.volume, "Volume");
  assertFinitePositive(input.values.openPrice, "Open price");

  const openTime = parseManualTradeDate(input.values.openTime, "Open time");
  const currentPrice = toOptionalNumber(input.values.currentPrice);
  const floatingProfit =
    toOptionalNumber(input.values.profit) ??
    (currentPrice == null
      ? 0
      : deriveClosedTradeProfit({
          tradeType: input.values.tradeType,
          openPrice: input.values.openPrice,
          closePrice: currentPrice,
          volume: input.values.volume,
          symbol,
        }));

  return {
    insertValues: {
      id: input.openTradeId,
      accountId: input.values.accountId,
      ticket: `${MANUAL_OPEN_TICKET_PREFIX}${input.openTradeId}`,
      symbol,
      tradeType: input.values.tradeType,
      volume: input.values.volume.toString(),
      openPrice: input.values.openPrice.toString(),
      openTime,
      sl: input.values.sl?.toString() || null,
      tp: input.values.tp?.toString() || null,
      currentPrice:
        currentPrice != null ? currentPrice.toString() : input.values.openPrice.toString(),
      swap: input.values.swap?.toString() || "0",
      commission: input.values.commissions?.toString() || "0",
      profit: floatingProfit.toString(),
      sessionTag: input.values.sessionTag || null,
      comment: input.values.comment?.trim() || null,
      brokerMeta: {
        ...buildManualTradeMetadata("open"),
        manualModelTag: input.values.modelTag || null,
        manualCustomTags: normalizeTradeTags(input.values.customTags),
      },
      lastUpdatedAt: new Date(),
    },
    summary: {
      id: input.openTradeId,
      symbol,
      profit: floatingProfit,
      openTime,
      derivedFloatingProfit: input.values.profit == null,
    },
  };
}
