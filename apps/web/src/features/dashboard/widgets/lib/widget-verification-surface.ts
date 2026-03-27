"use client";

import type { ChartWidgetType } from "@/components/dashboard/chart-widgets";
import type { WidgetType } from "@/features/dashboard/widgets/lib/widget-config";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";

export type WidgetVerificationSurface =
  | {
      kind: "calendar";
      start?: string | null;
      end?: string | null;
      viewMode: "week" | "month";
      heatmapEnabled?: boolean;
      goalOverlay?: boolean;
      showWeekends?: boolean;
      summaryWidgets?: string[];
      summaryWidgetSpans?: Record<string, number>;
    }
  | {
      kind: "dashboard";
      widgets: string[];
      widgetSpans?: Record<string, number>;
      valueMode?: WidgetValueMode;
      currencyCode?: string | null;
    }
  | {
      kind: "chart";
      widgets: string[];
      start?: string | null;
      end?: string | null;
    };

const DASHBOARD_WIDGET_TITLE_TO_TYPE: Record<string, WidgetType> = {
  "Account balance": "account-balance",
  "Account contribution": "account-contribution",
  "Account equity": "account-equity",
  "Win rate": "win-rate",
  "Win streak": "win-streak",
  "Profit factor": "profit-factor",
  "Profit expectancy": "profit-expectancy",
  "Average hold time": "hold-time",
  "Average RR multiple": "average-rr",
  "Execution scorecard": "execution-scorecard",
  "Money left on table": "money-left-on-table",
  "Session performance": "session-performance",
  "Daily streak calendar": "streak-calendar",
  "Open trades": "open-trades",
  "Total losses": "total-losses",
  "Consistency score": "consistency-score",
  "Asset profitability": "asset-profitability",
  "Average trade counts": "trade-counts",
  "Daily briefing": "daily-briefing",
  Tiltmeter: "tiltmeter",
  "Edge coach": "edge-coach",
  "Rule compliance": "rule-compliance",
};

const CHART_WIDGET_TITLE_TO_TYPE: Record<string, ChartWidgetType> = {
  "Daily net cumulative P&L": "daily-net",
  "Performance by day": "performance-weekday",
  "Performance by asset": "performing-assets",
  "Equity curve": "equity-curve",
  "Maximum drawdown": "drawdown-chart",
  "Performance heat map": "performance-heatmap",
  "Win/Loss Streak Distribution": "streak-distribution",
  "R-multiple distribution": "r-multiple-distribution",
  "MAE / MFE scatter plot": "mae-mfe-scatter",
  "Entry / exit time analysis": "entry-exit-time",
  "Hold time vs P&L": "hold-time-scatter",
  "Monte Carlo simulation": "monte-carlo",
  "Rolling performance": "rolling-performance",
  "Correlation matrix": "correlation-matrix",
  "Strategy radar": "radar-comparison",
  "Risk-adjusted performance": "risk-adjusted",
  "Trade distribution - Bell curve": "bell-curve",
};

export function inferWidgetVerificationSurface(input: {
  title: string;
  start?: Date | null;
  end?: Date | null;
}): WidgetVerificationSurface | null {
  const dashboardWidget = DASHBOARD_WIDGET_TITLE_TO_TYPE[input.title];
  if (dashboardWidget) {
    return {
      kind: "dashboard",
      widgets: [dashboardWidget],
    };
  }

  const chartWidget = CHART_WIDGET_TITLE_TO_TYPE[input.title];
  if (chartWidget) {
    return {
      kind: "chart",
      widgets: [chartWidget],
      start: input.start?.toISOString() ?? null,
      end: input.end?.toISOString() ?? null,
    };
  }

  return null;
}
