/**
 * Canonical Trade Field Registry
 *
 * Single source of truth for all trade fields.
 * Includes types, synonyms, aggregations, and filter operations.
 */

export type FieldType = "string" | "number" | "boolean" | "timestamp" | "enum";

export type AggregationFn =
  | "avg"
  | "sum"
  | "min"
  | "max"
  | "count"
  | "p50"
  | "p90";

export type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "between";

export type TradeField = {
  key: string; // canonical key used in DB
  label: string; // human-readable label
  type: FieldType;
  unit?: string; // pips, R, seconds, %, $
  description: string; // what it means
  synonyms: string[]; // phrases users will say
  aggregations?: AggregationFn[];
  filterOps?: FilterOp[];
};

/**
 * Complete field registry - all 74 trade fields
 */
export const TRADE_FIELDS: TradeField[] = [
  // ===== BASIC TRADE INFO =====
  {
    key: "symbol",
    label: "Symbol",
    type: "string",
    description: "Trading instrument (e.g., EURUSD, GBPUSD, XAUUSD)",
    synonyms: ["pair", "ticker", "instrument", "currency pair", "asset"],
    aggregations: ["count"],
    filterOps: ["eq", "in", "contains"],
  },
  {
    key: "tradeType",
    label: "Trade Direction",
    type: "enum",
    description: "Long (buy) or Short (sell)",
    synonyms: [
      "direction",
      "side",
      "position type",
      "buy",
      "sell",
      "long",
      "short",
    ],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },
  {
    key: "outcome",
    label: "Outcome",
    type: "enum",
    description: "Win, Loss, BE (break-even), or PW (partial win)",
    synonyms: ["result", "win/loss", "trade result", "winning", "losing"],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },

  // ===== PRICES =====
  {
    key: "openPrice",
    label: "Entry Price",
    type: "number",
    description: "Price at which trade was opened",
    synonyms: ["entry", "entry price", "open price", "fill price"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "closePrice",
    label: "Exit Price",
    type: "number",
    description: "Price at which trade was closed",
    synonyms: ["exit", "exit price", "close price", "close"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "sl",
    label: "Stop Loss",
    type: "number",
    description: "Stop loss price level",
    synonyms: ["stop loss", "sl price", "stop"],
    aggregations: ["avg"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },
  {
    key: "tp",
    label: "Take Profit",
    type: "number",
    description: "Take profit price level",
    synonyms: ["take profit", "tp price", "target"],
    aggregations: ["avg"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },

  // ===== MONEY METRICS =====
  {
    key: "profit",
    label: "Profit/Loss",
    type: "number",
    unit: "$",
    description: "Net profit or loss in account currency",
    synonyms: ["p&l", "pnl", "profit", "loss", "profit/loss", "net profit"],
    aggregations: ["sum", "avg", "min", "max", "count"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "commissions",
    label: "Commissions",
    type: "number",
    unit: "$",
    description: "Commission costs paid",
    synonyms: ["commission", "fees", "broker fees", "costs"],
    aggregations: ["sum", "avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "swap",
    label: "Swap",
    type: "number",
    unit: "$",
    description: "Overnight swap/rollover costs or credits",
    synonyms: ["swap costs", "rollover", "overnight fees"],
    aggregations: ["sum", "avg"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },

  // ===== VOLUME & POSITION SIZING =====
  {
    key: "volume",
    label: "Volume",
    type: "number",
    unit: "lots",
    description: "Position size in lots",
    synonyms: ["lot size", "lots", "position size", "size"],
    aggregations: ["avg", "min", "max", "sum"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== TIME METRICS =====
  {
    key: "open",
    label: "Open Time",
    type: "timestamp",
    description: "When the trade was opened",
    synonyms: ["entry time", "open time", "start time", "opened at"],
    aggregations: ["count"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "close",
    label: "Close Time",
    type: "timestamp",
    description: "When the trade was closed",
    synonyms: ["exit time", "close time", "end time", "closed at"],
    aggregations: ["count"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "tradeDurationSeconds",
    label: "Hold Time",
    type: "number",
    unit: "seconds",
    description: "How long the trade was held (in seconds)",
    synonyms: ["hold time", "duration", "time in trade", "holding period"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "weekday",
    label: "Day of Week",
    type: "enum",
    description:
      "Day of the week when trade was opened (Monday, Tuesday, Wednesday, Thursday, Friday)",
    synonyms: ["day of week", "day", "weekday", "which day", "what day"],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },
  {
    key: "hour",
    label: "Hour of Day",
    type: "number",
    description: "Hour of day when trade was opened (0-23, UTC)",
    synonyms: [
      "hour",
      "time of day",
      "what hour",
      "which hour",
      "morning hour",
      "evening hour",
    ],
    aggregations: ["count", "avg"],
    filterOps: ["eq", "in", "gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "month",
    label: "Month",
    type: "enum",
    description: "Month when trade was opened (January, February, etc.)",
    synonyms: ["month", "which month", "what month", "monthly"],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },
  {
    key: "quarter",
    label: "Quarter",
    type: "enum",
    description: "Quarter when trade was opened (Q1, Q2, Q3, Q4)",
    synonyms: ["quarter", "q1", "q2", "q3", "q4", "quarterly"],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },
  {
    key: "year",
    label: "Year",
    type: "number",
    description: "Year when trade was opened",
    synonyms: ["year", "which year", "yearly", "annual"],
    aggregations: ["count"],
    filterOps: ["eq", "in", "gt", "gte", "lt", "lte"],
  },
  {
    key: "timeOfDay",
    label: "Time of Day",
    type: "enum",
    description:
      "Time period of day: Morning (6-12), Afternoon (12-18), Evening (18-24), Night (0-6)",
    synonyms: [
      "time of day",
      "morning trades",
      "afternoon trades",
      "evening trades",
      "night trades",
      "am",
      "pm",
    ],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },

  // ===== TAGS & CATEGORIZATION =====
  {
    key: "sessionTag",
    label: "Session tag",
    type: "string",
    description: "User-tagged trading session (e.g., London Open, NY Session)",
    synonyms: [
      "session",
      "killzone",
      "market session",
      "trading session",
      "london",
      "new york",
      "asia",
      "ny",
    ],
    aggregations: ["count"],
    filterOps: ["eq", "in", "contains"],
  },
  {
    key: "modelTag",
    label: "Model Tag",
    type: "string",
    description: "Trading model/strategy used (e.g., Breaker Block, FVG)",
    synonyms: ["model", "strategy", "setup", "pattern", "entry model"],
    aggregations: ["count"],
    filterOps: ["eq", "in", "contains"],
  },
  {
    key: "edgeName",
    label: "Edge",
    type: "string",
    description: "Assigned Edge name for the trade, falling back to model tag",
    synonyms: ["edge", "edge name", "playbook", "setup edge"],
    aggregations: ["count"],
    filterOps: ["eq", "in", "contains"],
  },
  {
    key: "protocolAlignment",
    label: "Protocol Alignment",
    type: "enum",
    description:
      "Whether trade followed protocol: aligned, against, or discretionary",
    synonyms: [
      "protocol",
      "rule adherence",
      "following rules",
      "discretionary",
    ],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },
  {
    key: "complianceStatus",
    label: "Compliance Status",
    type: "enum",
    description: "Latest rules evaluation result for the trade",
    synonyms: [
      "compliance",
      "compliance status",
      "rule pass",
      "rule fail",
      "passed compliance",
      "failed compliance",
    ],
    aggregations: ["count"],
    filterOps: ["eq", "in", "contains"],
  },

  // ===== INTENT/PLAN METRICS =====
  {
    key: "plannedRR",
    label: "Planned R:R",
    type: "number",
    unit: "R",
    description: "Planned reward-to-risk ratio at entry",
    synonyms: ["planned rr", "intended rr", "target rr", "plan"],
    aggregations: ["avg", "min", "max", "p50"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "plannedRiskPips",
    label: "Planned Risk (Pips)",
    type: "number",
    unit: "pips",
    description: "Planned risk in pips (entry to SL distance)",
    synonyms: ["planned risk", "risk pips", "sl distance"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "plannedTargetPips",
    label: "Planned Target (Pips)",
    type: "number",
    unit: "pips",
    description: "Planned target in pips (entry to TP distance)",
    synonyms: ["planned target", "target pips", "tp distance"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== MANIPULATION METRICS =====
  {
    key: "manipulationPips",
    label: "Manipulation Size",
    type: "number",
    unit: "pips",
    description: "Size of manipulation leg in pips",
    synonyms: [
      "manipulation",
      "manip pips",
      "manipulation size",
      "liquidity grab",
    ],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "manipulationHigh",
    label: "Manipulation High",
    type: "number",
    description: "High price of manipulation range",
    synonyms: ["manip high", "manipulation top"],
    aggregations: ["avg"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },
  {
    key: "manipulationLow",
    label: "Manipulation Low",
    type: "number",
    description: "Low price of manipulation range",
    synonyms: ["manip low", "manipulation bottom"],
    aggregations: ["avg"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },

  // ===== PEAK/EXCURSION METRICS =====
  {
    key: "mfePips",
    label: "Maximum Favorable Excursion (MFE)",
    type: "number",
    unit: "pips",
    description: "Maximum profit reached while trade was open (in pips)",
    synonyms: ["mfe", "max favorable excursion", "peak profit", "best price"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "maePips",
    label: "Maximum Adverse Excursion (MAE)",
    type: "number",
    unit: "pips",
    description: "Maximum drawdown while trade was open (in pips)",
    synonyms: [
      "mae",
      "max adverse excursion",
      "trade drawdown",
      "intratrade drawdown",
      "worst price",
    ],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== R METRICS =====
  {
    key: "mpeManipLegR",
    label: "MPE from Manipulation (R)",
    type: "number",
    unit: "R",
    description:
      "Maximum positive excursion measured from manipulation leg in R units",
    synonyms: ["mpe manip leg", "manipulation r", "continuation"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "mpeManipPE_R",
    label: "Post-Exit MPE (R)",
    type: "number",
    unit: "R",
    description:
      "Maximum positive excursion after trade exit (how much was left on table)",
    synonyms: [
      "post exit mpe",
      "left on table",
      "continuation after exit",
      "what i missed",
      "post exit r",
    ],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "maxRR",
    label: "Maximum R:R",
    type: "number",
    unit: "R",
    description: "Maximum reward-to-risk ratio achieved while trade was open",
    synonyms: ["max rr", "peak rr", "best rr possible"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "realisedRR",
    label: "Realised R:R",
    type: "number",
    unit: "R",
    description: "Actual reward-to-risk ratio at exit",
    synonyms: [
      "realised rr",
      "realized rr",
      "actual rr",
      "achieved rr",
      "final rr",
      "exit rr",
      "rr",
      "r:r",
      "r",
    ],
    aggregations: ["avg", "min", "max", "p50", "p90", "sum"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== EFFICIENCY METRICS =====
  {
    key: "rrCaptureEfficiency",
    label: "R:R Capture Efficiency",
    type: "number",
    unit: "%",
    description:
      "Percentage of maximum R:R that was captured (realisedRR / maxRR * 100)",
    synonyms: [
      "capture efficiency",
      "rr efficiency",
      "how much did i keep",
      "efficiency",
    ],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "manipRREfficiency",
    label: "Manipulation R:R Efficiency",
    type: "number",
    unit: "%",
    description:
      "Percentage of manipulation leg captured relative to max available",
    synonyms: [
      "manip efficiency",
      "manipulation efficiency",
      "liquidity efficiency",
    ],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "exitEfficiency",
    label: "Exit Efficiency",
    type: "number",
    unit: "%",
    description: "Quality of exit timing (higher = exited closer to peak)",
    synonyms: ["exit timing", "how good was my exit", "exit quality"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== VOLATILITY METRICS =====
  {
    key: "rawSTDV",
    label: "Standard Deviation (Raw)",
    type: "number",
    description: "Raw standard deviation of price movement during trade",
    synonyms: ["stdv", "volatility", "standard deviation", "price variance"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "rawSTDV_PE",
    label: "Post-Exit Standard Deviation",
    type: "number",
    description: "Standard deviation after trade exit",
    synonyms: ["post exit volatility", "stdv pe", "volatility after exit"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },
  {
    key: "stdvBucket",
    label: "Volatility Bucket",
    type: "enum",
    description: "Categorized volatility level (e.g., Low, Medium, High)",
    synonyms: ["volatility bucket", "volatility category", "vol bucket"],
    aggregations: ["count"],
    filterOps: ["eq", "in"],
  },
  {
    key: "estimatedWeightedMPE_R",
    label: "Estimated Weighted MPE (R)",
    type: "number",
    unit: "R",
    description: "Volatility-adjusted maximum positive excursion",
    synonyms: ["weighted mpe", "adjusted mpe"],
    aggregations: ["avg", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== EXECUTION QUALITY =====
  {
    key: "entrySpreadPips",
    label: "Entry Spread",
    type: "number",
    unit: "pips",
    description: "Bid-ask spread at entry in pips",
    synonyms: ["entry spread", "spread at entry", "entry cost"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "exitSpreadPips",
    label: "Exit Spread",
    type: "number",
    unit: "pips",
    description: "Bid-ask spread at exit in pips",
    synonyms: ["exit spread", "spread at exit", "exit cost"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "entrySlippagePips",
    label: "Entry Slippage",
    type: "number",
    unit: "pips",
    description: "Slippage at entry in pips",
    synonyms: ["entry slippage", "slippage on entry"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "exitSlippagePips",
    label: "Exit Slippage",
    type: "number",
    unit: "pips",
    description: "Slippage at exit in pips",
    synonyms: ["exit slippage", "slippage on exit"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "slModCount",
    label: "SL Modifications",
    type: "number",
    description: "Number of times stop loss was modified",
    synonyms: ["sl modifications", "stop loss changes", "sl moves"],
    aggregations: ["avg", "sum", "max"],
    filterOps: ["eq", "gt", "gte"],
  },
  {
    key: "tpModCount",
    label: "TP Modifications",
    type: "number",
    description: "Number of times take profit was modified",
    synonyms: ["tp modifications", "take profit changes", "tp moves"],
    aggregations: ["avg", "sum", "max"],
    filterOps: ["eq", "gt", "gte"],
  },
  {
    key: "partialCloseCount",
    label: "Partial Closes",
    type: "number",
    description: "Number of partial closes taken",
    synonyms: ["partials", "partial closes", "scale outs"],
    aggregations: ["avg", "sum", "max"],
    filterOps: ["eq", "gt", "gte"],
  },

  // ===== TRADE BEHAVIOR =====
  {
    key: "trailingStopDetected",
    label: "Trailing Stop Used",
    type: "boolean",
    description: "Whether a trailing stop was detected",
    synonyms: ["trailing stop", "trailing sl", "used trailing"],
    aggregations: ["count"],
    filterOps: ["eq"],
  },
  {
    key: "scaleInCount",
    label: "Scale-In Count",
    type: "number",
    description: "Number of times position was scaled into",
    synonyms: ["scale in", "adding to position", "scale ins"],
    aggregations: ["avg", "sum", "max"],
    filterOps: ["eq", "gt", "gte"],
  },
  {
    key: "scaleOutCount",
    label: "Scale-Out Count",
    type: "number",
    description: "Number of times position was scaled out of",
    synonyms: ["scale out", "reducing position", "scale outs"],
    aggregations: ["avg", "sum", "max"],
    filterOps: ["eq", "gt", "gte"],
  },

  // ===== TIMING =====
  {
    key: "entryPeakDurationSeconds",
    label: "Time to Peak",
    type: "number",
    unit: "seconds",
    description: "Time from entry to peak profit (MFE) in seconds",
    synonyms: ["time to peak", "entry to peak", "time to mfe"],
    aggregations: ["avg", "min", "max", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "postExitPeakDurationSeconds",
    label: "Post-Exit Time to Peak",
    type: "number",
    unit: "seconds",
    description: "Time from exit to post-exit peak in seconds",
    synonyms: ["post exit time", "time after exit to peak"],
    aggregations: ["avg", "p50", "p90"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },

  // ===== ACCOUNT STATE =====
  {
    key: "entryBalance",
    label: "Balance at Entry",
    type: "number",
    unit: "$",
    description: "Account balance when trade was opened",
    synonyms: ["entry balance", "balance at entry"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "entryEquity",
    label: "Equity at Entry",
    type: "number",
    unit: "$",
    description: "Account equity when trade was opened",
    synonyms: ["entry equity", "equity at entry"],
    aggregations: ["avg", "min", "max"],
    filterOps: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    key: "entryMargin",
    label: "Margin at Entry",
    type: "number",
    unit: "$",
    description: "Margin used when trade was opened",
    synonyms: ["entry margin", "margin used"],
    aggregations: ["avg", "sum"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },
  {
    key: "entryFreeMargin",
    label: "Free Margin at Entry",
    type: "number",
    unit: "$",
    description: "Free margin available when trade was opened",
    synonyms: ["free margin", "available margin"],
    aggregations: ["avg", "min"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },
  {
    key: "entryMarginLevel",
    label: "Margin Level at Entry",
    type: "number",
    unit: "%",
    description: "Margin level percentage when trade was opened",
    synonyms: ["margin level", "margin %"],
    aggregations: ["avg", "min"],
    filterOps: ["gt", "gte", "lt", "lte"],
  },

  // ===== COMPUTED METRICS (calculated across multiple trades) =====
  {
    key: "winRate",
    label: "Win Rate",
    type: "number",
    unit: "%",
    description: "Percentage of trades that were profitable",
    synonyms: [
      "win rate",
      "win percentage",
      "winning percentage",
      "win ratio",
      "success rate",
    ],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "profitFactor",
    label: "Profit Factor",
    type: "number",
    description:
      "Ratio of gross profits to gross losses (above 1 = profitable)",
    synonyms: ["profit factor", "pf", "gross profit ratio"],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "expectancy",
    label: "Expectancy",
    type: "number",
    unit: "$",
    description:
      "Average expected profit per trade (winRate * avgWin - (1-winRate) * avgLoss)",
    synonyms: ["expectancy", "expected value", "ev", "average expectation"],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "avgWin",
    label: "Average Win",
    type: "number",
    unit: "$",
    description: "Average profit on winning trades",
    synonyms: ["average win", "avg winner", "average winner", "mean win"],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "avgLoss",
    label: "Average Loss",
    type: "number",
    unit: "$",
    description: "Average loss on losing trades (negative value)",
    synonyms: ["average loss", "avg loser", "average loser", "mean loss"],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "maxDrawdown",
    label: "Maximum Drawdown",
    type: "number",
    unit: "$",
    description: "Largest peak-to-trough decline in account equity",
    synonyms: ["max drawdown", "maximum drawdown", "drawdown", "biggest drop"],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "riskOfRuin",
    label: "Risk of Ruin",
    type: "number",
    unit: "%",
    description:
      "Probability of losing entire account based on win rate and risk per trade",
    synonyms: ["risk of ruin", "ror", "ruin probability"],
    aggregations: [],
    filterOps: [],
  },
  {
    key: "averageRR",
    label: "Average R:R",
    type: "number",
    unit: "R",
    description: "Average realized risk-reward ratio across all trades",
    synonyms: ["average rr", "avg rr", "mean rr", "average risk reward"],
    aggregations: [],
    filterOps: [],
  },
];

/**
 * Computed metric definitions - metrics that require calculation across multiple trades
 */
export interface ComputedMetricDef {
  key: string;
  label: string;
  description: string;
  requiresMultipleTrades: boolean;
  dependsOn: string[];
  compute: (trades: Array<Record<string, any>>) => number | null;
}

export const COMPUTED_METRICS: ComputedMetricDef[] = [
  {
    key: "winRate",
    label: "Win Rate",
    description: "Percentage of trades that were profitable",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      if (trades.length === 0) return null;
      const wins = trades.filter((t) => Number(t.profit) > 0).length;
      return (wins / trades.length) * 100;
    },
  },
  {
    key: "profitFactor",
    label: "Profit Factor",
    description: "Ratio of gross profits to gross losses",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      const grossProfit = trades
        .filter((t) => Number(t.profit) > 0)
        .reduce((sum, t) => sum + Number(t.profit), 0);
      const grossLoss = Math.abs(
        trades
          .filter((t) => Number(t.profit) < 0)
          .reduce((sum, t) => sum + Number(t.profit), 0)
      );
      if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
      return grossProfit / grossLoss;
    },
  },
  {
    key: "expectancy",
    label: "Expectancy",
    description: "Average expected profit per trade",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      if (trades.length === 0) return null;
      return (
        trades.reduce((sum, t) => sum + Number(t.profit || 0), 0) /
        trades.length
      );
    },
  },
  {
    key: "avgWin",
    label: "Average Win",
    description: "Average profit on winning trades",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      const winners = trades.filter((t) => Number(t.profit) > 0);
      if (winners.length === 0) return null;
      return (
        winners.reduce((sum, t) => sum + Number(t.profit), 0) / winners.length
      );
    },
  },
  {
    key: "avgLoss",
    label: "Average Loss",
    description: "Average loss on losing trades",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      const losers = trades.filter((t) => Number(t.profit) < 0);
      if (losers.length === 0) return null;
      return (
        losers.reduce((sum, t) => sum + Number(t.profit), 0) / losers.length
      );
    },
  },
  {
    key: "maxDrawdown",
    label: "Maximum Drawdown",
    description: "Largest peak-to-trough decline",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      let peak = 0;
      let maxDD = 0;
      let running = 0;
      for (const trade of trades) {
        running += Number(trade.profit || 0);
        if (running > peak) peak = running;
        const dd = peak - running;
        if (dd > maxDD) maxDD = dd;
      }
      return maxDD;
    },
  },
  {
    key: "riskOfRuin",
    label: "Risk of Ruin",
    description: "Probability of losing entire account",
    requiresMultipleTrades: true,
    dependsOn: ["profit"],
    compute: (trades) => {
      if (trades.length < 10) return null;
      const wins = trades.filter((t) => Number(t.profit) > 0).length;
      const winRate = wins / trades.length;
      const avgWin =
        trades
          .filter((t) => Number(t.profit) > 0)
          .reduce((s, t) => s + Number(t.profit), 0) / wins || 1;
      const losses = trades.filter((t) => Number(t.profit) < 0);
      const avgLoss =
        Math.abs(
          losses.reduce((s, t) => s + Number(t.profit), 0) / losses.length
        ) || 1;
      const rr = avgWin / avgLoss;
      if (winRate <= 0 || winRate >= 1 || rr <= 0) return null;
      const q = (1 - winRate) / winRate;
      const ror = Math.pow(q, 100 / (rr + 1)) * 100;
      return Math.max(0, Math.min(100, ror));
    },
  },
  {
    key: "averageRR",
    label: "Average R:R",
    description: "Average realized risk-reward ratio",
    requiresMultipleTrades: true,
    dependsOn: ["realisedRR"],
    compute: (trades) => {
      const withRR = trades.filter(
        (t) => t.realisedRR !== null && t.realisedRR !== undefined
      );
      if (withRR.length === 0) return null;
      return (
        withRR.reduce((sum, t) => sum + Number(t.realisedRR), 0) / withRR.length
      );
    },
  },
];

export const COMPUTED_METRICS_MAP = new Map<string, ComputedMetricDef>(
  COMPUTED_METRICS.map((m) => [m.key, m])
);

export function isComputedMetric(key: string): boolean {
  return COMPUTED_METRICS_MAP.has(key);
}

export function getComputedMetric(key: string): ComputedMetricDef | undefined {
  return COMPUTED_METRICS_MAP.get(key);
}

/**
 * Field lookup by key
 */
export const FIELD_MAP = new Map<string, TradeField>(
  TRADE_FIELDS.map((f) => [f.key, f])
);

/**
 * Concept synonym resolver
 * Maps common phrases to canonical field keys
 */
export const CONCEPT_SYNONYMS: Record<string, string[]> = {
  // Performance metrics (computed)
  "win rate": ["winRate"],
  "win percentage": ["winRate"],
  "profit factor": ["profitFactor"],
  expectancy: ["expectancy"],
  "expected value": ["expectancy"],
  "average win": ["avgWin"],
  "average winner": ["avgWin"],
  "average loss": ["avgLoss"],
  "average loser": ["avgLoss"],
  "max drawdown": ["maxDrawdown"],
  drawdown: ["maxDrawdown"],
  "trade drawdown": ["maePips"],
  "intratrade drawdown": ["maePips"],
  "risk of ruin": ["riskOfRuin"],
  "average rr": ["averageRR"],
  "average risk reward": ["averageRR"],

  // Exit efficiency
  "leaving on the table": ["mpeManipPE_R", "maxRR", "rrCaptureEfficiency"],
  "exit timing": ["exitEfficiency", "rrCaptureEfficiency"],
  "running longer": [
    "tradeDurationSeconds",
    "mpeManipPE_R",
    "rrCaptureEfficiency",
  ],
  "holding period": ["tradeDurationSeconds"],
  "peak profit": ["mfePips"],
  "commission costs": ["commissions"],

  // Time-based queries
  "best day": ["weekday", "profit"],
  "worst day": ["weekday", "profit"],
  "best hour": ["hour", "profit"],
  "best month": ["month", "profit"],
  "morning trades": ["timeOfDay"],
  "afternoon trades": ["timeOfDay"],
  "evening trades": ["timeOfDay"],
  "night trades": ["timeOfDay"],
  scalps: ["tradeDurationSeconds"],
  "swing trades": ["tradeDurationSeconds"],

  // Session/tag queries
  "london session": ["sessionTag"],
  "ny session": ["sessionTag"],
  "new york session": ["sessionTag"],
  "asia session": ["sessionTag"],
  edge: ["edgeName"],
  edges: ["edgeName"],
  compliance: ["complianceStatus"],
  "compliance status": ["complianceStatus"],
};

/**
 * Helper: Find field by key or synonym
 */
export function findField(query: string): TradeField | null {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;

  const exactMatch = FIELD_MAP.get(query);
  if (exactMatch) return exactMatch;

  let best: { field: TradeField; score: number } | null = null;

  for (const field of TRADE_FIELDS) {
    const phrases: Array<{ value: string; weight: number }> = [
      { value: field.key, weight: 40 },
      { value: field.label, weight: 30 },
      ...field.synonyms.map((syn) => ({ value: syn, weight: 25 })),
    ];

    let bestScoreForField = 0;
    for (const phrase of phrases) {
      const score = scorePhrase(normalizedQuery, phrase.value, phrase.weight);
      if (score > bestScoreForField) {
        bestScoreForField = score;
      }
    }

    if (bestScoreForField > 0) {
      if (!best || bestScoreForField > best.score) {
        best = { field, score: bestScoreForField };
      }
    }
  }

  return best?.field ?? null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/\\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scorePhrase(query: string, phrase: string, weight: number): number {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return 0;

  const queryWords = query.split(" ").filter(Boolean);
  const phraseWords = normalizedPhrase.split(" ").filter(Boolean);
  const phraseLength = normalizedPhrase.length;

  const boundaryRegex = new RegExp(
    `\\\\b${escapeRegExp(normalizedPhrase)}\\\\b`,
    "i"
  );

  if (query === normalizedPhrase) {
    return 200 + phraseLength + weight;
  }

  if (!boundaryRegex.test(query) && !query.includes(normalizedPhrase)) {
    return 0;
  }

  let score = boundaryRegex.test(query) ? 120 : 60;

  if (phraseLength < 3 && query !== normalizedPhrase) {
    score -= 40;
  }

  if (phraseWords.length === 1 && queryWords.length > 1) {
    score -= 35;
  }

  score += phraseLength + phraseWords.length * 8 + weight;

  return score;
}

/**
 * Helper: Get all fields that support a specific aggregation
 */
export function getFieldsForAggregation(agg: AggregationFn): TradeField[] {
  return TRADE_FIELDS.filter((f) => f.aggregations?.includes(agg));
}

/**
 * Helper: Get all enum fields
 */
export function getEnumFields(): TradeField[] {
  return TRADE_FIELDS.filter((f) => f.type === "enum");
}
