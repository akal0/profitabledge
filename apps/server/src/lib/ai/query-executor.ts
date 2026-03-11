/**
 * Query Executor
 * 
 * Translates validated TradeQueryPlans into safe SQL queries using Drizzle.
 * NO raw SQL from the AI - only structured plans.
 */

import { db } from "../../db";
import { trade } from "../../db/schema/trading";
import { eq, and, or, gte, lte, gt, lt, ne, inArray, like, ilike, between, sql, SQL, asc } from "drizzle-orm";
import type { TradeQueryPlan, Filter, Aggregate } from "./query-plan";
import { FIELD_MAP, type TradeField, isComputedMetric, getComputedMetric, COMPUTED_METRICS_MAP } from "./trade-fields";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../account-scope";

const DERIVED_FIELDS: Record<string, {
  getSelectSQL: () => SQL;
  getFilterSQL: (op: string, value: any) => SQL | null;
}> = {
  weekday: {
    getSelectSQL: () => sql<string>`TRIM(TRAILING 'day' FROM TO_CHAR(${trade.openTime}, 'Day'))`,
    getFilterSQL: (op: string, value: any) => {
      const dayMap: Record<string, number> = {
        sunday: 0, sun: 0,
        monday: 1, mon: 1,
        tuesday: 2, tue: 2, tues: 2,
        wednesday: 3, wed: 3,
        thursday: 4, thu: 4, thurs: 4,
        friday: 5, fri: 5,
        saturday: 6, sat: 6,
      };
      const dayNum = dayMap[String(value).toLowerCase()];
      if (dayNum === undefined) return null;
      if (op === "eq") return sql`EXTRACT(DOW FROM ${trade.openTime}) = ${dayNum}`;
      if (op === "in") {
        const values = Array.isArray(value) ? value : [value];
        const dayNums = values.map(v => dayMap[String(v).toLowerCase()]).filter(n => n !== undefined);
        if (dayNums.length === 0) return null;
        return sql`EXTRACT(DOW FROM ${trade.openTime}) IN (${sql.raw(dayNums.join(','))})`;
      }
      return null;
    },
  },
  hour: {
    getSelectSQL: () => sql<number>`EXTRACT(HOUR FROM ${trade.openTime})`,
    getFilterSQL: (op: string, value: any) => {
      const hour = Number(value);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
      if (op === "eq") return sql`EXTRACT(HOUR FROM ${trade.openTime}) = ${hour}`;
      if (op === "in") {
        const hours = (Array.isArray(value) ? value : [value]).map(Number).filter(h => Number.isFinite(h) && h >= 0 && h <= 23);
        if (hours.length === 0) return null;
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) IN (${sql.raw(hours.join(','))})`;
      }
      if (op === "gte") return sql`EXTRACT(HOUR FROM ${trade.openTime}) >= ${hour}`;
      if (op === "gt") return sql`EXTRACT(HOUR FROM ${trade.openTime}) > ${hour}`;
      if (op === "lte") return sql`EXTRACT(HOUR FROM ${trade.openTime}) <= ${hour}`;
      if (op === "lt") return sql`EXTRACT(HOUR FROM ${trade.openTime}) < ${hour}`;
      if (op === "between") {
        const { from, to } = value;
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${Number(from)} AND ${Number(to)}`;
      }
      return null;
    },
  },
  month: {
    getSelectSQL: () => sql<string>`TRIM(TRAILING FROM TO_CHAR(${trade.openTime}, 'Month'))`,
    getFilterSQL: (op: string, value: any) => {
      const monthMap: Record<string, number> = {
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9, sept: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12,
      };
      const monthNum = monthMap[String(value).toLowerCase()];
      if (monthNum === undefined) return null;
      if (op === "eq") return sql`EXTRACT(MONTH FROM ${trade.openTime}) = ${monthNum}`;
      if (op === "in") {
        const values = Array.isArray(value) ? value : [value];
        const monthNums = values.map(v => monthMap[String(v).toLowerCase()]).filter(n => n !== undefined);
        if (monthNums.length === 0) return null;
        return sql`EXTRACT(MONTH FROM ${trade.openTime}) IN (${sql.raw(monthNums.join(','))})`;
      }
      return null;
    },
  },
  quarter: {
    getSelectSQL: () => sql<string>`'Q' || EXTRACT(QUARTER FROM ${trade.openTime})`,
    getFilterSQL: (op: string, value: any) => {
      const quarterNum = Number(String(value).replace(/[^0-9]/g, ''));
      if (quarterNum < 1 || quarterNum > 4) return null;
      if (op === "eq") return sql`EXTRACT(QUARTER FROM ${trade.openTime}) = ${quarterNum}`;
      if (op === "in") {
        const quarters = (Array.isArray(value) ? value : [value])
          .map(v => Number(String(v).replace(/[^0-9]/g, '')))
          .filter(q => q >= 1 && q <= 4);
        if (quarters.length === 0) return null;
        return sql`EXTRACT(QUARTER FROM ${trade.openTime}) IN (${sql.raw(quarters.join(','))})`;
      }
      return null;
    },
  },
  year: {
    getSelectSQL: () => sql<number>`EXTRACT(YEAR FROM ${trade.openTime})`,
    getFilterSQL: (op: string, value: any) => {
      const year = Number(value);
      if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
      if (op === "eq") return sql`EXTRACT(YEAR FROM ${trade.openTime}) = ${year}`;
      if (op === "in") {
        const years = (Array.isArray(value) ? value : [value])
          .map(Number)
          .filter(y => Number.isFinite(y) && y >= 2000 && y <= 2100);
        if (years.length === 0) return null;
        return sql`EXTRACT(YEAR FROM ${trade.openTime}) IN (${sql.raw(years.join(','))})`;
      }
      if (op === "gte") return sql`EXTRACT(YEAR FROM ${trade.openTime}) >= ${year}`;
      if (op === "gt") return sql`EXTRACT(YEAR FROM ${trade.openTime}) > ${year}`;
      if (op === "lte") return sql`EXTRACT(YEAR FROM ${trade.openTime}) <= ${year}`;
      if (op === "lt") return sql`EXTRACT(YEAR FROM ${trade.openTime}) < ${year}`;
      return null;
    },
  },
  timeOfDay: {
    getSelectSQL: () => sql<string>`CASE 
      WHEN EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN 6 AND 11 THEN 'Morning'
      WHEN EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN 12 AND 17 THEN 'Afternoon'
      WHEN EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN 18 AND 23 THEN 'Evening'
      ELSE 'Night'
    END`,
    getFilterSQL: (op: string, value: any) => {
      const periodMap: Record<string, [number, number]> = {
        morning: [6, 11],
        afternoon: [12, 17],
        evening: [18, 23],
        night: [0, 5],
      };
      const period = periodMap[String(value).toLowerCase()];
      if (!period) return null;
      const [start, end] = period;
      if (op === "eq") {
        if (start === 0) {
          return sql`(EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${start} AND ${end})`;
        }
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${start} AND ${end}`;
      }
      if (op === "in") {
        const periods = (Array.isArray(value) ? value : [value])
          .map(v => periodMap[String(v).toLowerCase()])
          .filter(Boolean);
        if (periods.length === 0) return null;
        const conditions = periods.map(([s, e]) => 
          s === 0 
            ? sql`(EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${s} AND ${e})`
            : sql`EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${s} AND ${e}`
        );
        return sql`(${sql.join(conditions, sql` OR `)})`;
      }
      return null;
    },
  },
};

function getTimestampColumn(fieldName: string): any | null {
  switch (fieldName) {
    case "open":
      return trade.openTime;
    case "close":
      return trade.closeTime;
    default:
      return null;
  }
}

function getTimeframeTimestampSQL(): SQL {
  // Prefer realized trade timing. Fall back to open time, then creation time.
  return sql`COALESCE(${trade.closeTime}, ${trade.openTime}, ${trade.createdAt})`;
}

function normalizeFilterValue(fieldName: string, value: any): any {
  if ((fieldName === "open" || fieldName === "close") && value != null) {
    return new Date(value);
  }
  return value;
}

function isDerivedField(fieldName: string): boolean {
  return fieldName in DERIVED_FIELDS;
}

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
  console.log("[Query Executor] Executing plan:", JSON.stringify(plan, null, 2));

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
 * Build WHERE conditions from filters
 */
function buildWhereConditions(
  filters: Filter[],
  accountIds: string[]
): SQL[] {
  const conditions: SQL[] = [
    buildAccountScopeCondition(trade.accountId, accountIds),
  ];

  for (const filter of filters) {
    const field = FIELD_MAP.get(filter.field);
    if (!field) {
      console.warn(`[Query Executor] Unknown field in filter: ${filter.field}`);
      continue;
    }

    if (isDerivedField(filter.field)) {
      const derived = DERIVED_FIELDS[filter.field];
      const filterSQL = derived.getFilterSQL(filter.op, filter.value);
      if (filterSQL) {
        conditions.push(filterSQL);
      } else {
        console.warn(`[Query Executor] Cannot filter derived field ${filter.field} with op ${filter.op}`);
      }
      continue;
    }

    const column = getTimestampColumn(filter.field) ?? (trade as any)[filter.field];
    if (!column) {
      console.warn(`[Query Executor] Column not found in schema: ${filter.field}`);
      continue;
    }

    switch (filter.op) {
      case "eq":
        if (filter.field === "symbol") {
          const value = normalizeSymbolValue(filter.value);
          conditions.push(ilike(column, `%${value}%`));
        } else {
          conditions.push(eq(column, normalizeFilterValue(filter.field, filter.value)));
        }
        break;
      case "neq":
        conditions.push(ne(column, normalizeFilterValue(filter.field, filter.value)));
        break;
      case "gt":
        conditions.push(gt(column, normalizeFilterValue(filter.field, filter.value)));
        break;
      case "gte":
        conditions.push(gte(column, normalizeFilterValue(filter.field, filter.value)));
        break;
      case "lt":
        conditions.push(lt(column, normalizeFilterValue(filter.field, filter.value)));
        break;
      case "lte":
        conditions.push(lte(column, normalizeFilterValue(filter.field, filter.value)));
        break;
      case "in":
        if (filter.field === "symbol") {
          const values = Array.isArray(filter.value)
            ? filter.value
            : [filter.value];
          const matches = values
            .map((value) => normalizeSymbolValue(value))
            .filter((value) => value.length > 0)
            .map((value) => ilike(column, `%${value}%`));
          if (matches.length === 1) {
            conditions.push(matches[0]);
          } else if (matches.length > 1) {
            const combined = or(...matches);
            if (combined) conditions.push(combined);
          }
        } else {
          conditions.push(
            inArray(column, Array.isArray(filter.value) ? filter.value : [filter.value])
          );
        }
        break;
      case "contains":
        if (filter.field === "symbol") {
          const value = normalizeSymbolValue(filter.value);
          conditions.push(ilike(column, `%${value}%`));
        } else {
          conditions.push(ilike(column, `%${filter.value}%`));
        }
        break;
      case "between":
        if (filter.op === "between" && "from" in filter.value && "to" in filter.value) {
          conditions.push(
            between(
              column,
              normalizeFilterValue(filter.field, filter.value.from),
              normalizeFilterValue(filter.field, filter.value.to)
            )
          );
        }
        break;
    }
  }

  return conditions;
}

/**
 * Add timeframe conditions
 */
function addTimeframeConditions(
  conditions: SQL[],
  timeframe?: TradeQueryPlan["timeframe"]
): void {
  if (!timeframe) return;
  const timestampSQL = getTimeframeTimestampSQL();

  if (timeframe.from) {
    conditions.push(sql`${timestampSQL} >= ${new Date(timeframe.from)}`);
  }
  if (timeframe.to) {
    conditions.push(sql`${timestampSQL} <= ${new Date(timeframe.to)}`);
  }
  if (timeframe.lastNDays) {
    const date = new Date();
    date.setDate(date.getDate() - timeframe.lastNDays);
    conditions.push(sql`${timestampSQL} >= ${date}`);
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

  // Handle groupBy queries
  if (plan.groupBy && plan.groupBy.length > 0) {
    return await executeGroupedAggregate(plan, context, conditions);
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

  const aggSQL = buildAggregationSQL({
    fn: metric.agg,
    field: metric.field,
    as: "value",
  });

  if (!aggSQL) {
    return { success: false, error: "Invalid aggregation" };
  }

  const resultA = await db
    .select({
      value: aggSQL,
      count: sql<number>`count(*)`,
    })
    .from(trade)
    .where(and(...conditionsA));

  // Execute for cohort B
  const conditionsB = buildWhereConditions(
    [...plan.filters, ...b.filters],
    context.scopedAccountIds || [context.accountId]
  );
  addTimeframeConditions(conditionsB, plan.timeframe);

  const resultB = await db
    .select({
      value: aggSQL,
      count: sql<number>`count(*)`,
    })
    .from(trade)
    .where(and(...conditionsB));

  const valueA = Number(resultA[0]?.value) || 0;
  const valueB = Number(resultB[0]?.value) || 0;
  const countA = Number(resultA[0]?.count) || 0;
  const countB = Number(resultB[0]?.count) || 0;

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

type InsightCandidate = {
  text: string;
  recommendation?: string;
  score: number;
};

type GroupStats = {
  label: string;
  count: number;
  wins: number;
  winRate: number;
  totalProfit: number;
  avgProfit: number;
};

function buildRecommendationsFromTrades(
  trades: Record<string, any>[]
): { insights: string[]; recommendations: string[] } {
  const candidates: InsightCandidate[] = [];
  const profitField = FIELD_MAP.get("profit");
  const realisedRRField = FIELD_MAP.get("realisedRR");
  const maxRRField = FIELD_MAP.get("maxRR");
  const captureField = FIELD_MAP.get("rrCaptureEfficiency");
  const postExitField = FIELD_MAP.get("mpeManipPE_R");
  const manipEffField = FIELD_MAP.get("manipRREfficiency");
  const exitEffField = FIELD_MAP.get("exitEfficiency");
  const plannedRRField = FIELD_MAP.get("plannedRR");

  const profits = trades
    .map((trade) => getNumericValue(trade, "profit"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const totalProfit = profits.reduce((sum, value) => sum + value, 0);
  const winProfits = profits.filter((value) => value > 0);
  const lossProfits = profits.filter((value) => value < 0);
  const winRate =
    profits.length > 0 ? (winProfits.length / profits.length) * 100 : 0;

  const avgWin = averageNumbers(winProfits);
  const avgLoss = averageNumbers(lossProfits.map((value) => Math.abs(value)));

  if (avgWin !== null && avgLoss !== null && avgLoss > avgWin * 1.1) {
    candidates.push({
      text: `Average loss (${formatValue(-avgLoss, profitField)}) is larger than average win (${formatValue(avgWin, profitField)}).`,
      recommendation:
        "Focus on reducing average loss size or improving reward-to-risk on winning trades.",
      score: avgLoss - avgWin,
    });
  } else if (profits.length >= 5 && winRate < 45) {
    candidates.push({
      text: `Win rate is ${formatPercent(winRate)} across ${formatCount(
        profits.length
      )} trades.`,
      recommendation:
        "Tighten entry criteria or prioritize higher-conviction setups to lift your win rate.",
      score: 45 - winRate,
    });
  } else if (profits.length >= 5 && totalProfit < 0) {
    candidates.push({
      text: `Net result is ${formatValue(totalProfit, profitField)} across ${formatCount(
        profits.length
      )} trades.`,
      recommendation:
        "Review recent losses and focus on preserving capital before increasing size.",
      score: Math.abs(totalProfit),
    });
  }

  const holdStats = buildHoldTimeStats(trades);
  const holdCandidates = holdStats.filter((stat) => stat.count >= 5);
  if (holdCandidates.length >= 2) {
    const best = holdCandidates.reduce((prev, curr) =>
      curr.winRate > prev.winRate ? curr : prev
    );
    const worst = holdCandidates.reduce((prev, curr) =>
      curr.winRate < prev.winRate ? curr : prev
    );
    const diff = best.winRate - worst.winRate;
    if (diff >= 10) {
      candidates.push({
        text: `Hold times ${best.label} perform best (${formatPercent(
          best.winRate
        )} win rate, n=${formatCount(best.count)}) vs ${worst.label} at ${formatPercent(
          worst.winRate
        )}.`,
        recommendation: `Consider emphasizing ${best.label} holds or tightening filters for ${worst.label} trades.`,
        score: diff,
      });
    }
  }

  const sessionStats = buildGroupStats(trades, "sessionTag");
  const sessionCandidates = sessionStats.filter((stat) => stat.count >= 5);
  if (sessionCandidates.length >= 2) {
    const sorted = [...sessionCandidates].sort(
      (a, b) => b.totalProfit - a.totalProfit
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && best.label !== worst.label) {
      const diff = Math.abs(best.totalProfit - worst.totalProfit);
      candidates.push({
        text: `Best session is ${best.label} (${formatValue(
          best.totalProfit,
          profitField
        )}, ${formatPercent(best.winRate)} win rate, n=${formatCount(
          best.count
        )}). Worst is ${worst.label} (${formatValue(
          worst.totalProfit,
          profitField
        )}, ${formatPercent(worst.winRate)} win rate).`,
        recommendation: `Prioritize setups in ${best.label} and review what is driving losses in ${worst.label}.`,
        score: diff,
      });
    }
  }

  const modelStats = buildGroupStats(trades, "modelTag", (label) =>
    label.toLowerCase()
  );
  const modelCandidates = modelStats.filter((stat) => stat.count >= 5);
  if (modelCandidates.length >= 2) {
    const sorted = [...modelCandidates].sort(
      (a, b) => b.totalProfit - a.totalProfit
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && best.label !== worst.label) {
      const diff = Math.abs(best.totalProfit - worst.totalProfit);
      candidates.push({
        text: `Best model tag is ${best.label} (${formatValue(
          best.totalProfit,
          profitField
        )}, ${formatPercent(best.winRate)} win rate, n=${formatCount(
          best.count
        )}). Worst is ${worst.label} (${formatValue(
          worst.totalProfit,
          profitField
        )}).`,
        recommendation: `Prioritize setups tagged ${best.label} and review what is underperforming in ${worst.label}.`,
        score: diff,
      });
    }
  }

  const volatilityStats = buildGroupStats(trades, "stdvBucket", (label) =>
    label.trim()
  );
  const volatilityCandidates = volatilityStats.filter((stat) => stat.count >= 5);
  if (volatilityCandidates.length >= 2) {
    const sorted = [...volatilityCandidates].sort(
      (a, b) => b.totalProfit - a.totalProfit
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && best.label !== worst.label) {
      const diff = Math.abs(best.totalProfit - worst.totalProfit);
      candidates.push({
        text: `Best volatility bucket is ${best.label} (${formatValue(
          best.totalProfit,
          profitField
        )}, ${formatPercent(best.winRate)} win rate). Worst is ${worst.label} (${formatValue(
          worst.totalProfit,
          profitField
        )}).`,
        recommendation: `Focus on trades that match the ${best.label} regime and tighten filters in ${worst.label} conditions.`,
        score: diff,
      });
    }
  }

  const protocolStats = buildGroupStats(trades, "protocolAlignment", (label) =>
    label.toLowerCase()
  );
  const aligned = protocolStats.find((stat) => stat.label === "aligned");
  const against = protocolStats.find((stat) => stat.label === "against");
  if (aligned && against && aligned.count >= 5 && against.count >= 5) {
    const diff = aligned.winRate - against.winRate;
    if (diff >= 10) {
      candidates.push({
        text: `Aligned trades outperform against trades (${formatPercent(
          aligned.winRate
        )} vs ${formatPercent(against.winRate)} win rate).`,
        recommendation:
          "Reduce against-protocol trades and double down on aligned setups.",
        score: diff,
      });
    }
  }

  const manipEffValues = trades
    .map((trade) => getNumericValue(trade, "manipRREfficiency"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgManipEff = averageNumbers(manipEffValues);
  if (avgManipEff !== null && manipEffValues.length >= 5 && avgManipEff < 50) {
    candidates.push({
      text: `Manipulation efficiency averages ${formatValue(
        avgManipEff,
        manipEffField
      )} across ${formatCount(manipEffValues.length)} trades.`,
      recommendation:
        "Refine manipulation entries or wait for cleaner liquidity grabs to improve efficiency.",
      score: 50 - avgManipEff,
    });
  }

  const exitEffValues = trades
    .map((trade) => getNumericValue(trade, "exitEfficiency"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgExitEff = averageNumbers(exitEffValues);
  if (avgExitEff !== null && exitEffValues.length >= 5 && avgExitEff < 40) {
    candidates.push({
      text: `Exit efficiency averages ${formatValue(
        avgExitEff,
        exitEffField
      )} across ${formatCount(exitEffValues.length)} trades.`,
      recommendation:
        "Review exit rules and consider scaling out closer to peak to improve exit timing.",
      score: 40 - avgExitEff,
    });
  }

  const captureValues = trades
    .map((trade) => getNumericValue(trade, "rrCaptureEfficiency"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const postExitValues = trades
    .map((trade) => getNumericValue(trade, "mpeManipPE_R"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgCapture = averageNumbers(captureValues);
  const avgPostExit = averageNumbers(postExitValues);

  if (avgCapture !== null && avgPostExit !== null && captureValues.length >= 5) {
    if (avgCapture < 40 && avgPostExit > 0.5) {
      candidates.push({
        text: `Post-exit continuation is ${formatValue(
          avgPostExit,
          postExitField
        )} while capture efficiency is only ${formatValue(
          avgCapture,
          captureField
        )}.`,
        recommendation:
          "Review exits and consider holding winners longer to capture more of the available R.",
        score: 40 - avgCapture,
      });
    } else if (avgCapture < 40) {
      candidates.push({
        text: `Capture efficiency averages ${formatValue(
          avgCapture,
          captureField
        )} across ${formatCount(captureValues.length)} trades.`,
        recommendation:
          "Tighten exit rules or scale out more systematically to improve capture efficiency.",
        score: 40 - avgCapture,
      });
    }
  }

  const plannedValues = trades
    .map((trade) => getNumericValue(trade, "plannedRR"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const realisedValues = trades
    .map((trade) => getNumericValue(trade, "realisedRR"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const maxValues = trades
    .map((trade) => getNumericValue(trade, "maxRR"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgRealised = averageNumbers(realisedValues);
  const avgMax = averageNumbers(maxValues);
  const avgPlanned = averageNumbers(plannedValues);

  if (
    avgPlanned !== null &&
    avgRealised !== null &&
    plannedValues.length >= 5 &&
    realisedValues.length >= 5
  ) {
    const gap = avgPlanned - avgRealised;
    if (gap > 0.5) {
      candidates.push({
        text: `Planned R:R averages ${formatValue(
          avgPlanned,
          plannedRRField
        )} while realised R:R is ${formatValue(
          avgRealised,
          realisedRRField
        )}.`,
        recommendation:
          "Adjust targets or improve trade management so realised R:R matches the plan.",
        score: gap * 10,
      });
    }
  }

  if (
    avgRealised !== null &&
    avgMax !== null &&
    avgMax > 0 &&
    realisedValues.length >= 5 &&
    maxValues.length >= 5
  ) {
    const captureRatio = avgRealised / avgMax;
    if (captureRatio < 0.6) {
      candidates.push({
        text: `Realised R averages ${formatValue(
          avgRealised,
          realisedRRField
        )} vs max R at ${formatValue(avgMax, maxRRField)}.`,
        recommendation:
          "Work on capturing more of the available R, especially on winners that reach higher max R.",
        score: (1 - captureRatio) * 100,
      });
    }
  }

  const symbolStats = buildGroupStats(trades, "symbol", (label) =>
    label.toUpperCase()
  );
  if (symbolStats.length >= 2) {
    const totalAbs = symbolStats.reduce(
      (sum, stat) => sum + Math.abs(stat.totalProfit),
      0
    );
    const sorted = [...symbolStats].sort(
      (a, b) => Math.abs(b.totalProfit) - Math.abs(a.totalProfit)
    );
    const top = sorted[0];
    if (top && totalAbs > 0) {
      const share = (Math.abs(top.totalProfit) / totalAbs) * 100;
      if (share >= 50) {
        candidates.push({
          text: `${top.label} drives ${formatPercent(
            share
          )} of total P&L (${formatValue(top.totalProfit, profitField)}).`,
          recommendation:
            "Lean into your strongest symbol or diversify to reduce concentration risk.",
          score: share,
        });
      }
    }
  }

  const totalCommissions = trades
    .map((trade) => getNumericValue(trade, "commissions"))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
  const totalSwap = trades
    .map((trade) => getNumericValue(trade, "swap"))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
  const totalCosts = Math.abs(totalCommissions + totalSwap);

  if (totalCosts > 0 && totalProfit > 0) {
    const ratio = (totalCosts / totalProfit) * 100;
    if (ratio >= 20) {
      candidates.push({
        text: `Trading costs are ${formatValue(
          totalCosts,
          profitField
        )}, about ${formatPercent(ratio)} of total profit.`,
        recommendation:
          "Reduce fee-heavy trades or avoid small targets where costs erode returns.",
        score: ratio,
      });
    }
  }

  const directionStats = buildGroupStats(trades, "tradeType", (label) =>
    label.toLowerCase()
  );
  const longStats = directionStats.find((stat) => stat.label === "long");
  const shortStats = directionStats.find((stat) => stat.label === "short");
  if (
    longStats &&
    shortStats &&
    longStats.count >= 5 &&
    shortStats.count >= 5
  ) {
    const diff = longStats.winRate - shortStats.winRate;
    if (Math.abs(diff) >= 10) {
      const better = diff > 0 ? longStats : shortStats;
      const weaker = diff > 0 ? shortStats : longStats;
      candidates.push({
        text: `${better.label} trades outperform ${weaker.label} trades (${formatPercent(
          better.winRate
        )} vs ${formatPercent(weaker.winRate)} win rate).`,
        recommendation: `Emphasize ${better.label} setups or tighten criteria on ${weaker.label} trades.`,
        score: Math.abs(diff),
      });
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score);
  const insights = ranked.slice(0, 3).map((item) => item.text);
  const recommendations = ranked
    .filter((item) => item.recommendation)
    .slice(0, 3)
    .map((item) => item.recommendation as string);

  if (insights.length === 0 && profits.length > 0) {
    insights.push(
      `Overall result is ${formatValue(
        totalProfit,
        profitField
      )} across ${formatCount(profits.length)} trades.`
    );
  }

  if (recommendations.length === 0 && profits.length > 0) {
    recommendations.push(
      "Keep tracking more trades and tag sessions or models so we can surface stronger improvement signals."
    );
  }

  return { insights, recommendations };
}

type ImprovementRow = { label: string; value: string; note?: string };

function buildImprovementsFromTrades(trades: Record<string, any>[]): ImprovementRow[] {
  const now = Date.now();
  const lastStart = now - 30 * 24 * 60 * 60 * 1000;
  const prevStart = now - 60 * 24 * 60 * 60 * 1000;

  const dated = trades
    .map((trade) => ({ trade, time: getTradeTime(trade) }))
    .filter((item) => item.time !== null) as Array<{
    trade: Record<string, any>;
    time: number;
  }>;

  const lastTrades = dated
    .filter((item) => item.time >= lastStart && item.time <= now)
    .map((item) => item.trade);
  const prevTrades = dated
    .filter((item) => item.time >= prevStart && item.time < lastStart)
    .map((item) => item.trade);

  if (lastTrades.length < 5 || prevTrades.length < 5) {
    return [];
  }

  const metrics: Array<{
    key: string;
    label: string;
    fieldKey?: string;
    compute: (items: Record<string, any>[]) => number | null;
    format: (value: number) => string;
  }> = [
    {
      key: "win_rate",
      label: "Win rate (last 30d)",
      compute: (items) => computeWinRate(items),
      format: (value) => formatPercent(value),
    },
    {
      key: "avg_profit",
      label: "Average profit (last 30d)",
      fieldKey: "profit",
      compute: (items) => averageFromField(items, "profit"),
      format: (value) => formatValue(value, FIELD_MAP.get("profit")),
    },
    {
      key: "avg_realised_rr",
      label: "Average realised r:r (last 30d)",
      fieldKey: "realisedRR",
      compute: (items) => averageFromField(items, "realisedRR"),
      format: (value) => formatValue(value, FIELD_MAP.get("realisedRR")),
    },
    {
      key: "capture_efficiency",
      label: "Capture efficiency (last 30d)",
      fieldKey: "rrCaptureEfficiency",
      compute: (items) => averageFromField(items, "rrCaptureEfficiency"),
      format: (value) => formatValue(value, FIELD_MAP.get("rrCaptureEfficiency")),
    },
    {
      key: "avg_hold_time",
      label: "Average hold time (last 30d)",
      fieldKey: "tradeDurationSeconds",
      compute: (items) => averageFromField(items, "tradeDurationSeconds"),
      format: (value) => formatValue(value, FIELD_MAP.get("tradeDurationSeconds")),
    },
  ];

  const rows: ImprovementRow[] = [];

  metrics.forEach((metric) => {
    const lastValue = metric.compute(lastTrades);
    const prevValue = metric.compute(prevTrades);
    if (lastValue === null || prevValue === null) return;
    if (!Number.isFinite(lastValue) || !Number.isFinite(prevValue)) return;

    const delta = lastValue - prevValue;
    const formattedValue = metric.format(lastValue);
    const formattedDelta = formatMetricDelta(metric.key, delta);
    const note = `Change: ${formattedDelta} vs prior 30d`;

    rows.push({
      label: metric.label,
      value: formattedValue,
      note,
    });
  });

  return rows;
}

function computeWinRate(items: Record<string, any>[]): number | null {
  if (items.length === 0) return null;
  const wins = items.filter((item) =>
    isWinTrade(item, getNumericValue(item, "profit") ?? undefined)
  );
  return (wins.length / items.length) * 100;
}

function averageFromField(
  items: Record<string, any>[],
  field: string
): number | null {
  const values = items
    .map((item) => getNumericValue(item, field))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return averageNumbers(values);
}

function formatMetricDelta(metricKey: string, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const absDelta = Math.abs(delta);

  switch (metricKey) {
    case "win_rate":
      return `${sign}${formatPercent(absDelta)}`;
    case "avg_profit":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("profit"))}`;
    case "avg_realised_rr":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("realisedRR"))}`;
    case "capture_efficiency":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("rrCaptureEfficiency"))}`;
    case "avg_hold_time":
      return `${sign}${formatValue(
        absDelta,
        FIELD_MAP.get("tradeDurationSeconds")
      )}`;
    default:
      return `${sign}${absDelta.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;
  }
}

function buildGroupStats(
  trades: Record<string, any>[],
  field: string,
  normalizeLabel?: (label: string) => string
): GroupStats[] {
  const map = new Map<string, GroupStats>();
  for (const tradeRow of trades) {
    const raw = tradeRow[field];
    if (raw === null || raw === undefined) continue;
    const label = String(raw).trim();
    if (!label) continue;
    const key = normalizeLabel ? normalizeLabel(label) : label.toLowerCase();

    let stats = map.get(key);
    if (!stats) {
      stats = {
        label: normalizeLabel ? normalizeLabel(label) : label,
        count: 0,
        wins: 0,
        winRate: 0,
        totalProfit: 0,
        avgProfit: 0,
      };
      map.set(key, stats);
    }

    const profit = getNumericValue(tradeRow, "profit") ?? 0;
    stats.count += 1;
    stats.totalProfit += profit;
    if (isWinTrade(tradeRow, profit)) {
      stats.wins += 1;
    }
  }

  return Array.from(map.values()).map((stats) => ({
    ...stats,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgProfit: stats.count > 0 ? stats.totalProfit / stats.count : 0,
  }));
}

function buildHoldTimeStats(trades: Record<string, any>[]): GroupStats[] {
  const buckets = new Map<string, GroupStats>();

  for (const tradeRow of trades) {
    const duration = getNumericValue(tradeRow, "tradeDurationSeconds");
    if (duration === null || !Number.isFinite(duration)) continue;

    const label =
      duration < 4 * 3600
        ? "under 4h"
        : duration < 24 * 3600
        ? "4-24h"
        : "over 24h";

    let stats = buckets.get(label);
    if (!stats) {
      stats = {
        label,
        count: 0,
        wins: 0,
        winRate: 0,
        totalProfit: 0,
        avgProfit: 0,
      };
      buckets.set(label, stats);
    }

    const profit = getNumericValue(tradeRow, "profit") ?? 0;
    stats.count += 1;
    stats.totalProfit += profit;
    if (isWinTrade(tradeRow, profit)) {
      stats.wins += 1;
    }
  }

  return Array.from(buckets.values()).map((stats) => ({
    ...stats,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgProfit: stats.count > 0 ? stats.totalProfit / stats.count : 0,
  }));
}

function isWinTrade(tradeRow: Record<string, any>, profit?: number): boolean {
  const resolvedProfit =
    typeof profit === "number" ? profit : getNumericValue(tradeRow, "profit");
  if (resolvedProfit !== null && Number.isFinite(resolvedProfit)) {
    return resolvedProfit > 0;
  }
  const outcome = String(tradeRow.outcome || "").toLowerCase();
  return outcome === "win" || outcome === "pw";
}

function averageNumbers(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const hasDecimal = Math.abs(rounded % 1) > 0;
  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimal ? 1 : 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function getTradeTime(row: Record<string, any>): number | null {
  const value = row.open ?? row.openedAt ?? row.close ?? row.closedAt;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function getNumericValue(row: Record<string, any>, field: string): number | null {
  const raw = row[field];
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isNaN(num) ? null : num;
}

function tradeMatchesFilters(row: Record<string, any>, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const raw = row[filter.field];
    if (filter.op === "between" && "from" in filter.value) {
      const value = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
      const from = new Date(filter.value.from).getTime();
      const to = new Date(filter.value.to).getTime();
      if (Number.isNaN(value) || Number.isNaN(from) || Number.isNaN(to)) return false;
      return value >= from && value <= to;
    }

    if (filter.op === "contains") {
      return String(raw || "")
        .toLowerCase()
        .includes(String(filter.value || "").toLowerCase());
    }

    if (filter.op === "in") {
      const list = Array.isArray(filter.value) ? filter.value : [filter.value];
      return list.map(String).includes(String(raw));
    }

    const numericValue =
      typeof filter.value === "number" ? filter.value : parseFloat(String(filter.value));
    const numericRaw = typeof raw === "number" ? raw : parseFloat(String(raw));
    const compareRaw = Number.isNaN(numericRaw) ? raw : numericRaw;
    const compareValue = Number.isNaN(numericValue) ? filter.value : numericValue;

    if (filter.op === "eq" && filter.field === "symbol") {
      return String(raw || "")
        .toLowerCase()
        .includes(String(filter.value || "").toLowerCase());
    }

    switch (filter.op) {
      case "eq":
        return String(compareRaw) === String(compareValue);
      case "neq":
        return String(compareRaw) !== String(compareValue);
      case "gt":
        return Number(compareRaw) > Number(compareValue);
      case "gte":
        return Number(compareRaw) >= Number(compareValue);
      case "lt":
        return Number(compareRaw) < Number(compareValue);
      case "lte":
        return Number(compareRaw) <= Number(compareValue);
      default:
        return true;
    }
  });
}

function computeAggregateFromTrades(
  trades: Record<string, any>[],
  metric: { field: string; agg: string }
): number | null {
  if (metric.agg === "count") {
    return trades.length;
  }

  const values = trades
    .map((t) => getNumericValue(t, metric.field))
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  if (values.length === 0) return null;

  switch (metric.agg) {
    case "sum":
      return values.reduce((sum, v) => sum + v, 0);
    case "avg":
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "p50":
      return percentile(values, 50);
    case "p90":
      return percentile(values, 90);
    default:
      return null;
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function standardize(points: number[][]): number[][] {
  const dims = points[0]?.length || 0;
  const means = new Array(dims).fill(0);
  const stdevs = new Array(dims).fill(0);

  for (const point of points) {
    point.forEach((value, idx) => {
      means[idx] += value;
    });
  }
  means.forEach((sum, idx) => {
    means[idx] = sum / points.length;
  });

  for (const point of points) {
    point.forEach((value, idx) => {
      stdevs[idx] += Math.pow(value - means[idx], 2);
    });
  }
  stdevs.forEach((sum, idx) => {
    stdevs[idx] = Math.sqrt(sum / points.length) || 1;
  });

  return points.map((point) =>
    point.map((value, idx) => (value - means[idx]) / stdevs[idx])
  );
}

function runKMeans(points: number[][], k: number, iterations = 15): {
  assignments: number[];
} {
  const centroids = points.slice(0, k).map((p) => [...p]);
  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    assignments = points.map((point) => {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, idx) => {
        const dist = centroid.reduce((sum, c, dim) => {
          return sum + Math.pow(point[dim] - c, 2);
        }, 0);
        if (dist < bestDist) {
          bestDist = dist;
          best = idx;
        }
      });
      return best;
    });

    const sums = centroids.map(() => new Array(points[0].length).fill(0));
    const counts = centroids.map(() => 0);

    points.forEach((point, idx) => {
      const cluster = assignments[idx];
      counts[cluster] += 1;
      point.forEach((value, dim) => {
        sums[cluster][dim] += value;
      });
    });

    centroids.forEach((centroid, idx) => {
      const count = counts[idx] || 1;
      centroid.forEach((_, dim) => {
        centroid[dim] = sums[idx][dim] / count;
      });
    });
  }

  return { assignments };
}

function buildClusterSummaries(
  trades: Record<string, any>[],
  assignments: number[]
): Array<Record<string, any>> {
  const clusters: Record<number, Record<string, any>[]> = {};
  trades.forEach((trade, idx) => {
    const clusterId = assignments[idx];
    clusters[clusterId] = clusters[clusterId] || [];
    clusters[clusterId].push(trade);
  });

  const overall = {
    hold: averageField(trades, "tradeDurationSeconds"),
    capture: averageField(trades, "rrCaptureEfficiency"),
    mfe: averageField(trades, "mfePips"),
    stdv: averageField(trades, "rawSTDV"),
  };

  return Object.entries(clusters).map(([clusterId, clusterTrades]) => {
    const avgHold = averageField(clusterTrades, "tradeDurationSeconds");
    const avgCapture = averageField(clusterTrades, "rrCaptureEfficiency");
    const avgMfe = averageField(clusterTrades, "mfePips");
    const avgStdv = averageField(clusterTrades, "rawSTDV");
    const avgRealised = averageField(clusterTrades, "realisedRR");

    const label = labelCluster({
      avgHold,
      avgCapture,
      avgMfe,
      avgStdv,
      overall,
    });

    return {
      state: label,
      trades: clusterTrades.length,
      avg_hold_time: avgHold,
      avg_capture_efficiency: avgCapture,
      avg_mfe: avgMfe,
      avg_volatility: avgStdv,
      avg_realised_rr: avgRealised,
    };
  });
}

function averageField(trades: Record<string, any>[], field: string): number {
  const values = trades
    .map((t) => getNumericValue(t, field))
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function labelCluster(args: {
  avgHold: number;
  avgCapture: number;
  avgMfe: number;
  avgStdv: number;
  overall: { hold: number; capture: number; mfe: number; stdv: number };
}): string {
  const descriptors: string[] = [];
  const { avgHold, avgCapture, avgMfe, avgStdv, overall } = args;

  if (overall.hold && avgHold <= overall.hold * 0.75) descriptors.push("fast-exit");
  if (overall.hold && avgHold >= overall.hold * 1.25) descriptors.push("patient");
  if (overall.capture && avgCapture >= overall.capture * 1.2) descriptors.push("high-capture");
  if (overall.capture && avgCapture <= overall.capture * 0.8) descriptors.push("low-capture");
  if (overall.mfe && avgMfe >= overall.mfe * 1.2) descriptors.push("high-mfe");
  if (overall.stdv && avgStdv >= overall.stdv * 1.2) descriptors.push("high-volatility");

  if (descriptors.length === 0) return "balanced";
  return descriptors.slice(0, 2).join(" / ");
}

function buildPersonaRows(
  trades: Record<string, any>[],
  metrics: Array<{ field: string; agg: string }>,
  windowDays: number,
  startTime: number,
  endTime: number
): Array<Record<string, any>> {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const rows: Array<Record<string, any>> = [];
  let windowEnd = endTime;

  while (windowEnd > startTime) {
    const windowStart = windowEnd - windowMs;
    const windowTrades = trades.filter((t) => {
      const time = getTradeTime(t);
      if (!time) return false;
      return time > windowStart && time <= windowEnd;
    });

    const row: Record<string, any> = {
      window: formatWindowLabel(windowStart, windowEnd),
      trades: windowTrades.length,
    };

    metrics.forEach((metric) => {
      const key = `${metric.agg}_${toSnakeCase(metric.field)}`;
      row[key] = computeAggregateFromTrades(windowTrades, metric);
    });

    rows.push(row);
    windowEnd = windowStart;
  }

  return rows;
}

function formatWindowLabel(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startLabel = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function buildTradeSelectShape(fields: string[]): Record<string, any> {
  const shape: Record<string, any> = {};
  const required = new Set(["id", "open", "close", ...fields]);

  required.forEach((field) => {
    const column = (trade as any)[field];
    if (column) {
      shape[field] = column;
    }
  });

  return shape;
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

/**
 * Build aggregation SQL
 */
function buildAggregationSQL(agg: Aggregate): SQL | null {
  // count(*) doesn't need a field
  if (agg.fn === "count" && !agg.field) {
    return sql<number>`count(*)`;
  }

  if (!agg.field) {
    return null;
  }

  if (
    agg.fn === "sum" &&
    agg.as === "total_loss" &&
    agg.field === "profit"
  ) {
    return sql<number>`sum(case when ${trade.profit} < 0 then ${trade.profit} else 0 end)`;
  }

  const column = (trade as any)[agg.field];
  if (!column) {
    console.warn(`[Query Executor] Column not found: ${agg.field}`);
    return null;
  }

  const numericColumn =
    agg.field === "tradeDurationSeconds"
      ? sql<number>`nullif(${column}, '')::numeric`
      : column;

  switch (agg.fn) {
    case "avg":
      return sql<number>`avg(${numericColumn})`;
    case "sum":
      return sql<number>`sum(${numericColumn})`;
    case "min":
      return sql<number>`min(${numericColumn})`;
    case "max":
      return sql<number>`max(${numericColumn})`;
    case "count":
      return sql<number>`count(${column})`;
    case "p50":
      // PostgreSQL percentile_cont
      return sql<number>`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${numericColumn})`;
    case "p90":
      return sql<number>`percentile_cont(0.9) WITHIN GROUP (ORDER BY ${numericColumn})`;
    default:
      return null;
  }
}

/**
 * Format value with units
 */
function formatValue(value: any, field: TradeField | null | undefined): string {
  if (value === null || value === undefined) return "N/A";

  const num = Number(value);
  if (isNaN(num)) return String(value);

  if (!field || !field.unit) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  switch (field.unit) {
    case "$":
      return `${num < 0 ? "-$" : "$"}${Math.abs(num).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;
    case "%":
      return `${num.toLocaleString(undefined, {
        minimumFractionDigits: num % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      })}%`;
    case "pips":
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })} pips`;
    case "R":
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}R`;
    case "seconds":
      return formatSeconds(num);
    case "lots":
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} lots`;
    default:
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} ${field.unit}`;
  }
}

