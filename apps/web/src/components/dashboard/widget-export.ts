"use client";

import type { WidgetType } from "@/components/dashboard/widgets";
import { toast } from "sonner";

export interface WidgetExportData {
  exportedAt: string;
  version: string;
  widgets: WidgetType[];
  spans: Partial<Record<WidgetType, number>>;
  metadata: {
    totalWidgets: number;
    widgetNames: string[];
  };
}

const widgetLabels: Record<WidgetType, string> = {
  "account-balance": "Account Balance",
  "account-equity": "Account Equity",
  "win-rate": "Win Rate",
  "profit-factor": "Profit Factor",
  "win-streak": "Win Streak",
  "hold-time": "Hold Time",
  "average-rr": "Average R:R",
  "asset-profitability": "Asset Profitability",
  "trade-counts": "Trade Counts",
  "profit-expectancy": "Profit Expectancy",
  "total-losses": "Total Losses",
  "consistency-score": "Consistency Score",
  "open-trades": "Open Trades",
  "execution-scorecard": "Execution Scorecard",
  "money-left-on-table": "Money Left on Table",
  "watchlist": "Watchlist",
  "session-performance": "Session Performance",
  "streak-calendar": "Trade Streak Calendar",
  "tiltmeter": "Tiltmeter",
  "daily-briefing": "Daily Briefing",
  "risk-intelligence": "Risk Intelligence",
  "rule-compliance": "Rule Compliance",
  "edge-coach": "Edge Coach",
  "what-if": "What If Scenarios",
  benchmark: "Platform Benchmark",
};

export function exportWidgetsAsJson(
  widgets: WidgetType[],
  spans: Partial<Record<WidgetType, number>>
): void {
  const exportData: WidgetExportData = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    widgets,
    spans,
    metadata: {
      totalWidgets: widgets.length,
      widgetNames: widgets.map((w) => widgetLabels[w] || w),
    },
  };

  const data = JSON.stringify(exportData, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-widgets-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success("Widgets exported as JSON");
}

export function exportWidgetsAsCsv(
  widgets: WidgetType[],
  spans: Partial<Record<WidgetType, number>>
): void {
  const headers = ["Position", "Widget ID", "Widget Name", "Column Span"];
  const rows = widgets.map((w, index) => [
    index + 1,
    w,
    widgetLabels[w] || w,
    spans[w]?.toString() || "1",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-widgets-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success("Widgets exported as CSV");
}

export function importWidgetsFromJson(
  file: File
): Promise<{ widgets: WidgetType[]; spans: Partial<Record<WidgetType, number>> } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as WidgetExportData;
        
        if (!Array.isArray(data.widgets)) {
          throw new Error("Invalid format: widgets array missing");
        }
        
        resolve({
          widgets: data.widgets.filter(
            (widget): widget is WidgetType =>
              typeof widget === "string" && widget in widgetLabels
          ),
          spans: data.spans || {},
        });
      } catch (error) {
        toast.error("Failed to parse widget file");
        resolve(null);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      resolve(null);
    };
    reader.readAsText(file);
  });
}

export function exportAllDashboardData(data: {
  widgets: WidgetType[];
  widgetSpans: Partial<Record<WidgetType, number>>;
  chartWidgets: string[];
  calendarWidgets: string[];
  calendarSpans: Record<string, number>;
}): void {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    dashboard: {
      widgets: data.widgets,
      widgetSpans: data.widgetSpans,
    },
    charts: {
      widgets: data.chartWidgets,
    },
    calendar: {
      widgets: data.calendarWidgets,
      spans: data.calendarSpans,
    },
    metadata: {
      totalWidgets: data.widgets.length,
      totalCharts: data.chartWidgets.length,
      totalCalendarWidgets: data.calendarWidgets.length,
    },
  };

  const jsonData = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-full-export-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success("Full dashboard exported");
}
