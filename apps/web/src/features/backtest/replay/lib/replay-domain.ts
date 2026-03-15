"use client";

import type { Time } from "lightweight-charts";

import type {
  AnnotationTool,
  CandleData,
  ChartAnnotation,
} from "@/components/charts/trading-view-chart";

export const SYMBOLS = [
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
] as const;

export const TIMEFRAMES = [
  { value: "m1", label: "1 min" },
  { value: "m5", label: "5 min" },
  { value: "m15", label: "15 min" },
  { value: "m30", label: "30 min" },
  { value: "h1", label: "1 hour" },
  { value: "h4", label: "4 hour" },
  { value: "d1", label: "Daily" },
] as const;

export const PLAYBACK_SPEEDS = [1, 2, 3, 4] as const;
export const LAST_CONTEXT_CANDLE_COUNT = 4;
export const DEFAULT_FAVORITE_TOOLS_BAR_OFFSET = { x: 0, y: 0 } as const;
export const CONTEXT_DOCK_SLOTS = [
  "right-top",
  "right-bottom",
  "left-top",
  "left-bottom",
  "top",
  "bottom",
] as const;

export type BacktestTimeframe = (typeof TIMEFRAMES)[number]["value"];
export type TradeStatus = "open" | "closed" | "stopped" | "target";
export type TimeInForce = "day" | "week" | "gtc";
export type LayoutPreset = "execution" | "chart-only" | "review" | "coach";
export type WorkspaceTab = "positions" | "history" | "review";
export type ContextPanePosition = { x: number; y: number };
export type FavoriteToolsBarOffset = { x: number; y: number };
export type ContextPaneMode = "last" | "recent" | "full";
export type ContextDockSlot = (typeof CONTEXT_DOCK_SLOTS)[number];
export type IntrabarMode = "candle-path" | "bar-magnifier";
export type ReviewPlaybackMode = "manual" | "events";

export interface ContextPaneSeriesItem {
  timeframe: BacktestTimeframe;
  label: string;
  mode: ContextPaneMode;
  candles: CandleData[];
}

export interface BacktestTrade {
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

export interface BacktestPendingOrder {
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

export interface ReplayCheckpoint {
  id: string;
  label: string;
  timeUnix: number;
  createdAtUnix: number;
}

export interface ReplayNewsEvent {
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

export interface ReplayTimelineEvent {
  id: string;
  type: "checkpoint" | "trade-entry" | "trade-exit" | "news" | "drawdown" | "mistake";
  label: string;
  helper: string;
  timeUnix: number;
  tone: "positive" | "negative" | "neutral";
  tradeId?: string;
}

export interface ReplayMistake {
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

export interface ReplayPatternTemplate {
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

export interface ReplayPatternMatch {
  patternId: string;
  timeUnix: number;
  score: number;
}

export interface ReplaySharedSnapshot {
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

export interface ReplayWorkspaceState {
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

export interface ReplaySimulationConfig {
  intrabarMode: IntrabarMode;
  hideUpcomingHighImpactNews: boolean;
}

export interface RuleSetOption {
  id: string;
  name: string;
  description?: string | null;
}

export interface RulebookCoachingSummary {
  totalTrades: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  complianceRate: number;
  averageScore: number;
  topViolations: Array<{ violation: string; count: number }>;
}

export interface RulebookCoachingEvaluation {
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

export interface RulebookCoachingResult {
  ruleSet: RuleSetOption | null;
  summary: RulebookCoachingSummary | null;
  evaluations: RulebookCoachingEvaluation[];
}

export interface MonteCarloResult {
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

export interface IndicatorSettings {
  sma1: { enabled: boolean; period: number; color: string };
  sma2: { enabled: boolean; period: number; color: string };
  ema1: { enabled: boolean; period: number; color: string };
  rsi: { enabled: boolean; period: number };
  macd: { enabled: boolean; fastPeriod: number; slowPeriod: number; signalPeriod: number };
  bb: { enabled: boolean; period: number; stdDev: number };
  atr: { enabled: boolean; period: number };
}

export type ChallengePresetId = "none" | "prop" | "sprint";

export interface ChallengeConfig {
  profitTargetPct: number;
  maxDrawdownPct: number;
  dailyLossPct: number;
  minTrades: number;
  enforce: boolean;
}

export const defaultIndicatorSettings: IndicatorSettings = {
  sma1: { enabled: true, period: 20, color: "#FBBF24" },
  sma2: { enabled: false, period: 50, color: "#38BDF8" },
  ema1: { enabled: false, period: 21, color: "#F472B6" },
  rsi: { enabled: false, period: 14 },
  macd: { enabled: false, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bb: { enabled: false, period: 20, stdDev: 2 },
  atr: { enabled: false, period: 14 },
};

export const CHALLENGE_PRESETS: Record<
  ChallengePresetId,
  ChallengeConfig & { label: string; description: string }
> = {
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

export const defaultSimulationConfig: ReplaySimulationConfig = {
  intrabarMode: "candle-path",
  hideUpcomingHighImpactNews: true,
};

export const TIMEFRAME_TO_SECONDS: Record<BacktestTimeframe, number> = {
  m1: 60,
  m5: 60 * 5,
  m15: 60 * 15,
  m30: 60 * 30,
  h1: 60 * 60,
  h4: 60 * 60 * 4,
  d1: 60 * 60 * 24,
};

export const dashboardActionButtonClass =
  "cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3";
