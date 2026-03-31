import type {
  Aggregate,
  Filter,
  TradeQueryPlan,
} from "./query-plan";
import { inferTimeframeFromMessage } from "./query-normalization";

type GroupField =
  | "symbol"
  | "tradeType"
  | "sessionTag"
  | "edgeName"
  | "modelTag"
  | "protocolAlignment"
  | "outcome"
  | "complianceStatus"
  | "weekday"
  | "month"
  | "quarter"
  | "year"
  | "timeOfDay"
  | "hour"
  | "stdvBucket";

type MetricDefinition = {
  aggregates: Aggregate[];
  componentHint?: TradeQueryPlan["componentHint"];
  vizType?: TradeQueryPlan["vizType"];
  baseTitle: string;
  sortField?: string;
  defaultSortDir?: "asc" | "desc";
  recognized?: boolean;
};

const GROUP_FIELD_RULES: Array<{ field: GroupField; test: RegExp }> = [
  {
    field: "symbol",
    test:
      /\b(symbol|symbols|pair|pairs|asset|assets|instrument|instruments|ticker|tickers|gold|forex|eurusd|gbpusd|usdjpy|xauusd|xagusd|btcusd|ethusd|jpy pairs?)\b/i,
  },
  {
    field: "sessionTag",
    test: /\b(session|sessions|london|new york|ny\b|asia|asian|sydney)\b/i,
  },
  {
    field: "tradeType",
    test: /\b(direction|directions|long|longs|short|shorts|buy|sell)\b/i,
  },
  {
    field: "edgeName",
    test: /\b(edge|edges)\b/i,
  },
  {
    field: "modelTag",
    test:
      /\b(setup|setups|strategy|strategies|model|models|tagged setups|pattern|patterns|condition|conditions)\b/i,
  },
  {
    field: "protocolAlignment",
    test:
      /\b(protocol|aligned|discretionary|against protocol|non aligned|non-aligned)\b/i,
  },
  {
    field: "outcome",
    test:
      /\b(outcome|outcomes|winner|winners|loser|losers|breakeven|break-even|partial win|partial wins)\b/i,
  },
  {
    field: "complianceStatus",
    test:
      /\b(compliance|rule pass|rule fail|passed compliance|failed compliance|compliance failures?)\b/i,
  },
  {
    field: "weekday",
    test: /\b(day of week|weekday|weekdays|monday|tuesday|wednesday|thursday|friday)\b/i,
  },
  {
    field: "month",
    test:
      /\b(best|worst|most|least)\s+months?\b|\bby month\b|\bper month\b|\bmonthly\b/i,
  },
  {
    field: "quarter",
    test:
      /\b(best|worst|most|least)\s+quarters?\b|\bby quarter\b|\bper quarter\b|\bquarterly\b/i,
  },
  {
    field: "year",
    test:
      /\b(best|worst|most|least)\s+years?\b|\bby year\b|\bper year\b|\byearly\b|\bannually\b/i,
  },
  {
    field: "timeOfDay",
    test:
      /\b(time of day|times of day|morning|afternoon|evening|night|market close|market open)\b/i,
  },
  {
    field: "hour",
    test: /\b(hour|open time|entry time|time between trades|too quickly)\b/i,
  },
  {
    field: "stdvBucket",
    test: /\b(volatility|stdv|high-vol|low-vol|high vol|low vol)\b/i,
  },
];

const SESSION_VALUES = [
  { match: /\bnew york\b|\bny\b/i, value: "New York" },
  { match: /\blondon\b/i, value: "London" },
  { match: /\basia\b|\basian\b/i, value: "Asia" },
  { match: /\bsydney\b/i, value: "Sydney" },
];

const SYMBOL_ALIASES = [
  { match: /\bgold\b|\bxauusd\b|\bxau\b/i, value: "XAU" },
  { match: /\bsilver\b|\bxagusd\b|\bxag\b/i, value: "XAG" },
  { match: /\bjpy pairs?\b/i, value: "JPY" },
];

