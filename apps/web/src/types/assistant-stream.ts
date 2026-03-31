/**
 * Premium Trading AI Assistant - Streaming Protocol Types
 *
 * Defines the event stream format for real-time assistant responses
 * with structured analysis blocks for the right panel.
 */

export type StreamStage =
  | "thinking" // Understanding the question
  | "planning" // Mapping to trade fields
  | "querying" // Scanning trades
  | "aggregating" // Computing metrics
  | "writing" // Drafting explanation
  | "finalizing"; // Formatting output

export type ConfidenceLevel = "exploratory" | "moderate" | "high";

/**
 * Visualization types that map to specific UI components
 */
export type VizType =
  | "kpi_single"
  | "kpi_grid"
  | "bar_chart"
  | "horizontal_bar"
  | "area_chart"
  | "comparison_bar"
  | "trade_table"
  | "breakdown_table"
  | "calendar"
  | "win_rate_card"
  | "asset_profitability"
  | "trade_counts"
  | "losses_breakdown"
  | "daily_pnl"
  | "weekday_performance"
  | "text_answer";

export type ComponentHint =
  | "account-balance"
  | "account-equity"
  | "win-streak"
  | "profit-factor"
  | "win-rate"
  | "hold-time"
  | "average-rr"
  | "asset-profitability"
  | "trade-counts"
  | "profit-expectancy"
  | "total-losses"
  | "consistency-score"
  | "open-trades"
  | "daily-net"
  | "performance-weekday"
  | "performing-assets"
  | "calendar"
  | "trade-table"
  | "inline-table"
  | "auto";

export type DisplayMode = "singular" | "plural" | "comparison" | "timeline";

/**
 * Visualization data configuration
 */
export interface VizDataConfig {
  // For KPI displays
  value?: string | number;
  label?: string;
  unit?: string;
  change?: number;
  changeLabel?: string;

  // For charts/tables - the actual data rows
  rows?: any[];

  // Column definitions for tables
  columns?: Array<{
    key: string;
    label: string;
    type?: "string" | "number" | "currency" | "percent" | "date" | "ratio";
  }>;

  // Chart-specific config
  xAxis?: string;
  yAxis?: string;
  groupKey?: string;
  valueFormat?: "currency" | "percent" | "ratio" | "number";

  // For comparisons
  comparison?: {
    a: { label: string; value: number | string; count?: number };
    b: { label: string; value: number | string; count?: number };
    delta?: number | string;
    deltaPercent?: string;
    metricField?: string;
    format?: "currency" | "percent" | "ratio" | "number";
    betterWhen?: "higher" | "lower";
  };

  // Trade IDs for "view trades" action
  tradeIds?: string[];

  // Date range for calendar/timeline views
  dateRange?: {
    from: string;
    to: string;
  };

  // Summary stats
  summary?: {
    total?: number;
    count?: number;
    average?: number;
    best?: { label: string; value: number | string };
    worst?: { label: string; value: number | string };
  };
}

/**
 * Visualization style configuration
 */
export interface VizStyleConfig {
  colorScheme?: "profit" | "loss" | "neutral" | "comparison";
  size?: "compact" | "default" | "expanded";
  showLegend?: boolean;
  showTooltip?: boolean;
  showLabels?: boolean;
  animate?: boolean;
}

/**
 * Visualization specification from server
 */
export type ChartType =
  | "bar"
  | "area"
  | "scatter"
  | "heatmap"
  | "kpi"
  | "comparison"
  | "table";

export interface VizSpec {
  type: VizType;
  component: ComponentHint;
  mode: DisplayMode;
  title: string;
  subtitle?: string;
  data: VizDataConfig;
  style?: VizStyleConfig;
  /** Optional explicit chart type hint from AI plan */
  chartType?: ChartType;
}

/**
 * Analysis blocks for the right panel (trade-specific)
 */
