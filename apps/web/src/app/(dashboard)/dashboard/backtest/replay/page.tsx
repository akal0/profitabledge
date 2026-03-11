"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import type { Time } from "lightweight-charts";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookmarkPlus,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Copy,
  GripVertical,
  Loader2,
  MessageSquare,
  Minus,
  MoveRight,
  MousePointer2,
  Pause,
  Play,
  Ruler,
  Save,
  SkipBack,
  SkipForward,
  Slash,
  Square,
  Target,
  Trash2,
  X,
} from "lucide-react";

import {
  TradingViewChart,
  type AnnotationTool,
  type CandleData,
  type ChartAnnotation,
  type ExecutionOverlay,
  type ExecutionOverlayLevelKey,
  type IndicatorLine,
  type PriceLine,
  type TradeMarker,
} from "@/components/charts/trading-view-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { atr, bollingerBands, ema, macd, rsi, sma } from "@/lib/indicators";
import { cn } from "@/lib/utils";
import { trpcClient } from "@/utils/trpc";
import { toast } from "sonner";

const SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "USDCHF",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "XAUUSD",
];

const TIMEFRAMES = [
  { value: "m1", label: "1 min" },
  { value: "m5", label: "5 min" },
  { value: "m15", label: "15 min" },
  { value: "m30", label: "30 min" },
  { value: "h1", label: "1 hour" },
  { value: "h4", label: "4 hour" },
  { value: "d1", label: "Daily" },
] as const;

const PLAYBACK_SPEEDS = [1, 2, 3, 4] as const;
const LAST_CONTEXT_CANDLE_COUNT = 4;
const DEFAULT_FAVORITE_TOOLS_BAR_OFFSET = { x: 0, y: 0 } as const;
const CONTEXT_DOCK_SLOTS = [
  "right-top",
  "right-bottom",
  "left-top",
  "left-bottom",
  "top",
  "bottom",
] as const;

type BacktestTimeframe = (typeof TIMEFRAMES)[number]["value"];
type TradeStatus = "open" | "closed" | "stopped" | "target";
type TimeInForce = "day" | "week" | "gtc";
type LayoutPreset = "execution" | "chart-only" | "review" | "coach";
type WorkspaceTab = "positions" | "history" | "review";
type ContextPanePosition = { x: number; y: number };
type FavoriteToolsBarOffset = { x: number; y: number };
type ContextPaneMode = "last" | "recent" | "full";
type ContextDockSlot = (typeof CONTEXT_DOCK_SLOTS)[number];
type IntrabarMode = "candle-path" | "bar-magnifier";
type ReviewPlaybackMode = "manual" | "events";

interface ContextPaneSeriesItem {
  timeframe: BacktestTimeframe;
  label: string;
  mode: ContextPaneMode;
  candles: CandleData[];
}

interface BacktestTrade {
  id: string;
  direction: "long" | "short";
  entryPrice: number;
  entryTime: Time;
  entryTimeUnix?: number;
  exitPrice?: number;
  exitTime?: Time;
  exitTimeUnix?: number;
  exitType?: string;
  sl?: number;
  tp?: number;
  slPips?: number;
  tpPips?: number;
  riskPercent?: number;
  volume: number;
  pipValue?: number;
  status: TradeStatus;
  pnl?: number;
  pnlPips?: number;
  realizedRR?: number;
  mfePips?: number;
  maePips?: number;
  holdTimeSeconds?: number;
  notes?: string;
  tags?: string[];
  entryBalance?: number;
  fees?: number;
  commission?: number;
  swap?: number;
  entrySpreadPips?: number;
  entrySlippagePips?: number;
  exitSlippagePips?: number;
  slippagePrice?: number;
}

interface BacktestPendingOrder {
  id: string;
  direction: "long" | "short";
  orderType: "limit" | "stop" | "stop-limit";
  entryPrice: number;
  triggerPrice?: number;
  createdAt: Time;
  createdAtUnix: number;
  expiresAtUnix?: number;
  timeInForce: TimeInForce;
  activatedAtUnix?: number;
  filledAtUnix?: number;
  filledTradeId?: string;
  fillTradeIds?: string[];
  cancelledAtUnix?: number;
  cancelReason?: "manual" | "expired";
  sl?: number;
  tp?: number;
  slPips?: number;
  tpPips?: number;
  riskPercent?: number;
  volume: number;
  units: number;
  remainingUnits?: number;
  linkedOcoGroupId?: string;
  notes?: string;
  tags?: string[];
}

interface ReplayCheckpoint {
  id: string;
  label: string;
  timeUnix: number;
  createdAtUnix: number;
}

interface ReplayNewsEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  timeUnix: number;
  impact: "Low" | "Medium" | "High" | "Holiday";
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
}

interface ReplayTimelineEvent {
  id: string;
  type: "checkpoint" | "trade-entry" | "trade-exit" | "news" | "drawdown" | "mistake";
  label: string;
  helper: string;
  timeUnix: number;
  tone: "positive" | "negative" | "neutral";
  tradeId?: string;
}

interface ReplayMistake {
  id: string;
  type:
    | "poor-rr"
    | "no-invalidation"
    | "oversized-risk"
    | "revenge-cluster"
    | "overtrading-window"
    | "late-entry";
  title: string;
  detail: string;
  timeUnix: number;
  tradeId?: string;
  severity: "high" | "medium" | "low";
}

interface ReplayPatternTemplate {
  id: string;
  name: string;
  createdAtUnix: number;
  anchorTimeUnix: number;
  symbol: string;
  timeframe: BacktestTimeframe;
  note?: string;
  featureVector: {
    direction: "bullish" | "bearish";
    impulsePips: number;
    rangePips: number;
    closeLocation: number;
    bodyPips: number;
  };
}

interface ReplayPatternMatch {
  patternId: string;
  timeUnix: number;
  score: number;
}

interface ReplaySharedSnapshot {
  id: string;
  label: string;
  createdAtUnix: number;
  timeUnix: number;
  currentIndex: number;
  layoutPreset: LayoutPreset;
  workspaceTab: WorkspaceTab;
  selectedContextTimeframes: BacktestTimeframe[];
  contextPanePositions: Partial<Record<BacktestTimeframe, ContextPanePosition>>;
  contextDockAssignments: Partial<Record<BacktestTimeframe, ContextDockSlot>>;
  contextPaneModes: Partial<Record<BacktestTimeframe, ContextPaneMode>>;
  annotations: ChartAnnotation[];
}

interface ReplayWorkspaceState {
  annotations?: ChartAnnotation[];
  pendingOrders?: BacktestPendingOrder[];
  checkpoints?: ReplayCheckpoint[];
  workspaceTab?: WorkspaceTab;
  orderTicketTab?: "order" | "dom";
  showBottomPanel?: boolean;
  showRightPanel?: boolean;
  showDrawingRail?: boolean;
  showFavoriteToolsBar?: boolean;
  selectedContextTimeframes?: BacktestTimeframe[];
  contextPanePositions?: Partial<Record<BacktestTimeframe, ContextPanePosition>>;
  contextPaneModes?: Partial<Record<BacktestTimeframe, ContextPaneMode>>;
  contextDockAssignments?: Partial<Record<BacktestTimeframe, ContextDockSlot>>;
  favoriteToolsBarOffset?: FavoriteToolsBarOffset;
  layoutPreset?: LayoutPreset;
  chartOrderSide?: "long" | "short" | null;
  entryMode?: "market" | "limit" | "stop" | "stop-limit";
  ticketPrice?: string;
  ticketSecondaryPrice?: string;
  ticketUnits?: string;
  timeInForce?: TimeInForce;
  ocoEnabled?: boolean;
  showSLTP?: boolean;
  annotationTool?: AnnotationTool;
  annotationColor?: string;
  annotationLabel?: string;
  reviewPlaybackMode?: ReviewPlaybackMode;
  ruleSetId?: string | null;
  patternLibrary?: ReplayPatternTemplate[];
  sharedSnapshots?: ReplaySharedSnapshot[];
}

interface ReplaySimulationConfig {
  intrabarMode: IntrabarMode;
  hideUpcomingHighImpactNews: boolean;
}

interface RuleSetOption {
  id: string;
  name: string;
  description?: string | null;
}

interface RulebookCoachingSummary {
  totalTrades: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  complianceRate: number;
  averageScore: number;
  topViolations: Array<{ violation: string; count: number }>;
}

interface RulebookCoachingEvaluation {
  tradeId: string;
  entryTimeUnix: number;
  status: "pass" | "partial" | "fail";
  score: number;
  sessionTag: string | null;
  modelTag: string | null;
  violations: string[];
  pnl: number | null;
  realizedRR: number | null;
}

interface RulebookCoachingResult {
  ruleSet: RuleSetOption | null;
  summary: RulebookCoachingSummary | null;
  evaluations: RulebookCoachingEvaluation[];
}

interface MonteCarloResult {
  simulations: number;
  tradeCount: number;
  finalEquity: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    mean: number;
  };
  maxDrawdown: {
    p5: number;
    p50: number;
    p95: number;
  };
  probabilities: {
    profitableAfter: number;
    doubleAccount: number;
    drawdownExceeds10: number;
    drawdownExceeds20: number;
    drawdownExceeds50: number;
  };
  kellyCriterion: number;
  halfKelly: number;
}

interface IndicatorSettings {
  sma1: { enabled: boolean; period: number; color: string };
  sma2: { enabled: boolean; period: number; color: string };
  ema1: { enabled: boolean; period: number; color: string };
  rsi: { enabled: boolean; period: number };
  macd: { enabled: boolean; fastPeriod: number; slowPeriod: number; signalPeriod: number };
  bb: { enabled: boolean; period: number; stdDev: number };
  atr: { enabled: boolean; period: number };
}

type ChallengePresetId = "none" | "prop" | "sprint";

interface ChallengeConfig {
  profitTargetPct: number;
  maxDrawdownPct: number;
  dailyLossPct: number;
  minTrades: number;
  enforce: boolean;
}

