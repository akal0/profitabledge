/**
 * Plan Generator
 *
 * Uses AI to convert natural language queries into structured TradeQueryPlans.
 * This is the ONLY interface between user text and the query system.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import type { TradeQueryPlan } from "./query-plan";
import { validatePlan, validatePlanWithFields } from "./query-plan";
import {
  TRADE_FIELDS,
  FIELD_MAP,
  CONCEPT_SYNONYMS,
  findField,
  COMPUTED_METRICS_MAP,
} from "./trade-fields";
import {
  buildAliasCatalog,
  inferTimeframeFromMessage,
  normalizeUserMessage,
} from "./query-normalization";
import { cache, cacheKeys } from "../cache";
import type { CondensedProfile } from "./engine/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const COMPUTED_METRIC_KEYS = new Set(COMPUTED_METRICS_MAP.keys());

export interface PlanGenerationResult {
  success: boolean;
  plan?: TradeQueryPlan;
  error?: string;
  needsFieldCatalog?: boolean;
}

const PLAN_CACHE_TTL_MS = 60 * 1000;

function buildPlanCacheKey(
  userMessage: string,
  conversationContext?: string[],
  accountId?: string
): string {
  const hash = createHash("sha256")
    .update(userMessage)
    .update("|")
    .update(accountId || "global")
    .update("|")
    .update(JSON.stringify(conversationContext || []))
    .digest("hex");
  return cacheKeys.assistantPlan(hash);
}

/**
 * Generate a plan from natural language
 */
