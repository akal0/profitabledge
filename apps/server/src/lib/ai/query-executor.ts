/**
 * Query Executor
 * 
 * Translates validated TradeQueryPlans into safe SQL queries using Drizzle.
 * NO raw SQL from the AI - only structured plans.
 */

import { db } from "../../db";
import { trade } from "../../db/schema/trading";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { TradeQueryPlan, Filter, Aggregate } from "./query-plan";
import { FIELD_MAP, isComputedMetric, getComputedMetric, COMPUTED_METRICS_MAP } from "./trade-fields";
import { DERIVED_FIELDS, isDerivedField } from "./query-executor-derived-fields";
import {
  formatFilters,
  formatTimeframe,
  formatValue,
  generateCaveats,
} from "./query-executor-formatting";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../account-scope";
import {
  buildClusterSummaries,
  buildImprovementsFromTrades,
  buildPersonaRows,
  buildRecommendationsFromTrades,
  computeAggregateFromTrades,
  getNumericValue,
  runKMeans,
  standardize,
  tradeMatchesFilters,
  getTradeTime,
} from "./query-executor-analytics";
import {
  addTimeframeConditions,
  buildAggregationSQL,
  buildTradeSelectShape,
  buildWhereConditions,
} from "./query-executor-sql";

export interface ExecutionContext {
  userId: string;
  accountId: string;
  scopedAccountIds?: string[];
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  meta?: {
    rowCount: number;
    aggregates?: Record<string, number>;
    groups?: Array<Record<string, any>>;
    explanation: string;
    filters: string[];
    timeframe?: string;
    caveats?: string[];
    insights?: string[];
    recommendations?: string[];
    improvements?: Array<{ label: string; value: string; note?: string }>;
  };
  error?: string;
}

/**
 * Pre-query validation for filter values
 * Checks if session tags, model tags, or symbols exist in the user's data
 */
async function validateFilterValues(
  filters: Filter[],
  accountIds: string[]
): Promise<{ valid: boolean; warnings: string[]; suggestions: Record<string, string[]> }> {
  const warnings: string[] = [];
  const suggestions: Record<string, string[]> = {};

  if (accountIds.length === 0) {
    return {
      valid: false,
      warnings: ["No accessible accounts found for this query."],
      suggestions,
    };
  }
  
  // Collect filters that need validation
  const sessionTagFilters = filters.filter(f => f.field === "sessionTag");
  const modelTagFilters = filters.filter(f => f.field === "modelTag");
  const symbolFilters = filters.filter(f => f.field === "symbol");

  // Check session tags
  if (sessionTagFilters.length > 0) {
    const existingTags = await db
      .selectDistinct({ tag: trade.sessionTag })
      .from(trade)
      .where(buildAccountScopeCondition(trade.accountId, accountIds));
    
    const validTags = existingTags.map(t => t.tag).filter(Boolean) as string[];
    suggestions.sessionTag = validTags;
    
    for (const filter of sessionTagFilters) {
      const value = String(filter.value).toLowerCase();
      const found = validTags.some(t => t?.toLowerCase().includes(value));
      if (!found && validTags.length > 0) {
        warnings.push(`No trades found with session tag '${filter.value}'. Your session tags: ${validTags.join(', ')}`);
      } else if (!found && validTags.length === 0) {
        warnings.push(`You haven't tagged any trades with session tags yet.`);
      }
    }
  }

  // Check model tags
  if (modelTagFilters.length > 0) {
    const existingTags = await db
      .selectDistinct({ tag: trade.modelTag })
      .from(trade)
      .where(buildAccountScopeCondition(trade.accountId, accountIds));
    
    const validTags = existingTags.map(t => t.tag).filter(Boolean) as string[];
    suggestions.modelTag = validTags;
    
    for (const filter of modelTagFilters) {
      const value = String(filter.value).toLowerCase();
      const found = validTags.some(t => t?.toLowerCase().includes(value));
      if (!found && validTags.length > 0) {
        warnings.push(`No trades found with model tag '${filter.value}'. Your model tags: ${validTags.join(', ')}`);
      } else if (!found && validTags.length === 0) {
        warnings.push(`You haven't tagged any trades with model tags yet.`);
      }
    }
  }

  // Check symbols
  if (symbolFilters.length > 0) {
    const existingSymbols = await db
      .selectDistinct({ symbol: trade.symbol })
      .from(trade)
      .where(buildAccountScopeCondition(trade.accountId, accountIds));
    
    const validSymbols = existingSymbols.map(s => s.symbol).filter(Boolean) as string[];
    suggestions.symbol = validSymbols;
    
    for (const filter of symbolFilters) {
      const value = String(filter.value).toUpperCase();
      const found = validSymbols.some(s => s?.toUpperCase().includes(value));
      if (!found && validSymbols.length > 0) {
        warnings.push(`No trades found for symbol '${filter.value}'. Your traded symbols: ${validSymbols.join(', ')}`);
      } else if (!found && validSymbols.length === 0) {
        warnings.push(`You don't have any trades recorded yet.`);
      }
    }
  }

  return { 
    valid: warnings.length === 0, 
    warnings, 
    suggestions 
  };
}

