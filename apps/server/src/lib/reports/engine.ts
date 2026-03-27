import { convertCurrencyAmount } from "@profitabledge/contracts/currency";
import {
  REPORT_LENS_CONFIG,
  type ReportDimensionId,
  type ReportLensId,
  type ReportMetricId,
  type ReportPanelId,
} from "@profitabledge/contracts/reports";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "../../db";
import { trade, tradingAccount } from "../../db/schema/trading";
import {
  calculateAllAdvancedMetrics,
  type TradeData,
} from "../advanced-metrics";
import {
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../account-scope";
import {
  CacheTTL,
  cacheNamespaces,
  enhancedCache,
} from "../enhanced-cache";
import {
  createSymbolResolver,
  expandCanonicalSymbolsToRawSymbols,
  listUserSymbolMappings,
} from "../symbol-mapping";
import {
  DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
  resolveStoredTradeOutcome,
} from "../trades/trade-outcome";
import {
  addTradeDateWindowClauses,
  parseNaiveAsUTC,
} from "../../routers/trades/shared";

type ReportFiltersInput = {
  accountId: string;
  startDate?: string;
  endDate?: string;
  symbols?: string[];
  sessionTags?: string[];
  modelTags?: string[];
  customTags?: string[];
  accountTags?: string[];
  currencyCode?: string | null;
  timezone?: string | null;
};

export type ReportDrilldownInput = {
  dimension: ReportDimensionId;
  value: string;
} | null;

type ReportTrade = {
  id: string;
  accountId: string;
  openAt: Date;
  closeAt: Date;
  symbol: string;
  symbolGroup: string;
  direction: "long" | "short";
  profit: number;
  volume: number;
  holdSeconds: number;
  sessionTag: string | null;
  modelTag: string | null;
  customTags: string[];
  protocolAlignment: string | null;
  outcome: "Win" | "Loss" | "BE" | "PW";
  plannedRR: number | null;
  realisedRR: number | null;
  mfePips: number | null;
  maePips: number | null;
  rrCaptureEfficiency: number | null;
  entrySlippagePips: number | null;
  exitSlippagePips: number | null;
};

type AggregateRow = {
  key: string;
  label: string;
  sortValue: number | string;
  tradeCount: number;
  netPnl: number;
  winRate: number;
  avgPlannedRR: number | null;
  avgRR: number | null;
  profitFactor: number | null;
  expectancy: number;
  avgHold: number | null;
  avgMfe: number | null;
  avgMae: number | null;
  protocolRate: number | null;
  rrCaptureEfficiency: number | null;
};

type AggregateAccumulator = {
  tradeCount: number;
  netPnl: number;
  grossProfit: number;
  grossLossAbs: number;
  wins: number;
  plannedRrSum: number;
  plannedRrCount: number;
  rrSum: number;
  rrCount: number;
  holdSum: number;
  holdCount: number;
  mfeSum: number;
  mfeCount: number;
  maeSum: number;
  maeCount: number;
  protocolAlignedCount: number;
  captureSum: number;
  captureCount: number;
};

type OverviewMetrics = {
  tradeCount: number;
  netPnl: number;
  winRate: number;
  avgPlannedRR: number | null;
  avgRR: number | null;
  profitFactor: number | null;
  expectancy: number;
  avgHold: number | null;
  avgMfe: number | null;
  avgMae: number | null;
  protocolRate: number | null;
  rrCaptureEfficiency: number | null;
};

type PanelTimeseriesRow = {
  label: string;
  primary: number;
  secondary?: number | null;
  tertiary?: number | null;
};

type PanelRankedRow = {
  label: string;
  primary: number;
  secondary?: number | null;
  tertiary?: number | null;
};

type PanelHeatmapCell = {
  row: string;
  column: string;
  value: number;
};

type PanelScatterPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  z?: number | null;
  tone: "positive" | "negative" | "neutral";
};

type PanelRadarRow = {
  label: string;
  winRate: number;
  avgRR: number;
  expectancy: number;
  rrCaptureEfficiency: number;
  tradeCountScore: number;
};

type PanelStat = {
  id: string;
  label: string;
  value: number | null;
  format: "currency" | "percent" | "number" | "duration" | "rr";
};

type MonteCarloPoint = {
  step: number;
  p10: number;
  p50: number;
  p90: number;
};

type MonteCarloPath = {
  id: string;
  points: Array<{ step: number; value: number }>;
};

function createAccumulator(): AggregateAccumulator {
  return {
    tradeCount: 0,
    netPnl: 0,
    grossProfit: 0,
    grossLossAbs: 0,
    wins: 0,
    plannedRrSum: 0,
    plannedRrCount: 0,
    rrSum: 0,
    rrCount: 0,
    holdSum: 0,
    holdCount: 0,
    mfeSum: 0,
    mfeCount: 0,
    maeSum: 0,
    maeCount: 0,
    protocolAlignedCount: 0,
    captureSum: 0,
    captureCount: 0,
  };
}

function average(sum: number, count: number) {
  if (count <= 0) return null;
  return sum / count;
}

function getProfitFactor(grossProfit: number, grossLossAbs: number) {
  if (grossLossAbs > 0) return grossProfit / grossLossAbs;
  return grossProfit > 0 ? null : 0;
}

function getTone(value: number) {
  if (value > 0) return "positive" as const;
  if (value < 0) return "negative" as const;
  return "neutral" as const;
}