export async function generatePlan(
  userMessage: string,
  conversationContext?: string[],
  accountId?: string,
  traderProfile?: CondensedProfile
): Promise<PlanGenerationResult> {
  const normalizedMessage = normalizeUserMessage(userMessage);
  console.log("[Plan Generator] Generating plan for:", userMessage);
  if (normalizedMessage !== userMessage) {
    console.log("[Plan Generator] Normalized query:", normalizedMessage);
  }

  try {
    const cacheKey = buildPlanCacheKey(
      normalizedMessage,
      conversationContext,
      accountId
    );
    const cachedPlan = cache.get<TradeQueryPlan>(cacheKey);
    if (cachedPlan) {
      console.log("[Plan Generator] Cache hit");
      return { success: true, plan: cachedPlan };
    }
    console.log("[Plan Generator] Cache miss");

    // Check for profile-summary queries (short-circuit)
    if (traderProfile && isProfileQuery(normalizedMessage)) {
      return {
        success: true,
        plan: {
          intent: "recommendation",
          filters: [],
          aggregates: [],
          explanation: "Show trader profile summary with edge and leak conditions",
          vizType: "text_answer",
          componentHint: "auto",
          displayMode: "singular",
          vizTitle: "Your Trading Profile",
          _profileSummary: true,
        } as TradeQueryPlan & { _profileSummary: boolean },
      };
    }

    const compactAttempt = await generatePlanAttempt(
      normalizedMessage,
      conversationContext,
      false,
      traderProfile
    );
    if (compactAttempt.success && compactAttempt.plan) {
      cache.set(cacheKey, compactAttempt.plan, PLAN_CACHE_TTL_MS);
      return compactAttempt;
    }

    if (compactAttempt.needsFieldCatalog) {
      const fullAttempt = await generatePlanAttempt(
        normalizedMessage,
        conversationContext,
        true,
        traderProfile
      );
      if (fullAttempt.success && fullAttempt.plan) {
        cache.set(cacheKey, fullAttempt.plan, PLAN_CACHE_TTL_MS);
        return fullAttempt;
      }
      return {
        success: false,
        error: fullAttempt.error || compactAttempt.error,
        needsFieldCatalog: true,
      };
    }

    return compactAttempt;
  } catch (error) {
    console.error("[Plan Generator] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build the prompt for plan generation
 */
function buildPlanPrompt(userMessage: string, context?: string[]): string {
  const contextStr =
    context && context.length > 0
      ? `\n\nConversation context:\n${context.join("\n")}\n`
      : "";
  return buildPlanPromptWithCatalog(
    userMessage,
    contextStr,
    buildFieldCatalog(true)
  );
}

function buildPlanPromptWithCatalog(
  userMessage: string,
  contextStr: string,
  fieldCatalog: string
): string {
  const conceptMap = Object.entries(CONCEPT_SYNONYMS)
    .map(([phrase, fields]) => `"${phrase}" → ${fields.join(", ")}`)
    .join("\n");
  const aliasCatalog = buildAliasCatalog();
  const catalogSection = fieldCatalog.trim()
    ? `FIELD CATALOG:\n${fieldCatalog}\n\n`
    : "";

  return `You are a trading data query planner. Convert natural language questions into structured TradeQueryPlans.

ALIAS MAP (normalize user language to canonical terms):
${aliasCatalog}

${catalogSection}
CONCEPT SYNONYMS (common phrases → fields):
${conceptMap}

RULES:
1. Always use canonical field keys (e.g., "rrCaptureEfficiency" not "capture efficiency")
2. Choose the correct intent: list_trades, aggregate, compare, diagnose, or recommendation
3. For "compare" queries, create cohorts A and B with appropriate filters
4. For aggregations, choose appropriate functions: avg, sum, min, max, count, p50, p90
5. Validate filter operations match field types (e.g., "contains" only for strings)
6. Include clear explanation of what the plan does
7. For date queries, convert to ISO format (YYYY-MM-DD) in timeframe field
8. ALWAYS include vizType and displayMode for visualization
9. For breakdowns by symbol or asset, default to sum(profit) unless the user explicitly asks for counts
10. Pay attention to SINGULAR vs PLURAL in user query:
   - "most profitable asset" → displayMode: "singular", limit: 1
   - "most profitable assets" → displayMode: "plural", limit: 5-10
   - "all trades this week" → displayMode: "plural"
11. For temporal pre/post questions (e.g., "after a loss, what happens to next 5 trades"), use the temporal field
12. For clustering/hidden state questions, use hiddenState with features and intent "diagnose"
13. For longitudinal persona questions ("how am i trading differently now"), use persona with windowDays/lookbackDays
14. For journal/reflection questions ("what should i focus on", "where am i leaking", "what am i doing well"), prefer intent "recommendation"
15. For risk/prop-survival questions, prefer metrics tied to profit, drawdown, expectancy, consistency, realisedRR, and session/model filters
16. If the query asks about the user's edge/leak/profile as a whole, prefer a concise recommendation-style plan over a raw trade list

VISUALIZATION TYPES (vizType):
- "kpi_single": Single stat card (one number answer)
- "kpi_grid": Multiple stats in a grid
- "bar_chart": Vertical bar chart (good for comparisons, rankings)
- "horizontal_bar": Horizontal bars (good for losses, rankings)
- "area_chart": Area/line chart (good for trends over time)
- "comparison_bar": Side-by-side comparison
- "trade_table": Table of individual trades
- "breakdown_table": Grouped data table
- "calendar": Calendar view of trades (use for date range queries like "this week", "this month")
- "win_rate_card": Win rate with mini visualization
- "asset_profitability": Asset profit breakdown (horizontal bars)
- "trade_counts": Trade volume over time
- "losses_breakdown": Loss breakdown by category
- "daily_pnl": Daily profit/loss bars
- "weekday_performance": Performance by day of week
- "text_answer": Simple text (for explanations, recommendations)

DOMAIN MAPPING:
- Dashboard KPI questions -> aggregate
- Backtesting / compare one setup vs another -> compare
- Journal / reflection / coaching -> recommendation
- Psychology or discipline phrasing -> recommendation unless the user explicitly asks for a grouped breakdown
- "Find patterns", "what changes after X", "what state am I in" -> diagnose

COMPONENT HINTS (componentHint) - Use these when query matches an existing widget:
- "win-rate": For win rate queries
- "profit-factor": For profit factor queries
- "win-streak": For streak queries
- "average-rr": For average R queries
- "hold-time": For hold time queries
- "asset-profitability": For asset profit breakdown
- "trade-counts": For trade volume queries
- "total-losses": For loss breakdown
- "consistency-score": For consistency queries
- "daily-net": For daily P&L
- "performance-weekday": For weekday analysis
- "performing-assets": For asset performance
- "calendar": For calendar/date range views
- "trade-table": For trade lists
- "auto": Let the system decide

DISPLAY MODES:
- "singular": Single top result (use with limit: 1)
- "plural": Multiple results
- "comparison": Two groups compared
- "timeline": Data over time

QUERY PLAN SCHEMA:
{
  "intent": "aggregate" | "compare" | "list_trades" | "diagnose" | "recommendation",
  "filters": [
    { "field": "string", "op": "eq|neq|gt|gte|lt|lte|in|contains", "value": any }
    // or
    { "field": "string", "op": "between", "value": { "from": any, "to": any } }
  ],
  "timeframe": {
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD",
    "lastNDays": number
  },
  "aggregates": [
    { "fn": "avg|sum|min|max|count|p50|p90", "field": "string", "as": "string" }
  ],
  "groupBy": [{ "field": "string" }],
  "sort": { "field": "string", "dir": "asc|desc" },
  "limit": number,
  "compare": {
    "a": { "label": "string", "filters": [...] },
    "b": { "label": "string", "filters": [...] },
    "metric": { "field": "string", "agg": "avg|p50|p90|sum|count" }
  },
  "temporal": {
    "triggerFilters": [{ "field": "string", "op": "...", "value": any }],
    "window": { "type": "trades|hours|days", "size": number },
    "direction": "after|before",
    "metric": { "field": "string", "agg": "avg|p50|p90|sum|count|min|max" },
    "baseline": "all|non_trigger"
  },
  "hiddenState": {
    "k": number,
    "features": ["tradeDurationSeconds", "rrCaptureEfficiency", "mfePips"]
  },
  "persona": {
    "windowDays": number,
    "lookbackDays": number,
    "metrics": [{ "field": "tradeDurationSeconds", "agg": "avg" }]
  },
  "explanation": "What this plan computes",
  "vizType": "one of the visualization types above",
  "componentHint": "specific component or 'auto'",
  "displayMode": "singular|plural|comparison|timeline",
  "vizTitle": "Title for the visualization"
}

EXAMPLES:

Q: "What's my win rate?"
A:
{
  "intent": "aggregate",
  "filters": [],
  "aggregates": [
    { "fn": "count", "as": "total_trades" }
  ],
  "explanation": "Calculate win rate across all trades",
  "vizType": "win_rate_card",
  "componentHint": "win-rate",
  "displayMode": "singular",
  "vizTitle": "Win Rate"
}

Q: "What's my most profitable asset?"
A:
{
  "intent": "aggregate",
  "groupBy": [{ "field": "symbol" }],
  "aggregates": [
    { "fn": "sum", "field": "profit", "as": "total_profit" }
  ],
  "sort": { "field": "total_profit", "dir": "desc" },
  "limit": 1,
  "filters": [],
  "explanation": "Find the single most profitable trading asset",
  "vizType": "kpi_single",
  "componentHint": "auto",
  "displayMode": "singular",
  "vizTitle": "Most Profitable Asset"
}

Q: "What are my most profitable assets?"
A:
{
  "intent": "aggregate",
  "groupBy": [{ "field": "symbol" }],
  "aggregates": [
    { "fn": "sum", "field": "profit", "as": "total_profit" }
  ],
  "sort": { "field": "total_profit", "dir": "desc" },
  "limit": 10,
  "filters": [],
  "explanation": "Rank trading assets by total profit",
  "vizType": "asset_profitability",
  "componentHint": "performing-assets",
  "displayMode": "plural",
  "vizTitle": "Asset Profitability"
}

Q: "Show me all trades this week"
A:
{
  "intent": "list_trades",
  "timeframe": { "lastNDays": 7 },
  "filters": [],
  "explanation": "List all trades from the past 7 days",
  "vizType": "calendar",
  "componentHint": "calendar",
  "displayMode": "timeline",
  "vizTitle": "Trades This Week"
}

Q: "What's my average capture efficiency?"
A:
{
  "intent": "aggregate",
  "filters": [],
  "aggregates": [
    { "fn": "avg", "field": "rrCaptureEfficiency", "as": "avg_capture_eff" }
  ],
  "explanation": "Compute average RR capture efficiency across all trades",
  "vizType": "kpi_single",
  "componentHint": "auto",
  "displayMode": "singular",
  "vizTitle": "Capture Efficiency"
}

Q: "Should I let trades run longer in New York?"
A:
{
  "intent": "compare",
  "filters": [],
  "compare": {
    "a": {
      "label": "New York",
      "filters": [{ "field": "sessionTag", "op": "contains", "value": "New York" }]
    },
    "b": {
      "label": "All other sessions",
      "filters": [{ "field": "sessionTag", "op": "neq", "value": "New York" }]
    },
    "metric": { "field": "realisedRR", "agg": "avg" }
  },
  "explanation": "Compare average realised RR in New York vs other sessions",
  "vizType": "comparison_bar",
  "componentHint": "auto",
  "displayMode": "comparison",
  "vizTitle": "New York vs Other Sessions"
}

Q: "Performance by day of week"
A:
{
  "intent": "aggregate",
  "groupBy": [{ "field": "weekday" }],
  "aggregates": [
    { "fn": "sum", "field": "profit", "as": "total_profit" }
  ],
  "filters": [],
  "explanation": "Calculate total profit grouped by day of week",
  "vizType": "weekday_performance",
  "componentHint": "performance-weekday",
  "displayMode": "plural",
  "vizTitle": "Performance by Weekday"
}

Q: "How much am I losing to commissions?"
A:
{
  "intent": "aggregate",
  "filters": [],
  "aggregates": [
    { "fn": "sum", "field": "commissions", "as": "total_commission" },
    { "fn": "sum", "field": "swap", "as": "total_swap" },
    { "fn": "sum", "field": "profit", "as": "total_loss" }
  ],
  "explanation": "Calculate total commissions and swap fees",
  "vizType": "losses_breakdown",
  "componentHint": "total-losses",
  "displayMode": "plural",
  "vizTitle": "Trading costs breakdown"
}

Q: "Daily P&L this month"
A:
{
  "intent": "aggregate",
  "timeframe": { "lastNDays": 30 },
  "groupBy": [{ "field": "openedAt" }],
  "aggregates": [
    { "fn": "sum", "field": "profit", "as": "daily_profit" }
  ],
  "filters": [],
  "explanation": "Calculate daily profit/loss for the past 30 days",
  "vizType": "daily_pnl",
  "componentHint": "daily-net",
  "displayMode": "timeline",
  "vizTitle": "Daily P&L"
}

Q: "After a loss in New York, what happens to my next 5 trades?"
A:
{
  "intent": "compare",
  "filters": [],
  "temporal": {
    "triggerFilters": [
      { "field": "sessionTag", "op": "contains", "value": "New York" },
      { "field": "profit", "op": "lt", "value": 0 }
    ],
    "window": { "type": "trades", "size": 5 },
    "direction": "after",
    "metric": { "field": "profit", "agg": "avg" },
    "baseline": "all"
  },
  "explanation": "Compare average profit in the 5 trades after a loss in New York versus baseline",
  "vizType": "comparison_bar",
  "componentHint": "auto",
  "displayMode": "comparison",
  "vizTitle": "Post-loss performance"
}

Q: "Find my trading states"
A:
{
  "intent": "diagnose",
  "filters": [],
  "hiddenState": {
    "k": 3,
    "features": ["tradeDurationSeconds", "rrCaptureEfficiency", "mfePips", "rawSTDV"]
  },
  "explanation": "Cluster trades into hidden execution states based on behavior",
  "vizType": "breakdown_table",
  "componentHint": "auto",
  "displayMode": "plural",
  "vizTitle": "Hidden trading states"
}

Q: "How am I trading differently now versus 3 months ago?"
A:
{
  "intent": "diagnose",
  "filters": [],
  "persona": {
    "windowDays": 30,
    "lookbackDays": 90,
    "metrics": [
      { "field": "tradeDurationSeconds", "agg": "avg" },
      { "field": "rrCaptureEfficiency", "agg": "avg" },
      { "field": "profit", "agg": "avg" }
    ]
  },
  "explanation": "Track trading persona changes over the last 90 days",
  "vizType": "breakdown_table",
  "componentHint": "auto",
  "displayMode": "timeline",
  "vizTitle": "Persona tracking"
}
${contextStr}
USER QUERY: "${userMessage}"

Generate the TradeQueryPlan as valid JSON. Respond with ONLY the JSON, no explanation text.`;
}

function buildFieldCatalog(includeDetails: boolean): string {
  if (includeDetails) {
    return TRADE_FIELDS.map((f) => {
      return `- ${f.key}: ${f.label} (${f.type}${
        f.unit ? `, unit: ${f.unit}` : ""
      })
  Description: ${f.description}
  Synonyms: ${f.synonyms.join(", ")}
  Aggregations: ${f.aggregations?.join(", ") || "none"}
  Filters: ${f.filterOps?.join(", ") || "none"}`;
    }).join("\n\n");
  }

  return TRADE_FIELDS.map((f) => {
    const synonyms = f.synonyms.slice(0, 6).join(", ");
    return (
      `- ${f.key} (${f.type}${f.unit ? `, unit: ${f.unit}` : ""})` +
      (synonyms ? ` Synonyms: ${synonyms}` : "")
    );
  }).join("\n");
}

async function generatePlanAttempt(
  userMessage: string,
  conversationContext: string[] | undefined,
  includeFullCatalog: boolean,
  traderProfile?: CondensedProfile
): Promise<PlanGenerationResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const contextStr =
    conversationContext && conversationContext.length > 0
      ? `\n\nConversation context:\n${conversationContext.join("\n")}\n`
      : "";

  const profileContext = traderProfile
    ? buildProfileContext(traderProfile)
    : "";

  const prompt = buildPlanPromptWithCatalog(
    userMessage,
    contextStr + profileContext,
    includeFullCatalog ? buildFieldCatalog(true) : ""
  );

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  console.log("[Plan Generator] AI response:", responseText);

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      success: false,
      error: "AI did not return valid JSON.",
      needsFieldCatalog: !includeFullCatalog,
    };
  }

  let planData: any;
  try {
    planData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    return {
      success: false,
      error: "AI returned invalid JSON.",
      needsFieldCatalog: !includeFullCatalog,
    };
  }

  const zodValidation = validatePlan(planData);
  if (!zodValidation.success) {
    console.error(
      "[Plan Generator] Zod validation failed:",
      zodValidation.error
    );

    if (zodValidation.error) {
      const repaired = await repairPlan(
        userMessage,
        planData,
        zodValidation.error
      );
      if (repaired.success && repaired.plan) {
        return repaired;
      }
    }

    return {
      success: false,
      error: `Invalid plan structure: ${zodValidation.error}`,
    };
  }

  const plan = zodValidation.data!;
  normalizePlanFieldRefs(plan);
  applyTimeframeOverrides(plan, userMessage);
  applyRMultipleFilterOverrides(plan, userMessage);
  adjustSortDirectionFromQuery(plan, userMessage);
  applyMetricComparisonOverrides(plan, userMessage);
  applyAssetProfitabilityFallback(plan, userMessage);
  applyAssetProfitabilityOverrides(plan, userMessage);
  applySymbolBreakdownOverrides(plan, userMessage);
  applyGroupRankingOverrides(plan, userMessage);
  applyGroupedVisualizationOverrides(plan);
  applyWeeklyPerformanceOverrides(plan, userMessage);
  applyHoldTimeOverrides(plan, userMessage);
  applyWeekdayPerformanceOverrides(plan, userMessage);
  detectPeriodComparison(plan, userMessage);

  const fieldValidation = validatePlanWithFields(plan, FIELD_MAP, COMPUTED_METRIC_KEYS);
  if (!fieldValidation.success) {
    console.error(
      "[Plan Generator] Field validation failed:",
      fieldValidation.error
    );
    const rrFallback = buildRRPerformanceFallback(userMessage);
    if (rrFallback) {
      return {
        success: true,
        plan: rrFallback,
      };
    }
    return {
      success: false,
      error: fieldValidation.error,
      needsFieldCatalog: true,
    };
  }

  console.log(
    "[Plan Generator] Plan generated successfully:",
    JSON.stringify(plan, null, 2)
  );

  return {
    success: true,
    plan,
  };
}

