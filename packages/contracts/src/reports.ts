export const REPORT_LENS_IDS = [
  "performance",
  "time",
  "setup",
  "risk",
  "execution",
] as const;

export type ReportLensId = (typeof REPORT_LENS_IDS)[number];

export const REPORT_CHART_TYPES = ["bar", "line", "composed"] as const;

export type ReportChartType = (typeof REPORT_CHART_TYPES)[number];

export const REPORT_METRIC_IDS = [
  "netPnl",
  "winRate",
  "tradeCount",
  "avgRR",
  "profitFactor",
  "expectancy",
  "avgHold",
  "avgMfe",
  "avgMae",
  "rrCaptureEfficiency",
] as const;

export type ReportMetricId = (typeof REPORT_METRIC_IDS)[number];

export const REPORT_DIMENSION_IDS = [
  "date",
  "week",
  "month",
  "symbol",
  "session",
  "model",
  "customTag",
  "protocolAlignment",
  "hour",
  "weekday",
  "holdBucket",
  "entryWindow",
  "exitWindow",
  "volumeBucket",
  "plannedRBucket",
  "realizedRBucket",
  "direction",
  "slippageBucket",
  "captureBucket",
] as const;

export type ReportDimensionId = (typeof REPORT_DIMENSION_IDS)[number];

export const REPORT_PANEL_IDS = [
  "equityCurve",
  "drawdown",
  "rollingPerformance",
  "riskAdjusted",
  "dailyNet",
  "weekdayPerformance",
  "performanceHeatmap",
  "entryExitWindow",
  "symbolBreakdown",
  "sessionBreakdown",
  "radarComparison",
  "correlationMatrix",
  "rMultipleDistribution",
  "bellCurve",
  "riskBalance",
  "monteCarlo",
  "maeMfeScatter",
  "holdBucket",
  "slippageBreakdown",
  "captureEfficiency",
] as const;

export type ReportPanelId = (typeof REPORT_PANEL_IDS)[number];

export type ReportLensConfig = {
  label: string;
  description: string;
  defaultDimension: ReportDimensionId;
  allowedDimensions: readonly ReportDimensionId[];
  defaultMetrics: readonly ReportMetricId[];
  allowedMetrics: readonly ReportMetricId[];
  defaultPanels: readonly ReportPanelId[];
  optionalPanels: readonly ReportPanelId[];
};

