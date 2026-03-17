"use client";

import { SummaryCard } from "./summary-card";
import {
  MAX_CALENDAR_WIDGETS,
  type CalendarWidgetType,
  type MonthSummary,
  type RangeSummary,
} from "../lib/calendar-types";
import {
  formatDuration,
  formatMoney,
  formatPercent,
  formatShortDate,
  fromDateISO,
} from "../lib/calendar-utils";

type CalendarSummarySidebarProps = {
  summaryWidgets: CalendarWidgetType[];
  summaryWidgetSpans: Partial<Record<CalendarWidgetType, number>>;
  monthSummary: MonthSummary | null;
  rangeSummary: RangeSummary | null;
  summaryLoading: boolean;
  rangeLabel: string;
};

type ExpandedSummaryWidget = {
  key: string;
  type: CalendarWidgetType;
  span: number;
  weekIndex?: number;
};

function getSummarySpan(
  summaryWidgetSpans: Partial<Record<CalendarWidgetType, number>>,
  type: CalendarWidgetType
) {
  const raw = Number(summaryWidgetSpans[type] ?? 1);
  return Math.max(1, Math.min(2, Math.round(Number.isFinite(raw) ? raw : 1)));
}

function getProfitTone(value: number) {
  return value >= 0 ? "text-teal-400" : "text-rose-400";
}

function formatWeekSubtext(week: MonthSummary["weeklyBreakdown"][number]) {
  const range = `${week.startLabel} - ${week.endLabel}`;
  if (week.totalTrades <= 0) {
    return `${range} · No trades`;
  }

  return `${range} · ${week.totalTrades} trade${week.totalTrades === 1 ? "" : "s"}`;
}

function expandSummaryWidgets(
  summaryWidgets: CalendarWidgetType[],
  summaryWidgetSpans: Partial<Record<CalendarWidgetType, number>>,
  monthSummary: MonthSummary | null
) {
  const expanded: ExpandedSummaryWidget[] = [];

  for (const [index, widgetType] of summaryWidgets.entries()) {
    if (widgetType === "weekly-breakdown") {
      const weeks = monthSummary?.weeklyBreakdown ?? [];

      if (weeks.length > 0) {
        for (const [weekIndex, week] of weeks.entries()) {
          expanded.push({
            key: `weekly-breakdown-${week.label}-${week.startLabel}-${weekIndex}`,
            type: widgetType,
            span: 1,
            weekIndex,
          });
        }
      } else {
        expanded.push({
          key: `weekly-breakdown-${index}`,
          type: widgetType,
          span: 1,
        });
      }

      continue;
    }

    expanded.push({
      key: `${widgetType}-${index}`,
      type: widgetType,
      span: getSummarySpan(summaryWidgetSpans, widgetType),
    });
  }

  return expanded.slice(0, MAX_CALENDAR_WIDGETS);
}

