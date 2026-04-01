/**
 * Visualization Registry
 *
 * Maps query plan results to appropriate visualization configurations.
 * This runs on the server and returns serializable visualization specs
 * that the frontend can render with its component library.
 */

import type {
  TradeQueryPlan,
  VizType,
  ComponentHint,
  DisplayMode,
} from "./query-plan";

/**
 * Visualization specification sent to frontend
 */
export type ChartType = "bar" | "area" | "scatter" | "heatmap" | "kpi" | "comparison" | "table";

export interface VizSpec {
  // What type of visualization to render
  type: VizType;

  // Specific component hint (maps to existing widgets)
  component: ComponentHint;

  // Display mode
  mode: DisplayMode;

  // Title for the visualization
  title: string;

  // Subtitle/description
  subtitle?: string;

  // Data configuration
  data: VizDataConfig;

  // Optional styling hints
  style?: VizStyleConfig;

  // Optional explicit chart type from AI plan
  chartType?: ChartType;
}

export interface VizDataConfig {
  // For KPI displays
  value?: string | number;
  label?: string;
  unit?: string;
  change?: number; // percent change
  changeLabel?: string;

  // For charts/tables - the actual data rows
  rows?: any[];

  // Column definitions for tables
  columns?: Array<{
    key: string;
    label: string;
    type?: "string" | "number" | "currency" | "percent" | "date" | "ratio";
  }>;

  // Chart-specific config
  xAxis?: string; // field name for x-axis
  yAxis?: string; // field name for y-axis
  groupKey?: string; // field name for grouping
  valueFormat?: "currency" | "percent" | "ratio" | "number";

  // For comparisons
  comparison?: {
    a: { label: string; value: number | string; count?: number };
    b: { label: string; value: number | string; count?: number };
    delta?: number | string;
    deltaPercent?: string;
    metricField?: string;
    format?: "currency" | "percent" | "ratio" | "number";
    betterWhen?: "higher" | "lower";
  };

  // Trade IDs for "view trades" action
  tradeIds?: string[];

  // Date range for calendar/timeline views
  dateRange?: {
    from: string;
    to: string;
  };

  // Summary stats
  summary?: {
    total?: number;
    count?: number;
    average?: number;
    best?: { label: string; value: number | string };
    worst?: { label: string; value: number | string };
  };
}

export interface VizStyleConfig {
  // Color scheme
  colorScheme?: "profit" | "loss" | "neutral" | "comparison";

  // Size hints
  size?: "compact" | "default" | "expanded";

  // Show/hide elements
  showLegend?: boolean;
  showTooltip?: boolean;
  showLabels?: boolean;

  // Animation
  animate?: boolean;
}

/**
 * Build visualization spec from plan and execution result
 */
export function buildVizSpec(
  plan: TradeQueryPlan,
  executionResult: {
    data?: any;
    meta?: {
      rowCount?: number;
      aggregates?: Record<string, any>;
      groups?: any[];
      filters?: string[];
      timeframe?: string;
    };
  }
): VizSpec {
  const vizType = resolveVizType(plan);
  const componentHint = plan.componentHint || "auto";
  const displayMode = plan.displayMode || "plural";

  const spec: VizSpec = {
    type: vizType,
    component: componentHint,
    mode: displayMode,
    title: plan.vizTitle || plan.explanation,
    data: {},
  };

  // Build data config based on viz type
  switch (vizType) {
    case "kpi_single":
      spec.data = buildKpiSingleData(executionResult, plan);
      spec.style = { size: "compact", animate: true };
      break;

    case "kpi_grid":
      spec.data = buildKpiGridData(executionResult, plan);
      spec.style = { size: "default" };
      break;

    case "bar_chart":
    case "horizontal_bar":
    case "asset_profitability":
      spec.data = buildBarChartData(executionResult, plan);
      spec.style = {
        colorScheme: "profit",
        showLabels: true,
        animate: true,
      };
      break;

    case "area_chart":
    case "weekday_performance":
      spec.data = buildAreaChartData(executionResult, plan);
      spec.style = { animate: true };
      break;

    case "comparison_bar":
      spec.data = buildComparisonData(executionResult, plan);
      spec.style = { colorScheme: "comparison" };
      break;

    case "trade_table":
    case "breakdown_table":
      spec.data = buildTableData(executionResult, plan);
      break;

    case "calendar":
      spec.data = buildCalendarData(executionResult, plan);
      break;

    case "win_rate_card":
      spec.data = buildWinRateData(executionResult);
      spec.component = "win-rate";
      break;

    case "daily_pnl":
      spec.data = buildDailyPnlData(executionResult);
      spec.component = "daily-net";
      break;

    case "losses_breakdown":
      spec.data = buildLossesData(executionResult);
      spec.component = "total-losses";
      break;

    case "trade_counts":
      spec.data = buildTradeCountsData(executionResult);
      spec.component = "trade-counts";
      break;

    case "text_answer":
    default:
      // No visualization, just text
      spec.data = {};
      break;
  }

  // Add metadata
  if (executionResult.meta?.rowCount !== undefined) {
    spec.data.summary = {
      ...spec.data.summary,
      count: executionResult.meta.rowCount,
    };
  }

  return spec;
}

