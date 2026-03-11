/**
 * Trade Query Plan Schema
 * 
 * Defines the structured query language for trade analysis.
 * All AI outputs must conform to this schema.
 */

import { z } from "zod";

// ===== FILTER SCHEMA =====

export const FilterOpSchema = z.enum([
  "eq",      // equals
  "neq",     // not equals
  "gt",      // greater than
  "gte",     // greater than or equal
  "lt",      // less than
  "lte",     // less than or equal
  "in",      // in array
  "contains",// string contains
  "between"  // between two values
]);

export const BaseFilterSchema = z.object({
  field: z.string(),
});

export const SimpleFilterSchema = BaseFilterSchema.extend({
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"]),
  value: z.any(), // will be validated against field type
});

export const BetweenFilterSchema = BaseFilterSchema.extend({
  op: z.literal("between"),
  value: z.object({
    from: z.any(),
    to: z.any(),
  }),
});

export const FilterSchema = z.discriminatedUnion("op", [
  SimpleFilterSchema,
  BetweenFilterSchema,
]);

export type Filter = z.infer<typeof FilterSchema>;

// ===== AGGREGATION SCHEMA =====

export const AggregationFnSchema = z.enum([
  "avg",
  "sum",
  "min",
  "max",
  "count",
  "p50",  // median
  "p90",  // 90th percentile
]);

export const AggregateSchema = z.object({
  fn: AggregationFnSchema,
  field: z.string().optional(), // optional for count(*)
  as: z.string(), // alias for result
});

export type Aggregate = z.infer<typeof AggregateSchema>;

// ===== GROUP BY SCHEMA =====

export const GroupBySchema = z.object({
  field: z.string(),
});

export type GroupBy = z.infer<typeof GroupBySchema>;

// ===== SORT SCHEMA =====

export const SortSchema = z.object({
  field: z.string(),
  dir: z.enum(["asc", "desc"]),
});

export type Sort = z.infer<typeof SortSchema>;

// ===== TIMEFRAME SCHEMA =====

export const TimeframeSchema = z.object({
  from: z.string().optional(), // ISO date string
  to: z.string().optional(),   // ISO date string
  lastNDays: z.number().optional(),
});

export type Timeframe = z.infer<typeof TimeframeSchema>;

// ===== COMPARE SCHEMA =====

export const CompareSchema = z.object({
  a: z.object({
    filters: z.array(FilterSchema),
    label: z.string(),
  }),
  b: z.object({
    filters: z.array(FilterSchema),
    label: z.string(),
  }),
  metric: z.object({
    field: z.string(),
    agg: z.enum(["avg", "p50", "p90", "sum", "count"]),
  }),
});

export type Compare = z.infer<typeof CompareSchema>;

// ===== TEMPORAL COHORT SCHEMA =====

export const TemporalWindowSchema = z.object({
  type: z.enum(["trades", "hours", "days"]),
  size: z.number().min(1),
});

export const TemporalCohortSchema = z.object({
  triggerFilters: z.array(FilterSchema),
  window: TemporalWindowSchema,
  direction: z.enum(["after", "before"]),
  metric: z.object({
    field: z.string(),
    agg: z.enum(["avg", "p50", "p90", "sum", "count", "min", "max"]),
  }),
  baseline: z.enum(["all", "non_trigger"]).optional(),
  label: z.string().optional(),
});

export type TemporalCohort = z.infer<typeof TemporalCohortSchema>;

// ===== HIDDEN STATE (CLUSTERING) SCHEMA =====

export const HiddenStateSchema = z.object({
  k: z.number().min(2).max(8).optional(),
  features: z.array(z.string()).optional(),
});

export type HiddenState = z.infer<typeof HiddenStateSchema>;

// ===== PERSONA TRACKING SCHEMA =====

export const PersonaMetricSchema = z.object({
  field: z.string(),
  agg: z.enum(["avg", "p50", "p90", "sum", "count", "min", "max"]),
});