/**
 * Main executor - routes to specific handlers based on intent
 */
export async function executePlan(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  try {
    const scopedAccountIds =
      context.scopedAccountIds ??
      (await resolveScopedAccountIds(context.userId, context.accountId));

    if (scopedAccountIds.length === 0) {
      return {
        success: false,
        error: "No accessible accounts found for this query.",
      };
    }

    const scopedContext: ExecutionContext = {
      ...context,
      scopedAccountIds,
    };

    // Pre-validate filter values for better error messages
    const validation = await validateFilterValues(
      plan.filters || [],
      scopedAccountIds
    );
    
    if (plan.temporal) {
      return await executeTemporalCohort(plan, scopedContext);
    }
    if (plan.hiddenState) {
      return await executeHiddenStateInference(plan, scopedContext);
    }
    if (plan.persona) {
      return await executePersonaTracking(plan, scopedContext);
    }

    // If there are warnings, add them to the result meta
    const executeWithWarnings = async (): Promise<ExecutionResult> => {
      switch (plan.intent) {
        case "aggregate":
          return await executeAggregate(plan, scopedContext);
        case "compare":
          return await executeCompare(plan, scopedContext);
        case "list_trades":
          return await executeListTrades(plan, scopedContext);
        case "diagnose":
          return await executeDiagnose(plan, scopedContext);
        case "recommendation":
          return await executeRecommendation(plan, scopedContext);
        default:
          return {
            success: false,
            error: `Unknown intent: ${plan.intent}`,
          };
      }
    };

    const result = await executeWithWarnings();
    
    // Add warnings to meta if any
    if (validation.warnings.length > 0 && result.meta) {
      result.meta.caveats = [...(result.meta.caveats || []), ...validation.warnings];
    }
    
    return result;
  } catch (error) {
    console.error("[Query Executor] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute aggregate query
 */
async function executeAggregate(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const conditions = buildWhereConditions(plan.filters, context.scopedAccountIds || [context.accountId]);
  addTimeframeConditions(conditions, plan.timeframe);

  // Check if any aggregate is a computed metric
  const computedMetricAggs = (plan.aggregates || []).filter(agg => agg.field && isComputedMetric(agg.field));
  const regularAggs = (plan.aggregates || []).filter(agg => agg.field && !isComputedMetric(agg.field));

  if (plan.groupBy && plan.groupBy.length > 0) {
    return await executeGroupedAggregate(plan, context, conditions);
  }

  // Handle computed metrics by fetching all trades
  if (computedMetricAggs.length > 0) {
    const trades = await db
      .select()
      .from(trade)
      .where(and(...conditions));

    const computedResults: Record<string, number | null> = {};
    
    for (const agg of computedMetricAggs) {
      if (!agg.field) continue;
      const metricDef = getComputedMetric(agg.field);
      if (metricDef) {
        computedResults[agg.as] = metricDef.compute(trades);
      }
    }

    // Also compute regular aggregates if any
    const regularResults: Record<string, number | null> = {};
    if (regularAggs.length > 0 || !plan.aggregates || plan.aggregates.length === 0) {
      const selectFields: Record<string, SQL> = {};
      for (const agg of regularAggs) {
        const aggSQL = buildAggregationSQL(agg);
        if (aggSQL) {
          selectFields[agg.as] = aggSQL;
        }
      }
      selectFields.sample_size = sql<number>`count(*)`;
      
      const result = await db
        .select(selectFields)
        .from(trade)
        .where(and(...conditions));

      for (const agg of regularAggs) {
        const value = result[0]?.[agg.as];
        regularResults[agg.as] = Number(value) || 0;
      }
    }

    const allAggregates: Record<string, number | null> = { ...regularResults, ...computedResults };
    const sampleSize = trades.length;

    return {
      success: true,
      data: allAggregates,
      meta: {
        rowCount: sampleSize,
        aggregates: Object.fromEntries(
          Object.entries(allAggregates).filter(([_, v]) => v !== null)
        ) as Record<string, number>,
        explanation: plan.explanation,
        filters: formatFilters(plan.filters),
        timeframe: formatTimeframe(plan.timeframe),
        caveats: generateCaveats(sampleSize),
      },
    };
  }

  // If no aggregates specified, just count
  if (!plan.aggregates || plan.aggregates.length === 0) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(trade)
      .where(and(...conditions));

    return {
      success: true,
      data: { count: result[0]?.count || 0 },
      meta: {
        rowCount: result[0]?.count || 0,
        explanation: plan.explanation,
        filters: formatFilters(plan.filters),
        timeframe: formatTimeframe(plan.timeframe),
      },
    };
  }

  // Build aggregation SQL for regular aggregates
  const selectFields: Record<string, SQL> = {};
  
  for (const agg of plan.aggregates) {
    const aggSQL = buildAggregationSQL(agg);
    if (aggSQL) {
      selectFields[agg.as] = aggSQL;
    }
  }

  // Add count for sample size
  selectFields.sample_size = sql<number>`count(*)`;

  const result = await db
    .select(selectFields)
    .from(trade)
    .where(and(...conditions));

  const row = result[0];
  if (!row) {
    return {
      success: true,
      data: {},
      meta: {
        rowCount: 0,
        explanation: plan.explanation,
        filters: formatFilters(plan.filters),
        caveats: ["No trades found matching criteria"],
      },
    };
  }

  // Keep aggregates numeric for downstream visualizations/analysis
  const rawAggregates: Record<string, any> = {};
  for (const agg of plan.aggregates) {
    const value = row[agg.as];
    const num = Number(value);
    rawAggregates[agg.as] = Number.isNaN(num) ? value : num;
  }

  const rowCount = Number(row.sample_size) || 0;

  return {
    success: true,
    data: rawAggregates,
    meta: {
      rowCount,
      aggregates: rawAggregates,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: generateCaveats(rowCount),
    },
  };
}

/**
 * Execute grouped aggregate query
 */
async function executeGroupedAggregate(
  plan: TradeQueryPlan,
  context: ExecutionContext,
  baseConditions: SQL[]
): Promise<ExecutionResult> {
  if (!plan.groupBy || !plan.aggregates) {
    return { success: false, error: "GroupBy requires aggregates" };
  }

  const computedMetricAggs = plan.aggregates.filter(
    (agg) => agg.field && isComputedMetric(agg.field)
  );
  if (computedMetricAggs.length > 0) {
    return await executeGroupedComputedAggregate(plan, baseConditions);
  }

  // Build select fields
  const selectFields: Record<string, SQL> = {};
  
  // Add group by fields
  for (const group of plan.groupBy) {
    if (isDerivedField(group.field)) {
      const derived = DERIVED_FIELDS[group.field];
      selectFields[group.field] = derived.getSelectSQL();
    } else {
      const column = (trade as any)[group.field];
      if (column) {
        selectFields[group.field] = column;
      }
    }
  }
  
  // Add aggregates
  for (const agg of plan.aggregates) {
    const aggSQL = buildAggregationSQL(agg);
    if (aggSQL) {
      selectFields[agg.as] = aggSQL;
    }
  }

  // Build GROUP BY clause
  const groupByColumns = plan.groupBy
    .map(g => {
      if (isDerivedField(g.field)) {
        return DERIVED_FIELDS[g.field].getSelectSQL();
      }
      return (trade as any)[g.field];
    })
    .filter(Boolean);

  const result = await db
    .select(selectFields)
    .from(trade)
    .where(and(...baseConditions))
    .groupBy(...groupByColumns);

  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trade)
    .where(and(...baseConditions));
  const totalCount = Number(totalCountResult[0]?.count) || 0;

  const fullSortedGroups = applyGroupSortAndLimit(result, {
    ...plan,
    limit: undefined,
  });
  const sortedGroups = applyGroupSortAndLimit(result, plan);

  return {
    success: true,
    data: sortedGroups,
    meta: {
      rowCount: totalCount,
      groups: fullSortedGroups,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
    },
  };
}

async function executeGroupedComputedAggregate(
  plan: TradeQueryPlan,
  baseConditions: SQL[]
): Promise<ExecutionResult> {
  if (!plan.groupBy || !plan.aggregates) {
    return { success: false, error: "GroupBy requires aggregates" };
  }

  const directFieldSet = new Set<string>();

  for (const group of plan.groupBy) {
    if (isDerivedField(group.field)) continue;
    directFieldSet.add(group.field);
  }

  for (const agg of plan.aggregates) {
    if (!agg.field) continue;

    if (isComputedMetric(agg.field)) {
      const metricDef = getComputedMetric(agg.field);
      metricDef?.dependsOn.forEach((field) => directFieldSet.add(field));
      continue;
    }

    directFieldSet.add(agg.field);
  }

  const selectFields: Record<string, SQL | any> = {
    ...buildTradeSelectShape(Array.from(directFieldSet)),
  };

  for (const group of plan.groupBy) {
    if (isDerivedField(group.field)) {
      selectFields[group.field] = DERIVED_FIELDS[group.field].getSelectSQL();
    }
  }

  const rows = (await db
    .select(selectFields)
    .from(trade)
    .where(and(...baseConditions))) as Record<string, any>[];

  const grouped = new Map<
    string,
    {
      groupValues: Record<string, any>;
      trades: Record<string, any>[];
    }
  >();

  for (const row of rows) {
    const groupValues = Object.fromEntries(
      plan.groupBy.map((group) => [
        group.field,
        resolveGroupedFieldValue(row, group.field),
      ])
    );
    const key = JSON.stringify(
      plan.groupBy.map((group) => groupValues[group.field])
    );
    const existing = grouped.get(key);

    if (existing) {
      existing.trades.push(row);
      continue;
    }

    grouped.set(key, {
      groupValues,
      trades: [row],
    });
  }

  const groupedRows = Array.from(grouped.values()).map(
    ({ groupValues, trades }) => {
      const row: Record<string, any> = { ...groupValues };

      for (const agg of plan.aggregates || []) {
        if (!agg.field) continue;

        if (isComputedMetric(agg.field)) {
          const metricDef = getComputedMetric(agg.field);
          row[agg.as] = metricDef ? metricDef.compute(trades) : null;
          continue;
        }

        row[agg.as] = computeAggregateFromTrades(trades, {
          field: agg.field,
          agg: agg.fn,
        });
      }

      return row;
    }
  );

  const fullSortedGroups = applyGroupSortAndLimit(groupedRows, {
    ...plan,
    limit: undefined,
  });
  const sortedGroups = applyGroupSortAndLimit(groupedRows, plan);

  return {
    success: true,
    data: sortedGroups,
    meta: {
      rowCount: rows.length,
      groups: fullSortedGroups,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: generateCaveats(rows.length),
    },
  };
}

function resolveGroupedFieldValue(row: Record<string, any>, field: string): any {
  if (row[field] !== undefined) {
    return row[field];
  }

  const openTime =
    row.openTime instanceof Date
      ? row.openTime
      : row.openTime
      ? new Date(row.openTime)
      : null;

  if (!openTime || Number.isNaN(openTime.getTime())) {
    return "Unknown";
  }

  switch (field) {
    case "weekday":
      return openTime.toLocaleDateString("en-US", { weekday: "long" });
    case "hour":
      return openTime.getUTCHours();
    case "month":
      return openTime.toLocaleDateString("en-US", { month: "long" });
    case "quarter":
      return `Q${Math.floor(openTime.getUTCMonth() / 3) + 1}`;
    case "year":
      return openTime.getUTCFullYear();
    case "timeOfDay": {
      const hour = openTime.getUTCHours();
      if (hour >= 6 && hour <= 11) return "Morning";
      if (hour >= 12 && hour <= 17) return "Afternoon";
      if (hour >= 18 && hour <= 23) return "Evening";
      return "Night";
    }
    default:
      return row[field] ?? "Unknown";
  }
}

function applyGroupSortAndLimit(
  groups: Array<Record<string, any>>,
  plan: TradeQueryPlan
): Array<Record<string, any>> {
  let sorted = [...groups];
  const toNumber = (value: any): number | null => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      if (!cleaned) return null;
      const num = Number(cleaned);
      return Number.isNaN(num) ? null : num;
    }
    return null;
  };

  const weekdayOrder: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  const monthOrder: Record<string, number> = {
    January: 1, February: 2, March: 3, April: 4,
    May: 5, June: 6, July: 7, August: 8,
    September: 9, October: 10, November: 11, December: 12,
  };

  const quarterOrder: Record<string, number> = {
    Q1: 1, Q2: 2, Q3: 3, Q4: 4,
  };

  const timeOfDayOrder: Record<string, number> = {
    Morning: 1, Afternoon: 2, Evening: 3, Night: 4,
  };

  const groupField = plan.groupBy?.[0]?.field;
  const isDateGroup =
    groupField === "open" ||
    groupField === "openedAt" ||
    groupField === "close" ||
    groupField === "closedAt" ||
    groupField === "date";

  const getFieldOrder = (field: string, value: any): number => {
    switch (field) {
      case "weekday": return weekdayOrder[String(value)] ?? 99;
      case "month": return monthOrder[String(value)] ?? 99;
      case "quarter": return quarterOrder[String(value)] ?? 99;
      case "timeOfDay": return timeOfDayOrder[String(value)] ?? 99;
      case "hour":
      case "year": return toNumber(value) ?? 99;
      default: return 99;
    }
  };

  const isOrderedEnum = (field: string): boolean => {
    return ["weekday", "month", "quarter", "timeOfDay", "hour", "year"].includes(field);
  };

  if (plan.sort) {
    const { field, dir } = plan.sort;
    sorted.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (isOrderedEnum(field)) {
        const aOrder = getFieldOrder(field, aVal);
        const bOrder = getFieldOrder(field, bVal);
        return dir === "asc" ? aOrder - bOrder : bOrder - aOrder;
      }

      const aNum = toNumber(aVal);
      const bNum = toNumber(bVal);
      if (aNum !== null && bNum !== null) {
        return dir === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aStr = aVal === undefined || aVal === null ? "" : String(aVal);
      const bStr = bVal === undefined || bVal === null ? "" : String(bVal);
      return dir === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  } else if (groupField) {
    if (isOrderedEnum(groupField)) {
      sorted.sort((a, b) => {
        const aOrder = getFieldOrder(groupField, a[groupField]);
        const bOrder = getFieldOrder(groupField, b[groupField]);
        return aOrder - bOrder;
      });
    } else if (isDateGroup) {
      sorted.sort((a, b) => {
        const aTime = Date.parse(String(a[groupField] ?? ""));
        const bTime = Date.parse(String(b[groupField] ?? ""));
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return aTime - bTime;
      });
    }
  }

  if (plan.limit) {
    sorted = sorted.slice(0, plan.limit);
  }

  return sorted;
}