function resolveVizType(plan: TradeQueryPlan): VizType {
  const explicit = plan.vizType;
  const inferred = inferVizType(plan);
  const hasSymbolGroup =
    plan.groupBy?.length === 1 &&
    plan.groupBy?.some((group) => group.field === "symbol");
  const hasProfitAggregate = plan.aggregates?.some(
    (aggregate) => aggregate.field === "profit" && aggregate.fn === "sum"
  );

  if (hasSymbolGroup && hasProfitAggregate) {
    return "asset_profitability";
  }

  if (hasSymbolGroup && explicit === "asset_profitability" && !hasProfitAggregate) {
    return inferred === "asset_profitability" ? "bar_chart" : inferred;
  }

  if (
    plan.groupBy?.length &&
    explicit &&
    ["kpi_single", "kpi_grid", "text_answer"].includes(explicit)
  ) {
    return inferred;
  }

  return explicit || inferred;
}

function isTimeSeriesGroupField(field?: string): boolean {
  return (
    field === "open" ||
    field === "close" ||
    field === "openedAt" ||
    field === "closedAt" ||
    field === "date"
  );
}

/**
 * Infer visualization type from plan if not explicitly set
 */
function inferVizType(plan: TradeQueryPlan): VizType {
  if (plan.temporal) {
    return "comparison_bar";
  }

  if (plan.hiddenState || plan.persona) {
    return "breakdown_table";
  }

  // Compare intent → comparison bar
  if (plan.intent === "compare") {
    return "comparison_bar";
  }

  // List trades → trade table or calendar
  if (plan.intent === "list_trades") {
    if (plan.timeframe) {
      return "calendar";
    }
    return "trade_table";
  }

  // Aggregate with groupBy → bar chart or table
  if (plan.groupBy && plan.groupBy.length > 0) {
    if ((plan.groupBy.length > 1 || (plan.aggregates?.length || 0) > 1) && !plan.temporal) {
      return (plan.aggregates?.length || 0) > 1 ? "breakdown_table" : "bar_chart";
    }

    const groupField = plan.groupBy[0].field;

    // Asset grouping → asset profitability only for summed profit
    if (
      groupField === "symbol" &&
      plan.aggregates?.some(
        (aggregate) =>
          aggregate.field === "profit" && aggregate.fn === "sum"
      )
    ) {
      return "asset_profitability";
    }

    // Weekday grouping → weekday chart
    if (groupField === "weekday" || groupField === "dayOfWeek") {
      return "weekday_performance";
    }

    // Hour grouping → bar chart
    if (groupField === "hour") {
      return "bar_chart";
    }

    // Month grouping → area chart
    if (groupField === "month") {
      return "area_chart";
    }

    // Quarter grouping → comparison bar
    if (groupField === "quarter") {
      return "bar_chart";
    }

    // Time of day grouping → bar chart
    if (groupField === "timeOfDay") {
      return "bar_chart";
    }

    // Year grouping → area chart
    if (groupField === "year") {
      return "area_chart";
    }

    // Date grouping → daily P&L
    if (
      groupField === "openedAt" ||
      groupField === "closedAt" ||
      groupField === "date" ||
      groupField === "open" ||
      groupField === "close"
    ) {
      return "daily_pnl";
    }

    // Session grouping → bar chart
    if (groupField === "sessionTag") {
      return "bar_chart";
    }

    // Model grouping → bar chart
    if (groupField === "modelTag") {
      return "bar_chart";
    }

    return "breakdown_table";
  }

  // Simple aggregate (no groupBy) → single KPI
  if (plan.aggregates && plan.aggregates.length > 0) {
    if (plan.aggregates.length === 1) {
      return "kpi_single";
    }
    return "kpi_grid";
  }

  // Default to text
  return "text_answer";
}