function toStartIso(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000`).toISOString();
}

function toEndIso(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function sanitizeFilters(input: ReportFiltersInput) {
  const sortUnique = (values?: string[]) =>
    Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).sort(
      (left, right) =>
        left.localeCompare(right, undefined, {
          numeric: true,
          sensitivity: "base",
        })
    );

  return {
    accountId: input.accountId,
    startDate: input.startDate ?? "",
    endDate: input.endDate ?? "",
    symbols: sortUnique(input.symbols),
    sessionTags: sortUnique(input.sessionTags),
    modelTags: sortUnique(input.modelTags),
    customTags: sortUnique(input.customTags),
    accountTags: sortUnique(input.accountTags),
    currencyCode: input.currencyCode ?? null,
    timezone: input.timezone ?? "UTC",
  };
}

function encodeCachePart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getDateProxy(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(map.get("year") || "0");
  const month = Number(map.get("month") || "1");
  const day = Number(map.get("day") || "1");
  const hour = Number(map.get("hour") || "0");
  const minute = Number(map.get("minute") || "0");
  const second = Number(map.get("second") || "0");

  return {
    weekdayShort: map.get("weekday") || "",
    proxy: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
  };
}

function getDayLabel(dayIndex: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIndex] || "—";
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getIsoWeekParts(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return {
    year: copy.getUTCFullYear(),
    week,
  };
}

function getWeekLabel(date: Date) {
  const { year, week } = getIsoWeekParts(date);
  return `W${String(week).padStart(2, "0")} ${year}`;
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatHalfHourWindow(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getHalfHourBucket(date: Date) {
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const bucket = Math.floor(minutes / 30) * 30;
  return {
    key: String(bucket),
    label: formatHalfHourWindow(bucket),
    sortValue: bucket,
  };
}

function getHoldBucket(value: number) {
  if (value < 300) return { key: "under-5m", label: "< 5m", sortValue: 1 };
  if (value < 900) return { key: "5m-15m", label: "5m - 15m", sortValue: 2 };
  if (value < 3600) return { key: "15m-1h", label: "15m - 1h", sortValue: 3 };
  if (value < 14400) return { key: "1h-4h", label: "1h - 4h", sortValue: 4 };
  return { key: "4h-plus", label: "4h+", sortValue: 5 };
}

function getVolumeBucket(value: number) {
  if (value <= 0.5) return { key: "0-0.5", label: "0 - 0.5", sortValue: 1 };
  if (value <= 1) return { key: "0.5-1", label: "0.5 - 1", sortValue: 2 };
  if (value <= 2) return { key: "1-2", label: "1 - 2", sortValue: 3 };
  if (value <= 5) return { key: "2-5", label: "2 - 5", sortValue: 4 };
  return { key: "5-plus", label: "5+", sortValue: 5 };
}

function getRRBucket(value: number | null, kind: "planned" | "realized") {
  if (value == null) return { key: "unassigned", label: "Unassigned", sortValue: 999 };

  if (kind === "planned") {
    if (value < 1) return { key: "under-1", label: "< 1R", sortValue: 1 };
    if (value < 2) return { key: "1-2", label: "1R - 2R", sortValue: 2 };
    if (value < 3) return { key: "2-3", label: "2R - 3R", sortValue: 3 };
    return { key: "3-plus", label: "3R+", sortValue: 4 };
  }

  if (value < 0) return { key: "negative", label: "< 0R", sortValue: 1 };
  if (value < 1) return { key: "0-1", label: "0R - 1R", sortValue: 2 };
  if (value < 2) return { key: "1-2", label: "1R - 2R", sortValue: 3 };
  if (value < 3) return { key: "2-3", label: "2R - 3R", sortValue: 4 };
  return { key: "3-plus", label: "3R+", sortValue: 5 };
}

function getSlippageBucket(entrySlippage: number | null, exitSlippage: number | null) {
  const value = Math.abs(Number(entrySlippage ?? 0)) + Math.abs(Number(exitSlippage ?? 0));
  if (value < 0.25) return { key: "under-0.25", label: "< 0.25", sortValue: 1 };
  if (value < 0.5) return { key: "0.25-0.5", label: "0.25 - 0.5", sortValue: 2 };
  if (value < 1) return { key: "0.5-1", label: "0.5 - 1", sortValue: 3 };
  if (value < 2) return { key: "1-2", label: "1 - 2", sortValue: 4 };
  return { key: "2-plus", label: "2+", sortValue: 5 };
}

function getCaptureBucket(value: number | null) {
  if (value == null) return { key: "unassigned", label: "Unassigned", sortValue: 999 };
  if (value < 25) return { key: "under-25", label: "< 25%", sortValue: 1 };
  if (value < 50) return { key: "25-50", label: "25% - 50%", sortValue: 2 };
  if (value < 75) return { key: "50-75", label: "50% - 75%", sortValue: 3 };
  if (value < 100) return { key: "75-100", label: "75% - 100%", sortValue: 4 };
  return { key: "100-plus", label: "100%+", sortValue: 5 };
}

function getProtocolLabel(value: string | null) {
  if (!value) return { key: "unassigned", label: "Unassigned", sortValue: 99 };

  const normalized = String(value).toLowerCase();
  if (normalized === "aligned") return { key: "aligned", label: "Aligned", sortValue: 1 };
  if (normalized === "against") return { key: "against", label: "Against", sortValue: 2 };
  if (normalized === "discretionary") {
    return { key: "discretionary", label: "Discretionary", sortValue: 3 };
  }

  return { key: normalized, label: normalized, sortValue: 99 };
}

function getDirectionLabel(direction: "long" | "short") {
  return direction === "long"
    ? { key: "long", label: "Long", sortValue: 1 }
    : { key: "short", label: "Short", sortValue: 2 };
}

function getTradeLabelsForDimension(
  tradeRow: ReportTrade,
  dimension: ReportDimensionId,
  timezone: string
) {
  const openParts = getDateProxy(tradeRow.openAt, timezone);
  const closeParts = getDateProxy(tradeRow.closeAt, timezone);
  const openDate = openParts.proxy;
  const closeDate = closeParts.proxy;

  switch (dimension) {
    case "date": {
      const key = openDate.toISOString().slice(0, 10);
      return [{ key, label: key, sortValue: key }];
    }
    case "week":
      return [
        {
          key: getWeekLabel(openDate),
          label: getWeekLabel(openDate),
          sortValue: Number(`${getIsoWeekParts(openDate).year}${String(getIsoWeekParts(openDate).week).padStart(2, "0")}`),
        },
      ];
    case "month": {
      const key = `${openDate.getUTCFullYear()}-${String(openDate.getUTCMonth() + 1).padStart(2, "0")}`;
      return [{ key, label: getMonthLabel(openDate), sortValue: key }];
    }
    case "symbol":
      return [{ key: tradeRow.symbolGroup || tradeRow.symbol || "Unassigned", label: tradeRow.symbolGroup || tradeRow.symbol || "Unassigned", sortValue: tradeRow.symbolGroup || tradeRow.symbol || "Unassigned" }];
    case "session":
      return [{ key: tradeRow.sessionTag || "Unassigned", label: tradeRow.sessionTag || "Unassigned", sortValue: tradeRow.sessionTag || "Unassigned" }];
    case "model":
      return [{ key: tradeRow.modelTag || "Unassigned", label: tradeRow.modelTag || "Unassigned", sortValue: tradeRow.modelTag || "Unassigned" }];
    case "customTag": {
      const tags = tradeRow.customTags.length > 0 ? tradeRow.customTags : ["Unassigned"];
      return tags.map((tag) => ({ key: tag, label: tag, sortValue: tag }));
    }
    case "protocolAlignment":
      return [getProtocolLabel(tradeRow.protocolAlignment)];
    case "hour":
      return [
        {
          key: String(openDate.getUTCHours()),
          label: formatHourLabel(openDate.getUTCHours()),
          sortValue: openDate.getUTCHours(),
        },
      ];
    case "weekday":
      return [
        {
          key: String(openDate.getUTCDay()),
          label: getDayLabel(openDate.getUTCDay()),
          sortValue: openDate.getUTCDay(),
        },
      ];
    case "holdBucket":
      return [getHoldBucket(tradeRow.holdSeconds)];
    case "entryWindow":
      return [getHalfHourBucket(openDate)];
    case "exitWindow":
      return [getHalfHourBucket(closeDate)];
    case "volumeBucket":
      return [getVolumeBucket(tradeRow.volume)];
    case "plannedRBucket":
      return [getRRBucket(tradeRow.plannedRR, "planned")];
    case "realizedRBucket":
      return [getRRBucket(tradeRow.realisedRR, "realized")];
    case "direction":
      return [getDirectionLabel(tradeRow.direction)];
    case "slippageBucket":
      return [getSlippageBucket(tradeRow.entrySlippagePips, tradeRow.exitSlippagePips)];
    case "captureBucket":
      return [getCaptureBucket(tradeRow.rrCaptureEfficiency)];
    default:
      return [{ key: "unassigned", label: "Unassigned", sortValue: 999 }];
  }
}

function accumulateTrade(
  accumulator: AggregateAccumulator,
  tradeRow: ReportTrade
) {
  accumulator.tradeCount += 1;
  accumulator.netPnl += tradeRow.profit;
  if (tradeRow.profit > 0) {
    accumulator.grossProfit += tradeRow.profit;
    accumulator.wins += 1;
  } else if (tradeRow.profit < 0) {
    accumulator.grossLossAbs += Math.abs(tradeRow.profit);
  }

  if (tradeRow.realisedRR != null) {
    accumulator.rrSum += tradeRow.realisedRR;
    accumulator.rrCount += 1;
  }

  if (tradeRow.plannedRR != null) {
    accumulator.plannedRrSum += tradeRow.plannedRR;
    accumulator.plannedRrCount += 1;
  }

  if (Number.isFinite(tradeRow.holdSeconds)) {
    accumulator.holdSum += tradeRow.holdSeconds;
    accumulator.holdCount += 1;
  }

  if (tradeRow.mfePips != null) {
    accumulator.mfeSum += tradeRow.mfePips;
    accumulator.mfeCount += 1;
  }

  if (tradeRow.maePips != null) {
    accumulator.maeSum += tradeRow.maePips;
    accumulator.maeCount += 1;
  }

  if (String(tradeRow.protocolAlignment || "").toLowerCase() === "aligned") {
    accumulator.protocolAlignedCount += 1;
  }

  if (tradeRow.rrCaptureEfficiency != null) {
    accumulator.captureSum += tradeRow.rrCaptureEfficiency;
    accumulator.captureCount += 1;
  }
}

function finalizeAccumulator(
  key: string,
  label: string,
  sortValue: string | number,
  accumulator: AggregateAccumulator
): AggregateRow {
  return {
    key,
    label,
    sortValue,
    tradeCount: accumulator.tradeCount,
    netPnl: accumulator.netPnl,
    winRate:
      accumulator.tradeCount > 0
        ? (accumulator.wins / accumulator.tradeCount) * 100
        : 0,
    avgPlannedRR: average(
      accumulator.plannedRrSum,
      accumulator.plannedRrCount
    ),
    avgRR: average(accumulator.rrSum, accumulator.rrCount),
    profitFactor: getProfitFactor(
      accumulator.grossProfit,
      accumulator.grossLossAbs
    ),
    expectancy:
      accumulator.tradeCount > 0
        ? accumulator.netPnl / accumulator.tradeCount
        : 0,
    avgHold: average(accumulator.holdSum, accumulator.holdCount),
    avgMfe: average(accumulator.mfeSum, accumulator.mfeCount),
    avgMae: average(accumulator.maeSum, accumulator.maeCount),
    protocolRate:
      accumulator.tradeCount > 0
        ? (accumulator.protocolAlignedCount / accumulator.tradeCount) * 100
        : null,
    rrCaptureEfficiency: average(
      accumulator.captureSum,
      accumulator.captureCount
    ),
  };
}

function buildAggregateRows(
  trades: ReportTrade[],
  dimension: ReportDimensionId,
  timezone: string
) {
  const grouped = new Map<
    string,
    { label: string; sortValue: string | number; accumulator: AggregateAccumulator }
  >();

  for (const tradeRow of trades) {
    const labels = getTradeLabelsForDimension(tradeRow, dimension, timezone);
    for (const labelInfo of labels) {
      const existing =
        grouped.get(labelInfo.key) ?? {
          label: labelInfo.label,
          sortValue: labelInfo.sortValue,
          accumulator: createAccumulator(),
        };
      accumulateTrade(existing.accumulator, tradeRow);
      grouped.set(labelInfo.key, existing);
    }
  }

  const rows = Array.from(grouped.entries()).map(([key, value]) =>
    finalizeAccumulator(key, value.label, value.sortValue, value.accumulator)
  );

  if (
    dimension === "date" ||
    dimension === "week" ||
    dimension === "month" ||
    dimension === "hour" ||
    dimension === "weekday" ||
    dimension === "entryWindow" ||
    dimension === "exitWindow" ||
    dimension === "holdBucket" ||
    dimension === "volumeBucket" ||
    dimension === "protocolAlignment" ||
    dimension === "plannedRBucket" ||
    dimension === "realizedRBucket" ||
    dimension === "slippageBucket" ||
    dimension === "captureBucket"
  ) {
    return rows.sort((left, right) =>
      left.sortValue > right.sortValue ? 1 : left.sortValue < right.sortValue ? -1 : 0
    );
  }

  return rows.sort((left, right) => right.netPnl - left.netPnl);
}

function getOverviewMetrics(trades: ReportTrade[]): OverviewMetrics {
  const accumulator = createAccumulator();
  trades.forEach((tradeRow) => accumulateTrade(accumulator, tradeRow));

  return {
    tradeCount: accumulator.tradeCount,
    netPnl: accumulator.netPnl,
    winRate:
      accumulator.tradeCount > 0
        ? (accumulator.wins / accumulator.tradeCount) * 100
        : 0,
    avgPlannedRR: average(
      accumulator.plannedRrSum,
      accumulator.plannedRrCount
    ),
    avgRR: average(accumulator.rrSum, accumulator.rrCount),
    profitFactor: getProfitFactor(
      accumulator.grossProfit,
      accumulator.grossLossAbs
    ),
    expectancy:
      accumulator.tradeCount > 0
        ? accumulator.netPnl / accumulator.tradeCount
        : 0,
    avgHold: average(accumulator.holdSum, accumulator.holdCount),
    avgMfe: average(accumulator.mfeSum, accumulator.mfeCount),
    avgMae: average(accumulator.maeSum, accumulator.maeCount),
    protocolRate:
      accumulator.tradeCount > 0
        ? (accumulator.protocolAlignedCount / accumulator.tradeCount) * 100
        : null,
    rrCaptureEfficiency: average(
      accumulator.captureSum,
      accumulator.captureCount
    ),
  };
}

function applyDrilldown(
  trades: ReportTrade[],
  drilldown: ReportDrilldownInput,
  timezone: string
) {
  if (!drilldown) return trades;

  return trades.filter((tradeRow) =>
    getTradeLabelsForDimension(tradeRow, drilldown.dimension, timezone).some(
      (label) => label.key === drilldown.value
    )
  );
}

function sampleRows<T>(rows: T[], limit = 5) {
  return rows.slice(0, limit);
}

function buildTimeSeriesFromTrades(trades: ReportTrade[], timezone: string) {
  let equity = 0;
  return [...trades]
    .sort((left, right) => left.openAt.getTime() - right.openAt.getTime())
    .map((tradeRow, index) => {
      equity += tradeRow.profit;
      const openDate = getDateProxy(tradeRow.openAt, timezone).proxy;
      return {
        label: openDate.toISOString().slice(0, 10),
        step: index + 1,
        equity,
        profit: tradeRow.profit,
      };
    });
}

function buildDrawdownSeries(trades: ReportTrade[], timezone: string) {
  let equity = 0;
  let peak = 0;

  return [...trades]
    .sort((left, right) => left.openAt.getTime() - right.openAt.getTime())
    .map((tradeRow, index) => {
      equity += tradeRow.profit;
      peak = Math.max(peak, equity);
      const drawdown = equity - peak;
      const openDate = getDateProxy(tradeRow.openAt, timezone).proxy;
      return {
        label: openDate.toISOString().slice(0, 10),
        step: index + 1,
        value: drawdown,
      };
    });
}

function buildRollingSeries(trades: ReportTrade[], windowSize = 20) {
  const sorted = [...trades].sort(
    (left, right) => left.openAt.getTime() - right.openAt.getTime()
  );
  const rows: PanelTimeseriesRow[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const windowTrades = sorted.slice(Math.max(0, index - windowSize + 1), index + 1);
    const metrics = getOverviewMetrics(windowTrades);
    rows.push({
      label: String(index + 1),
      primary: metrics.winRate,
      secondary: metrics.expectancy,
    });
  }

  return rows;
}

function buildMonthWeekdayHeatmap(
  trades: ReportTrade[],
  timezone: string
) {
  const monthRows = buildAggregateRows(trades, "month", timezone);
  const weekdayRows = buildAggregateRows(trades, "weekday", timezone);
  const months = monthRows.map((row) => row.label);
  const weekdays = weekdayRows.map((row) => row.label);
  const values = new Map<string, number>();

  for (const tradeRow of trades) {
    const month = getTradeLabelsForDimension(tradeRow, "month", timezone)[0]?.label;
    const weekday = getTradeLabelsForDimension(tradeRow, "weekday", timezone)[0]?.label;
    if (!month || !weekday) continue;
    const key = `${weekday}:${month}`;
    values.set(key, (values.get(key) ?? 0) + tradeRow.profit);
  }

  const cells: PanelHeatmapCell[] = [];
  for (const weekday of weekdays) {
    for (const month of months) {
      cells.push({
        row: weekday,
        column: month,
        value: values.get(`${weekday}:${month}`) ?? 0,
      });
    }
  }

  return cells;
}

function buildEntryExitHeatmap(
  trades: ReportTrade[],
  timezone: string
) {
  const map = new Map<string, number>();
  const entryLabels = new Set<string>();
  const exitLabels = new Set<string>();

  for (const tradeRow of trades) {
    const entry = getTradeLabelsForDimension(tradeRow, "entryWindow", timezone)[0];
    const exit = getTradeLabelsForDimension(tradeRow, "exitWindow", timezone)[0];
    if (!entry || !exit) continue;
    entryLabels.add(entry.label);
    exitLabels.add(exit.label);
    const key = `${entry.label}:${exit.label}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const sortedEntry = [...entryLabels].sort();
  const sortedExit = [...exitLabels].sort();
  const cells: PanelHeatmapCell[] = [];

  for (const row of sortedEntry) {
    for (const column of sortedExit) {
      cells.push({
        row,
        column,
        value: map.get(`${row}:${column}`) ?? 0,
      });
    }
  }

  return cells;
}