/**
 * Execute compare query (A vs B cohorts)
 */
async function executeCompare(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!plan.compare) {
    return { success: false, error: "Compare intent requires compare config" };
  }

  const { a, b, metric } = plan.compare;

  // Execute for cohort A
  const conditionsA = buildWhereConditions(
    [...plan.filters, ...a.filters],
    context.scopedAccountIds || [context.accountId]
  );
  addTimeframeConditions(conditionsA, plan.timeframe);

  // Execute for cohort B
  const conditionsB = buildWhereConditions(
    [...plan.filters, ...b.filters],
    context.scopedAccountIds || [context.accountId]
  );
  addTimeframeConditions(conditionsB, plan.timeframe);

  let valueA = 0;
  let valueB = 0;
  let countA = 0;
  let countB = 0;

  if (isComputedMetric(metric.field)) {
    const metricDef = getComputedMetric(metric.field);
    if (!metricDef) {
      return { success: false, error: "Invalid aggregation" };
    }

    const selectFields = buildTradeSelectShape(metricDef.dependsOn);
    const [rowsA, rowsB] = await Promise.all([
      db.select(selectFields).from(trade).where(and(...conditionsA)),
      db.select(selectFields).from(trade).where(and(...conditionsB)),
    ]);

    countA = rowsA.length;
    countB = rowsB.length;
    valueA = Number(metricDef.compute(rowsA) || 0);
    valueB = Number(metricDef.compute(rowsB) || 0);
  } else {
    const aggSQL = buildAggregationSQL({
      fn: metric.agg,
      field: metric.field,
      as: "value",
    });

    if (!aggSQL) {
      return { success: false, error: "Invalid aggregation" };
    }

    const [resultA, resultB] = await Promise.all([
      db
        .select({
          value: aggSQL,
          count: sql<number>`count(*)`,
        })
        .from(trade)
        .where(and(...conditionsA)),
      db
        .select({
          value: aggSQL,
          count: sql<number>`count(*)`,
        })
        .from(trade)
        .where(and(...conditionsB)),
    ]);

    valueA = Number(resultA[0]?.value) || 0;
    valueB = Number(resultB[0]?.value) || 0;
    countA = Number(resultA[0]?.count) || 0;
    countB = Number(resultB[0]?.count) || 0;
  }

  const field = FIELD_MAP.get(metric.field);
  const delta = valueA - valueB;
  const deltaPercent = valueB !== 0 ? ((delta / valueB) * 100) : 0;

  return {
    success: true,
    data: {
      a: { label: a.label, value: formatValue(valueA, field), count: countA },
      b: { label: b.label, value: formatValue(valueB, field), count: countB },
      delta: formatValue(delta, field),
      deltaPercent: `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`,
    },
    meta: {
      rowCount: countA + countB,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: [
        ...generateCaveats(countA, `cohort ${a.label}`),
        ...generateCaveats(countB, `cohort ${b.label}`),
      ],
    },
  };
}

