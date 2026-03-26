import type { TradeQueryPlan } from "./query-plan";

export type PlanExpectation = {
  intent?: TradeQueryPlan["intent"];
  vizType?: TradeQueryPlan["vizType"];
  displayMode?: TradeQueryPlan["displayMode"];
  groupBy?: string[];
  aggregates?: Array<{ field: string; fn?: string }>;
  sort?: { field?: string; dir?: "asc" | "desc" };
  timeframe?: TradeQueryPlan["timeframe"];
  filters?: Array<{ field: string; op?: string; value?: any }>;
  limit?: number;
  minLimit?: number;
  maxLimit?: number;
};

export type PlanTestCase = {
  id: string;
  query: string;
  expect: PlanExpectation;
};

export type PlanTestResult = {
  id: string;
  query: string;
  pass: boolean;
  failures: string[];
  plan?: TradeQueryPlan;
};

export const PLAN_TEST_SUITE: PlanTestCase[] = [
  {
    id: "profit-assets-week",
    query: "What's my most profitable assets this week?",
    expect: {
      intent: "aggregate",
      vizType: "asset_profitability",
      displayMode: "plural",
      groupBy: ["symbol"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc", field: "total_profit" },
      timeframe: { lastNDays: 7 },
      minLimit: 2,
    },
  },
  {
    id: "profit-asset-week",
    query: "What's my most profitable asset this week?",
    expect: {
      intent: "aggregate",
      vizType: "asset_profitability",
      displayMode: "singular",
      groupBy: ["symbol"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc", field: "total_profit" },
      timeframe: { lastNDays: 7 },
      limit: 1,
    },
  },
  {
    id: "least-assets-week",
    query: "least profitable assets this week",
    expect: {
      intent: "aggregate",
      vizType: "asset_profitability",
      displayMode: "plural",
      groupBy: ["symbol"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "asc", field: "total_profit" },
      timeframe: { lastNDays: 7 },
    },
  },
  {
    id: "best-session-singular",
    query: "What's my most profitable session?",
    expect: {
      intent: "aggregate",
      displayMode: "singular",
      groupBy: ["sessionTag"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc" },
      limit: 1,
    },
  },
  {
    id: "best-sessions-plural",
    query: "What are my most profitable sessions?",
    expect: {
      intent: "aggregate",
      displayMode: "plural",
      groupBy: ["sessionTag"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc" },
      minLimit: 2,
    },
  },
  {
    id: "best-setup-singular",
    query: "What's my best setup?",
    expect: {
      intent: "aggregate",
      displayMode: "singular",
      groupBy: ["modelTag"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc" },
      limit: 1,
    },
  },
  {
    id: "worst-setups-plural",
    query: "What are my worst setups?",
    expect: {
      intent: "aggregate",
      displayMode: "plural",
      groupBy: ["modelTag"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "asc" },
      minLimit: 2,
    },
  },
  {
    id: "worst-time-of-day-singular",
    query: "What's my worst time of day?",
    expect: {
      intent: "aggregate",
      displayMode: "singular",
      groupBy: ["timeOfDay"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "asc" },
      limit: 1,
    },
  },
  {
    id: "best-times-of-day-plural",
    query: "What are my best times of day?",
    expect: {
      intent: "aggregate",
      displayMode: "plural",
      groupBy: ["timeOfDay"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc" },
      minLimit: 2,
    },
  },
  {
    id: "best-month-singular",
    query: "What's my best month?",
    expect: {
      intent: "aggregate",
      displayMode: "singular",
      groupBy: ["month"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc" },
      limit: 1,
    },
  },
  {
    id: "worst-months-plural",
    query: "What are my worst months?",
    expect: {
      intent: "aggregate",
      displayMode: "plural",
      groupBy: ["month"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "asc" },
      minLimit: 2,
    },
  },
  {
    id: "breakdown-symbol",
    query: "breakdown by symbol",
    expect: {
      intent: "aggregate",
      vizType: "asset_profitability",
      groupBy: ["symbol"],
      aggregates: [{ field: "profit", fn: "sum" }],
      sort: { dir: "desc", field: "total_profit" },
    },
  },
  {
    id: "weekday-performance",
    query: "performance by day of week",
    expect: {
      intent: "aggregate",
      vizType: "weekday_performance",
      groupBy: ["weekday"],
      aggregates: [{ field: "profit", fn: "sum" }],
    },
  },
  {
    id: "daily-pnl-month",
    query: "daily p&l this month",
    expect: {
      intent: "aggregate",
      vizType: "daily_pnl",
      groupBy: ["open"],
      aggregates: [{ field: "profit", fn: "sum" }],
      timeframe: { lastNDays: 30 },
    },
  },
  {
    id: "average-hold-time",
    query: "How long do I hold trades on average?",
    expect: {
      intent: "aggregate",
      vizType: "kpi_single",
      displayMode: "singular",
      aggregates: [{ field: "tradeDurationSeconds", fn: "avg" }],
    },
  },
  {
    id: "compare-rr",
    query: "Compare realised RR vs max RR",
    expect: {
      intent: "aggregate",
      vizType: "kpi_grid",
      displayMode: "plural",
      aggregates: [
        { field: "realisedRR", fn: "avg" },
        { field: "maxRR", fn: "avg" },
      ],
    },
  },
  {
    id: "r-performance-asia",
    query: "How does my 4R performance look in Asia?",
    expect: {
      intent: "aggregate",
      filters: [
        { field: "realisedRR", op: "gte", value: 4 },
        { field: "sessionTag", op: "contains", value: "Asia" },
      ],
    },
  },
];

export function evaluatePlanExpectations(
  plan: TradeQueryPlan,
  expect: PlanExpectation
): string[] {
  const failures: string[] = [];

  if (expect.intent && plan.intent !== expect.intent) {
    failures.push(`intent ${plan.intent} !== ${expect.intent}`);
  }

  if (expect.vizType && plan.vizType !== expect.vizType) {
    failures.push(`vizType ${plan.vizType} !== ${expect.vizType}`);
  }

  if (expect.displayMode && plan.displayMode !== expect.displayMode) {
    failures.push(`displayMode ${plan.displayMode} !== ${expect.displayMode}`);
  }

  if (expect.groupBy) {
    const groupFields = (plan.groupBy || []).map((g) => g.field);
    expect.groupBy.forEach((field) => {
      if (!groupFields.includes(field)) {
        failures.push(`groupBy missing ${field}`);
      }
    });
  }

  if (expect.aggregates) {
    const aggregates = plan.aggregates || [];
    expect.aggregates.forEach((agg) => {
      const match = aggregates.some(
        (a) =>
          a.field === agg.field &&
          (agg.fn ? a.fn === agg.fn : true)
      );
      if (!match) {
        failures.push(`aggregate missing ${agg.fn ?? "*"}(${agg.field})`);
      }
    });
  }

  if (expect.sort) {
    if (!plan.sort) {
      failures.push("sort missing");
    } else {
      if (expect.sort.dir && plan.sort.dir !== expect.sort.dir) {
        failures.push(`sort dir ${plan.sort.dir} !== ${expect.sort.dir}`);
      }
      if (expect.sort.field && plan.sort.field !== expect.sort.field) {
        failures.push(`sort field ${plan.sort.field} !== ${expect.sort.field}`);
      }
    }
  }

  if (expect.timeframe) {
    const actual = plan.timeframe;
    if (!actual) {
      failures.push("timeframe missing");
    } else if (expect.timeframe.lastNDays || actual.lastNDays) {
      if (expect.timeframe.lastNDays !== actual.lastNDays) {
        failures.push(
          `timeframe lastNDays ${actual.lastNDays ?? "none"} !== ${
            expect.timeframe.lastNDays ?? "none"
          }`
        );
      }
    } else if (
      expect.timeframe.from ||
      expect.timeframe.to ||
      actual.from ||
      actual.to
    ) {
      if (expect.timeframe.from && actual.from !== expect.timeframe.from) {
        failures.push(
          `timeframe from ${actual.from ?? "none"} !== ${
            expect.timeframe.from
          }`
        );
      }
      if (expect.timeframe.to && actual.to !== expect.timeframe.to) {
        failures.push(
          `timeframe to ${actual.to ?? "none"} !== ${expect.timeframe.to}`
        );
      }
    }
  }

  if (expect.limit !== undefined && plan.limit !== expect.limit) {
    failures.push(`limit ${plan.limit ?? "none"} !== ${expect.limit}`);
  }

  if (expect.minLimit !== undefined) {
    if (plan.limit === undefined || plan.limit < expect.minLimit) {
      failures.push(`limit ${plan.limit ?? "none"} < ${expect.minLimit}`);
    }
  }

  if (expect.maxLimit !== undefined) {
    if (plan.limit === undefined || plan.limit > expect.maxLimit) {
      failures.push(`limit ${plan.limit ?? "none"} > ${expect.maxLimit}`);
    }
  }

  if (expect.filters) {
    const filters = plan.filters || [];
    expect.filters.forEach((filter) => {
      const match = filters.some((candidate) =>
        filterMatches(candidate, filter)
      );
      if (!match) {
        failures.push(
          `filter missing ${filter.field}${filter.op ? ` ${filter.op}` : ""} ${String(
            filter.value ?? ""
          )}`.trim()
        );
      }
    });
  }

  return failures;
}

function filterMatches(
  actual: TradeQueryPlan["filters"][number],
  expected: { field: string; op?: string; value?: any }
): boolean {
  if (actual.field !== expected.field) return false;
  if (expected.op && actual.op !== expected.op) return false;
  if (expected.value === undefined) return true;

  const actualValue = actual.value as any;
  const expectedValue = expected.value as any;

  if (typeof expectedValue === "number") {
    return Number(actualValue) === expectedValue;
  }

  if (typeof expectedValue === "string") {
    return String(actualValue).toLowerCase().includes(expectedValue.toLowerCase());
  }

  return JSON.stringify(actualValue) === JSON.stringify(expectedValue);
}