function buildMatrixByDimensions(
  trades: ReportTrade[],
  rowDimension: ReportDimensionId,
  columnDimension: ReportDimensionId,
  timezone: string,
  metric: ReportMetricId = "netPnl"
) {
  const rowLabels = buildAggregateRows(trades, rowDimension, timezone)
    .sort((left, right) => right.tradeCount - left.tradeCount)
    .slice(0, 5)
    .map((row) => row.label);
  const columnLabels = buildAggregateRows(trades, columnDimension, timezone)
    .sort((left, right) => right.tradeCount - left.tradeCount)
    .slice(0, 5)
    .map((row) => row.label);
  const cells = new Map<string, AggregateAccumulator>();

  for (const tradeRow of trades) {
    const rows = getTradeLabelsForDimension(tradeRow, rowDimension, timezone).filter(
      (label) => rowLabels.includes(label.label)
    );
    const columns = getTradeLabelsForDimension(
      tradeRow,
      columnDimension,
      timezone
    ).filter((label) => columnLabels.includes(label.label));

    for (const row of rows) {
      for (const column of columns) {
        const key = `${row.label}:${column.label}`;
        const accumulator = cells.get(key) ?? createAccumulator();
        accumulateTrade(accumulator, tradeRow);
        cells.set(key, accumulator);
      }
    }
  }

  const result: PanelHeatmapCell[] = [];
  for (const row of rowLabels) {
    for (const column of columnLabels) {
      const key = `${row}:${column}`;
      const accumulator = cells.get(key) ?? createAccumulator();
      const metrics = finalizeAccumulator(key, key, 0, accumulator);
      result.push({
        row,
        column,
        value: metrics[metric] == null ? 0 : Number(metrics[metric]),
      });
    }
  }

  return result;
}