/**
 * Execute list trades query
 */
async function executeListTrades(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const conditions = buildWhereConditions(plan.filters, context.scopedAccountIds || [context.accountId]);
  addTimeframeConditions(conditions, plan.timeframe);

  let query = db.select().from(trade).where(and(...conditions));

  // Add sorting
  if (plan.sort) {
    const column = (trade as any)[plan.sort.field];
    if (column) {
      query = query.orderBy(
        plan.sort.dir === "desc" ? sql`${column} DESC` : sql`${column} ASC`
      ) as any;
    }
  }

  // Add limit
  if (plan.limit) {
    query = query.limit(plan.limit) as any;
  }

  const trades = await query;

  return {
    success: true,
    data: trades,
    meta: {
      rowCount: trades.length,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
    },
  };
}

/**
 * Execute diagnose query
 */
async function executeDiagnose(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  // For now, diagnose uses aggregate logic
  // In future, could add pattern detection, outlier analysis, etc.
  return executeAggregate(plan, context);
}

/**
 * Execute recommendation query
 */
async function executeRecommendation(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (plan.compare) {
    return executeCompare(plan, context);
  }

  const conditions = buildWhereConditions(plan.filters, context.scopedAccountIds || [context.accountId]);
  addTimeframeConditions(conditions, plan.timeframe);

  const fields = [
    "profit",
    "tradeDurationSeconds",
    "sessionTag",
    "modelTag",
    "protocolAlignment",
    "outcome",
    "plannedRR",
    "realisedRR",
    "maxRR",
    "rrCaptureEfficiency",
    "manipRREfficiency",
    "exitEfficiency",
    "mpeManipPE_R",
    "stdvBucket",
    "tradeType",
    "symbol",
    "commissions",
    "swap",
    "open",
  ];
  const recommendationSelect = buildTradeSelectShape(fields);

  const trades = await db
    .select(recommendationSelect)
    .from(trade)
    .where(and(...conditions));

  const { insights, recommendations } = buildRecommendationsFromTrades(trades);
  const improvements = buildImprovementsFromTrades(trades);

  return {
    success: true,
    data: {
      insights,
      recommendations,
      improvements,
    },
    meta: {
      rowCount: trades.length,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: generateCaveats(trades.length),
      insights,
      recommendations,
      improvements,
    },
  };
}

