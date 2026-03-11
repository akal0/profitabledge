import { assembleAnswer } from "./answer-assembler";
import {
  detectAssistantDomain,
  maybeHandleSpecialistQuery,
  type AssistantPageContext,
} from "./assistant-specialists";
import type { CondensedProfile } from "./engine/types";
import type { TradeQueryPlan } from "./query-plan";
import { buildVizSpec } from "./visualization-registry";

type AssistantRegressionCase = {
  id: string;
  run: () => string[] | Promise<string[]>;
};

export type AssistantRegressionResult = {
  id: string;
  pass: boolean;
  failures: string[];
};

function buildRankingPlan(groupField: string): TradeQueryPlan {
  return {
    intent: "aggregate",
    filters: [],
    groupBy: [{ field: groupField }],
    aggregates: [{ fn: "sum", field: "profit", as: "total_profit" }],
    sort: { field: "total_profit", dir: "desc" },
    limit: 1,
    explanation: `Rank ${groupField} by profit`,
    vizType: "kpi_single",
    componentHint: "auto",
    displayMode: "singular",
    vizTitle: `Best ${groupField}`,
  };
}

function buildGroupedExecutionResult(
  groupField: string,
  groups: Array<Record<string, string | number>>
) {
  return {
    data: groups.slice(0, 1),
    meta: {
      rowCount: 42,
      groups,
      explanation: `Rank ${groupField} by profit`,
      filters: [],
      timeframe: "Last 30 days",
    },
  };
}

function expectDomain(
  message: string,
  expected: string,
  pageContext?: AssistantPageContext
): string[] {
  const actual = detectAssistantDomain(message, pageContext);
  return actual === expected
    ? []
    : [`domain ${actual ?? "null"} !== ${expected}`];
}

function buildDashboardContext() {
  const condensed: CondensedProfile = {
    winRate: 57.8,
    profitFactor: 2.42,
    expectancy: 69,
    totalTrades: 45,
    bestSessions: ["London", "New York"],
    worstSessions: ["Asia"],
    bestSymbols: ["AUDUSD", "USDJPY"],
    worstSymbols: ["EURUSD"],
    rrSweetSpot: "1.5 - 2.5",
    holdTimeSweetSpot: "15m - 45m",
    topEdges: ["Shorts in London"],
    topLeaks: ["Longs with RR 1.5-2.5"],
    leavingProfitOnTable: false,
    avgProfitLeftPips: 3.2,
    pctExitingTooEarly: 28,
    avgPostExitMove: 5.1,
    tradesWithPostExitData: 36,
    currentStreak: "2 win streak",
  };

  return {
    userId: "user_test",
    accountId: "account_test",
    condensed,
    fullProfile: {
      profile: {
        totalTrades: 45,
      },
      edges: [
        {
          label: "Short + London",
          winRate: 73,
          trades: 26,
          confidence: "high",
        },
      ],
      leaks: [
        {
          label: "Long + RR 1.5-2.5",
          winRate: 37,
          trades: 19,
          confidence: "moderate",
        },
      ],
    },
    coachingNudges: [
      {
        title: "Protect execution",
        message: "Keep size stable and avoid forcing marginal setups.",
      },
    ],
    sessionState: {
      isActive: true,
      tradeCount: 3,
      wins: 2,
      losses: 1,
      runningPnL: 182.5,
      currentStreak: {
        type: "win",
        count: 2,
      },
    },
  };
}

