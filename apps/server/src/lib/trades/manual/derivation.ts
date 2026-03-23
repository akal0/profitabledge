import {
  calculateAllAdvancedMetrics,
  calculateRealisedRR,
  type TradeData,
} from "../../advanced-metrics";
import {
  calculateNormalizedPipsFromPriceDelta,
  getContractSizeForSymbol,
  getPipSizeForSymbol,
} from "../../dukascopy";
import {
  DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
  calculateTradeOutcome,
  normalizeBreakevenThresholdPips,
} from "../../trades/trade-outcome";
import {
  getTradeOriginLabel,
  resolveTradeOriginType,
} from "../../public-proof/trust";
import type {
  ManualTradeCoreValues,
  ManualTradeDraft,
  ManualTradeDirection,
} from "./types";
import { validateManualTradeTiming } from "./validation";

function toNullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function priceDiffForDirection(
  tradeType: ManualTradeDirection,
  openPrice: number,
  closePrice: number
) {
  return tradeType === "long" ? closePrice - openPrice : openPrice - closePrice;
}

export function deriveManualTradeDurationSeconds(input: {
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
}) {
  const timing = validateManualTradeTiming({
    openTime: input.openTime,
    closeTime: input.closeTime,
  });

  if (!timing.openTime || !timing.closeTime) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((timing.closeTime.getTime() - timing.openTime.getTime()) / 1000)
  );
}

export function deriveManualTradePips(input: {
  symbol: string;
  tradeType: ManualTradeDirection;
  openPrice?: number | null;
  closePrice?: number | null;
}) {
  if (input.openPrice == null || input.closePrice == null) return null;

  const priceDelta = priceDiffForDirection(
    input.tradeType,
    input.openPrice,
    input.closePrice
  );

  return calculateNormalizedPipsFromPriceDelta(priceDelta, input.symbol);
}

export function deriveManualTradeProfit(input: {
  symbol: string;
  tradeType: ManualTradeDirection;
  volume?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  currentPrice?: number | null;
}) {
  const openPrice = input.openPrice ?? null;
  const closePrice = input.closePrice ?? input.currentPrice ?? null;

  if (openPrice == null || closePrice == null || input.volume == null) {
    return null;
  }

  const contractSize = getContractSizeForSymbol(input.symbol);
  const priceDelta = priceDiffForDirection(
    input.tradeType,
    openPrice,
    closePrice
  );

  return priceDelta * input.volume * contractSize;
}

export function deriveManualTradePlannedRiskPips(input: {
  symbol: string;
  openPrice?: number | null;
  sl?: number | null;
}) {
  if (input.openPrice == null || input.sl == null) {
    return null;
  }

  return (
    Math.abs(input.openPrice - input.sl) / getPipSizeForSymbol(input.symbol)
  );
}

export function deriveManualTradePlannedTargetPips(input: {
  symbol: string;
  openPrice?: number | null;
  tp?: number | null;
}) {
  if (input.openPrice == null || input.tp == null) {
    return null;
  }

  return (
    Math.abs(input.tp - input.openPrice) / getPipSizeForSymbol(input.symbol)
  );
}

export function deriveManualTradePlannedRR(input: {
  symbol: string;
  openPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
}) {
  const risk = deriveManualTradePlannedRiskPips(input);
  const target = deriveManualTradePlannedTargetPips(input);

  if (risk == null || target == null || risk <= 0) {
    return null;
  }

  return target / risk;
}

export function deriveManualTradeRealisedRR(input: {
  symbol: string;
  tradeType: ManualTradeDirection;
  openPrice?: number | null;
  closePrice?: number | null;
  sl?: number | null;
}) {
  if (input.openPrice == null || input.closePrice == null || input.sl == null) {
    return null;
  }

  return calculateRealisedRR({
    id: "manual-trade-preview",
    symbol: input.symbol,
    tradeDirection: input.tradeType,
    entryPrice: input.openPrice,
    sl: input.sl,
    tp: null,
    closePrice: input.closePrice,
    profit: 0,
    commissions: null,
    swap: null,
    volume: 0,
    manipulationHigh: null,
    manipulationLow: null,
    manipulationPips: null,
    entryPeakPrice: null,
    postExitPeakPrice: null,
  });
}