/**
 * Execute temporal cohort comparison
 */
async function executeTemporalCohort(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const temporal = plan.temporal!;
  const conditions = buildWhereConditions(plan.filters, context.scopedAccountIds || [context.accountId]);
  addTimeframeConditions(conditions, plan.timeframe);

  const temporalFields = new Set<string>();
  temporal.triggerFilters.forEach((filter) => temporalFields.add(filter.field));
  temporalFields.add(temporal.metric.field);

  const temporalSelect = buildTradeSelectShape(Array.from(temporalFields));

  const trades = await db
    .select(temporalSelect)
    .from(trade)
    .where(and(...conditions))
    .orderBy(asc(trade.open));

  const triggerTrades = trades.filter((t) =>
    tradeMatchesFilters(t, temporal.triggerFilters)
  );

  const indexById = new Map<string, number>();
  trades.forEach((t, idx) => {
    if (t.id) indexById.set(t.id, idx);
  });

  const cohortTradeIds = new Set<string>();

  const windowMs =
    temporal.window.type === "hours"
      ? temporal.window.size * 60 * 60 * 1000
      : temporal.window.type === "days"
      ? temporal.window.size * 24 * 60 * 60 * 1000
      : 0;

  for (const trigger of triggerTrades) {
    const triggerIndex = trigger.id ? indexById.get(trigger.id) ?? -1 : -1;
    if (temporal.window.type === "trades") {
      if (triggerIndex < 0) continue;
      const start =
        temporal.direction === "after"
          ? triggerIndex + 1
          : Math.max(0, triggerIndex - temporal.window.size);
      const end =
        temporal.direction === "after"
          ? Math.min(trades.length - 1, triggerIndex + temporal.window.size)
          : triggerIndex - 1;
      for (let i = start; i <= end; i += 1) {
        const tradeId = trades[i]?.id;
        if (tradeId) cohortTradeIds.add(tradeId);
      }
    } else {
      const triggerTime = getTradeTime(trigger);
      if (!triggerTime) continue;
      const windowStart =
        temporal.direction === "after"
          ? triggerTime
          : triggerTime - windowMs;
      const windowEnd =
        temporal.direction === "after"
          ? triggerTime + windowMs
          : triggerTime;
      for (const t of trades) {
        const time = getTradeTime(t);
        if (!time) continue;
        if (time <= windowStart || time > windowEnd) continue;
        if (t.id) cohortTradeIds.add(t.id);
      }
    }
  }

  const cohortTrades = trades.filter((t) => t.id && cohortTradeIds.has(t.id));
  const baselineTrades =
    temporal.baseline === "non_trigger"
      ? trades.filter((t) => !triggerTrades.includes(t))
      : trades;

  const cohortValue = computeAggregateFromTrades(
    cohortTrades,
    temporal.metric
  );
  const baselineValue = computeAggregateFromTrades(
    baselineTrades,
    temporal.metric
  );

  const delta =
    baselineValue === null || cohortValue === null
      ? 0
      : cohortValue - baselineValue;
  const deltaPercent =
    baselineValue && baselineValue !== 0
      ? (delta / baselineValue) * 100
      : 0;

  const cohortLabel =
    temporal.label ||
    `${temporal.direction === "after" ? "After" : "Before"} trigger`;
  const baselineLabel =
    temporal.baseline === "non_trigger" ? "Non-trigger trades" : "Baseline";

  return {
    success: true,
    data: {
      a: {
        label: cohortLabel,
        value: cohortValue ?? 0,
        count: cohortTrades.length,
      },
      b: {
        label: baselineLabel,
        value: baselineValue ?? 0,
        count: baselineTrades.length,
      },
      delta,
      deltaPercent: `${deltaPercent.toFixed(1)}%`,
    },
    meta: {
      rowCount: trades.length,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: [
        ...generateCaveats(cohortTrades.length, "cohort"),
        ...generateCaveats(baselineTrades.length, "baseline"),
      ],
    },
  };
}

