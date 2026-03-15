"use client";

export type DayRow = {
  dateISO: string;
  totalProfit: number;
  percent: number;
  count: number;
  dayNumber?: number;
};

export type ViewMode = "week" | "month";

export type CalendarRange = {
  start: Date;
  end: Date;
};

export type CalendarWidgetType =
  | "net-pl"
  | "win-rate"
  | "largest-trade"
  | "largest-loss"
  | "hold-time"
  | "avg-trade";

export const MAX_CALENDAR_WIDGETS = 6;

export const DEFAULT_CALENDAR_WIDGETS: CalendarWidgetType[] = [
  "net-pl",
  "win-rate",
  "largest-trade",
  "largest-loss",
  "hold-time",
  "avg-trade",
];

export const DEFAULT_CALENDAR_WIDGET_SPANS: Partial<
  Record<CalendarWidgetType, number>
> = {};

export const defaultCalendarWidgets = DEFAULT_CALENDAR_WIDGETS;
export const defaultCalendarWidgetSpans = DEFAULT_CALENDAR_WIDGET_SPANS;

export type RangeSummary = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  largestTrade: number | null;
  largestLoss: number | null;
  avgHoldSeconds: number | null;
};

export type CalendarGoal = {
  id: string;
  title: string;
  type: string;
  targetType: string;
  targetValue: string;
  currentValue: string;
  status: string;
  startDate: string;
  deadline: string | null;
};

export type GoalMarker = {
  title: string;
  type: string;
  status: string;
  isStart: boolean;
  isDeadline: boolean;
  progress: number;
};

export type TradePreview = {
  id: string;
  symbol: string;
  open: string;
  profit: number;
  holdSeconds: number;
};

export type CalendarPreviewState = Record<
  string,
  {
    loading: boolean;
    trades: TradePreview[];
  }
>;

export type MonthSummary = {
  totalProfit: number;
  totalTrades: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  avgPerTrade: number;
  avgPerActiveDay: number;
  bestDay: DayRow | null;
  worstDay: DayRow | null;
  startLabel: string;
  endLabel: string;
};
