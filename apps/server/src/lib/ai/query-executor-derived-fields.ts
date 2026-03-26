import { sql, type SQL } from "drizzle-orm";

import {
  edge,
  trade,
  tradeEdgeAssignment,
  tradeRuleEvaluation,
} from "../../db/schema/trading";

export const DERIVED_FIELDS: Record<
  string,
  {
    getSelectSQL: () => SQL;
    getFilterSQL: (op: string, value: any) => SQL | null;
  }
> = {
  weekday: {
    getSelectSQL: () =>
      sql<string>`TRIM(TRAILING 'day' FROM TO_CHAR(${trade.openTime}, 'Day'))`,
    getFilterSQL: (op: string, value: any) => {
      const dayMap: Record<string, number> = {
        sunday: 0,
        sun: 0,
        monday: 1,
        mon: 1,
        tuesday: 2,
        tue: 2,
        tues: 2,
        wednesday: 3,
        wed: 3,
        thursday: 4,
        thu: 4,
        thurs: 4,
        friday: 5,
        fri: 5,
        saturday: 6,
        sat: 6,
      };
      const dayNum = dayMap[String(value).toLowerCase()];
      if (dayNum === undefined) return null;
      if (op === "eq") return sql`EXTRACT(DOW FROM ${trade.openTime}) = ${dayNum}`;
      if (op === "in") {
        const values = Array.isArray(value) ? value : [value];
        const dayNums = values
          .map((entry) => dayMap[String(entry).toLowerCase()])
          .filter((entry) => entry !== undefined);
        if (dayNums.length === 0) return null;
        return sql`EXTRACT(DOW FROM ${trade.openTime}) IN (${sql.raw(dayNums.join(","))})`;
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
        const hours = (Array.isArray(value) ? value : [value])
          .map(Number)
          .filter((entry) => Number.isFinite(entry) && entry >= 0 && entry <= 23);
        if (hours.length === 0) return null;
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) IN (${sql.raw(hours.join(","))})`;
      }
      if (op === "gte")
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) >= ${hour}`;
      if (op === "gt") return sql`EXTRACT(HOUR FROM ${trade.openTime}) > ${hour}`;
      if (op === "lte")
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) <= ${hour}`;
      if (op === "lt") return sql`EXTRACT(HOUR FROM ${trade.openTime}) < ${hour}`;
      if (op === "between") {
        const { from, to } = value;
        return sql`EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${Number(from)} AND ${Number(to)}`;
      }
      return null;
    },
  },
  month: {
    getSelectSQL: () =>
      sql<string>`TRIM(TRAILING FROM TO_CHAR(${trade.openTime}, 'Month'))`,
    getFilterSQL: (op: string, value: any) => {
      const monthMap: Record<string, number> = {
        january: 1,
        jan: 1,
        february: 2,
        feb: 2,
        march: 3,
        mar: 3,
        april: 4,
        apr: 4,
        may: 5,
        june: 6,
        jun: 6,
        july: 7,
        jul: 7,
        august: 8,
        aug: 8,
        september: 9,
        sep: 9,
        sept: 9,
        october: 10,
        oct: 10,
        november: 11,
        nov: 11,
        december: 12,
        dec: 12,
      };
      const monthNum = monthMap[String(value).toLowerCase()];
      if (monthNum === undefined) return null;
      if (op === "eq")
        return sql`EXTRACT(MONTH FROM ${trade.openTime}) = ${monthNum}`;
      if (op === "in") {
        const values = Array.isArray(value) ? value : [value];
        const monthNums = values
          .map((entry) => monthMap[String(entry).toLowerCase()])
          .filter((entry) => entry !== undefined);
        if (monthNums.length === 0) return null;
        return sql`EXTRACT(MONTH FROM ${trade.openTime}) IN (${sql.raw(monthNums.join(","))})`;
      }
      return null;
    },
  },
  quarter: {
    getSelectSQL: () => sql<string>`'Q' || EXTRACT(QUARTER FROM ${trade.openTime})`,
    getFilterSQL: (op: string, value: any) => {
      const quarterNum = Number(String(value).replace(/[^0-9]/g, ""));
      if (quarterNum < 1 || quarterNum > 4) return null;
      if (op === "eq")
        return sql`EXTRACT(QUARTER FROM ${trade.openTime}) = ${quarterNum}`;
      if (op === "in") {
        const quarters = (Array.isArray(value) ? value : [value])
          .map((entry) => Number(String(entry).replace(/[^0-9]/g, "")))
          .filter((entry) => entry >= 1 && entry <= 4);
        if (quarters.length === 0) return null;
        return sql`EXTRACT(QUARTER FROM ${trade.openTime}) IN (${sql.raw(quarters.join(","))})`;
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
          .filter((entry) => Number.isFinite(entry) && entry >= 2000 && entry <= 2100);
        if (years.length === 0) return null;
        return sql`EXTRACT(YEAR FROM ${trade.openTime}) IN (${sql.raw(years.join(","))})`;
      }
      if (op === "gte")
        return sql`EXTRACT(YEAR FROM ${trade.openTime}) >= ${year}`;
      if (op === "gt") return sql`EXTRACT(YEAR FROM ${trade.openTime}) > ${year}`;
      if (op === "lte")
        return sql`EXTRACT(YEAR FROM ${trade.openTime}) <= ${year}`;
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
          .map((entry) => periodMap[String(entry).toLowerCase()])
          .filter(Boolean);
        if (periods.length === 0) return null;
        const conditions = periods.map(([rangeStart, rangeEnd]) =>
          rangeStart === 0
            ? sql`(EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${rangeStart} AND ${rangeEnd})`
            : sql`EXTRACT(HOUR FROM ${trade.openTime}) BETWEEN ${rangeStart} AND ${rangeEnd}`
        );
        return sql`(${sql.join(conditions, sql` OR `)})`;
      }
      return null;
    },
  },
  edgeName: {
    getSelectSQL: () =>
      sql<string>`COALESCE((
        SELECT "edge"."name"
        FROM "trade_edge_assignment"
        INNER JOIN "edge" ON "edge"."id" = "trade_edge_assignment"."edge_id"
        WHERE "trade_edge_assignment"."trade_id" = "trade"."id"
        ORDER BY "trade_edge_assignment"."created_at" DESC
        LIMIT 1
      ), ${trade.modelTag}, 'Unassigned')`,
    getFilterSQL: (op: string, value: any) => {
      const edgeNameSQL = sql`COALESCE((
        SELECT "edge"."name"
        FROM "trade_edge_assignment"
        INNER JOIN "edge" ON "edge"."id" = "trade_edge_assignment"."edge_id"
        WHERE "trade_edge_assignment"."trade_id" = "trade"."id"
        ORDER BY "trade_edge_assignment"."created_at" DESC
        LIMIT 1
      ), ${trade.modelTag}, 'Unassigned')`;

      if (op === "eq") {
        return sql`${edgeNameSQL} = ${String(value)}`;
      }
      if (op === "neq") {
        return sql`${edgeNameSQL} <> ${String(value)}`;
      }
      if (op === "contains") {
        return sql`${edgeNameSQL} ILIKE ${`%${String(value)}%`}`;
      }
      if (op === "in") {
        const values = (Array.isArray(value) ? value : [value])
          .map((entry) => String(entry).trim())
          .filter(Boolean);
        if (values.length === 0) return null;
        return sql`${edgeNameSQL} IN (${sql.join(
          values.map((entry) => sql`${entry}`),
          sql`, `
        )})`;
      }
      return null;
    },
  },
  complianceStatus: {
    getSelectSQL: () =>
      sql<string>`COALESCE((
        SELECT ${tradeRuleEvaluation.status}
        FROM ${tradeRuleEvaluation}
        WHERE ${tradeRuleEvaluation.tradeId} = ${trade.id}
        ORDER BY ${tradeRuleEvaluation.evaluatedAt} DESC
        LIMIT 1
      ), 'unknown')`,
    getFilterSQL: (op: string, value: any) => {
      const complianceSQL = sql`COALESCE((
        SELECT ${tradeRuleEvaluation.status}
        FROM ${tradeRuleEvaluation}
        WHERE ${tradeRuleEvaluation.tradeId} = ${trade.id}
        ORDER BY ${tradeRuleEvaluation.evaluatedAt} DESC
        LIMIT 1
      ), 'unknown')`;

      if (op === "eq") {
        return sql`${complianceSQL} = ${String(value)}`;
      }
      if (op === "neq") {
        return sql`${complianceSQL} <> ${String(value)}`;
      }
      if (op === "contains") {
        return sql`${complianceSQL} ILIKE ${`%${String(value)}%`}`;
      }
      if (op === "in") {
        const values = (Array.isArray(value) ? value : [value])
          .map((entry) => String(entry).trim())
          .filter(Boolean);
        if (values.length === 0) return null;
        return sql`${complianceSQL} IN (${sql.join(
          values.map((entry) => sql`${entry}`),
          sql`, `
        )})`;
      }
      return null;
    },
  },
};

export function getTimestampColumn(fieldName: string): any | null {
  switch (fieldName) {
    case "open":
      return trade.openTime;
    case "close":
      return trade.closeTime;
    default:
      return null;
  }
}

export function getTimeframeTimestampSQL(): SQL {
  return sql`COALESCE(${trade.closeTime}, ${trade.openTime}, ${trade.createdAt})`;
}

export function normalizeFilterValue(fieldName: string, value: any): any {
  if ((fieldName === "open" || fieldName === "close") && value != null) {
    return new Date(value);
  }
  return value;
}

export function isDerivedField(fieldName: string): boolean {
  return fieldName in DERIVED_FIELDS;
}
