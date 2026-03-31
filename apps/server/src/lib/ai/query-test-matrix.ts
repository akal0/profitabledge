import type { TradeQueryPlan } from "./query-plan";
import { TRADE_FIELDS, findField } from "./trade-fields";
import { inferTimeframeFromMessage, normalizeUserMessage } from "./query-normalization";

export type QueryTestCase = {
  id: string;
  query: string;
  expectedTokens?: string[];
  expectedField?: string;
  expectedTimeframe?:
    | TradeQueryPlan["timeframe"]
    | null
    | (() => TradeQueryPlan["timeframe"] | null | undefined);
};

export const QUERY_TEST_MATRIX: QueryTestCase[] = [
  {
    id: "alias-pnl",
    query: "p&l last week",
    expectedTokens: ["profit"],
    expectedTimeframe: () => inferTimeframeFromMessage("last week"),
  },
  {
    id: "alias-trading-costs",
    query: "trading costs last 30 days",
    expectedTokens: ["commissions", "swap"],
    expectedTimeframe: { lastNDays: 30 },
  },
  {
    id: "alias-risk-reward",
    query: "risk reward this month",
    expectedTokens: ["rr"],
    expectedTimeframe: () => inferTimeframeFromMessage("this month"),
  },
  {
    id: "alias-fees",
    query: "fees this month",
    expectedTokens: ["commissions"],
    expectedTimeframe: () => inferTimeframeFromMessage("this month"),
  },
  {
    id: "alias-swap-fees",
    query: "swap fees last 30 days",
    expectedTokens: ["swap"],
    expectedTimeframe: { lastNDays: 30 },
  },
  {
    id: "timeframe-wtd",
    query: "performance week to date",
    expectedTimeframe: () => inferTimeframeFromMessage("week to date"),
  },
  {
    id: "timeframe-mtd",
    query: "performance month to date",
    expectedTimeframe: () => inferTimeframeFromMessage("month to date"),
  },
  {
    id: "timeframe-ytd",
    query: "performance ytd",
    expectedTimeframe: () => inferTimeframeFromMessage("year to date"),
  },
  {
    id: "timeframe-last-quarter",
    query: "performance last quarter",
    expectedTimeframe: () => inferTimeframeFromMessage("last quarter"),
  },
  {
    id: "timeframe-today",
    query: "performance today",
    expectedTimeframe: () => inferTimeframeFromMessage("today"),
  },
  {
    id: "timeframe-yesterday",
    query: "performance yesterday",
    expectedTimeframe: () => inferTimeframeFromMessage("yesterday"),
  },
  {
    id: "timeframe-last-week",
    query: "performance last week",
    expectedTimeframe: () => inferTimeframeFromMessage("last week"),
  },
  {
    id: "timeframe-last-month",
    query: "performance last month",
    expectedTimeframe: () => inferTimeframeFromMessage("last month"),
  },
  {
    id: "timeframe-since-date",
    query: "performance since Jan 5 2024",
    expectedTimeframe: () => inferTimeframeFromMessage("since Jan 5 2024"),
  },
  {
    id: "timeframe-profitability-week",
    query: "most profitable assets this week",
    expectedTokens: ["profit"],
    expectedTimeframe: () => inferTimeframeFromMessage("this week"),
  },
  {
    id: "field-open-price",
    query: "show open price",
    expectedField: "openPrice",
  },
  {
    id: "field-close-price",
    query: "show close price",
    expectedField: "closePrice",
  },
  {
    id: "field-open-time",
    query: "show entry time",
    expectedField: "open",
  },
  {
    id: "field-close-time",
    query: "show exit time",
    expectedField: "close",
  },
  {
    id: "field-max-drawdown-semantic",
    query: "show max drawdown",
    expectedField: "maxDrawdown",
  },
  {
    id: "field-drawdown-semantic",
    query: "show drawdown",
    expectedField: "maxDrawdown",
  },
  {
    id: "field-trade-drawdown-semantic",
    query: "show trade drawdown",
    expectedField: "maePips",
  },
  {
    id: "field-planned-risk",
    query: "show planned risk",
    expectedField: "plannedRiskPips",
  },
  {
    id: "field-planned-target",
    query: "show planned target",
    expectedField: "plannedTargetPips",
  },
  {
    id: "field-post-exit-mpe",
    query: "show post exit mpe",
    expectedField: "mpeManipPE_R",
  },
  {
    id: "field-capture-efficiency",
    query: "show capture efficiency",
    expectedField: "rrCaptureEfficiency",
  },
  {
    id: "field-manip-efficiency",
    query: "show manip efficiency",
    expectedField: "manipRREfficiency",
  },
  {
    id: "field-exit-timing",
    query: "show exit timing",
    expectedField: "exitEfficiency",
  },
  {
    id: "field-post-exit-volatility",
    query: "show post exit volatility",
    expectedField: "rawSTDV_PE",
  },
  {
    id: "field-entry-slippage",
    query: "show entry slippage",
    expectedField: "entrySlippagePips",
  },
  {
    id: "field-exit-slippage",
    query: "show exit slippage",
    expectedField: "exitSlippagePips",
  },
  {
    id: "field-sl-modifications",
    query: "show sl modifications",
    expectedField: "slModCount",
  },
  {
    id: "field-tp-modifications",
    query: "show tp modifications",
    expectedField: "tpModCount",
  },
  {
    id: "field-partial-closes",
    query: "show partial closes",
    expectedField: "partialCloseCount",
  },
  {
    id: "field-trailing-stop",
    query: "show trailing stop",
    expectedField: "trailingStopDetected",
  },
  {
    id: "field-post-exit-time-peak",
    query: "show post exit time to peak",
    expectedField: "postExitPeakDurationSeconds",
  },
  {
    id: "field-entry-balance",
    query: "show entry balance",
    expectedField: "entryBalance",
  },
  {
    id: "field-entry-equity",
    query: "show entry equity",
    expectedField: "entryEquity",
  },
  {
    id: "field-entry-margin",
    query: "show entry margin",
    expectedField: "entryMargin",
  },
  {
    id: "field-free-margin",
    query: "show free margin",
    expectedField: "entryFreeMargin",
  },
  {
    id: "field-margin-level",
    query: "show margin level",
    expectedField: "entryMarginLevel",
  },
  {
    id: "field-edge-name",
    query: "show edge",
    expectedField: "edgeName",
  },
  {
    id: "field-compliance-status",
    query: "show compliance status",
    expectedField: "complianceStatus",
  },
  ...buildFieldTestCases(),
];