function buildRadarRows(
  trades: ReportTrade[],
  dimension: ReportDimensionId,
  timezone: string
) {
  const rows = buildAggregateRows(trades, dimension, timezone)
    .sort((left, right) => right.tradeCount - left.tradeCount)
    .slice(0, 5);
  const maxTradeCount = Math.max(1, ...rows.map((row) => row.tradeCount));

  return rows.map<PanelRadarRow>((row) => ({
    label: row.label,
    winRate: row.winRate,
    avgRR: row.avgRR ?? 0,
    expectancy: row.expectancy,
    rrCaptureEfficiency: row.rrCaptureEfficiency ?? 0,
    tradeCountScore: (row.tradeCount / maxTradeCount) * 100,
  }));
}

function buildHistogram(
  values: number[],
  ranges: Array<{ key: string; label: string; min?: number; max?: number }>
) {
  const counts = new Map(ranges.map((range) => [range.key, 0]));

  for (const value of values) {
    const match = ranges.find((range) => {
      const minPass = range.min == null ? true : value >= range.min;
      const maxPass = range.max == null ? true : value < range.max;
      return minPass && maxPass;
    });

    if (match) {
      counts.set(match.key, (counts.get(match.key) ?? 0) + 1);
    }
  }

  return ranges.map<PanelRankedRow>((range) => ({
    label: range.label,
    primary: counts.get(range.key) ?? 0,
  }));
}