export const PersonaSchema = z.object({
  windowDays: z.number().min(7).max(365).optional(),
  lookbackDays: z.number().min(14).max(730).optional(),
  metrics: z.array(PersonaMetricSchema).optional(),
});

export type Persona = z.infer<typeof PersonaSchema>;

// ===== DERIVED CONCEPT SCHEMA =====

export const DerivedConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  dependsOn: z.array(z.string()), // field keys
});

export type DerivedConcept = z.infer<typeof DerivedConceptSchema>;

// ===== VISUALIZATION SCHEMA =====

/**
 * Visualization types that map to specific UI components
 */
export const VizTypeSchema = z.enum([
  // Single value displays
  "kpi_single",           // Single stat card (e.g., "What's my win rate?")
  "kpi_grid",             // Multiple KPI cards in grid (e.g., "Show my stats")
  
  // Chart types
  "bar_chart",            // Vertical bars (e.g., "Profit by asset")
  "horizontal_bar",       // Horizontal bars (e.g., "Losses by asset")
  "area_chart",           // Area/line chart (e.g., "Performance by weekday")
  "comparison_bar",       // Side-by-side comparison bars
  
  // Table/list displays
  "trade_table",          // Table of trades (e.g., "Show my trades this week")
  "breakdown_table",      // Grouped breakdown table
  
  // Calendar
  "calendar",             // Calendar heatmap (e.g., "Show my trades for January")
  
  // Combined/complex
  "win_rate_card",        // Win rate with mini chart
  "asset_profitability",  // Asset breakdown with horizontal bars
  "trade_counts",         // Trade volume bars
  "losses_breakdown",     // Stacked loss breakdown
  "daily_pnl",            // Daily P&L bar chart
  "weekday_performance",  // Performance by day of week
  
  // Text only (no visual)
  "text_answer",          // Simple text response
]);

export type VizType = z.infer<typeof VizTypeSchema>;

/**
 * Component hint - specific widget to use when available
 */
export const ComponentHintSchema = z.enum([
  // Existing widget types from widgets.tsx
  "account-balance",
  "account-equity",
  "win-streak",
  "profit-factor",
  "win-rate",
  "hold-time",
  "average-rr",
  "asset-profitability",
  "trade-counts",
  "profit-expectancy",
  "total-losses",
  "consistency-score",
  "open-trades",
  
  // Chart widgets from chart-widgets.tsx
  "daily-net",
  "performance-weekday",
  "performing-assets",
  
  // Other components
  "calendar",
  "trade-table",
  "inline-table",
  
  // No specific component - render dynamically
  "auto",
]).default("auto");

export type ComponentHint = z.infer<typeof ComponentHintSchema>;

/**
 * Display mode for results
 */
export const DisplayModeSchema = z.enum([
  "singular",   // Show single top result (e.g., "most profitable asset")
  "plural",     // Show multiple/all results (e.g., "most profitable assets")
  "comparison", // Compare two groups
  "timeline",   // Show over time
]).default("plural");

export type DisplayMode = z.infer<typeof DisplayModeSchema>;

// ===== MAIN QUERY PLAN SCHEMA =====

export const IntentSchema = z.enum([
  "list_trades",     // return list of matching trades
  "aggregate",       // compute aggregation(s)
  "compare",         // compare two cohorts
  "diagnose",        // identify patterns/issues
  "recommendation",  // suggest improvements
]);

