"use client";

import type { Time } from "lightweight-charts";

import type { CandleData } from "@/components/charts/trading-view-chart";

import {
  CONTEXT_DOCK_SLOTS,
  DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  LAST_CONTEXT_CANDLE_COUNT,
  TIMEFRAMES,
  TIMEFRAME_TO_SECONDS,
  type BacktestPendingOrder,
  type BacktestTimeframe,
  type BacktestTrade,
  type ContextDockSlot,
  type ContextPaneMode,
  type ContextPanePosition,
  type FavoriteToolsBarOffset,
  type ReplayNewsEvent,
  type ReplayPatternTemplate,
  type TimeInForce,
} from "./replay-domain";

export function getBarMagnifierTimeframe(
  timeframe: BacktestTimeframe
): BacktestTimeframe | null {
  if (timeframe === "m1") return null;
  if (timeframe === "m5" || timeframe === "m15") return "m1";
  if (timeframe === "m30" || timeframe === "h1") return "m5";
  if (timeframe === "h4") return "m15";
  return "h1";
}

export function getPipSize(symbol: string) {
  const normalized = symbol.toLowerCase();
  if (normalized.includes("jpy")) return 0.01;
  if (normalized.includes("xau")) return 0.01;
  return 0.0001;
}

export function round(value: number, places = 2) {
  return Number(value.toFixed(places));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getEntryUnix(trade: BacktestTrade) {
  return trade.entryTimeUnix ?? (trade.entryTime as number);
}

export function getExitUnix(trade: BacktestTrade) {
  if (trade.exitTimeUnix) return trade.exitTimeUnix;
  if (typeof trade.exitTime === "number") return trade.exitTime;
  return undefined;
}

export function formatPrice(symbol: string, price: number) {
  return price.toFixed(symbol.includes("JPY") || symbol.includes("XAU") ? 3 : 5);
}

export function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

export function formatSignedPrice(value: number, decimals: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(decimals)}`;
}

export function formatSignedPips(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)} pips`;
}

export function formatHoldTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function getSymbolDisplayName(symbol: string) {
  const names: Record<string, string> = {
    EURUSD: "Euro / U.S. Dollar",
    GBPUSD: "British Pound / U.S. Dollar",
    USDJPY: "U.S. Dollar / Japanese Yen",
    AUDUSD: "Australian Dollar / U.S. Dollar",
    USDCAD: "U.S. Dollar / Canadian Dollar",
    NZDUSD: "New Zealand Dollar / U.S. Dollar",
    USDCHF: "U.S. Dollar / Swiss Franc",
    EURGBP: "Euro / British Pound",
    EURJPY: "Euro / Japanese Yen",
    GBPJPY: "British Pound / Japanese Yen",
    XAUUSD: "Gold Spot / U.S. Dollar",
  };

  return names[symbol] ?? symbol;
}

export function getTimeframeCompactLabel(timeframe: BacktestTimeframe) {
  const labels: Record<BacktestTimeframe, string> = {
    m1: "1m",
    m5: "5m",
    m15: "15m",
    m30: "30m",
    h1: "1h",
    h4: "4h",
    d1: "D",
  };

  return labels[timeframe];
}

export function getDefaultContextTimeframes(
  timeframe: BacktestTimeframe
): BacktestTimeframe[] {
  const map: Record<BacktestTimeframe, BacktestTimeframe[]> = {
    m1: ["m5", "m15"],
    m5: ["m15", "h1"],
    m15: ["h1", "h4"],
    m30: ["h1", "h4"],
    h1: ["h4", "d1"],
    h4: ["d1"],
    d1: [],
  };

  return map[timeframe];
}

export function isBacktestTimeframe(value: unknown): value is BacktestTimeframe {
  return TIMEFRAMES.some((item) => item.value === value);
}

export function getDefaultContextPanePosition(index: number): ContextPanePosition {
  return {
    x: 0,
    y: -(index * 158),
  };
}

