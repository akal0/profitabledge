"use client";

import React, { Fragment } from "react";
import { Skeleton } from "../ui/skeleton";
import {
  DndContext,
  type DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

import { ChevronDown, GripVertical } from "lucide-react";

import { DailyNetBarChart } from "./charts/daily-net";
import CompareSwitch from "./compare-switch";
import { PerformanceWeekdayChart } from "./charts/performance-weekday";
import { useDateRangeStore } from "@/stores/date-range";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";
import { PerformingAssetsBarChart } from "./charts/performing-assets";
import { EquityCurveChart } from "./charts/equity-curve";
import { DrawdownChart } from "./charts/drawdown-chart";
import { PerformanceHeatmap } from "./charts/performance-heatmap";
import { StreakDistributionChart } from "./charts/streak-distribution";
import { RMultipleDistributionChart } from "./charts/r-multiple-distribution";
import { MAEMFEScatterChart } from "./charts/mae-mfe-scatter";
import { EntryExitTimeChart } from "./charts/entry-exit-time";
import { MonteCarloChart } from "./charts/monte-carlo-chart";
import { RollingPerformanceChart } from "./charts/rolling-performance-chart";
import { CorrelationMatrix } from "./charts/correlation-matrix";
import { RadarComparisonChart } from "./charts/radar-comparison";
import { RiskAdjustedChart } from "./charts/risk-adjusted-chart";
import { BellCurveChart } from "./charts/bell-curve-chart";
import { HoldTimeScatterChart } from "./charts/hold-time-scatter";
import { WidgetWrapper } from "./widget-wrapper";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

// Widgets

function ChartWidgetFrame({
  title,
  headerRight,
  isEditing = false,
  className,
  contentClassName,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  isEditing?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const stopHeaderInteraction = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={cn("h-full p-1", className)}
      header={
        <div className="widget-header flex h-[66px] w-full items-center gap-3 px-3.5 py-3.5">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white">
            <span className="truncate">{title}</span>
          </h2>
          {headerRight ? (
            <div
              className="ml-auto flex max-w-full flex-nowrap items-center justify-end gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onPointerDown={stopHeaderInteraction}
              onClick={stopHeaderInteraction}
            >
              {headerRight}
            </div>
          ) : null}
        </div>
      }
      contentClassName={cn(
        "flex h-full min-h-0 w-full rounded-sm",
        contentClassName ?? "flex-col"
      )}
    >
      {children}
    </WidgetWrapper>
  );
}

type ChartHeaderMenuSection = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: string }>;
};