/**
 * Attempt to repair an invalid plan
 */
async function repairPlan(
  userMessage: string,
  invalidPlan: any,
  error: string
): Promise<PlanGenerationResult> {
  console.log("[Plan Generator] Attempting to repair plan...");

  try {
    const normalizedMessage = normalizeUserMessage(userMessage);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `The following TradeQueryPlan is invalid. Fix it.

ORIGINAL QUERY: "${normalizedMessage}"

INVALID PLAN:
${JSON.stringify(invalidPlan, null, 2)}

ERROR:
${error}

RULES:
- Use only valid field keys from the field catalog
- Ensure filters array is always present (can be empty)
- Ensure all required fields are present
- Use correct types for all values

Return the CORRECTED plan as valid JSON only, no explanation.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Repair failed: no valid JSON" };
    }

    const repairedData = JSON.parse(jsonMatch[0]);
    const validation = validatePlan(repairedData);

    if (!validation.success) {
      return { success: false, error: `Repair failed: ${validation.error}` };
    }

    normalizePlanFieldRefs(validation.data!);
    applyTimeframeOverrides(validation.data!, normalizedMessage);
    applyRMultipleFilterOverrides(validation.data!, normalizedMessage);
    adjustSortDirectionFromQuery(validation.data!, normalizedMessage);
    applyMetricComparisonOverrides(validation.data!, normalizedMessage);
    applyAssetProfitabilityFallback(validation.data!, normalizedMessage);
    applyAssetProfitabilityOverrides(validation.data!, normalizedMessage);
    applySymbolBreakdownOverrides(validation.data!, normalizedMessage);
    applyGroupRankingOverrides(validation.data!, normalizedMessage);
    applyGroupedVisualizationOverrides(validation.data!);
    applyWeeklyPerformanceOverrides(validation.data!, normalizedMessage);
    applyHoldTimeOverrides(validation.data!, normalizedMessage);
    applyWeekdayPerformanceOverrides(validation.data!, normalizedMessage);
    const fieldValidation = validatePlanWithFields(validation.data!, FIELD_MAP, COMPUTED_METRIC_KEYS);
    if (!fieldValidation.success) {
      const rrFallback = buildRRPerformanceFallback(normalizedMessage);
      if (rrFallback) {
        return {
          success: true,
          plan: rrFallback,
        };
      }
      return {
        success: false,
        error: `Repair failed: ${fieldValidation.error}`,
      };
    }

    console.log("[Plan Generator] Plan repaired successfully");
    return { success: true, plan: validation.data };
  } catch (error) {
    return {
      success: false,
      error: `Repair failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function normalizeFieldKey(field: string): string {
  const trimmed = field.trim();
  if (FIELD_MAP.has(trimmed)) return trimmed;

  const match = findField(trimmed);
  return match ? match.key : trimmed;
}

function normalizePlanFieldRefs(plan: TradeQueryPlan): void {
  const aggregateAliases = new Set(
    (plan.aggregates || []).map((agg) => agg.as)
  );
  plan.filters = plan.filters.map((filter) => ({
    ...filter,
    field: normalizeFieldKey(filter.field),
  }));

  if (plan.aggregates) {
    plan.aggregates = plan.aggregates.map((agg) => ({
      ...agg,
      field: agg.field ? normalizeFieldKey(agg.field) : agg.field,
    }));
  }

  if (plan.groupBy) {
    plan.groupBy = plan.groupBy.map((group) => ({
      ...group,
      field: normalizeFieldKey(group.field),
    }));
  }

  if (plan.sort) {
    const sortField = aggregateAliases.has(plan.sort.field)
      ? plan.sort.field
      : normalizeFieldKey(plan.sort.field);
    plan.sort = {
      ...plan.sort,
      field: sortField,
    };
  }

  if (plan.compare) {
    plan.compare = {
      ...plan.compare,
      metric: {
        ...plan.compare.metric,
        field: normalizeFieldKey(plan.compare.metric.field),
      },
      a: {
        ...plan.compare.a,
        filters: plan.compare.a.filters.map((filter) => ({
          ...filter,
          field: normalizeFieldKey(filter.field),
        })),
      },
      b: {
        ...plan.compare.b,
        filters: plan.compare.b.filters.map((filter) => ({
          ...filter,
          field: normalizeFieldKey(filter.field),
        })),
      },
    };
  }

  if (plan.temporal) {
    plan.temporal = {
      ...plan.temporal,
      metric: {
        ...plan.temporal.metric,
        field: normalizeFieldKey(plan.temporal.metric.field),
      },
      triggerFilters: plan.temporal.triggerFilters.map((filter) => ({
        ...filter,
        field: normalizeFieldKey(filter.field),
      })),
    };
  }

  if (plan.hiddenState?.features) {
    plan.hiddenState = {
      ...plan.hiddenState,
      features: plan.hiddenState.features.map((feature) =>
        normalizeFieldKey(feature)
      ),
    };
  }

  if (plan.persona?.metrics) {
    plan.persona = {
      ...plan.persona,
      metrics: plan.persona.metrics.map((metric) => ({
        ...metric,
        field: normalizeFieldKey(metric.field),
      })),
    };
  }
}

function adjustSortDirectionFromQuery(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const wantsLeast =
    lower.includes("least") ||
    lower.includes("worst") ||
    lower.includes("lowest") ||
    lower.includes("most losing");
  const wantsMost =
    lower.includes("most") || lower.includes("best") || lower.includes("top");

  if (!plan.sort || !plan.sort.field) return;

  const sortField = plan.sort.field.toLowerCase();
  const isProfitSort = sortField.includes("profit");

  if (!isProfitSort) return;

  if (wantsLeast && !wantsMost) {
    plan.sort.dir = "asc";
  } else if (wantsMost && !wantsLeast) {
    plan.sort.dir = "desc";
  }
}

function applyAssetProfitabilityOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const hasSymbolGroup =
    plan.groupBy?.some((group) => group.field === "symbol") ?? false;
  const hasProfitAgg =
    plan.aggregates?.some(
      (agg) => agg.field === "profit" && agg.fn === "sum"
    ) ?? false;

  if (!hasSymbolGroup || !hasProfitAgg) return;

  plan.vizType = "asset_profitability";
  plan.componentHint = "performing-assets";

  const lower = userMessage.toLowerCase();
  const wantsLeast =
    lower.includes("least") ||
    lower.includes("worst") ||
    lower.includes("lowest") ||
    lower.includes("most losing");
  const wantsMost =
    lower.includes("most") || lower.includes("best") || lower.includes("top");
  const isSingular = plan.displayMode === "singular" || plan.limit === 1;

  let prefix = "Most";
  if (wantsLeast && !wantsMost) {
    prefix = "Least";
  } else if (plan.sort?.dir === "asc" && !wantsMost) {
    prefix = "Least";
  }

  if (!plan.sort && plan.aggregates && plan.aggregates.length > 0) {
    plan.sort = {
      field: plan.aggregates[0].as,
      dir: prefix === "Least" ? "asc" : "desc",
    };
  }

  plan.vizTitle = `${prefix} profitable ${isSingular ? "asset" : "assets"}`;
}

function applySymbolBreakdownOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const mentionsBreakdown =
    lower.includes("breakdown") ||
    lower.includes("by symbol") ||
    lower.includes("by asset") ||
    lower.includes("by pair");

  const isSymbolGroup =
    plan.groupBy?.some((group) => group.field === "symbol") ?? false;

  if (!mentionsBreakdown && !isSymbolGroup) return;
  if (plan.intent !== "aggregate") return;

  const wantsCount =
    lower.includes("count") ||
    lower.includes("number of trades") ||
    lower.includes("trade count") ||
    lower.includes("how many trades");

  if (!plan.aggregates || plan.aggregates.length === 0) {
    plan.aggregates = wantsCount
      ? [{ fn: "count", field: "id", as: "trade_count" }]
      : [{ fn: "sum", field: "profit", as: "total_profit" }];
  } else if (!wantsCount) {
    const hasProfitSum = plan.aggregates.some(
      (agg) => agg.fn === "sum" && agg.field === "profit"
    );
    if (!hasProfitSum) {
      plan.aggregates = [{ fn: "sum", field: "profit", as: "total_profit" }];
    }
  }

  if (!plan.groupBy || plan.groupBy.length === 0) {
    plan.groupBy = [{ field: "symbol" }];
  }

  if (!plan.sort && plan.aggregates.length > 0) {
    plan.sort = {
      field: plan.aggregates[0].as,
      dir: wantsCount ? "desc" : "desc",
    };
  }
}

function applyGroupRankingOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  if (!plan.groupBy || plan.groupBy.length === 0) return;
  if (!plan.aggregates || plan.aggregates.length === 0) return;

  const lower = userMessage.toLowerCase();
  const topMatch = lower.match(/top\s+(\d+)/);
  const bottomMatch = lower.match(/bottom\s+(\d+)/);
  const wantsLeast =
    lower.includes("least") ||
    lower.includes("lowest") ||
    lower.includes("worst") ||
    lower.includes("bottom");
  const wantsMost =
    lower.includes("most") ||
    lower.includes("highest") ||
    lower.includes("best") ||
    lower.includes("top");

  const wantsRanking = wantsLeast || wantsMost || topMatch || bottomMatch;
  if (!wantsRanking) return;

  const limitOverride = topMatch
    ? Number(topMatch[1])
    : bottomMatch
    ? Number(bottomMatch[1])
    : null;

  const primaryAgg = plan.aggregates[0];
  const aggregateField = primaryAgg.as || primaryAgg.field || "value";
  const groupField = plan.groupBy[0]?.field;
  const aggregateAliases = new Set(
    plan.aggregates
      .map((agg) => agg.as || agg.field)
      .filter((value): value is string => Boolean(value))
  );
  const mentionsProfit =
    lower.includes("profit") ||
    lower.includes("profitable") ||
    lower.includes("p&l") ||
    lower.includes("pnl");
  const profitAgg = plan.aggregates.find((agg) => agg.field === "profit");
  const rankingField =
    mentionsProfit && profitAgg
      ? profitAgg.as || profitAgg.field || aggregateField
      : aggregateField;

  if (
    !plan.sort ||
    plan.sort.field === groupField ||
    !aggregateAliases.has(plan.sort.field)
  ) {
    plan.sort = {
      field: rankingField,
      dir: wantsLeast && !wantsMost ? "asc" : "desc",
    };
  } else if (mentionsProfit && profitAgg && plan.sort.field !== rankingField) {
    plan.sort = {
      field: rankingField,
      dir: wantsLeast && !wantsMost ? "asc" : "desc",
    };
  } else if (wantsLeast && !wantsMost) {
    plan.sort.dir = "asc";
  } else if (wantsMost && !wantsLeast) {
    plan.sort.dir = "desc";
  }

  if (!plan.limit) {
    if (limitOverride) {
      plan.limit = limitOverride;
    } else if (plan.displayMode === "singular") {
      plan.limit = 1;
    } else if (wantsMost || wantsLeast) {
      plan.limit = 10;
    }
  }

  if (limitOverride) {
    plan.displayMode = limitOverride === 1 ? "singular" : "plural";
  }
}