/**
 * Format seconds into human readable
 */
function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours}h ${minutes}m ${remainder}s`;
}

function normalizeSymbolValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toUpperCase();
}

/**
 * Format filters for display
 */
function formatFilters(filters: Filter[]): string[] {
  return filters.map(f => {
    const field = FIELD_MAP.get(f.field);
    const label = field?.label || f.field;
    
    if (f.op === "between" && "from" in f.value) {
      return `${label} between ${f.value.from} and ${f.value.to}`;
    }
    
    return `${label} ${f.op} ${f.value}`;
  });
}

/**
 * Format timeframe for display
 */
function formatTimeframe(timeframe?: TradeQueryPlan["timeframe"]): string | undefined {
  if (!timeframe) return undefined;
  
  if (timeframe.lastNDays) {
    return `Last ${timeframe.lastNDays} days`;
  }
  
  if (timeframe.from && timeframe.to) {
    return `${timeframe.from} to ${timeframe.to}`;
  }
  
  if (timeframe.from) {
    return `From ${timeframe.from}`;
  }
  
  if (timeframe.to) {
    return `Until ${timeframe.to}`;
  }
  
  return undefined;
}

/**
 * Generate caveats based on sample size
 */
function generateCaveats(count: number, label?: string): string[] {
  const caveats: string[] = [];
  const prefix = label ? `${label}: ` : "";
  
  if (count === 0) {
    caveats.push(`${prefix}No trades found`);
  } else if (count < 10) {
    caveats.push(`${prefix}Small sample size (n=${count}) - results may not be reliable`);
  } else if (count < 30) {
    caveats.push(`${prefix}Limited sample size (n=${count}) - interpret with caution`);
  }
  
  return caveats;
}
