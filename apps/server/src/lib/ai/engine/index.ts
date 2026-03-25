/**
 * Trading Brain Engine — Central Exports
 *
 * Re-exports all engine modules for convenient imports.
 */

// Types
export type {
  TraderProfileData,
  SessionProfile,
  SymbolProfile,
  HoldTimeProfile,
  RRProfile,
  ExecutionProfile,
  HourlyProfile,
  WeekdayProfile,
  ProtocolStats,
  ConsistencyProfile,
  OpportunityCostProfile,
  EdgeCondition,
  LeakCondition,
  InsightResult,
  InsightCategory,
  InsightSeverity,
  LiveTradeAlert,
  AlertType,
  TradeScoreResult,
  CondensedProfile,
  ExtendedInsightCategory,
  EmotionStage,
  PreEntryEmotion,
  DuringEmotion,
  PostExitEmotion,
  RuleType,
  RuleCategory,
} from "./types";

export {
  PRE_ENTRY_EMOTIONS,
  DURING_EMOTIONS,
  POST_EXIT_EMOTIONS,
  RULE_TYPES,
  RULE_CATEGORIES,
} from "./types";

// Trader Profile
export {
  computeTraderProfile,
  getOrComputeProfile,
  refreshProfileIfStale,
  getFullProfile,
  condenseProfile,
} from "./trader-profile";

// Behavioral Analyzer
export {
  analyzeEdgeConditions,
  analyzeLeakConditions,
  analyzeAllConditions,
  findEdges,
  findLeaks,
} from "./behavioral-analyzer";

export {
  describeConditionPredicate,
  describeConditionTrades,
  matchesConditionFilters,
  summarizeConditionFilters,
} from "./condition-language";

// Insight Engine
export {
  generateInsights,
  generateTradeCloseInsights,
  saveInsights,
} from "./insight-engine";

// Live Monitor
export {
  monitorOpenTrades,
  scoreOpenTradeWithProfile,
  checkForAnomalies,
  saveAlerts,
} from "./live-monitor";

// Psychology Engine
export {
  computeEmotionCorrelations,
  detectTiltStatus,
  computeMentalPerformanceScore,
  computePsychologyProfile,
} from "./psychology-engine";

export type {
  EmotionCorrelation,
  TiltStatus,
  TiltIndicator,
  MentalPerformanceScore,
  PsychologyProfile,
} from "./psychology-engine";

// Digest Generator
export {
  generateMorningBriefing,
  getLatestBriefingReviewSnapshot,
  generateTradeFeedback,
  checkAndGenerateMilestone,
  saveDigest,
} from "./digest-generator";

// Rules Engine
export {
  evaluateTradeAgainstRules,
  getDailyComplianceReport,
  saveRuleViolation,
  generateSuggestedRules,
} from "./rules-engine";

export type {
  RuleEvaluationResult,
  ComplianceReport,
  SuggestedRule,
} from "./rules-engine";

// Risk Simulator
export {
  runMonteCarloSimulation,
  calculateRiskOfRuin,
  computeDrawdownProfile,
  getPositionSizeRecommendations,
} from "./risk-simulator";

export type {
  MonteCarloResult,
  RiskOfRuinResult,
  DrawdownProfile,
  DrawdownPeriod,
  PositionSizeRecommendation,
} from "./risk-simulator";

// Session Tracker
export {
  getCurrentSessionState,
  generateCoachingNudges,
  generateSessionSummary,
} from "./session-tracker";

export type {
  SessionState,
  CoachingNudge,
} from "./session-tracker";

// Memory Manager
export {
  saveMemory,
  getRelevantMemories,
  getMemoryPromptContext,
  extractMemoryCandidates,
  processConversationMemories,
  getAllMemories,
  deleteMemory,
  updateMemory,
} from "./memory-manager";

export type {
  MemoryEntry,
  MemoryContext,
} from "./memory-manager";