// ===== DATA BUILDERS =====

function buildKpiSingleData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const aggregates = result.meta?.aggregates || {};
  const keys = Object.keys(aggregates);

  if (keys.length === 0) {
    const groups = result.meta?.groups || result.data || [];
    if (Array.isArray(groups) && groups.length > 0) {
      const groupFields =
        plan.groupBy?.map((group) => group.field) || [Object.keys(groups[0])[0]];
      const groupField = groupFields[0] || Object.keys(groups[0])[0];
      const valueField =
        plan.aggregates?.[0]?.as ||
        Object.keys(groups[0]).find((key) => !groupFields.includes(key)) ||
        "";

      const top = groups[0] || {};
      const groupValue = buildGroupLabel(top, groupFields);
      const value = valueField ? top[valueField] : undefined;

      const formattedValue = formatMetricValue(valueField, value);
      const labelSuffix =
        groupValue !== undefined && groupValue !== null
          ? `: ${groupValue}`
          : "";

      return {
        value:
          formattedValue !== undefined && formattedValue !== null
            ? formattedValue
            : groupValue ?? "No data",
        label: `${formatFieldLabel(groupField)}${labelSuffix}`,
        summary: {
          count: result.meta?.rowCount,
        },
      };
    }

    return { value: "No data", label: plan.explanation };
  }

  const key = keys[0];
  const value = aggregates[key];

  const formattedValue = formatMetricValue(key, value);
  const label = formatFieldLabel(key);

  return {
    value: formattedValue,
    label,
    summary: {
      count: result.meta?.rowCount,
    },
  };
}

function buildKpiGridData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const aggregates = result.meta?.aggregates || {};

  const rows = Object.entries(aggregates).map(([key, value]) => {
    const label = formatFieldLabel(key);
    const formattedValue = formatMetricValue(key, value);

    return { label, value: formattedValue };
  });

  return {
    rows,
    summary: {
      count: result.meta?.rowCount,
    },
  };
}

function buildBarChartData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const groups = result.meta?.groups || [];
  const groupFields = plan.groupBy?.map((group) => group.field) || ["group"];
  const groupField = groupFields[0] || "group";
  const valueField = plan.aggregates?.[0]?.as || "value";

  // Respect limit for singular/plural display
  const isGroupedRanking =
    Boolean(plan.groupBy?.length) && !isTimeSeriesGroupField(groupField);
  const limit = isGroupedRanking
    ? Math.min(
        groups.length,
        Math.max(plan.limit || 1, plan.displayMode === "singular" ? 5 : 10)
      )
    : plan.limit || (plan.displayMode === "singular" ? 1 : 10);
  const rows = groups.slice(0, limit).map((g: any) => {
    const rawValue = g[valueField];
    const numericValue =
      typeof rawValue === "number"
        ? rawValue
        : Number(String(rawValue).replace(/[^0-9.-]/g, ""));
    return {
      label: buildGroupLabel(g, groupFields) || "Unknown",
      value: Number.isNaN(numericValue) ? 0 : numericValue,
    };
  });

  // Find best/worst
  let best, worst;
  if (rows.length > 0) {
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    best = { label: sorted[0].label, value: sorted[0].value };
    if (sorted.length > 1) {
      worst = {
        label: sorted[sorted.length - 1].label,
        value: sorted[sorted.length - 1].value,
      };
    }
  }

  return {
    rows,
    xAxis: groupField,
    yAxis: valueField,
    valueFormat: inferMetricDisplayFormat(valueField),
    summary: {
      count: result.meta?.rowCount,
      best,
      worst,
    },
  };
}

function buildAreaChartData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const groups = result.meta?.groups || [];
  const groupFields = plan.groupBy?.map((group) => group.field) || ["x"];
  const groupField = groupFields[0] || "x";
  const valueField = plan.aggregates?.[0]?.as || "y";

  const rows = groups.map((g: any) => {
    const rawValue = g[valueField];
    const numericValue =
      typeof rawValue === "number"
        ? rawValue
        : Number(String(rawValue).replace(/[^0-9.-]/g, ""));
    return {
      x: g[groupField],
      y: Number.isNaN(numericValue) ? 0 : numericValue,
    };
  });

  return {
    rows,
    xAxis: groupField,
    yAxis: valueField,
    summary: {
      count: result.meta?.rowCount,
    },
  };
}