export type QueryTestResult = {
  id: string;
  query: string;
  normalized: string;
  pass: boolean;
  failures: string[];
};

export function evaluateQueryTestMatrix(): QueryTestResult[] {
  return QUERY_TEST_MATRIX.map((test) => {
    const normalized = normalizeUserMessage(test.query);
    const failures: string[] = [];

    if (test.expectedTokens && test.expectedTokens.length > 0) {
      const missing = test.expectedTokens.filter(
        (token) => !normalized.toLowerCase().includes(token.toLowerCase())
      );
      if (missing.length > 0) {
        failures.push(`missing tokens: ${missing.join(", ")}`);
      }
    }

    if (test.expectedField) {
      const field = findField(normalized);
      if (!field || field.key !== test.expectedField) {
        failures.push(
          `expected field ${test.expectedField}, got ${field?.key ?? "none"}`
        );
      }
    }

    if (test.expectedTimeframe) {
      const expected =
        typeof test.expectedTimeframe === "function"
          ? test.expectedTimeframe()
          : test.expectedTimeframe;
      const actual = inferTimeframeFromMessage(normalized);
      if (!timeframeMatches(expected, actual)) {
        failures.push(
          `timeframe mismatch (expected ${formatTimeframe(
            expected
          )}, got ${formatTimeframe(actual)})`
        );
      }
    }

    return {
      id: test.id,
      query: test.query,
      normalized,
      pass: failures.length === 0,
      failures,
    };
  });
}

function buildFieldTestCases(): QueryTestCase[] {
  return TRADE_FIELDS.flatMap((field) => {
    const cases: QueryTestCase[] = [];
    const labelQuery = `show ${field.label.toLowerCase()}`;
    cases.push({
      id: `field-${field.key}-label`,
      query: labelQuery,
      expectedField: field.key,
    });

    const synonym = field.synonyms.find(
      (syn) => syn.length > 2 && !syn.includes("/")
    );
    if (synonym) {
      cases.push({
        id: `field-${field.key}-syn`,
        query: `show ${synonym}`,
        expectedField: field.key,
      });
    }

    return cases.slice(0, 2);
  });
}

function timeframeMatches(
  expected: TradeQueryPlan["timeframe"] | null | undefined,
  actual: TradeQueryPlan["timeframe"] | null | undefined
): boolean {
  if (!expected && !actual) return true;
  if (!expected || !actual) return false;
  if (expected.lastNDays || actual.lastNDays) {
    return expected.lastNDays === actual.lastNDays;
  }
  if (expected.from || expected.to) {
    return expected.from === actual.from && expected.to === actual.to;
  }
  return true;
}

function formatTimeframe(
  timeframe: TradeQueryPlan["timeframe"] | null | undefined
): string {
  if (!timeframe) return "none";
  if (timeframe.lastNDays) return `lastNDays=${timeframe.lastNDays}`;
  if (timeframe.from || timeframe.to) {
    return `${timeframe.from ?? "?"}..${timeframe.to ?? "?"}`;
  }
  return "unknown";
}