function applyGroupedVisualizationOverrides(plan: TradeQueryPlan): void {
  if (!plan.groupBy || plan.groupBy.length === 0) return;
  if (!plan.aggregates || plan.aggregates.length === 0) return;

  const groupField = plan.groupBy[0]?.field;
  if (!groupField) return;

  const vizType = plan.vizType;
  const shouldOverrideViz =
    !vizType ||
    vizType === "kpi_single" ||
    vizType === "kpi_grid" ||
    vizType === "text_answer";

  if (!shouldOverrideViz) return;

  if (groupField === "symbol") {
    plan.vizType = "asset_profitability";
    plan.componentHint = "performing-assets";
    return;
  }

  if (groupField === "weekday") {
    plan.vizType = "weekday_performance";
    plan.componentHint = "performance-weekday";
    return;
  }

  if (
    groupField === "open" ||
    groupField === "close" ||
    groupField === "date" ||
    groupField === "openedAt" ||
    groupField === "closedAt"
  ) {
    plan.vizType = "daily_pnl";
    plan.componentHint = "daily-net";
    plan.displayMode = "timeline";
    return;
  }

  if (groupField === "month" || groupField === "year") {
    plan.vizType = "area_chart";
    plan.componentHint = "auto";
    return;
  }

  plan.vizType = "bar_chart";
  plan.componentHint = "auto";
}

function applyWeeklyPerformanceOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const mentionsAssets =
    lower.includes("asset") ||
    lower.includes("assets") ||
    lower.includes("symbol") ||
    lower.includes("pair") ||
    lower.includes("instrument") ||
    lower.includes("ticker");
  const wantsWeekly =
    (lower.includes("this week") || lower.includes("weekly")) &&
    (lower.includes("performance") ||
      lower.includes("p&l") ||
      lower.includes("profit"));

  if (!wantsWeekly || mentionsAssets) return;
  if (plan.intent !== "aggregate") return;

  plan.timeframe = plan.timeframe ?? { lastNDays: 7 };
  plan.groupBy = [{ field: "open" }];
  plan.aggregates = [{ fn: "sum", field: "profit", as: "daily_profit" }];
  plan.vizType = "daily_pnl";
  plan.componentHint = "daily-net";
  plan.displayMode = "timeline";
  plan.vizTitle = "Daily net cumulative P&L";
  plan.explanation = "Calculate daily profit/loss for the past 7 days";
}

function applyAssetProfitabilityFallback(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const mentionsAssets =
    lower.includes("asset") ||
    lower.includes("assets") ||
    lower.includes("symbol") ||
    lower.includes("pair") ||
    lower.includes("instrument") ||
    lower.includes("ticker");
  const wantsProfit = lower.includes("profit") || lower.includes("profitable");
  const wantsRanking =
    lower.includes("most") ||
    lower.includes("least") ||
    lower.includes("best") ||
    lower.includes("worst") ||
    lower.includes("top") ||
    lower.includes("bottom");

  if (!mentionsAssets || !wantsProfit || !wantsRanking) return;

  const wantsLeast =
    lower.includes("least") ||
    lower.includes("worst") ||
    lower.includes("bottom");
  const wantsPlural =
    lower.includes("assets") || lower.includes("top") || lower.includes("best");
  const topMatch = lower.match(/top\s+(\d+)/);
  const bottomMatch = lower.match(/bottom\s+(\d+)/);
  const limitOverride = topMatch
    ? Number(topMatch[1])
    : bottomMatch
    ? Number(bottomMatch[1])
    : null;

  plan.intent = "aggregate";
  plan.filters = (plan.filters ?? []).filter((filter) =>
    FIELD_MAP.has(filter.field)
  );
  plan.groupBy = [{ field: "symbol" }];
  plan.aggregates = [{ fn: "sum", field: "profit", as: "total_profit" }];
  plan.sort = {
    field: "total_profit",
    dir: wantsLeast ? "asc" : "desc",
  };
  plan.displayMode = wantsPlural || limitOverride ? "plural" : "singular";
  plan.limit = limitOverride ?? (wantsPlural ? 10 : 1);
  plan.explanation = wantsPlural
    ? "Rank trading assets by total profit"
    : "Find the single most profitable trading asset";

  const timeframe = inferTimeframeFromMessage(userMessage);
  if (timeframe) {
    plan.timeframe = timeframe;
  }
}

function applyTimeframeOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const timeframe = inferTimeframeFromMessage(userMessage);
  if (!timeframe) return;

  if (!plan.timeframe || !timeframeMatches(plan.timeframe, timeframe)) {
    plan.timeframe = timeframe;
  }
}

function timeframeMatches(
  actual: TradeQueryPlan["timeframe"],
  expected: TradeQueryPlan["timeframe"]
): boolean {
  if (actual.lastNDays || expected.lastNDays) {
    return actual.lastNDays === expected.lastNDays;
  }
  if (actual.from || actual.to || expected.from || expected.to) {
    return actual.from === expected.from && actual.to === expected.to;
  }
  return true;
}

function applyRMultipleFilterOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const match = lower.match(/(\d+(?:\.\d+)?)\s*r\b/);
  if (!match) return;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return;

  const wantsLower =
    /(?:<=|≤|\bunder\b|\bbelow\b|\bless than\b|\bat most\b)/i.test(lower);
  const wantsLowerEq = /(?:<=|≤|\bless than or equal\b|\bat most\b)/i.test(
    lower
  );
  const wantsUpper =
    /(?:>=|≥|\bover\b|\babove\b|\bat least\b|\bgreater than\b|\bmore than\b)/i.test(
      lower
    );

  let op: "gt" | "gte" | "lt" | "lte" = "gte";
  if (wantsLower) {
    op = wantsLowerEq ? "lte" : "lt";
  } else if (wantsUpper) {
    op = "gte";
  }

  const existing = plan.filters.find((filter) => filter.field === "realisedRR");
  if (existing) {
    existing.op = op;
    existing.value = value;
    return;
  }

  plan.filters = plan.filters ?? [];
  plan.filters.push({
    field: "realisedRR",
    op,
    value,
  });
}

function applyMetricComparisonOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const hasCompare =
    lower.includes("compare") ||
    lower.includes(" vs ") ||
    lower.includes(" versus ") ||
    lower.includes("compared to");
  if (!hasCompare) return;

  const fieldCandidates = extractMetricFields(lower);
  if (fieldCandidates.length < 2) return;

  const [fieldA, fieldB] = fieldCandidates;
  if (!fieldA || !fieldB || fieldA === fieldB) return;
  const fieldInfoA = FIELD_MAP.get(fieldA);
  const fieldInfoB = FIELD_MAP.get(fieldB);
  if (fieldInfoA?.type !== "number" || fieldInfoB?.type !== "number") {
    return;
  }

  plan.intent = "aggregate";
  plan.compare = undefined;
  plan.filters = (plan.filters ?? []).filter((filter) =>
    FIELD_MAP.has(filter.field)
  );
  plan.groupBy = [];
  plan.aggregates = [
    { fn: "avg", field: fieldA, as: `avg_${fieldA}` },
    { fn: "avg", field: fieldB, as: `avg_${fieldB}` },
  ];
  plan.vizType = "kpi_grid";
  plan.componentHint = "auto";
  plan.displayMode = "plural";
  plan.vizTitle = `Compare ${formatFieldLabel(fieldA)} vs ${formatFieldLabel(
    fieldB
  )}`;
  plan.explanation = `Compare ${formatFieldLabel(fieldA)} vs ${formatFieldLabel(
    fieldB
  )} across trades`;

  const timeframe = inferTimeframeFromMessage(userMessage);
  if (timeframe) {
    plan.timeframe = timeframe;
  }
}

function extractMetricFields(message: string): string[] {
  const split = message.split(/\s+(?:vs|versus|compared to)\s+/i);
  const candidates: string[] = [];

  for (const part of split) {
    const field = findField(part);
    if (field) {
      candidates.push(field.key);
    }
  }

  if (candidates.length >= 2) return candidates.slice(0, 2);

  const mentioned = TRADE_FIELDS.filter((field) => {
    const labelMatch = message.includes(field.label.toLowerCase());
    const keyMatch = message.includes(field.key.toLowerCase());
    const synonymMatch = field.synonyms.some((syn) =>
      message.includes(syn.toLowerCase())
    );
    return labelMatch || keyMatch || synonymMatch;
  }).map((field) => field.key);

  return mentioned.slice(0, 2);
}

function formatFieldLabel(field: string): string {
  const match = FIELD_MAP.get(field);
  if (match) return match.label;
  const cleaned = field
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return field;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function applyHoldTimeOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const wantsHoldTime =
    lower.includes("hold time") ||
    lower.includes("holding time") ||
    lower.includes("trade duration") ||
    lower.includes("how long do i hold") ||
    lower.includes("average hold time") ||
    lower.includes("average holding time") ||
    lower.includes("average trade duration");

  if (!wantsHoldTime) return;
  if (plan.intent !== "aggregate") return;

  plan.filters = plan.filters ?? [];
  plan.aggregates = [
    {
      fn: "avg",
      field: "tradeDurationSeconds",
      as: "average_hold_time",
    },
  ];
  plan.groupBy = [];
  plan.vizType = "kpi_single";
  plan.componentHint = "hold-time";
  plan.displayMode = "singular";
  plan.vizTitle = "Average hold time";
  plan.explanation = "Calculate average hold time across trades";
}

function applyWeekdayPerformanceOverrides(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  const wantsWeekday =
    lower.includes("day of week") ||
    lower.includes("weekday performance") ||
    lower.includes("performance by weekday") ||
    (lower.includes("weekday") && lower.includes("performance"));

  if (!wantsWeekday) return;
  if (plan.intent !== "aggregate") return;

  plan.filters = plan.filters ?? [];
  plan.groupBy = [{ field: "open" }];
  plan.aggregates = [{ fn: "sum", field: "profit", as: "daily_profit" }];
  plan.vizType = "weekday_performance";
  plan.componentHint = "performance-weekday";
  plan.displayMode = "timeline";
  plan.vizTitle = "Performance by day of week";
  plan.explanation = "Calculate total profit grouped by day of week";
}

function buildRRPerformanceFallback(
  userMessage: string
): TradeQueryPlan | null {
  const lower = userMessage.toLowerCase();
  if (!lower.includes("performance")) return null;

  const rMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*r\b/i);
  if (!rMatch) return null;

  const rValue = Number(rMatch[1]);
  if (!Number.isFinite(rValue)) return null;

  const sessionValue = detectSessionValue(lower);
  const filters = [
    {
      field: "realisedRR",
      op: "gte",
      value: rValue,
    },
  ];

  if (sessionValue) {
    filters.push({
      field: "sessionTag",
      op: "contains",
      value: sessionValue,
    });
  }

  const sessionLabel = sessionValue ? ` in ${sessionValue}` : "";
  const title = `${rValue}R performance${sessionLabel}`;
  const timeframe = inferTimeframeFromMessage(userMessage);

  return {
    intent: "aggregate",
    filters,
    aggregates: [
      { fn: "sum", field: "profit", as: "total_profit" },
      { fn: "avg", field: "profit", as: "average_profit" },
    ],
    groupBy: [],
    sort: undefined,
    limit: undefined,
    compare: undefined,
    timeframe: timeframe ?? undefined,
    explanation: `Calculate total and average profit for trades reaching ${rValue}R${sessionLabel}`,
    vizType: "kpi_grid",
    componentHint: "auto",
    displayMode: "singular",
    vizTitle: title,
  };
}

function detectSessionValue(query: string): string | null {
  if (query.includes("asia")) return "Asia";
  if (query.includes("london")) return "London";
  if (query.includes("new york") || query.includes("ny")) return "New York";
  return null;
}

/**
 * Detect period comparisons like "this week vs last week"
 */