export function sanitizeContextPanePositions(
  value: unknown
): Partial<Record<BacktestTimeframe, ContextPanePosition>> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([timeframe, position]) => {
      if (!isBacktestTimeframe(timeframe) || !position || typeof position !== "object") {
        return [];
      }

      const maybeX = (position as { x?: unknown }).x;
      const maybeY = (position as { y?: unknown }).y;

      if (typeof maybeX !== "number" || typeof maybeY !== "number") {
        return [];
      }

      return [[timeframe, { x: maybeX, y: maybeY } satisfies ContextPanePosition] as const];
    })
  );
}

export function sanitizeFavoriteToolsBarOffset(
  value: unknown
): FavoriteToolsBarOffset {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET };
  }

  const candidate = value as { x?: unknown; y?: unknown };

  return {
    x: Number.isFinite(candidate.x)
      ? Number(candidate.x)
      : DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.x,
    y: Number.isFinite(candidate.y)
      ? Number(candidate.y)
      : DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.y,
  };
}

export function sanitizeContextPaneModes(
  value: unknown
): Partial<Record<BacktestTimeframe, ContextPaneMode>> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([timeframe, mode]) => {
      if (
        !isBacktestTimeframe(timeframe) ||
        (mode !== "last" && mode !== "recent" && mode !== "full")
      ) {
        return [];
      }

      return [[timeframe, mode] as const];
    })
  );
}

export function sanitizeContextDockAssignments(
  value: unknown
): Partial<Record<BacktestTimeframe, ContextDockSlot>> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([timeframe, slot]) => {
      const normalizedSlot = slot === "left" ? "left-top" : slot;
      if (
        !isBacktestTimeframe(timeframe) ||
        !CONTEXT_DOCK_SLOTS.includes(normalizedSlot as ContextDockSlot)
      ) {
        return [];
      }

      return [[timeframe, normalizedSlot as ContextDockSlot] as const];
    })
  );
}

export function buildContextDockAssignments(
  timeframes: BacktestTimeframe[],
  previous: Partial<Record<BacktestTimeframe, ContextDockSlot>>
) {
  const next: Partial<Record<BacktestTimeframe, ContextDockSlot>> = {};
  const usedSlots = new Set<ContextDockSlot>();

  timeframes.forEach((timeframe) => {
    const slot = previous[timeframe];
    if (slot && !usedSlots.has(slot)) {
      next[timeframe] = slot;
      usedSlots.add(slot);
    }
  });

  timeframes.forEach((timeframe) => {
    if (next[timeframe]) return;
    const freeSlot = CONTEXT_DOCK_SLOTS.find((slot) => !usedSlots.has(slot));
    if (!freeSlot) return;
    next[timeframe] = freeSlot;
    usedSlots.add(freeSlot);
  });

  return next;
}

export function areContextDockAssignmentsEqual(
  left: Partial<Record<BacktestTimeframe, ContextDockSlot>>,
  right: Partial<Record<BacktestTimeframe, ContextDockSlot>>
) {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([timeframe, slot], index) => {
    const [otherTimeframe, otherSlot] = rightEntries[index] ?? [];
    return timeframe === otherTimeframe && slot === otherSlot;
  });
}

export function getContextPaneModeLabel(mode: ContextPaneMode) {
  if (mode === "last") return `Last ${LAST_CONTEXT_CANDLE_COUNT}`;
  if (mode === "recent") return "Recent";
  return "Full";
}

export function getNextContextPaneMode(mode: ContextPaneMode): ContextPaneMode {
  if (mode === "last") return "recent";
  if (mode === "recent") return "full";
  return "last";
}

