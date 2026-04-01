import type { ManualTradeSizingPreferences } from "@/lib/manual-trade-sizing";
import type { TradeRow, TradeStreakMeta } from "./trade-table-types";

export type DirectionType = "all" | "long" | "short";
export type OutcomeFilterValue = "Win" | "Loss" | "BE" | "PW" | "Live";
export type NumericRange = [number, number];
export type ViewNumericFilter = { min?: number; max?: number };
export type TradeViewFilters = {
  sessionTags?: string[];
  edgeIds?: string[];
  modelTags?: string[];
  protocolAlignment?: Array<"aligned" | "against" | "discretionary">;
  outcomes?: OutcomeFilterValue[];
  symbols?: string[];
  directions?: Array<"long" | "short">;
  tradeDirection?: DirectionType;
  dateRange?: { start?: string; end?: string };
  numericFilters?: Record<string, ViewNumericFilter>;
};
export type AdvancedMetricsPreferences = {
  disableSampleGating?: boolean;
  alphaWeightedMpe?: number;
  manualTradeSizing?: ManualTradeSizingPreferences;
};
export type SelectedTradeView = {
  id?: string;
  config?: unknown;
};
export type SelectedTradeViewConfig = {
  filters?: TradeViewFilters;
  visibleColumns?: string[];
};
export type NamedColorTag = {
  name: string;
  color: string;
};
export type AccountOpenBounds = {
  minISO?: string | null;
  maxISO?: string | null;
};
export type AccountStatsSummary = {
  initialBalance?: number | string | null;
};
export type SampleGateStatusRow = {
  tier: string;
  required: number;
  current: number;
  isUnlocked: boolean;
  message: string;
  unlockSummary?: string;
  unlocks?: string[];
};

export type TradeFilterArtifacts = {
  commissionsHistogram: number[];
  efficiencyHistogram: number[];
  holdHistogram: number[];
  maeHistogram: number[];
  mfeHistogram: number[];
  profitHistogram: number[];
  rrHistogram: number[];
  swapHistogram: number[];
  symbolCounts: Record<string, number>;
  symbolTotal: number;
  volumeHistogram: number[];
};

export const NO_RESULTS_FILTER_ID = "__trades_no_results__";

export const isFiniteNumber = (
  value: number | null | undefined
): value is number => typeof value === "number" && Number.isFinite(value);

export const parseDateParam = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const startOfUtcDay = (value: Date) => {
  const normalized = new Date(value);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

export const endOfUtcDay = (value: Date) => {
  const normalized = new Date(value);
  normalized.setUTCHours(23, 59, 59, 999);
  return normalized;
};

function getTradeSequenceTimestamp(trade: TradeRow) {
  const parsed = Date.parse(trade.open || trade.close || trade.createdAtISO);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildTradeStreakMap(trades: TradeRow[]) {
  const orderedTrades = [...trades].sort((left, right) => {
    const timeDiff =
      getTradeSequenceTimestamp(left) - getTradeSequenceTimestamp(right);
    if (timeDiff !== 0) return timeDiff;

    const createdAtDiff =
      Date.parse(left.createdAtISO) - Date.parse(right.createdAtISO);
    if (!Number.isNaN(createdAtDiff) && createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return left.id.localeCompare(right.id);
  });

  const streakByTradeId: Record<string, TradeStreakMeta> = {};
  let activeType: TradeStreakMeta["type"] | null = null;
  let activeCount = 0;

  for (const trade of orderedTrades) {
    const nextType =
      trade.outcome === "Win" || trade.outcome === "PW"
        ? "win"
        : trade.outcome === "Loss"
        ? "loss"
        : null;

    if (!nextType) {
      activeType = null;
      activeCount = 0;
      continue;
    }

    if (nextType === activeType) {
      activeCount += 1;
    } else {
      activeType = nextType;
      activeCount = 1;
    }

    streakByTradeId[trade.id] = {
      count: activeCount,
      type: nextType,
    };
  }

  return streakByTradeId;
}

export const mergeArrayFilter = <T extends string>(
  manual: T[],
  fromView?: T[]
) => {
  if (!manual.length && !(fromView?.length ?? 0)) {
    return { values: [] as T[], conflict: false };
  }
  if (!manual.length) {
    return { values: [...(fromView || [])], conflict: false };
  }
  if (!(fromView?.length ?? 0)) {
    return { values: [...manual], conflict: false };
  }

  const viewSet = new Set(fromView);
  const values = manual.filter((value) => viewSet.has(value));
  return { values, conflict: values.length === 0 };
};

export const mergeDirectionFilter = (
  manual: DirectionType,
  fromView?: Array<"long" | "short">,
  legacyViewDirection?: DirectionType
) => {
  const viewDirections =
    fromView && fromView.length > 0
      ? fromView
      : legacyViewDirection && legacyViewDirection !== "all"
      ? [legacyViewDirection]
      : [];

  if (manual === "all" && !viewDirections.length) {
    return { value: "all" as DirectionType, conflict: false };
  }
  if (manual !== "all" && !viewDirections.length) {
    return { value: manual, conflict: false };
  }
  if (manual === "all" && viewDirections.length === 1) {
    return { value: viewDirections[0], conflict: false };
  }
  if (manual === "all") {
    return { value: "all" as DirectionType, conflict: false };
  }
  return {
    value: manual,
    conflict: viewDirections.length > 0 && !viewDirections.includes(manual),
  };
};

export const mergeNumericRange = (
  manual?: NumericRange,
  fromView?: ViewNumericFilter
) => {
  const mergedMin = Math.max(
    manual?.[0] ?? Number.NEGATIVE_INFINITY,
    fromView?.min ?? Number.NEGATIVE_INFINITY
  );
  const mergedMax = Math.min(
    manual?.[1] ?? Number.POSITIVE_INFINITY,
    fromView?.max ?? Number.POSITIVE_INFINITY
  );

  if (!Number.isFinite(mergedMin) && !Number.isFinite(mergedMax)) {
    return { range: undefined, conflict: false };
  }
  if (mergedMin > mergedMax) {
    return { range: undefined, conflict: true };
  }

  const min = mergedMin === Number.NEGATIVE_INFINITY ? undefined : mergedMin;
  const max = mergedMax === Number.POSITIVE_INFINITY ? undefined : mergedMax;

  return {
    range:
      min == null && max == null
        ? undefined
        : ([
            min ?? Number.NEGATIVE_INFINITY,
            max ?? Number.POSITIVE_INFINITY,
          ] as NumericRange),
    conflict: false,
  };
};