const defaultIndicatorSettings: IndicatorSettings = {
  sma1: { enabled: true, period: 20, color: "#FBBF24" },
  sma2: { enabled: false, period: 50, color: "#38BDF8" },
  ema1: { enabled: false, period: 21, color: "#F472B6" },
  rsi: { enabled: false, period: 14 },
  macd: { enabled: false, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bb: { enabled: false, period: 20, stdDev: 2 },
  atr: { enabled: false, period: 14 },
};

const CHALLENGE_PRESETS: Record<ChallengePresetId, ChallengeConfig & { label: string; description: string }> = {
  none: {
    label: "Free Replay",
    description: "No challenge guardrails. Pure discretionary practice.",
    profitTargetPct: 0,
    maxDrawdownPct: 0,
    dailyLossPct: 0,
    minTrades: 0,
    enforce: false,
  },
  prop: {
    label: "Prop Standard",
    description: "Classic challenge profile with daily loss and overall drawdown pressure.",
    profitTargetPct: 8,
    maxDrawdownPct: 10,
    dailyLossPct: 5,
    minTrades: 8,
    enforce: true,
  },
  sprint: {
    label: "Discipline Sprint",
    description: "Tighter rules for cleaner execution and fewer impulse trades.",
    profitTargetPct: 5,
    maxDrawdownPct: 6,
    dailyLossPct: 3,
    minTrades: 6,
    enforce: true,
  },
};

const defaultSimulationConfig: ReplaySimulationConfig = {
  intrabarMode: "candle-path",
  hideUpcomingHighImpactNews: true,
};

const TIMEFRAME_TO_SECONDS: Record<BacktestTimeframe, number> = {
  m1: 60,
  m5: 60 * 5,
  m15: 60 * 15,
  m30: 60 * 30,
  h1: 60 * 60,
  h4: 60 * 60 * 4,
  d1: 60 * 60 * 24,
};

function getBarMagnifierTimeframe(timeframe: BacktestTimeframe): BacktestTimeframe | null {
  if (timeframe === "m1") return null;
  if (timeframe === "m5" || timeframe === "m15") return "m1";
  if (timeframe === "m30" || timeframe === "h1") return "m5";
  if (timeframe === "h4") return "m15";
  return "h1";
}

function getPipSize(symbol: string) {
  const normalized = symbol.toLowerCase();
  if (normalized.includes("jpy")) return 0.01;
  if (normalized.includes("xau")) return 0.01;
  return 0.0001;
}

function round(value: number, places = 2) {
  return Number(value.toFixed(places));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getEntryUnix(trade: BacktestTrade) {
  return trade.entryTimeUnix ?? (trade.entryTime as number);
}

function getExitUnix(trade: BacktestTrade) {
  if (trade.exitTimeUnix) return trade.exitTimeUnix;
  if (typeof trade.exitTime === "number") return trade.exitTime;
  return undefined;
}

function formatPrice(symbol: string, price: number) {
  return price.toFixed(symbol.includes("JPY") || symbol.includes("XAU") ? 3 : 5);
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

function formatSignedPrice(value: number, decimals: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(decimals)}`;
}

function formatSignedPips(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)} pips`;
}

function formatHoldTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function getSymbolDisplayName(symbol: string) {
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

function getTimeframeCompactLabel(timeframe: BacktestTimeframe) {
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

function getDefaultContextTimeframes(timeframe: BacktestTimeframe): BacktestTimeframe[] {
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

function isBacktestTimeframe(value: unknown): value is BacktestTimeframe {
  return TIMEFRAMES.some((item) => item.value === value);
}

function getDefaultContextPanePosition(index: number): ContextPanePosition {
  return {
    x: 0,
    y: -(index * 158),
  };
}

function sanitizeContextPanePositions(
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

function sanitizeFavoriteToolsBarOffset(value: unknown): FavoriteToolsBarOffset {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET };
  }

  const candidate = value as { x?: unknown; y?: unknown };

  return {
    x: Number.isFinite(candidate.x) ? Number(candidate.x) : DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.x,
    y: Number.isFinite(candidate.y) ? Number(candidate.y) : DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.y,
  };
}

function sanitizeContextPaneModes(value: unknown): Partial<Record<BacktestTimeframe, ContextPaneMode>> {
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

function sanitizeContextDockAssignments(
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

function buildContextDockAssignments(
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

function areContextDockAssignmentsEqual(
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

function getContextPaneModeLabel(mode: ContextPaneMode) {
  if (mode === "last") return `Last ${LAST_CONTEXT_CANDLE_COUNT}`;
  if (mode === "recent") return "Recent";
  return "Full";
}

function getNextContextPaneMode(mode: ContextPaneMode): ContextPaneMode {
  if (mode === "last") return "recent";
  if (mode === "recent") return "full";
  return "last";
}

function toDateTimeLocalValue(value?: Time | number | null) {
  if (!value) return "";
  const date = new Date((Number(value) || 0) * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function nearestCandleIndex(candles: CandleData[], targetUnix: number) {
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

function getDrawingStorageKey(sessionId: string) {
  return `backtest-drawings:${sessionId}`;
}

function getWorkspaceStorageKey(sessionId: string) {
  return `backtest-workspace:${sessionId}`;
}

function getPendingOrdersStorageKey(sessionId: string) {
  return `backtest-pending-orders:${sessionId}`;
}

function getCheckpointStorageKey(sessionId: string) {
  return `backtest-checkpoints:${sessionId}`;
}

function getSessionTagFromUnix(timeUnix: number) {
  const hour = new Date(timeUnix * 1000).getUTCHours();
  if (hour >= 13 && hour < 16) return "London / New York";
  if (hour >= 7 && hour < 12) return "London";
  if (hour >= 12 && hour < 20) return "New York";
  if (hour >= 0 && hour < 6) return "Asia";
  return "Core";
}

function extractScopedTag(tags: string[] | undefined, prefix: string) {
  const match = tags?.find((tag) => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function getTimeInForceExpiryUnix(createdAtUnix: number, timeInForce: TimeInForce) {
  if (timeInForce === "day") return createdAtUnix + 60 * 60 * 24;
  if (timeInForce === "week") return createdAtUnix + 60 * 60 * 24 * 7;
  return undefined;
}

function parseUnitsInput(value: string) {
  const sanitized = value.replaceAll(",", "").trim();
  if (!sanitized) return Number.NaN;
  return Number(sanitized);
}

function recalculatePendingOrderRisk(order: BacktestPendingOrder, pipSize: number) {
  return {
    ...order,
    slPips:
      typeof order.sl === "number" ? Math.abs((order.sl - order.entryPrice) / pipSize) : undefined,
    tpPips:
      typeof order.tp === "number" ? Math.abs((order.tp - order.entryPrice) / pipSize) : undefined,
  };
}

function getSymbolExecutionProfile(symbol: string) {
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

function getSessionExecutionMultiplier(timeUnix: number) {
  const utcHour = new Date(timeUnix * 1000).getUTCHours();
  if (utcHour >= 7 && utcHour < 10) {
    return { spread: 0.9, slippage: 0.85, liquidity: 1.35, session: "London open" };
  }
  if (utcHour >= 12 && utcHour < 16) {
    return { spread: 0.95, slippage: 0.9, liquidity: 1.4, session: "New York overlap" };
  }
  if (utcHour >= 21 || utcHour < 1) {
    return { spread: 1.8, slippage: 1.65, liquidity: 0.55, session: "Rollover" };
  }
  if (utcHour >= 0 && utcHour < 6) {
    return { spread: 1.2, slippage: 1.15, liquidity: 0.85, session: "Asia" };
  }
  return { spread: 1, slippage: 1, liquidity: 1, session: "Core" };
}

function getEventImpactMultiplier(events: ReplayNewsEvent[], timeUnix: number) {
  const nearby = events.filter((event) => Math.abs(event.timeUnix - timeUnix) <= 45 * 60);
  if (nearby.some((event) => event.impact === "High")) {
    return { spread: 1.75, slippage: 2.1, liquidity: 0.6, event: "High-impact news" };
  }
  if (nearby.some((event) => event.impact === "Medium")) {
    return { spread: 1.25, slippage: 1.35, liquidity: 0.85, event: "Medium-impact news" };
  }
  return { spread: 1, slippage: 1, liquidity: 1, event: null };
}

function getIntrabarPath(candle: CandleData) {
  const bullish = candle.close >= candle.open;
  return bullish
    ? [candle.open, candle.low, candle.high, candle.close]
    : [candle.open, candle.high, candle.low, candle.close];
}

function getIntrabarTraceForCandle(
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

function segmentCrossesPrice(start: number, end: number, target: number) {
  return target >= Math.min(start, end) && target <= Math.max(start, end);
}

function getFirstPathHitIndex(path: number[], target: number) {
  for (let index = 0; index < path.length - 1; index += 1) {
    if (segmentCrossesPrice(path[index]!, path[index + 1]!, target)) {
      return index;
    }
  }
  return null;
}

function resolvePathHitOrder(path: number[], levels: Array<{ key: string; price: number }>) {
  return levels
    .map((level) => ({
      ...level,
      hitIndex: getFirstPathHitIndex(path, level.price),
    }))
    .filter((level): level is { key: string; price: number; hitIndex: number } => level.hitIndex !== null)
    .sort((a, b) => a.hitIndex - b.hitIndex);
}

function getSwapDays(entryUnix: number, exitUnix: number) {
  if (exitUnix <= entryUnix) return 0;
  return Math.max(0, Math.floor((exitUnix - entryUnix) / (60 * 60 * 24)));
}

function buildPatternFeatureVector(
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

function getPatternSimilarityScore(
  base: ReplayPatternTemplate["featureVector"],
  candidate: ReplayPatternTemplate["featureVector"]
) {
  const directionScore = base.direction === candidate.direction ? 1 : 0;
  const impulseScore = 1 - Math.min(1, Math.abs(base.impulsePips - candidate.impulsePips) / 45);
  const rangeScore = 1 - Math.min(1, Math.abs(base.rangePips - candidate.rangePips) / 55);
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

const dashboardActionButtonClass =
  "cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3";

export default function BacktestReplayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSessionId = searchParams.get("sessionId");
  const snapshotIdParam = searchParams.get("snapshot");

  const [sessionId, setSessionId] = useState<string | null>(paramSessionId);
  const [sessionName, setSessionName] = useState("Untitled Session");
  const [sessionDescription, setSessionDescription] = useState("");

  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<BacktestTimeframe>("m5");
  const [startDate, setStartDate] = useState("2024-01-02");
  const [endDate, setEndDate] = useState("2024-03-01");

  const [allCandles, setAllCandles] = useState<CandleData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [goToDateTime, setGoToDateTime] = useState("");
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);

  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [initialBalance, setInitialBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [defaultSLPips, setDefaultSLPips] = useState(20);
  const [defaultTPPips, setDefaultTPPips] = useState(40);
  const [showSLTP, setShowSLTP] = useState(true);
  const [tradeDrafts, setTradeDrafts] = useState<Record<string, { sl: string; tp: string }>>({});
  const [pendingOrders, setPendingOrders] = useState<BacktestPendingOrder[]>([]);
  const [checkpoints, setCheckpoints] = useState<ReplayCheckpoint[]>([]);

  const [indicators, setIndicators] = useState<IndicatorSettings>(defaultIndicatorSettings);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("positions");
  const [orderTicketTab, setOrderTicketTab] = useState<"order" | "dom">("order");
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showDrawingRail, setShowDrawingRail] = useState(true);
  const [showFavoriteToolsBar, setShowFavoriteToolsBar] = useState(true);
  const [favoriteToolsBarOffset, setFavoriteToolsBarOffset] = useState<FavoriteToolsBarOffset>({
    ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  });
  const [selectedContextTimeframes, setSelectedContextTimeframes] = useState<BacktestTimeframe[] | null>(null);
  const [contextPanePositions, setContextPanePositions] = useState<
    Partial<Record<BacktestTimeframe, ContextPanePosition>>
  >({});
  const [contextPaneModes, setContextPaneModes] = useState<Partial<Record<BacktestTimeframe, ContextPaneMode>>>({});
  const [contextDockAssignments, setContextDockAssignments] = useState<
    Partial<Record<BacktestTimeframe, ContextDockSlot>>
  >({});
  const [draggingContextPane, setDraggingContextPane] = useState<BacktestTimeframe | null>(null);
  const [draggingDockContextTimeframe, setDraggingDockContextTimeframe] = useState<BacktestTimeframe | null>(null);
  const [activeContextDockTarget, setActiveContextDockTarget] = useState<ContextDockSlot | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("execution");
  const [reviewPlaybackMode, setReviewPlaybackMode] = useState<ReviewPlaybackMode>("manual");
  const [isReviewPlaybackRunning, setIsReviewPlaybackRunning] = useState(false);
  const [chartOrderSide, setChartOrderSide] = useState<"long" | "short" | null>(null);
  const [entryMode, setEntryMode] = useState<"market" | "limit" | "stop" | "stop-limit">("limit");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketSecondaryPrice, setTicketSecondaryPrice] = useState("");
  const [ticketUnits, setTicketUnits] = useState("");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("week");
  const [ocoEnabled, setOcoEnabled] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([]);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("none");
  const [annotationColor, setAnnotationColor] = useState("#facc15");
  const [annotationLabel, setAnnotationLabel] = useState("POI");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [selectedExecutionOverlayId, setSelectedExecutionOverlayId] = useState<string | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | undefined>(undefined);
  const [contextCandles, setContextCandles] = useState<Partial<Record<BacktestTimeframe, CandleData[]>>>({});
  const [barMagnifierCandles, setBarMagnifierCandles] = useState<CandleData[]>([]);
  const [barMagnifierTimeframe, setBarMagnifierTimeframe] = useState<BacktestTimeframe | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<ReplayNewsEvent[]>([]);
  const [reviewEventId, setReviewEventId] = useState<string | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<ReplaySimulationConfig>(
    defaultSimulationConfig
  );
  const [ruleSets, setRuleSets] = useState<RuleSetOption[]>([]);
  const [linkedRuleSetId, setLinkedRuleSetId] = useState<string | null>(null);
  const [rulebookCoaching, setRulebookCoaching] = useState<RulebookCoachingResult | null>(null);
  const [isLoadingRulebook, setIsLoadingRulebook] = useState(false);
  const [patternLibrary, setPatternLibrary] = useState<ReplayPatternTemplate[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [sharedSnapshots, setSharedSnapshots] = useState<ReplaySharedSnapshot[]>([]);
  const [selectedSharedSnapshotId, setSelectedSharedSnapshotId] = useState<string | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [isDraggingFavoriteToolsBar, setIsDraggingFavoriteToolsBar] = useState(false);

  const [challengePreset, setChallengePreset] = useState<ChallengePresetId>("prop");
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig>({
    profitTargetPct: CHALLENGE_PRESETS.prop.profitTargetPct,
    maxDrawdownPct: CHALLENGE_PRESETS.prop.maxDrawdownPct,
    dailyLossPct: CHALLENGE_PRESETS.prop.dailyLossPct,
    minTrades: CHALLENGE_PRESETS.prop.minTrades,
    enforce: CHALLENGE_PRESETS.prop.enforce,
  });
  const [nextTradeNotes, setNextTradeNotes] = useState("");
  const [nextTradeTags, setNextTradeTags] = useState("");

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef("");
  const activeReplayConfigRef = useRef<string | null>(null);
  const candleRequestRef = useRef(0);
  const contextRequestRef = useRef(0);
  const barMagnifierRequestRef = useRef(0);
  const tradeMfeRef = useRef<Record<string, number>>({});
  const tradeMaeRef = useRef<Record<string, number>>({});
  const pendingOrderProcessingRef = useRef<Set<string>>(new Set());
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const favoriteToolsBarRef = useRef<HTMLDivElement | null>(null);
  const dockTargetRefs = useRef<Partial<Record<ContextDockSlot, HTMLDivElement | null>>>({});
  const contextPaneDragRef = useRef<{
    timeframe: BacktestTimeframe;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const favoriteToolsBarDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const contextDockDragRef = useRef<{ timeframe: BacktestTimeframe } | null>(null);
  const appliedSnapshotRef = useRef<string | null>(null);

  const pipSize = useMemo(() => getPipSize(symbol), [symbol]);

  const activeContextTimeframes = useMemo(() => {
    const base = selectedContextTimeframes ?? getDefaultContextTimeframes(timeframe);
    return base.filter(
      (contextTimeframe, index, collection) =>
        contextTimeframe !== timeframe && collection.indexOf(contextTimeframe) === index
    );
  }, [selectedContextTimeframes, timeframe]);

  const contextTimeframeSummary = useMemo(() => {
    if (!activeContextTimeframes.length) return "Add context";
    const labels = activeContextTimeframes.map(getTimeframeCompactLabel);
    return labels.length <= 2
      ? `Context TF · ${labels.join(", ")}`
      : `Context TF · ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [activeContextTimeframes]);

  const contextVisibilityEnabled = layoutPreset !== "chart-only" && activeContextTimeframes.length > 0;

  useEffect(() => {
    setContextDockAssignments((previous) => {
      const next = buildContextDockAssignments(activeContextTimeframes, previous);
      return areContextDockAssignmentsEqual(previous, next) ? previous : next;
    });
  }, [activeContextTimeframes]);

  const calculatePnL = useCallback(
    (trade: BacktestTrade, price: number) => {
      const diff =
        trade.direction === "long" ? price - trade.entryPrice : trade.entryPrice - price;
      return (diff / pipSize) * trade.volume * 10;
    },
    [pipSize]
  );

  const calculatePips = useCallback(
    (trade: BacktestTrade, price: number) => {
      const diff =
        trade.direction === "long" ? price - trade.entryPrice : trade.entryPrice - price;
      return diff / pipSize;
    },
    [pipSize]
  );

  const tradeLookup = useMemo(
    () => new Map(trades.map((trade) => [trade.id, trade] as const)),
    [trades]
  );

  const isTradeHistoricallyClosed = useCallback(
    (tradeId: string) => {
      const trade = tradeLookup.get(tradeId);
      return trade ? Boolean(getExitUnix(trade)) : false;
    },
    [tradeLookup]
  );

  const fetchCandles = useCallback(
    async (params?: {
      symbol: string;
      timeframe: BacktestTimeframe;
      startDate: string;
      endDate: string;
      savedIndex?: number;
      savedTimeUnix?: number;
    }) => {
      const query = params ?? {
        symbol,
        timeframe,
        startDate,
        endDate,
      };

      const requestId = ++candleRequestRef.current;
      setIsLoadingCandles(true);
      try {
        const result = await trpcClient.marketData.fetchHistoricalCandles.query({
          symbol: query.symbol,
          timeframe: query.timeframe,
          from: query.startDate,
          to: query.endDate,
        });

        const candles: CandleData[] = result.candles.map((c: any) => ({
          time: c.time as Time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
        }));

        if (requestId !== candleRequestRef.current) {
          return candles;
        }

        setAllCandles(candles);
        let nextIndex = 0;
        if (candles.length > 0) {
          if (typeof query.savedTimeUnix === "number" && Number.isFinite(query.savedTimeUnix)) {
            nextIndex = nearestCandleIndex(candles, query.savedTimeUnix);
          } else {
            nextIndex = Math.min(query.savedIndex ?? Math.min(120, candles.length - 1), candles.length - 1);
          }
        }
        setCurrentIndex(nextIndex);
        setGoToDateTime(toDateTimeLocalValue(candles[nextIndex]?.time ?? null));
        return candles;
      } catch (err: any) {
        if (requestId !== candleRequestRef.current) {
          return [];
        }
        console.error("Failed to fetch candles:", err);
        toast.error(err?.message || "Failed to fetch candles from Dukascopy");
        return [];
      } finally {
        if (requestId === candleRequestRef.current) {
          setIsLoadingCandles(false);
        }
      }
    },
    [endDate, startDate, symbol, timeframe]
  );

  const buildWorkspaceState = useCallback((): ReplayWorkspaceState => {
    return {
      annotations,
      pendingOrders,
      checkpoints,
      workspaceTab,
      orderTicketTab,
      showBottomPanel,
      showRightPanel,
      showDrawingRail,
      showFavoriteToolsBar,
      selectedContextTimeframes: activeContextTimeframes,
      contextPanePositions,
      contextPaneModes,
      contextDockAssignments,
      favoriteToolsBarOffset,
      layoutPreset,
      chartOrderSide,
      entryMode,
      ticketPrice,
      ticketSecondaryPrice,
      ticketUnits,
      timeInForce,
      ocoEnabled,
      showSLTP,
      annotationTool,
      annotationColor,
      annotationLabel,
      reviewPlaybackMode,
      ruleSetId: linkedRuleSetId,
      patternLibrary,
      sharedSnapshots,
    };
  }, [
    activeContextTimeframes,
    annotationColor,
    annotationLabel,
    annotationTool,
    annotations,
    chartOrderSide,
    checkpoints,
    contextDockAssignments,
    contextPaneModes,
    contextPanePositions,
    entryMode,
    layoutPreset,
    linkedRuleSetId,
    ocoEnabled,
    orderTicketTab,
    patternLibrary,
    pendingOrders,
    reviewPlaybackMode,
    sharedSnapshots,
    showBottomPanel,
    showDrawingRail,
    showFavoriteToolsBar,
    showRightPanel,
    showSLTP,
    ticketPrice,
    ticketSecondaryPrice,
    ticketUnits,
    timeInForce,
    favoriteToolsBarOffset,
    workspaceTab,
  ]);

  const buildSimulationConfig = useCallback(
    () => ({
      intrabarMode: simulationConfig.intrabarMode,
      hideUpcomingHighImpactNews: simulationConfig.hideUpcomingHighImpactNews,
    }),
    [simulationConfig.hideUpcomingHighImpactNews, simulationConfig.intrabarMode]
  );

  const buildSessionPayload = useCallback(() => {
    return {
      sessionId: sessionId as string,
      name: sessionName,
      description: sessionDescription,
      symbol,
      timeframe,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      lastCandleIndex: Math.max(0, currentIndex),
      playbackSpeed,
      indicatorConfig: indicators,
      riskPercent,
      defaultSLPips,
      defaultTPPips,
      linkedRuleSetId,
      workspaceState: buildWorkspaceState(),
      simulationConfig: buildSimulationConfig(),
    };
  }, [
    buildSimulationConfig,
    buildWorkspaceState,
    currentIndex,
    defaultSLPips,
    defaultTPPips,
    indicators,
    linkedRuleSetId,
    playbackSpeed,
    riskPercent,
    sessionDescription,
    sessionId,
    sessionName,
    startDate,
    symbol,
    timeframe,
    endDate,
  ]);

  const createNewSession = useCallback(async () => {
    try {
      const session = await trpcClient.backtest.createSession.mutate({
        name: sessionName,
        description: sessionDescription || undefined,
        symbol,
        timeframe,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        initialBalance,
        riskPercent,
        defaultSLPips,
        defaultTPPips,
        dataSource: "dukascopy",
        linkedRuleSetId,
        workspaceState: buildWorkspaceState(),
        simulationConfig: buildSimulationConfig(),
        indicatorConfig: indicators,
      });

      setSessionId(session.id);
      setTrades([]);
      setPendingOrders([]);
      tradeMfeRef.current = {};
      tradeMaeRef.current = {};
      activeReplayConfigRef.current = JSON.stringify({
        symbol,
        timeframe,
        startDate,
        endDate,
      });
      lastSavedSnapshotRef.current = "";
      setShowNewSessionDialog(false);

      await fetchCandles({
        symbol,
        timeframe,
        startDate,
        endDate,
      });
    } catch (err) {
      console.error("Failed to create session:", err);
      toast.error("Failed to create backtest session");
    }
  }, [
    defaultSLPips,
    defaultTPPips,
    endDate,
    fetchCandles,
    buildSimulationConfig,
    buildWorkspaceState,
    indicators,
    initialBalance,
    linkedRuleSetId,
    riskPercent,
    sessionDescription,
    sessionName,
    startDate,
    symbol,
    timeframe,
  ]);

  const loadSession = useCallback(
    async (id: string) => {
      try {
        const session = await trpcClient.backtest.getSession.query({ sessionId: id });

        setSessionId(session.id);
        setSessionName(session.name);
        setSessionDescription(session.description || "");
        setSymbol(session.symbol);
        setTimeframe(session.timeframe as BacktestTimeframe);
        setStartDate(
          session.startDate ? format(new Date(session.startDate), "yyyy-MM-dd") : "2024-01-02"
        );
        setEndDate(
          session.endDate ? format(new Date(session.endDate), "yyyy-MM-dd") : "2024-03-01"
        );
        setInitialBalance(Number(session.initialBalance));
        setRiskPercent(Number(session.riskPercent || 1));
        setDefaultSLPips(session.defaultSLPips || 20);
        setDefaultTPPips(session.defaultTPPips || 40);
        setPlaybackSpeed(Number(session.playbackSpeed || 1));
        setIndicators((session.indicatorConfig as IndicatorSettings) || defaultIndicatorSettings);
        setLinkedRuleSetId(typeof session.linkedRuleSetId === "string" ? session.linkedRuleSetId : null);
        setSimulationConfig({
          ...defaultSimulationConfig,
          ...(session.simulationConfig as Partial<ReplaySimulationConfig> | null),
        });

        const loadedTrades: BacktestTrade[] = (session.trades || []).map((trade: any) => ({
          id: trade.id,
          direction: trade.direction,
          entryPrice: Number(trade.entryPrice),
          entryTime: (trade.entryTimeUnix ||
            Math.floor(new Date(trade.entryTime).getTime() / 1000)) as Time,
          entryTimeUnix: trade.entryTimeUnix,
          exitPrice: trade.exitPrice ? Number(trade.exitPrice) : undefined,
          exitTime: trade.exitTimeUnix
            ? (trade.exitTimeUnix as Time)
            : trade.exitTime
            ? (Math.floor(new Date(trade.exitTime).getTime() / 1000) as Time)
            : undefined,
          exitTimeUnix: trade.exitTimeUnix,
          exitType: trade.exitType,
          sl: trade.sl ? Number(trade.sl) : undefined,
          tp: trade.tp ? Number(trade.tp) : undefined,
          slPips: trade.slPips ? Number(trade.slPips) : undefined,
          tpPips: trade.tpPips ? Number(trade.tpPips) : undefined,
          riskPercent: trade.riskPercent ? Number(trade.riskPercent) : undefined,
          volume: Number(trade.volume),
          pipValue: trade.pipValue ? Number(trade.pipValue) : undefined,
          status: trade.status,
          pnl: trade.pnl ? Number(trade.pnl) : undefined,
          pnlPips: trade.pnlPips ? Number(trade.pnlPips) : undefined,
          realizedRR: trade.realizedRR ? Number(trade.realizedRR) : undefined,
          mfePips: trade.mfePips ? Number(trade.mfePips) : undefined,
          maePips: trade.maePips ? Number(trade.maePips) : undefined,
          holdTimeSeconds: trade.holdTimeSeconds,
          notes: trade.notes,
          tags: trade.tags,
          entryBalance: trade.entryBalance ? Number(trade.entryBalance) : undefined,
          fees: trade.fees ? Number(trade.fees) : undefined,
          commission: trade.commission ? Number(trade.commission) : undefined,
          swap: trade.swap ? Number(trade.swap) : undefined,
          entrySpreadPips: trade.entrySpreadPips ? Number(trade.entrySpreadPips) : undefined,
          entrySlippagePips: trade.entrySlippagePips ? Number(trade.entrySlippagePips) : undefined,
          exitSlippagePips: trade.exitSlippagePips ? Number(trade.exitSlippagePips) : undefined,
          slippagePrice: trade.slippagePrice ? Number(trade.slippagePrice) : undefined,
        }));

        setTrades(loadedTrades);
        tradeMfeRef.current = loadedTrades.reduce<Record<string, number>>((acc, trade) => {
          acc[trade.id] = trade.mfePips || 0;
          return acc;
        }, {});
        tradeMaeRef.current = loadedTrades.reduce<Record<string, number>>((acc, trade) => {
          acc[trade.id] = trade.maePips || 0;
          return acc;
        }, {});

        await fetchCandles({
          symbol: session.symbol,
          timeframe: session.timeframe as BacktestTimeframe,
          startDate: session.startDate
            ? new Date(session.startDate).toISOString().split("T")[0]
            : "2024-01-02",
          endDate: session.endDate
            ? new Date(session.endDate).toISOString().split("T")[0]
            : "2024-03-01",
          savedIndex: session.lastCandleIndex ?? undefined,
        });

        activeReplayConfigRef.current = JSON.stringify({
          symbol: session.symbol,
          timeframe: session.timeframe as BacktestTimeframe,
          startDate: session.startDate
            ? new Date(session.startDate).toISOString().split("T")[0]
            : "2024-01-02",
          endDate: session.endDate
            ? new Date(session.endDate).toISOString().split("T")[0]
            : "2024-03-01",
        });

        lastSavedSnapshotRef.current = JSON.stringify({
          name: session.name,
          description: session.description || "",
          symbol: session.symbol,
          timeframe: session.timeframe as BacktestTimeframe,
          startDate: session.startDate
            ? new Date(session.startDate).toISOString()
            : new Date("2024-01-02").toISOString(),
          endDate: session.endDate
            ? new Date(session.endDate).toISOString()
            : new Date("2024-03-01").toISOString(),
          currentIndex: session.lastCandleIndex ?? 0,
          playbackSpeed: Number(session.playbackSpeed || 1),
          indicatorConfig: (session.indicatorConfig as IndicatorSettings) || defaultIndicatorSettings,
          riskPercent: Number(session.riskPercent || 1),
          defaultSLPips: session.defaultSLPips || 20,
          defaultTPPips: session.defaultTPPips || 40,
          linkedRuleSetId: typeof session.linkedRuleSetId === "string" ? session.linkedRuleSetId : null,
          workspaceState: session.workspaceState ?? null,
          simulationConfig: session.simulationConfig ?? null,
        });

        const workspaceState = session.workspaceState as ReplayWorkspaceState | null;
        if (workspaceState) {
          setAnnotations(Array.isArray(workspaceState.annotations) ? workspaceState.annotations : []);
          setPendingOrders(
            Array.isArray(workspaceState.pendingOrders) ? workspaceState.pendingOrders : []
          );
          setCheckpoints(
            Array.isArray(workspaceState.checkpoints) ? workspaceState.checkpoints : []
          );
          setWorkspaceTab(workspaceState.workspaceTab ?? "positions");
          setOrderTicketTab(workspaceState.orderTicketTab ?? "order");
          setShowBottomPanel(workspaceState.showBottomPanel ?? true);
          setShowRightPanel(workspaceState.showRightPanel ?? true);
          setShowDrawingRail(workspaceState.showDrawingRail ?? true);
          setShowFavoriteToolsBar(workspaceState.showFavoriteToolsBar ?? true);
          setSelectedContextTimeframes(
            Array.isArray(workspaceState.selectedContextTimeframes)
              ? workspaceState.selectedContextTimeframes.filter((item, index, collection) => {
                  return isBacktestTimeframe(item) && collection.indexOf(item) === index;
                })
              : getDefaultContextTimeframes(session.timeframe as BacktestTimeframe)
          );
          setContextPanePositions(
            sanitizeContextPanePositions(workspaceState.contextPanePositions)
          );
          setContextPaneModes(sanitizeContextPaneModes(workspaceState.contextPaneModes));
          setContextDockAssignments(
            sanitizeContextDockAssignments(workspaceState.contextDockAssignments)
          );
          setFavoriteToolsBarOffset(
            sanitizeFavoriteToolsBarOffset(workspaceState.favoriteToolsBarOffset)
          );
          setLayoutPreset(workspaceState.layoutPreset ?? "execution");
          setChartOrderSide(workspaceState.chartOrderSide ?? null);
          setEntryMode(workspaceState.entryMode ?? "limit");
          setTicketPrice(workspaceState.ticketPrice ?? "");
          setTicketSecondaryPrice(workspaceState.ticketSecondaryPrice ?? "");
          setTicketUnits(workspaceState.ticketUnits ?? "");
          setTimeInForce(workspaceState.timeInForce ?? "week");
          setOcoEnabled(workspaceState.ocoEnabled ?? false);
          setShowSLTP(workspaceState.showSLTP ?? true);
          setAnnotationTool(workspaceState.annotationTool ?? "none");
          setAnnotationColor(workspaceState.annotationColor ?? "#facc15");
          setAnnotationLabel(workspaceState.annotationLabel ?? "POI");
          setReviewPlaybackMode(workspaceState.reviewPlaybackMode ?? "manual");
          if (typeof workspaceState.ruleSetId === "string" || workspaceState.ruleSetId === null) {
            setLinkedRuleSetId(workspaceState.ruleSetId ?? null);
          }
          setPatternLibrary(
            Array.isArray(workspaceState.patternLibrary) ? workspaceState.patternLibrary : []
          );
          setSharedSnapshots(
            Array.isArray(workspaceState.sharedSnapshots) ? workspaceState.sharedSnapshots : []
          );
        } else {
          setPatternLibrary([]);
          setSharedSnapshots([]);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        toast.error("Failed to load backtest session");
      }
    },
    [fetchCandles]
  );

  useEffect(() => {
    if (paramSessionId) {
      loadSession(paramSessionId);
      return;
    }
    setShowNewSessionDialog(true);
  }, [loadSession, paramSessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") {
      setAnnotations([]);
      setSelectedAnnotationId(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getDrawingStorageKey(sessionId));
      const parsed = raw ? (JSON.parse(raw) as ChartAnnotation[]) : [];
      setAnnotations(Array.isArray(parsed) ? parsed : []);
      setSelectedAnnotationId(null);
    } catch {
      setAnnotations([]);
      setSelectedAnnotationId(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") {
      setPendingOrders([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getPendingOrdersStorageKey(sessionId));
      const parsed = raw ? (JSON.parse(raw) as BacktestPendingOrder[]) : [];
      setPendingOrders(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPendingOrders([]);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") {
      setCheckpoints([]);
      setSelectedCheckpointId(undefined);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getCheckpointStorageKey(sessionId));
      const parsed = raw ? (JSON.parse(raw) as ReplayCheckpoint[]) : [];
      const loaded = Array.isArray(parsed) ? parsed : [];
      setCheckpoints(loaded);
      setSelectedCheckpointId(undefined);
    } catch {
      setCheckpoints([]);
      setSelectedCheckpointId(undefined);
    }
  }, [sessionId]);

  useEffect(() => {
    setSelectedContextTimeframes(null);
    setContextPanePositions({});
    setContextPaneModes({});
    setContextDockAssignments({});
    setDraggingContextPane(null);
    setDraggingDockContextTimeframe(null);
    setActiveContextDockTarget(null);
    setPatternLibrary([]);
    setSelectedPatternId(null);
    setSharedSnapshots([]);
    setSelectedSharedSnapshotId(null);
    setReviewPlaybackMode("manual");
    setIsReviewPlaybackRunning(false);
    setShowDrawingRail(true);
    setShowFavoriteToolsBar(true);
    setFavoriteToolsBarOffset({ ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET });
    setIsDraggingFavoriteToolsBar(false);
    contextPaneDragRef.current = null;
    contextDockDragRef.current = null;
    favoriteToolsBarDragRef.current = null;
    appliedSnapshotRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    setSelectedContextTimeframes((previous) => {
      if (previous === null) {
        return getDefaultContextTimeframes(timeframe);
      }

      const filtered = previous.filter(
        (contextTimeframe, index, collection) =>
          contextTimeframe !== timeframe && collection.indexOf(contextTimeframe) === index
      );

      return filtered.length === previous.length ? previous : filtered;
    });
  }, [timeframe]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(getWorkspaceStorageKey(sessionId));
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return;

      if (
        parsed.workspaceTab === "positions" ||
        parsed.workspaceTab === "history" ||
        parsed.workspaceTab === "review"
      ) {
        setWorkspaceTab(parsed.workspaceTab);
      }
      if (parsed.orderTicketTab === "order" || parsed.orderTicketTab === "dom") {
        setOrderTicketTab(parsed.orderTicketTab);
      }
      if (typeof parsed.showBottomPanel === "boolean") {
        setShowBottomPanel(parsed.showBottomPanel);
      }
      if (typeof parsed.showRightPanel === "boolean") {
        setShowRightPanel(parsed.showRightPanel);
      }
      if (typeof parsed.showDrawingRail === "boolean") {
        setShowDrawingRail(parsed.showDrawingRail);
      }
      if (typeof parsed.showFavoriteToolsBar === "boolean") {
        setShowFavoriteToolsBar(parsed.showFavoriteToolsBar);
      }
      if (Array.isArray(parsed.selectedContextTimeframes)) {
        const rawContextTimeframes = parsed.selectedContextTimeframes as unknown[];
        const restoredContextTimeframes = rawContextTimeframes.reduce(
          (result: BacktestTimeframe[], value: unknown) => {
          if (isBacktestTimeframe(value)) {
            result.push(value);
          }
          return result;
          },
          []
        );
        setSelectedContextTimeframes(
          restoredContextTimeframes.filter(
            (contextTimeframe, index, collection) => collection.indexOf(contextTimeframe) === index
          )
        );
      }
      if (parsed.contextPanePositions) {
        setContextPanePositions(sanitizeContextPanePositions(parsed.contextPanePositions));
      }
      if (parsed.contextPaneModes) {
        setContextPaneModes(sanitizeContextPaneModes(parsed.contextPaneModes));
      }
      if (parsed.contextDockAssignments) {
        setContextDockAssignments(sanitizeContextDockAssignments(parsed.contextDockAssignments));
      }
      if (parsed.favoriteToolsBarOffset) {
        setFavoriteToolsBarOffset(sanitizeFavoriteToolsBarOffset(parsed.favoriteToolsBarOffset));
      }
      if (
        parsed.layoutPreset === "execution" ||
        parsed.layoutPreset === "chart-only" ||
        parsed.layoutPreset === "review" ||
        parsed.layoutPreset === "coach"
      ) {
        setLayoutPreset(parsed.layoutPreset);
      }
      if (parsed.chartOrderSide === "long" || parsed.chartOrderSide === "short" || parsed.chartOrderSide === null) {
        setChartOrderSide(parsed.chartOrderSide);
      }
      if (
        parsed.entryMode === "market" ||
        parsed.entryMode === "limit" ||
        parsed.entryMode === "stop" ||
        parsed.entryMode === "stop-limit"
      ) {
        setEntryMode(parsed.entryMode);
      }
      if (typeof parsed.ticketPrice === "string") {
        setTicketPrice(parsed.ticketPrice);
      }
      if (typeof parsed.ticketSecondaryPrice === "string") {
        setTicketSecondaryPrice(parsed.ticketSecondaryPrice);
      }
      if (typeof parsed.ticketUnits === "string") {
        setTicketUnits(parsed.ticketUnits);
      }
      if (parsed.timeInForce === "day" || parsed.timeInForce === "week" || parsed.timeInForce === "gtc") {
        setTimeInForce(parsed.timeInForce);
      }
      if (typeof parsed.ocoEnabled === "boolean") {
        setOcoEnabled(parsed.ocoEnabled);
      }
      if (typeof parsed.showSLTP === "boolean") {
        setShowSLTP(parsed.showSLTP);
      }
      if (
        parsed.annotationTool === "none" ||
        parsed.annotationTool === "trendline" ||
        parsed.annotationTool === "extended" ||
        parsed.annotationTool === "ray" ||
        parsed.annotationTool === "arrow" ||
        parsed.annotationTool === "horizontal" ||
        parsed.annotationTool === "vertical" ||
        parsed.annotationTool === "rectangle" ||
        parsed.annotationTool === "fib" ||
        parsed.annotationTool === "measure" ||
        parsed.annotationTool === "anchored-vwap" ||
        parsed.annotationTool === "note"
      ) {
        setAnnotationTool(parsed.annotationTool);
      }
      if (typeof parsed.annotationColor === "string") {
        setAnnotationColor(parsed.annotationColor);
      }
      if (typeof parsed.annotationLabel === "string") {
        setAnnotationLabel(parsed.annotationLabel);
      }
      if (parsed.reviewPlaybackMode === "manual" || parsed.reviewPlaybackMode === "events") {
        setReviewPlaybackMode(parsed.reviewPlaybackMode);
      }
      if (typeof parsed.ruleSetId === "string" || parsed.ruleSetId === null) {
        setLinkedRuleSetId(parsed.ruleSetId ?? null);
      }
      if (Array.isArray(parsed.patternLibrary)) {
        setPatternLibrary(parsed.patternLibrary as ReplayPatternTemplate[]);
      }
      if (Array.isArray(parsed.sharedSnapshots)) {
        setSharedSnapshots(parsed.sharedSnapshots as ReplaySharedSnapshot[]);
      }
      if (parsed.simulationConfig && typeof parsed.simulationConfig === "object") {
        setSimulationConfig({
          ...defaultSimulationConfig,
          ...(parsed.simulationConfig as Partial<ReplaySimulationConfig>),
        });
      }
    } catch {
      // ignore malformed local workspace preferences
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const previousConfig =
      activeReplayConfigRef.current === null
        ? null
        : (JSON.parse(activeReplayConfigRef.current) as {
            symbol: string;
            timeframe: BacktestTimeframe;
            startDate: string;
            endDate: string;
          });

    const nextConfigObject = {
      symbol,
      timeframe,
      startDate,
      endDate,
    };
    const nextConfig = JSON.stringify(nextConfigObject);

    if (activeReplayConfigRef.current === null) {
      activeReplayConfigRef.current = nextConfig;
      return;
    }

    if (activeReplayConfigRef.current === nextConfig) return;
    activeReplayConfigRef.current = nextConfig;

    const isTimeframeOnlyChange =
      previousConfig !== null &&
      previousConfig.symbol === nextConfigObject.symbol &&
      previousConfig.startDate === nextConfigObject.startDate &&
      previousConfig.endDate === nextConfigObject.endDate &&
      previousConfig.timeframe !== nextConfigObject.timeframe;

    if (!isTimeframeOnlyChange) {
      setTrades([]);
      setPendingOrders([]);
      setCheckpoints([]);
      tradeMfeRef.current = {};
      tradeMaeRef.current = {};
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setSelectedExecutionOverlayId(null);
      setSelectedCheckpointId(undefined);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(getCheckpointStorageKey(sessionId));
      }
    }

    setIsPlaying(false);
    void fetchCandles({
      symbol,
      timeframe,
      startDate,
      endDate,
      savedTimeUnix: Number(allCandles[Math.min(currentIndex, Math.max(allCandles.length - 1, 0))]?.time ?? 0),
    });
  }, [allCandles, currentIndex, endDate, fetchCandles, sessionId, startDate, symbol, timeframe]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    window.localStorage.setItem(getDrawingStorageKey(sessionId), JSON.stringify(annotations));
  }, [annotations, sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    window.localStorage.setItem(getPendingOrdersStorageKey(sessionId), JSON.stringify(pendingOrders));
  }, [pendingOrders, sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    window.localStorage.setItem(getCheckpointStorageKey(sessionId), JSON.stringify(checkpoints));
  }, [checkpoints, sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    window.localStorage.setItem(
      getWorkspaceStorageKey(sessionId),
      JSON.stringify({
        workspaceTab,
        orderTicketTab,
        showBottomPanel,
        showRightPanel,
        showDrawingRail,
        showFavoriteToolsBar,
        selectedContextTimeframes: activeContextTimeframes,
        contextPanePositions,
        contextPaneModes,
        contextDockAssignments,
        favoriteToolsBarOffset,
        layoutPreset,
        chartOrderSide,
        entryMode,
        ticketPrice,
        ticketSecondaryPrice,
        ticketUnits,
        timeInForce,
        ocoEnabled,
        showSLTP,
        annotationTool,
        annotationColor,
        annotationLabel,
        reviewPlaybackMode,
        ruleSetId: linkedRuleSetId,
        patternLibrary,
        sharedSnapshots,
        simulationConfig: buildSimulationConfig(),
      })
    );
  }, [
    annotationColor,
    annotationLabel,
    annotationTool,
    buildSimulationConfig,
    entryMode,
    layoutPreset,
    linkedRuleSetId,
    ocoEnabled,
    orderTicketTab,
    patternLibrary,
    reviewPlaybackMode,
    sessionId,
    chartOrderSide,
    sharedSnapshots,
    showBottomPanel,
    showDrawingRail,
    showFavoriteToolsBar,
    contextDockAssignments,
    contextPaneModes,
    contextPanePositions,
    activeContextTimeframes,
    favoriteToolsBarOffset,
    showRightPanel,
    showSLTP,
    ticketPrice,
    ticketSecondaryPrice,
    ticketUnits,
    timeInForce,
    workspaceTab,
  ]);

  useEffect(() => {
    if (selectedAnnotationId && !annotations.some((item) => item.id === selectedAnnotationId)) {
      setSelectedAnnotationId(null);
    }
  }, [annotations, selectedAnnotationId]);

  useEffect(() => {
    if (selectedPatternId && !patternLibrary.some((item) => item.id === selectedPatternId)) {
      setSelectedPatternId(null);
    }
  }, [patternLibrary, selectedPatternId]);

  useEffect(() => {
    if (!selectedExecutionOverlayId) return;

    const overlayStillExists =
      selectedExecutionOverlayId.startsWith("trade:")
        ? trades.some(
            (trade) => `trade:${trade.id}` === selectedExecutionOverlayId && trade.status === "open"
          )
        : pendingOrders.some(
            (order) =>
              `order:${order.id}` === selectedExecutionOverlayId &&
              !order.filledAtUnix &&
              !order.cancelledAtUnix
          );

    if (!overlayStillExists) {
      setSelectedExecutionOverlayId(null);
    }
  }, [pendingOrders, selectedExecutionOverlayId, trades]);

  useEffect(() => {
    if (
      selectedSharedSnapshotId &&
      !sharedSnapshots.some((item) => item.id === selectedSharedSnapshotId)
    ) {
      setSelectedSharedSnapshotId(null);
    }
  }, [selectedSharedSnapshotId, sharedSnapshots]);

  useEffect(() => {
    if (selectedCheckpointId && !checkpoints.some((item) => item.id === selectedCheckpointId)) {
      setSelectedCheckpointId(undefined);
    }
  }, [checkpoints, selectedCheckpointId]);

  useEffect(() => {
    if (!sessionId || !allCandles.length) return;
    const payload = buildSessionPayload();
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedSnapshotRef.current) return;

    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        await trpcClient.backtest.updateSession.mutate(payload);
        lastSavedSnapshotRef.current = snapshot;
      } catch {
        // quiet autosave failure
      }
    }, 3000);

    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [
    allCandles.length,
    buildSessionPayload,
    sessionId,
  ]);

  useEffect(() => {
    const contextTimeframes = activeContextTimeframes;
    if (!contextTimeframes.length) {
      setContextCandles({});
      return;
    }

    const requestId = ++contextRequestRef.current;

    void Promise.all(
      contextTimeframes.map(async (contextTimeframe) => {
        const result = await trpcClient.marketData.fetchHistoricalCandles.query({
          symbol,
          timeframe: contextTimeframe,
          from: startDate,
          to: endDate,
        });

        const candles: CandleData[] = result.candles.map((c: any) => ({
          time: c.time as Time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
        }));

        return [contextTimeframe, candles] as const;
      })
    )
      .then((entries) => {
        if (requestId !== contextRequestRef.current) return;
        setContextCandles(Object.fromEntries(entries) as Partial<Record<BacktestTimeframe, CandleData[]>>);
      })
      .catch((err) => {
        if (requestId !== contextRequestRef.current) return;
        console.error("Failed to fetch context candles:", err);
        setContextCandles({});
      });
  }, [activeContextTimeframes, endDate, startDate, symbol]);

  useEffect(() => {
    let cancelled = false;

    void trpcClient.rules
      .listRuleSets
      .query()
      .then((result: any[]) => {
        if (cancelled) return;
        setRuleSets(
          result.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setRuleSets([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const magnifierTimeframe =
      simulationConfig.intrabarMode === "bar-magnifier"
        ? getBarMagnifierTimeframe(timeframe)
        : null;

    if (!magnifierTimeframe) {
      setBarMagnifierTimeframe(null);
      setBarMagnifierCandles([]);
      return;
    }

    const requestId = ++barMagnifierRequestRef.current;
    setBarMagnifierTimeframe(magnifierTimeframe);

    void trpcClient.marketData.fetchHistoricalCandles
      .query({
        symbol,
        timeframe: magnifierTimeframe,
        from: startDate,
        to: endDate,
      })
      .then((result: any) => {
        if (requestId !== barMagnifierRequestRef.current) return;
        const candles: CandleData[] = result.candles.map((c: any) => ({
          time: c.time as Time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
        }));
        setBarMagnifierCandles(candles);
      })
      .catch((err: unknown) => {
        if (requestId !== barMagnifierRequestRef.current) return;
        console.error("Failed to fetch bar magnifier candles:", err);
        setBarMagnifierCandles([]);
      });
  }, [endDate, simulationConfig.intrabarMode, startDate, symbol, timeframe]);

  useEffect(() => {
    if (!sessionId || !linkedRuleSetId) {
      setRulebookCoaching(null);
      return;
    }

    let cancelled = false;
    setIsLoadingRulebook(true);

    void trpcClient.backtest
      .getRulebookCoaching
      .query({
        sessionId,
        ruleSetId: linkedRuleSetId,
      })
      .then((result: RulebookCoachingResult) => {
        if (cancelled) return;
        setRulebookCoaching(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Failed to load rulebook coaching:", err);
        setRulebookCoaching(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRulebook(false);
      });

    return () => {
      cancelled = true;
    };
  }, [linkedRuleSetId, sessionId, trades.length]);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/economic-calendar?start=${startDate}&end=${endDate}`)
      .then(async (response) => {
        if (!response.ok) return [];
        return (await response.json()) as Array<Record<string, unknown>>;
      })
      .then((payload) => {
        if (cancelled || !Array.isArray(payload)) return;
        const mappedEvents = payload
          .map((event, index): ReplayNewsEvent | null => {
            const timeUnix = Math.floor(new Date(String(event.date || "")).getTime() / 1000);
            if (!Number.isFinite(timeUnix)) return null;
            return {
              id: `news-${index}-${timeUnix}`,
              title: String(event.title || "Economic event"),
              country: String(event.country || "Global"),
              date: String(event.date || ""),
              timeUnix,
              impact: (String(event.impact || "Low") as ReplayNewsEvent["impact"]),
              actual: typeof event.actual === "string" ? event.actual : null,
              forecast: typeof event.forecast === "string" ? event.forecast : null,
              previous: typeof event.previous === "string" ? event.previous : null,
            };
          })
          .filter((event): event is ReplayNewsEvent => event !== null);

        setCalendarEvents(mappedEvents);
      })
      .catch(() => {
        if (!cancelled) setCalendarEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [endDate, startDate]);

  const visibleCandles = useMemo(
    () => allCandles.slice(0, currentIndex + 1),
    [allCandles, currentIndex]
  );

  const currentCandle = visibleCandles[visibleCandles.length - 1];
  const currentPrice = currentCandle?.close ?? 0;
  const currentTime = (currentCandle?.time ?? 0) as Time;
  const currentTimeUnix = Number(currentTime || 0);
  const currentIntrabarTrace = useMemo(() => {
    if (!currentCandle) return [];
    return simulationConfig.intrabarMode === "bar-magnifier"
      ? getIntrabarTraceForCandle(currentCandle, timeframe, barMagnifierCandles)
      : getIntrabarPath(currentCandle);
  }, [barMagnifierCandles, currentCandle, simulationConfig.intrabarMode, timeframe]);

  const executionEnvironment = useMemo(() => {
    const profile = getSymbolExecutionProfile(symbol);
    const sessionProfile = getSessionExecutionMultiplier(currentTimeUnix || Math.floor(Date.now() / 1000));
    const eventProfile = getEventImpactMultiplier(calendarEvents, currentTimeUnix);

    return {
      spread:
        profile.baseSpread * sessionProfile.spread * eventProfile.spread,
      slippagePips:
        profile.slippagePips * sessionProfile.slippage * eventProfile.slippage,
      commissionPerLot: profile.commissionPerLot,
      swapPerDayPerLot: profile.swapPerDayPerLot,
      liquidityUnits: profile.sessionLiquidityUnits * sessionProfile.liquidity * eventProfile.liquidity,
      sessionLabel: eventProfile.event ?? sessionProfile.session,
    };
  }, [calendarEvents, currentTimeUnix, symbol]);

  const replayTrades = useMemo(() => {
    return trades
      .filter((trade) => getEntryUnix(trade) <= currentTimeUnix)
      .map((trade) => {
        const exitUnix = getExitUnix(trade);
        if (exitUnix && exitUnix <= currentTimeUnix) {
          return trade;
        }
        const accruedSwap = (trade.swap || 0) + getSwapDays(getEntryUnix(trade), currentTimeUnix) * (executionEnvironment.swapPerDayPerLot * trade.volume);
        const livePnl = currentPrice ? calculatePnL(trade, currentPrice) - (trade.fees || 0) - accruedSwap : 0;
        const livePips = currentPrice ? calculatePips(trade, currentPrice) : 0;
        return {
          ...trade,
          status: "open" as const,
          exitPrice: undefined,
          exitTime: undefined,
          exitTimeUnix: undefined,
          pnl: livePnl,
          pnlPips: livePips,
          realizedRR: trade.slPips && trade.slPips > 0 ? livePips / trade.slPips : undefined,
          swap: accruedSwap,
        };
      });
  }, [calculatePips, calculatePnL, currentPrice, currentTimeUnix, executionEnvironment.swapPerDayPerLot, trades]);

  const openTrades = useMemo(
    () => replayTrades.filter((trade) => trade.status === "open"),
    [replayTrades]
  );
  const replayPendingOrders = useMemo(
    () =>
      pendingOrders.filter(
        (order) =>
          order.createdAtUnix <= currentTimeUnix &&
          (!order.filledAtUnix || order.filledAtUnix > currentTimeUnix) &&
          (!order.cancelledAtUnix || order.cancelledAtUnix > currentTimeUnix)
      ),
    [currentTimeUnix, pendingOrders]
  );
  const closedTrades = useMemo(
    () => replayTrades.filter((trade) => trade.status !== "open"),
    [replayTrades]
  );

  const realizedPnL = useMemo(
    () => closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0),
    [closedTrades]
  );
  const openPnL = useMemo(
    () => openTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0),
    [openTrades]
  );
  const cashBalance = initialBalance + realizedPnL;
  const equity = cashBalance + openPnL;

  const openRisk = useMemo(() => {
    return openTrades.reduce((sum, trade) => {
      if (!trade.sl) return sum;
      return sum + Math.abs(calculatePnL(trade, trade.sl));
    }, 0);
  }, [calculatePnL, openTrades]);

  const stats = useMemo(() => {
    const wins = closedTrades.filter((trade) => (trade.pnl || 0) > 0);
    const losses = closedTrades.filter((trade) => (trade.pnl || 0) < 0);
    const totalWins = wins.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalLosses = Math.abs(
      losses.reduce((sum, trade) => sum + (trade.pnl || 0), 0)
    );
    const rrValues = closedTrades
      .map((trade) => trade.realizedRR)
      .filter((value): value is number => typeof value === "number");
    const avgRR =
      rrValues.length > 0
        ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length
        : 0;
    const noteCoverage =
      replayTrades.length > 0
        ? replayTrades.filter((trade) => trade.notes?.trim()).length / replayTrades.length
        : 0;
    const structureRate =
      replayTrades.length > 0
        ? replayTrades.filter((trade) => trade.sl && trade.tp).length / replayTrades.length
        : 0;
    const rrPlannedRate =
      replayTrades.length > 0
        ? replayTrades.filter(
            (trade) =>
              typeof trade.slPips === "number" &&
              typeof trade.tpPips === "number" &&
              trade.slPips > 0 &&
              trade.tpPips / trade.slPips >= 1.5
          ).length / replayTrades.length
        : 0;
    const processScore = Math.round((noteCoverage * 35 + structureRate * 35 + rrPlannedRate * 30) * 100);

    return {
      total: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      avgRR,
      noteCoverage,
      structureRate,
      processScore,
      averageHoldTime:
        closedTrades.length > 0
          ? closedTrades.reduce((sum, trade) => sum + (trade.holdTimeSeconds || 0), 0) /
            closedTrades.length
          : 0,
    };
  }, [closedTrades, replayTrades]);

  const challengeStatus = useMemo(() => {
    let runningBalance = initialBalance;
    let peakBalance = initialBalance;
    let maxHistoricalDrawdownPct = 0;

    const orderedClosedTrades = [...closedTrades].sort(
      (a, b) => (getExitUnix(a) || getEntryUnix(a)) - (getExitUnix(b) || getEntryUnix(b))
    );

    orderedClosedTrades.forEach((trade) => {
      runningBalance += trade.pnl || 0;
      peakBalance = Math.max(peakBalance, runningBalance);
      const drawdownPct =
        peakBalance > 0 ? ((peakBalance - runningBalance) / peakBalance) * 100 : 0;
      maxHistoricalDrawdownPct = Math.max(maxHistoricalDrawdownPct, drawdownPct);
    });

    const currentDrawdownPct =
      peakBalance > 0 ? ((peakBalance - equity) / peakBalance) * 100 : 0;

    const currentDayKey = currentTimeUnix
      ? new Date(currentTimeUnix * 1000).toISOString().slice(0, 10)
      : null;
    const closedWithExit = closedTrades.filter((trade) => getExitUnix(trade));
    const dayStartBalance =
      currentDayKey === null
        ? initialBalance
        : initialBalance +
          closedWithExit
            .filter((trade) => {
              const exitUnix = getExitUnix(trade);
              return exitUnix
                ? new Date(exitUnix * 1000).toISOString().slice(0, 10) < currentDayKey
                : false;
            })
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const dayClosedPnL =
      currentDayKey === null
        ? 0
        : closedWithExit
            .filter((trade) => {
              const exitUnix = getExitUnix(trade);
              return exitUnix
                ? new Date(exitUnix * 1000).toISOString().slice(0, 10) === currentDayKey
                : false;
            })
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);

    const dayPnL = dayClosedPnL + openPnL;
    const dailyLossPct =
      dayStartBalance > 0 && dayPnL < 0 ? Math.abs(dayPnL / dayStartBalance) * 100 : 0;
    const profitPct = ((equity - initialBalance) / initialBalance) * 100;

    const profitTargetReached =
      challengeConfig.profitTargetPct > 0 && profitPct >= challengeConfig.profitTargetPct;
    const maxDrawdownBreached =
      challengeConfig.maxDrawdownPct > 0 &&
      currentDrawdownPct >= challengeConfig.maxDrawdownPct;
    const dailyLossBreached =
      challengeConfig.dailyLossPct > 0 && dailyLossPct >= challengeConfig.dailyLossPct;

    return {
      profitPct,
      currentDrawdownPct: Math.max(0, currentDrawdownPct),
      maxHistoricalDrawdownPct,
      dailyLossPct,
      dayPnL,
      profitTargetReached,
      maxDrawdownBreached,
      dailyLossBreached,
      challengeLocked:
        challengeConfig.enforce &&
        (profitTargetReached || maxDrawdownBreached || dailyLossBreached),
    };
  }, [challengeConfig, closedTrades, currentTimeUnix, equity, initialBalance, openPnL]);

  const selectedAnnotation = useMemo(
    () => annotations.find((item) => item.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId]
  );

  useEffect(() => {
    if (selectedAnnotation?.label) {
      setAnnotationLabel(selectedAnnotation.label);
      return;
    }
    if (!selectedAnnotation) {
      setAnnotationLabel("POI");
    }
  }, [selectedAnnotation]);

  const tradeSizer = useMemo(() => {
    const riskAmount = cashBalance * (riskPercent / 100);
    const lotSize =
      showSLTP && defaultSLPips > 0
        ? Math.max(0.01, round(riskAmount / (defaultSLPips * 10), 2))
        : 0;
    return {
      riskAmount,
      lotSize,
      targetAtTP:
        showSLTP && defaultTPPips > 0 ? round((defaultTPPips * lotSize * 10) || 0, 2) : 0,
    };
  }, [cashBalance, defaultSLPips, defaultTPPips, riskPercent, showSLTP]);

  const calculatedIndicators = useMemo(() => {
    if (visibleCandles.length < 50) return {};
    const candleData = visibleCandles.map((candle) => ({
      time: candle.time as number,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
    return {
      sma1: indicators.sma1.enabled ? sma(candleData, indicators.sma1.period) : [],
      sma2: indicators.sma2.enabled ? sma(candleData, indicators.sma2.period) : [],
      ema1: indicators.ema1.enabled ? ema(candleData, indicators.ema1.period) : [],
      rsi: indicators.rsi.enabled ? rsi(candleData, indicators.rsi.period) : [],
      macd: indicators.macd.enabled
        ? macd(
            candleData,
            indicators.macd.fastPeriod,
            indicators.macd.slowPeriod,
            indicators.macd.signalPeriod
          )
        : [],
      bb: indicators.bb.enabled
        ? bollingerBands(candleData, indicators.bb.period, indicators.bb.stdDev)
        : [],
      atr: indicators.atr.enabled ? atr(candleData, indicators.atr.period) : [],
    };
  }, [indicators, visibleCandles]);

  const latestIndicators = useMemo(() => {
    const latest: Record<string, number> = {};
    const lastSma1 = calculatedIndicators.sma1?.[calculatedIndicators.sma1.length - 1];
    const lastSma2 = calculatedIndicators.sma2?.[calculatedIndicators.sma2.length - 1];
    const lastEma1 = calculatedIndicators.ema1?.[calculatedIndicators.ema1.length - 1];
    const lastRsi = calculatedIndicators.rsi?.[calculatedIndicators.rsi.length - 1];
    const lastMacd = calculatedIndicators.macd?.[calculatedIndicators.macd.length - 1];
    const lastAtr = calculatedIndicators.atr?.[calculatedIndicators.atr.length - 1];
    const lastBb = calculatedIndicators.bb?.[calculatedIndicators.bb.length - 1];

    if (lastSma1?.value != null) latest.sma1 = lastSma1.value;
    if (lastSma2?.value != null) latest.sma2 = lastSma2.value;
    if (lastEma1?.value != null) latest.ema1 = lastEma1.value;
    if (lastRsi?.value != null) latest.rsi = lastRsi.value;
    if (lastMacd) {
      latest.macd = lastMacd.macd;
      latest.macdSignal = lastMacd.signal;
      latest.macdHist = lastMacd.histogram;
    }
    if (lastAtr?.value != null) latest.atr = lastAtr.value;
    if (lastBb) {
      latest.bbUpper = lastBb.upper;
      latest.bbMiddle = lastBb.middle;
      latest.bbLower = lastBb.lower;
    }
    return latest;
  }, [calculatedIndicators]);

  const indicatorLines = useMemo<IndicatorLine[]>(() => {
    const lines: IndicatorLine[] = [];

    if (indicators.sma1.enabled && calculatedIndicators.sma1?.length) {
      lines.push({
        id: "sma1",
        data: calculatedIndicators.sma1
          .filter((item): item is { time: number; value: number } => item.value != null)
          .map((item) => ({ time: item.time as Time, value: item.value })),
        color: indicators.sma1.color,
        lineWidth: 2,
        title: `SMA ${indicators.sma1.period}`,
      });
    }

    if (indicators.sma2.enabled && calculatedIndicators.sma2?.length) {
      lines.push({
        id: "sma2",
        data: calculatedIndicators.sma2
          .filter((item): item is { time: number; value: number } => item.value != null)
          .map((item) => ({ time: item.time as Time, value: item.value })),
        color: indicators.sma2.color,
        lineWidth: 2,
        title: `SMA ${indicators.sma2.period}`,
      });
    }

    if (indicators.ema1.enabled && calculatedIndicators.ema1?.length) {
      lines.push({
        id: "ema1",
        data: calculatedIndicators.ema1
          .filter((item): item is { time: number; value: number } => item.value != null)
          .map((item) => ({ time: item.time as Time, value: item.value })),
        color: indicators.ema1.color,
        lineWidth: 2,
        title: `EMA ${indicators.ema1.period}`,
      });
    }

    if (indicators.bb.enabled && calculatedIndicators.bb?.length) {
      const data = calculatedIndicators.bb.filter(
        (
          item
        ): item is { time: number; upper: number; middle: number; lower: number } =>
          item.upper != null && item.middle != null && item.lower != null
      );
      lines.push(
        {
          id: "bb-upper",
          data: data.map((item) => ({ time: item.time as Time, value: item.upper })),
          color: "#A855F7",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "BB Upper",
        },
        {
          id: "bb-middle",
          data: data.map((item) => ({ time: item.time as Time, value: item.middle })),
          color: "#A855F7",
          lineWidth: 1,
          title: "BB Mid",
        },
        {
          id: "bb-lower",
          data: data.map((item) => ({ time: item.time as Time, value: item.lower })),
          color: "#A855F7",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "BB Lower",
        }
      );
    }

    return lines;
  }, [calculatedIndicators, indicators]);

  const contextSnapshots = useMemo(() => {
    return activeContextTimeframes
      .map((contextTimeframe) => {
        const candles = contextCandles[contextTimeframe] || [];
        if (!candles.length || !currentTimeUnix) return null;

        const index = nearestCandleIndex(candles, currentTimeUnix);
        const candle = candles[index];
        if (!candle) return null;

        const previous = candles[Math.max(0, index - 1)];
        const deltaPct =
          previous?.close && previous.close !== 0
            ? ((candle.close - previous.close) / previous.close) * 100
            : 0;

        return {
          timeframe: contextTimeframe,
          label: getTimeframeCompactLabel(contextTimeframe),
          bias: candle.close >= candle.open ? "Bull" : "Bear",
          close: candle.close,
          deltaPct,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activeContextTimeframes, contextCandles, currentTimeUnix]);

  const applyAdverseSlippage = useCallback(
    (price: number, direction: "long" | "short", multiplier = 1) => {
      const slippageDistance = executionEnvironment.slippagePips * pipSize * multiplier;
      return direction === "long" ? price + slippageDistance : price - slippageDistance;
    },
    [executionEnvironment.slippagePips, pipSize]
  );

  const markers = useMemo<TradeMarker[]>(() => {
    const result: TradeMarker[] = [];
    replayTrades.forEach((trade) => {
      result.push({
        time: trade.entryTime,
        position: trade.direction === "long" ? "belowBar" : "aboveBar",
        color: trade.direction === "long" ? "#14B8A6" : "#FB7185",
        shape: trade.direction === "long" ? "arrowUp" : "arrowDown",
        size: 0.6,
      });
      if (trade.status !== "open" && trade.exitTime) {
        result.push({
          time: trade.exitTime,
          position:
            trade.status === "stopped"
              ? trade.direction === "long"
                ? "belowBar"
                : "aboveBar"
              : trade.direction === "long"
              ? "aboveBar"
              : "belowBar",
          color:
            trade.status === "target"
              ? "#14B8A6"
              : trade.status === "stopped"
              ? "#FB7185"
              : "#94A3B8",
          shape: "circle",
          size: 0.6,
        });
      }
    });
    return result;
  }, [replayTrades]);

  const priceLines = useMemo<PriceLine[]>(() => {
    const lines: PriceLine[] = [];
    replayPendingOrders.forEach((order) => {
      if (order.orderType === "stop-limit" && order.triggerPrice) {
        lines.push({
          price: order.triggerPrice,
          color: "#C084FC",
          lineWidth: 1,
          lineStyle: "dotted",
          title: `${order.direction === "long" ? "BUY" : "SELL"} TRIGGER`,
          axisLabelVisible: false,
        });
      }
      lines.push({
        price: order.entryPrice,
        color: order.direction === "long" ? "#60A5FA" : "#F59E0B",
        lineWidth: 1,
        lineStyle: "dotted",
        title: `${order.direction === "long" ? "BUY" : "SELL"} ${order.orderType.toUpperCase()} ${Math.max(0, Math.round(order.remainingUnits ?? order.units)).toLocaleString()}`,
        axisLabelVisible: false,
      });
      if (order.sl) {
        lines.push({
          price: order.sl,
          color: "rgba(251,113,133,0.55)",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "SL",
          axisLabelVisible: false,
        });
      }
      if (order.tp) {
        lines.push({
          price: order.tp,
          color: "rgba(20,184,166,0.55)",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "TP",
          axisLabelVisible: false,
        });
      }
    });
    openTrades.forEach((trade) => {
      lines.push({
        price: trade.entryPrice,
        color: "rgba(255,255,255,0.45)",
        lineWidth: 1,
        lineStyle: "dashed",
        title: trade.direction === "long" ? "BUY" : "SELL",
        axisLabelVisible: false,
      });
      if (trade.sl) {
        lines.push({
          price: trade.sl,
          color: "#FB7185",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "SL",
          axisLabelVisible: false,
        });
      }
      if (trade.tp) {
        lines.push({
          price: trade.tp,
          color: "#14B8A6",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "TP",
          axisLabelVisible: false,
        });
      }
    });
    return lines;
  }, [openTrades, replayPendingOrders]);

  const executionOverlays = useMemo<ExecutionOverlay[]>(() => {
    const overlayEndTime = (currentTime || visibleCandles[visibleCandles.length - 1]?.time || 0) as Time;
    const overlays: ExecutionOverlay[] = [];

    replayPendingOrders.forEach((order) => {
      overlays.push({
        id: `order:${order.id}`,
        startTime: order.createdAt,
        endTime: overlayEndTime,
        labelTime: order.createdAt,
        direction: order.direction,
        pending: true,
        levels: {
          trigger:
            typeof order.triggerPrice === "number"
              ? {
                  price: order.triggerPrice,
                  color: "#C084FC",
                  label: "Trigger",
                  draggable: true,
                }
              : undefined,
          entry: {
            price: order.entryPrice,
            color: order.direction === "long" ? "#60A5FA" : "#F59E0B",
            label: `${order.direction === "long" ? "Buy" : "Sell"} ${order.orderType}`,
            draggable: true,
          },
          sl:
            typeof order.sl === "number"
              ? {
                  price: order.sl,
                  color: "#FB7185",
                  label: "SL",
                  draggable: true,
                }
              : undefined,
          tp:
            typeof order.tp === "number"
              ? {
                  price: order.tp,
                  color: "#14B8A6",
                  label: "TP",
                  draggable: true,
                }
              : undefined,
        },
      });
    });

    openTrades.forEach((trade) => {
      const tradeLocked = isTradeHistoricallyClosed(trade.id);
      overlays.push({
        id: `trade:${trade.id}`,
        startTime: trade.entryTime,
        endTime: overlayEndTime,
        labelTime: trade.entryTime,
        direction: trade.direction,
        levels: {
          entry: {
            price: trade.entryPrice,
            color: trade.direction === "long" ? "#14B8A6" : "#FB7185",
            label: trade.direction === "long" ? "Long entry" : "Short entry",
          },
          sl:
            typeof trade.sl === "number"
              ? {
                  price: trade.sl,
                  color: "#FB7185",
                  label: "SL",
                  draggable: !tradeLocked,
                }
              : undefined,
          tp:
            typeof trade.tp === "number"
              ? {
                  price: trade.tp,
                  color: "#14B8A6",
                  label: "TP",
                  draggable: !tradeLocked,
                }
              : undefined,
        },
      });
    });

    return overlays;
  }, [currentTime, isTradeHistoricallyClosed, openTrades, replayPendingOrders, visibleCandles]);

  const persistTradeLocally = useCallback(
    (tradeId: string, patch: Partial<BacktestTrade>) => {
      setTrades((previous) =>
        previous.map((trade) => (trade.id === tradeId ? { ...trade, ...patch } : trade))
      );
    },
    []
  );

  const finalizeTrade = useCallback(
    async (
      trade: BacktestTrade,
      exitPrice: number,
      exitType: "sl" | "tp" | "manual" | "session_end",
      exitUnix: number
    ) => {
      const accruedSwap = (trade.swap || 0) + getSwapDays(getEntryUnix(trade), exitUnix) * (executionEnvironment.swapPerDayPerLot * trade.volume);
      const pnl = calculatePnL(trade, exitPrice) - (trade.fees || 0) - accruedSwap;
      const pnlPips = calculatePips(trade, exitPrice);
      const expectedExitPrice =
        exitType === "sl"
          ? trade.sl ?? exitPrice
          : exitType === "tp"
          ? trade.tp ?? exitPrice
          : currentPrice || exitPrice;
      const exitSlippagePips = Math.abs(exitPrice - expectedExitPrice) / pipSize;
      const realizedRR =
        typeof trade.slPips === "number" && trade.slPips > 0 ? pnlPips / trade.slPips : undefined;
      const holdTimeSeconds = Math.max(0, exitUnix - getEntryUnix(trade));
      const mfePips =
        Math.max(tradeMfeRef.current[trade.id] || 0, trade.mfePips || 0) || undefined;
      const maePips =
        Math.max(tradeMaeRef.current[trade.id] || 0, trade.maePips || 0) || undefined;

      try {
        await trpcClient.backtest.closeTrade.mutate({
          tradeId: trade.id,
          exitPrice,
          exitTime: new Date(exitUnix * 1000).toISOString(),
          exitTimeUnix: exitUnix,
          exitType,
          pnl,
          pnlPips,
          realizedRR,
          mfePips,
          maePips,
          holdTimeSeconds,
          swap: accruedSwap,
          exitSlippagePips,
        });
      } catch (err) {
        console.error("Failed to close trade:", err);
        toast.error("Failed to close trade");
        throw err;
      }

      persistTradeLocally(trade.id, {
        status:
          exitType === "sl" ? "stopped" : exitType === "tp" ? "target" : "closed",
        exitPrice,
        exitTime: exitUnix as Time,
        exitTimeUnix: exitUnix,
        exitType,
        pnl,
        pnlPips,
        realizedRR,
        mfePips,
        maePips,
        holdTimeSeconds,
        swap: accruedSwap,
        exitSlippagePips,
      });
    },
    [
      calculatePips,
      calculatePnL,
      currentPrice,
      executionEnvironment.swapPerDayPerLot,
      persistTradeLocally,
      pipSize,
    ]
  );

  const createExecutedTrade = useCallback(
    async ({
      direction,
      entryPrice,
      entryUnix,
      volume,
      sl,
      tp,
      slPips,
      tpPips,
      riskPercent: tradeRiskPercent,
      notes,
      tags,
      entryBalance,
      fees,
      commission,
      swap,
      entrySpreadPips,
      entrySlippagePips,
      slippagePrice,
    }: {
      direction: "long" | "short";
      entryPrice: number;
      entryUnix: number;
      volume: number;
      sl?: number;
      tp?: number;
      slPips?: number;
      tpPips?: number;
      riskPercent?: number;
      notes?: string;
      tags?: string[];
      entryBalance?: number;
      fees?: number;
      commission?: number;
      swap?: number;
      entrySpreadPips?: number;
      entrySlippagePips?: number;
      slippagePrice?: number;
    }) => {
      if (!sessionId) {
        throw new Error("Session unavailable");
      }

      const dbTrade = await trpcClient.backtest.addTrade.mutate({
        sessionId,
        direction,
        entryPrice,
        entryTime: new Date(entryUnix * 1000).toISOString(),
        entryTimeUnix: entryUnix,
        entryBalance,
        sl,
        tp,
        slPips,
        tpPips,
        riskPercent: tradeRiskPercent,
        volume,
        fees,
        commission,
        swap,
        entrySpreadPips,
        entrySlippagePips,
        slippagePrice,
        notes: notes?.trim() || undefined,
        tags: tags?.filter(Boolean) || [],
        entryIndicatorValues: {
          rsi: latestIndicators.rsi,
          macd: latestIndicators.macd,
          macdSignal: latestIndicators.macdSignal,
          atr: latestIndicators.atr,
          sma1: latestIndicators.sma1,
          sma2: latestIndicators.sma2,
          ema1: latestIndicators.ema1,
          bbUpper: latestIndicators.bbUpper,
          bbMiddle: latestIndicators.bbMiddle,
          bbLower: latestIndicators.bbLower,
        },
      });

      setTrades((previous) => [
        ...previous,
        {
          id: dbTrade.id,
          direction,
          entryPrice,
          entryTime: entryUnix as Time,
          entryTimeUnix: entryUnix,
          sl,
          tp,
          slPips,
          tpPips,
          riskPercent: tradeRiskPercent,
          volume,
          status: "open",
          notes: notes?.trim() || undefined,
          tags: tags?.filter(Boolean) || [],
          entryBalance,
          fees,
          commission,
          swap,
          entrySpreadPips,
          entrySlippagePips,
          slippagePrice,
        },
      ]);
      tradeMfeRef.current[dbTrade.id] = 0;
      tradeMaeRef.current[dbTrade.id] = 0;

      return dbTrade.id;
    },
    [latestIndicators, sessionId]
  );

  useEffect(() => {
    if (!currentCandle) return;

    const watchlist = trades.filter(
      (trade) => getEntryUnix(trade) <= currentTimeUnix && !getExitUnix(trade)
    );

    if (!watchlist.length) return;

    const intrabarPath = currentIntrabarTrace;
    watchlist.forEach((trade) => {
      const favorablePrice =
        trade.direction === "long" ? currentCandle.high : currentCandle.low;
      const adversePrice =
        trade.direction === "long" ? currentCandle.low : currentCandle.high;

      const favorablePips =
        trade.direction === "long"
          ? (favorablePrice - trade.entryPrice) / pipSize
          : (trade.entryPrice - favorablePrice) / pipSize;
      const adversePips =
        trade.direction === "long"
          ? (trade.entryPrice - adversePrice) / pipSize
          : (adversePrice - trade.entryPrice) / pipSize;

      tradeMfeRef.current[trade.id] = Math.max(
        tradeMfeRef.current[trade.id] || 0,
        favorablePips
      );
      tradeMaeRef.current[trade.id] = Math.max(
        tradeMaeRef.current[trade.id] || 0,
        adversePips
      );

      const hitOrder = resolvePathHitOrder(
        intrabarPath,
        [
          trade.sl ? { key: "sl", price: trade.sl } : null,
          trade.tp ? { key: "tp", price: trade.tp } : null,
        ].filter((item): item is { key: string; price: number } => Boolean(item))
      );

      const firstHit = hitOrder[0];
      if (!firstHit) return;

      if (firstHit.key === "sl" && trade.sl) {
        void finalizeTrade(
          trade,
          applyAdverseSlippage(trade.sl, trade.direction, 0.6),
          "sl",
          currentTimeUnix
        );
        return;
      }

      if (firstHit.key === "tp" && trade.tp) {
        void finalizeTrade(trade, trade.tp, "tp", currentTimeUnix);
      }
    });
  }, [applyAdverseSlippage, currentCandle, currentIntrabarTrace, currentTimeUnix, finalizeTrade, pipSize, trades]);

  useEffect(() => {
    if (!currentCandle || !replayPendingOrders.length) return;

    const intrabarPath = currentIntrabarTrace;
    replayPendingOrders.forEach((order) => {
      if (order.expiresAtUnix && currentTimeUnix > order.expiresAtUnix) {
        setPendingOrders((previous) =>
          previous.map((candidate) =>
            candidate.id === order.id && !candidate.cancelledAtUnix
              ? {
                  ...candidate,
                  cancelledAtUnix: order.expiresAtUnix,
                  cancelReason: "expired",
                }
              : candidate
          )
        );
        return;
      }

      if (pendingOrderProcessingRef.current.has(order.id)) return;

      const remainingUnits = Math.max(0, Math.round(order.remainingUnits ?? order.units));
      if (remainingUnits <= 0) return;

      const isTriggered =
        order.orderType !== "stop-limit" ||
        Boolean(order.activatedAtUnix) ||
        (typeof order.triggerPrice === "number" &&
          resolvePathHitOrder(intrabarPath, [{ key: "trigger", price: order.triggerPrice }]).length > 0);

      if (order.orderType === "stop-limit" && !order.activatedAtUnix && isTriggered) {
        setPendingOrders((previous) =>
          previous.map((candidate) =>
            candidate.id === order.id
              ? {
                  ...candidate,
                  activatedAtUnix: currentTimeUnix,
                }
              : candidate
          )
        );
      }

      const workingType =
        order.orderType === "stop-limit" && isTriggered ? "limit" : order.orderType;
      const shouldFill =
        workingType === "limit"
          ? order.direction === "long"
            ? currentCandle.low <= order.entryPrice
            : currentCandle.high >= order.entryPrice
          : order.direction === "long"
          ? currentCandle.high >= order.entryPrice
          : currentCandle.low <= order.entryPrice;

      if (!shouldFill || (order.orderType === "stop-limit" && !isTriggered)) return;

      pendingOrderProcessingRef.current.add(order.id);
      void (async () => {
        try {
          const candleLiquidityUnits = Math.max(
            1000,
            Math.round(
              executionEnvironment.liquidityUnits *
                clamp(((currentCandle.volume || 0) / 40000) + 0.45, 0.35, 1.6)
            )
          );
          const fillUnits = Math.min(remainingUnits, candleLiquidityUnits);
          const fillVolume = Math.max(0.01, round(fillUnits / 100000, 2));
          const fillPrice =
            workingType === "limit"
              ? applyAdverseSlippage(order.entryPrice, order.direction, 0.2)
              : applyAdverseSlippage(order.entryPrice, order.direction, 0.75);
          const fees = executionEnvironment.commissionPerLot * fillVolume;
          const tradeId = await createExecutedTrade({
            direction: order.direction,
            entryPrice: fillPrice,
            entryUnix: currentTimeUnix,
            volume: fillVolume,
            sl: order.sl,
            tp: order.tp,
            slPips: order.slPips,
            tpPips: order.tpPips,
            riskPercent: order.riskPercent,
            notes: order.notes,
            tags: order.tags,
            entryBalance: cashBalance,
            fees,
            commission: fees,
            entrySpreadPips: executionEnvironment.spread / pipSize,
            entrySlippagePips: Math.abs(fillPrice - order.entryPrice) / pipSize,
            slippagePrice: Math.abs(fillPrice - order.entryPrice),
          });

          setPendingOrders((previous) =>
            previous.map((candidate) => {
              if (candidate.id === order.id) {
                const nextRemaining = Math.max(
                  0,
                  Math.round((candidate.remainingUnits ?? candidate.units) - fillUnits)
                );
                return {
                  ...candidate,
                  remainingUnits: nextRemaining,
                  filledAtUnix: nextRemaining === 0 ? currentTimeUnix : undefined,
                  filledTradeId: nextRemaining === 0 ? tradeId : candidate.filledTradeId,
                  fillTradeIds: [...(candidate.fillTradeIds || []), tradeId],
                };
              }
              if (
                order.linkedOcoGroupId &&
                candidate.linkedOcoGroupId === order.linkedOcoGroupId &&
                candidate.id !== order.id &&
                !candidate.cancelledAtUnix &&
                !candidate.filledAtUnix
              ) {
                return {
                  ...candidate,
                  cancelledAtUnix: currentTimeUnix,
                  cancelReason: "manual",
                };
              }
              return candidate;
            })
          );
          toast.success(
            `${order.direction === "long" ? "Buy" : "Sell"} ${order.orderType} ${fillUnits < remainingUnits ? "partially filled" : "filled"} at ${formatPrice(symbol, fillPrice)}`
          );
        } catch (err) {
          console.error("Failed to fill pending order:", err);
          toast.error("Failed to fill pending order");
        } finally {
          pendingOrderProcessingRef.current.delete(order.id);
        }
      })();
    });
  }, [
    applyAdverseSlippage,
    cashBalance,
    createExecutedTrade,
    currentCandle,
    currentIntrabarTrace,
    currentTimeUnix,
    executionEnvironment.commissionPerLot,
    executionEnvironment.liquidityUnits,
    replayPendingOrders,
    symbol,
  ]);

  const saveSession = useCallback(async () => {
    if (!sessionId) return;
    setIsSaving(true);
    try {
      const payload = buildSessionPayload();
      await trpcClient.backtest.updateSession.mutate(payload);
      lastSavedSnapshotRef.current = JSON.stringify(payload);
      toast.success("Session saved");
    } catch (err) {
      console.error("Failed to save session:", err);
      toast.error("Failed to save session");
    } finally {
      setIsSaving(false);
    }
  }, [buildSessionPayload, sessionId]);

  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations((previous) => previous.filter((item) => item.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  }, [selectedAnnotationId]);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
  }, []);

  const handleAnnotationLabelChange = useCallback(
    (value: string) => {
      setAnnotationLabel(value);
      if (!selectedAnnotationId) return;
      setAnnotations((previous) =>
        previous.map((item) =>
          item.id === selectedAnnotationId
            ? {
                ...item,
                label: value,
              }
            : item
        )
      );
    },
    [selectedAnnotationId]
  );

  const stepReplay = useCallback(
    (delta: number) => {
      setCurrentIndex((previous) => clamp(previous + delta, 0, Math.max(allCandles.length - 1, 0)));
      setIsPlaying(false);
    },
    [allCandles.length]
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying((previous) => !previous);
  }, []);

  const handleRestart = useCallback(() => {
    const restartIndex = allCandles.length > 0 ? Math.min(120, allCandles.length - 1) : 0;
    setCurrentIndex(restartIndex);
    setGoToDateTime(toDateTimeLocalValue(allCandles[restartIndex]?.time ?? null));
    setIsPlaying(false);
  }, [allCandles]);

  const addCheckpoint = useCallback(() => {
    if (!currentCandle || !currentTimeUnix) return;
    const nextCheckpoint: ReplayCheckpoint = {
      id: crypto.randomUUID(),
      label: format(new Date(currentTimeUnix * 1000), "MMM d HH:mm"),
      timeUnix: currentTimeUnix,
      createdAtUnix: Math.floor(Date.now() / 1000),
    };

    setCheckpoints((previous) => {
      const withoutDuplicate = previous.filter(
        (checkpoint) => Math.abs(checkpoint.timeUnix - nextCheckpoint.timeUnix) > 1
      );
      return [...withoutDuplicate, nextCheckpoint].sort((a, b) => a.timeUnix - b.timeUnix);
    });
    setSelectedCheckpointId(nextCheckpoint.id);
    toast.success("Checkpoint saved");
  }, [currentCandle, currentTimeUnix]);

  const jumpToCheckpoint = useCallback(
    (checkpointId: string) => {
      const checkpoint = checkpoints.find((item) => item.id === checkpointId);
      if (!checkpoint || !allCandles.length) return;
      const nextIndex = nearestCandleIndex(allCandles, checkpoint.timeUnix);
      setCurrentIndex(nextIndex);
      setGoToDateTime(toDateTimeLocalValue(allCandles[nextIndex]?.time ?? checkpoint.timeUnix));
      setSelectedCheckpointId(checkpointId);
      setIsPlaying(false);
    },
    [allCandles, checkpoints]
  );

  const applySharedSnapshot = useCallback(
    (snapshotId: string) => {
      const snapshot = sharedSnapshots.find((item) => item.id === snapshotId);
      if (!snapshot || !allCandles.length) return;

      const nextIndex = clamp(snapshot.currentIndex, 0, Math.max(allCandles.length - 1, 0));
      setCurrentIndex(nextIndex);
      setLayoutPreset(snapshot.layoutPreset);
      setWorkspaceTab(snapshot.workspaceTab);
      setSelectedContextTimeframes(snapshot.selectedContextTimeframes);
      setContextPanePositions(snapshot.contextPanePositions);
      setContextDockAssignments(snapshot.contextDockAssignments);
      setContextPaneModes(snapshot.contextPaneModes);
      setAnnotations(snapshot.annotations);
      setSelectedSharedSnapshotId(snapshot.id);
      setGoToDateTime(toDateTimeLocalValue(allCandles[nextIndex]?.time ?? snapshot.timeUnix));
      setIsPlaying(false);
      toast.success("Snapshot restored");
    },
    [allCandles, sharedSnapshots]
  );

  useEffect(() => {
    if (!snapshotIdParam || !allCandles.length) return;
    if (appliedSnapshotRef.current === snapshotIdParam) return;
    if (!sharedSnapshots.some((item) => item.id === snapshotIdParam)) return;

    appliedSnapshotRef.current = snapshotIdParam;
    applySharedSnapshot(snapshotIdParam);
  }, [allCandles.length, applySharedSnapshot, sharedSnapshots, snapshotIdParam]);

  const createSharedSnapshot = useCallback(() => {
    if (!currentCandle || !currentTimeUnix) return;

    const snapshot: ReplaySharedSnapshot = {
      id: crypto.randomUUID(),
      label: `${symbol} ${getTimeframeCompactLabel(timeframe)} · ${format(new Date(currentTimeUnix * 1000), "MMM d HH:mm")}`,
      createdAtUnix: Math.floor(Date.now() / 1000),
      timeUnix: currentTimeUnix,
      currentIndex,
      layoutPreset,
      workspaceTab,
      selectedContextTimeframes: activeContextTimeframes,
      contextPanePositions,
      contextDockAssignments,
      contextPaneModes,
      annotations,
    };

    setSharedSnapshots((previous) => [snapshot, ...previous].slice(0, 12));
    setSelectedSharedSnapshotId(snapshot.id);
    toast.success("Replay snapshot saved");
  }, [
    activeContextTimeframes,
    annotations,
    contextDockAssignments,
    contextPanePositions,
    contextPaneModes,
    currentCandle,
    currentIndex,
    currentTimeUnix,
    layoutPreset,
    symbol,
    timeframe,
    workspaceTab,
  ]);

  const copySharedSnapshotLink = useCallback(
    async (snapshotId: string) => {
      if (!sessionId || typeof window === "undefined" || !navigator.clipboard) return;

      const url = `${window.location.origin}/backtest/replay?sessionId=${sessionId}&snapshot=${snapshotId}`;
      await navigator.clipboard.writeText(url);
      toast.success("Snapshot link copied");
    },
    [sessionId]
  );

  const saveCurrentPattern = useCallback(() => {
    if (!currentCandle || !currentTimeUnix) return;
    const featureVector = buildPatternFeatureVector(allCandles, currentIndex, pipSize);
    if (!featureVector) return;

    const pattern: ReplayPatternTemplate = {
      id: crypto.randomUUID(),
      name: `${symbol} ${getTimeframeCompactLabel(timeframe)} · ${format(new Date(currentTimeUnix * 1000), "MMM d HH:mm")}`,
      createdAtUnix: Math.floor(Date.now() / 1000),
      anchorTimeUnix: currentTimeUnix,
      symbol,
      timeframe,
      featureVector,
      note: nextTradeNotes.trim() || undefined,
    };

    setPatternLibrary((previous) => [pattern, ...previous].slice(0, 20));
    setSelectedPatternId(pattern.id);
    toast.success("Pattern saved to library");
  }, [
    allCandles,
    currentCandle,
    currentIndex,
    currentTimeUnix,
    nextTradeNotes,
    pipSize,
    symbol,
    timeframe,
  ]);

  const applyLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutPreset(preset);
    if (preset === "chart-only") {
      setShowRightPanel(false);
      setShowBottomPanel(false);
      return;
    }
    if (preset === "review") {
      setShowRightPanel(false);
      setShowBottomPanel(true);
      setWorkspaceTab("review");
      return;
    }
    if (preset === "coach") {
      setShowRightPanel(true);
      setShowBottomPanel(true);
      setWorkspaceTab("review");
      return;
    }

    setShowRightPanel(true);
    setShowBottomPanel(true);
  }, []);

  const jumpToDateTime = useCallback(() => {
    if (!goToDateTime || !allCandles.length) return;
    const targetUnix = Math.floor(new Date(goToDateTime).getTime() / 1000);
    if (!Number.isFinite(targetUnix)) return;
    const nextIndex = nearestCandleIndex(allCandles, targetUnix);
    setCurrentIndex(nextIndex);
    setIsPlaying(false);
  }, [allCandles, goToDateTime]);

  useEffect(() => {
    if (!isPlaying) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= allCandles.length - 1) {
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 180 / playbackSpeed);
    return () => window.clearInterval(intervalId);
  }, [allCandles.length, isPlaying, playbackSpeed]);

  const cancelPendingOrder = useCallback(
    (orderId: string) => {
      setPendingOrders((previous) =>
        previous.map((order) =>
          order.id === orderId
            ? {
                ...order,
                cancelledAtUnix: currentTimeUnix,
                cancelReason: "manual",
              }
            : order
        )
      );
      toast.success("Pending order cancelled");
    },
    [currentTimeUnix]
  );

  const openTrade = useCallback(
    async (
      direction: "long" | "short",
      overrides?: { price?: number; mode?: "market" | "limit" | "stop" | "stop-limit" }
    ) => {
      if (!sessionId || !currentCandle) return;
      if (challengeStatus.challengeLocked) {
        toast.error("Challenge rules are locked. Reset or start a new session.");
        return;
      }
      if (showSLTP && defaultSLPips <= 0) {
        toast.error("Stop loss must be above 0 pips");
        return;
      }

      const currentBidPrice = currentPrice ? Math.max(0, currentPrice - pipSize / 2) : 0;
      const currentAskPrice = currentPrice ? currentPrice + pipSize / 2 : 0;
      const fallbackUnits = Math.max(1000, Math.round(Math.max(tradeSizer.lotSize, 0.01) * 100000));
      const effectiveEntryMode = overrides?.mode ?? entryMode;
      const requestedUnits = parseUnitsInput(ticketUnits);
      const normalizedUnits =
        Number.isFinite(requestedUnits) && requestedUnits > 0 ? requestedUnits : fallbackUnits;
      const volume = Math.max(0.01, round(normalizedUnits / 100000, 2));

      const requestedPrice =
        effectiveEntryMode === "market"
          ? direction === "long"
            ? currentAskPrice
            : currentBidPrice
          : overrides?.price ?? Number(ticketPrice || formatPrice(symbol, currentPrice || 0));
      const secondaryPrice =
        effectiveEntryMode === "stop-limit"
          ? Number(ticketSecondaryPrice || ticketPrice || formatPrice(symbol, currentPrice || 0))
          : requestedPrice;

      if (!Number.isFinite(requestedPrice) || requestedPrice <= 0) {
        toast.error("Order price must be a valid positive number");
        return;
      }
      if (!Number.isFinite(secondaryPrice) || secondaryPrice <= 0) {
        toast.error("Order price must be a valid positive number");
        return;
      }

      if (effectiveEntryMode === "limit") {
        const invalidLimit =
          direction === "long"
            ? requestedPrice > currentAskPrice
            : requestedPrice < currentBidPrice;
        if (invalidLimit) {
          toast.error(
            direction === "long"
              ? "Buy limit must be at or below the current ask"
              : "Sell limit must be at or above the current bid"
          );
          return;
        }
      }

      if (effectiveEntryMode === "stop") {
        const invalidStop =
          direction === "long"
            ? requestedPrice < currentAskPrice
            : requestedPrice > currentBidPrice;
        if (invalidStop) {
          toast.error(
            direction === "long"
              ? "Buy stop must be at or above the current ask"
              : "Sell stop must be at or below the current bid"
          );
          return;
        }
      }

      if (effectiveEntryMode === "stop-limit") {
        const invalidStopLimit =
          direction === "long"
            ? requestedPrice < currentAskPrice || secondaryPrice < currentAskPrice
            : requestedPrice > currentBidPrice || secondaryPrice > currentBidPrice;
        if (invalidStopLimit) {
          toast.error(
            direction === "long"
              ? "Buy stop-limit must stage above the current ask"
              : "Sell stop-limit must stage below the current bid"
          );
          return;
        }
      }

      const sl =
        direction === "long"
          ? (effectiveEntryMode === "stop-limit" ? secondaryPrice : requestedPrice) - defaultSLPips * pipSize
          : (effectiveEntryMode === "stop-limit" ? secondaryPrice : requestedPrice) + defaultSLPips * pipSize;
      const tp =
        direction === "long"
          ? (effectiveEntryMode === "stop-limit" ? secondaryPrice : requestedPrice) + defaultTPPips * pipSize
          : (effectiveEntryMode === "stop-limit" ? secondaryPrice : requestedPrice) - defaultTPPips * pipSize;

      try {
        const tags = parseTags(nextTradeTags);
        if (effectiveEntryMode === "market") {
          const executionPrice = applyAdverseSlippage(
            requestedPrice,
            direction,
            1
          );
          const fees = executionEnvironment.commissionPerLot * volume;
          await createExecutedTrade({
            direction,
            entryPrice: executionPrice,
            entryUnix: currentTimeUnix,
            volume,
            sl: showSLTP ? sl : undefined,
            tp: showSLTP ? tp : undefined,
            slPips: showSLTP ? defaultSLPips : undefined,
            tpPips: showSLTP ? defaultTPPips : undefined,
            riskPercent,
            notes: nextTradeNotes,
            tags,
            entryBalance: cashBalance,
            fees,
            commission: fees,
            entrySpreadPips: executionEnvironment.spread / pipSize,
            entrySlippagePips: Math.abs(executionPrice - requestedPrice) / pipSize,
            slippagePrice: Math.abs(executionPrice - requestedPrice),
          });
        } else {
          const ocoGroupId =
            ocoEnabled && replayPendingOrders.length ? crypto.randomUUID() : undefined;
          setPendingOrders((previous) => {
            const activeCandidate = ocoGroupId
              ? [...previous]
                  .reverse()
                  .find((candidate) => !candidate.filledAtUnix && !candidate.cancelledAtUnix)
              : undefined;

            return [
              ...previous.map((candidate) =>
                activeCandidate && candidate.id === activeCandidate.id
                  ? {
                      ...candidate,
                      linkedOcoGroupId: ocoGroupId,
                    }
                  : candidate
              ),
              {
                id: crypto.randomUUID(),
                direction,
                orderType: effectiveEntryMode,
                entryPrice: effectiveEntryMode === "stop-limit" ? secondaryPrice : requestedPrice,
                triggerPrice: effectiveEntryMode === "stop-limit" ? requestedPrice : undefined,
                createdAt: currentTime,
                createdAtUnix: currentTimeUnix,
                expiresAtUnix: getTimeInForceExpiryUnix(currentTimeUnix, timeInForce),
                timeInForce,
                sl: showSLTP ? sl : undefined,
                tp: showSLTP ? tp : undefined,
                slPips: showSLTP ? defaultSLPips : undefined,
                tpPips: showSLTP ? defaultTPPips : undefined,
                riskPercent,
                volume,
                units: normalizedUnits,
                remainingUnits: normalizedUnits,
                linkedOcoGroupId: ocoGroupId,
                notes: nextTradeNotes.trim() || undefined,
                tags,
              },
            ];
          });
          toast.success(
            `${direction === "long" ? "Buy" : "Sell"} ${effectiveEntryMode} queued at ${formatPrice(symbol, requestedPrice)}`
          );
        }

        setNextTradeNotes("");
        setNextTradeTags("");
      } catch (err) {
        console.error("Failed to open trade:", err);
        toast.error("Failed to open trade");
      }
    },
    [
      cashBalance,
      challengeStatus.challengeLocked,
      createExecutedTrade,
      currentCandle,
      currentPrice,
      currentTime,
      currentTimeUnix,
      defaultSLPips,
      defaultTPPips,
      entryMode,
      executionEnvironment.commissionPerLot,
      nextTradeNotes,
      nextTradeTags,
      ocoEnabled,
      pipSize,
      riskPercent,
      replayPendingOrders,
      sessionId,
      showSLTP,
      symbol,
      ticketPrice,
      ticketSecondaryPrice,
      ticketUnits,
      timeInForce,
      tradeSizer.lotSize,
      applyAdverseSlippage,
    ]
  );

  const handleChartOrderPlacement = useCallback(
    async ({ price }: { time: Time; price: number }) => {
      if (!chartOrderSide) return;
      const currentBidPrice = currentPrice ? Math.max(0, currentPrice - executionEnvironment.spread / 2) : 0;
      const currentAskPrice = currentPrice ? currentPrice + executionEnvironment.spread / 2 : 0;

      const inferredMode =
        entryMode === "market"
          ? chartOrderSide === "long"
            ? price >= currentAskPrice
              ? "stop"
              : "limit"
            : price <= currentBidPrice
            ? "stop"
            : "limit"
          : entryMode;

      setTicketPrice(formatPrice(symbol, price));
      if (entryMode === "market") {
        setEntryMode(inferredMode);
      }

      await openTrade(chartOrderSide, {
        price,
        mode: inferredMode,
      });
      setChartOrderSide(null);
    },
    [chartOrderSide, currentPrice, entryMode, executionEnvironment.spread, openTrade, symbol]
  );

  const closeTradeAtMarket = useCallback(
    async (tradeId: string, exitType: "manual" | "session_end" = "manual") => {
      const trade = trades.find((candidate) => candidate.id === tradeId);
      if (!trade || !currentCandle) return;
      if (getExitUnix(trade)) {
        toast.error("Completed trades are locked during review");
        return;
      }
      await finalizeTrade(trade, currentPrice, exitType, currentTimeUnix);
    },
    [currentCandle, currentPrice, currentTimeUnix, finalizeTrade, trades]
  );

  const persistTradeLevels = useCallback(
    async (tradeId: string, nextSlRaw: string, nextTpRaw: string) => {
      const trade = trades.find((candidate) => candidate.id === tradeId);
      if (!trade) return;
      if (getExitUnix(trade)) {
        toast.error("Completed trades are locked during review");
        return;
      }
      const sl = nextSlRaw.trim() === "" ? null : Number(nextSlRaw);
      const tp = nextTpRaw.trim() === "" ? null : Number(nextTpRaw);

      if ((sl !== null && Number.isNaN(sl)) || (tp !== null && Number.isNaN(tp))) {
        toast.error("SL/TP must be valid numbers");
        return;
      }

      const nextSlPips =
        typeof sl === "number" ? Math.abs((sl - trade.entryPrice) / pipSize) : null;
      const nextTpPips =
        typeof tp === "number" ? Math.abs((tp - trade.entryPrice) / pipSize) : null;

      try {
        await trpcClient.backtest.updateTrade.mutate({
          tradeId,
          sl,
          tp,
          slPips: nextSlPips,
          tpPips: nextTpPips,
        });
        persistTradeLocally(tradeId, {
          sl: sl ?? undefined,
          tp: tp ?? undefined,
          slPips: nextSlPips ?? undefined,
          tpPips: nextTpPips ?? undefined,
        });
        setTradeDrafts((previous) => ({
          ...previous,
          [tradeId]: {
            sl: nextSlRaw,
            tp: nextTpRaw,
          },
        }));
        toast.success("Trade levels updated");
      } catch (err) {
        console.error("Failed to update trade:", err);
        toast.error("Failed to update trade levels");
      }
    },
    [persistTradeLocally, pipSize, trades]
  );

  const saveTradeLevels = useCallback(
    async (tradeId: string) => {
      const draft = tradeDrafts[tradeId];
      if (!draft) return;
      await persistTradeLevels(tradeId, draft.sl, draft.tp);
    },
    [persistTradeLevels, tradeDrafts]
  );

  const moveTradeToBreakEven = useCallback(
    async (tradeId: string) => {
      const trade = trades.find((candidate) => candidate.id === tradeId);
      if (!trade) return;
      const nextSl = trade.entryPrice.toString();
      const nextTp = tradeDrafts[tradeId]?.tp ?? trade.tp?.toString() ?? "";
      await persistTradeLevels(tradeId, nextSl, nextTp);
    },
    [persistTradeLevels, tradeDrafts, trades]
  );

  const handleExecutionOverlayChange = useCallback(
    (overlayId: string, levelKey: ExecutionOverlayLevelKey, price: number) => {
      const livePriceDecimals = symbol.includes("JPY") || symbol.includes("XAU") ? 3 : 5;
      const liveBidPrice = currentPrice ? Math.max(0, currentPrice - executionEnvironment.spread / 2) : 0;
      const liveAskPrice = currentPrice ? currentPrice + executionEnvironment.spread / 2 : 0;
      const normalizedPrice = Number(price.toFixed(livePriceDecimals));

      if (overlayId.startsWith("trade:")) {
        const tradeId = overlayId.replace("trade:", "");
        if (isTradeHistoricallyClosed(tradeId)) return;
        if (levelKey !== "sl" && levelKey !== "tp") return;

        const trade = trades.find((candidate) => candidate.id === tradeId);
        persistTradeLocally(tradeId, {
          [levelKey]: normalizedPrice,
          slPips:
            levelKey === "sl" && trade
              ? Math.abs((normalizedPrice - trade.entryPrice) / pipSize)
              : trade?.slPips,
          tpPips:
            levelKey === "tp" && trade
              ? Math.abs((normalizedPrice - trade.entryPrice) / pipSize)
              : trade?.tpPips,
        });
        setTradeDrafts((previous) => ({
          ...previous,
          [tradeId]: {
            sl:
              levelKey === "sl"
                ? normalizedPrice.toString()
                : previous[tradeId]?.sl ?? trade?.sl?.toString() ?? "",
            tp:
              levelKey === "tp"
                ? normalizedPrice.toString()
                : previous[tradeId]?.tp ?? trade?.tp?.toString() ?? "",
          },
        }));
        return;
      }

      if (!overlayId.startsWith("order:")) return;
      const orderId = overlayId.replace("order:", "");

      setPendingOrders((previous) =>
        previous.map((order) => {
          if (order.id !== orderId) return order;

          const nextOrder: BacktestPendingOrder =
            levelKey === "trigger"
              ? { ...order, triggerPrice: normalizedPrice }
              : levelKey === "entry"
              ? {
                  ...order,
                  entryPrice: normalizedPrice,
                  orderType:
                    order.orderType === "stop-limit"
                      ? "stop-limit"
                      : order.direction === "long"
                      ? normalizedPrice <= liveAskPrice
                        ? "limit"
                        : "stop"
                      : normalizedPrice >= liveBidPrice
                      ? "limit"
                      : "stop",
                }
              : levelKey === "sl"
              ? { ...order, sl: normalizedPrice }
              : { ...order, tp: normalizedPrice };

          return recalculatePendingOrderRisk(nextOrder, pipSize);
        })
      );
    },
    [currentPrice, executionEnvironment.spread, isTradeHistoricallyClosed, persistTradeLocally, pipSize, symbol, trades]
  );

  const handleExecutionOverlayCommit = useCallback(
    async (overlayId: string, levelKey: ExecutionOverlayLevelKey) => {
      if (overlayId.startsWith("trade:")) {
        const tradeId = overlayId.replace("trade:", "");
        if (isTradeHistoricallyClosed(tradeId)) {
          toast.error("Completed trades are locked during review");
          return;
        }
        if (levelKey !== "sl" && levelKey !== "tp") return;
        const draft = tradeDrafts[tradeId];
        const trade = trades.find((candidate) => candidate.id === tradeId);
        await persistTradeLevels(
          tradeId,
          draft?.sl ?? trade?.sl?.toString() ?? "",
          draft?.tp ?? trade?.tp?.toString() ?? ""
        );
        return;
      }

      if (overlayId.startsWith("order:")) {
        toast.success("Order levels updated");
      }
    },
    [isTradeHistoricallyClosed, persistTradeLevels, tradeDrafts, trades]
  );

  useEffect(() => {
    setTradeDrafts((previous) => {
      const nextDrafts = { ...previous };
      openTrades.forEach((trade) => {
        if (!nextDrafts[trade.id]) {
          nextDrafts[trade.id] = {
            sl: trade.sl?.toString() || "",
            tp: trade.tp?.toString() || "",
          };
        }
      });

      Object.keys(nextDrafts).forEach((tradeId) => {
        if (!openTrades.some((trade) => trade.id === tradeId)) {
          delete nextDrafts[tradeId];
        }
      });
      return nextDrafts;
    });
  }, [openTrades]);

  const completeSession = useCallback(async () => {
    if (!sessionId) return;
    setIsCompleting(true);
    try {
      for (const trade of openTrades) {
        await closeTradeAtMarket(trade.id, "session_end");
      }
      setPendingOrders([]);
      pendingOrderProcessingRef.current.clear();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(getPendingOrdersStorageKey(sessionId));
      }
      await trpcClient.backtest.completeSession.mutate({ sessionId });
      toast.success("Session completed");
      router.push("/backtest/sessions");
    } catch (err) {
      console.error("Failed to complete session:", err);
      toast.error("Failed to complete session");
    } finally {
      setIsCompleting(false);
    }
  }, [closeTradeAtMarket, openTrades, router, sessionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case " ":
          event.preventDefault();
          handlePlayPause();
          break;
        case "ArrowRight":
          event.preventDefault();
          stepReplay(event.shiftKey ? 20 : 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          stepReplay(event.shiftKey ? -20 : -1);
          break;
        case "[":
          event.preventDefault();
          stepReplay(-5);
          break;
        case "]":
          event.preventDefault();
          stepReplay(5);
          break;
        case "b":
        case "B":
          event.preventDefault();
          void openTrade("long");
          break;
        case "s":
        case "S":
          event.preventDefault();
          void openTrade("short");
          break;
        case "x":
        case "X":
          event.preventDefault();
          {
            const latestEditableTrade = [...openTrades]
              .reverse()
              .find((trade) => !isTradeHistoricallyClosed(trade.id));
            if (latestEditableTrade) {
              void closeTradeAtMarket(latestEditableTrade.id);
            }
          }
          break;
        case "m":
        case "M":
          event.preventDefault();
          addCheckpoint();
          break;
        case "Escape":
          setAnnotationTool("none");
          setSelectedAnnotationId(null);
          setSelectedExecutionOverlayId(null);
          setChartOrderSide(null);
          break;
        case "Backspace":
        case "Delete":
          if (selectedAnnotationId) {
            event.preventDefault();
            setAnnotations((previous) =>
              previous.filter((annotation) => annotation.id !== selectedAnnotationId)
            );
            setSelectedAnnotationId(null);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    closeTradeAtMarket,
    isTradeHistoricallyClosed,
    addCheckpoint,
    handlePlayPause,
    openTrade,
    openTrades,
    selectedAnnotationId,
    stepReplay,
  ]);

  const headerProgress = allCandles.length > 0 ? ((currentIndex + 1) / allCandles.length) * 100 : 0;
  const headerProgressPercentLabel = `${headerProgress.toFixed(1)}%`;
  const timeframeCompactLabel = getTimeframeCompactLabel(timeframe);
  const symbolDisplayName = getSymbolDisplayName(symbol);
  const currentBias = currentCandle
    ? currentCandle.close >= currentCandle.open
      ? "Bull candle"
      : "Bear candle"
    : "No data";
  const priceDecimals = symbol.includes("JPY") || symbol.includes("XAU") ? 3 : 5;
  const currentCandleDelta = currentCandle ? currentCandle.close - currentCandle.open : 0;
  const currentCandleDeltaPct =
    currentCandle && currentCandle.open !== 0
      ? (currentCandleDelta / currentCandle.open) * 100
      : 0;
  const drawingToolLabel =
    annotationTool === "none"
      ? "Select"
      : annotationTool === "trendline"
      ? "Trend line"
      : annotationTool === "extended"
      ? "Extended line"
      : annotationTool === "ray"
      ? "Ray"
      : annotationTool === "arrow"
      ? "Arrow"
      : annotationTool === "horizontal"
      ? "Horizontal"
      : annotationTool === "vertical"
      ? "Vertical"
      : annotationTool === "rectangle"
      ? "Zone"
      : annotationTool === "fib"
      ? "Fib"
      : annotationTool === "measure"
      ? "Measure"
      : annotationTool === "anchored-vwap"
      ? "Anchored VWAP"
      : "Note";
  const challengeStateLabel = challengeConfig.enforce
    ? challengeStatus.challengeLocked
      ? "Locked"
      : challengePreset === "none"
      ? "Off"
      : "Active"
    : "Soft";
  const challengeHelper =
    challengeConfig.profitTargetPct > 0
      ? `${challengeStatus.profitPct.toFixed(1)}% / ${challengeConfig.profitTargetPct}% target`
      : "No challenge target";
  const bidPrice = currentPrice ? Math.max(0, currentPrice - executionEnvironment.spread / 2) : 0;
  const askPrice = currentPrice ? currentPrice + executionEnvironment.spread / 2 : 0;
  const defaultUnits = Math.max(1000, Math.round(Math.max(tradeSizer.lotSize, 0.01) * 100000));
  const effectiveTicketPrice =
    ticketPrice ||
    formatPrice(symbol, entryMode === "market" ? currentPrice || 0 : currentPrice || 0);
  const effectiveTicketUnits = ticketUnits || String(defaultUnits);
  const effectiveUnitsNumber = Number.isFinite(parseUnitsInput(effectiveTicketUnits))
    ? parseUnitsInput(effectiveTicketUnits)
    : defaultUnits;
  const effectiveVolume = Math.max(0.01, round(effectiveUnitsNumber / 100000, 2));
  const effectivePriceNumber =
    Number.isFinite(Number(effectiveTicketPrice)) && Number(effectiveTicketPrice) > 0
      ? Number(effectiveTicketPrice)
      : currentPrice || 0;
  const estimatedTradeValue = effectiveUnitsNumber * effectivePriceNumber;
  const estimatedMargin = estimatedTradeValue / 50;
  const availableFunds = Math.max(0, equity - openRisk);
  const estimatedTargetAtTP =
    showSLTP && defaultTPPips > 0 ? round(defaultTPPips * effectiveVolume * 10, 2) : 0;
  const domLevels = useMemo(() => {
    if (!currentPrice) return [];

    const increment = pipSize * (symbol.includes("XAU") ? 5 : 2);
    const levels = Array.from({ length: 17 }, (_, index) => {
      const offset = 8 - index;
      const price = currentPrice + offset * increment;
      const matchingOrders = replayPendingOrders.filter(
        (order) => Math.abs(order.entryPrice - price) <= increment / 2
      );

      return {
        price,
        isAsk: Math.abs(price - askPrice) <= increment / 2,
        isBid: Math.abs(price - bidPrice) <= increment / 2,
        matchingOrders,
      };
    });

    return levels.sort((a, b) => b.price - a.price);
  }, [askPrice, bidPrice, currentPrice, pipSize, replayPendingOrders, symbol]);

  const contextPaneSeries = useMemo<ContextPaneSeriesItem[]>(() => {
    return activeContextTimeframes
      .map((contextTimeframe) => {
        const candles = contextCandles[contextTimeframe] || [];
        if (!candles.length || !currentTimeUnix) return null;
        const index = nearestCandleIndex(candles, currentTimeUnix);
        const mode = contextPaneModes[contextTimeframe] ?? "recent";
        const startIndex =
          mode === "full"
            ? 0
            : mode === "last"
              ? Math.max(0, index - (LAST_CONTEXT_CANDLE_COUNT - 1))
              : Math.max(0, index - 80);
        return {
          timeframe: contextTimeframe,
          label: getTimeframeCompactLabel(contextTimeframe),
          mode,
          candles: candles.slice(startIndex, index + 1),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activeContextTimeframes, contextCandles, contextPaneModes, currentTimeUnix]);

  const contextDockedPanes = useMemo(() => {
    const slotMap: Partial<Record<ContextDockSlot, ContextPaneSeriesItem>> = {};
    const undocked: ContextPaneSeriesItem[] = [];

    contextPaneSeries.forEach((pane) => {
      const slot = contextDockAssignments[pane.timeframe];
      if (!slot || slotMap[slot]) {
        undocked.push(pane);
        return;
      }

      slotMap[slot] = pane;
    });

    return {
      slots: slotMap,
      undocked,
    };
  }, [contextDockAssignments, contextPaneSeries]);

  const hasDockedContextPanes = useMemo(
    () => activeContextTimeframes.some((contextTimeframe) => Boolean(contextDockAssignments[contextTimeframe])),
    [activeContextTimeframes, contextDockAssignments]
  );

  const showFloatingContextPanes = contextVisibilityEnabled && !hasDockedContextPanes && contextPaneSeries.length > 0;
  const showSplitContextPanes = contextVisibilityEnabled && hasDockedContextPanes && contextPaneSeries.length > 0;
  const showContextDockTargets =
    contextVisibilityEnabled &&
    Boolean(draggingContextPane || draggingDockContextTimeframe) &&
    contextPaneSeries.length > 0;

  const toggleContextTimeframe = useCallback(
    (contextTimeframe: BacktestTimeframe, checked: boolean) => {
      if (contextTimeframe === timeframe) return;

      setSelectedContextTimeframes((previous) => {
        const current = previous ?? getDefaultContextTimeframes(timeframe);
        if (checked) {
          return current.includes(contextTimeframe) ? current : [...current, contextTimeframe];
        }

        return current.filter((item) => item !== contextTimeframe);
      });
    },
    [timeframe]
  );

  const closeContextTimeframe = useCallback(
    (contextTimeframe: BacktestTimeframe) => {
      setSelectedContextTimeframes((previous) => {
        const current = previous ?? getDefaultContextTimeframes(timeframe);
        return current.filter((item) => item !== contextTimeframe);
      });

      setContextPanePositions((previous) => {
        if (!(contextTimeframe in previous)) return previous;
        const next = { ...previous };
        delete next[contextTimeframe];
        return next;
      });

      setContextPaneModes((previous) => {
        if (!(contextTimeframe in previous)) return previous;
        const next = { ...previous };
        delete next[contextTimeframe];
        return next;
      });

      setContextDockAssignments((previous) => {
        if (!(contextTimeframe in previous)) return previous;
        const next = { ...previous };
        delete next[contextTimeframe];
        return next;
      });
    },
    [timeframe]
  );

  const undockAllContextPanes = useCallback(() => {
    setContextDockAssignments({});
  }, []);

  const resetContextTimeframes = useCallback(() => {
    setSelectedContextTimeframes(getDefaultContextTimeframes(timeframe));
    setContextDockAssignments({});
  }, [timeframe]);

  const cycleContextPaneMode = useCallback((contextTimeframe: BacktestTimeframe) => {
    setContextPaneModes((previous) => ({
      ...previous,
      [contextTimeframe]: getNextContextPaneMode(previous[contextTimeframe] ?? "recent"),
    }));
  }, []);

  const assignContextToDockSlot = useCallback(
    (contextTimeframe: BacktestTimeframe, targetSlot: ContextDockSlot) => {
      setContextDockAssignments((previous) => {
        const next = { ...previous };
        const currentSlot = next[contextTimeframe];
        const occupyingTimeframe = Object.entries(next).find(
          ([timeframeKey, slot]) => timeframeKey !== contextTimeframe && slot === targetSlot
        )?.[0] as BacktestTimeframe | undefined;

        next[contextTimeframe] = targetSlot;

        if (occupyingTimeframe) {
          if (currentSlot) {
            next[occupyingTimeframe] = currentSlot;
          } else {
            delete next[occupyingTimeframe];
          }
        }

        return next;
      });
    },
    []
  );

  const handleContextDockDragStart = useCallback(
    (contextTimeframe: BacktestTimeframe, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      contextDockDragRef.current = { timeframe: contextTimeframe };
      setDraggingDockContextTimeframe(contextTimeframe);
      setActiveContextDockTarget(contextDockAssignments[contextTimeframe] ?? null);
    },
    [contextDockAssignments]
  );

  const handleContextPanePointerDown = useCallback(
    (timeframeToDrag: BacktestTimeframe, index: number, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const fallbackPosition = getDefaultContextPanePosition(index);
      const currentPosition = contextPanePositions[timeframeToDrag] ?? fallbackPosition;

      contextPaneDragRef.current = {
        timeframe: timeframeToDrag,
        startX: event.clientX,
        startY: event.clientY,
        originX: currentPosition.x,
        originY: currentPosition.y,
      };
      setDraggingContextPane(timeframeToDrag);
    },
    [contextPanePositions]
  );

  const findDockTargetAtPoint = useCallback((clientX: number, clientY: number) => {
    return (
      CONTEXT_DOCK_SLOTS.find((slot) => {
        const rect = dockTargetRefs.current[slot]?.getBoundingClientRect();
        if (!rect) return false;

        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      }) ?? null
    );
  }, []);

  useEffect(() => {
    if (!draggingContextPane) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = contextPaneDragRef.current;
      if (!dragState) return;

      const nextX = dragState.originX + (event.clientX - dragState.startX);
      const nextY = dragState.originY + (event.clientY - dragState.startY);

      setContextPanePositions((previous) => {
        const currentPosition = previous[dragState.timeframe];
        if (currentPosition?.x === nextX && currentPosition?.y === nextY) {
          return previous;
        }

        return {
          ...previous,
          [dragState.timeframe]: {
            x: nextX,
            y: nextY,
          },
        };
      });

      const hoveredTarget = findDockTargetAtPoint(event.clientX, event.clientY);
      setActiveContextDockTarget((previous) => (previous === hoveredTarget ? previous : hoveredTarget));
    };

    const finishDrag = () => {
      const dragState = contextPaneDragRef.current;
      if (dragState && activeContextDockTarget) {
        assignContextToDockSlot(dragState.timeframe, activeContextDockTarget);
      }

      contextPaneDragRef.current = null;
      setDraggingContextPane(null);
      setActiveContextDockTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [activeContextDockTarget, assignContextToDockSlot, draggingContextPane, findDockTargetAtPoint]);

  useEffect(() => {
    if (!draggingDockContextTimeframe) return;

    const handlePointerMove = (event: PointerEvent) => {
      const hoveredTarget = findDockTargetAtPoint(event.clientX, event.clientY);

      setActiveContextDockTarget((previous) => (previous === hoveredTarget ? previous : hoveredTarget));
    };

    const finishDrag = () => {
      const dragState = contextDockDragRef.current;
      if (dragState && activeContextDockTarget) {
        assignContextToDockSlot(dragState.timeframe, activeContextDockTarget);
      }

      contextDockDragRef.current = null;
      setDraggingDockContextTimeframe(null);
      setActiveContextDockTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [activeContextDockTarget, assignContextToDockSlot, draggingDockContextTimeframe, findDockTargetAtPoint]);

  const isDragExemptTarget = useCallback((target: EventTarget | null) => {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "button, input, label, select, textarea, a, [role='button'], [data-drag-exempt='true']"
        )
      )
    );
  }, []);

  const handleFavoriteToolsBarDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDragExemptTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      favoriteToolsBarDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: favoriteToolsBarOffset.x,
        originY: favoriteToolsBarOffset.y,
      };
      setIsDraggingFavoriteToolsBar(true);
    },
    [favoriteToolsBarOffset, isDragExemptTarget]
  );

  const centerFavoriteToolsBar = useCallback(() => {
    setFavoriteToolsBarOffset({ ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET });
  }, []);

  const isFavoriteToolsBarCentered =
    favoriteToolsBarOffset.x === DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.x &&
    favoriteToolsBarOffset.y === DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.y;

  useEffect(() => {
    if (!isDraggingFavoriteToolsBar) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = favoriteToolsBarDragRef.current;
      if (!dragState) return;

      let nextX = dragState.originX + (event.clientX - dragState.startX);
      let nextY = dragState.originY + (event.clientY - dragState.startY);
      const workspaceRect = chartWorkspaceRef.current?.getBoundingClientRect();
      const favoriteBarRect = favoriteToolsBarRef.current?.getBoundingClientRect();

      if (workspaceRect && favoriteBarRect) {
        const horizontalLimit = Math.max(0, workspaceRect.width / 2 - favoriteBarRect.width / 2 - 16);
        const verticalLimit = Math.max(0, workspaceRect.height - favoriteBarRect.height - 24);
        nextX = clamp(nextX, -horizontalLimit, horizontalLimit);
        nextY = clamp(nextY, 0, verticalLimit);
      }

      setFavoriteToolsBarOffset((previous) => {
        if (previous.x === nextX && previous.y === nextY) {
          return previous;
        }

        return {
          x: nextX,
          y: nextY,
        };
      });
    };

    const finishDrag = () => {
      favoriteToolsBarDragRef.current = null;
      setIsDraggingFavoriteToolsBar(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [isDraggingFavoriteToolsBar]);

  const replayMistakes = useMemo<ReplayMistake[]>(() => {
    const issues: ReplayMistake[] = [];
    const chronologicallyClosed = [...closedTrades].sort(
      (a, b) => (getExitUnix(a) || getEntryUnix(a)) - (getExitUnix(b) || getEntryUnix(b))
    );

    chronologicallyClosed.forEach((trade, index) => {
      const exitUnix = getExitUnix(trade) || getEntryUnix(trade);
      const rrPlan =
        trade.slPips && trade.tpPips && trade.slPips > 0 ? trade.tpPips / trade.slPips : 0;

      if (!trade.sl) {
        issues.push({
          id: `${trade.id}-no-sl`,
          type: "no-invalidation",
          title: "No invalidation level",
          detail: "Trade was placed without a stop loss, so the replay cannot grade invalidation discipline.",
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "high",
        });
      }

      if (rrPlan > 0 && rrPlan < 1.5) {
        issues.push({
          id: `${trade.id}-rr`,
          type: "poor-rr",
          title: "Subpar planned R:R",
          detail: `Planned reward-to-risk was ${rrPlan.toFixed(2)}R, below the 1.5R floor.`,
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "medium",
        });
      }

      if ((trade.riskPercent || 0) > 1.5) {
        issues.push({
          id: `${trade.id}-risk`,
          type: "oversized-risk",
          title: "Oversized risk",
          detail: `Trade risked ${(trade.riskPercent || 0).toFixed(2)}% when the replay model expects tighter sizing.`,
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "medium",
        });
      }

      if (
        typeof trade.maePips === "number" &&
        typeof trade.slPips === "number" &&
        trade.slPips > 0 &&
        trade.maePips < trade.slPips * 0.2 &&
        typeof trade.realizedRR === "number" &&
        trade.realizedRR < 0
      ) {
        issues.push({
          id: `${trade.id}-late`,
          type: "late-entry",
          title: "Late entry structure",
          detail: "The trade stopped out without meaningful adverse excursion, which usually means the entry was too late into the move.",
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "low",
        });
      }

      const previousTrade = chronologicallyClosed[index - 1];
      if (
        previousTrade &&
        (previousTrade.pnl || 0) < 0 &&
        getEntryUnix(trade) - (getExitUnix(previousTrade) || getEntryUnix(previousTrade)) <= 20 * 60
      ) {
        issues.push({
          id: `${trade.id}-revenge`,
          type: "revenge-cluster",
          title: "Revenge cluster",
          detail: "A fresh trade was placed within 20 minutes of a losing exit.",
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "high",
        });
      }

      const hourCluster = chronologicallyClosed.filter(
        (candidate) =>
          Math.abs(getEntryUnix(candidate) - getEntryUnix(trade)) <= 60 * 60
      );
      if (hourCluster.length >= 4) {
        issues.push({
          id: `${trade.id}-cluster`,
          type: "overtrading-window",
          title: "Overtrading window",
          detail: `${hourCluster.length} trades were opened within one hour.`,
          timeUnix: exitUnix,
          tradeId: trade.id,
          severity: "medium",
        });
      }
    });

    return issues.sort((a, b) => a.timeUnix - b.timeUnix);
  }, [closedTrades]);

  const timelineEvents = useMemo<ReplayTimelineEvent[]>(() => {
    const drawdownEvents: ReplayTimelineEvent[] = [];
    let runningEquity = initialBalance;
    let peak = initialBalance;
    [...closedTrades]
      .sort((a, b) => (getExitUnix(a) || getEntryUnix(a)) - (getExitUnix(b) || getEntryUnix(b)))
      .forEach((trade) => {
        runningEquity += trade.pnl || 0;
        peak = Math.max(peak, runningEquity);
        const drawdownPct = peak > 0 ? ((peak - runningEquity) / peak) * 100 : 0;
        if (drawdownPct >= 3) {
          drawdownEvents.push({
            id: `dd-${trade.id}`,
            type: "drawdown",
            label: `${drawdownPct.toFixed(1)}% drawdown`,
            helper: "Equity slipped materially from the session peak.",
            timeUnix: getExitUnix(trade) || getEntryUnix(trade),
            tone: "negative",
            tradeId: trade.id,
          });
        }
      });

    const events: ReplayTimelineEvent[] = [
      ...checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        type: "checkpoint" as const,
        label: checkpoint.label,
        helper: "Manual checkpoint",
        timeUnix: checkpoint.timeUnix,
        tone: "neutral" as const,
      })),
      ...replayTrades.map((trade) => ({
        id: `entry-${trade.id}`,
        type: "trade-entry" as const,
        label: `${trade.direction === "long" ? "Buy" : "Sell"} entry`,
        helper: formatPrice(symbol, trade.entryPrice),
        timeUnix: getEntryUnix(trade),
        tone: "neutral" as const,
        tradeId: trade.id,
      })),
      ...closedTrades.map((trade) => ({
        id: `exit-${trade.id}`,
        type: "trade-exit" as const,
        label: `${trade.exitType || "manual"} exit`,
        helper: formatSignedCurrency(trade.pnl || 0),
        timeUnix: getExitUnix(trade) || getEntryUnix(trade),
        tone: (trade.pnl || 0) >= 0 ? ("positive" as const) : ("negative" as const),
        tradeId: trade.id,
      })),
      ...calendarEvents.map((event) => ({
        id: event.id,
        type: "news" as const,
        label:
          simulationConfig.hideUpcomingHighImpactNews &&
          event.impact === "High" &&
          event.timeUnix > currentTimeUnix
            ? "Hidden macro event"
            : event.title,
        helper:
          simulationConfig.hideUpcomingHighImpactNews &&
          event.impact === "High" &&
          event.timeUnix > currentTimeUnix
            ? "Hidden until reveal"
            : `${event.country} · ${event.impact}`,
        timeUnix: event.timeUnix,
        tone: event.impact === "High" ? ("negative" as const) : ("neutral" as const),
      })),
      ...drawdownEvents,
      ...replayMistakes.map((mistake) => ({
        id: mistake.id,
        type: "mistake" as const,
        label: mistake.title,
        helper: mistake.detail,
        timeUnix: mistake.timeUnix,
        tone: "negative" as const,
        tradeId: mistake.tradeId,
      })),
    ];

    return events.sort((a, b) => a.timeUnix - b.timeUnix);
  }, [
    calendarEvents,
    checkpoints,
    closedTrades,
    currentTimeUnix,
    initialBalance,
    replayMistakes,
    replayTrades,
    simulationConfig.hideUpcomingHighImpactNews,
    symbol,
  ]);

  const reviewStepEvents = useMemo(
    () => timelineEvents.filter((event) => event.type !== "checkpoint"),
    [timelineEvents]
  );

  const scoreExplainers = useMemo(() => {
    return [
      {
        label: "Planned structure",
        value: `${Math.round(stats.structureRate * 100)}%`,
        helper: "Trades with both SL and TP defined.",
      },
      {
        label: "Notes coverage",
        value: `${Math.round(stats.noteCoverage * 100)}%`,
        helper: "Trades with context or review notes attached.",
      },
      {
        label: "Mistakes flagged",
        value: String(replayMistakes.length),
        helper: "Automatic review issues detected in the session.",
      },
    ];
  }, [replayMistakes.length, stats.noteCoverage, stats.structureRate]);

  const scoreNarrative = useMemo(() => {
    if (!replayTrades.length) {
      return "Start placing trades to build a review scorecard.";
    }

    const missingStructure = replayTrades.filter((trade) => !trade.sl || !trade.tp).length;
    const missingNotes = replayTrades.filter((trade) => !trade.notes?.trim()).length;
    const keyLeak = replayMistakes[0]?.title ?? "No major leak detected";

    return `${stats.processScore}/100 process score. ${missingStructure} trades still lack full structure, ${missingNotes} trades have no notes, and the top leak is ${keyLeak.toLowerCase()}.`;
  }, [replayMistakes, replayTrades, stats.processScore]);

  const reviewComparisons = useMemo(() => {
    const winningTrades = closedTrades.filter((trade) => (trade.pnl || 0) > 0);
    const losingTrades = closedTrades.filter((trade) => (trade.pnl || 0) < 0);
    const impulsiveTradeIds = new Set(
      replayMistakes
        .map((mistake) => mistake.tradeId)
        .filter((tradeId): tradeId is string => Boolean(tradeId))
    );
    const aPlusTrades = closedTrades.filter((trade) => !impulsiveTradeIds.has(trade.id));
    const impulsiveTrades = closedTrades.filter((trade) => impulsiveTradeIds.has(trade.id));
    const summarize = (bucket: BacktestTrade[]) => ({
      count: bucket.length,
      avgRR:
        bucket.length > 0
          ? bucket.reduce((sum, trade) => sum + (trade.realizedRR || 0), 0) / bucket.length
          : 0,
      avgHold:
        bucket.length > 0
          ? bucket.reduce((sum, trade) => sum + (trade.holdTimeSeconds || 0), 0) / bucket.length
          : 0,
      avgRisk:
        bucket.length > 0
          ? bucket.reduce((sum, trade) => sum + (trade.riskPercent || 0), 0) / bucket.length
          : 0,
    });

    return [
      {
        label: "Winning vs losing",
        leftLabel: "Winners",
        rightLabel: "Losers",
        left: summarize(winningTrades),
        right: summarize(losingTrades),
      },
      {
        label: "A+ vs impulsive",
        leftLabel: "A+",
        rightLabel: "Impulsive",
        left: summarize(aPlusTrades),
        right: summarize(impulsiveTrades),
      },
    ];
  }, [closedTrades, replayMistakes]);

  const selectedPattern = useMemo(
    () => patternLibrary.find((pattern) => pattern.id === selectedPatternId) ?? null,
    [patternLibrary, selectedPatternId]
  );

  const patternMatches = useMemo<ReplayPatternMatch[]>(() => {
    if (!selectedPattern || allCandles.length < 4) return [];

    const matches: ReplayPatternMatch[] = [];
    allCandles.forEach((_, index) => {
      const featureVector = buildPatternFeatureVector(allCandles, index, pipSize);
      if (!featureVector) return;

      const score = getPatternSimilarityScore(selectedPattern.featureVector, featureVector);
      const timeUnix = Number(allCandles[index]?.time ?? 0);
      if (!Number.isFinite(timeUnix)) return;
      if (Math.abs(timeUnix - selectedPattern.anchorTimeUnix) <= TIMEFRAME_TO_SECONDS[timeframe] * 2) {
        return;
      }
      if (score < 0.72) return;

      matches.push({
        patternId: selectedPattern.id,
        timeUnix,
        score,
      });
    });

    return matches.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [allCandles, pipSize, selectedPattern, timeframe]);

  const bestWorstSelf = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; count: number; totalPnl: number; wins: number; avgRRTotal: number }
    >();

    closedTrades.forEach((trade) => {
      const sessionBucket = getSessionTagFromUnix(getEntryUnix(trade));
      const modelBucket = extractScopedTag(trade.tags, "model:") ?? trade.tags?.[0] ?? "untagged";
      const keyBuckets = [
        { key: `session:${sessionBucket}`, label: `${sessionBucket} window` },
        { key: `setup:${modelBucket}`, label: modelBucket },
      ];

      keyBuckets.forEach(({ key, label }) => {
        const next = buckets.get(key) ?? {
          label,
          count: 0,
          totalPnl: 0,
          wins: 0,
          avgRRTotal: 0,
        };

        next.count += 1;
        next.totalPnl += trade.pnl || 0;
        next.wins += (trade.pnl || 0) > 0 ? 1 : 0;
        next.avgRRTotal += trade.realizedRR || 0;
        buckets.set(key, next);
      });
    });

    const ranked = [...buckets.values()]
      .filter((bucket) => bucket.count >= 2)
      .map((bucket) => ({
        ...bucket,
        avgRR: bucket.avgRRTotal / bucket.count,
        winRate: (bucket.wins / bucket.count) * 100,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl);

    return {
      best: ranked.slice(0, 2),
      worst: [...ranked].reverse().slice(0, 2),
    };
  }, [closedTrades]);

  const jumpToTimelineEvent = useCallback(
    (eventId: string) => {
      const event = timelineEvents.find((item) => item.id === eventId);
      if (!event || !allCandles.length) return;
      const nextIndex = nearestCandleIndex(allCandles, event.timeUnix);
      setCurrentIndex(nextIndex);
      setGoToDateTime(toDateTimeLocalValue(allCandles[nextIndex]?.time ?? event.timeUnix));
      setReviewEventId(eventId);
      setIsPlaying(false);
      setWorkspaceTab("review");
    },
    [allCandles, timelineEvents]
  );

  const stepReviewEvent = useCallback(
    (direction: 1 | -1 = 1) => {
      if (!reviewStepEvents.length || !allCandles.length) return;

      const currentEventIndex =
        reviewEventId !== null
          ? reviewStepEvents.findIndex((event) => event.id === reviewEventId)
          : reviewStepEvents.findIndex((event) => event.timeUnix >= currentTimeUnix);
      const fallbackIndex =
        currentEventIndex === -1 ? (direction > 0 ? -1 : reviewStepEvents.length) : currentEventIndex;
      const targetIndex = clamp(
        fallbackIndex + direction,
        0,
        Math.max(reviewStepEvents.length - 1, 0)
      );
      const targetEvent = reviewStepEvents[targetIndex];
      if (!targetEvent) return;
      jumpToTimelineEvent(targetEvent.id);
    },
    [allCandles.length, currentTimeUnix, jumpToTimelineEvent, reviewEventId, reviewStepEvents]
  );

  useEffect(() => {
    if (reviewPlaybackMode !== "events" || !isReviewPlaybackRunning) return;
    if (!reviewStepEvents.length) {
      setIsReviewPlaybackRunning(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const currentEventIndex =
        reviewEventId !== null
          ? reviewStepEvents.findIndex((event) => event.id === reviewEventId)
          : reviewStepEvents.findIndex((event) => event.timeUnix >= currentTimeUnix);

      if (currentEventIndex >= reviewStepEvents.length - 1) {
        setIsReviewPlaybackRunning(false);
        return;
      }

      stepReviewEvent(1);
    }, Math.max(500, 1400 / playbackSpeed));

    return () => window.clearTimeout(timeoutId);
  }, [
    currentTimeUnix,
    isReviewPlaybackRunning,
    playbackSpeed,
    reviewEventId,
    reviewPlaybackMode,
    reviewStepEvents,
    stepReviewEvent,
  ]);

  const resumeFromMistake = useCallback(
    (mistakeId?: string) => {
      const targetMistake =
        replayMistakes.find((mistake) => mistake.id === mistakeId) ?? replayMistakes[0];
      if (!targetMistake || !allCandles.length) return;

      const anchorIndex = nearestCandleIndex(allCandles, targetMistake.timeUnix);
      const nextIndex = clamp(anchorIndex - 5, 0, Math.max(allCandles.length - 1, 0));
      setCurrentIndex(nextIndex);
      setGoToDateTime(toDateTimeLocalValue(allCandles[nextIndex]?.time ?? targetMistake.timeUnix));
      setReviewEventId(targetMistake.id);
      setWorkspaceTab("review");
      setIsPlaying(false);
      toast.success("Replay rewound before the mistake");
    },
    [allCandles, replayMistakes]
  );

  const runMonteCarlo = useCallback(async () => {
    if (!sessionId) return;

    setIsRunningMonteCarlo(true);
    try {
      const result = await trpcClient.backtest.runSimulation.query({
        sessionId,
        simulations: 1000,
        tradeCount: Math.max(40, closedTrades.length || 40),
        startingEquity: initialBalance,
      });
      setMonteCarloResult(result as MonteCarloResult);
      toast.success("Monte Carlo updated");
    } catch (err) {
      console.error("Failed to run Monte Carlo:", err);
      toast.error("Failed to run Monte Carlo");
    } finally {
      setIsRunningMonteCarlo(false);
    }
  }, [closedTrades.length, initialBalance, sessionId]);

  const seekReplay = useCallback(
    (index: number) => {
      setCurrentIndex(clamp(index, 0, Math.max(allCandles.length - 1, 0)));
      setIsPlaying(false);
    },
    [allCandles.length]
  );

  const renderContextPaneCard = (
    pane: ContextPaneSeriesItem,
    options?: {
      draggable?: boolean;
      isDragging?: boolean;
      onDragStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
      className?: string;
      chartContainerClassName?: string;
      chartClassName?: string;
      chartHeight?: number;
    }
  ) => (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-sidebar/90 shadow-[0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur",
        options?.className
      )}
    >
      <div
        onPointerDown={options?.onDragStart}
        className={cn(
          "flex items-center justify-between border-b border-white/5 px-3 py-2 text-[11px] text-white/55",
          options?.draggable && "touch-none",
          options?.draggable && (options.isDragging ? "cursor-grabbing" : "cursor-grab")
        )}
      >
        <div
          className="flex items-center gap-2"
        >
          <span className="font-medium text-white">{pane.label} context</span>
          {options?.draggable ? <GripVertical className="size-3.5 text-white/35" /> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => cycleContextPaneMode(pane.timeframe)}
            className="inline-flex h-6 items-center rounded-md border border-white/5 bg-sidebar-accent/60 px-2 text-[10px] font-medium text-white/70 transition hover:bg-sidebar-accent hover:text-white"
          >
            {getContextPaneModeLabel(pane.mode)}
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => closeContextTimeframe(pane.timeframe)}
            className="inline-flex size-6 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent/60 text-white/60 transition hover:bg-sidebar-accent hover:text-white"
            aria-label={`Close ${pane.label} context`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className={cn("min-h-0", options?.chartContainerClassName)}>
        <TradingViewChart
          data={pane.candles}
          theme="dark"
          showVolume={false}
          fitContent
          autosize
          height={options?.chartHeight ?? 130}
          className={options?.chartClassName ?? "h-[130px] w-full"}
        />
      </div>
    </div>
  );

  const mainChartPane = (
    <div
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-hidden",
        showSplitContextPanes && "rounded-[24px] border border-white/5 bg-background"
      )}
    >
      <div className="pointer-events-none absolute left-16 top-3 z-20 max-w-[min(820px,calc(100%-18rem))] text-sm text-white/55">
        <div className="rounded-2xl border border-white/5 bg-sidebar/95 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{symbolDisplayName}</span>
            <span>·</span>
            <span>{timeframeCompactLabel}</span>
            <span>·</span>
            <span className="text-white/35">Replay feed</span>
            <span
              className={cn(
                "font-medium",
                currentCandleDelta >= 0 ? "text-teal-300" : "text-rose-300"
              )}
            >
              {formatSignedPrice(currentCandleDelta, priceDecimals)} ({currentCandleDeltaPct >= 0 ? "+" : ""}
              {currentCandleDeltaPct.toFixed(2)}%)
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>O {currentCandle ? formatPrice(symbol, currentCandle.open) : "0.00000"}</span>
            <span>H {currentCandle ? formatPrice(symbol, currentCandle.high) : "0.00000"}</span>
            <span>L {currentCandle ? formatPrice(symbol, currentCandle.low) : "0.00000"}</span>
            <span>C {currentCandle ? formatPrice(symbol, currentCandle.close) : "0.00000"}</span>
          </div>
        </div>
      </div>

      {chartOrderSide ? (
        <div className="pointer-events-none absolute right-5 top-4 z-20">
          <div className="rounded-2xl border border-white/5 bg-sidebar/95 px-3 py-2 text-xs text-white/70 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur">
            Chart {chartOrderSide === "long" ? "buy" : "sell"} armed.
            Click a price level to place a {entryMode === "market" ? "pending" : entryMode} order.
          </div>
        </div>
      ) : null}

      {showDrawingRail ? (
        <div className="pointer-events-none absolute left-2 top-1/2 z-30 flex max-h-[calc(100%-2rem)] w-11 -translate-y-1/2 items-center rounded-full border border-white/5 bg-sidebar/95 p-1 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="pointer-events-auto flex max-h-[calc(100vh-14rem)] w-full flex-col items-center overflow-y-auto">
            <DrawingToolButton
              icon={MousePointer2}
              label="Select"
              active={annotationTool === "none"}
              onClick={() => setAnnotationTool("none")}
            />
            <DrawingToolButton
              icon={Slash}
              label="Trend line"
              active={annotationTool === "trendline"}
              onClick={() => setAnnotationTool("trendline")}
            />
            <DrawingToolButton
              icon={Slash}
              label="Extended line"
              active={annotationTool === "extended"}
              onClick={() => setAnnotationTool("extended")}
            />
            <DrawingToolButton
              icon={ArrowUpRight}
              label="Ray"
              active={annotationTool === "ray"}
              onClick={() => setAnnotationTool("ray")}
            />
            <DrawingToolButton
              icon={MoveRight}
              label="Arrow"
              active={annotationTool === "arrow"}
              onClick={() => setAnnotationTool("arrow")}
            />
            <DrawingToolButton
              icon={Target}
              label="Fib"
              active={annotationTool === "fib"}
              onClick={() => setAnnotationTool("fib")}
            />
            <DrawingToolButton
              icon={Target}
              label="Anchored VWAP"
              active={annotationTool === "anchored-vwap"}
              onClick={() => setAnnotationTool("anchored-vwap")}
            />
            <DrawingToolButton
              icon={Square}
              label="Zone"
              active={annotationTool === "rectangle"}
              onClick={() => setAnnotationTool("rectangle")}
            />
            <DrawingToolButton
              icon={Ruler}
              label="Measure"
              active={annotationTool === "measure"}
              onClick={() => setAnnotationTool("measure")}
            />
            <DrawingToolButton
              icon={Minus}
              label="Horizontal"
              active={annotationTool === "horizontal"}
              onClick={() => setAnnotationTool("horizontal")}
            />
            <DrawingToolButton
              icon={Clock3}
              label="Vertical"
              active={annotationTool === "vertical"}
              onClick={() => setAnnotationTool("vertical")}
            />
            <DrawingToolButton
              icon={MessageSquare}
              label="Note"
              active={annotationTool === "note"}
              onClick={() => setAnnotationTool("note")}
            />
            <div className="mt-1 flex w-full justify-center border-t border-white/5 pt-1">
              <DrawingToolButton
                icon={Trash2}
                label="Clear markup"
                active={false}
                onClick={clearAnnotations}
                disabled={annotations.length === 0}
              />
            </div>
          </div>
        </div>
      ) : null}

      {showFavoriteToolsBar ? (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-30"
          style={{
            transform: `translate(calc(-50% + ${favoriteToolsBarOffset.x}px), ${favoriteToolsBarOffset.y}px)`,
          }}
        >
          <div
            ref={favoriteToolsBarRef}
            onPointerDown={handleFavoriteToolsBarDragStart}
            className={cn(
              "pointer-events-auto flex max-w-[min(1100px,calc(100vw-10rem))] items-center gap-1 overflow-x-auto rounded-full border border-white/5 bg-sidebar/95 p-1 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur touch-none",
              isDraggingFavoriteToolsBar ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            <div
              className={cn(
                "flex h-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-sidebar-accent px-2 text-white/45"
              )}
              aria-label="Drag favorite tools bar"
              title="Drag favorite tools bar"
            >
              <GripVertical className="size-3.5" />
            </div>
            <DrawingToolButton
              icon={Slash}
              label="Trend line"
              active={annotationTool === "trendline"}
              onClick={() => setAnnotationTool("trendline")}
            />
            <DrawingToolButton
              icon={Slash}
              label="Extended line"
              active={annotationTool === "extended"}
              onClick={() => setAnnotationTool("extended")}
            />
            <DrawingToolButton
              icon={ArrowUpRight}
              label="Ray"
              active={annotationTool === "ray"}
              onClick={() => setAnnotationTool("ray")}
            />
            <DrawingToolButton
              icon={MoveRight}
              label="Arrow"
              active={annotationTool === "arrow"}
              onClick={() => setAnnotationTool("arrow")}
            />
            <DrawingToolButton
              icon={Target}
              label="Fib"
              active={annotationTool === "fib"}
              onClick={() => setAnnotationTool("fib")}
            />
            <DrawingToolButton
              icon={Target}
              label="Anchored VWAP"
              active={annotationTool === "anchored-vwap"}
              onClick={() => setAnnotationTool("anchored-vwap")}
            />
            <DrawingToolButton
              icon={Square}
              label="Zone"
              active={annotationTool === "rectangle"}
              onClick={() => setAnnotationTool("rectangle")}
            />
            <DrawingToolButton
              icon={Ruler}
              label="Measure"
              active={annotationTool === "measure"}
              onClick={() => setAnnotationTool("measure")}
            />
            <DrawingToolButton
              icon={Minus}
              label="Horizontal"
              active={annotationTool === "horizontal"}
              onClick={() => setAnnotationTool("horizontal")}
            />
            <DrawingToolButton
              icon={Clock3}
              label="Vertical"
              active={annotationTool === "vertical"}
              onClick={() => setAnnotationTool("vertical")}
            />
            <DrawingToolButton
              icon={MessageSquare}
              label="Note"
              active={annotationTool === "note"}
              onClick={() => setAnnotationTool("note")}
            />
            <div className="ml-1 flex items-center gap-2 rounded-xl border border-white/5 bg-sidebar-accent px-2 py-1.5 text-[11px] text-white/55">
              <span>{drawingToolLabel}</span>
              <label className="flex h-5 w-5 cursor-pointer overflow-hidden rounded-md border border-white/5">
                <input
                  type="color"
                  value={annotationColor}
                  onChange={(event) => setAnnotationColor(event.target.value)}
                  className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <Input
              value={annotationLabel}
              onChange={(event) => handleAnnotationLabelChange(event.target.value)}
              placeholder="Label"
              className="h-8 w-[120px] border-white/5 bg-sidebar-accent text-xs text-white"
            />
          </div>
        </div>
      ) : null}

      {showFloatingContextPanes ? (
        <div className="pointer-events-none absolute bottom-36 right-4 z-20 h-0 w-0">
          {contextPaneSeries.map((pane, index) => {
            const position =
              contextPanePositions[pane.timeframe] ?? getDefaultContextPanePosition(index);
            const isDraggingPane = draggingContextPane === pane.timeframe;

            return (
              <div
                key={pane.timeframe}
                className="pointer-events-auto absolute bottom-0 right-0 w-[240px]"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isDraggingPane ? 40 : Math.max(1, contextPaneSeries.length - index),
                }}
              >
                {renderContextPaneCard(pane, {
                  draggable: true,
                  isDragging: isDraggingPane,
                  onDragStart: (event) => handleContextPanePointerDown(pane.timeframe, index, event),
                })}
              </div>
            );
          })}
        </div>
      ) : null}

      <TradingViewChart
        data={visibleCandles}
        markers={markers}
        priceLines={priceLines}
        indicatorLines={indicatorLines}
        executionOverlays={executionOverlays}
        annotations={annotations}
        activeAnnotationTool={annotationTool}
        annotationColor={annotationColor}
        annotationLabel={annotationLabel}
        pricePrecision={priceDecimals}
        selectedAnnotationId={selectedAnnotationId}
        selectedExecutionOverlayId={selectedExecutionOverlayId}
        onSelectedAnnotationChange={setSelectedAnnotationId}
        onSelectedExecutionOverlayChange={setSelectedExecutionOverlayId}
        onAnnotationsChange={setAnnotations}
        onExecutionOverlayChange={handleExecutionOverlayChange}
        onExecutionOverlayCommit={handleExecutionOverlayCommit}
        onChartClick={handleChartOrderPlacement}
        theme="dark"
        showVolume={false}
        autosize
        height={0}
        fitContent
        className="h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-4 bottom-20 z-30 flex justify-center">
        <div className="pointer-events-auto h-max w-max max-w-[calc(100vw-8rem)] rounded-[22px] border border-white/5 bg-sidebar/55 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="grid h-max w-max max-w-full grid-cols-[auto_auto_auto] items-center gap-2 text-sm">
            <div className="select-none whitespace-nowrap text-xs text-transparent">
              {currentCandle ? format(new Date(currentTimeUnix * 1000), "EEE dd MMM ''yy") : ""}
            </div>
            <div className="flex items-center gap-2 justify-self-center">
              <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-sidebar-accent/60 p-1 backdrop-blur-xl">
                <PlaybackButton icon={ChevronsLeft} label="-20" onClick={() => stepReplay(-20)} />
                <PlaybackButton icon={SkipBack} label="-5" onClick={() => stepReplay(-5)} />
                <PlaybackButton
                  icon={isPlaying ? Pause : Play}
                  label={isPlaying ? "Pause" : "Play"}
                  onClick={handlePlayPause}
                  active={isPlaying}
                />
                <PlaybackButton icon={SkipForward} label="+5" onClick={() => stepReplay(5)} />
                <PlaybackButton icon={ChevronsRight} label="+20" onClick={() => stepReplay(20)} />
                <PlaybackButton icon={ChevronLeft} label="Reset" onClick={handleRestart} />
              </div>

              <Select value={String(playbackSpeed)} onValueChange={(value) => setPlaybackSpeed(Number(value))}>
                <SelectTrigger className="h-9 w-[84px] rounded-sm border-white/5 bg-sidebar-accent/60 text-xs text-white/75 shadow-md ring ring-white/5 backdrop-blur-xl hover:bg-sidebar-accent/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <SelectItem key={speed} value={String(speed)}>
                      {speed}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="justify-self-end whitespace-nowrap text-xs text-white/45">
              {currentCandle ? format(new Date(currentTimeUnix * 1000), "EEE dd MMM ''yy") : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-5 z-30">
        <div className="pointer-events-auto rounded-[22px] border border-white/5 bg-sidebar/55 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <CandleScrubber
            candles={allCandles}
            trades={trades}
            currentIndex={currentIndex}
            onSeek={seekReplay}
          />
        </div>
      </div>
    </div>
  );

  const dockSlotPaneMap = contextDockedPanes.slots;
  const dockTrayPanes = contextDockedPanes.undocked;
  const dockedTopPane = dockSlotPaneMap.top;
  const dockedLeftTopPane = dockSlotPaneMap["left-top"];
  const dockedLeftBottomPane = dockSlotPaneMap["left-bottom"];
  const dockedBottomPane = dockSlotPaneMap.bottom;
  const dockedRightTopPane = dockSlotPaneMap["right-top"];
  const dockedRightBottomPane = dockSlotPaneMap["right-bottom"];

  const dockTargetClass = (slot: ContextDockSlot) =>
    cn(
      "rounded-[22px] border border-dashed border-white/10 bg-sidebar/25 backdrop-blur-sm transition",
      activeContextDockTarget === slot && "border-teal-300 bg-teal-400/18"
    );

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-white">
      <NewSessionDialog
        open={showNewSessionDialog}
        onOpenChange={(open) => {
          setShowNewSessionDialog(open);
          if (!open && !sessionId) {
            router.push("/backtest/sessions");
          }
        }}
        sessionName={sessionName}
        setSessionName={setSessionName}
        sessionDescription={sessionDescription}
        setSessionDescription={setSessionDescription}
        symbol={symbol}
        setSymbol={setSymbol}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        initialBalance={initialBalance}
        setInitialBalance={setInitialBalance}
        riskPercent={riskPercent}
        setRiskPercent={setRiskPercent}
        onCreate={createNewSession}
      />

      <div className="border-b border-white/5 bg-sidebar pl-20 sm:pl-24 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-white/65 hover:bg-sidebar-accent"
            onClick={() => router.push("/backtest/sessions")}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="h-9 w-[132px] rounded-full border-white/5 bg-sidebar-accent text-sm font-semibold text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeframe(option.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm transition",
                  timeframe === option.value
                    ? "bg-teal-400 text-slate-950"
                    : "text-white/60 hover:bg-sidebar-accent hover:text-white"
                )}
              >
                {getTimeframeCompactLabel(option.value)}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-xl border border-white/5 bg-sidebar-accent px-3">
              <CalendarClock className="size-4 text-white/35" />
              <Input
                type="datetime-local"
                value={goToDateTime}
                onChange={(event) => setGoToDateTime(event.target.value)}
                className="h-7 w-[190px] border-none bg-transparent px-0 text-xs text-white/75 shadow-none"
              />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-white/60 hover:bg-sidebar hover:text-white" onClick={jumpToDateTime}>
                Go
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className={dashboardActionButtonClass}
              onClick={addCheckpoint}
              disabled={!currentCandle}
            >
              <BookmarkPlus className="mr-1.5 size-3.5" />
              Checkpoint
            </Button>

            {checkpoints.length ? (
              <Select
                value={selectedCheckpointId}
                onValueChange={jumpToCheckpoint}
              >
                <SelectTrigger className="h-9 w-[168px] rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent">
                  <SelectValue placeholder="Checkpoints" />
                </SelectTrigger>
                <SelectContent>
                  {checkpoints
                    .slice()
                    .sort((a, b) => b.timeUnix - a.timeUnix)
                    .map((checkpoint) => (
                      <SelectItem key={checkpoint.id} value={checkpoint.id}>
                        {checkpoint.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : null}

            <Select value={layoutPreset} onValueChange={(value) => applyLayoutPreset(value as LayoutPreset)}>
              <SelectTrigger className="h-9 w-[148px] rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="execution">Execution</SelectItem>
                <SelectItem value="chart-only">Chart Only</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={dashboardActionButtonClass}>
                  {contextTimeframeSummary}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 border-white/5 bg-sidebar text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
              >
                <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Context frames
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                {TIMEFRAMES.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={activeContextTimeframes.includes(option.value)}
                    disabled={option.value === timeframe}
                    onCheckedChange={(checked) => toggleContextTimeframe(option.value, Boolean(checked))}
                    className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                  onClick={resetContextTimeframes}
                  className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
                >
                  Reset context
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={undockAllContextPanes}
                  disabled={!hasDockedContextPanes}
                  className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white data-[disabled]:opacity-40"
                >
                  Undock all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={dashboardActionButtonClass}>
                  Chart UI
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-white/5 bg-sidebar text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
              >
                <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Chart surfaces
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuCheckboxItem
                  checked={showDrawingRail}
                  onCheckedChange={(checked) => setShowDrawingRail(Boolean(checked))}
                  className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
                >
                  Drawing rail
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showFavoriteToolsBar}
                  onCheckedChange={(checked) => setShowFavoriteToolsBar(Boolean(checked))}
                  className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
                >
                  Favorites bar
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                  onClick={centerFavoriteToolsBar}
                  disabled={isFavoriteToolsBarCentered}
                  className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white data-[disabled]:opacity-40"
                >
                  Center favorites bar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className={dashboardActionButtonClass}
              onClick={() => setShowBottomPanel((previous) => !previous)}
            >
              {showBottomPanel ? "Hide Dock" : "Show Dock"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={dashboardActionButtonClass}
              onClick={() => setShowRightPanel((previous) => !previous)}
            >
              {showRightPanel ? "Hide Ticket" : "Show Ticket"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className={dashboardActionButtonClass}
              onClick={saveSession}
              disabled={isSaving || !sessionId}
            >
              {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
              Save
            </Button>
            <Button
              size="sm"
              className={dashboardActionButtonClass}
              onClick={completeSession}
              disabled={!sessionId || isCompleting}
            >
              {isCompleting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-3.5" />}
              Complete
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 px-4 py-2 text-xs text-white/45">
          <Input
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            className="h-8 max-w-xs border-none bg-transparent px-0 text-sm font-semibold text-white shadow-none"
          />
          <span>{symbolDisplayName}</span>
          <span>·</span>
          <span>{timeframeCompactLabel}</span>
          <span>·</span>
          <span>{currentBias}</span>
          {contextSnapshots.length ? (
            <>
              <span>·</span>
              <div className="flex items-center gap-2">
                {contextSnapshots.map((snapshot) => (
                  <span
                    key={snapshot.timeframe}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border border-white/5 bg-sidebar-accent px-2 py-1 text-[11px]",
                      snapshot.bias === "Bull" ? "text-teal-300" : "text-rose-300"
                    )}
                  >
                    <span className="text-white/45">{snapshot.label}</span>
                    <span>{snapshot.bias}</span>
                    <span className="text-white/55">
                      {snapshot.deltaPct >= 0 ? "+" : ""}
                      {snapshot.deltaPct.toFixed(2)}%
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <div className="ml-auto flex min-w-[320px] flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-white/35">
                <span>Replay completion</span>
                <span className="text-white/55">{headerProgressPercentLabel}</span>
              </div>
              <Progress
                value={headerProgress}
                className="h-2 bg-white/10 [&_[data-slot=progress-indicator]]:bg-teal-400"
                aria-label={`Replay completion ${headerProgressPercentLabel}`}
              />
            </div>
            <span className="whitespace-nowrap text-white/65">
              {currentCandle
                ? format(new Date(currentTimeUnix * 1000), "MMM d, yyyy HH:mm")
                : "No data loaded"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <div className={cn("flex min-w-0 flex-1 flex-col bg-sidebar", showRightPanel && "border-r border-white/5")}>
          <div className={cn("relative min-h-0 flex-1 overflow-hidden bg-background", showBottomPanel && "border-b border-white/5")}>
            {isLoadingCandles ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-white/35" />
                <p className="text-sm text-white/45">Loading historical data from Dukascopy...</p>
              </div>
            ) : (
              <div ref={chartWorkspaceRef} className={cn("relative h-full min-h-0", showSplitContextPanes && "p-2")}>
                {showSplitContextPanes ? (
                  <>
                    <div className="flex h-full min-h-0 flex-col gap-2">
                      {dockedTopPane ? (
                        <div className="h-[22%] min-h-[150px] shrink-0">
                          {renderContextPaneCard(dockedTopPane, {
                            draggable: true,
                            isDragging: draggingDockContextTimeframe === dockedTopPane.timeframe,
                            onDragStart: (event) =>
                              handleContextDockDragStart(dockedTopPane.timeframe, event),
                            className: "h-full",
                            chartContainerClassName: "min-h-0 flex-1",
                            chartClassName: "h-full w-full",
                            chartHeight: 0,
                          })}
                        </div>
                      ) : null}

                      <div className="flex min-h-0 flex-1 gap-2">
                        {dockedLeftTopPane || dockedLeftBottomPane ? (
                          <div className="flex min-h-0 w-[24%] min-w-[240px] shrink-0 flex-col gap-2">
                            {dockedLeftTopPane ? (
                              <div className="min-h-0 flex-1">
                                {renderContextPaneCard(dockedLeftTopPane, {
                                  draggable: true,
                                  isDragging: draggingDockContextTimeframe === dockedLeftTopPane.timeframe,
                                  onDragStart: (event) =>
                                    handleContextDockDragStart(dockedLeftTopPane.timeframe, event),
                                  className: "h-full",
                                  chartContainerClassName: "min-h-0 flex-1",
                                  chartClassName: "h-full w-full",
                                  chartHeight: 0,
                                })}
                              </div>
                            ) : null}
                            {dockedLeftBottomPane ? (
                              <div className="min-h-0 flex-1">
                                {renderContextPaneCard(dockedLeftBottomPane, {
                                  draggable: true,
                                  isDragging:
                                    draggingDockContextTimeframe === dockedLeftBottomPane.timeframe,
                                  onDragStart: (event) =>
                                    handleContextDockDragStart(dockedLeftBottomPane.timeframe, event),
                                  className: "h-full",
                                  chartContainerClassName: "min-h-0 flex-1",
                                  chartClassName: "h-full w-full",
                                  chartHeight: 0,
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {mainChartPane}

                        {dockedRightTopPane || dockedRightBottomPane ? (
                          <div className="flex min-h-0 w-[28%] min-w-[250px] shrink-0 flex-col gap-2">
                            {dockedRightTopPane ? (
                              <div className="min-h-0 flex-1">
                                {renderContextPaneCard(dockedRightTopPane, {
                                  draggable: true,
                                  isDragging: draggingDockContextTimeframe === dockedRightTopPane.timeframe,
                                  onDragStart: (event) =>
                                    handleContextDockDragStart(dockedRightTopPane.timeframe, event),
                                  className: "h-full",
                                  chartContainerClassName: "min-h-0 flex-1",
                                  chartClassName: "h-full w-full",
                                  chartHeight: 0,
                                })}
                              </div>
                            ) : null}
                            {dockedRightBottomPane ? (
                              <div className="min-h-0 flex-1">
                                {renderContextPaneCard(dockedRightBottomPane, {
                                  draggable: true,
                                  isDragging: draggingDockContextTimeframe === dockedRightBottomPane.timeframe,
                                  onDragStart: (event) =>
                                    handleContextDockDragStart(dockedRightBottomPane.timeframe, event),
                                  className: "h-full",
                                  chartContainerClassName: "min-h-0 flex-1",
                                  chartClassName: "h-full w-full",
                                  chartHeight: 0,
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {dockedBottomPane ? (
                        <div className="h-[22%] min-h-[150px] shrink-0">
                          {renderContextPaneCard(dockedBottomPane, {
                            draggable: true,
                            isDragging: draggingDockContextTimeframe === dockedBottomPane.timeframe,
                            onDragStart: (event) =>
                              handleContextDockDragStart(dockedBottomPane.timeframe, event),
                            className: "h-full",
                            chartContainerClassName: "min-h-0 flex-1",
                            chartClassName: "h-full w-full",
                            chartHeight: 0,
                          })}
                        </div>
                      ) : null}
                    </div>

                    {dockTrayPanes.length ? (
                      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex max-h-[50%] w-[260px] flex-col gap-2 overflow-y-auto">
                        {dockTrayPanes.map((pane) => (
                          <div key={pane.timeframe} className="pointer-events-auto">
                            {renderContextPaneCard(pane, {
                              draggable: true,
                              isDragging: draggingDockContextTimeframe === pane.timeframe,
                              onDragStart: (event) => handleContextDockDragStart(pane.timeframe, event),
                              className: "w-full",
                            })}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full min-h-0">{mainChartPane}</div>
                )}

                {showContextDockTargets ? (
                  <div className="pointer-events-none absolute inset-2 z-40 flex flex-col gap-2">
                    <div
                      ref={(node) => {
                        dockTargetRefs.current.top = node;
                      }}
                      className={cn("h-[22%] min-h-[150px]", dockTargetClass("top"))}
                    >
                      <div className="flex h-full items-center justify-center text-sm text-white/55">
                        Full top
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 gap-2">
                      <div className="flex min-h-0 w-[24%] min-w-[240px] shrink-0 flex-col gap-2">
                        <div
                          ref={(node) => {
                            dockTargetRefs.current["left-top"] = node;
                          }}
                          className={cn("min-h-0 flex-1", dockTargetClass("left-top"))}
                        >
                          <div className="flex h-full items-center justify-center text-sm text-white/55">
                            Top left
                          </div>
                        </div>
                        <div
                          ref={(node) => {
                            dockTargetRefs.current["left-bottom"] = node;
                          }}
                          className={cn("min-h-0 flex-1", dockTargetClass("left-bottom"))}
                        >
                          <div className="flex h-full items-center justify-center text-sm text-white/55">
                            Bottom left
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1" />
                      <div className="flex min-h-0 w-[28%] min-w-[250px] shrink-0 flex-col gap-2">
                        <div
                          ref={(node) => {
                            dockTargetRefs.current["right-top"] = node;
                          }}
                          className={cn("min-h-0 flex-1", dockTargetClass("right-top"))}
                        >
                          <div className="flex h-full items-center justify-center text-sm text-white/55">
                            Top right
                          </div>
                        </div>
                        <div
                          ref={(node) => {
                            dockTargetRefs.current["right-bottom"] = node;
                          }}
                          className={cn("min-h-0 flex-1", dockTargetClass("right-bottom"))}
                        >
                          <div className="flex h-full items-center justify-center text-sm text-white/55">
                            Bottom right
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      ref={(node) => {
                        dockTargetRefs.current.bottom = node;
                      }}
                      className={cn("h-[22%] min-h-[150px]", dockTargetClass("bottom"))}
                    >
                      <div className="flex h-full items-center justify-center text-sm text-white/55">
                        Full bottom
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {showBottomPanel ? (
            <Tabs
              value={workspaceTab}
              onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)}
              className="flex h-[300px] flex-col bg-sidebar"
            >
            <div className="border-b border-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-sidebar-accent px-3 py-2">
                  <Badge className="bg-teal-400 text-slate-950">Backtesting</Badge>
                </div>
                <DeskMetric label="Account balance" value={`$${cashBalance.toFixed(2)}`} />
                <DeskMetric label="Equity" value={`$${equity.toFixed(2)}`} />
                <DeskMetric label="Realized P&L" value={formatSignedCurrency(realizedPnL)} />
                <DeskMetric label="Unrealized P&L" value={formatSignedCurrency(openPnL)} />
                <DeskMetric label="Open risk" value={`$${openRisk.toFixed(2)}`} />
                <DeskMetric label="Challenge" value={`${challengeStateLabel} · ${challengeHelper}`} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 rounded-md px-3 text-sm text-white/60 hover:bg-sidebar-accent hover:text-white"
                  onClick={() => setShowBottomPanel(false)}
                >
                  Close Dock
                </Button>
              </div>

              <TabsList className="mt-3 h-auto bg-transparent p-0">
                <div className="flex items-center gap-6">
                  <TabsTrigger value="positions" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-sm text-white/50 data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                    Positions
                  </TabsTrigger>
                  <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-sm text-white/50 data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                    Order History
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-sm text-white/50 data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                    Review
                  </TabsTrigger>
                </div>
              </TabsList>
            </div>

            <TabsContent value="positions" className="mt-0 flex-1 overflow-auto px-4 py-4">
              {!openTrades.length ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-white/45">
                  <p className="text-base font-medium text-white">There are no open positions in this backtest session.</p>
                  <p className="mt-2 text-sm">
                    {replayPendingOrders.length
                      ? `${replayPendingOrders.length} pending order${replayPendingOrders.length === 1 ? "" : "s"} waiting on chart.`
                      : "Use the order ticket to place the next trade or continue replaying."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-white/75">
                  <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
                    <tr>
                      <th className="pb-3 font-medium">Symbol</th>
                      <th className="pb-3 font-medium">Side</th>
                      <th className="pb-3 font-medium">Qty</th>
                      <th className="pb-3 font-medium">Avg Fill Price</th>
                      <th className="pb-3 font-medium">Take Profit</th>
                      <th className="pb-3 font-medium">Stop Loss</th>
                      <th className="pb-3 font-medium">Last Price</th>
                      <th className="pb-3 font-medium">Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTrades.map((trade) => (
                      <tr key={trade.id} className="border-t border-white/5">
                        <td className="py-3 font-medium text-white">{symbol}</td>
                        <td className="py-3">{trade.direction === "long" ? "Buy" : "Sell"}</td>
                        <td className="py-3">{Math.round(trade.volume * 100000).toLocaleString()}</td>
                        <td className="py-3">{formatPrice(symbol, trade.entryPrice)}</td>
                        <td className="py-3">{trade.tp ? formatPrice(symbol, trade.tp) : "-"}</td>
                        <td className="py-3">{trade.sl ? formatPrice(symbol, trade.sl) : "-"}</td>
                        <td className="py-3">{formatPrice(symbol, currentPrice || trade.entryPrice)}</td>
                        <td className={cn("py-3 font-medium", (trade.pnl || 0) >= 0 ? "text-teal-300" : "text-rose-300")}>
                          {formatSignedCurrency(trade.pnl || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 flex-1 overflow-auto px-4 py-4">
              {!closedTrades.length ? (
                <div className="rounded-2xl border border-dashed border-white/5 bg-sidebar-accent/50 px-5 py-6 text-sm text-white/45">
                  No closed trades yet.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-white/75">
                  <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
                    <tr>
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium">Side</th>
                      <th className="pb-3 font-medium">Entry</th>
                      <th className="pb-3 font-medium">Exit</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Pips</th>
                      <th className="pb-3 font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...closedTrades].reverse().map((trade) => (
                      <tr key={trade.id} className="border-t border-white/5">
                        <td className="py-3 text-white/45">
                          {trade.exitTime ? format(new Date((trade.exitTime as number) * 1000), "MMM d HH:mm") : "-"}
                        </td>
                        <td className="py-3 font-medium text-white">{trade.direction === "long" ? "Buy" : "Sell"}</td>
                        <td className="py-3">{formatPrice(symbol, trade.entryPrice)}</td>
                        <td className="py-3">{trade.exitPrice ? formatPrice(symbol, trade.exitPrice) : "-"}</td>
                        <td className="py-3 capitalize">{trade.exitType || "manual"}</td>
                        <td className={cn("py-3", (trade.pnlPips || 0) >= 0 ? "text-teal-300" : "text-rose-300")}>
                          {formatSignedPips(trade.pnlPips || 0)}
                        </td>
                        <td className={cn("py-3 font-medium", (trade.pnl || 0) >= 0 ? "text-teal-300" : "text-rose-300")}>
                          {formatSignedCurrency(trade.pnl || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>

            <TabsContent value="review" className="mt-0 flex-1 overflow-auto px-4 py-4">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {scoreExplainers.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4"
                      >
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">{item.label}</p>
                        <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                        <p className="mt-2 text-xs text-white/45">{item.helper}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Review coach</h3>
                        <p className="mt-1 text-xs text-white/45">{scoreNarrative}</p>
                      </div>
                      <Badge variant="outline" className="border-white/5 bg-sidebar text-white/65">
                        {reviewPlaybackMode === "events" ? "Event walkthrough" : "Manual review"}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={() => {
                          setReviewPlaybackMode("events");
                          setIsReviewPlaybackRunning((previous) => !previous);
                          setWorkspaceTab("review");
                        }}
                        disabled={reviewStepEvents.length === 0}
                      >
                        {isReviewPlaybackRunning ? "Pause walkthrough" : "Play walkthrough"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={() => {
                          setReviewPlaybackMode("events");
                          stepReviewEvent(1);
                        }}
                        disabled={reviewStepEvents.length === 0}
                      >
                        Next event
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={() => resumeFromMistake()}
                        disabled={!replayMistakes.length}
                      >
                        Resume before mistake
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={saveCurrentPattern}
                        disabled={!currentCandle}
                      >
                        Save pattern
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={createSharedSnapshot}
                        disabled={!currentCandle}
                      >
                        Freeze snapshot
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {reviewComparisons.map((comparison) => (
                      <div
                        key={comparison.label}
                        className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white">{comparison.label}</h3>
                          <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                            Compare
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {[
                            { label: comparison.leftLabel, summary: comparison.left },
                            { label: comparison.rightLabel, summary: comparison.right },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                              <p className="text-xs uppercase tracking-[0.16em] text-white/35">{item.label}</p>
                              <div className="mt-3 space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/45">Trades</span>
                                  <span className="text-white">{item.summary.count}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/45">Avg R</span>
                                  <span className="text-white">{item.summary.avgRR.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/45">Avg hold</span>
                                  <span className="text-white">{formatHoldTime(item.summary.avgHold)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/45">Avg risk</span>
                                  <span className="text-white">{item.summary.avgRisk.toFixed(2)}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Replay timeline</h3>
                        <p className="mt-1 text-xs text-white/45">
                          Jump through checkpoints, fills, exits, drawdown stress, and news.
                        </p>
                      </div>
                      <Select value={reviewEventId ?? undefined} onValueChange={jumpToTimelineEvent}>
                        <SelectTrigger className="h-9 w-[220px] rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent">
                          <SelectValue placeholder="Jump to event" />
                        </SelectTrigger>
                        <SelectContent>
                          {timelineEvents.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              {format(new Date(event.timeUnix * 1000), "MMM d HH:mm")} · {event.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
                      {timelineEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => jumpToTimelineEvent(event.id)}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition",
                            reviewEventId === event.id
                              ? "border-teal-400/50 bg-sidebar text-white"
                              : "border-white/5 bg-sidebar-accent/30 text-white/75 hover:bg-sidebar hover:text-white"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium">{event.label}</p>
                            <p className="mt-1 text-xs text-white/45">{event.helper}</p>
                          </div>
                          <span className="shrink-0 text-[11px] text-white/45">
                            {format(new Date(event.timeUnix * 1000), "HH:mm")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Rulebook-linked coaching</h3>
                        <p className="mt-1 text-xs text-white/45">
                          Evaluate replay trades against your live rule set instead of generic standards.
                        </p>
                      </div>
                      {isLoadingRulebook ? <Loader2 className="size-4 animate-spin text-white/35" /> : null}
                    </div>

                    <div className="mt-4">
                      <Select
                        value={linkedRuleSetId ?? "__none"}
                        onValueChange={(value) =>
                          setLinkedRuleSetId(value === "__none" ? null : value)
                        }
                      >
                        <SelectTrigger className="h-10 border-white/5 bg-sidebar text-sm text-white">
                          <SelectValue placeholder="Select a rule set" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">No linked rulebook</SelectItem>
                          {ruleSets.map((ruleSet) => (
                            <SelectItem key={ruleSet.id} value={ruleSet.id}>
                              {ruleSet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {linkedRuleSetId && rulebookCoaching?.summary ? (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-white/35">Compliance</p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {rulebookCoaching.summary.complianceRate}%
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {rulebookCoaching.summary.passCount}/{rulebookCoaching.summary.totalTrades} trades passed clean.
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-white/35">Average score</p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {rulebookCoaching.summary.averageScore}/100
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {rulebookCoaching.summary.failCount} hard fails, {rulebookCoaching.summary.partialCount} partials.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-white/35">Top violations</p>
                          <div className="mt-3 space-y-2">
                            {rulebookCoaching.summary.topViolations.length ? (
                              rulebookCoaching.summary.topViolations.map((item) => (
                                <div key={item.violation} className="flex items-center justify-between text-sm">
                                  <span className="text-white/75">{item.violation}</span>
                                  <span className="text-white/45">{item.count}x</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-white/45">No violations flagged yet.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                        {ruleSets.length
                          ? "Select a rule set to score the replay against your own playbook."
                          : "No rule sets found yet. Create one in settings to unlock rulebook coaching."}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <h3 className="text-sm font-semibold text-white">Best self / worst self</h3>
                    <p className="mt-1 text-xs text-white/45">
                      Buckets with at least two trades, ranked by realized P&amp;L.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/35">Best self</p>
                        <div className="mt-3 space-y-2">
                          {bestWorstSelf.best.length ? (
                            bestWorstSelf.best.map((bucket) => (
                              <div key={bucket.label} className="rounded-lg border border-white/5 bg-sidebar-accent/40 px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-white">{bucket.label}</span>
                                  <span className="text-sm text-teal-300">{formatSignedCurrency(bucket.totalPnl)}</span>
                                </div>
                                <p className="mt-1 text-xs text-white/45">
                                  {bucket.count} trades · {bucket.winRate.toFixed(0)}% win rate · {bucket.avgRR.toFixed(2)}R average
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-white/45">Not enough trades to rank a strong edge bucket yet.</div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/35">Worst self</p>
                        <div className="mt-3 space-y-2">
                          {bestWorstSelf.worst.length ? (
                            bestWorstSelf.worst.map((bucket) => (
                              <div key={bucket.label} className="rounded-lg border border-white/5 bg-sidebar-accent/40 px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-white">{bucket.label}</span>
                                  <span className="text-sm text-rose-300">{formatSignedCurrency(bucket.totalPnl)}</span>
                                </div>
                                <p className="mt-1 text-xs text-white/45">
                                  {bucket.count} trades · {bucket.winRate.toFixed(0)}% win rate · {bucket.avgRR.toFixed(2)}R average
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-white/45">Not enough trades to isolate a weak behavior bucket yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Pattern library</h3>
                        <p className="mt-1 text-xs text-white/45">
                          Save replay setups and jump to similar structures from the current session.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={saveCurrentPattern}
                        disabled={!currentCandle}
                      >
                        Save current
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {patternLibrary.length ? (
                        patternLibrary.slice(0, 6).map((pattern) => {
                          const isActive = selectedPatternId === pattern.id;
                          return (
                            <button
                              key={pattern.id}
                              type="button"
                              onClick={() => setSelectedPatternId(pattern.id)}
                              className={cn(
                                "w-full rounded-xl border px-3 py-3 text-left transition",
                                isActive
                                  ? "border-teal-400/50 bg-sidebar text-white"
                                  : "border-white/5 bg-sidebar hover:bg-sidebar-accent"
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">{pattern.name}</p>
                                <span className="text-[11px] text-white/45">
                                  {pattern.featureVector.direction}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-white/45">
                                {pattern.featureVector.rangePips.toFixed(1)} pip range · impulse {pattern.featureVector.impulsePips.toFixed(1)} pips
                              </p>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                          Save a replay moment to start building your pattern library.
                        </div>
                      )}
                    </div>

                    {selectedPattern && patternMatches.length ? (
                      <div className="mt-4 rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/35">Closest matches</p>
                        <div className="mt-3 space-y-2">
                          {patternMatches.map((match) => (
                            <button
                              key={`${match.patternId}-${match.timeUnix}`}
                              type="button"
                              onClick={() => {
                                const nextIndex = nearestCandleIndex(allCandles, match.timeUnix);
                                seekReplay(nextIndex);
                              }}
                              className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-sidebar-accent/40 px-3 py-2 text-left text-sm transition hover:bg-sidebar-accent"
                            >
                              <span className="text-white/75">
                                {format(new Date(match.timeUnix * 1000), "MMM d HH:mm")}
                              </span>
                              <span className="text-teal-300">{Math.round(match.score * 100)}%</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Replay snapshots</h3>
                        <p className="mt-1 text-xs text-white/45">
                          Freeze the chart, drawings, and context at a candle for mentor or self-review.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={createSharedSnapshot}
                        disabled={!currentCandle}
                      >
                        Save snapshot
                      </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {sharedSnapshots.length ? (
                        sharedSnapshots.slice(0, 6).map((snapshot) => (
                          <div
                            key={snapshot.id}
                            className={cn(
                              "rounded-xl border px-3 py-3",
                              selectedSharedSnapshotId === snapshot.id
                                ? "border-teal-400/50 bg-sidebar"
                                : "border-white/5 bg-sidebar"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => applySharedSnapshot(snapshot.id)}
                                className="text-left"
                              >
                                <p className="text-sm font-medium text-white">{snapshot.label}</p>
                                <p className="mt-1 text-xs text-white/45">
                                  {snapshot.selectedContextTimeframes.length
                                    ? `Context ${snapshot.selectedContextTimeframes.map(getTimeframeCompactLabel).join(", ")}`
                                    : "No extra context panes"}
                                </p>
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                                onClick={() => void copySharedSnapshotLink(snapshot.id)}
                              >
                                <Copy className="mr-1 size-3.5" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                          Save a snapshot to create a frozen replay review link.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <h3 className="text-sm font-semibold text-white">Mistake clustering</h3>
                    <p className="mt-1 text-xs text-white/45">
                      Auto-detected execution and process leaks from the replay session.
                    </p>

                    <div className="mt-4 space-y-2">
                      {replayMistakes.length ? (
                        replayMistakes.map((mistake) => (
                          <button
                            key={mistake.id}
                            type="button"
                            onClick={() => jumpToTimelineEvent(mistake.id)}
                            className="w-full rounded-xl border border-white/5 bg-sidebar px-3 py-3 text-left transition hover:bg-sidebar-accent"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-white">{mistake.title}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border-white/5 bg-sidebar text-white/65",
                                  mistake.severity === "high" && "text-rose-300",
                                  mistake.severity === "medium" && "text-amber-300"
                                )}
                              >
                                {mistake.severity}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-white/45">{mistake.detail}</p>
                            <div className="mt-3">
                              <span
                                onClick={(event) => {
                                  event.stopPropagation();
                                  resumeFromMistake(mistake.id);
                                }}
                                className="inline-flex cursor-pointer items-center rounded-md border border-white/5 bg-sidebar-accent px-2 py-1 text-[11px] text-white/65 transition hover:bg-sidebar hover:text-white"
                              >
                                Resume drill
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                          No obvious process leaks detected yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Monte Carlo</h3>
                        <p className="mt-1 text-xs text-white/45">
                          Stress test expectancy and drawdown across randomized trade sequences.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
                        onClick={() => void runMonteCarlo()}
                        disabled={!sessionId || isRunningMonteCarlo}
                      >
                        {isRunningMonteCarlo ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                        Run
                      </Button>
                    </div>

                    {monteCarloResult ? (
                      <div className="mt-4 grid gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Median finish</span>
                          <span className="text-white">${monteCarloResult.finalEquity.p50.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Profitable paths</span>
                          <span className="text-white">{monteCarloResult.probabilities.profitableAfter.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Drawdown &gt; 20%</span>
                          <span className="text-white">{monteCarloResult.probabilities.drawdownExceeds20.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Kelly / half Kelly</span>
                          <span className="text-white">
                            {monteCarloResult.kellyCriterion.toFixed(2)}% / {monteCarloResult.halfKelly.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                        Run a simulation once you want a probabilistic view of the session edge.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                    <h3 className="text-sm font-semibold text-white">Execution environment</h3>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Spread model</span>
                        <span className="text-white">{formatPrice(symbol, executionEnvironment.spread)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Slippage model</span>
                        <span className="text-white">{executionEnvironment.slippagePips.toFixed(2)} pips</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Commission</span>
                        <span className="text-white">${executionEnvironment.commissionPerLot.toFixed(2)} / lot</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Liquidity regime</span>
                        <span className="text-white">{executionEnvironment.sessionLabel}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Intrabar mode</span>
                        <span className="text-white">
                          {simulationConfig.intrabarMode === "bar-magnifier"
                            ? `Bar magnifier${barMagnifierTimeframe ? ` · ${getTimeframeCompactLabel(barMagnifierTimeframe)}` : ""}`
                            : "Candle path"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            </Tabs>
          ) : null}
        </div>

        {showRightPanel ? (
        <aside className="flex w-[352px] shrink-0 flex-col bg-sidebar">
          <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-400 text-xs font-semibold text-slate-950">
                PE
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{symbol}</p>
                <p className="text-xs text-white/45">{symbolDisplayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/5 bg-sidebar-accent text-white/65">
                {challengeStateLabel}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                onClick={() => setShowRightPanel(false)}
              >
                Close
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-white/5 px-4 py-3">
            <button
              type="button"
              onClick={() => setOrderTicketTab("order")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                orderTicketTab === "order"
                  ? "bg-teal-400 text-slate-950"
                  : "bg-sidebar-accent text-white/55 hover:text-white"
              )}
            >
              Order
            </button>
            <button
              type="button"
              onClick={() => setOrderTicketTab("dom")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                orderTicketTab === "dom"
                  ? "bg-teal-400 text-slate-950"
                  : "bg-sidebar-accent text-white/55 hover:text-white"
              )}
            >
              DOM
            </button>
          </div>

          {orderTicketTab === "order" ? (
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
              <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/5 bg-sidebar-accent">
                <button
                  type="button"
                  onClick={() => void openTrade("short")}
                  className="border-r border-white/5 px-4 py-3 text-left transition hover:bg-rose-500/10"
                >
                  <p className="text-sm font-semibold text-rose-300">Sell</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(symbol, bidPrice)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => void openTrade("long")}
                  className="px-4 py-3 text-right transition hover:bg-teal-500/10"
                >
                  <p className="text-sm font-semibold text-teal-300">Buy</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(symbol, askPrice)}</p>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-sidebar-accent p-1">
                {(["market", "limit", "stop", "stop-limit"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEntryMode(mode)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium capitalize transition",
                      entryMode === mode
                        ? "bg-teal-400 text-slate-950 shadow-sm"
                        : "text-white/55 hover:bg-sidebar hover:text-white"
                    )}
                  >
                    {mode === "stop-limit" ? "stop-limit" : mode}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-sidebar-accent p-1">
                <button
                  type="button"
                  onClick={() => setChartOrderSide(null)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    chartOrderSide === null
                      ? "bg-teal-400 text-slate-950 shadow-sm"
                      : "text-white/55 hover:bg-sidebar hover:text-white"
                  )}
                >
                  Chart off
                </button>
                <button
                  type="button"
                  onClick={() => setChartOrderSide("long")}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    chartOrderSide === "long"
                      ? "bg-teal-400 text-slate-950 shadow-sm"
                      : "text-white/55 hover:bg-sidebar hover:text-white"
                  )}
                >
                  Chart buy
                </button>
                <button
                  type="button"
                  onClick={() => setChartOrderSide("short")}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    chartOrderSide === "short"
                      ? "bg-teal-400 text-slate-950 shadow-sm"
                      : "text-white/55 hover:bg-sidebar hover:text-white"
                  )}
                >
                  Chart sell
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <Field label={entryMode === "stop-limit" ? "Stop price" : "Price"}>
                  <Input
                    value={effectiveTicketPrice}
                    onChange={(event) => setTicketPrice(event.target.value)}
                    className="h-11 border-white/5 bg-sidebar-accent text-base text-white"
                  />
                </Field>
                {entryMode === "stop-limit" ? (
                  <Field label="Limit price">
                    <Input
                      value={ticketSecondaryPrice || effectiveTicketPrice}
                      onChange={(event) => setTicketSecondaryPrice(event.target.value)}
                      className="h-11 border-white/5 bg-sidebar-accent text-base text-white"
                    />
                  </Field>
                ) : null}
                <Field label="Units">
                  <Input
                    value={effectiveTicketUnits}
                    onChange={(event) => setTicketUnits(event.target.value)}
                    className="h-11 border-white/5 bg-sidebar-accent text-base text-white"
                  />
                </Field>
              </div>

              <div className="mt-6 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Exits</h3>
                  <Switch checked={showSLTP} onCheckedChange={setShowSLTP} />
                </div>
                <div className="mt-4 space-y-3">
                  <Field label="Take profit, pips">
                    <Input
                      type="number"
                      value={defaultTPPips}
                      onChange={(event) => setDefaultTPPips(Number(event.target.value))}
                      className="h-10 border-white/5 bg-sidebar text-white"
                    />
                  </Field>
                  <Field label="Stop loss, pips">
                    <Input
                      type="number"
                      value={defaultSLPips}
                      onChange={(event) => setDefaultSLPips(Number(event.target.value))}
                      className="h-10 border-white/5 bg-sidebar text-white"
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                <h3 className="text-sm font-semibold text-white">Extra settings</h3>
                <div className="mt-4 space-y-3">
                  <Field label="Intrabar model">
                    <Select
                      value={simulationConfig.intrabarMode}
                      onValueChange={(value) =>
                        setSimulationConfig((previous) => ({
                          ...previous,
                          intrabarMode: value as IntrabarMode,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 border-white/5 bg-sidebar text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="candle-path">Candle path</SelectItem>
                        <SelectItem value="bar-magnifier">
                          Bar magnifier{barMagnifierTimeframe ? ` · ${getTimeframeCompactLabel(barMagnifierTimeframe)}` : ""}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Time in force">
                    <Select value={timeInForce} onValueChange={(value) => setTimeInForce(value as TimeInForce)}>
                      <SelectTrigger className="h-10 border-white/5 bg-sidebar text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="gtc">GTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-sidebar px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">OCO linking</p>
                      <p className="text-xs text-white/45">Link the next queued order to the current one.</p>
                    </div>
                    <Switch checked={ocoEnabled} onCheckedChange={setOcoEnabled} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-sidebar px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">Blind macro news</p>
                      <p className="text-xs text-white/45">Hide future high-impact calendar events until they print.</p>
                    </div>
                    <Switch
                      checked={simulationConfig.hideUpcomingHighImpactNews}
                      onCheckedChange={(checked) =>
                        setSimulationConfig((previous) => ({
                          ...previous,
                          hideUpcomingHighImpactNews: checked,
                        }))
                      }
                    />
                  </div>
                  <Field label="Risk %">
                    <Input
                      type="number"
                      value={riskPercent}
                      min={0.1}
                      max={10}
                      step={0.1}
                      onChange={(event) => setRiskPercent(Number(event.target.value))}
                      className="h-10 border-white/5 bg-sidebar text-white"
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                <h3 className="text-sm font-semibold text-white">Order info</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Margin</span>
                    <span className="font-medium text-white">${estimatedMargin.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Leverage</span>
                    <span className="font-medium text-white">50:1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Trade value</span>
                    <span className="font-medium text-white">${estimatedTradeValue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Available funds</span>
                    <span className="font-medium text-white">${availableFunds.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Target at TP</span>
                    <span className="font-medium text-teal-300">${estimatedTargetAtTP.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {replayPendingOrders.length ? (
                <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Queued orders</h3>
                    <Badge variant="outline" className="border-white/5 bg-sidebar text-white/55">
                      {replayPendingOrders.length}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {replayPendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-white/5 bg-sidebar px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">
                              {order.direction === "long" ? "Buy" : "Sell"} {order.orderType}
                            </p>
                            <p className="mt-0.5 text-xs text-white/45">
                              {order.units.toLocaleString()} @ {formatPrice(symbol, order.entryPrice)}
                              {order.expiresAtUnix
                                ? ` · expires ${format(new Date(order.expiresAtUnix * 1000), "MMM d HH:mm")}`
                                : " · GTC"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                            onClick={() => cancelPendingOrder(order.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 space-y-2">
                <Button
                  className="h-14 w-full rounded-2xl bg-teal-400 text-base font-semibold text-slate-950 hover:bg-teal-300"
                  onClick={() => void openTrade("long")}
                  disabled={!sessionId || !allCandles.length}
                >
                  {entryMode === "market" ? "Buy" : "Place buy"} {effectiveTicketUnits} {symbol} @ {effectiveTicketPrice} {entryMode.toUpperCase()}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-2xl border-white/5 bg-sidebar-accent text-sm text-white/75"
                  onClick={() => void openTrade("short")}
                  disabled={!sessionId || !allCandles.length}
                >
                  {entryMode === "market" ? "Sell market" : `Place sell ${entryMode}`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden px-4 pb-6 pt-4">
              <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Depth ladder</p>
                    <p className="mt-1 text-xs text-white/45">
                      Click a level to stage that price in the ticket.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Spread</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatPrice(symbol, askPrice - bidPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-3 px-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
                <span>Status</span>
                <span className="justify-self-end">Price</span>
                <span className="justify-self-end">Queued</span>
              </div>

              <div className="mt-2 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-sidebar-accent/40 p-2">
                <div className="space-y-1">
                  {domLevels.map((level) => (
                    <button
                      key={level.price}
                      type="button"
                      onClick={() => {
                        setTicketPrice(formatPrice(symbol, level.price));
                        setOrderTicketTab("order");
                      }}
                      className={cn(
                        "grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                        level.isAsk || level.isBid
                          ? "bg-sidebar text-white"
                          : "text-white/75 hover:bg-sidebar hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {level.isAsk ? (
                          <Badge className="bg-teal-400 text-slate-950">Ask</Badge>
                        ) : level.isBid ? (
                          <Badge className="bg-rose-400 text-slate-950">Bid</Badge>
                        ) : (
                          <span className="text-white/35">Level</span>
                        )}
                      </div>
                      <span className="justify-self-end font-mono text-white">
                        {formatPrice(symbol, level.price)}
                      </span>
                      <span className="justify-self-end text-xs text-white/45">
                        {level.matchingOrders.length
                          ? `${level.matchingOrders.length} order${level.matchingOrders.length === 1 ? "" : "s"}`
                          : "-"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Queued orders</h3>
                  <Badge variant="outline" className="border-white/5 bg-sidebar text-white/55">
                    {replayPendingOrders.length}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {replayPendingOrders.length ? (
                    replayPendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-white/5 bg-sidebar px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">
                              {order.direction === "long" ? "Buy" : "Sell"} {order.orderType}
                            </p>
                            <p className="mt-0.5 text-xs text-white/45">
                              {formatPrice(symbol, order.entryPrice)}
                              {order.triggerPrice ? ` · trigger ${formatPrice(symbol, order.triggerPrice)}` : ""}
                              {` · ${Math.max(0, Math.round(order.remainingUnits ?? order.units)).toLocaleString()} / ${order.units.toLocaleString()} units`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                            onClick={() => cancelPendingOrder(order.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                      No queued orders on the ladder.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
        ) : null}
      </div>
    </main>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/5 bg-sidebar-accent/50 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-white/5 bg-sidebar">
          <Icon className="size-4 text-white/65" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-white/45">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ReplayHeaderMetric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="min-w-[122px] rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          tone === "positive"
            ? "text-teal-300"
            : tone === "negative"
            ? "text-rose-300"
            : "text-white"
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-white/45">{helper}</p>
    </div>
  );
}

function DeskMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[132px] rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function PlaybackButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
        active ? "bg-teal-400 text-slate-950" : "text-white/60 hover:bg-sidebar hover:text-white"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function DrawingToolButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-xl transition",
        active ? "bg-teal-400 text-slate-950" : "text-white/55 hover:bg-sidebar-accent hover:text-white",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-white/55"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function ShortcutPill({ label, description }: { label: string; description: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-sidebar-accent/50 px-2 py-1 text-[11px] text-white/55">
      <span className="rounded-md bg-sidebar px-1.5 py-0.5 font-mono text-white/75">{label}</span>
      {description}
    </span>
  );
}

function IndicatorBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-sidebar-accent px-2 py-1">
      <span className="text-white/35">{label}</span>
      <span className="font-medium text-white/80">{value}</span>
    </span>
  );
}

function IndicatorToggle({
  label,
  checked,
  value,
  onToggle,
  onValueChange,
}: {
  label: string;
  checked: boolean;
  value: number;
  onToggle: (enabled: boolean) => void;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <Switch checked={checked} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
      </div>
      <Input
        type="number"
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        disabled={!checked}
        className="h-8 w-20 border-white/5 bg-sidebar text-xs"
      />
    </div>
  );
}

function RuleProgress({
  label,
  current,
  target,
  helper,
  positive = false,
}: {
  label: string;
  current: number;
  target: number;
  helper: string;
  positive?: boolean;
}) {
  const rawProgress = target > 0 ? (current / target) * 100 : positive ? 100 : 0;
  const progress = clamp(rawProgress, 0, 100);

  return (
    <div className="mb-3 rounded-xl border border-white/5 bg-sidebar-accent/50 p-3 last:mb-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-xs text-white/50">{helper}</span>
      </div>
      <Progress
        value={progress}
        className={cn(
          "h-2 bg-white/8",
          positive
            ? "[&_[data-slot=progress-indicator]]:bg-teal-400"
            : "[&_[data-slot=progress-indicator]]:bg-amber-400"
        )}
      />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/5 bg-sidebar-accent/50 px-4 py-6 text-center text-sm text-white/45">
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </Label>
      {children}
    </div>
  );
}

function NewSessionDialog({
  open,
  onOpenChange,
  sessionName,
  setSessionName,
  sessionDescription,
  setSessionDescription,
  symbol,
  setSymbol,
  timeframe,
  setTimeframe,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  initialBalance,
  setInitialBalance,
  riskPercent,
  setRiskPercent,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sessionName: string;
  setSessionName: (value: string) => void;
  sessionDescription: string;
  setSessionDescription: (value: string) => void;
  symbol: string;
  setSymbol: (value: string) => void;
  timeframe: string;
  setTimeframe: (value: BacktestTimeframe) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  initialBalance: number;
  setInitialBalance: (value: number) => void;
  riskPercent: number;
  setRiskPercent: (value: number) => void;
  onCreate: () => Promise<void>;
}) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Backtest Session</DialogTitle>
          <DialogDescription>
            Build the scenario first: instrument, date range, risk model, and the playbook you want to train.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Session Name</Label>
            <Input
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="London reversal drill"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Session Brief</Label>
            <Textarea
              value={sessionDescription}
              onChange={(event) => setSessionDescription(event.target.value)}
              placeholder="What are you practicing, what is disallowed, and how will you score yourself?"
              className="mt-1 min-h-24"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Initial Balance ($)</Label>
              <Input
                type="number"
                value={initialBalance}
                onChange={(event) => setInitialBalance(Number(event.target.value))}
                className="mt-1"
                min={100}
              />
            </div>
            <div>
              <Label className="text-xs">Risk per Trade (%)</Label>
              <Input
                type="number"
                value={riskPercent}
                onChange={(event) => setRiskPercent(Number(event.target.value))}
                className="mt-1"
                min={0.1}
                max={10}
                step={0.1}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
            {isCreating && <Loader2 className="size-3.5 animate-spin" />}
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandleScrubber({
  candles,
  trades,
  currentIndex,
  onSeek,
}: {
  candles: CandleData[];
  trades: BacktestTrade[];
  currentIndex: number;
  onSeek: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [width, setWidth] = useState(0);

  const tradeRanges = useMemo(() => {
    if (!candles.length) return [];
    return trades
      .map((trade) => {
        const entryIndex = candles.findIndex((candle) => (candle.time as number) >= getEntryUnix(trade));
        if (entryIndex === -1 || entryIndex > currentIndex) return null;

        const rawExitUnix = getExitUnix(trade);
        const exitIndex =
          rawExitUnix == null
            ? currentIndex
            : candles.findIndex((candle) => (candle.time as number) >= rawExitUnix);

        return {
          entryIndex,
          exitIndex: exitIndex === -1 ? currentIndex : Math.min(exitIndex, currentIndex),
          pnl: trade.pnl || 0,
        };
      })
      .filter(Boolean) as { entryIndex: number; exitIndex: number; pnl: number }[];
  }, [candles, currentIndex, trades]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setWidth(nextWidth);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !candles.length) return;

    const dpr = window.devicePixelRatio || 1;
    const heatmapHeight = 22;
    const tradeHeight = 6;
    const playheadHeight = 8;
    const totalHeight = heatmapHeight + tradeHeight + playheadHeight;

    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, totalHeight);

    const total = candles.length;
    const barWidth = Math.max(width / total, 0.5);
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    candles.forEach((candle) => {
      minPrice = Math.min(minPrice, candle.low);
      maxPrice = Math.max(maxPrice, candle.high);
    });
    const range = maxPrice - minPrice || 1;

    candles.forEach((candle, index) => {
      const x = (index / total) * width;
      const strength = (candle.close - minPrice) / range;
      const alpha = index <= currentIndex ? 0.42 + strength * 0.28 : 0.08 + strength * 0.06;
      context.fillStyle =
        candle.close >= candle.open
          ? `rgba(20,184,166,${alpha})`
          : `rgba(251,113,133,${alpha})`;
      context.fillRect(x, 0, Math.max(1, barWidth), heatmapHeight);
    });

    context.fillStyle = "rgba(255,255,255,0.03)";
    context.fillRect(0, heatmapHeight, width, tradeHeight);

    tradeRanges.forEach((rangeItem) => {
      const x1 = (rangeItem.entryIndex / total) * width;
      const x2 = (rangeItem.exitIndex / total) * width;
      context.fillStyle =
        rangeItem.pnl >= 0 ? "rgba(45,212,191,0.85)" : "rgba(251,113,133,0.85)";
      context.fillRect(x1, heatmapHeight + 1, Math.max(3, x2 - x1), tradeHeight - 2);
    });

    const playheadY = heatmapHeight + tradeHeight;
    context.fillStyle = "rgba(255,255,255,0.03)";
    context.fillRect(0, playheadY, width, playheadHeight);

    const playheadX = (currentIndex / Math.max(total - 1, 1)) * width;
    context.fillStyle = "rgba(250,204,21,0.3)";
    context.fillRect(playheadX - 0.5, 0, 1, heatmapHeight + tradeHeight);
    context.fillStyle = "#facc15";
    context.beginPath();
    context.roundRect(playheadX - 4, playheadY + 1, 8, playheadHeight - 2, 3);
    context.fill();
  }, [candles, currentIndex, tradeRanges, width]);

  const handlePointerEvent = useCallback(
    (event: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !candles.length) return;
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const index = Math.round((x / rect.width) * (candles.length - 1));
      onSeek(index);
    },
    [candles.length, onSeek]
  );

  return (
    <div className="py-0.5">
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden rounded-xl bg-black/15 transition-colors",
          isScrubbing ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{ height: 40 }}
        onPointerDown={(event) => {
          isDragging.current = true;
          setIsScrubbing(true);
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
          handlePointerEvent(event);
        }}
        onPointerMove={(event) => {
          if (isDragging.current) handlePointerEvent(event);
        }}
        onPointerUp={() => {
          isDragging.current = false;
          setIsScrubbing(false);
        }}
        onPointerCancel={() => {
          isDragging.current = false;
          setIsScrubbing(false);
        }}
        onPointerLeave={() => {
          if (!isDragging.current) return;
          isDragging.current = false;
          setIsScrubbing(false);
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