export function deriveManualTradeCoreValues(input: {
  draft: ManualTradeDraft;
  beThresholdPips?: number | null;
}): ManualTradeCoreValues {
  const symbol = normalizeSymbol(input.draft.symbol);
  const timing = validateManualTradeTiming({
    openTime: input.draft.openTime ?? null,
    closeTime: input.draft.closeTime ?? null,
    mode: input.draft.closeTime ? "closed" : "open",
  });

  const openTimeISO = timing.openTime?.toISOString() ?? null;
  const closeTimeISO = timing.closeTime?.toISOString() ?? null;
  const holdSeconds = deriveManualTradeDurationSeconds({
    openTime: timing.openTime,
    closeTime: timing.closeTime,
  });
  const volume = toNullableNumber(input.draft.volume);
  const openPrice = toNullableNumber(input.draft.openPrice);
  const closePrice = toNullableNumber(input.draft.closePrice);
  const currentPrice = toNullableNumber(input.draft.currentPrice);
  const sl = toNullableNumber(input.draft.sl);
  const tp = toNullableNumber(input.draft.tp);
  const commissions = toNullableNumber(input.draft.commissions);
  const swap = toNullableNumber(input.draft.swap);
  const profit =
    toNullableNumber(input.draft.profit) ??
    deriveManualTradeProfit({
      symbol,
      tradeType: input.draft.tradeType,
      volume,
      openPrice,
      closePrice,
      currentPrice,
    });
  const pips = deriveManualTradePips({
    symbol,
    tradeType: input.draft.tradeType,
    openPrice,
    closePrice: closePrice ?? currentPrice,
  });
  const plannedRiskPips = deriveManualTradePlannedRiskPips({
    symbol,
    openPrice,
    sl,
  });
  const plannedTargetPips = deriveManualTradePlannedTargetPips({
    symbol,
    openPrice,
    tp,
  });
  const plannedRR = deriveManualTradePlannedRR({
    symbol,
    openPrice,
    sl,
    tp,
  });
  const realisedRR = deriveManualTradeRealisedRR({
    symbol,
    tradeType: input.draft.tradeType,
    openPrice,
    closePrice: closePrice ?? currentPrice,
    sl,
  });
  const beThresholdPips = normalizeBreakevenThresholdPips(
    input.beThresholdPips ?? DEFAULT_BREAKEVEN_THRESHOLD_PIPS
  );
  const outcome = calculateTradeOutcome({
    symbol,
    profit,
    commissions,
    swap,
    tp,
    closePrice: closePrice ?? currentPrice,
    entryPrice: openPrice,
    tradeDirection: input.draft.tradeType,
    beThresholdPips,
  });
  const originType = resolveTradeOriginType({
    originType: "manual_entry",
    useBrokerData: 0,
  });

  return {
    symbol,
    tradeType: input.draft.tradeType,
    volume,
    openPrice,
    closePrice,
    currentPrice,
    openTime: timing.openTime,
    closeTime: timing.closeTime,
    openTimeISO,
    closeTimeISO,
    holdSeconds,
    pips,
    profit,
    commissions,
    swap,
    netPnL: profit == null ? null : profit + (commissions ?? 0) + (swap ?? 0),
    plannedRiskPips,
    plannedTargetPips,
    plannedRR,
    realisedRR,
    outcome,
    beThresholdPips,
    originType,
    originLabel: getTradeOriginLabel(originType),
    originCapturedAt: new Date(),
  };
}

export function deriveManualTradeAdvancedMetrics(input: {
  draft: ManualTradeDraft;
  totalTradesInAccount?: number;
  disableSampleGating?: boolean;
}) {
  const core = deriveManualTradeCoreValues({
    draft: input.draft,
  });

  const tradeData: TradeData = {
    id: input.draft.ticket || `${core.symbol}-${core.openTimeISO ?? "draft"}`,
    symbol: core.symbol,
    tradeDirection: core.tradeType,
    entryPrice: core.openPrice ?? 0,
    sl: input.draft.sl ?? null,
    tp: input.draft.tp ?? null,
    closePrice: core.closePrice ?? null,
    profit: core.profit ?? 0,
    commissions: core.commissions ?? null,
    swap: core.swap ?? null,
    volume: core.volume ?? 0,
    manipulationHigh: null,
    manipulationLow: null,
    manipulationPips: null,
    entryPeakPrice: null,
    postExitPeakPrice: null,
  };

  return calculateAllAdvancedMetrics(
    tradeData,
    input.totalTradesInAccount ?? 0,
    input.disableSampleGating ?? false
  );
}