const IGNORED_SYMBOL_TOKENS = new Set([
  "AND",
  "THE",
  "LONDON",
  "ASIA",
  "SHORT",
  "SHORTS",
  "LONG",
  "LONGS",
  "EDGE",
  "EDGES",
  "PROFIT",
  "SESSION",
  "OUTCOME",
  "WIN",
  "LOSS",
  "BE",
  "PW",
  "TP",
  "SL",
  "MFE",
  "MAE",
  "RR",
  "STDV",
]);

function aggregate(
  fn: Aggregate["fn"],
  field: string,
  as: string
): Aggregate {
  return { fn, field, as };
}

function computed(field: string, as: string): Aggregate {
  return { fn: "avg", field, as };
}

function buildMetricDefinition(lower: string): MetricDefinition {
  if (
    lower.includes("positive win rate") &&
    lower.includes("negative expectancy")
  ) {
    return {
      aggregates: [computed("winRate", "win_rate"), computed("expectancy", "expectancy")],
      baseTitle: "Win rate vs expectancy",
      vizType: "breakdown_table",
      recognized: true,
    };
  }

  if (
    (lower.includes("capture efficiency") || lower.includes("leaving")) &&
    lower.includes("exit efficiency")
  ) {
    return {
      aggregates: [
        aggregate("avg", "rrCaptureEfficiency", "avg_capture_efficiency"),
        aggregate("avg", "exitEfficiency", "avg_exit_efficiency"),
        ],
        baseTitle: "Capture vs exit efficiency",
        vizType: "breakdown_table",
        recognized: true,
      };
  }

  if (lower.includes("mfe") && lower.includes("mae")) {
    return {
      aggregates: [
        aggregate("avg", "mfePips", "avg_mfe"),
        aggregate("avg", "maePips", "avg_mae"),
      ],
      baseTitle: "MFE vs MAE",
      vizType: "breakdown_table",
      recognized: true,
    };
  }

  if (
    lower.includes("planned rr") &&
    (lower.includes("realised rr") || lower.includes("realized rr"))
  ) {
    return {
      aggregates: [
        aggregate("avg", "plannedRR", "avg_planned_rr"),
        aggregate("avg", "realisedRR", "avg_realised_rr"),
        ],
        baseTitle: "Planned vs realised R:R",
        vizType: "breakdown_table",
        recognized: true,
      };
  }

  if (
    lower.includes("max rr") &&
    (lower.includes("realised rr") || lower.includes("realized rr"))
  ) {
    return {
      aggregates: [
        aggregate("avg", "maxRR", "avg_max_rr"),
        aggregate("avg", "realisedRR", "avg_realised_rr"),
        ],
        baseTitle: "Max vs realised R:R",
        vizType: "breakdown_table",
        recognized: true,
      };
  }

  if (lower.includes("estimated mpe") || lower.includes("weighted mpe")) {
    if (
      lower.includes("planned rr") &&
      (lower.includes("realised rr") || lower.includes("realized rr"))
    ) {
      return {
        aggregates: [
          aggregate("avg", "estimatedWeightedMPE_R", "avg_estimated_mpe"),
          aggregate("avg", "plannedRR", "avg_planned_rr"),
          aggregate("avg", "realisedRR", "avg_realised_rr"),
        ],
        baseTitle: "Estimated MPE vs planned vs realised R:R",
        vizType: "breakdown_table",
        recognized: true,
      };
    }

    return {
      aggregates: [aggregate("avg", "estimatedWeightedMPE_R", "avg_estimated_mpe")],
      baseTitle: "Estimated weighted MPE",
      recognized: true,
    };
  }

  if (lower.includes("win rate")) {
    return {
      aggregates: [computed("winRate", "win_rate")],
      componentHint: "win-rate",
      vizType: "win_rate_card",
      baseTitle: "Win rate",
      sortField: "win_rate",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("profit factor")) {
    return {
      aggregates: [computed("profitFactor", "profit_factor")],
      componentHint: "profit-factor",
      baseTitle: "Profit factor",
      sortField: "profit_factor",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("expectancy")) {
    return {
      aggregates: [computed("expectancy", "expectancy")],
      baseTitle: "Expectancy",
      sortField: "expectancy",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    lower.includes("average win size") ||
    lower.includes("average win")
  ) {
    return {
      aggregates: [computed("avgWin", "avg_win")],
      baseTitle: "Average win",
      sortField: "avg_win",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    lower.includes("average loss size") ||
    lower.includes("average loss")
  ) {
    return {
      aggregates: [computed("avgLoss", "avg_loss")],
      baseTitle: "Average loss",
      sortField: "avg_loss",
      defaultSortDir: "asc",
      recognized: true,
    };
  }

  if (lower.includes("hold time") || lower.includes("holding") || lower.includes("hold")) {
    return {
      aggregates: [aggregate("avg", "tradeDurationSeconds", "average_hold_time")],
      componentHint: "hold-time",
      baseTitle: "Average hold time",
      sortField: "average_hold_time",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(average|avg)\b.*\b(entry time|open time|entry hour|open hour)\b/i.test(
      lower
    ) ||
    /\b(entry time|open time|entry hour|open hour)\b.*\b(average|avg)\b/i.test(
      lower
    )
  ) {
    return {
      aggregates: [aggregate("avg", "hour", "avg_entry_hour")],
      baseTitle: "Average entry time",
      sortField: "avg_entry_hour",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("realised rr") || lower.includes("realized rr") || lower.includes("average r")) {
    return {
      aggregates: [aggregate("avg", "realisedRR", "avg_realised_rr")],
      componentHint: "average-rr",
      baseTitle: "Average realised R:R",
      sortField: "avg_realised_rr",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("planned rr")) {
    return {
      aggregates: [aggregate("avg", "plannedRR", "avg_planned_rr")],
      componentHint: "average-rr",
      baseTitle: "Average planned R:R",
      sortField: "avg_planned_rr",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("max rr")) {
    return {
      aggregates: [aggregate("avg", "maxRR", "avg_max_rr")],
      componentHint: "average-rr",
      baseTitle: "Average max R:R",
      sortField: "avg_max_rr",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("capture efficiency")) {
    return {
      aggregates: [
        aggregate("avg", "rrCaptureEfficiency", "avg_capture_efficiency"),
      ],
      baseTitle: "Capture efficiency",
      sortField: "avg_capture_efficiency",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("exit efficiency")) {
    return {
      aggregates: [aggregate("avg", "exitEfficiency", "avg_exit_efficiency")],
      baseTitle: "Exit efficiency",
      sortField: "avg_exit_efficiency",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("mfe")) {
    return {
      aggregates: [aggregate("avg", "mfePips", "avg_mfe")],
      baseTitle: "Average MFE",
      sortField: "avg_mfe",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("max drawdown")) {
    return {
      aggregates: [computed("maxDrawdown", "max_drawdown")],
      baseTitle: "Maximum drawdown",
      recognized: true,
    };
  }

  if (
    lower.includes("mae") ||
    lower.includes("trade drawdown") ||
    lower.includes("average drawdown")
  ) {
    return {
      aggregates: [aggregate("avg", "maePips", "avg_mae")],
      baseTitle: "Average MAE",
      sortField: "avg_mae",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("commission") && lower.includes("swap")) {
    return {
      aggregates: [
        aggregate("sum", "commissions", "total_commission"),
        aggregate("sum", "swap", "total_swap"),
      ],
      baseTitle: "Trading costs",
      vizType: "kpi_grid",
      recognized: true,
    };
  }

  if (lower.includes("commission")) {
    const average = lower.includes("average");
    return {
      aggregates: [
        aggregate(average ? "avg" : "sum", "commissions", average ? "avg_commission" : "total_commission"),
      ],
      baseTitle: average ? "Average commission" : "Total commission",
      sortField: average ? "avg_commission" : "total_commission",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("swap")) {
    const average = lower.includes("average");
    return {
      aggregates: [
        aggregate(average ? "avg" : "sum", "swap", average ? "avg_swap" : "total_swap"),
      ],
      baseTitle: average ? "Average swap" : "Total swap",
      sortField: average ? "avg_swap" : "total_swap",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("spread")) {
    return {
      aggregates: [aggregate("avg", "entrySpreadPips", "avg_entry_spread")],
      baseTitle: "Average entry spread",
      sortField: "avg_entry_spread",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("slippage")) {
    if (lower.includes("entry") && lower.includes("exit")) {
      return {
        aggregates: [
          aggregate("avg", "entrySlippagePips", "avg_entry_slippage"),
          aggregate("avg", "exitSlippagePips", "avg_exit_slippage"),
        ],
        baseTitle: "Entry vs exit slippage",
        vizType: "breakdown_table",
        recognized: true,
      };
    }

    return {
      aggregates: [aggregate("avg", "entrySlippagePips", "avg_entry_slippage")],
      baseTitle: "Average slippage",
      sortField: "avg_entry_slippage",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(lot size|position size|trade size|volume|volumes|largest size|biggest size|overexposed|risking)\b/i.test(
      lower
    )
  ) {
    const useSum =
      lower.includes("overexposed") ||
      lower.includes("risking") ||
      lower.includes("largest");
    return {
      aggregates: [
        aggregate(useSum ? "sum" : "avg", "volume", useSum ? "total_volume" : "avg_volume"),
      ],
      baseTitle: useSum ? "Total volume" : "Average volume",
      sortField: useSum ? "total_volume" : "avg_volume",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("trade count") || lower.includes("how many") || lower.includes("more trades") || lower.includes("overtrading")) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "trade_counts",
      baseTitle: "Trade count",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(compliance|compliance status)\b/i.test(lower) &&
    !/\bpass(ed|ing)?\b|\bfail(ed|ure|ing)?\b|\bpartial compliance\b/i.test(lower)
  ) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "bar_chart",
      baseTitle: "Compliance status",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\btrailing stop\b/i.test(lower) &&
    /\b(usage|frequency|how often|count|used|use)\b/i.test(lower)
  ) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "kpi_single",
      baseTitle: "Trailing stop usage",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(partial close|partial closes|partials|scale outs?)\b/i.test(lower) &&
    /\b(usage|frequency|how often|count|used|use)\b/i.test(lower)
  ) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "kpi_single",
      baseTitle: "Partial close usage",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(sl modifications?|move my sl|modify sl|widen sl)\b/i.test(lower) &&
    /\b(usage|frequency|how often|count|used|use)\b/i.test(lower)
  ) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "kpi_single",
      baseTitle: "Stop loss modification usage",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(tp modifications?|modify tp)\b/i.test(lower) &&
    /\b(usage|frequency|how often|count|used|use)\b/i.test(lower)
  ) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "kpi_single",
      baseTitle: "Take profit modification usage",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (
    /\b(scale in|scaled in|scaling in)\b/i.test(lower) &&
    /\b(usage|frequency|how often|count|used|use)\b/i.test(lower)
  ) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "kpi_single",
      baseTitle: "Scale in usage",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("most") && lower.includes("trades")) {
    return {
      aggregates: [aggregate("count", "id", "trade_count")],
      componentHint: "trade-counts",
      vizType: "trade_counts",
      baseTitle: "Trade count",
      sortField: "trade_count",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("balance")) {
    return {
      aggregates: [aggregate("avg", "entryBalance", "avg_entry_balance")],
      baseTitle: "Average entry balance",
      sortField: "avg_entry_balance",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("equity")) {
    return {
      aggregates: [aggregate("avg", "entryEquity", "avg_entry_equity")],
      baseTitle: "Average entry equity",
      sortField: "avg_entry_equity",
      defaultSortDir: "desc",
      recognized: true,
    };
  }

  if (lower.includes("margin level")) {
    return {
      aggregates: [aggregate("avg", "entryMarginLevel", "avg_margin_level")],
      baseTitle: "Average margin level",
      sortField: "avg_margin_level",
      defaultSortDir: "asc",
      recognized: true,
    };
  }

  if (lower.includes("free margin")) {
    return {
      aggregates: [aggregate("avg", "entryFreeMargin", "avg_free_margin")],
      baseTitle: "Average free margin",
      sortField: "avg_free_margin",
      defaultSortDir: "asc",
      recognized: true,
    };
  }

  if (
    /\b(leak|leaks|leaking|costing me|bleeding|hurting|weakening|underperforming)\b/i.test(
      lower
    )
  ) {
    return {
      aggregates: [aggregate("sum", "profit", "total_profit")],
      baseTitle: "Biggest leak",
      sortField: "total_profit",
      defaultSortDir: "asc",
      recognized: true,
    };
  }

  return {
    aggregates: [aggregate("sum", "profit", "total_profit")],
    baseTitle: "Total profit",
    sortField: "total_profit",
    defaultSortDir: "desc",
    recognized: false,
  };
}

function detectGroupFields(lower: string): GroupField[] {
  const ordered: GroupField[] = [];

  for (const rule of GROUP_FIELD_RULES) {
    if (rule.test.test(lower) && !ordered.includes(rule.field)) {
      ordered.push(rule.field);
    }
  }

  return ordered;
}

function wantsConditionBundle(lower: string): boolean {
  return /\b(condition|conditions|combo|combos|combination|combinations|intersection|intersections)\b/i.test(
    lower
  );
}

function wantsProfileBreakdown(lower: string): boolean {
  return /\b(edge|edges|leak|leaks|leaking|costing me|bleeding|hurting|strength|strengths|weakness|weaknesses|doing well|doing wrong)\b/i.test(
    lower
  );
}

function detectSessionMentions(lower: string): string[] {
  return SESSION_VALUES.filter((entry) => entry.match.test(lower)).map(
    (entry) => entry.value
  );
}

function detectSymbolMentions(message: string): string[] {
  const symbols = new Set<string>();

  for (const alias of SYMBOL_ALIASES) {
    if (alias.match.test(message)) {
      symbols.add(alias.value);
    }
  }

  const rawTokens = message.match(/\b[A-Z]{5,10}\b/g) || [];
  rawTokens.forEach((token) => {
    if (!IGNORED_SYMBOL_TOKENS.has(token)) {
      symbols.add(token);
    }
  });

  return Array.from(symbols);
}

function detectRMultipleFilter(lower: string): Filter | null {
  const match = lower.match(/(\d+(?:\.\d+)?)\s*r\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

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

  return {
    field: "realisedRR",
    op,
    value,
  };
}

function detectFilters(message: string, lower: string): Filter[] {
  const filters: Filter[] = [];

  const sessions = detectSessionMentions(lower);
  if (sessions.length === 1) {
    filters.push({
      field: "sessionTag",
      op: "contains",
      value: sessions[0],
    });
  }

  const symbols = detectSymbolMentions(message);
  if (symbols.length === 1) {
    filters.push({
      field: "symbol",
      op: "contains",
      value: symbols[0],
    });
  }

  const mentionsLong = /\blong\b|\blongs\b|\bbuy\b/i.test(lower);
  const mentionsShort = /\bshort\b|\bshorts\b|\bsell\b/i.test(lower);
  if (mentionsLong !== mentionsShort) {
    filters.push({
      field: "tradeType",
      op: "eq",
      value: mentionsLong ? "long" : "short",
    });
  }

  const protocolValues = [
    /\baligned\b/i.test(lower) ? "aligned" : null,
    /\bagainst protocol\b|\bagainst\b/i.test(lower) ? "against" : null,
    /\bdiscretionary\b/i.test(lower) ? "discretionary" : null,
  ].filter((value): value is string => Boolean(value));
  if (protocolValues.length === 1) {
    filters.push({
      field: "protocolAlignment",
      op: "eq",
      value: protocolValues[0],
    });
  } else if (
    /\bnon aligned\b|\bnon-aligned\b|\bnon aligned trades?\b/i.test(lower)
  ) {
    filters.push({
      field: "protocolAlignment",
      op: "neq",
      value: "aligned",
    });
  }

  const complianceValues = [
    /\bcompliance pass(?:ing)?\b|\bpassed compliance\b|\bpass trades?\b/i.test(lower)
      ? "pass"
      : null,
    /\bcompliance fail(?:ure|ing)?\b|\bfailed compliance\b|\bfail trades?\b/i.test(lower)
      ? "fail"
      : null,
    /\bpartial compliance\b/i.test(lower) ? "partial" : null,
  ].filter((value): value is string => Boolean(value));
  if (complianceValues.length === 1) {
    filters.push({
      field: "complianceStatus",
      op: "eq",
      value: complianceValues[0],
    });
  }

  const outcomeValues = [
    /\bwinners?\b|\bwinning trades?\b/i.test(lower) ? "Win" : null,
    /\blosers?\b|\blosing trades?\b/i.test(lower) ? "Loss" : null,
    /\bbreakeven\b|\bbreak-even\b/i.test(lower) ? "BE" : null,
    /\bpartial wins?\b/i.test(lower) ? "PW" : null,
  ].filter((value): value is string => Boolean(value));
  if (outcomeValues.length === 1) {
    filters.push({
      field: "outcome",
      op: "eq",
      value: outcomeValues[0],
    });
  }

  if (/\btrailing stop\b/i.test(lower) && !/\bwith or without\b/i.test(lower)) {
    filters.push({
      field: "trailingStopDetected",
      op: "eq",
      value: true,
    });
  }

  if (
    /\bmove my sl\b|\bmodify sl\b|\bsl modifications?\b|\bwiden sl\b/i.test(
      lower
    )
  ) {
    filters.push({
      field: "slModCount",
      op: "gt",
      value: 0,
    });
  }

  if (/\bmodify tp\b|\btp modifications?\b/i.test(lower)) {
    filters.push({
      field: "tpModCount",
      op: "gt",
      value: 0,
    });
  }

  if (/\bpartial clos/i.test(lower) || /\bscaling out\b/i.test(lower)) {
    filters.push({
      field: "partialCloseCount",
      op: "gt",
      value: 0,
    });
  }

  if (/\bscale in\b|\bscaled in\b|\bscaling in\b/i.test(lower)) {
    filters.push({
      field: "scaleInCount",
      op: "gt",
      value: 0,
    });
  }

  const rMultipleFilter = detectRMultipleFilter(lower);
  if (rMultipleFilter) {
    filters.push(rMultipleFilter);
  }

  return dedupeFilters(filters);
}

function dedupeFilters(filters: Filter[]): Filter[] {
  const seen = new Set<string>();
  return filters.filter((filter) => {
    const key = `${filter.field}:${filter.op}:${JSON.stringify(filter.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRankingQuery(lower: string): boolean {
  return /\b(which|best|highest|top|most|worst|lowest|least|biggest|benefit most|should i avoid|should i stop|only profitable)\b/i.test(
    lower
  );
}

function hasExplicitPluralRanking(lower: string): boolean {
  return /\b(best|worst|most|least|top|bottom)\b.*\b(assets|symbols|pairs|sessions|setups|strategies|models|patterns|conditions|combos|combinations|edges|days|hours|months|quarters|years|trades|times of day)\b/i.test(
    lower
  );
}

function hasSingularRankingTarget(lower: string): boolean {
  return /\b(best|worst|most|least|highest|lowest|top|bottom)\b.*\b(asset|symbol|pair|session|setup|strategy|model|pattern|condition|combo|combination|edge|day|hour|month|quarter|year|trade|time of day)\b/i.test(
    lower
  );
}

function wantsAscending(lower: string): boolean {
  return /\b(worst|lowest|least|avoid|stop|lost|losing)\b/i.test(lower);
}

function determineDisplayMode(lower: string, grouped: boolean): TradeQueryPlan["displayMode"] {
  if (/\b(compare|vs|versus)\b/i.test(lower)) {
    return "plural";
  }
  if (!grouped) return "singular";
  if (hasExplicitPluralRanking(lower)) {
    return "plural";
  }
  if (
    /\bwhich\b/i.test(lower) &&
    /\b(highest|lowest|best|worst|most|least|top|bottom)\b/i.test(lower)
  ) {
    return "singular";
  }
  if (/\b(per|by|breakdown|combo|combination|compare|vs|versus|correlate)\b/i.test(lower)) {
    return "plural";
  }
  if (hasSingularRankingTarget(lower)) {
    return "singular";
  }
  if (isRankingQuery(lower)) {
    return /\b(which|what)\b/i.test(lower) && !/\b(top \d+|bottom \d+|best .+s|worst .+s)\b/i.test(lower)
      ? "singular"
      : "plural";
  }
  return "plural";
}

function determineLimit(lower: string, grouped: boolean): number | undefined {
  if (!grouped) return undefined;

  const topMatch = lower.match(/\btop\s+(\d+)\b/i);
  if (topMatch) return Number(topMatch[1]);

  const bottomMatch = lower.match(/\bbottom\s+(\d+)\b/i);
  if (bottomMatch) return Number(bottomMatch[1]);

  const singular = determineDisplayMode(lower, true) === "singular";
  if (singular) return 1;
  if (isRankingQuery(lower)) return 10;
  return undefined;
}

function chooseVizType(
  groupBy: GroupField[],
  metric: MetricDefinition,
  displayMode: TradeQueryPlan["displayMode"]
): TradeQueryPlan["vizType"] {
  if (groupBy.length === 0) {
    return metric.aggregates.length > 1 ? "kpi_grid" : "kpi_single";
  }

  if (metric.vizType && groupBy.length === 0) {
    return metric.vizType;
  }

  if (groupBy.length > 1 || metric.aggregates.length > 1) {
    return metric.aggregates.length > 1 ? "breakdown_table" : "bar_chart";
  }

  if (
    groupBy[0] === "symbol" &&
    metric.aggregates[0]?.field === "profit" &&
    metric.aggregates[0]?.fn === "sum"
  ) {
    return "asset_profitability";
  }

  if (groupBy[0] === "weekday") {
    return "weekday_performance";
  }

  if (groupBy[0] === "hour") {
    return "bar_chart";
  }

  if (groupBy[0] === "month") {
    return "area_chart";
  }

  if (groupBy[0] === "quarter") {
    return "bar_chart";
  }

  if (groupBy[0] === "year") {
    return "area_chart";
  }

  if (displayMode === "timeline") {
    return "daily_pnl";
  }

  return "bar_chart";
}

function chooseComponentHint(
  groupBy: GroupField[],
  metric: MetricDefinition,
  vizType: TradeQueryPlan["vizType"]
): TradeQueryPlan["componentHint"] {
  if (metric.componentHint && groupBy.length === 0) {
    return metric.componentHint;
  }
  if (vizType === "asset_profitability") return "performing-assets";
  if (vizType === "weekday_performance") return "performance-weekday";
  if (vizType === "daily_pnl") return "daily-net";
  if (vizType === "trade_counts") return "trade-counts";
  return "auto";
}

function buildExplanation(
  title: string,
  groupBy: GroupField[],
  filters: Filter[]
): string {
  const groupLabel =
    groupBy.length > 0 ? ` grouped by ${groupBy.join(", ")}` : "";
  const filterLabel =
    filters.length > 0
      ? ` with ${filters.map((filter) => filter.field).join(", ")} filters`
      : "";
  return `Calculate ${title.toLowerCase()}${groupLabel}${filterLabel}`.trim();
}

function isDailyPnlQuery(lower: string): boolean {
  return (
    /\bdaily\b/i.test(lower) &&
    /\b(p&l|pnl|profit|net)\b/i.test(lower) &&
    !/\b(by|per)\b/i.test(lower)
  );
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildDeterministicTradePlan(
  userMessage: string
): TradeQueryPlan | null {
  const lower = userMessage.toLowerCase();
  const timeframe = inferTimeframeFromMessage(userMessage) ?? undefined;
  const detectedGroups = detectGroupFields(lower);
  const filters = detectFilters(userMessage, lower);
  const fixedFields = new Set(filters.map((filter) => filter.field));
  const metric = buildMetricDefinition(lower);

  if (isDailyPnlQuery(lower)) {
    return {
      intent: "aggregate",
      timeframe,
      filters,
      groupBy: [{ field: "open" }],
      aggregates: [aggregate("sum", "profit", "daily_profit")],
      sort: { field: "open", dir: "asc" },
      explanation: "Calculate daily p&l over time",
      vizType: "daily_pnl",
      componentHint: "daily-net",
      displayMode: "timeline",
      vizTitle: "Daily P&L",
    };
  }

  const groupedConditionFields: GroupField[] =
    wantsConditionBundle(lower) ||
    (wantsProfileBreakdown(lower) &&
      detectedGroups.length === 0 &&
      (filters.length > 0 || Boolean(timeframe)))
    ? ["modelTag", "sessionTag", "tradeType", "protocolAlignment"]
    : [];

  const specificComboQuery =
    filters.length >= 2 &&
    !isRankingQuery(lower) &&
    !/\b(per|by|combo|combination|compare|vs|versus)\b/i.test(lower);

  if (
    /\bremoved every non aligned trade\b|\bremoved every non-aligned trade\b|\bwithout non aligned trades\b|\bwithout non-aligned trades\b/i.test(
      lower
    )
  ) {
    const alignedOnlyFilters = dedupeFilters([
      ...filters.filter((filter) => filter.field !== "protocolAlignment"),
      { field: "protocolAlignment", op: "eq", value: "aligned" } satisfies Filter,
    ]);

    return {
      intent: "aggregate",
      timeframe,
      filters: alignedOnlyFilters,
      aggregates: [aggregate("sum", "profit", "total_profit")],
      explanation: "Calculate total profit using only aligned trades",
      vizType: "kpi_single",
      componentHint: "auto",
      displayMode: "singular",
      vizTitle: "P&L without non-aligned trades",
    };
  }

  const groupCandidates = groupedConditionFields.length > 0
    ? [...detectedGroups, ...groupedConditionFields].filter(
        (field, index, all) => all.indexOf(field) === index
      )
    : detectedGroups;
  const suppressDetectedGroups =
    /\b(average|avg)\b.*\b(entry time|open time|entry hour|open hour)\b/i.test(
      lower
    ) ||
    /\b(entry time|open time|entry hour|open hour)\b.*\b(average|avg)\b/i.test(
      lower
    );
  let groupBy =
    specificComboQuery || suppressDetectedGroups
      ? []
      : groupCandidates.filter((field) => !fixedFields.has(field));
  if (
    groupBy.length === 0 &&
    !specificComboQuery &&
    !suppressDetectedGroups &&
    isRankingQuery(lower) &&
    detectedGroups.length > 0
  ) {
    groupBy = [...detectedGroups];
  }

  const grouped = groupBy.length > 0;
  const displayMode = determineDisplayMode(lower, grouped);
  const limit = determineLimit(lower, grouped);
  const vizType = chooseVizType(groupBy, metric, displayMode);
  const componentHint = chooseComponentHint(groupBy, metric, vizType);
  const sortField =
    metric.sortField || metric.aggregates[0]?.as || metric.aggregates[0]?.field;

  const shouldSort =
    grouped &&
    Boolean(sortField) &&
    (isRankingQuery(lower) || metric.aggregates.length === 1);

  const plan: TradeQueryPlan = {
    intent: "aggregate",
    timeframe,
    filters,
    groupBy: grouped ? groupBy.map((field) => ({ field })) : undefined,
    aggregates: metric.aggregates,
    sort:
      shouldSort && sortField
        ? {
            field: sortField,
            dir: wantsAscending(lower)
              ? "asc"
              : metric.defaultSortDir || "desc",
          }
        : undefined,
    limit,
    explanation: buildExplanation(metric.baseTitle, groupBy, filters),
    vizType,
    componentHint,
    displayMode,
    vizTitle: titleCase(metric.baseTitle),
  };

  if (!grouped && metric.aggregates.length === 1 && vizType === "kpi_single") {
    plan.displayMode = "singular";
  }

  if (
    grouped &&
    metric.aggregates.length === 1 &&
    plan.displayMode === "singular" &&
    !plan.limit
  ) {
    plan.limit = 1;
  }

  if (
    !grouped &&
    filters.length === 0 &&
    metric.aggregates.length === 1 &&
    !metric.recognized
  ) {
    return null;
  }

  if (
    grouped ||
    filters.length > 0 ||
    metric.aggregates.length > 1 ||
    metric.recognized ||
    /\b(win rate|profit factor|expectancy|max drawdown|hold time|realised rr|planned rr|max rr|commission|swap|spread|slippage|volume|balance|equity|margin|profit|p&l|pnl)\b/i.test(
      lower
    )
  ) {
    return plan;
  }

  return null;
}