function buildTradeDistributionByRange(
  trades: ReportTrade[],
  ranges: Array<{ key: string; label: string; min?: number; max?: number }>,
  getValue: (tradeRow: ReportTrade) => number | null | undefined
) {
  const buckets = new Map(
    ranges.map((range) => [
      range.key,
      { label: range.label, primary: 0, secondary: 0 },
    ])
  );

  for (const tradeRow of trades) {
    const value = getValue(tradeRow);
    if (value == null || !Number.isFinite(value)) continue;

    const match = ranges.find((range) => {
      const minPass = range.min == null ? true : value >= range.min;
      const maxPass = range.max == null ? true : value < range.max;
      return minPass && maxPass;
    });

    if (!match) continue;

    const current = buckets.get(match.key);
    if (!current) continue;
    current.primary += 1;
    current.secondary += tradeRow.profit;
  }

  return ranges.map<PanelRankedRow>((range) => ({
    label: range.label,
    primary: buckets.get(range.key)?.primary ?? 0,
    secondary: buckets.get(range.key)?.secondary ?? 0,
  }));
}

function buildRiskAdjustedStats(trades: ReportTrade[]) {
  const dailyRows = buildAggregateRows(trades, "date", "UTC");
  const returns = dailyRows.map((row) => row.netPnl);
  const mean =
    returns.length > 0
      ? returns.reduce((sum, value) => sum + value, 0) / returns.length
      : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (returns.length - 1)
      : 0;
  const stdev = Math.sqrt(variance);
  const downsideValues = returns.filter((value) => value < 0);
  const downsideMean =
    downsideValues.length > 0
      ? downsideValues.reduce((sum, value) => sum + value ** 2, 0) /
        downsideValues.length
      : 0;
  const downsideDeviation = Math.sqrt(downsideMean);
  const drawdownSeries = buildDrawdownSeries(trades, "UTC");
  const maxDrawdown = Math.min(0, ...drawdownSeries.map((row) => row.value));
  const metrics = getOverviewMetrics(trades);
  const avgWin =
    trades.filter((tradeRow) => tradeRow.profit > 0).reduce((sum, tradeRow, _, array) =>
      sum + tradeRow.profit / Math.max(array.length, 1),
    0);
  const avgLoss =
    trades.filter((tradeRow) => tradeRow.profit < 0).reduce((sum, tradeRow, _, array) =>
      sum + Math.abs(tradeRow.profit) / Math.max(array.length, 1),
    0);

  return [
    {
      id: "sharpeLike",
      label: "Volatility adjusted",
      value: stdev > 0 ? mean / stdev : null,
      format: "number",
    },
    {
      id: "sortinoLike",
      label: "Downside adjusted",
      value: downsideDeviation > 0 ? mean / downsideDeviation : null,
      format: "number",
    },
    {
      id: "returnToDrawdown",
      label: "Return / max DD",
      value: maxDrawdown < 0 ? metrics.netPnl / Math.abs(maxDrawdown) : null,
      format: "number",
    },
    {
      id: "payoffRatio",
      label: "Payoff ratio",
      value: avgLoss > 0 ? avgWin / avgLoss : null,
      format: "number",
    },
  ] satisfies PanelStat[];
}

function createSeededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function buildMonteCarlo(trades: ReportTrade[]) {
  const profits = trades.map((tradeRow) => tradeRow.profit);
  const pathLength = Math.min(Math.max(profits.length, 20), 120);
  const pathCount = Math.min(40, Math.max(12, Math.floor(profits.length / 2)));

  if (profits.length === 0) {
    return {
      envelope: [] as MonteCarloPoint[],
      paths: [] as MonteCarloPath[],
    };
  }

  const random = createSeededRandom(profits.length * 13 + 17);
  const paths: MonteCarloPath[] = [];

  for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
    let cumulative = 0;
    const points: Array<{ step: number; value: number }> = [];

    for (let step = 0; step < pathLength; step += 1) {
      const sample = profits[Math.floor(random() * profits.length)] ?? 0;
      cumulative += sample;
      points.push({ step: step + 1, value: cumulative });
    }

    paths.push({ id: `path-${pathIndex + 1}`, points });
  }

  const envelope: MonteCarloPoint[] = [];
  for (let step = 0; step < pathLength; step += 1) {
    const values = paths
      .map((path) => path.points[step]?.value ?? 0)
      .sort((left, right) => left - right);
    const p10 = values[Math.floor(values.length * 0.1)] ?? 0;
    const p50 = values[Math.floor(values.length * 0.5)] ?? 0;
    const p90 = values[Math.floor(values.length * 0.9)] ?? 0;
    envelope.push({ step: step + 1, p10, p50, p90 });
  }

  return { envelope, paths: sampleRows(paths, 14) };
}