function buildComparisonData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const data = result.data || {};
  const metricField = plan.compare?.metric.field;
  const format = inferMetricDisplayFormat(metricField);

  return {
    comparison: {
      a: {
        label: data.a?.label || "Group A",
        value: toNumericValue(data.a?.value),
        count: data.a?.count,
      },
      b: {
        label: data.b?.label || "Group B",
        value: toNumericValue(data.b?.value),
        count: data.b?.count,
      },
      delta: toNumericValue(data.delta),
      deltaPercent: data.deltaPercent,
      metricField,
      format,
      betterWhen: inferMetricPolarity(metricField),
    },
  };
}

function buildTableData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const data = result.data || [];
  const aggregateRows =
    !Array.isArray(data) && result.meta?.aggregates
      ? Object.entries(result.meta.aggregates).map(([metric, value]) => ({
          metric: formatFieldLabel(metric),
          value,
        }))
      : [];
  const rows = Array.isArray(data) ? data : aggregateRows;

  // Extract trade IDs if available
  const tradeIds = rows
    .filter((r: any) => r.id || r.tradeId)
    .map((r: any) => r.id || r.tradeId);

  // Infer columns from first row
  const columns: VizDataConfig["columns"] =
    rows.length > 0
      ? Object.keys(rows[0]).map((key) => {
          const lower = key.toLowerCase();
          const isCurrency =
            lower.includes("profit") ||
            lower.includes("loss") ||
            lower.includes("pnl") ||
            lower.includes("balance") ||
            lower.includes("commission") ||
            lower.includes("swap") ||
            lower.includes("avgwin") ||
            lower.includes("avgloss") ||
            lower.includes("expectancy") ||
            lower.includes("drawdown");
          const isPercent =
            lower.includes("rate") ||
            lower.includes("percent") ||
            lower.includes("efficiency");
          const isRatio =
            lower.includes("factor") ||
            lower.includes("rr");
          return {
            key,
            label: formatFieldLabel(key),
            type: (isCurrency
              ? "currency"
              : isPercent
              ? "percent"
              : isRatio
              ? "ratio"
              : typeof rows[0][key] === "number"
              ? "number"
              : "string") as "string" | "number" | "currency" | "percent" | "ratio",
          };
        })
      : [];

  return {
    rows: rows.slice(0, plan.limit || 50),
    columns,
    tradeIds,
    summary: {
      total: rows.length,
      count: result.meta?.rowCount,
    },
  };
}

function formatFieldLabel(key: string): string {
  if (key === "modelTag" || key === "edgeName") {
    return "Edge";
  }

  const cleaned = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function buildGroupLabel(row: Record<string, any>, groupFields: string[]): string {
  return groupFields
    .map((field) => row[field])
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value))
    .join(" / ");
}

