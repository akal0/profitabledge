"use client";

import { format } from "date-fns";
import type { Time } from "lightweight-charts";

import { defaultIndicatorSettings, type BacktestTimeframe, type BacktestTrade, type IndicatorSettings } from "./replay-domain";
import { type ReplaySimulationPayload } from "./replay-persistence";
import { normalizeReplaySimulationConfigCandidate } from "./replay-storage";

export const DEFAULT_REPLAY_START_DATE = "2024-01-02";
export const DEFAULT_REPLAY_END_DATE = "2024-03-01";

type ReplayTradeRecord = Record<string, unknown>;

type ReplaySessionRecord = {
  id: string;
  name: string;
  description?: string | null;
  symbol: string;
  timeframe: BacktestTimeframe | string;
  startDate?: string | null;
  endDate?: string | null;
  initialBalance?: number | string | null;
  riskPercent?: number | string | null;
  defaultSLPips?: number | null;
  defaultTPPips?: number | null;
  playbackSpeed?: number | string | null;
  indicatorConfig?: unknown;
  linkedRuleSetId?: string | null;
  lastCandleIndex?: number | null;
  workspaceState?: unknown;
  simulationConfig?: unknown;
  trades?: unknown;
};

export type ReplayConfigIdentity = {
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
};

export type ReplayLoadedSession = {
  sessionId: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  initialBalance: number;
  riskPercent: number;
  defaultSLPips: number;
  defaultTPPips: number;
  playbackSpeed: number;
  indicators: IndicatorSettings;
  linkedRuleSetId: string | null;
  simulationConfig: ReplaySimulationPayload;
  trades: BacktestTrade[];
  candleRequest: ReplayConfigIdentity & { savedIndex?: number };
  activeReplayConfig: string;
  savedSnapshot: string;
  workspaceState: unknown;
};

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toUnixTime(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Math.floor(new Date(value).getTime() / 1000);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toReplayDateInput(value: unknown, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return format(new Date(String(value)), "yyyy-MM-dd");
}

function toReplayDateIso(value: unknown, fallback: string): string {
  return value ? new Date(String(value)).toISOString() : new Date(fallback).toISOString();
}

function toReplayTimeframe(value: unknown): BacktestTimeframe {
  switch (value) {
    case "m1":
    case "m5":
    case "m15":
    case "m30":
    case "h1":
    case "h4":
    case "d1":
      return value;
    default:
      return "m5";
  }
}

function normalizeIndicatorSettingsCandidate(value: unknown): IndicatorSettings {
  if (!value || typeof value !== "object") {
    return defaultIndicatorSettings;
  }

  const candidate = value as Partial<IndicatorSettings>;

  return {
    sma1: { ...defaultIndicatorSettings.sma1, ...(candidate.sma1 || {}) },
    sma2: { ...defaultIndicatorSettings.sma2, ...(candidate.sma2 || {}) },
    ema1: { ...defaultIndicatorSettings.ema1, ...(candidate.ema1 || {}) },
    rsi: { ...defaultIndicatorSettings.rsi, ...(candidate.rsi || {}) },
    macd: { ...defaultIndicatorSettings.macd, ...(candidate.macd || {}) },
    bb: { ...defaultIndicatorSettings.bb, ...(candidate.bb || {}) },
    atr: { ...defaultIndicatorSettings.atr, ...(candidate.atr || {}) },
  };
}

function normalizeReplayTrade(trade: ReplayTradeRecord): BacktestTrade {
  const entryTimeUnix = toUnixTime(trade.entryTimeUnix) ?? toUnixTime(trade.entryTime) ?? 0;
  const exitTimeUnix = toUnixTime(trade.exitTimeUnix) ?? toUnixTime(trade.exitTime);

  return {
    id: String(trade.id ?? ""),
    direction: trade.direction === "short" ? "short" : "long",
    entryPrice: toFiniteNumber(trade.entryPrice, 0),
    entryTime: entryTimeUnix as Time,
    entryTimeUnix,
    exitPrice: toOptionalFiniteNumber(trade.exitPrice),
    exitTime: typeof exitTimeUnix === "number" ? (exitTimeUnix as Time) : undefined,
    exitTimeUnix,
    exitType: typeof trade.exitType === "string" ? trade.exitType : undefined,
    sl: toOptionalFiniteNumber(trade.sl),
    tp: toOptionalFiniteNumber(trade.tp),
    slPips: toOptionalFiniteNumber(trade.slPips),
    tpPips: toOptionalFiniteNumber(trade.tpPips),
    riskPercent: toOptionalFiniteNumber(trade.riskPercent),
    volume: toFiniteNumber(trade.volume, 0),
    pipValue: toOptionalFiniteNumber(trade.pipValue),
    status: trade.status === "closed" || trade.status === "stopped" || trade.status === "target"
      ? trade.status
      : "open",
    pnl: toOptionalFiniteNumber(trade.pnl),
    pnlPips: toOptionalFiniteNumber(trade.pnlPips),
    realizedRR: toOptionalFiniteNumber(trade.realizedRR),
    mfePips: toOptionalFiniteNumber(trade.mfePips),
    maePips: toOptionalFiniteNumber(trade.maePips),
    holdTimeSeconds:
      typeof trade.holdTimeSeconds === "number" ? trade.holdTimeSeconds : undefined,
    notes: typeof trade.notes === "string" ? trade.notes : undefined,
    tags: Array.isArray(trade.tags) ? (trade.tags as string[]) : undefined,
    entryBalance: toOptionalFiniteNumber(trade.entryBalance),
    fees: toOptionalFiniteNumber(trade.fees),
    commission: toOptionalFiniteNumber(trade.commission),
    swap: toOptionalFiniteNumber(trade.swap),
    entrySpreadPips: toOptionalFiniteNumber(trade.entrySpreadPips),
    entrySlippagePips: toOptionalFiniteNumber(trade.entrySlippagePips),
    exitSlippagePips: toOptionalFiniteNumber(trade.exitSlippagePips),
    slippagePrice: toOptionalFiniteNumber(trade.slippagePrice),
  };
}

export function normalizeReplayTrades(trades: unknown): BacktestTrade[] {
  if (!Array.isArray(trades)) {
    return [];
  }

  return trades.map((trade) => normalizeReplayTrade(trade as ReplayTradeRecord));
}

export function buildReplayTradeMetricIndex(
  trades: BacktestTrade[],
  metric: "mfePips" | "maePips"
): Record<string, number> {
  return trades.reduce<Record<string, number>>((result, trade) => {
    result[trade.id] = trade[metric] ?? 0;
    return result;
  }, {});
}

export function serializeReplayConfigIdentity(config: ReplayConfigIdentity): string {
  return JSON.stringify(config);
}

export function parseReplayConfigIdentity(
  value: string | null
): ReplayConfigIdentity | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as ReplayConfigIdentity;
  } catch {
    return null;
  }
}