async function loadReportTrades(
  userId: string,
  input: ReportFiltersInput
) {
  const filters = sanitizeFilters(input);
  const scopedAccountIds = await resolveScopedAccountIds(userId, filters.accountId);

  if (scopedAccountIds.length === 0) {
    return {
      trades: [] as ReportTrade[],
      timezone: filters.timezone || "UTC",
      targetCurrency: filters.currencyCode ?? null,
      accountIds: [] as string[],
    };
  }

  const accountRows = await db
    .select({
      id: tradingAccount.id,
      initialCurrency: tradingAccount.initialCurrency,
      breakevenThresholdPips: sql<number | null>`CAST(${tradingAccount.breakevenThresholdPips} AS NUMERIC)`,
      tags: tradingAccount.tags,
    })
    .from(tradingAccount)
    .where(inArray(tradingAccount.id, scopedAccountIds));

  const filteredAccountIds =
    filters.accountTags.length > 0
      ? accountRows
          .filter((account) =>
            filters.accountTags.some((tag) =>
              Array.isArray(account.tags) ? account.tags.includes(tag) : false
            )
          )
          .map((account) => account.id)
      : scopedAccountIds;

  if (filteredAccountIds.length === 0) {
    return {
      trades: [] as ReportTrade[],
      timezone: filters.timezone || "UTC",
      targetCurrency: filters.currencyCode ?? null,
      accountIds: [] as string[],
    };
  }

  const cacheKey = `${cacheNamespaces.ANALYTICS}:reports:dataset:${userId}:${encodeCachePart({
    ...filters,
    accountId: filteredAccountIds,
  })}`;
  const accountIdsForTags = new Set<string>(filteredAccountIds);

  const cached = await enhancedCache.getOrLoad(
    cacheKey,
    async () => {
      const userMappings = await listUserSymbolMappings(userId);
      const symbolResolver = createSymbolResolver(userMappings);
      const accountMap = new Map(
        accountRows.map((account) => [account.id, account])
      );
      const whereClauses: SQL[] = [
        buildAccountScopeCondition(trade.accountId, filteredAccountIds),
      ];

      addTradeDateWindowClauses(
        whereClauses,
        toStartIso(filters.startDate),
        toEndIso(filters.endDate)
      );

      if (filters.symbols.length > 0) {
        const symbolScopeClauses: SQL[] = [
          buildAccountScopeCondition(trade.accountId, filteredAccountIds),
        ];
        addTradeDateWindowClauses(
          symbolScopeClauses,
          toStartIso(filters.startDate),
          toEndIso(filters.endDate)
        );
        const rawSymbolRows = await db
          .selectDistinct({ symbol: trade.symbol })
          .from(trade)
          .where(and(...symbolScopeClauses));
        const matchingRawSymbols = expandCanonicalSymbolsToRawSymbols(
          rawSymbolRows
            .map((row) => row.symbol)
            .filter((value): value is string => Boolean(value)),
          filters.symbols,
          userMappings
        );

        if (matchingRawSymbols.length === 0) {
          return [] as ReportTrade[];
        }

        whereClauses.push(inArray(trade.symbol, matchingRawSymbols));
      }

      if (filters.sessionTags.length > 0) {
        whereClauses.push(
          sql`(${sql.join(
            filters.sessionTags.map((tag) => eq(trade.sessionTag, tag)),
            sql` OR `
          )})`
        );
      }

      if (filters.modelTags.length > 0) {
        whereClauses.push(
          sql`(${sql.join(
            filters.modelTags.map((tag) => eq(trade.modelTag, tag)),
            sql` OR `
          )})`
        );
      }

      if (filters.customTags.length > 0) {
        whereClauses.push(
          sql`(${sql.join(
            filters.customTags.map(
              (tag) =>
                sql`${trade.customTags} @> ${JSON.stringify([tag])}::jsonb`
            ),
            sql` OR `
          )})`
        );
      }

      const rows = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          openRaw: sql<string | null>`(${trade.open})`,
          closeRaw: sql<string | null>`(${trade.close})`,
          openTime: trade.openTime,
          closeTime: trade.closeTime,
          createdAt: trade.createdAt,
          symbol: trade.symbol,
          tradeType: trade.tradeType,
          volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
          profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
          openPrice: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
          closePrice: sql<number | null>`CAST(${trade.closePrice} AS NUMERIC)`,
          sl: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
          tp: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
          commissions: sql<number | null>`CAST(${trade.commissions} AS NUMERIC)`,
          swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
          holdSecondsRaw: sql<string | null>`(${trade.tradeDurationSeconds})`,
          sessionTag: trade.sessionTag,
          modelTag: trade.modelTag,
          customTags: trade.customTags,
          protocolAlignment: trade.protocolAlignment,
          plannedRR: sql<number | null>`CAST(${trade.plannedRR} AS NUMERIC)`,
          realisedRR: sql<number | null>`CAST(${trade.realisedRR} AS NUMERIC)`,
          mfePips: sql<number | null>`CAST(${trade.mfePips} AS NUMERIC)`,
          maePips: sql<number | null>`CAST(${trade.maePips} AS NUMERIC)`,
          rrCaptureEfficiency: sql<number | null>`CAST(${trade.rrCaptureEfficiency} AS NUMERIC)`,
          entrySlippagePips: sql<number | null>`CAST(${trade.entrySlippagePips} AS NUMERIC)`,
          exitSlippagePips: sql<number | null>`CAST(${trade.exitSlippagePips} AS NUMERIC)`,
          outcome: trade.outcome,
          manipulationHigh: sql<number | null>`CAST(${trade.manipulationHigh} AS NUMERIC)`,
          manipulationLow: sql<number | null>`CAST(${trade.manipulationLow} AS NUMERIC)`,
          manipulationPips: sql<number | null>`CAST(${trade.manipulationPips} AS NUMERIC)`,
          entryPeakPrice: sql<number | null>`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
          postExitPeakPrice: sql<number | null>`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
          alphaWeightedMpe: sql<number | null>`CAST(${trade.alphaWeightedMpe} AS NUMERIC)`,
          beThresholdPips: sql<number | null>`CAST(${trade.beThresholdPips} AS NUMERIC)`,
        })
        .from(trade)
        .where(and(...whereClauses))
        .orderBy(desc(trade.createdAt), desc(trade.id));

      const totalTradesCount = rows.length;

      return rows.map<ReportTrade>((row) => {
        const resolvedSymbol = symbolResolver.resolve(row.symbol || "");
        const direction: "long" | "short" =
          String(row.tradeType || "").toLowerCase() === "short" ||
          String(row.tradeType || "").toLowerCase() === "sell"
            ? "short"
            : "long";
        const openAt = row.openTime || parseNaiveAsUTC(row.openRaw) || row.createdAt;
        const closeAt = row.closeTime || parseNaiveAsUTC(row.closeRaw) || row.createdAt;
        const parsedDuration = row.holdSecondsRaw ? Number(row.holdSecondsRaw) : Number.NaN;
        const holdSeconds = Number.isFinite(parsedDuration)
          ? Math.max(0, Math.floor(parsedDuration))
          : Math.max(0, Math.floor((closeAt.getTime() - openAt.getTime()) / 1000));
        const account = accountMap.get(row.accountId);
        const baseTrade: TradeData = {
          id: row.id,
          symbol: resolvedSymbol.canonicalSymbol,
          tradeDirection: direction,
          entryPrice: Number(row.openPrice || 0),
          sl: row.sl != null ? Number(row.sl) : null,
          tp: row.tp != null ? Number(row.tp) : null,
          closePrice: row.closePrice != null ? Number(row.closePrice) : null,
          profit: Number(row.profit ?? 0),
          commissions: row.commissions != null ? Number(row.commissions) : null,
          swap: row.swap != null ? Number(row.swap) : null,
          volume: Number(row.volume ?? 0),
          manipulationHigh:
            row.manipulationHigh != null ? Number(row.manipulationHigh) : null,
          manipulationLow:
            row.manipulationLow != null ? Number(row.manipulationLow) : null,
          manipulationPips:
            row.manipulationPips != null ? Number(row.manipulationPips) : null,
          entryPeakPrice:
            row.entryPeakPrice != null ? Number(row.entryPeakPrice) : null,
          postExitPeakPrice:
            row.postExitPeakPrice != null ? Number(row.postExitPeakPrice) : null,
          alphaWeightedMpe:
            row.alphaWeightedMpe != null ? Number(row.alphaWeightedMpe) : 0.3,
          beThresholdPips:
            row.beThresholdPips != null
              ? Number(row.beThresholdPips)
              : account?.breakevenThresholdPips ?? DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
        };
        const advanced = calculateAllAdvancedMetrics(baseTrade, totalTradesCount);
        const sourceCurrency = account?.initialCurrency ?? null;
        const targetCurrency = filters.currencyCode ?? null;
        const profit = isAllAccountsScope(filters.accountId) && targetCurrency
          ? convertCurrencyAmount(
              Number(row.profit ?? 0),
              sourceCurrency,
              targetCurrency
            )
          : Number(row.profit ?? 0);
        const outcome = resolveStoredTradeOutcome({
          outcome: row.outcome,
          symbol: resolvedSymbol.canonicalSymbol,
          profit: row.profit,
          commissions: row.commissions,
          swap: row.swap,
          tp: row.tp,
          closePrice: row.closePrice,
          openPrice: row.openPrice,
          tradeType: row.tradeType,
          beThresholdPips:
            row.beThresholdPips ??
            account?.breakevenThresholdPips ??
            DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
        });

        return {
          id: row.id,
          accountId: row.accountId,
          openAt,
          closeAt,
          symbol: row.symbol || "",
          symbolGroup: resolvedSymbol.canonicalSymbol,
          direction,
          profit,
          volume: Number(row.volume ?? 0),
          holdSeconds,
          sessionTag: row.sessionTag || null,
          modelTag: row.modelTag || null,
          customTags: Array.isArray(row.customTags) ? row.customTags : [],
          protocolAlignment: row.protocolAlignment || null,
          outcome,
          plannedRR:
            row.plannedRR != null ? Number(row.plannedRR) : advanced.plannedRR,
          realisedRR:
            row.realisedRR != null ? Number(row.realisedRR) : advanced.realisedRR,
          mfePips: row.mfePips != null ? Number(row.mfePips) : advanced.mfePips,
          maePips: row.maePips != null ? Number(row.maePips) : advanced.maePips,
          rrCaptureEfficiency:
            row.rrCaptureEfficiency != null
              ? Number(row.rrCaptureEfficiency)
              : advanced.rrCaptureEfficiency,
          entrySlippagePips:
            row.entrySlippagePips != null ? Number(row.entrySlippagePips) : null,
          exitSlippagePips:
            row.exitSlippagePips != null ? Number(row.exitSlippagePips) : null,
        };
      });
    },
    {
      ttl: CacheTTL.SHORT,
      namespace: cacheNamespaces.ANALYTICS,
      tags: [cacheNamespaces.TRADES, ...Array.from(accountIdsForTags).map((id) => `account:${id}`)],
    }
  );

  return {
    trades: cached,
    timezone: filters.timezone || "UTC",
    targetCurrency: filters.currencyCode ?? null,
    accountIds: filteredAccountIds,
  };
}

