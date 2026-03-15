"use client";

export type WidgetType =
  | "account-balance"
  | "account-equity"
  | "win-streak"
  | "profit-factor"
  | "win-rate"
  | "hold-time"
  | "average-rr"
  | "asset-profitability"
  | "trade-counts"
  | "profit-expectancy"
  | "total-losses"
  | "consistency-score"
  | "open-trades"
  | "execution-scorecard"
  | "money-left-on-table"
  | "session-performance"
  | "streak-calendar"
  | "tiltmeter"
  | "daily-briefing"
  | "rule-compliance"
  | "edge-coach";

export const ALL_WIDGET_TYPES: WidgetType[] = [
  "account-balance",
  "account-equity",
  "win-rate",
  "profit-factor",
  "win-streak",
  "hold-time",
  "average-rr",
  "asset-profitability",
  "trade-counts",
  "profit-expectancy",
  "total-losses",
  "consistency-score",
  "open-trades",
  "execution-scorecard",
  "money-left-on-table",
  "session-performance",
  "streak-calendar",
  "tiltmeter",
  "daily-briefing",
  "rule-compliance",
  "edge-coach",
];

export const DEFAULT_WIDGETS: WidgetType[] = [
  "account-balance",
  "win-rate",
  "profit-factor",
];

export const DEFAULT_WIDGET_SPANS: Partial<Record<WidgetType, number>> = {};

export const MAX_DASHBOARD_WIDGETS = 15;
