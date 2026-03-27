"use client";

import type { RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PickerComponent from "@/components/dashboard/calendar/picker";
import { cn } from "@/lib/utils";
import { WidgetShareButton } from "@/features/dashboard/widgets/components/widget-share-button";
import { CalendarWidgetPresets } from "./calendar-widget-presets";

import { fromDateISO } from "../lib/calendar-utils";
import type {
  CalendarRange,
  CalendarWidgetType,
  DayRow,
  ViewMode,
} from "../lib/calendar-types";

const SEGMENTED_CONTROL_CLASS =
  "flex h-max w-max items-center gap-1 overflow-visible rounded-lg bg-white p-[3px] dark:bg-muted/25 ring ring-white/5";

const ACTION_BUTTON_CLASS =
  "flex h-[38px] w-max items-center justify-center gap-1.5 rounded-md ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110";

const ACTION_GROUP_CLASS =
  "flex items-center overflow-visible rounded-md ring ring-white/5 bg-sidebar";

const ACTION_GROUP_BUTTON_CLASS =
  "h-[38px] rounded-none ring-0 bg-sidebar px-3 py-2 text-xs text-white transition-colors hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-sidebar";

function getSegmentedButtonClass(active: boolean) {
  return cn(
    "flex h-8 w-max items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-all duration-250 active:scale-95",
    active
      ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
      : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
  );
}

type QuickRange = {
  label: string;
  getRange: (min: Date, max: Date) => CalendarRange;
};

type CalendarControlsProps = {
  days: DayRow[] | null;
  bounds: { minISO: string; maxISO: string } | null;
  range: CalendarRange | null;
  viewMode: ViewMode;
  quickRanges: QuickRange[];
  activePeriodLabel: string;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
  heatmapEnabled: boolean;
  goalOverlay: boolean;
  showWeekends: boolean;
  exportTargetRef?: RefObject<HTMLElement | null>;
  showPresets?: boolean;
  showShareButton?: boolean;
  readOnly?: boolean;
  summaryWidgets: CalendarWidgetType[];
  summaryWidgetSpans: Partial<Record<CalendarWidgetType, number>>;
  onRangeChange: (start: Date, end: Date, nextViewMode?: ViewMode) => void;
  onPeriodStep: (direction: -1 | 1) => void;
  onViewChange: (mode: ViewMode) => void;
  onToggleHeatmap: () => void;
  onToggleGoalOverlay: () => void;
  onToggleWeekends: () => void;
  onApplyPreset: (
    widgets: CalendarWidgetType[],
    spans: Partial<Record<CalendarWidgetType, number>>
  ) => void | Promise<void>;
};

export function CalendarControls({
  days,
  bounds,
  range,
  viewMode,
  quickRanges,
  activePeriodLabel,
  canNavigatePrevious,
  canNavigateNext,
  heatmapEnabled,
  goalOverlay,
  showWeekends,
  exportTargetRef,
  showPresets = true,
  showShareButton = true,
  readOnly = false,
  summaryWidgets,
  summaryWidgetSpans,
  onRangeChange,
  onPeriodStep,
  onViewChange,
  onToggleHeatmap,
  onToggleGoalOverlay,
  onToggleWeekends,
  onApplyPreset,
}: CalendarControlsProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <h2 className="text-lg font-semibold tracking-tight text-secondary dark:text-neutral-100">
        <span className="font-medium text-secondary">
          Here&apos;s an overview of your
        </span>{" "}
        most recent trades
      </h2>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        {readOnly ? (
          <>
            <div
              className={cn(
                ACTION_BUTTON_CLASS,
                "cursor-default rounded-md px-4 text-white/70 hover:bg-sidebar hover:brightness-100 active:scale-100"
              )}
            >
              {activePeriodLabel}
            </div>
            <div className={SEGMENTED_CONTROL_CLASS}>
              <Button
                aria-pressed
                className={getSegmentedButtonClass(true)}
                disabled
              >
                {viewMode[0].toUpperCase() + viewMode.slice(1)}
              </Button>
            </div>
            {heatmapEnabled || goalOverlay ? (
              <div className={SEGMENTED_CONTROL_CLASS}>
                {heatmapEnabled ? (
                  <Button
                    aria-pressed
                    className={getSegmentedButtonClass(true)}
                    disabled
                  >
                    Heatmap
                  </Button>
                ) : null}
                {goalOverlay ? (
                  <Button
                    aria-pressed
                    className={getSegmentedButtonClass(true)}
                    disabled
                  >
                    Goals
                  </Button>
                ) : null}
                {showWeekends ? (
                  <Button
                    aria-pressed
                    className={getSegmentedButtonClass(true)}
                    disabled
                  >
                    Weekends
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {days && days.length > 0 && bounds ? (
              (() => {
                const isMonth = viewMode === "month";
                const pickerMaxDays = isMonth ? 31 : 7;
                const pickerMinDays = isMonth ? 1 : 3;
                return (
                  <PickerComponent
                    defaultStart={fromDateISO(days[0].dateISO)}
                    defaultEnd={fromDateISO(days[days.length - 1].dateISO)}
                    minDate={new Date(bounds.minISO)}
                    maxDate={new Date(bounds.maxISO)}
                    valueStart={range?.start}
                    valueEnd={range?.end}
                    minDays={pickerMinDays}
                    maxDays={pickerMaxDays}
                    quickRanges={quickRanges}
                    onRangeChange={onRangeChange}
                  />
                );
              })()
            ) : (
              <div className="h-[38px] w-48">
                <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
              </div>
            )}
            <div className={ACTION_GROUP_CLASS}>
              <Button
                aria-label={`Show previous ${viewMode}`}
                className={ACTION_GROUP_BUTTON_CLASS}
                disabled={!canNavigatePrevious}
                onClick={() => onPeriodStep(-1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                className="h-[38px] cursor-default rounded-none ring-x ring-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 hover:bg-sidebar"
                disabled
              >
                {activePeriodLabel}
              </Button>
              <Button
                aria-label={`Show next ${viewMode}`}
                className={ACTION_GROUP_BUTTON_CLASS}
                disabled={!canNavigateNext}
                onClick={() => onPeriodStep(1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
            <div className={SEGMENTED_CONTROL_CLASS}>
              {(["week", "month"] as ViewMode[]).map((mode) => (
                <Button
                  aria-pressed={viewMode === mode}
                  key={mode}
                  className={getSegmentedButtonClass(viewMode === mode)}
                  onClick={() => onViewChange(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>
            <div className={SEGMENTED_CONTROL_CLASS}>
              <Button
                aria-pressed={heatmapEnabled}
                className={getSegmentedButtonClass(heatmapEnabled)}
                onClick={onToggleHeatmap}
              >
                Heatmap
              </Button>
              <Button
                aria-pressed={goalOverlay}
                className={getSegmentedButtonClass(goalOverlay)}
                onClick={onToggleGoalOverlay}
              >
                Goals
              </Button>
              <Button
                aria-pressed={showWeekends}
                className={getSegmentedButtonClass(showWeekends)}
                onClick={onToggleWeekends}
              >
                Weekends
              </Button>
            </div>
          </>
        )}
        {showPresets ? (
          <CalendarWidgetPresets
            currentWidgets={summaryWidgets}
            currentSpans={summaryWidgetSpans}
            onApplyPreset={onApplyPreset}
            className={ACTION_BUTTON_CLASS}
          />
        ) : null}
        {exportTargetRef && showShareButton ? (
          <WidgetShareButton
            targetRef={exportTargetRef}
            title="Trading calendar"
            verificationSurface={{
              kind: "calendar",
              start: range?.start ? range.start.toISOString() : null,
              end: range?.end ? range.end.toISOString() : null,
              viewMode,
              heatmapEnabled,
              goalOverlay,
              showWeekends,
              summaryWidgets,
              summaryWidgetSpans: Object.fromEntries(
                Object.entries(summaryWidgetSpans).map(([key, value]) => [
                  key,
                  Math.max(1, Math.round(Number(value ?? 1))),
                ])
              ),
            }}
            successMessage="Calendar PNG downloaded"
            errorMessage="Failed to export calendar PNG"
            buttonLabel="Share"
            className={ACTION_BUTTON_CLASS}
          />
        ) : null}
      </div>
    </div>
  );
}