export const ASSISTANT_REGRESSION_SUITE: AssistantRegressionCase[] = [
  {
    id: "singular-symbol-ranking-uses-asset-visual",
    run: () => {
      const plan = buildRankingPlan("symbol");
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("symbol", [
          { symbol: "AUDUSD", total_profit: 1243.21 },
          { symbol: "USDJPY", total_profit: 1009.24 },
          { symbol: "XAUUSD", total_profit: 823.82 },
          { symbol: "GBPUSD", total_profit: 307.17 },
          { symbol: "EURUSD", total_profit: -279.23 },
        ])
      );

      const failures: string[] = [];
      if (viz.type !== "asset_profitability") {
        failures.push(`viz type ${viz.type} !== asset_profitability`);
      }
      if ((viz.data.rows || []).length < 5) {
        failures.push(`expected >= 5 rows, got ${(viz.data.rows || []).length}`);
      }
      return failures;
    },
  },
  {
    id: "singular-weekday-ranking-uses-weekday-visual",
    run: () => {
      const plan = buildRankingPlan("weekday");
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("weekday", [
          { weekday: "Monday", total_profit: 520 },
          { weekday: "Tuesday", total_profit: 410 },
          { weekday: "Wednesday", total_profit: 260 },
          { weekday: "Thursday", total_profit: 180 },
          { weekday: "Friday", total_profit: -90 },
        ])
      );

      const failures: string[] = [];
      if (viz.type !== "weekday_performance") {
        failures.push(`viz type ${viz.type} !== weekday_performance`);
      }
      if ((viz.data.rows || []).length < 5) {
        failures.push(`expected >= 5 rows, got ${(viz.data.rows || []).length}`);
      }
      return failures;
    },
  },
  {
    id: "singular-session-ranking-keeps-leaderboard-context",
    run: () => {
      const plan = buildRankingPlan("sessionTag");
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("sessionTag", [
          { sessionTag: "London", total_profit: 820 },
          { sessionTag: "New York", total_profit: 610 },
          { sessionTag: "Asia", total_profit: 120 },
          { sessionTag: "Sydney", total_profit: -55 },
        ])
      );

      const failures: string[] = [];
      if (viz.type !== "bar_chart") {
        failures.push(`viz type ${viz.type} !== bar_chart`);
      }
      if ((viz.data.rows || []).length < 4) {
        failures.push(`expected >= 4 rows, got ${(viz.data.rows || []).length}`);
      }
      return failures;
    },
  },
  {
    id: "singular-time-of-day-ranking-keeps-leaderboard-context",
    run: () => {
      const plan = buildRankingPlan("timeOfDay");
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("timeOfDay", [
          { timeOfDay: "London Open", total_profit: 770 },
          { timeOfDay: "New York Open", total_profit: 490 },
          { timeOfDay: "Asia", total_profit: 150 },
          { timeOfDay: "Lunch", total_profit: -45 },
        ])
      );

      const failures: string[] = [];
      if (viz.type !== "bar_chart") {
        failures.push(`viz type ${viz.type} !== bar_chart`);
      }
      if ((viz.data.rows || []).length < 4) {
        failures.push(`expected >= 4 rows, got ${(viz.data.rows || []).length}`);
      }
      return failures;
    },
  },
  {
    id: "singular-month-ranking-uses-area-history",
    run: () => {
      const plan = buildRankingPlan("month");
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("month", [
          { month: "2025-11", total_profit: 300 },
          { month: "2025-12", total_profit: 480 },
          { month: "2026-01", total_profit: 520 },
          { month: "2026-02", total_profit: -80 },
        ])
      );

      const failures: string[] = [];
      if (viz.type !== "area_chart") {
        failures.push(`viz type ${viz.type} !== area_chart`);
      }
      if ((viz.data.rows || []).length !== 4) {
        failures.push(`expected 4 rows, got ${(viz.data.rows || []).length}`);
      }
      return failures;
    },
  },
  {
    id: "time-series-singular-does-not-expand-into-ranking",
    run: () => {
      const plan: TradeQueryPlan = {
        intent: "aggregate",
        filters: [],
        groupBy: [{ field: "open" }],
        aggregates: [{ fn: "sum", field: "profit", as: "daily_profit" }],
        sort: { field: "daily_profit", dir: "desc" },
        limit: 1,
        explanation: "Daily profit",
        vizType: "kpi_single",
        componentHint: "auto",
        displayMode: "singular",
        vizTitle: "Best day",
      };
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("open", [
          { open: "2026-03-01", daily_profit: 100 },
          { open: "2026-03-02", daily_profit: 80 },
          { open: "2026-03-03", daily_profit: -30 },
        ])
      );

      const failures: string[] = [];
      if (viz.type !== "daily_pnl") {
        failures.push(`viz type ${viz.type} !== daily_pnl`);
      }
      if ((viz.data.rows || []).length !== 3) {
        failures.push(`expected 3 rows, got ${(viz.data.rows || []).length}`);
      }
      return failures;
    },
  },
  {
    id: "singular-grouped-answer-includes-context",
    run: () => {
      const plan = buildRankingPlan("modelTag");
      const answer = assembleAnswer(
        {
          success: true,
          data: [{ modelTag: "Breaker", total_profit: 900 }],
          meta: {
            rowCount: 37,
            groups: [
              { modelTag: "Breaker", total_profit: 900 },
              { modelTag: "Sweep", total_profit: 650 },
              { modelTag: "Pullback", total_profit: 420 },
              { modelTag: "Continuation", total_profit: 150 },
            ],
            explanation: "Rank setups by total profit",
            filters: [],
            timeframe: "Last 30 days",
          },
        },
        plan
      );

      const failures: string[] = [];
      if (!answer.markdown.includes("### Context")) {
        failures.push("missing context section");
      }
      if (!answer.markdown.includes("Sweep")) {
        failures.push("missing runner-up detail");
      }
      return failures;
    },
  },
  {
    id: "singular-time-of-day-answer-includes-context",
    run: () => {
      const plan = buildRankingPlan("timeOfDay");
      const answer = assembleAnswer(
        {
          success: true,
          data: [{ timeOfDay: "London Open", total_profit: 770 }],
          meta: {
            rowCount: 44,
            groups: [
              { timeOfDay: "London Open", total_profit: 770 },
              { timeOfDay: "New York Open", total_profit: 490 },
              { timeOfDay: "Asia", total_profit: 150 },
              { timeOfDay: "Lunch", total_profit: -45 },
            ],
            explanation: "Rank time of day by total profit",
            filters: [],
            timeframe: "Last 30 days",
          },
        },
        plan
      );

      const failures: string[] = [];
      if (!answer.markdown.includes("### Context")) {
        failures.push("missing context section");
      }
      if (!answer.markdown.includes("New York Open")) {
        failures.push("missing runner-up detail");
      }
      return failures;
    },
  },
  {
    id: "leak-query-routes-to-dashboard-domain",
    run: () =>
      expectDomain("Where am I leaking money?", "dashboard", {
        surface: "assistant",
      }),
  },
  {
    id: "costing-query-routes-to-dashboard-domain",
    run: () =>
      expectDomain("What's costing me the most right now?", "dashboard", {
        surface: "assistant",
      }),
  },
  {
    id: "bleeding-query-routes-to-dashboard-domain",
    run: () =>
      expectDomain("Where am I bleeding money?", "dashboard", {
        surface: "assistant",
      }),
  },
  {
    id: "dashboard-surface-summary-routes-to-dashboard",
    run: () =>
      expectDomain("What matters most here?", "dashboard", {
        surface: "dashboard",
      }),
  },
  {
    id: "journal-surface-summary-routes-to-journal",
    run: () =>
      expectDomain("What stands out here?", "journal", {
        surface: "journal",
      }),
  },
  {
    id: "backtest-surface-summary-routes-to-backtest",
    run: () =>
      expectDomain("What stands out here?", "backtest", {
        surface: "backtest",
      }),
  },
  {
    id: "prop-surface-summary-routes-to-prop",
    run: () =>
      expectDomain("What matters most here?", "prop", {
        surface: "prop-tracker",
      }),
  },
  {
    id: "psychology-surface-summary-routes-to-psychology",
    run: () =>
      expectDomain("What stands out here?", "psychology", {
        surface: "psychology",
      }),
  },
  {
    id: "journal-query-routes-to-journal-domain",
    run: () =>
      expectDomain("What did I learn in my journal lately?", "journal", {
        surface: "assistant",
      }),
  },
  {
    id: "backtest-query-routes-to-backtest-domain",
    run: () =>
      expectDomain("Compare my backtest sessions to live results", "backtest", {
        surface: "assistant",
      }),
  },
  {
    id: "prop-query-routes-to-prop-domain",
    run: () =>
      expectDomain("Am I close to failing my prop challenge?", "prop", {
        surface: "assistant",
      }),
  },
  {
    id: "prop-risk-query-with-right-now-routes-to-prop-domain",
    run: () =>
      expectDomain("Am I near my daily loss limit right now?", "prop", {
        surface: "assistant",
      }),
  },
  {
    id: "psychology-query-routes-to-psychology-domain",
    run: () =>
      expectDomain("Am I revenge trading lately?", "psychology", {
        surface: "assistant",
      }),
  },
  {
    id: "unsupported-live-market-query-fails-safely",
    run: () =>
      expectDomain("What's the live price of EURUSD right now?", "unsupported", {
        surface: "assistant",
      }),
  },
  {
    id: "unsupported-news-query-fails-safely",
    run: () =>
      expectDomain("Any FOMC news today?", "unsupported", {
        surface: "assistant",
      }),
  },
  {
    id: "unsupported-signal-query-fails-safely",
    run: () =>
      expectDomain("Should I buy gold right now?", "unsupported", {
        surface: "assistant",
      }),
  },
  {
    id: "focused-dashboard-widget-query-routes-to-dashboard",
    run: () =>
      expectDomain("Explain this widget", "dashboard", {
        surface: "dashboard",
        focusedWidgetId: "edge-summary",
      }),
  },
  {
    id: "unsupported-specialist-payload-shape",
    run: async () => {
      const result = await maybeHandleSpecialistQuery("What's the live price of EURUSD right now?", {
        userId: "user_test",
        accountId: "account_test",
        pageContext: { surface: "assistant" },
      });

      const failures: string[] = [];
      if (!result.handled || result.domain !== "unsupported") {
        failures.push(`unexpected result ${result.domain ?? "null"}`);
      }
      if (!result.analysisBlocks?.some((block: any) => block.type === "callout")) {
        failures.push("missing unsupported callout block");
      }
      return failures;
    },
  },
  {
    id: "psychology-specialist-payload-shape",
    run: async () => {
      const result = await maybeHandleSpecialistQuery("Am I revenge trading lately?", {
        userId: "user_test",
        accountId: "account_test",
        pageContext: { surface: "assistant" },
        tiltStatus: {
          level: "elevated",
          tiltScore: 46,
          indicators: [{ label: "Revenge impulse" }, { label: "Overtrading risk" }],
        },
        mentalScore: {
          totalScore: 61,
        },
      });

      const failures: string[] = [];
      if (!result.handled || result.domain !== "psychology") {
        failures.push(`unexpected result ${result.domain ?? "null"}`);
      }
      if (!result.analysisBlocks?.some((block: any) => block.type === "tiltStatus")) {
        failures.push("missing tiltStatus block");
      }
      if (!result.message?.includes("Tilt status:")) {
        failures.push("missing psychology summary text");
      }
      return failures;
    },
  },
  {
    id: "session-specialist-payload-shape",
    run: async () => {
      const result = await maybeHandleSpecialistQuery("How's this session going?", {
        userId: "user_test",
        accountId: "account_test",
        pageContext: { surface: "assistant" },
        sessionState: {
          isActive: true,
          tradeCount: 4,
          wins: 3,
          losses: 1,
          runningPnL: 240.75,
          currentStreak: {
            type: "win",
            count: 2,
          },
        },
        coachingNudges: [
          {
            title: "Stay selective",
            message: "Only take A-grade continuation setups.",
          },
        ],
      });

      const failures: string[] = [];
      if (!result.handled || result.domain !== "session") {
        failures.push(`unexpected result ${result.domain ?? "null"}`);
      }
      if (!result.analysisBlocks?.some((block: any) => block.type === "sessionCoaching")) {
        failures.push("missing sessionCoaching block");
      }
      if (!result.message?.includes("Current session:")) {
        failures.push("missing session summary text");
      }
      return failures;
    },
  },
  {
    id: "dashboard-specialist-payload-shape",
    run: async () => {
      const result = await maybeHandleSpecialistQuery(
        "Explain this widget",
        {
          ...buildDashboardContext(),
          pageContext: {
            surface: "dashboard",
            accountScope: "all",
            focusedWidgetId: "edge-summary",
            dashboardWidgetIds: ["edge-summary", "benchmark"],
            dashboardChartWidgetIds: ["daily-net"],
          },
        }
      );

      const failures: string[] = [];
      if (!result.handled || result.domain !== "dashboard") {
        failures.push(`unexpected result ${result.domain ?? "null"}`);
      }
      const blockTypes = (result.analysisBlocks || []).map((block: any) => block.type);
      if (!blockTypes.includes("stats")) {
        failures.push("missing stats block");
      }
      if (!blockTypes.includes("edgeConditions")) {
        failures.push("missing edgeConditions block");
      }
      if (!blockTypes.includes("recommendations")) {
        failures.push("missing recommendations block");
      }
      if (!result.message?.includes("Dashboard readout:")) {
        failures.push("missing dashboard summary text");
      }
      return failures;
    },
  },
];

export async function evaluateAssistantRegressions(): Promise<AssistantRegressionResult[]> {
  const results: AssistantRegressionResult[] = [];

  for (const testCase of ASSISTANT_REGRESSION_SUITE) {
    const failures = await testCase.run();
    results.push({
      id: testCase.id,
      pass: failures.length === 0,
      failures,
    });
  }

  return results;
}
