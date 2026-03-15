import {
  between,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { trade } from "../../db/schema/trading";
import { buildAccountScopeCondition } from "../account-scope";
import type { Aggregate, Filter, TradeQueryPlan } from "./query-plan";
import {
  FIELD_MAP,
} from "./trade-fields";
import {
  DERIVED_FIELDS,
  getTimeframeTimestampSQL,
  getTimestampColumn,
  isDerivedField,
  normalizeFilterValue,
} from "./query-executor-derived-fields";
import { normalizeSymbolValue } from "./query-executor-formatting";

export function buildWhereConditions(
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
        console.warn(
          `[Query Executor] Cannot filter derived field ${filter.field} with op ${filter.op}`
        );
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
          const values = Array.isArray(filter.value) ? filter.value : [filter.value];
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
        if ("from" in filter.value && "to" in filter.value) {
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

export function addTimeframeConditions(
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

export function buildTradeSelectShape(fields: string[]): Record<string, any> {
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

export function buildAggregationSQL(agg: Aggregate): SQL | null {
  if (agg.fn === "count" && !agg.field) {
    return sql<number>`count(*)`;
  }

  if (!agg.field) {
    return null;
  }

  if (agg.fn === "sum" && agg.as === "total_loss" && agg.field === "profit") {
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
      return sql<number>`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${numericColumn})`;
    case "p90":
      return sql<number>`percentile_cont(0.9) WITHIN GROUP (ORDER BY ${numericColumn})`;
    default:
      return null;
  }
}