function ChartHeaderMenu({
  label = "Options",
  sections,
}: {
  label?: string;
  sections: ChartHeaderMenuSection[];
}) {
  const stopHeaderInteraction = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="h-max w-max max-w-[9rem] shrink-0 justify-start rounded-sm border border-white/5 bg-transparent px-4 py-3 text-xs text-white/70 hover:bg-sidebar-accent"
        >
          <span className="max-w-[5rem] truncate text-left">{label}</span>
          <ChevronDown className="size-3.5 text-white/40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-max min-w-[12rem] max-w-[16rem] rounded-sm border border-white/5 bg-sidebar p-1 text-white"
        onClick={stopHeaderInteraction}
        onPointerDown={stopHeaderInteraction}
      >
        <DropdownMenuLabel className="px-4 py-2.5 text-xs font-normal text-white/60">
          Options
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        {sections.length === 1 ? (
          <div className="p-1">
            <div className="px-4 pb-1 text-[11px] text-white/40">
              {sections[0].label}
            </div>
            <DropdownMenuRadioGroup
              value={sections[0].value}
              onValueChange={sections[0].onValueChange}
            >
              {sections[0].items.map((item) => (
                <DropdownMenuRadioItem
                  key={item.value}
                  value={item.value}
                  className="px-4 py-2.5 text-xs text-white/75 focus:bg-sidebar-accent focus:text-white"
                >
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
        ) : (
          sections.map((section) => (
            <DropdownMenuSub key={section.label}>
              <DropdownMenuSubTrigger className="rounded-sm px-4 py-2.5 text-xs text-white/75 focus:bg-sidebar-accent focus:text-white data-[state=open]:bg-sidebar-accent data-[state=open]:text-white">
                <span>{section.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-max min-w-[12rem] max-w-[16rem] rounded-sm border border-white/5 bg-sidebar p-1 text-white">
                <DropdownMenuRadioGroup
                  value={section.value}
                  onValueChange={section.onValueChange}
                >
                  {section.items.map((item) => (
                    <DropdownMenuRadioItem
                      key={item.value}
                      value={item.value}
                      className="px-4 py-2.5 text-xs text-white/75 focus:bg-sidebar-accent focus:text-white"
                    >
                      {item.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DailyNetCard({
  accountId,
  isEditing = false,
  className,
  hideComparison = false,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
  hideComparison?: boolean;
}) {
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
      <div className="flex flex-col p-3.5 h-full">
        <DailyNetBarChart
          accountId={accountId}
          ownerId="daily-net"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function PerformanceWeekdayCard({
  accountId,
  isEditing = false,
  className,
  hideComparison = false,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
  hideComparison?: boolean;
}) {
  const { start, end, min, max } = useDateRangeStore();
  const dayMs = 24 * 60 * 60 * 1000;
  const effectiveRange = (() => {
    if (!start || !end) return undefined;
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const selectedDays = Math.floor((+e - +s) / dayMs) + 1;
    if (selectedDays >= 7) return { start: s, end: e };
    const minD = min ? new Date(min) : undefined;
    const maxD = max ? new Date(max) : undefined;
    minD?.setHours(0, 0, 0, 0);
    maxD?.setHours(0, 0, 0, 0);
    let needed = 7 - selectedDays;
    let newStart = new Date(s);
    let newEnd = new Date(e);
    // Prefer extending forward first
    const afterAvail = maxD ? Math.max(0, Math.floor((+maxD - +e) / dayMs)) : 0;
    const extendFwd = Math.min(needed, afterAvail);
    newEnd.setDate(newEnd.getDate() + extendFwd);
    needed -= extendFwd;
    if (needed > 0) {
      const beforeAvail = minD
        ? Math.max(0, Math.floor((+s - +minD) / dayMs))
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
      <div className="flex flex-col p-3.5 h-full">
        <PerformanceWeekdayChart
          accountId={accountId}
          ownerId="performance-weekday"
          comparisonMode={hideComparison ? "none" : undefined}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function PerformingAssetsCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Performance by asset"
      isEditing={isEditing}
      className={className}
      headerRight={isEditing ? null : <CompareSwitch ownerId="performing-assets" />}
    >
      <div className="flex flex-col p-3.5 h-full">
        <PerformingAssetsBarChart
          accountId={accountId}
          ownerId="performing-assets"
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function EquityCurveCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Equity curve"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <EquityCurveChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function DrawdownChartCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Maximum drawdown"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <DrawdownChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function PerformanceHeatmapCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Performance Heat Map"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <PerformanceHeatmap accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function StreakDistributionCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Win/Loss Streak Distribution"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <StreakDistributionChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function RMultipleDistributionCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="R-Multiple Distribution"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <RMultipleDistributionChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function MAEMFEScatterCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="MAE/MFE Scatter Plot"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <MAEMFEScatterChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function EntryExitTimeCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Entry/Exit Time Analysis"
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full">
        <EntryExitTimeChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

export function HoldTimeScatterCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Hold Time vs P&L"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-1 min-h-0 p-3.5"
    >
      <HoldTimeScatterChart accountId={accountId} />
    </ChartWidgetFrame>
  );
}

export function MonteCarloCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [simCount, setSimCount] = React.useState(100);

  return (
    <ChartWidgetFrame
      title="Monte Carlo simulation"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Simulation paths",
                value: String(simCount),
                onValueChange: (value) => setSimCount(Number(value)),
                items: [
                  { label: "50 paths", value: "50" },
                  { label: "100 paths", value: "100" },
                  { label: "200 paths", value: "200" },
                  { label: "500 paths", value: "500" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="flex flex-col p-3.5 h-full">
        <MonteCarloChart accountId={accountId} simCount={simCount} />
      </div>
    </ChartWidgetFrame>
  );
}

export function RollingPerformanceCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [metric, setMetric] = React.useState<
    "winRate" | "profitFactor" | "avgRR" | "expectancy"
  >("winRate");
  const [window, setWindow] = React.useState<10 | 20 | 50>(20);

  return (
    <ChartWidgetFrame
      title="Rolling Performance"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Metric",
                value: metric,
                onValueChange: (value) =>
                  setMetric(
                    value as "winRate" | "profitFactor" | "avgRR" | "expectancy"
                  ),
                items: [
                  { label: "Win rate", value: "winRate" },
                  { label: "Profit factor", value: "profitFactor" },
                  { label: "Avg R:R", value: "avgRR" },
                  { label: "Expectancy", value: "expectancy" },
                ],
              },
              {
                label: "Window",
                value: String(window),
                onValueChange: (value) =>
                  setWindow(Number(value) as 10 | 20 | 50),
                items: [
                  { label: "10 trades", value: "10" },
                  { label: "20 trades", value: "20" },
                  { label: "50 trades", value: "50" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="flex flex-col p-3.5 h-full">
        <RollingPerformanceChart
          accountId={accountId}
          metric={metric}
          window={window}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function CorrelationMatrixCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [rowAxis, setRowAxis] = React.useState<
    "session" | "symbol" | "direction"
  >("session");
  const [colAxis, setColAxis] = React.useState<
    "session" | "symbol" | "direction"
  >("symbol");
  const [metric, setMetric] = React.useState<"winRate" | "avgRR" | "pnl" | "count">(
    "winRate"
  );

  return (
    <ChartWidgetFrame
      title="Correlation matrix"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-1 min-h-0"
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Rows",
                value: rowAxis,
                onValueChange: (value) =>
                  setRowAxis(value as "session" | "symbol" | "direction"),
                items: [
                  { label: "Session", value: "session" },
                  { label: "Symbol", value: "symbol" },
                  { label: "Direction", value: "direction" },
                ],
              },
              {
                label: "Columns",
                value: colAxis,
                onValueChange: (value) =>
                  setColAxis(value as "session" | "symbol" | "direction"),
                items: [
                  { label: "Session", value: "session" },
                  { label: "Symbol", value: "symbol" },
                  { label: "Direction", value: "direction" },
                ],
              },
              {
                label: "Metric",
                value: metric,
                onValueChange: (value) =>
                  setMetric(value as "winRate" | "avgRR" | "pnl" | "count"),
                items: [
                  { label: "Win %", value: "winRate" },
                  { label: "Avg RR", value: "avgRR" },
                  { label: "P&L", value: "pnl" },
                  { label: "Count", value: "count" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="h-full w-full pl-1 pr-2 pt-2 pb-2">
        <CorrelationMatrix
          accountId={accountId}
          rowAxis={rowAxis}
          colAxis={colAxis}
          metric={metric}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function RadarComparisonCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [groupBy, setGroupBy] = React.useState<"session" | "symbol">(
    "session"
  );

  return (
    <ChartWidgetFrame
      title="Strategy radar"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-1 min-h-0"
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Group by",
                value: groupBy,
                onValueChange: (value) =>
                  setGroupBy(value as "session" | "symbol"),
                items: [
                  { label: "Session", value: "session" },
                  { label: "Symbol", value: "symbol" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="h-full w-full p-3.5 pt-2">
        <RadarComparisonChart accountId={accountId} groupBy={groupBy} />
      </div>
    </ChartWidgetFrame>
  );
}

export function RiskAdjustedCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [metric, setMetric] = React.useState<
    "sharpe" | "sortino" | "calmar" | "riskAdjustedEquity"
  >("sharpe");
  const [window, setWindow] = React.useState<10 | 20 | 50>(20);

  return (
    <ChartWidgetFrame
      title="Risk-adjusted performance"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-1 min-h-0 p-3.5"
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Metric",
                value: metric,
                onValueChange: (value) =>
                  setMetric(
                    value as
                      | "sharpe"
                      | "sortino"
                      | "calmar"
                      | "riskAdjustedEquity"
                  ),
                items: [
                  { label: "Sharpe ratio", value: "sharpe" },
                  { label: "Sortino ratio", value: "sortino" },
                  { label: "Calmar ratio", value: "calmar" },
                  { label: "Risk-adj equity", value: "riskAdjustedEquity" },
                ],
              },
              {
                label: "Window",
                value: String(window),
                onValueChange: (value) =>
                  setWindow(Number(value) as 10 | 20 | 50),
                items: [
                  { label: "10 trades", value: "10" },
                  { label: "20 trades", value: "20" },
                  { label: "50 trades", value: "50" },
                ],
              },
            ]}
          />
        )
      }
    >
      <RiskAdjustedChart accountId={accountId} metric={metric} window={window} />
    </ChartWidgetFrame>
  );
}

export function BellCurveCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <ChartWidgetFrame
      title="Trade distribution - Bell curve"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-1 min-h-0"
    >
      <div className="h-full w-full p-3.5 pt-2">
        <BellCurveChart accountId={accountId} />
      </div>
    </ChartWidgetFrame>
  );
}

// ========================
// Chart Widget Mapping & Types
// ========================

// Define your chart widget mapping here. Add/remove keys and components freely.
const chartCardComponents = {
  "daily-net": DailyNetCard,
  "performance-weekday": PerformanceWeekdayCard,
  "performing-assets": PerformingAssetsCard,
  "equity-curve": EquityCurveCard,
  "drawdown-chart": DrawdownChartCard,
  "performance-heatmap": PerformanceHeatmapCard,
  "streak-distribution": StreakDistributionCard,
  "r-multiple-distribution": RMultipleDistributionCard,
  "mae-mfe-scatter": MAEMFEScatterCard,
  "entry-exit-time": EntryExitTimeCard,
  "hold-time-scatter": HoldTimeScatterCard,
  "monte-carlo": MonteCarloCard,
  "rolling-performance": RollingPerformanceCard,
  "correlation-matrix": CorrelationMatrixCard,
  "radar-comparison": RadarComparisonCard,
  "risk-adjusted": RiskAdjustedCard,
  "bell-curve": BellCurveCard,
} as const;

// Backward-compatibility for older saved keys in DB
const widgetKeyAliases: Record<string, keyof typeof chartCardComponents> = {
  daily: "daily-net",
  performance: "performance-weekday",
  performingAssets: "performing-assets",
};

// Widget types are derived from the mapping keys so you don't have to update a separate type
export type ChartWidgetType = keyof typeof chartCardComponents;

// ========================
// TopWidgets Container Component
// ========================
export interface ChartWidgetsProps {
  enabledWidgets: ChartWidgetType[];
  accountId?: string;
  isEditing?: boolean;
  onToggleWidget?: (type: ChartWidgetType) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEnterEdit?: () => void;
}

export function ChartWidgets({
  enabledWidgets,
  accountId,
  isEditing = false,
  onToggleWidget,
  onReorder,
  onEnterEdit,
}: ChartWidgetsProps) {
  const setFocusedWidgetId = useDashboardAssistantContextStore(
    (state) => state.setFocusedWidgetId
  );
  // Ensure only 12 widgets maximum displayed (increased from 6)
  const displayWidgets = enabledWidgets.slice(0, 12);

  // Fill empty slots with placeholder divs
  const emptySlots = Math.max(0, 12 - displayWidgets.length);

  // All possible widgets for discovery in edit mode (derived from mapping)
  const allWidgets: ChartWidgetType[] = Object.keys(
    chartCardComponents
  ) as Array<keyof typeof chartCardComponents> as ChartWidgetType[];

  const availableWidgets = allWidgets.filter(
    (w) => !displayWidgets.includes(w)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditing) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayWidgets.indexOf(active.id as ChartWidgetType);
    const newIndex = displayWidgets.indexOf(over.id as ChartWidgetType);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(oldIndex, newIndex);
  };

  // long-press to enter edit mode
  let pressTimer: any = null;
  const handlePointerDown = () => {
    if (isEditing) return;
    pressTimer = setTimeout(() => onEnterEdit?.(), 500);
  };
  const handlePointerUp = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={displayWidgets} strategy={rectSortingStrategy}>
        <div className="grid auto-rows-min gap-1.5 md:grid-cols-4 2xl:grid-cols-3 ">
          {accountId ? (
            displayWidgets.map((widgetType, index) => {
              const resolvedKey =
                (widgetKeyAliases as any)[widgetType] ?? widgetType;
              const CardComponent = (chartCardComponents as any)[
                resolvedKey
              ] as React.ComponentType<any> | undefined;
              if (!CardComponent) {
                // Skip unknown/legacy keys to avoid runtime errors
                if (
                  process &&
                  (process as any).env?.NODE_ENV !== "production"
                ) {
                  // eslint-disable-next-line no-console
                  console.warn(
                    "Unknown chart widget key:",
                    widgetType,
                    "→ resolved:",
                    resolvedKey
                  );
                }
                return null;
              }
              return (
                <SortableWidget
                  key={`${widgetType}-${index}`}
                  id={widgetType}
                  disabled={!isEditing}
                >
                  <div
                    className="h-124 w-full relative cursor-pointer"
                    onPointerEnter={() => setFocusedWidgetId(widgetType)}
                    onFocusCapture={() => setFocusedWidgetId(widgetType)}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onClick={() => isEditing && onToggleWidget?.(widgetType)}
                  >
                    {/* checkmark when selected in edit mode */}
                    {isEditing ? (
                      <div className="flex items-center absolute right-5 top-5 z-10 gap-2">
                        <div className="size-6 border border-white/5 flex items-center justify-center">
                          <svg
                            viewBox="0 0 24 24"
                            className="size-3 fill-white"
                          >
                            <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9 9a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L10.5 14.5l8.293-8.293a1 1 0 0 1 1.492.5z" />
                          </svg>
                        </div>

                        <GripVertical className="size-4 text-white/30" />
                      </div>
                    ) : null}
                    <CardComponent
                      accountId={accountId}
                      isEditing={isEditing}
                      className="w-full h-full"
                    />
                    {isEditing ? (
                      <>
                        <div
                          className="absolute left-0 top-0 w-full h-3 cursor-ns-resize"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div
                          className="absolute left-0 bottom-0 w-full h-3 cursor-ns-resize"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </>
                    ) : null}
                  </div>
                </SortableWidget>
              );
            })
          ) : (
            <Fragment>
              {Array.from({ length: 3 }).map((_, index) => (
                <WidgetWrapper
                  key={`empty-${index}`}
                  className="h-max w-full p-1"
                  header={
                    <div className="flex w-full justify-between items-center p-3.5 widget-header">
                      <Skeleton className="w-24 h-5 rounded-none bg-sidebar-accent" />
                      <Skeleton className="w-16 h-5 rounded-none bg-sidebar-accent" />
                    </div>
                  }
                >
                  <div className="flex flex-col gap-6 p-3.5 h-full items-start justify-between">
                    <div className="flex gap-2">
                      <Skeleton className="w-16 h-4 rounded-none bg-sidebar" />
                      <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />
                      <Skeleton className="w-32 h-4 rounded-none bg-sidebar" />
                    </div>

                    <div className="flex gap-4 w-full h-max">
                      <div className="flex flex-col gap-4 w-16 h-full pb-8">
                        {Array.from({ length: 8 }).map((_, index) => (
                          <Skeleton
                            key={index}
                            className="w-full h-4 rounded-none bg-sidebar"
                          />
                        ))}
                      </div>

                      <div className="flex flex-col gap-4 w-full">
                        <Skeleton className="w-full h-full rounded-none bg-sidebar" />

                        <div className="flex gap-4 w-full h-max">
                          {Array.from({ length: 7 }).map((_, index) => (
                            <Skeleton
                              key={index}
                              className="w-full h-4 rounded-none bg-sidebar"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </WidgetWrapper>
              ))}
            </Fragment>
          )}

          {/* In edit mode, show available widgets with 50% opacity */}
          {isEditing &&
            availableWidgets.map((widgetType, index) => {
              const CardComponent = chartCardComponents[widgetType];
              return (
                <div
                  key={`available-${widgetType}-${index}`}
                  className="h-124 opacity-50 hover:opacity-100 transition-all duration-150 hover:animate-none"
                  onClick={() => onToggleWidget?.(widgetType)}
                >
                  {/* checkmark hidden since not selected yet */}
                  <CardComponent accountId={accountId} isEditing={true} className="w-full h-full" />
                </div>
              );
            })}

          {/* Empty placeholder slots */}
          {isEditing &&
            Array.from({ length: emptySlots }).map((_, index) => (
              <WidgetWrapper
                className="h-124 w-full p-1"
                key={`empty-${index}`}
                header={
                  <div className="flex w-full justify-between items-center p-3.5 widget-header">
                    <Skeleton className="w-32 rounded-none h-4 bg-sidebar-accent" />
                    <Skeleton className="w-16 h-4 rounded-none bg-sidebar-accent" />
                  </div>
                }
              >
                <div className="flex flex-col gap-4 p-3.5 h-full justify-between">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="w-12 h-4 rounded-none bg-sidebar" />
                    <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />
                  </div>

                  <Skeleton className="w-full h-48 h-full rounded-none bg-sidebar" />
                </div>
              </WidgetWrapper>
            ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
