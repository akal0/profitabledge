/**
 * Trading Brain Engine — Core Type Definitions
 *
 * All types used by the trader profile, behavioral analyzer,
 * insight engine, and live monitor.
 */

// ─── Trader Profile ─────────────────────────────────────────────

export interface TraderProfileData {
  // Overall performance
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  avgProfit: number;
  avgLoss: number;
  netPnL: number;

  // Per-session performance (sorted by total profit desc)
  sessions: SessionProfile[];

  // Per-symbol performance (sorted by total profit desc)
  symbols: SymbolProfile[];

  // Hold time analysis
  holdTime: HoldTimeProfile;

  // R:R profile
  rrProfile: RRProfile;

  // Execution quality
  execution: ExecutionProfile;

  // Time-of-day performance
  hourlyProfile: HourlyProfile[];

  // Weekday performance
  weekdayProfile: WeekdayProfile[];

  // Protocol alignment
  protocolStats: ProtocolStats;

  // Streaks
  currentStreak: { type: "win" | "loss" | null; count: number };
  longestWinStreak: number;
  longestLossStreak: number;

  // Consistency (rolling 7-day windows)
  consistency: ConsistencyProfile;

  // Money left on table (MFE / post-exit analysis)
  opportunityCost: OpportunityCostProfile;
}

export interface SessionProfile {
  session: string;
  trades: number;
  wins: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
  avgHoldTime: number; // seconds
  avgRR: number;
}

export interface SymbolProfile {
  symbol: string;
  trades: number;
  wins: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
  avgHoldTime: number; // seconds
}

export interface HoldTimeProfile {
  avgAll: number; // seconds
  avgWins: number;
  avgLosses: number;
  medianAll: number;
  medianWins: number;
  medianLosses: number;
  sweetSpotMin: number; // optimal hold time range (seconds)
  sweetSpotMax: number;
}

export interface RRProfile {
  avgPlannedRR: number;
  avgRealisedRR: number;
  avgMaxRR: number;
  avgCaptureEfficiency: number; // 0-100%
  avgExitEfficiency: number; // 0-100%
  sweetSpotMin: number; // best performing planned RR range
  sweetSpotMax: number;
  sweetSpotWinRate: number;
}

export interface ExecutionProfile {
  avgEntrySpread: number;
  avgExitSpread: number;
  avgEntrySlippage: number;
  avgExitSlippage: number;
  avgSLMods: number;
  avgTPMods: number;
  trailingStopRate: number; // % of trades (0-100)
  partialCloseRate: number; // % of trades (0-100)
}

export interface HourlyProfile {
  hour: number; // 0-23
  trades: number;
  wins: number;
  winRate: number;
  avgProfit: number;
}

export interface WeekdayProfile {
  weekday: string; // Mon, Tue, Wed, Thu, Fri
  trades: number;
  wins: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
}

export interface ProtocolStats {
  alignedWinRate: number;
  alignedCount: number;
  alignedProfit: number;
  againstWinRate: number;
  againstCount: number;
  againstProfit: number;
  discretionaryWinRate: number;
  discretionaryCount: number;
  discretionaryProfit: number;
}

export interface ConsistencyProfile {
  avgDailyTrades: number;
  stdDevDailyTrades: number;
  avgDailyPnL: number;
  stdDevDailyPnL: number;
  consistencyScore: number; // 0-100
}

export interface OpportunityCostProfile {
  avgMFEPips: number;
  avgMAEPips: number;
  avgProfitLeftPips: number; // MFE - actual capture
  avgPostExitMovePips: number;
  pctExitingTooEarly: number; // % where post-exit peak > close (0-100)
}

// ─── Edge & Leak Conditions ─────────────────────────────────────

export interface EdgeCondition {
  label: string; // "EURUSD + London + Aligned + RR 2-3"
  filters: Record<string, string | number>;
  trades: number;
  winRate: number;
  avgProfit: number;
  confidence: "high" | "moderate" | "exploratory";
}