export const TradeQueryPlanSchema = z.object({
  // What type of query is this?
  intent: IntentSchema,
  
  // Time window (optional)
  timeframe: TimeframeSchema.optional(),
  
  // Filters to apply
  filters: z.array(FilterSchema).default([]),
  
  // Group by fields (for aggregate intent)
  groupBy: z.array(GroupBySchema).optional(),
  
  // Aggregations to compute (for aggregate intent)
  aggregates: z.array(AggregateSchema).optional(),
  
  // Sorting (for list_trades intent)
  sort: SortSchema.optional(),
  
  // Limit number of results
  limit: z.number().optional(),
  
  // For compare intent
  compare: CompareSchema.optional(),

  // For temporal cohort comparisons
  temporal: TemporalCohortSchema.optional(),

  // For hidden state inference (clustering)
  hiddenState: HiddenStateSchema.optional(),

  // For longitudinal persona tracking
  persona: PersonaSchema.optional(),
  
  // For derived/complex concepts
  derived: z.array(DerivedConceptSchema).optional(),
  
  // Human-readable explanation of what the plan does
  explanation: z.string(),
  
  // ===== VISUALIZATION HINTS =====
  
  // Primary visualization type
  vizType: VizTypeSchema.optional(),
  
  // Specific component to use (if applicable)
  componentHint: ComponentHintSchema.optional(),
  
  // Display mode (singular vs plural)
  displayMode: DisplayModeSchema.optional(),
  
  // Title for the visualization
  vizTitle: z.string().optional(),
});

export type TradeQueryPlan = z.infer<typeof TradeQueryPlanSchema>;

// ===== VALIDATION HELPERS =====

/**
 * Validate a query plan
 */
export function validatePlan(plan: unknown): {
  success: boolean;
  data?: TradeQueryPlan;
  error?: string;
} {
  try {
    const validated = TradeQueryPlanSchema.parse(plan);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: messages.join('; ') };
    }
    return { success: false, error: String(error) };
  }
}

/**
 * Validate plan with field registry
 */
export function validatePlanWithFields(
  plan: TradeQueryPlan,
  fieldMap: Map<string, any>,
  computedMetricKeys?: Set<string>
): {
  success: boolean;
  error?: string;
} {
  const aggregateAliases = new Set(
    (plan.aggregates || []).map((agg) => agg.as)
  );

  const isComputed = (field: string): boolean => {
    return computedMetricKeys?.has(field) ?? false;
  };

  // Validate all field references exist
  const referencedFields = new Set<string>();
  
  // From filters
  for (const filter of plan.filters) {
    referencedFields.add(filter.field);
  }
  
  // From aggregates
  if (plan.aggregates) {
    for (const agg of plan.aggregates) {
      if (agg.field) {
        referencedFields.add(agg.field);
      }
    }
  }
  
  // From groupBy
  if (plan.groupBy) {
    for (const group of plan.groupBy) {
      referencedFields.add(group.field);
    }
  }
  
  // From sort
  if (plan.sort) {
    referencedFields.add(plan.sort.field);
  }
  
  // From compare
  if (plan.compare) {
    referencedFields.add(plan.compare.metric.field);
    for (const filter of [...plan.compare.a.filters, ...plan.compare.b.filters]) {
      referencedFields.add(filter.field);
    }
  }

  // From temporal cohorts
  if (plan.temporal) {
    referencedFields.add(plan.temporal.metric.field);
    for (const filter of plan.temporal.triggerFilters) {
      referencedFields.add(filter.field);
    }
  }

  // From hidden state features
  if (plan.hiddenState?.features) {
    for (const feature of plan.hiddenState.features) {
      referencedFields.add(feature);
    }
  }

  // From persona metrics
  if (plan.persona?.metrics) {
    for (const metric of plan.persona.metrics) {
      referencedFields.add(metric.field);
    }
  }
  
  // Check all fields exist (allow aggregate aliases in sort fields, allow computed metrics)
  const unknownFields = Array.from(referencedFields).filter(
    (field) => !fieldMap.has(field) && !aggregateAliases.has(field) && !isComputed(field)
  );
  
  if (unknownFields.length > 0) {
    return {
      success: false,
      error: `Unknown fields: ${unknownFields.join(', ')}. Use getFieldCatalog() to see available fields.`,
    };
  }
  
  // Validate aggregations are supported for field types (skip computed metrics)
  if (plan.aggregates) {
    for (const agg of plan.aggregates) {
      if (!agg.field) continue;
      
      // Skip validation for computed metrics
      if (isComputed(agg.field)) continue;
      
      const field = fieldMap.get(agg.field);
      if (!field) continue;
      
      if (!field.aggregations?.includes(agg.fn)) {
        return {
          success: false,
          error: `Aggregation ${agg.fn} not supported for field ${agg.field}. Supported: ${field.aggregations?.join(', ') || 'none'}`,
        };
      }
    }
  }

  // Validate compare metric aggregation (skip computed metrics)
  if (plan.compare) {
    const metricField = plan.compare.metric.field;
    if (!isComputed(metricField)) {
      const field = fieldMap.get(metricField);
      if (field && !field.aggregations?.includes(plan.compare.metric.agg)) {
        return {
          success: false,
          error: `Aggregation ${plan.compare.metric.agg} not supported for field ${metricField}. Supported: ${field.aggregations?.join(', ') || 'none'}`,
        };
      }
    }
  }
  
  // Validate filter operations are supported for field types
  for (const filter of plan.filters) {
    // Skip validation for computed metrics (they can't be filtered)
    if (isComputed(filter.field)) continue;
    
    const field = fieldMap.get(filter.field);
    if (!field) continue;
    
    if (!field.filterOps?.includes(filter.op)) {
      return {
        success: false,
        error: `Filter operation ${filter.op} not supported for field ${filter.field}. Supported: ${field.filterOps?.join(', ') || 'none'}`,
      };
    }
  }
  
  return { success: true };
}