export function normalizeReplaySessionRecord(
  session: ReplaySessionRecord
): ReplayLoadedSession {
  const startDate = toReplayDateInput(session.startDate, DEFAULT_REPLAY_START_DATE);
  const endDate = toReplayDateInput(session.endDate, DEFAULT_REPLAY_END_DATE);
  const trades = normalizeReplayTrades(session.trades);
  const timeframe = toReplayTimeframe(session.timeframe);
  const replayConfig = {
    symbol: session.symbol,
    timeframe,
    startDate,
    endDate,
  } satisfies ReplayConfigIdentity;

  return {
    sessionId: session.id,
    name: session.name,
    description: session.description || "",
    symbol: session.symbol,
    timeframe,
    startDate,
    endDate,
    initialBalance: toFiniteNumber(session.initialBalance, 10000),
    riskPercent: toFiniteNumber(session.riskPercent, 1),
    defaultSLPips: toFiniteNumber(session.defaultSLPips, 20),
    defaultTPPips: toFiniteNumber(session.defaultTPPips, 40),
    playbackSpeed: toFiniteNumber(session.playbackSpeed, 1),
    indicators: normalizeIndicatorSettingsCandidate(session.indicatorConfig),
    linkedRuleSetId:
      typeof session.linkedRuleSetId === "string" ? session.linkedRuleSetId : null,
    simulationConfig: normalizeReplaySimulationConfigCandidate(session.simulationConfig),
    trades,
    candleRequest: {
      ...replayConfig,
      savedIndex: session.lastCandleIndex ?? undefined,
    },
    activeReplayConfig: serializeReplayConfigIdentity(replayConfig),
    savedSnapshot: JSON.stringify({
      name: session.name,
      description: session.description || "",
      symbol: session.symbol,
      timeframe: session.timeframe,
      startDate: toReplayDateIso(session.startDate, DEFAULT_REPLAY_START_DATE),
      endDate: toReplayDateIso(session.endDate, DEFAULT_REPLAY_END_DATE),
      currentIndex: session.lastCandleIndex ?? 0,
      playbackSpeed: toFiniteNumber(session.playbackSpeed, 1),
      indicatorConfig: session.indicatorConfig || defaultIndicatorSettings,
      riskPercent: toFiniteNumber(session.riskPercent, 1),
      defaultSLPips: toFiniteNumber(session.defaultSLPips, 20),
      defaultTPPips: toFiniteNumber(session.defaultTPPips, 40),
      linkedRuleSetId:
        typeof session.linkedRuleSetId === "string" ? session.linkedRuleSetId : null,
      workspaceState: session.workspaceState ?? null,
      simulationConfig: session.simulationConfig ?? null,
    }),
    workspaceState: session.workspaceState ?? null,
  };
}