export interface LeakCondition {
  label: string;
  filters: Record<string, string | number>;
  trades: number;
  winRate: number;
  avgLoss: number;
  confidence: "high" | "moderate" | "exploratory";
}

// ─── Insight Results ────────────────────────────────────────────

export type InsightCategory =
  | "behavioral"
  | "efficiency"
  | "risk"
  | "pattern"
  | "anomaly"
  | "positive";

export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export interface InsightResult {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendation: string;
  data: Record<string, any>;
}

// ─── Live Trade Alerts ──────────────────────────────────────────

export type AlertType =
  | "unusual_hold_time"
  | "unusual_session"
  | "unusual_symbol"
  | "unusual_volume"
  | "protocol_deviation"
  | "leak_condition_match"
  | "edge_condition_match"
  | "low_score";

export interface LiveTradeAlert {
  alertType: AlertType;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  data: Record<string, any>;
}

// ─── Trade Score ────────────────────────────────────────────────

export interface TradeScoreResult {
  score: number; // 0-10
  factors: {
    setupAlignment: { score: number; reason: string };
    rrOptimality: { score: number; reason: string };
    timeWindow: { score: number; reason: string };
    assetPerformance: { score: number; reason: string };
    sessionAlignment: { score: number; reason: string };
  };
  edgeMatch: EdgeCondition | null;
  leakMatch: LeakCondition | null;
  recommendation: string;
}

// ─── Condensed Profile for AI Prompts ───────────────────────────

export interface CondensedProfile {
  winRate: number;
  profitFactor: number;
  expectancy: number;
  totalTrades: number;
  bestSessions: string[]; // top 3
  worstSessions: string[]; // bottom 3
  bestSymbols: string[]; // top 3
  worstSymbols: string[]; // bottom 3
  rrSweetSpot: string; // "2.0 - 3.0"
  holdTimeSweetSpot: string; // "15m - 45m"
  topEdges: string[]; // top 3 edge condition labels
  topLeaks: string[]; // top 3 leak condition labels
  leavingProfitOnTable: boolean;
  avgProfitLeftPips: number;
  pctExitingTooEarly: number; // % of trades where price continued favorably after exit
  avgPostExitMove: number; // avg favorable price move after exit (price points)
  tradesWithPostExitData: number; // how many trades have post-exit data
  currentStreak: string; // "3 win streak" or "2 loss streak"
}

// ─── Insight Categories (extended) ──────────────────────────────

export type ExtendedInsightCategory =
  | InsightCategory
  | "psychology"
  | "rule_suggestion"
  | "milestone"
  | "coaching";

// ─── Emotion Types ──────────────────────────────────────────────

export type EmotionStage = "pre_entry" | "during" | "post_exit";

export const PRE_ENTRY_EMOTIONS = [
  "confident",
  "neutral",
  "anxious",
  "fomo",
  "revenge",
  "bored",
  "excited",
  "hesitant",
] as const;

export const DURING_EMOTIONS = [
  "calm",
  "stressed",
  "greedy",
  "fearful",
  "impatient",
  "focused",
] as const;

export const POST_EXIT_EMOTIONS = [
  "satisfied",
  "regretful",
  "relieved",
  "frustrated",
  "indifferent",
  "proud",
] as const;

export type PreEntryEmotion = (typeof PRE_ENTRY_EMOTIONS)[number];
export type DuringEmotion = (typeof DURING_EMOTIONS)[number];
export type PostExitEmotion = (typeof POST_EXIT_EMOTIONS)[number];

// ─── Rule Types ─────────────────────────────────────────────────

export const RULE_TYPES = [
  "allowed_sessions",
  "blocked_sessions",
  "allowed_symbols",
  "max_trades_per_day",
  "max_consecutive_losses",
  "min_rr_ratio",
  "protocol_required",
  "max_daily_loss",
  "no_trading_during_news",
  "time_restriction",
] as const;

export type RuleType = (typeof RULE_TYPES)[number];

export const RULE_CATEGORIES = [
  "session",
  "symbol",
  "risk",
  "timing",
  "setup",
  "psychology",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];