export const REPORT_LENS_CONFIG = {
  performance: {
    label: "Performance",
    description: "Track where your P&L and consistency are actually coming from.",
    defaultDimension: "date",
    allowedDimensions: ["date", "week", "month", "symbol", "session", "model"],
    defaultMetrics: ["netPnl", "winRate", "tradeCount"],
    allowedMetrics: [
      "netPnl",
      "winRate",
      "tradeCount",
      "avgRR",
      "profitFactor",
      "expectancy",
    ],
    defaultPanels: [
      "equityCurve",
      "drawdown",
      "rollingPerformance",
      "riskAdjusted",
    ],
    optionalPanels: [
      "equityCurve",
      "drawdown",
      "rollingPerformance",
      "riskAdjusted",
    ],
  },
  time: {
    label: "Time",
    description: "See how timing changes outcomes across sessions, weekdays, and hold windows.",
    defaultDimension: "hour",
    allowedDimensions: [
      "hour",
      "weekday",
      "month",
      "holdBucket",
      "entryWindow",
      "exitWindow",
    ],
    defaultMetrics: ["netPnl", "winRate", "tradeCount"],
    allowedMetrics: [
      "netPnl",
      "winRate",
      "tradeCount",
      "avgRR",
      "expectancy",
      "avgHold",
    ],
    defaultPanels: [
      "dailyNet",
      "weekdayPerformance",
      "performanceHeatmap",
      "entryExitWindow",
    ],
    optionalPanels: [
      "dailyNet",
      "weekdayPerformance",
      "performanceHeatmap",
      "entryExitWindow",
    ],
  },
  setup: {
    label: "Setup",
    description: "Compare symbols, sessions, Edges, and tags to find where your edge actually lives.",
    defaultDimension: "model",
    allowedDimensions: [
      "model",
      "customTag",
      "symbol",
      "session",
      "protocolAlignment",
    ],
    defaultMetrics: ["netPnl", "winRate", "avgRR"],
    allowedMetrics: [
      "netPnl",
      "winRate",
      "tradeCount",
      "avgRR",
      "expectancy",
      "rrCaptureEfficiency",
    ],
    defaultPanels: [
      "symbolBreakdown",
      "sessionBreakdown",
      "radarComparison",
      "correlationMatrix",
    ],
    optionalPanels: [
      "symbolBreakdown",
      "sessionBreakdown",
      "radarComparison",
      "correlationMatrix",
    ],
  },
  risk: {
    label: "Risk",
    description: "Overlay size, R buckets, and drawdown-sensitive metrics to tune your exposure.",
    defaultDimension: "realizedRBucket",
    allowedDimensions: [
      "volumeBucket",
      "plannedRBucket",
      "realizedRBucket",
      "holdBucket",
    ],
    defaultMetrics: ["netPnl", "tradeCount", "avgMae"],
    allowedMetrics: [
      "netPnl",
      "tradeCount",
      "avgRR",
      "profitFactor",
      "expectancy",
      "avgMae",
    ],
    defaultPanels: [
      "rMultipleDistribution",
      "bellCurve",
      "riskBalance",
      "monteCarlo",
    ],
    optionalPanels: [
      "rMultipleDistribution",
      "bellCurve",
      "riskBalance",
      "monteCarlo",
    ],
  },
  execution: {
    label: "Execution",
    description: "Break down hold quality, slippage, capture, and trade management execution.",
    defaultDimension: "captureBucket",
    allowedDimensions: [
      "holdBucket",
      "direction",
      "protocolAlignment",
      "slippageBucket",
      "captureBucket",
    ],
    defaultMetrics: ["avgRR", "rrCaptureEfficiency", "avgMae"],
    allowedMetrics: [
      "tradeCount",
      "winRate",
      "avgRR",
      "avgMfe",
      "avgMae",
      "rrCaptureEfficiency",
    ],
    defaultPanels: [
      "maeMfeScatter",
      "holdBucket",
      "slippageBreakdown",
      "captureEfficiency",
    ],
    optionalPanels: [
      "maeMfeScatter",
      "holdBucket",
      "slippageBreakdown",
      "captureEfficiency",
    ],
  },
} as const satisfies Record<ReportLensId, ReportLensConfig>;

export const REPORT_PANEL_LABELS = {
  equityCurve: "Equity curve",
  drawdown: "Drawdown",
  rollingPerformance: "Rolling performance",
  riskAdjusted: "Risk-adjusted view",
  dailyNet: "Daily net",
  weekdayPerformance: "Weekday performance",
  performanceHeatmap: "Performance heatmap",
  entryExitWindow: "Entry / exit window",
  symbolBreakdown: "Symbol breakdown",
  sessionBreakdown: "Session breakdown",
  radarComparison: "Radar comparison",
  correlationMatrix: "Correlation matrix",
  rMultipleDistribution: "R-multiple distribution",
  bellCurve: "Bell curve",
  riskBalance: "Risk balance",
  monteCarlo: "Monte Carlo",
  maeMfeScatter: "MAE / MFE scatter",
  holdBucket: "Hold buckets",
  slippageBreakdown: "Slippage breakdown",
  captureEfficiency: "Capture efficiency",
} as const satisfies Record<ReportPanelId, string>;

export const REPORT_METRIC_LABELS = {
  netPnl: "Net P&L",
  winRate: "Win rate",
  tradeCount: "Trades",
  avgRR: "Average R",
  profitFactor: "Profit factor",
  expectancy: "Expectancy",
  avgHold: "Average hold",
  avgMfe: "Average MFE",
  avgMae: "Average MAE",
  rrCaptureEfficiency: "RR capture",
} as const satisfies Record<ReportMetricId, string>;

export const REPORT_DIMENSION_LABELS = {
  date: "Date",
  week: "Week",
  month: "Month",
  symbol: "Symbol",
  session: "Session",
  model: "Edge",
  customTag: "Trade tag",
  protocolAlignment: "Protocol alignment",
  hour: "Hour",
  weekday: "Weekday",
  holdBucket: "Hold bucket",
  entryWindow: "Entry window",
  exitWindow: "Exit window",
  volumeBucket: "Volume bucket",
  plannedRBucket: "Planned R",
  realizedRBucket: "Realized R",
  direction: "Direction",
  slippageBucket: "Slippage bucket",
  captureBucket: "Capture bucket",
} as const satisfies Record<ReportDimensionId, string>;