// ===== EXAMPLE PLANS =====

export const EXAMPLE_PLANS = {
  // Simple aggregation
  avgCaptureEfficiency: {
    intent: "aggregate",
    filters: [],
    aggregates: [
      { fn: "avg", field: "rrCaptureEfficiency", as: "avg_capture_eff" }
    ],
    explanation: "Compute average RR capture efficiency across all trades."
  } satisfies TradeQueryPlan,
  
  // Compare sessions
  compareNYvs: {
    intent: "compare",
    filters: [],
    compare: {
      a: {
        label: "New York",
        filters: [{ field: "sessionTag", op: "contains", value: "New York" }]
      },
      b: {
        label: "All other sessions",
        filters: [{ field: "sessionTag", op: "neq", value: "New York" }]
      },
      metric: { field: "realisedRR", agg: "avg" }
    },
    explanation: "Compare average realised RR in New York vs other sessions."
  } satisfies TradeQueryPlan,
  
  // Post-exit analysis
  postExitAnalysis: {
    intent: "aggregate",
    filters: [],
    aggregates: [
      { fn: "avg", field: "mpeManipPE_R", as: "avg_post_exit_r" },
      { fn: "avg", field: "rrCaptureEfficiency", as: "avg_capture_eff" }
    ],
    explanation: "Estimate average post-exit continuation and capture efficiency."
  } satisfies TradeQueryPlan,
  
  // Filtered aggregation
  lowEfficiencyTrades: {
    intent: "aggregate",
    filters: [
      { field: "exitEfficiency", op: "lt", value: 10 },
      { field: "realisedRR", op: "lt", value: 1 }
    ],
    aggregates: [
      { fn: "max", field: "profit", as: "max_profit" },
      { fn: "count", as: "trade_count" }
    ],
    explanation: "Find highest profit when exit efficiency < 10% and realised RR < 1R."
  } satisfies TradeQueryPlan,
  
  // Group by analysis
  winRateBySession: {
    intent: "aggregate",
    groupBy: [{ field: "sessionTag" }],
    aggregates: [
      { fn: "count", as: "total_trades" },
    ],
    filters: [
      { field: "outcome", op: "eq", value: "Win" }
    ],
    explanation: "Count winning trades grouped by session."
  } satisfies TradeQueryPlan,
};