export function toDateTimeLocalValue(value?: Time | number | null) {
  if (!value) return "";
  const date = new Date((Number(value) || 0) * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function nearestCandleIndex(candles: CandleData[], targetUnix: number) {
  if (!candles.length) return 0;
  let bestIndex = 0;
  let bestDiff = Infinity;
  candles.forEach((candle, index) => {
    const diff = Math.abs((candle.time as number) - targetUnix);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function getDrawingStorageKey(sessionId: string) {
  return `backtest-drawings:${sessionId}`;
}

export function getWorkspaceStorageKey(sessionId: string) {
  return `backtest-workspace:${sessionId}`;
}

export function getPendingOrdersStorageKey(sessionId: string) {
  return `backtest-pending-orders:${sessionId}`;
}

export function getCheckpointStorageKey(sessionId: string) {
  return `backtest-checkpoints:${sessionId}`;
}

export function getSessionTagFromUnix(timeUnix: number) {
  const hour = new Date(timeUnix * 1000).getUTCHours();
  if (hour >= 13 && hour < 16) return "London / New York";
  if (hour >= 7 && hour < 12) return "London";
  if (hour >= 12 && hour < 20) return "New York";
  if (hour >= 0 && hour < 6) return "Asia";
  return "Core";
}

export function extractScopedTag(tags: string[] | undefined, prefix: string) {
  const match = tags?.find((tag) => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function getTimeInForceExpiryUnix(
  createdAtUnix: number,
  timeInForce: TimeInForce
) {
  if (timeInForce === "day") return createdAtUnix + 60 * 60 * 24;
  if (timeInForce === "week") return createdAtUnix + 60 * 60 * 24 * 7;
  return undefined;
}

export function parseUnitsInput(value: string) {
  const sanitized = value.replaceAll(",", "").trim();
  if (!sanitized) return Number.NaN;
  return Number(sanitized);
}

export function recalculatePendingOrderRisk(
  order: BacktestPendingOrder,
  pipSize: number
) {
  return {
    ...order,
    slPips:
      typeof order.sl === "number"
        ? Math.abs((order.sl - order.entryPrice) / pipSize)
        : undefined,
    tpPips:
      typeof order.tp === "number"
        ? Math.abs((order.tp - order.entryPrice) / pipSize)
        : undefined,
  };
}

export function getSymbolExecutionProfile(symbol: string) {
  if (symbol.includes("XAU")) {
    return {
      baseSpread: 0.3,
      sessionLiquidityUnits: 250000,
      slippagePips: 2.5,
      commissionPerLot: 7,
      swapPerDayPerLot: 4.5,
    };
  }

  return {
    baseSpread: symbol.includes("JPY") ? 0.012 : 0.00012,
    sessionLiquidityUnits: 900000,
    slippagePips: symbol.includes("JPY") ? 0.45 : 0.35,
    commissionPerLot: 7,
    swapPerDayPerLot: 3.25,
  };
}

export function getSessionExecutionMultiplier(timeUnix: number) {
  const utcHour = new Date(timeUnix * 1000).getUTCHours();
  if (utcHour >= 7 && utcHour < 10) {
    return { spread: 0.9, slippage: 0.85, liquidity: 1.35, session: "London open" };
  }
  if (utcHour >= 12 && utcHour < 16) {
    return {
      spread: 0.95,
      slippage: 0.9,
      liquidity: 1.4,
      session: "New York overlap",
    };
  }
  if (utcHour >= 21 || utcHour < 1) {
    return { spread: 1.8, slippage: 1.65, liquidity: 0.55, session: "Rollover" };
  }
  if (utcHour >= 0 && utcHour < 6) {
    return { spread: 1.2, slippage: 1.15, liquidity: 0.85, session: "Asia" };
  }
  return { spread: 1, slippage: 1, liquidity: 1, session: "Core" };
}

export function getEventImpactMultiplier(
  events: ReplayNewsEvent[],
  timeUnix: number
) {
  const nearby = events.filter((event) => Math.abs(event.timeUnix - timeUnix) <= 45 * 60);
  if (nearby.some((event) => event.impact === "High")) {
    return { spread: 1.75, slippage: 2.1, liquidity: 0.6, event: "High-impact news" };
  }
  if (nearby.some((event) => event.impact === "Medium")) {
    return {
      spread: 1.25,
      slippage: 1.35,
      liquidity: 0.85,
      event: "Medium-impact news",
    };
  }
  return { spread: 1, slippage: 1, liquidity: 1, event: null };
}

export function getIntrabarPath(candle: CandleData) {
  const bullish = candle.close >= candle.open;
  return bullish
    ? [candle.open, candle.low, candle.high, candle.close]
    : [candle.open, candle.high, candle.low, candle.close];
}

export function getIntrabarTraceForCandle(
  candle: CandleData,
  timeframe: BacktestTimeframe,
  lowerTimeframeCandles: CandleData[]
) {
  if (!lowerTimeframeCandles.length) {
    return getIntrabarPath(candle);
  }

  const candleOpenUnix = Number(candle.time);
  const candleCloseUnix = candleOpenUnix + TIMEFRAME_TO_SECONDS[timeframe];
  const subCandles = lowerTimeframeCandles.filter((item) => {
    const timeUnix = Number(item.time);
    return timeUnix >= candleOpenUnix && timeUnix < candleCloseUnix;
  });

  if (!subCandles.length) {
    return getIntrabarPath(candle);
  }

  return subCandles.flatMap((item, index) => {
    const path = getIntrabarPath(item);
    return index === 0 ? path : path.slice(1);
  });
}

export function segmentCrossesPrice(start: number, end: number, target: number) {
  return target >= Math.min(start, end) && target <= Math.max(start, end);
}

export function getFirstPathHitIndex(path: number[], target: number) {
  for (let index = 0; index < path.length - 1; index += 1) {
    if (segmentCrossesPrice(path[index]!, path[index + 1]!, target)) {
      return index;
    }
  }
  return null;
}

export function resolvePathHitOrder(
  path: number[],
  levels: Array<{ key: string; price: number }>
) {
  return levels
    .map((level) => ({
      ...level,
      hitIndex: getFirstPathHitIndex(path, level.price),
    }))
    .filter(
      (level): level is { key: string; price: number; hitIndex: number } =>
        level.hitIndex !== null
    )
    .sort((a, b) => a.hitIndex - b.hitIndex);
}

export function getSwapDays(entryUnix: number, exitUnix: number) {
  if (exitUnix <= entryUnix) return 0;
  return Math.max(0, Math.floor((exitUnix - entryUnix) / (60 * 60 * 24)));
}

export function buildPatternFeatureVector(
  candles: CandleData[],
  index: number,
  pipSize: number
): ReplayPatternTemplate["featureVector"] | null {
  const window = candles.slice(Math.max(0, index - 3), index + 1);
  if (window.length === 0) return null;

  const highs = window.map((item) => item.high);
  const lows = window.map((item) => item.low);
  const range = Math.max(...highs) - Math.min(...lows);
  const anchor = window[0]!;
  const current = window[window.length - 1]!;
  const impulse = current.close - anchor.open;
  const closeLocation = range > 0 ? (current.close - Math.min(...lows)) / range : 0.5;
  const body = current.close - current.open;

  return {
    direction: impulse >= 0 ? "bullish" : "bearish",
    impulsePips: impulse / pipSize,
    rangePips: range / pipSize,
    closeLocation: clamp(closeLocation, 0, 1),
    bodyPips: Math.abs(body / pipSize),
  };
}

export function getPatternSimilarityScore(
  base: ReplayPatternTemplate["featureVector"],
  candidate: ReplayPatternTemplate["featureVector"]
) {
  const directionScore = base.direction === candidate.direction ? 1 : 0;
  const impulseScore =
    1 - Math.min(1, Math.abs(base.impulsePips - candidate.impulsePips) / 45);
  const rangeScore =
    1 - Math.min(1, Math.abs(base.rangePips - candidate.rangePips) / 55);
  const closeLocationScore =
    1 - Math.min(1, Math.abs(base.closeLocation - candidate.closeLocation) / 0.6);
  const bodyScore = 1 - Math.min(1, Math.abs(base.bodyPips - candidate.bodyPips) / 30);

  return clamp(
    directionScore * 0.3 +
      impulseScore * 0.25 +
      rangeScore * 0.2 +
      closeLocationScore * 0.15 +
      bodyScore * 0.1,
    0,
    1
  );
}