function detectPeriodComparison(
  plan: TradeQueryPlan,
  userMessage: string
): void {
  const lower = userMessage.toLowerCase();
  
  // Check for comparison patterns
  const hasCompare =
    lower.includes(" vs ") ||
    lower.includes(" versus ") ||
    lower.includes(" compared to ");
  if (!hasCompare) return;

  // Period patterns
  const periodPatterns: Array<{
    patterns: string[];
    getRanges: () => { a: { from: string; to: string }; b: { from: string; to: string } };
    labelA: string;
    labelB: string;
  }> = [
    {
      patterns: ["this week vs last week", "this week compared to last week", "this week versus last week"],
      getRanges: () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - dayOfWeek);
        thisWeekStart.setHours(0, 0, 0, 0);
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
        thisWeekEnd.setHours(23, 59, 59, 999);
        
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart);
        lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);
        
        return {
          a: { from: thisWeekStart.toISOString(), to: thisWeekEnd.toISOString() },
          b: { from: lastWeekStart.toISOString(), to: lastWeekEnd.toISOString() },
        };
      },
      labelA: "This week",
      labelB: "Last week",
    },
    {
      patterns: ["this month vs last month", "this month compared to last month", "this month versus last month"],
      getRanges: () => {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        
        return {
          a: { from: thisMonthStart.toISOString(), to: thisMonthEnd.toISOString() },
          b: { from: lastMonthStart.toISOString(), to: lastMonthEnd.toISOString() },
        };
      },
      labelA: "This month",
      labelB: "Last month",
    },
    {
      patterns: ["this year vs last year", "this year compared to last year", "this year versus last year"],
      getRanges: () => {
        const now = new Date();
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        const thisYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        
        return {
          a: { from: thisYearStart.toISOString(), to: thisYearEnd.toISOString() },
          b: { from: lastYearStart.toISOString(), to: lastYearEnd.toISOString() },
        };
      },
      labelA: "This year",
      labelB: "Last year",
    },
    {
      patterns: ["today vs yesterday", "today compared to yesterday", "today versus yesterday"],
      getRanges: () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        
        return {
          a: { from: todayStart.toISOString(), to: todayEnd.toISOString() },
          b: { from: yesterdayStart.toISOString(), to: yesterdayEnd.toISOString() },
        };
      },
      labelA: "Today",
      labelB: "Yesterday",
    },
  ];

  // Find matching pattern
  for (const pattern of periodPatterns) {
    const matches = pattern.patterns.some(p => lower.includes(p));
    if (matches) {
      const ranges = pattern.getRanges();
      
      // Determine metric field from context
      let metricField = "profit";
      let metricAgg: "sum" | "avg" | "count" = "sum";
      
      if (lower.includes("win rate")) {
        metricField = "profit";
        metricAgg = "count";
      } else if (lower.includes("count") || lower.includes("how many")) {
        metricField = "profit";
        metricAgg = "count";
      } else if (lower.includes("average") || lower.includes("avg")) {
        metricAgg = "avg";
      }
      
      plan.intent = "compare";
      plan.compare = {
        a: {
          label: pattern.labelA,
          filters: [
            { field: "open", op: "gte", value: ranges.a.from },
            { field: "open", op: "lte", value: ranges.a.to },
          ],
        },
        b: {
          label: pattern.labelB,
          filters: [
            { field: "open", op: "gte", value: ranges.b.from },
            { field: "open", op: "lte", value: ranges.b.to },
          ],
        },
        metric: { field: metricField, agg: metricAgg },
      };
      plan.groupBy = [];
      plan.aggregates = [];
      plan.vizType = "comparison_bar";
      plan.componentHint = "auto";
      plan.displayMode = "singular";
      plan.vizTitle = `${pattern.labelA} vs ${pattern.labelB}`;
      plan.explanation = `Compare performance between ${pattern.labelA} and ${pattern.labelB}`;
      
      return;
    }
  }
}

/**
 * Get field catalog for AI
 */
export function getFieldCatalog(): string {
  return TRADE_FIELDS.map((f) => {
    const unit = f.unit ? f.unit : "";
    return `${f.key}: ${f.label} - ${f.description} (${f.type}${
      unit ? `, ${unit}` : ""
    })
Synonyms: ${f.synonyms.join(", ")}`;
  }).join("\n\n");
}

export function getFieldCatalogItems(): Array<{
  key: string;
  label: string;
  description: string;
  type: string;
  unit?: string;
  synonyms: string[];
}> {
  return TRADE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    description: field.description,
    type: field.type,
    unit: field.unit,
    synonyms: field.synonyms,
  }));
}

/**
 * Resolve concepts to fields
 */
export function resolveConcepts(query: string): {
  concepts: string[];
  suggestedFields: string[];
} {
  const normalized = query.toLowerCase();
  const concepts: string[] = [];
  const suggestedFields = new Set<string>();

  // Check concept synonyms
  for (const [concept, fields] of Object.entries(CONCEPT_SYNONYMS)) {
    if (normalized.includes(concept.toLowerCase())) {
      concepts.push(concept);
      fields.forEach((f) => suggestedFields.add(f));
    }
  }

  // Check field synonyms
  for (const field of TRADE_FIELDS) {
    for (const synonym of field.synonyms) {
      if (normalized.includes(synonym.toLowerCase())) {
        suggestedFields.add(field.key);
        break;
      }
    }
  }

  return {
    concepts,
    suggestedFields: Array.from(suggestedFields),
  };
}

// ─── Profile Context for AI Prompts ──────────────────────────────

function buildProfileContext(profile: CondensedProfile): string {
  return `

TRADER PROFILE CONTEXT (use this to personalize your response):
- Overall: ${profile.totalTrades} trades, ${profile.winRate.toFixed(1)}% WR, PF ${profile.profitFactor.toFixed(2)}, Expectancy $${profile.expectancy.toFixed(2)}
- Best sessions: ${profile.bestSessions.join(", ") || "N/A"}
- Worst sessions: ${profile.worstSessions.join(", ") || "N/A"}
- Best symbols: ${profile.bestSymbols.join(", ") || "N/A"}
- Worst symbols: ${profile.worstSymbols.join(", ") || "N/A"}
- R:R sweet spot: ${profile.rrSweetSpot}
- Hold time sweet spot: ${profile.holdTimeSweetSpot}
- Top edges: ${profile.topEdges.join(", ") || "None identified yet"}
- Top leaks: ${profile.topLeaks.join(", ") || "None identified yet"}
- Leaving profit on table: ${profile.leavingProfitOnTable ? `Yes (avg ${profile.avgProfitLeftPips.toFixed(1)} pips)` : "No"}
- Current streak: ${profile.currentStreak}
`;
}

function isProfileQuery(message: string): boolean {
  const profilePatterns = [
    /what('?s| is) my edge/i,
    /what('?s| are) my (edges?|leaks?|patterns?)/i,
    /show (me )?my (profile|edge|leak)/i,
    /my trading (profile|summary|overview)/i,
    /where (do i|am i) (losing|leaking)/i,
    /what (am i|do i) do(ing)? (well|wrong|right)/i,
    /strengths? and weaknesses?/i,
    /how am i doing/i,
    /leav(e|ing).*(table|money|profit)/i,
    /money.*(table|leaving|left)/i,
    /exit(ing)? too (early|soon|late)/i,
    /opportunity cost/i,
    /how much.*(miss|left|leave|table)/i,
  ];
  return profilePatterns.some((p) => p.test(message.trim()));
}
