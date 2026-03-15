"use client";

import { type ComponentType, Fragment, useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import EditWidgets from "@/public/icons/edit-widgets.svg";

import PickerComponent from "@/components/dashboard/calendar/picker";
import { ChartWidgetPresets } from "@/components/dashboard/chart-widget-presets";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { countRangeDays } from "@/components/dashboard/chart-comparison-utils";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";
import { useDateRangeStore } from "@/stores/date-range";
import {
  BellCurveCard,
  CorrelationMatrixCard,
  MonteCarloCard,
  RadarComparisonCard,
  RiskAdjustedCard,
  RollingPerformanceCard,
} from "@/features/dashboard/charts/components/analytics-chart-cards";
import type { ChartWidgetCardProps } from "@/features/dashboard/charts/components/chart-card-shell";
import {
  DailyNetCard,
  DrawdownChartCard,
  EntryExitTimeCard,
  EquityCurveCard,
  HoldTimeScatterCard,
  MAEMFEScatterCard,
  PerformanceHeatmapCard,
  PerformanceWeekdayCard,
  PerformingAssetsCard,
  RMultipleDistributionCard,
  StreakDistributionCard,
} from "@/features/dashboard/charts/components/comparison-chart-cards";

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

export const CHART_WIDGET_KEY_ALIASES: Record<
  string,
  keyof typeof chartCardComponents
> = {
  daily: "daily-net",
  performance: "performance-weekday",
  performingAssets: "performing-assets",
};

export type ChartWidgetType = keyof typeof chartCardComponents;
export const ALL_CHART_WIDGET_TYPES = Object.keys(
  chartCardComponents
) as ChartWidgetType[];
export const DEFAULT_CHART_WIDGETS: ChartWidgetType[] = [
  "daily-net",
  "performance-weekday",
  "performing-assets",
];

export interface ChartWidgetsProps {
  enabledWidgets: ChartWidgetType[];
  accountId?: string;
  isEditing?: boolean;
  onToggleWidget?: (type: ChartWidgetType) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEnterEdit?: () => void;
  onToggleEdit?: () => void;
  onApplyPreset?: (widgets: ChartWidgetType[]) => void | Promise<void>;
}

const ACTION_BUTTON_CLASS =
  "flex h-[38px] w-max items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110";

const ACTION_GROUP_CLASS =
  "flex items-center overflow-hidden rounded-sm border border-white/5 bg-sidebar";

const ACTION_GROUP_BUTTON_CLASS =
  "h-[38px] rounded-none border-0 bg-sidebar px-3 py-2 text-xs text-white transition-colors hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-sidebar";

const CHART_WIDGET_PICKER_POPOVER_MAX_WIDTH_REM = 16;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameCalendarMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function clampRangeToBounds(
  range: { start: Date; end: Date },
  bounds: { min: Date; max: Date }
) {
  const nextStart = new Date(range.start);
  const nextEnd = new Date(range.end);

  if (nextStart < bounds.min) {
    nextStart.setTime(bounds.min.getTime());
  }
  if (nextEnd > bounds.max) {
    nextEnd.setTime(bounds.max.getTime());
  }

  return { start: nextStart, end: nextEnd };
}

export function ChartWidgets({
  enabledWidgets,
  accountId,
  isEditing = false,
  onToggleWidget,
  onReorder,
  onEnterEdit,
  onToggleEdit,
  onApplyPreset,
}: ChartWidgetsProps) {
  const setFocusedWidgetId = useDashboardAssistantContextStore(
    (state) => state.setFocusedWidgetId
  );
  const { start, end, min, max, setRange } = useDateRangeStore();

  const displayWidgets = enabledWidgets;
  const availableWidgets = useMemo(
    () =>
      ALL_CHART_WIDGET_TYPES.filter(
        (widget) => !enabledWidgets.includes(widget)
      ),
    [enabledWidgets]
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

  const handleDoubleClick = () => {
    if (isEditing) return;
    onEnterEdit?.();
  };

  const bounds = useMemo(() => {
    if (!min || !max) return null;
    return { min: new Date(min), max: new Date(max) };
  }, [max, min]);

  const resolvedRange = useMemo(() => {
    if (start && end) {
      return { start: new Date(start), end: new Date(end) };
    }
    if (!bounds) return null;
    const fallbackEnd = new Date(bounds.max);
    const fallbackStart = new Date(bounds.max);
    fallbackStart.setDate(fallbackStart.getDate() - 29);
    return {
      start: fallbackStart < bounds.min ? new Date(bounds.min) : fallbackStart,
      end: fallbackEnd,
    };
  }, [bounds, end, start]);

  const availableDays = useMemo(() => {
    if (!bounds) return 1;
    return countRangeDays({ start: bounds.min, end: bounds.max });
  }, [bounds]);
  const showDatePicker = Boolean(bounds && resolvedRange);
  const showMonthSelector = Boolean(
    bounds && !isSameCalendarMonth(bounds.min, bounds.max)
  );

  const applyRange = (nextStart: Date, nextEnd: Date) => {
    setRange(nextStart, nextEnd);
  };

  const activeMonthStart = useMemo(
    () => (resolvedRange ? startOfMonth(resolvedRange.start) : null),
    [resolvedRange]
  );

  const isAllTimeRange = useMemo(() => {
    if (!resolvedRange || !bounds) return false;
    return (
      isSameCalendarDay(resolvedRange.start, bounds.min) &&
      isSameCalendarDay(resolvedRange.end, bounds.max)
    );
  }, [bounds, resolvedRange]);

  const activeMonthLabel = useMemo(() => {
    if (isAllTimeRange) return "All time";
    if (!activeMonthStart) return "";
    return activeMonthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [activeMonthStart, isAllTimeRange]);

  const canNavigatePrevious = useMemo(() => {
    if (isAllTimeRange || !activeMonthStart || !bounds) return false;
    return activeMonthStart.getTime() > startOfMonth(bounds.min).getTime();
  }, [activeMonthStart, bounds, isAllTimeRange]);

  const canNavigateNext = useMemo(() => {
    if (isAllTimeRange || !activeMonthStart || !bounds) return false;
    return activeMonthStart.getTime() < startOfMonth(bounds.max).getTime();
  }, [activeMonthStart, bounds, isAllTimeRange]);

  const quickRanges = useMemo(() => {
    if (!bounds || availableDays <= 1) {
      return [];
    }

    const ranges: Array<{
      label: string;
      getRange: (minDate: Date, maxDate: Date) => { start: Date; end: Date };
    }> = [];

    if (!isSameCalendarMonth(bounds.min, bounds.max)) {
      ranges.push({
        label: "Earliest month",
        getRange: (minDate: Date, maxDate: Date) => {
          let nextStart = startOfMonth(minDate);
          let nextEnd = endOfMonth(minDate);
          if (nextStart < minDate) nextStart = new Date(minDate);
          if (nextEnd > maxDate) nextEnd = new Date(maxDate);
          return { start: nextStart, end: nextEnd };
        },
      });
      ranges.push({
        label: "Latest month",
        getRange: (minDate: Date, maxDate: Date) => {
          let nextStart = startOfMonth(maxDate);
          let nextEnd = endOfMonth(maxDate);
          if (nextStart < minDate) nextStart = new Date(minDate);
          if (nextEnd > maxDate) nextEnd = new Date(maxDate);
          return { start: nextStart, end: nextEnd };
        },
      });
    }

    ranges.push({
      label: "All time",
      getRange: (minDate: Date, maxDate: Date) => ({
        start: new Date(minDate),
        end: new Date(maxDate),
      }),
    });

    return ranges;
  }, [availableDays, bounds]);

  const handleMonthStep = (direction: -1 | 1) => {
    if (!activeMonthStart || !bounds) return;
    const nextMonth = addMonths(activeMonthStart, direction);
    const nextRange = clampRangeToBounds(
      {
        start: startOfMonth(nextMonth),
        end: endOfMonth(nextMonth),
      },
      bounds
    );
    applyRange(nextRange.start, nextRange.end);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        {showDatePicker && bounds && resolvedRange ? (
          <div className="min-w-[13rem]">
            <PickerComponent
              defaultStart={resolvedRange.start}
              defaultEnd={resolvedRange.end}
              minDate={bounds.min}
              maxDate={bounds.max}
              valueStart={resolvedRange.start}
              valueEnd={resolvedRange.end}
              minDays={1}
              maxDays={availableDays}
              quickRanges={quickRanges}
              fillWidth
              popoverClassName="min-w-[28rem]"
              popoverStyle={{
                maxWidth: `${CHART_WIDGET_PICKER_POPOVER_MAX_WIDTH_REM}rem`,
                width: `min(${CHART_WIDGET_PICKER_POPOVER_MAX_WIDTH_REM}rem, calc(100vw - 2rem))`,
              }}
              calendarClassName="w-full"
              calendarFullWidth
              onRangeChange={applyRange}
            />
          </div>
        ) : bounds && resolvedRange ? null : (
          <div className="h-9 w-[12.5rem]">
            <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
          </div>
        )}
        {showMonthSelector ? (
          <div className={ACTION_GROUP_CLASS}>
            <Button
              aria-label="Show previous month"
              className={ACTION_GROUP_BUTTON_CLASS}
              disabled={!canNavigatePrevious}
              onClick={() => handleMonthStep(-1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              className="h-[38px] min-w-[10rem] cursor-default rounded-none border-x border-white/5 bg-sidebar px-4 py-2 text-xs text-white/70 hover:bg-sidebar"
              disabled
            >
              {activeMonthLabel || "Select month"}
            </Button>
            <Button
              aria-label="Show next month"
              className={ACTION_GROUP_BUTTON_CLASS}
              disabled={!canNavigateNext}
              onClick={() => handleMonthStep(1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : null}
        <ChartWidgetPresets
          currentWidgets={enabledWidgets}
          onApplyPreset={onApplyPreset || (() => undefined)}
        />
        <Button className={ACTION_BUTTON_CLASS} onClick={onToggleEdit}>
          <EditWidgets className="size-3.5 fill-white/75" />
          <span>{isEditing ? "Save" : "Customize widgets"}</span>
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={displayWidgets} strategy={rectSortingStrategy}>
          <div className="grid auto-rows-min gap-1.5 md:grid-cols-4 2xl:grid-cols-3">
            {accountId ? (
              displayWidgets.map((widgetType, index) => {
                const resolvedKey =
                  CHART_WIDGET_KEY_ALIASES[widgetType] ?? widgetType;
                const CardComponent = chartCardComponents[resolvedKey] as
                  | ComponentType<ChartWidgetCardProps>
                  | undefined;
                if (!CardComponent) return null;

                return (
                  <SortableWidget
                    key={`${widgetType}-${index}`}
                    id={widgetType}
                    disabled={!isEditing}
                  >
                    <div
                      className="relative h-124 w-full cursor-pointer"
                      onPointerEnter={() => setFocusedWidgetId(widgetType)}
                      onFocusCapture={() => setFocusedWidgetId(widgetType)}
                      onDoubleClick={handleDoubleClick}
                      onClick={() => {
                        if (isEditing) onToggleWidget?.(widgetType);
                      }}
                    >
                      {isEditing ? (
                        <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
                          <div className="flex size-6 items-center justify-center border border-white/5">
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
                        className="h-full w-full"
                      />

                      {isEditing ? (
                        <>
                          <div
                            className="absolute left-0 top-0 h-3 w-full cursor-ns-resize"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => event.stopPropagation()}
                          />
                          <div
                            className="absolute bottom-0 left-0 h-3 w-full cursor-ns-resize"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => event.stopPropagation()}
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
                      <div className="widget-header flex w-full items-center justify-between p-3.5">
                        <Skeleton className="h-5 w-24 rounded-none bg-sidebar-accent" />
                        <Skeleton className="h-5 w-16 rounded-none bg-sidebar-accent" />
                      </div>
                    }
                  >
                    <div className="flex h-full flex-col items-start justify-between gap-6 p-3.5">
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-16 rounded-none bg-sidebar" />
                        <Skeleton className="h-4 w-24 rounded-none bg-sidebar" />
                        <Skeleton className="h-4 w-32 rounded-none bg-sidebar" />
                      </div>

                      <div className="flex h-max w-full gap-4">
                        <div className="flex h-full w-16 flex-col gap-4 pb-8">
                          {Array.from({ length: 8 }).map((_, rowIndex) => (
                            <Skeleton
                              key={rowIndex}
                              className="h-4 w-full rounded-none bg-sidebar"
                            />
                          ))}
                        </div>

                        <div className="flex w-full flex-col gap-4">
                          <Skeleton className="h-full w-full rounded-none bg-sidebar" />

                          <div className="flex h-max w-full gap-4">
                            {Array.from({ length: 7 }).map((_, rowIndex) => (
                              <Skeleton
                                key={rowIndex}
                                className="h-4 w-full rounded-none bg-sidebar"
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

            {isEditing
              ? availableWidgets.map((widgetType, index) => {
                  const CardComponent = chartCardComponents[widgetType];
                  return (
                    <div
                      key={`available-${widgetType}-${index}`}
                      className="h-124 opacity-50 transition-all duration-150 hover:opacity-100"
                      onClick={() => onToggleWidget?.(widgetType)}
                    >
                      <CardComponent
                        accountId={accountId}
                        isEditing={true}
                        className="h-full w-full"
                      />
                    </div>
                  );
                })
              : null}
          </div>
        </SortableContext>
      </DndContext>
    </div>
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