/**
 * Execute hidden state inference (clustering)
 */
async function executeHiddenStateInference(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const conditions = buildWhereConditions(plan.filters, context.scopedAccountIds || [context.accountId]);
  addTimeframeConditions(conditions, plan.timeframe);

  const features =
    plan.hiddenState?.features && plan.hiddenState.features.length > 0
      ? plan.hiddenState.features
      : [
          "tradeDurationSeconds",
          "rrCaptureEfficiency",
          "mfePips",
          "rawSTDV",
          "realisedRR",
        ];

  const labelFields = [
    "tradeDurationSeconds",
    "rrCaptureEfficiency",
    "mfePips",
    "rawSTDV",
    "realisedRR",
  ];
  const featureFields = Array.from(new Set([...features, ...labelFields]));
  const hiddenSelect = buildTradeSelectShape(featureFields);

  const trades = await db
    .select(hiddenSelect)
    .from(trade)
    .where(and(...conditions))
    .orderBy(asc(trade.open));

  const points: number[][] = [];
  const pointTrades: typeof trades = [];

  for (const t of trades) {
    const vector: number[] = [];
    let valid = true;
    for (const feature of features) {
      const value = getNumericValue(t, feature);
      if (value === null || Number.isNaN(value)) {
        valid = false;
        break;
      }
      vector.push(value);
    }
    if (!valid) continue;
    points.push(vector);
    pointTrades.push(t);
  }

  if (points.length < 5) {
    return {
      success: true,
      data: [],
      meta: {
        rowCount: points.length,
        explanation: plan.explanation,
        filters: formatFilters(plan.filters),
        timeframe: formatTimeframe(plan.timeframe),
        caveats: generateCaveats(points.length),
      },
    };
  }

  const k =
    plan.hiddenState?.k && plan.hiddenState.k > 0
      ? Math.min(plan.hiddenState.k, points.length)
      : Math.min(3, points.length);

  const standardized = standardize(points);
  const { assignments } = runKMeans(standardized, k);

  const clusters = buildClusterSummaries(pointTrades, assignments);

  return {
    success: true,
    data: clusters,
    meta: {
      rowCount: points.length,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: generateCaveats(points.length),
    },
  };
}