function renderSummaryWidget(
  type: CalendarWidgetType,
  monthSummary: MonthSummary | null,
  rangeSummary: RangeSummary | null,
  summaryLoading: boolean,
  rangeLabel: string,
  weekIndex?: number
) {
  switch (type) {
    case "net-pl": {
      const total = monthSummary?.totalProfit ?? 0;
      return (
        <SummaryCard
          title="Net P/L"
          value={monthSummary ? formatMoney(total) : "—"}
          subtext={rangeLabel}
          accentClass={total >= 0 ? "text-teal-400" : "text-rose-400"}
          loading={!monthSummary}
        />
      );
    }
    case "weekly-breakdown": {
      if (!monthSummary) {
        return <SummaryCard title="Week 1" value="—" loading />;
      }
      const week = monthSummary.weeklyBreakdown[weekIndex ?? 0] ?? null;

      if (!week) {
        return (
          <SummaryCard
            title={`Week ${(weekIndex ?? 0) + 1}`}
            value="—"
            subtext="Not in this range"
          />
        );
      }

      return (
        <SummaryCard
          title={week.label}
          value={formatMoney(week.totalProfit)}
          subtext={formatWeekSubtext(week)}
          accentClass={getProfitTone(week.totalProfit)}
        />
      );
    }
    case "active-days":
      return (
        <SummaryCard
          title="Active days"
          value={monthSummary?.activeDays ?? "—"}
          subtext={
            monthSummary
              ? `${monthSummary.winDays} green · ${monthSummary.lossDays} red`
              : "—"
          }
          loading={!monthSummary}
        />
      );
    case "avg-active-day": {
      const value =
        monthSummary && monthSummary.activeDays > 0
          ? formatMoney(monthSummary.avgPerActiveDay)
          : "—";
      return (
        <SummaryCard
          title="Avg active day"
          value={value}
          subtext={
            monthSummary?.activeDays
              ? `${monthSummary.activeDays} active day${monthSummary.activeDays === 1 ? "" : "s"}`
              : "—"
          }
          accentClass={
            monthSummary && monthSummary.avgPerActiveDay < 0
              ? "text-rose-400"
              : "text-teal-400"
          }
          loading={!monthSummary}
        />
      );
    }
    case "best-day": {
      const bestDay = monthSummary?.bestDay ?? null;
      return (
        <SummaryCard
          title="Best day"
          value={bestDay ? formatMoney(bestDay.totalProfit) : "—"}
          subtext={
            bestDay ? formatShortDate(fromDateISO(bestDay.dateISO)) : "—"
          }
          accentClass="text-teal-400"
          loading={!monthSummary}
        />
      );
    }
    case "worst-day": {
      const worstDay = monthSummary?.worstDay ?? null;
      return (
        <SummaryCard
          title="Worst day"
          value={worstDay ? formatMoney(worstDay.totalProfit) : "—"}
          subtext={
            worstDay ? formatShortDate(fromDateISO(worstDay.dateISO)) : "—"
          }
          accentClass="text-rose-400"
          loading={!monthSummary}
        />
      );
    }
    case "win-rate":
      return (
        <SummaryCard
          title="Win rate"
          value={rangeSummary ? formatPercent(rangeSummary.winRate) : "—"}
          subtext={
            rangeSummary ? `${rangeSummary.wins}W · ${rangeSummary.losses}L` : "—"
          }
          loading={summaryLoading || !rangeSummary}
        />
      );
    case "largest-trade": {
      const value =
        rangeSummary?.largestTrade != null
          ? formatMoney(rangeSummary.largestTrade)
          : "—";
      return (
        <SummaryCard
          title="Largest trade"
          value={value}
          subtext={
            rangeSummary?.totalTrades ? `${rangeSummary.totalTrades} trades` : "—"
          }
          accentClass="text-teal-400"
          loading={summaryLoading || !rangeSummary}
        />
      );
    }
    case "largest-loss": {
      const value =
        rangeSummary?.largestLoss != null
          ? formatMoney(rangeSummary.largestLoss)
          : "—";
      return (
        <SummaryCard
          title="Largest loss"
          value={value}
          subtext={
            rangeSummary?.losses != null
              ? `${rangeSummary.losses} losing trades`
              : "—"
          }
          accentClass="text-rose-400"
          loading={summaryLoading || !rangeSummary}
        />
      );
    }
    case "hold-time":
      return (
        <SummaryCard
          title="Hold time"
          value={formatDuration(rangeSummary?.avgHoldSeconds)}
          subtext={
            rangeSummary?.totalTrades
              ? `Avg over ${rangeSummary.totalTrades} trades`
              : "—"
          }
          loading={summaryLoading || !rangeSummary}
        />
      );
    case "avg-trade": {
      const hasTrades = (monthSummary?.totalTrades ?? 0) > 0;
      const avgValue = hasTrades ? formatMoney(monthSummary?.avgPerTrade ?? 0) : "—";
      return (
        <SummaryCard
          title="Avg per trade"
          value={avgValue}
          subtext={
            monthSummary?.totalTrades ? `${monthSummary.totalTrades} trades` : "—"
          }
          accentClass={
            hasTrades && (monthSummary?.avgPerTrade ?? 0) >= 0
              ? "text-teal-400"
              : "text-rose-400"
          }
          loading={!monthSummary}
        />
      );
    }
    default:
      return null;
  }
}

export function CalendarSummarySidebar({
  summaryWidgets,
  summaryWidgetSpans,
  monthSummary,
  rangeSummary,
  summaryLoading,
  rangeLabel,
}: CalendarSummarySidebarProps) {
  const summaryWidgetList = expandSummaryWidgets(
    summaryWidgets,
    summaryWidgetSpans,
    monthSummary
  );

  return (
    <div className="grid h-full grid-cols-1 grid-rows-6 gap-2">
      {summaryWidgetList.map((widget) => {
        return (
          <div
            key={widget.key}
            className="h-full"
            style={{ gridRow: `span ${widget.span} / span ${widget.span}` }}
          >
            {renderSummaryWidget(
              widget.type,
              monthSummary,
              rangeSummary,
              summaryLoading,
              rangeLabel,
              widget.weekIndex
            )}
          </div>
        );
      })}
    </div>
  );
}