function formatMetricValue(
  key: string,
  value: unknown
): string | number | undefined {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const num = Number(cleaned);
    if (!Number.isNaN(num)) {
      value = num;
    }
  }
  if (typeof value !== "number") return value as any;

  // Profit factor - ratio format
  if (key.includes("factor")) {
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted}:1`;
  }

  // Win rate, percentages, efficiency
  if (
    key.includes("percent") ||
    key.includes("rate") ||
    key.includes("efficiency")
  ) {
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
    return `${formatted}%`;
  }

  // Currency values (profit, loss, balance, avgWin, avgLoss, expectancy, drawdown)
  if (
    key.includes("profit") ||
    key.includes("loss") ||
    key.includes("balance") ||
    key.includes("commission") ||
    key.includes("swap") ||
    key.includes("avgwin") ||
    key.includes("avgloss") ||
    key.includes("expectancy") ||
    key.includes("drawdown")
  ) {
    return `${value < 0 ? "-$" : "$"}${Math.abs(value).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  // R values (RR, risk reward)
  if (key.toLowerCase().includes("rr") || key.includes("risk")) {
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
    return `${formatted}R`;
  }

  // Time durations
  if (key.includes("hold") || key.includes("duration") || key.includes("seconds")) {
    const total = Math.max(0, Math.round(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function buildCalendarData(
  result: { data?: any; meta?: any },
  plan: TradeQueryPlan
): VizDataConfig {
  const data = result.data || [];
  const rows = Array.isArray(data) ? data : [];

  // Group by date if not already
  const byDate = new Map<string, { profit: number; count: number }>();

  for (const trade of rows) {
    const date =
      trade.closedAt?.split("T")[0] ||
      trade.openedAt?.split("T")[0] ||
      trade.date;
    if (!date) continue;

    const existing = byDate.get(date) || { profit: 0, count: 0 };
    existing.profit += Number(trade.profit) || 0;
    existing.count += 1;
    byDate.set(date, existing);
  }

  const calendarRows = Array.from(byDate.entries())
    .map(([date, data]) => ({
      date,
      profit: data.profit,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Find date range
  const dates = calendarRows.map((r) => r.date).sort();
  const dateRange =
    dates.length > 0
      ? { from: dates[0], to: dates[dates.length - 1] }
      : undefined;

  return {
    rows: calendarRows,
    dateRange,
    tradeIds: rows.map((r: any) => r.id || r.tradeId).filter(Boolean),
    summary: {
      count: rows.length,
      total: calendarRows.reduce((sum, r) => sum + r.profit, 0),
    },
  };
}

function buildWinRateData(result: { data?: any; meta?: any }): VizDataConfig {
  // Win rate is calculated from aggregates
  const aggregates = result.meta?.aggregates || {};

  return {
    value: aggregates.win_rate || aggregates.winrate || 0,
    label: "Win Rate",
    unit: "%",
    summary: {
      count: result.meta?.rowCount,
    },
  };
}

function buildDailyPnlData(result: { data?: any; meta?: any }): VizDataConfig {
  const groups = result.meta?.groups || [];

  const rows = groups.map((g: any) => ({
    date: g.date || g.open || g.openedAt,
    profit: g.daily_profit || g.profit || 0,
  }));

  return {
    rows,
    summary: {
      count: result.meta?.rowCount,
      total: rows.reduce((sum: number, r: any) => sum + (r.profit || 0), 0),
    },
  };
}

function buildLossesData(result: { data?: any; meta?: any }): VizDataConfig {
  const aggregates = result.meta?.aggregates || {};
  const toNumber = (value: any) => {
    if (typeof value === "number") return value;
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    const num = Number(cleaned);
    return Number.isNaN(num) ? 0 : num;
  };

  return {
    rows: [
      {
        label: "Commissions",
        value: Math.abs(toNumber(aggregates.total_commission)),
      },
      { label: "Swap", value: Math.abs(toNumber(aggregates.total_swap)) },
      {
        label: "Losing trades",
        value: Math.abs(toNumber(aggregates.total_loss)),
      },
    ],
    summary: {
      total: Math.abs(
        toNumber(aggregates.total_commission) +
          toNumber(aggregates.total_swap) +
          toNumber(aggregates.total_loss)
      ),
    },
  };
}

function buildTradeCountsData(result: {
  data?: any;
  meta?: any;
}): VizDataConfig {
  const groups = result.meta?.groups || [];

  return {
    rows: groups.map((g: any) => {
      const labelEntry = Object.entries(g).find(
        ([key]) => key !== "count" && key !== "trade_count"
      );
      const label = g.period || g.date || labelEntry?.[1];
      return {
        period: label,
        label,
        count: g.count || g.trade_count || 0,
      };
    }),
    summary: {
      total: groups.reduce(
        (sum: number, g: any) => sum + (g.count || g.trade_count || 0),
        0
      ),
    },
  };
}

function toNumericValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferMetricDisplayFormat(
  field?: string
): "currency" | "percent" | "ratio" | "number" {
  const lower = (field || "").toLowerCase();
  if (
    lower.includes("profit") ||
    lower.includes("loss") ||
    lower.includes("balance") ||
    lower.includes("equity") ||
    lower.includes("commission") ||
    lower.includes("swap") ||
    lower.includes("expectancy") ||
    lower.includes("drawdown")
  ) {
    return "currency";
  }
  if (lower.includes("rate") || lower.includes("efficiency")) {
    return "percent";
  }
  if (lower.includes("rr") || lower.includes("factor")) {
    return "ratio";
  }
  return "number";
}

function inferMetricPolarity(field?: string): "higher" | "lower" {
  const lower = (field || "").toLowerCase();
  if (
    lower.includes("loss") ||
    lower.includes("drawdown") ||
    lower.includes("commission") ||
    lower.includes("swap") ||
    lower.includes("slippage") ||
    lower.includes("mae")
  ) {
    return "lower";
  }
  return "higher";
}