export type AnalysisBlock =
  | {
      type: "querySummary";
      title: string;
      bullets: string[];
    }
  | {
      type: "insights";
      title: string;
      items: string[];
    }
  | {
      type: "recommendations";
      title: string;
      items: string[];
    }
  | {
      type: "sources";
      title: string;
      items: Array<{ label: string; detail: string }>;
      tradesUrl?: string;
    }
  | {
      type: "coverage";
      title: string;
      n: number;
      from?: string;
      to?: string;
      confidence?: ConfidenceLevel;
    }
  | {
      type: "stats";
      title: string;
      rows: Array<{
        label: string;
        value: string;
        note?: string;
      }>;
    }
  | {
      type: "breakdownTable";
      title: string;
      columns: string[];
      rows: (string | number | null)[][];
    }
  | {
      type: "tradePreview";
      title: string;
      tradeIds: string[];
      columns: string[];
      rows: any[][];
    }
  | {
      type: "callout";
      tone: "info" | "warning" | "success";
      title: string;
      body: string;
    }
  | {
      type: "visualization";
      viz: VizSpec;
    }
  | {
      type: "profileSummary";
      profile: CondensedProfile;
    }
  | {
      type: "edgeConditions";
      title: string;
      edges: Array<{
        label: string;
        winRate: number;
        trades: number;
        confidence: string;
      }>;
      leaks: Array<{
        label: string;
        winRate: number;
        trades: number;
        confidence: string;
      }>;
    }
  | {
      type: "insightCard";
      title: string;
      severity: string;
      message: string;
      recommendation: string;
    }
  | {
      type: "tiltStatus";
      tiltScore: number;
      level: string;
      indicators: Array<{ label: string; severity: string }>;
      mentalScore?: number;
    }
  | {
      type: "sessionCoaching";
      isActive: boolean;
      tradeCount: number;
      wins: number;
      losses: number;
      runningPnL: number;
      nudges: Array<{
        type: string;
        title: string;
        message: string;
        severity: string;
      }>;
    };

/**
 * Condensed trader profile for display
 */
export interface CondensedProfile {
  winRate: number;
  profitFactor: number;
  expectancy: number;
  totalTrades: number;
  bestSessions: string[];
  worstSessions: string[];
  bestSymbols: string[];
  worstSymbols: string[];
  rrSweetSpot: string;
  holdTimeSweetSpot: string;
  topEdges: string[];
  topLeaks: string[];
  leavingProfitOnTable: boolean;
  avgProfitLeftPips: number;
  pctExitingTooEarly: number;
  avgPostExitMove: number;
  tradesWithPostExitData: number;
  currentStreak: string;
}

/**
 * Stream events from the backend
 */
export type StreamEvent =
  | {
      event: "status";
      stage: StreamStage;
      message: string;
    }
  | {
      event: "delta";
      text: string; // Markdown tokens
    }
  | {
      event: "analysis";
      block: AnalysisBlock;
    }
  | {
      event: "visualization";
      viz: VizSpec;
    }
  | {
      event: "profile";
      profile: CondensedProfile;
    }
  | {
      event: "insight";
      insights: any[];
    }
  | {
      event: "alert";
      alerts: any[];
    }
  | {
      event: "error";
      message: string;
    }
  | {
      event: "done";
    };

/**
 * Stream state for the UI
 */
export interface AssistantStreamState {
  // Status
  stage: StreamStage | null;
  statusMessage: string;

  // Markdown content
  lines: string[]; // Committed lines
  lineBuffer: string; // Current incomplete line

  // Analysis blocks
  analysisBlocks: AnalysisBlock[];

  // Visualization
  visualization: VizSpec | null;

  // State flags
  isStreaming: boolean;
  isDone: boolean;
  justCompleted: boolean; // For completion shimmer
  presentationReady: boolean;

  // Error handling
  error: string | null;
}

/**
 * Stage display configuration
 */
export const STAGE_CONFIG: Record<
  StreamStage,
  { label: string; message: string }
> = {
  thinking: {
    label: "Thinking",
    message: "Understanding your question…",
  },
  planning: {
    label: "Planning",
    message: "Mapping question → trade fields…",
  },
  querying: {
    label: "Querying",
    message: "Scanning matching trades…",
  },
  aggregating: {
    label: "Computing",
    message: "Computing stats and breakdowns…",
  },
  writing: {
    label: "Writing",
    message: "Drafting explanation…",
  },
  finalizing: {
    label: "Finalizing",
    message: "Formatting tables and analysis…",
  },
};

/**
 * Confidence level thresholds and labels
 */
export function getConfidenceLevel(n: number): ConfidenceLevel {
  if (n < 30) return "exploratory";
  if (n < 100) return "moderate";
  return "high";
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "exploratory":
      return "Exploratory";
    case "moderate":
      return "Moderate confidence";
    case "high":
      return "High confidence";
  }
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case "exploratory":
      return "text-yellow-500";
    case "moderate":
      return "text-blue-500";
    case "high":
      return "text-green-500";
  }
}