async function loadDimensionRows(
  userId: string,
  filters: ReportFiltersInput,
  dimension: ReportDimensionId
) {
  const dataset = await loadReportTrades(userId, filters);
  const cacheKey = `${cacheNamespaces.ANALYTICS}:reports:dimension:${userId}:${encodeCachePart({
    filters: sanitizeFilters(filters),
    dimension,
  })}`;

  const rows = await enhancedCache.getOrLoad(
    cacheKey,
    async () => buildAggregateRows(dataset.trades, dimension, dataset.timezone),
    {
      ttl: CacheTTL.SHORT,
      namespace: cacheNamespaces.ANALYTICS,
      tags: [cacheNamespaces.TRADES, ...dataset.accountIds.map((id) => `account:${id}`)],
    }
  );

  return { ...dataset, rows };
}

export async function getReportsLensOverview(
  userId: string,
  input: ReportFiltersInput & {
    lens: ReportLensId;
    dimension: ReportDimensionId;
    drilldown: ReportDrilldownInput;
  }
) {
  const { trades, timezone } = await loadReportTrades(userId, input);
  const dimensionRows = buildAggregateRows(trades, input.dimension, timezone);
  const drilledTrades = applyDrilldown(trades, input.drilldown, timezone);
  const metrics = getOverviewMetrics(drilledTrades);
  const bestRow = dimensionRows
    .filter((row) => row.tradeCount > 0)
    .sort((left, right) => right.netPnl - left.netPnl)[0] ?? null;
  const weakestRow = dimensionRows
    .filter((row) => row.tradeCount > 0)
    .sort((left, right) => left.netPnl - right.netPnl)[0] ?? null;

  return {
    lens: input.lens,
    metrics,
    bestRow,
    weakestRow,
    activeDrilldown: input.drilldown
      ? {
          ...input.drilldown,
          label:
            dimensionRows.find((row) => row.key === input.drilldown?.value)?.label ??
            input.drilldown.value,
        }
      : null,
  };
}

export async function getReportsHeroChart(
  userId: string,
  input: ReportFiltersInput & {
    lens: ReportLensId;
    dimension: ReportDimensionId;
  }
) {
  const { rows } = await loadDimensionRows(userId, input, input.dimension);

  return {
    lens: input.lens,
    dimension: input.dimension,
    rows,
    allowedMetrics: REPORT_LENS_CONFIG[input.lens].allowedMetrics,
  };
}

export async function getReportsBreakdownTable(
  userId: string,
  input: ReportFiltersInput & {
    lens: ReportLensId;
    dimension: ReportDimensionId;
  }
) {
  const { rows } = await loadDimensionRows(userId, input, input.dimension);

  return {
    lens: input.lens,
    dimension: input.dimension,
    rows,
  };
}

