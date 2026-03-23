// TypeScript types for the Trade View System

/**
 * Sample gate tiers for progressive disclosure
 */
export const SAMPLE_GATE_TIERS = {
  BASIC: "basic",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
  STATISTICAL: "statistical",
} as const;

export type SampleGateTier =
  (typeof SAMPLE_GATE_TIERS)[keyof typeof SAMPLE_GATE_TIERS];

/**
 * Default minimum sample sizes for each tier
 */
export const DEFAULT_MINIMUM_SAMPLES: Record<SampleGateTier, number> = {
  basic: 0,
  intermediate: 30,
  advanced: 100,
  statistical: 200,
};

/**
 * Protocol alignment states (factual tags, not judgmental)
 */
export const PROTOCOL_ALIGNMENT = {
  ALIGNED: "aligned",
  AGAINST: "against",
  DISCRETIONARY: "discretionary",
} as const;

export type ProtocolAlignment =
  (typeof PROTOCOL_ALIGNMENT)[keyof typeof PROTOCOL_ALIGNMENT];

/**
 * Trade outcome classifications
 */
export const OUTCOME = {
  WIN: "Win",
  LOSS: "Loss",
  BREAK_EVEN: "BE",
  PARTIAL_WIN: "PW",
} as const;

export type Outcome = (typeof OUTCOME)[keyof typeof OUTCOME];
export type OutcomeFilter = Outcome | "Live";

/**
 * Metric categories for organization and progressive disclosure
 */
export const METRIC_CATEGORY = {
  INTENT: "Intent",
  EXECUTION: "Execution",
  OPPORTUNITY: "Opportunity",
  EFFICIENCY: "Efficiency",
} as const;

export type MetricCategory =
  (typeof METRIC_CATEGORY)[keyof typeof METRIC_CATEGORY];

/**
 * Trade view configuration structure
 * Views are lenses on trade data - they never mutate data or recalculate metrics
 */
export interface TradeViewConfig {
  // Filters (what trades to show)
  filters: {
    // Tag filters
    sessionTags?: string[];
    edgeIds?: string[];
    modelTags?: string[];
    protocolAlignment?: ProtocolAlignment[];
    outcomes?: OutcomeFilter[];

    // Field filters
    symbols?: string[];
    directions?: ("long" | "short")[];

    // Date range
    dateRange?: {
      start?: string; // ISO date
      end?: string;
    };

    // Numeric range filters
    numericFilters?: {
      [key: string]: { min?: number; max?: number };
      // Examples: holdTime, volume, profit, realisedRR, captureEfficiency
    };
  };

  // Column visibility (what to show)
  visibleColumns: string[]; // Column IDs to display
  hiddenColumns?: string[]; // Explicitly hidden columns (for reset functionality)

  // Column order (optional custom sequence)
  columnOrder?: string[];

  // Sorting
  sorting?: Array<{
    columnId: string;
    direction: "asc" | "desc";
  }>;

  // Emphasis (UI hints, not data changes)
  emphasis?: {
    highlightedMetrics?: string[]; // Show in bold/color
    primaryMetric?: string; // Main focus column (larger font)
  };

  // Sample gate override (user must consent)
  disableSampleGating?: boolean;
}

/**
 * Complete trade view record
 */
export interface TradeView {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  isDefault: boolean;
  sortOrder: number;
  config: TradeViewConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metric definition for registry
 */
export interface MetricDefinition {
  id: string; // Column ID (e.g., "realisedRR", "captureEfficiency")
  name: string; // Display name
  category: MetricCategory;
  sampleGate: SampleGateTier;
  tooltip: string; // Explanation of what this metric measures
  format: "ratio" | "percentage" | "currency" | "pips" | "duration" | "number";
  unit?: string; // Optional unit (e.g., "R", "%", "pips")
}

/**
 * Sample gate status for a user
 */
export interface SampleGateStatus {
  tier: SampleGateTier;
  required: number;
  current: number;
  isUnlocked: boolean;
  message?: string;
  unlockSummary?: string;
  unlocks?: string[];
}

/**
 * Default view templates (for new users)
 */
export const DEFAULT_VIEW_TEMPLATES = {
  SCOREBOARD: "scoreboard",
  EXECUTION_QUALITY: "execution_quality",
  MODEL_PERFORMANCE: "model_performance",
  EDGE_VS_EXECUTION: "edge_vs_execution",
  ADAPTIVE_METRICS: "adaptive_metrics",
} as const;

export type DefaultViewTemplate =
  (typeof DEFAULT_VIEW_TEMPLATES)[keyof typeof DEFAULT_VIEW_TEMPLATES];

/**
 * User sample gate preferences
 */
export interface SampleGatePreferences {
  disableAllGates?: boolean;
  minimumSamples?: {
    basic?: number;
    intermediate?: number;
    advanced?: number;
    statistical?: number;
  };
}
