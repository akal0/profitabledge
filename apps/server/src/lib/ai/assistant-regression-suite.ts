import { assembleAnswer } from "./answer-assembler";
import {
  detectAssistantDomain,
  maybeHandleSpecialistQuery,
  type AssistantPageContext,
} from "./assistant-specialists";
import type { CondensedProfile } from "./engine/types";
import type { TradeQueryPlan } from "./query-plan";
import { buildVizSpec } from "./visualization-registry";
import { buildDeterministicTradePlan } from "./deterministic-plan-builder";
import { generatePlan } from "./plan-generator";
import {
  inferTimeframeFromMessage,
  isLowSignalAssistantQuery,
  isMetaRephraseRequest,
  shouldUseProfileSummaryShortcut,
} from "./query-normalization";

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

function expectNoDomain(
  message: string,
  pageContext?: AssistantPageContext
): string[] {
  const actual = detectAssistantDomain(message, pageContext);
  return actual === null ? [] : [`domain ${actual} !== null`];
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
    id: "deterministic-intersection-plan-groups-session-and-direction",
    run: () => {
      const plan = buildDeterministicTradePlan(
        "Which session-direction combo has my highest win rate?"
      );

      const failures: string[] = [];
      if (!plan) {
        failures.push("plan missing");
        return failures;
      }
      const groupFields = (plan.groupBy || []).map((group) => group.field);
      if (!groupFields.includes("sessionTag")) {
        failures.push("missing sessionTag group");
      }
      if (!groupFields.includes("tradeType")) {
        failures.push("missing tradeType group");
      }
      if (!plan.aggregates?.some((agg) => agg.field === "winRate")) {
        failures.push("missing winRate aggregate");
      }
      if (plan.limit !== 1) {
        failures.push(`limit ${plan.limit ?? "none"} !== 1`);
      }
      return failures;
    },
  },
  {
    id: "deterministic-edge-protocol-plan-filters-against-and-groups-edge",
    run: () => {
      const plan = buildDeterministicTradePlan(
        "Which Edge has the most against-protocol trades?"
      );

      const failures: string[] = [];
      if (!plan) {
        failures.push("plan missing");
        return failures;
      }
      const groupFields = (plan.groupBy || []).map((group) => group.field);
      if (!groupFields.includes("edgeName")) {
        failures.push("missing edgeName group");
      }
      if (
        !(plan.filters || []).some(
          (filter) =>
            filter.field === "protocolAlignment" &&
            filter.op === "eq" &&
            filter.value === "against"
        )
      ) {
        failures.push("missing against protocol filter");
      }
      if (!plan.aggregates?.some((agg) => agg.as === "trade_count")) {
        failures.push("missing trade_count aggregate");
      }
      return failures;
    },
  },
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
    id: "symbol-win-rate-ranking-uses-generic-chart",
    run: () => {
      const plan: TradeQueryPlan = {
        intent: "aggregate",
        filters: [],
        groupBy: [{ field: "symbol" }],
        aggregates: [{ fn: "avg", field: "winRate", as: "win_rate" }],
        sort: { field: "win_rate", dir: "desc" },
        limit: 1,
        explanation: "Rank symbol by win rate",
        vizType: "bar_chart",
        componentHint: "auto",
        displayMode: "singular",
        vizTitle: "Win rate by symbol",
      };
      const viz = buildVizSpec(
        plan,
        buildGroupedExecutionResult("symbol", [
          { symbol: "AUDUSD", win_rate: 68 },
          { symbol: "USDJPY", win_rate: 61 },
          { symbol: "EURUSD", win_rate: 47 },
        ])
      );

      const failures: string[] = [];
      if (viz.type === "asset_profitability") {
        failures.push("symbol win-rate query should not use asset_profitability");
      }
      if (viz.data.valueFormat !== "percent") {
        failures.push(`valueFormat ${viz.data.valueFormat ?? "none"} !== percent`);
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
    id: "multi-group-visualization-combines-labels",
    run: () => {
      const plan: TradeQueryPlan = {
        intent: "aggregate",
        filters: [],
        groupBy: [{ field: "sessionTag" }, { field: "tradeType" }],
        aggregates: [{ fn: "avg", field: "winRate", as: "win_rate" }],
        sort: { field: "win_rate", dir: "desc" },
        limit: 1,
        explanation: "Rank session and direction combos by win rate",
        vizType: "bar_chart",
        componentHint: "auto",
        displayMode: "singular",
        vizTitle: "Best session-direction combo",
      };
      const viz = buildVizSpec(plan, {
        data: [],
        meta: {
          rowCount: 36,
          groups: [
            { sessionTag: "London", tradeType: "short", win_rate: 68 },
            { sessionTag: "New York", tradeType: "long", win_rate: 61 },
          ],
          filters: [],
          timeframe: "Last 30 days",
        },
      });

      const failures: string[] = [];
      if (viz.type !== "bar_chart") {
        failures.push(`viz type ${viz.type} !== bar_chart`);
      }
      if ((viz.data.rows || [])[0]?.label !== "London / short") {
        failures.push(`unexpected top label ${(viz.data.rows || [])[0]?.label ?? "none"}`);
      }
      return failures;
    },
  },
  {
    id: "multi-group-answer-combines-labels",
    run: () => {
      const plan: TradeQueryPlan = {
        intent: "aggregate",
        filters: [],
        groupBy: [{ field: "sessionTag" }, { field: "tradeType" }],
        aggregates: [{ fn: "avg", field: "winRate", as: "win_rate" }],
        sort: { field: "win_rate", dir: "desc" },
        limit: 1,
        explanation: "Rank session and direction combos by win rate",
        vizType: "bar_chart",
        componentHint: "auto",
        displayMode: "singular",
        vizTitle: "Best session-direction combo",
      };
      const answer = assembleAnswer(
        {
          success: true,
          data: [],
          meta: {
            rowCount: 36,
            groups: [
              { sessionTag: "London", tradeType: "short", win_rate: 68 },
              { sessionTag: "New York", tradeType: "long", win_rate: 61 },
              { sessionTag: "Asia", tradeType: "long", win_rate: 42 },
            ],
            explanation: "Rank session and direction combos by win rate",
            filters: [],
            timeframe: "Last 30 days",
          },
        },
        plan
      );

      const failures: string[] = [];
      if (!answer.markdown.includes("London / short")) {
        failures.push("missing combined top label");
      }
      if (!answer.markdown.includes("New York / long")) {
        failures.push("missing combined runner-up label");
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
      expectNoDomain("Where am I leaking money?", {
        surface: "assistant",
      }),
  },
  {
    id: "costing-query-routes-to-dashboard-domain",
    run: () =>
      expectNoDomain("What's costing me the most right now?", {
        surface: "assistant",
      }),
  },
  {
    id: "bleeding-query-routes-to-dashboard-domain",
    run: () =>
      expectNoDomain("Where am I bleeding money?", {
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
    id: "assistant-boundary-queries-bypass-specialists",
    run: async () => {
      const failures: string[] = [];
      const cases = [
        "What was my average entry time?",
        "Which trade phase performs best?",
        "How many trades did I take today?",
        "What's my current streak?",
        "What should I focus on today?",
        "Give me an overview of my symbols this month",
      ];

      for (const message of cases) {
        const domain = detectAssistantDomain(message, {
          surface: "assistant",
          accountScope: "all",
        });
        if (domain !== null) {
          failures.push(`${message}: domain ${domain} should be null`);
        }

        const result = await maybeHandleSpecialistQuery(message, {
          ...buildDashboardContext(),
          pageContext: {
            surface: "assistant",
            accountScope: "all",
          },
        });
        if (result.handled) {
          failures.push(
            `${message}: specialist ${result.domain ?? "null"} should not pre-handle`
          );
        }
      }

      return failures;
    },
  },
  {
    id: "meta-rephrase-request-never-short-circuits-to-profile-summary",
    run: async () => {
      const message =
        "The user's request was not understood. providing a general overview of trading performance and recommendations based on the overall profile";
      const failures: string[] = [];

      if (!isMetaRephraseRequest(message)) {
        failures.push("meta rephrase guard not detected");
      }

      if (shouldUseProfileSummaryShortcut(message)) {
        failures.push("meta rephrase request should not use profile summary shortcut");
      }

      const result = await generatePlan(
        message,
        [],
        "account_test",
        buildDashboardContext().condensed
      );

      if (result.success || result.plan) {
        failures.push("meta rephrase request should not generate a plan");
      }

      return failures;
    },
  },
  {
    id: "low-signal-gibberish-request-never-generates-a-plan",
    run: async () => {
      const cases = ["erdqe32", "asdfgh", "???"];
      const failures: string[] = [];

      for (const message of cases) {
        if (!isLowSignalAssistantQuery(message)) {
          failures.push(`${message}: low-signal guard not detected`);
        }

        if (shouldUseProfileSummaryShortcut(message)) {
          failures.push(
            `${message}: low-signal request should not use profile summary shortcut`
          );
        }

        const result = await generatePlan(
          message,
          [],
          "account_test",
          buildDashboardContext().condensed
        );

        if (result.success || result.plan) {
          failures.push(`${message}: low-signal request should not generate a plan`);
        }
      }

      return failures;
    },
  },
  {
    id: "low-signal-gibberish-request-never-assembles-recommendation-sections",
    run: () => {
      const answer = assembleAnswer(
        {
          success: true,
          data: {
            improvements: [{ label: "Win rate", value: "90%" }],
            insights: ["Best session is London"],
            recommendations: ["Focus on London"],
          },
          meta: {
            rowCount: 120,
            explanation: "General overview",
            filters: [],
            timeframe: "Last 30 days",
            improvements: [{ label: "Win rate", value: "90%" }],
            insights: ["Best session is London"],
            recommendations: ["Focus on London"],
          },
        },
        {
          intent: "recommendation",
          filters: [],
          aggregates: [],
          explanation: "General overview",
          vizType: "text_answer",
          componentHint: "auto",
          displayMode: "singular",
          vizTitle: "Overview",
        },
        { userMessage: "sda9d" }
      );

      const failures: string[] = [];
      if (
        answer.markdown.trim() !==
        "I couldn't understand your request. Could you please rephrase it?"
      ) {
        failures.push("expected exact rephrase-only markdown");
      }
      if (
        answer.markdown.includes("Improvements") ||
        answer.markdown.includes("Insights") ||
        answer.markdown.includes("Recommendations") ||
        answer.markdown.includes("Sample size")
      ) {
        failures.push("unexpected recommendation sections leaked into fallback");
      }
      return failures;
    },
  },
  {
    id: "session-performance-queries-bypass-live-session-specialist",
    run: async () => {
      const failures: string[] = [];
      const cases = [
        "What's my best session?",
        "What's my most profitable session?",
        "What's my worst session?",
        "What's my least profitable session?",
      ];

      for (const message of cases) {
        const domain = detectAssistantDomain(message, {
          surface: "assistant",
          accountScope: "all",
        });
        if (domain !== null) {
          failures.push(`${message}: domain ${domain} should be null`);
        }

        const result = await maybeHandleSpecialistQuery(message, {
          ...buildDashboardContext(),
          pageContext: {
            surface: "assistant",
            accountScope: "all",
          },
        });
        if (result.handled) {
          failures.push(
            `${message}: specialist ${result.domain ?? "null"} should not pre-handle`
          );
        }
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
  {
    id: "broad-edge-query-short-circuits-to-profile-summary",
    run: async () => {
      const result = await generatePlan(
        "What's my edge?",
        [],
        "account_test",
        buildDashboardContext().condensed
      );

      const failures: string[] = [];
      if (!(result.success && (result.plan as any)?._profileSummary)) {
        failures.push("profile summary short-circuit not triggered");
      }

      return failures;
    },
  },
  {
    id: "broad-leak-query-short-circuits-to-profile-summary",
    run: async () => {
      const result = await generatePlan(
        "Where am I leaking money?",
        [],
        "account_test",
        buildDashboardContext().condensed
      );

      const failures: string[] = [];
      if (!(result.success && (result.plan as any)?._profileSummary)) {
        failures.push("profile summary short-circuit not triggered");
      }

      return failures;
    },
  },
  {
    id: "qualified-edge-query-keeps-qualifiers-out-of-profile-summary",
    run: async () => {
      const result = await generatePlan(
        "Which edge name has the highest win rate in London this month?",
        [],
        "account_test",
        buildDashboardContext().condensed
      );

      const failures: string[] = [];
      if (!result.success || !result.plan) {
        failures.push("plan missing");
        return failures;
      }
      if ((result.plan as any)?._profileSummary) {
        failures.push("unexpected profile summary short-circuit");
      }
      if (!result.plan.groupBy?.some((group) => group.field === "edgeName")) {
        failures.push("missing edgeName grouping");
      }
      if ((result.plan.groupBy?.length || 0) !== 1) {
        failures.push(
          `unexpected extra groupings: ${
            result.plan.groupBy?.map((group) => group.field).join(", ") || "none"
          }`
        );
      }
      if (
        !result.plan.filters?.some(
          (filter) =>
            filter.field === "sessionTag" &&
            filter.op === "contains" &&
            filter.value === "London"
        )
      ) {
        failures.push("missing London filter");
      }
      const expectedTimeframe = inferTimeframeFromMessage("this month");
      if (
        !result.plan.timeframe ||
        result.plan.timeframe.from !== expectedTimeframe?.from ||
        result.plan.timeframe.to !== expectedTimeframe?.to
      ) {
        failures.push("missing monthly timeframe");
      }

      return failures;
    },
  },
  {
    id: "qualified-leak-query-keeps-qualifiers-out-of-profile-summary",
    run: async () => {
      const result = await generatePlan(
        "Which session leaks the most in London this month?",
        [],
        "account_test",
        buildDashboardContext().condensed
      );

      const failures: string[] = [];
      if (!result.success || !result.plan) {
        failures.push("plan missing");
        return failures;
      }
      if ((result.plan as any)?._profileSummary) {
        failures.push("unexpected profile summary short-circuit");
      }
      if ((result.plan.groupBy?.length || 0) === 0) {
        failures.push("missing condition grouping");
      }
      if (
        !result.plan.filters?.some(
          (filter) =>
            filter.field === "sessionTag" &&
            filter.op === "contains" &&
            filter.value === "London"
        )
      ) {
        failures.push("missing London filter");
      }
      const expectedTimeframe = inferTimeframeFromMessage("this month");
      if (
        !result.plan.timeframe ||
        result.plan.timeframe.from !== expectedTimeframe?.from ||
        result.plan.timeframe.to !== expectedTimeframe?.to
      ) {
        failures.push("missing monthly timeframe");
      }

      return failures;
    },
  },
  {
    id: "empty-answer-returns-guardrail-copy",
    run: () => {
      const plan = buildRankingPlan("symbol");
      const answer = assembleAnswer(
        {
          success: true,
          data: [],
          meta: {
            rowCount: 0,
            explanation: "Total profit",
            aggregates: {
              total_profit: 0,
            },
            groups: [],
            filters: [],
            timeframe: "Last 30 days",
          },
        },
        plan
      );

      const failures: string[] = [];
      if (!answer.markdown.startsWith("### I need a bit more context")) {
        failures.push("missing guardrail heading");
      }
      if (!answer.markdown.includes("(n=0)")) {
        failures.push("missing empty sample size");
      }
      if (!answer.markdown.includes("take another pass")) {
        failures.push("missing follow-up prompt");
      }
      if (answer.markdown.includes("### Suggested follow-up")) {
        failures.push("unexpected follow-up section");
      }

      return failures;
    },
  },
  {
    id: "missing-aggregate-answer-returns-guardrail-copy",
    run: () => {
      const plan = buildRankingPlan("symbol");
      const answer = assembleAnswer(
        {
          success: true,
          data: [],
          meta: {
            rowCount: 4,
            explanation: "Total profit",
            aggregates: {
              total_profit: Number.NaN,
            },
            groups: [],
            filters: [],
            timeframe: "Last 30 days",
          },
        },
        plan
      );

      const failures: string[] = [];
      if (!answer.markdown.startsWith("### I need a bit more context")) {
        failures.push("missing guardrail heading");
      }
      if (!answer.markdown.includes("missing required fields for this metric")) {
        failures.push("missing guardrail reason");
      }
      if (!answer.markdown.includes("take another pass")) {
        failures.push("missing follow-up prompt");
      }
      if (answer.markdown.includes("### Suggested follow-up")) {
        failures.push("unexpected follow-up section");
      }

      return failures;
    },
  },
  {
    id: "edge-conditions-query-routes-to-summary-surface",
    run: async () => {
      const message = "Which conditions improve or weaken my edge?";
      const failures: string[] = [];

      const domain = detectAssistantDomain(message, {
        surface: "assistant",
        accountScope: "all",
      });
      if (domain !== null) {
        failures.push(`domain ${domain} !== null`);
      }

      const result = await maybeHandleSpecialistQuery(message, {
        ...buildDashboardContext(),
        pageContext: {
          surface: "assistant",
          accountScope: "all",
        },
      });
      if (result.handled) {
        failures.push(`specialist ${result.domain ?? "null"} should not pre-handle`);
      }

      const plan = await generatePlan(
        message,
        [],
        "account_test",
        buildDashboardContext().condensed
      );
      if (!(plan.success && (plan.plan as any)?._profileSummary)) {
        failures.push("profile summary short-circuit not triggered");
      }

      return failures;
    },
  },
  {
    id: "deterministic-count-query-captures-session-and-timeframe",
    run: () => {
      const plan = buildDeterministicTradePlan(
        "How many trades did I take in London last month?"
      );

      const failures: string[] = [];
      if (!plan) {
        failures.push("plan missing");
        return failures;
      }
      if (
        !plan.aggregates?.some(
          (agg) => agg.fn === "count" && agg.as === "trade_count"
        )
      ) {
        failures.push("missing trade_count aggregate");
      }
      if (plan.vizType !== "kpi_single") {
        failures.push(`viz type ${plan.vizType} !== kpi_single`);
      }
      const expectedTimeframe = inferTimeframeFromMessage("last month");
      if (
        !plan.timeframe ||
        plan.timeframe.from !== expectedTimeframe?.from ||
        plan.timeframe.to !== expectedTimeframe?.to
      ) {
        failures.push("missing monthly timeframe");
      }
      if (
        !plan.filters?.some(
          (filter) =>
            filter.field === "sessionTag" &&
            filter.op === "contains" &&
            filter.value === "London"
        )
      ) {
        failures.push("missing London filter");
      }

      return failures;
    },
  },
  {
    id: "average-entry-time-uses-derived-hour-metric",
    run: () => {
      const plan = buildDeterministicTradePlan("What was my average entry time?");
      const failures: string[] = [];

      if (!plan) {
        failures.push("plan missing");
        return failures;
      }
      if (plan.groupBy?.length) {
        failures.push("average entry time should not group by hour");
      }
      if (
        !plan.aggregates?.some(
          (agg) => agg.fn === "avg" && agg.field === "hour"
        )
      ) {
        failures.push("missing avg(hour) aggregate");
      }
      return failures;
    },
  },
  {
    id: "usage-frequency-queries-count-flagged-trades",
    run: () => {
      const cases = [
        {
          message: "What's my trailing stop usage?",
          expectedFilter: { field: "trailingStopDetected", op: "eq", value: true },
        },
        {
          message: "What's my partial close frequency?",
          expectedFilter: { field: "partialCloseCount", op: "gt", value: 0 },
        },
      ];

      const failures: string[] = [];
      for (const { message, expectedFilter } of cases) {
        const plan = buildDeterministicTradePlan(message);
        if (!plan) {
          failures.push(`${message}: plan missing`);
          continue;
        }
        if (
          !plan.aggregates?.some(
            (agg) => agg.fn === "count" && agg.field === "id"
          )
        ) {
          failures.push(`${message}: missing count(id) aggregate`);
        }
        if (
          !plan.filters?.some(
            (filter) =>
              filter.field === expectedFilter.field &&
              filter.op === expectedFilter.op &&
              filter.value === expectedFilter.value
          )
        ) {
          failures.push(`${message}: missing expected filter`);
        }
      }
      return failures;
    },
  },
  {
    id: "grouped-count-visualization-combines-labels",
    run: () => {
      const plan: TradeQueryPlan = {
        intent: "aggregate",
        filters: [],
        groupBy: [{ field: "sessionTag" }, { field: "tradeType" }],
        aggregates: [{ fn: "count", field: "id", as: "trade_count" }],
        sort: { field: "trade_count", dir: "desc" },
        limit: 2,
        explanation: "Rank session and direction combos by trade count",
        vizType: "bar_chart",
        componentHint: "auto",
        displayMode: "plural",
        vizTitle: "Trade count by combo",
      };
      const viz = buildVizSpec(plan, {
        data: [],
        meta: {
          rowCount: 18,
          groups: [
            { sessionTag: "London", tradeType: "long", trade_count: 9 },
            { sessionTag: "New York", tradeType: "short", trade_count: 6 },
          ],
          filters: [],
          timeframe: "Last 30 days",
        },
      });

      const failures: string[] = [];
      if (viz.type !== "bar_chart") {
        failures.push(`viz type ${viz.type} !== bar_chart`);
      }
      if ((viz.data.rows || [])[0]?.label !== "London / long") {
        failures.push(
          `unexpected top label ${(viz.data.rows || [])[0]?.label ?? "none"}`
        );
      }
      if ((viz.data.rows || [])[1]?.label !== "New York / short") {
        failures.push(
          `unexpected second label ${(viz.data.rows || [])[1]?.label ?? "none"}`
        );
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