export async function getReportsPanelData(
  userId: string,
  input: ReportFiltersInput & {
    lens: ReportLensId;
    panelId: ReportPanelId;
    drilldown: ReportDrilldownInput;
  }
) {
  const { trades, timezone } = await loadReportTrades(userId, input);
  const filteredTrades = applyDrilldown(trades, input.drilldown, timezone);

  switch (input.panelId) {
    case "equityCurve":
      return {
        panelId: input.panelId,
        kind: "timeseries" as const,
        primaryMetric: "netPnl" as const,
        rows: buildTimeSeriesFromTrades(filteredTrades, timezone).map((row) => ({
          label: row.label,
          primary: row.equity,
          secondary: row.profit,
        })),
      };
    case "drawdown":
      return {
        panelId: input.panelId,
        kind: "timeseries" as const,
        primaryMetric: "netPnl" as const,
        rows: buildDrawdownSeries(filteredTrades, timezone).map((row) => ({
          label: row.label,
          primary: row.value,
        })),
      };
    case "rollingPerformance":
      return {
        panelId: input.panelId,
        kind: "timeseries" as const,
        primaryMetric: "winRate" as const,
        secondaryMetric: "expectancy" as const,
        rows: buildRollingSeries(filteredTrades),
      };
    case "riskAdjusted":
    case "riskBalance":
      return {
        panelId: input.panelId,
        kind: "stat-grid" as const,
        stats: buildRiskAdjustedStats(filteredTrades),
      };
    case "dailyNet":
      return {
        panelId: input.panelId,
        kind: "timeseries" as const,
        primaryMetric: "netPnl" as const,
        rows: buildAggregateRows(filteredTrades, "date", timezone).map((row) => ({
          label: row.label,
          primary: row.netPnl,
          secondary: row.tradeCount,
        })),
      };
    case "weekdayPerformance":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "netPnl" as const,
        secondaryMetric: "winRate" as const,
        rows: buildAggregateRows(filteredTrades, "weekday", timezone).map((row) => ({
          label: row.label,
          primary: row.netPnl,
          secondary: row.winRate,
          tertiary: row.tradeCount,
        })),
      };
    case "performanceHeatmap":
      return {
        panelId: input.panelId,
        kind: "heatmap" as const,
        metric: "netPnl" as const,
        cells: buildMonthWeekdayHeatmap(filteredTrades, timezone),
      };
    case "entryExitWindow":
      return {
        panelId: input.panelId,
        kind: "heatmap" as const,
        metric: "tradeCount" as const,
        cells: buildEntryExitHeatmap(filteredTrades, timezone),
      };
    case "symbolBreakdown":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "netPnl" as const,
        secondaryMetric: "winRate" as const,
        rows: buildAggregateRows(filteredTrades, "symbol", timezone)
          .slice(0, 8)
          .map((row) => ({
            label: row.label,
            primary: row.netPnl,
            secondary: row.winRate,
            tertiary: row.tradeCount,
          })),
      };
    case "sessionBreakdown":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "netPnl" as const,
        secondaryMetric: "avgRR" as const,
        rows: buildAggregateRows(filteredTrades, "session", timezone)
          .slice(0, 8)
          .map((row) => ({
            label: row.label,
            primary: row.netPnl,
            secondary: row.avgRR,
            tertiary: row.tradeCount,
          })),
      };
    case "radarComparison":
      return {
        panelId: input.panelId,
        kind: "radar" as const,
        rows: buildRadarRows(filteredTrades, "model", timezone),
      };
    case "correlationMatrix":
      return {
        panelId: input.panelId,
        kind: "heatmap" as const,
        metric: "winRate" as const,
        cells: buildMatrixByDimensions(
          filteredTrades,
          "session",
          "symbol",
          timezone,
          "winRate"
        ),
      };
    case "rMultipleDistribution":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "tradeCount" as const,
        secondaryMetric: "netPnl" as const,
        rows: buildAggregateRows(filteredTrades, "realizedRBucket", timezone).map((row) => ({
          label: row.label,
          primary: row.tradeCount,
          secondary: row.netPnl,
          tertiary: row.avgRR,
        })),
      };
    case "bellCurve":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "tradeCount" as const,
        secondaryMetric: "netPnl" as const,
        rows: buildTradeDistributionByRange(
          filteredTrades,
          [
            { key: "deep-loss", label: "< -500", max: -500 },
            { key: "loss", label: "-500 to 0", min: -500, max: 0 },
            { key: "flat", label: "0 to 500", min: 0, max: 500 },
            { key: "good-win", label: "500 to 1500", min: 500, max: 1500 },
            { key: "big-win", label: "1500+", min: 1500 },
          ],
          (tradeRow) => tradeRow.profit
        ),
      };
    case "monteCarlo":
      return {
        panelId: input.panelId,
        kind: "monte-carlo" as const,
        ...buildMonteCarlo(filteredTrades),
      };
    case "maeMfeScatter":
      return {
        panelId: input.panelId,
        kind: "scatter" as const,
        xLabel: "MAE",
        yLabel: "MFE",
        points: filteredTrades
          .filter(
            (tradeRow) => tradeRow.maePips != null && tradeRow.mfePips != null
          )
          .slice(0, 250)
          .map<PanelScatterPoint>((tradeRow) => ({
            id: tradeRow.id,
            label: tradeRow.symbolGroup || tradeRow.symbol,
            x: Number(tradeRow.maePips ?? 0),
            y: Number(tradeRow.mfePips ?? 0),
            z: tradeRow.realisedRR,
            tone: getTone(tradeRow.profit),
          })),
      };
    case "holdBucket":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "avgRR" as const,
        secondaryMetric: "rrCaptureEfficiency" as const,
        rows: buildAggregateRows(filteredTrades, "holdBucket", timezone).map((row) => ({
          label: row.label,
          primary: row.avgRR ?? 0,
          secondary: row.rrCaptureEfficiency,
          tertiary: row.tradeCount,
        })),
      };
    case "slippageBreakdown":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "netPnl" as const,
        secondaryMetric: "avgRR" as const,
        rows: buildAggregateRows(filteredTrades, "slippageBucket", timezone).map((row) => ({
          label: row.label,
          primary: row.netPnl,
          secondary: row.avgRR,
          tertiary: row.tradeCount,
        })),
      };
    case "captureEfficiency":
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "tradeCount" as const,
        secondaryMetric: "winRate" as const,
        rows: buildAggregateRows(filteredTrades, "captureBucket", timezone).map((row) => ({
          label: row.label,
          primary: row.tradeCount,
          secondary: row.winRate,
          tertiary: row.avgRR,
        })),
      };
    default:
      return {
        panelId: input.panelId,
        kind: "ranked" as const,
        primaryMetric: "tradeCount" as const,
        rows: [],
      };
  }
}
