"use client";

import { useDateRangeStore } from "@/stores/date-range";
import CompareSwitch from "@/components/dashboard/compare-switch";
import { DailyNetBarChart } from "@/components/dashboard/charts/daily-net";
import { PerformanceWeekdayChart } from "@/components/dashboard/charts/performance-weekday";
import { PerformingAssetsBarChart } from "@/components/dashboard/charts/performing-assets";
import { EquityCurveChart } from "@/components/dashboard/charts/equity-curve";
import { DrawdownChart } from "@/components/dashboard/charts/drawdown-chart";
import { PerformanceHeatmap } from "@/components/dashboard/charts/performance-heatmap";
import { StreakDistributionChart } from "@/components/dashboard/charts/streak-distribution";
import { RMultipleDistributionChart } from "@/components/dashboard/charts/r-multiple-distribution";
import { MAEMFEScatterChart } from "@/components/dashboard/charts/mae-mfe-scatter";
import { EntryExitTimeChart } from "@/components/dashboard/charts/entry-exit-time";
import { HoldTimeScatterChart } from "@/components/dashboard/charts/hold-time-scatter";

import {
  ChartWidgetFrame,
  type ChartWidgetCardProps,
} from "./chart-card-shell";

export function DailyNetCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Daily net cumulative P&L"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="daily-net" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <DailyNetBarChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="daily-net"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function PerformanceWeekdayCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  const { start, end, min, max } = useDateRangeStore();
  const dayMs = 24 * 60 * 60 * 1000;
  const effectiveRange = (() => {
    if (!start || !end) return undefined;
    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);
    const selectedDays = Math.floor((+rangeEnd - +rangeStart) / dayMs) + 1;
    if (selectedDays >= 7) {
      return { start: rangeStart, end: rangeEnd };
    }

    const minDate = min ? new Date(min) : undefined;
    const maxDate = max ? new Date(max) : undefined;
    minDate?.setHours(0, 0, 0, 0);
    maxDate?.setHours(0, 0, 0, 0);

    let needed = 7 - selectedDays;
    const newStart = new Date(rangeStart);
    const newEnd = new Date(rangeEnd);
    const afterAvail = maxDate
      ? Math.max(0, Math.floor((+maxDate - +rangeEnd) / dayMs))
      : 0;
    const extendForward = Math.min(needed, afterAvail);
    newEnd.setDate(newEnd.getDate() + extendForward);
    needed -= extendForward;

    if (needed > 0) {
      const beforeAvail = minDate
        ? Math.max(0, Math.floor((+rangeStart - +minDate) / dayMs))
        : 0;
      const extendBack = Math.min(needed, beforeAvail);
      newStart.setDate(newStart.getDate() - extendBack);
    }

    return { start: newStart, end: newEnd };
  })();

  return (
    <ChartWidgetFrame
      title="Performance by day"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch
            ownerId="performance-weekday"
            effectiveRange={effectiveRange}
          />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <PerformanceWeekdayChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="performance-weekday"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function PerformingAssetsCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Performance by asset"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="performing-assets" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <PerformingAssetsBarChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="performing-assets"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function EquityCurveCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Equity curve"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="equity-curve" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <EquityCurveChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="equity-curve"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function DrawdownChartCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Maximum drawdown"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="drawdown-chart" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <DrawdownChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="drawdown-chart"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function PerformanceHeatmapCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Performance heat map"
      isEditing={isEditing}
      className={className}
      contentClassName="min-h-0 flex-1 flex-col"
    >
      <div className="flex h-full min-h-0 w-full flex-1 flex-col p-2.5">
        <PerformanceHeatmap accountId={accountId} currencyCode={currencyCode} />
      </div>
    </ChartWidgetFrame>
  );
}

export function StreakDistributionCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Win/Loss Streak Distribution"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="streak-distribution" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <StreakDistributionChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="streak-distribution"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function RMultipleDistributionCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="R-multiple distribution"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="r-multiple-distribution" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <RMultipleDistributionChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="r-multiple-distribution"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function MAEMFEScatterCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="MAE / MFE scatter plot"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex h-full flex-col p-3.5">
        <MAEMFEScatterChart accountId={accountId} currencyCode={currencyCode} />
      </div>
    </ChartWidgetFrame>
  );
}

export function EntryExitTimeCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
  hideComparison = false,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Entry / exit time analysis"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing || hideComparison ? null : (
          <CompareSwitch ownerId="entry-exit-time" />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <EntryExitTimeChart
          accountId={accountId}
          currencyCode={currencyCode}
          ownerId="entry-exit-time"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function HoldTimeScatterCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Hold time vs P&L"
      isEditing={isEditing}
      className={className}
      contentClassName="min-h-0 flex-1 p-3.5"
    >
      <HoldTimeScatterChart accountId={accountId} currencyCode={currencyCode} />
    </ChartWidgetFrame>
  );
}