/**
 * Execute persona tracking (longitudinal aggregates)
 */
async function executePersonaTracking(
  plan: TradeQueryPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const conditions = buildWhereConditions(plan.filters, context.scopedAccountIds || [context.accountId]);
  addTimeframeConditions(conditions, plan.timeframe);

  const persona = plan.persona || {};
  const windowDays = persona.windowDays ?? 30;
  const effectiveLookback =
    persona.lookbackDays ??
    plan.timeframe?.lastNDays ??
    90;
  const endTime = plan.timeframe?.to
    ? new Date(plan.timeframe.to).getTime()
    : Date.now();
  const startTime = plan.timeframe?.from
    ? new Date(plan.timeframe.from).getTime()
    : endTime - effectiveLookback * 24 * 60 * 60 * 1000;

  const metrics =
    persona.metrics && persona.metrics.length > 0
      ? persona.metrics
      : [
          { field: "tradeDurationSeconds", agg: "avg" as const },
          { field: "rrCaptureEfficiency", agg: "avg" as const },
          { field: "realisedRR", agg: "avg" as const },
          { field: "profit", agg: "avg" as const },
        ];

  const personaFields = metrics.map((metric) => metric.field);
  const personaSelect = buildTradeSelectShape(personaFields);

  const trades = await db
    .select(personaSelect)
    .from(trade)
    .where(and(...conditions))
    .orderBy(asc(trade.open));

  const rows = buildPersonaRows(
    trades,
    metrics,
    windowDays,
    startTime,
    endTime
  );

  return {
    success: true,
    data: rows,
    meta: {
      rowCount: trades.length,
      explanation: plan.explanation,
      filters: formatFilters(plan.filters),
      timeframe: formatTimeframe(plan.timeframe),
      caveats: generateCaveats(trades.length),
    },
  };
}
