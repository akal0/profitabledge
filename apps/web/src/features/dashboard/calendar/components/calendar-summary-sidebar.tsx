"use client";

import { useMemo } from "react";

import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

import { SummaryCard } from "./summary-card";
import { SortableSummaryWidget } from "./sortable-summary-widget";
import {
  DEFAULT_CALENDAR_WIDGETS,
  MAX_CALENDAR_WIDGETS,
  type CalendarWidgetType,
  type MonthSummary,
  type RangeSummary,
} from "../lib/calendar-types";
import {
  formatDuration,
  formatMoney,
  formatPercent,
} from "../lib/calendar-utils";

type CalendarSummarySidebarProps = {
  isEditing: boolean;
  summaryWidgets: CalendarWidgetType[];
  summaryWidgetSpans: Partial<Record<CalendarWidgetType, number>>;
  monthSummary: MonthSummary | null;
  rangeSummary: RangeSummary | null;
  summaryLoading: boolean;
  rangeLabel: string;
  onToggleSummaryWidget?: (type: CalendarWidgetType) => void;
  onReorderSummaryWidget?: (fromIndex: number, toIndex: number) => void;
  onResizeSummaryWidget?: (type: CalendarWidgetType, span: number) => void;
  onEnterEdit?: () => void;
};

function getSummarySpan(
  summaryWidgetSpans: Partial<Record<CalendarWidgetType, number>>,
  type: CalendarWidgetType
) {
  const raw = Number(summaryWidgetSpans[type] ?? 1);
  return Math.max(1, Math.min(2, Math.round(Number.isFinite(raw) ? raw : 1)));
}

function renderSummaryWidget(
  type: CalendarWidgetType,
  monthSummary: MonthSummary | null,
  rangeSummary: RangeSummary | null,
  summaryLoading: boolean,
  rangeLabel: string
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
          subtext={rangeSummary?.losses != null ? `${rangeSummary.losses} losing trades` : "—"}
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
          subtext={monthSummary?.totalTrades ? `${monthSummary.totalTrades} trades` : "—"}
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
  isEditing,
  summaryWidgets,
  summaryWidgetSpans,
  monthSummary,
  rangeSummary,
  summaryLoading,
  rangeLabel,
  onToggleSummaryWidget,
  onReorderSummaryWidget,
  onResizeSummaryWidget,
  onEnterEdit,
}: CalendarSummarySidebarProps) {
  const summaryWidgetList = summaryWidgets.slice(0, MAX_CALENDAR_WIDGETS);
  const availableSummaryWidgets = useMemo(
    () =>
      DEFAULT_CALENDAR_WIDGETS.filter(
        (widget) => !summaryWidgetList.includes(widget)
      ),
    [summaryWidgetList]
  );

  const summarySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleSummaryDragEnd = (event: DragEndEvent) => {
    if (!isEditing) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = summaryWidgetList.indexOf(active.id as CalendarWidgetType);
    const newIndex = summaryWidgetList.indexOf(over.id as CalendarWidgetType);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderSummaryWidget?.(oldIndex, newIndex);
  };

  const handleSummaryDoubleClick = () => {
    if (isEditing) return;
    onEnterEdit?.();
  };

  return (
    <DndContext sensors={summarySensors} onDragEnd={handleSummaryDragEnd}>
      <SortableContext items={summaryWidgetList} strategy={verticalListSortingStrategy}>
        <div className="grid h-full grid-cols-1 grid-rows-6 gap-2">
          {summaryWidgetList.map((widgetType, index) => {
            const span = getSummarySpan(summaryWidgetSpans, widgetType);
            return (
              <SortableSummaryWidget
                key={`${widgetType}-${index}`}
                id={widgetType}
                disabled={!isEditing}
                style={{ gridRow: `span ${span} / span ${span}` }}
              >
                <div
                  className={cn(
                    "relative h-full cursor-pointer",
                    isEditing ? "animate-tilt-subtle hover:animate-none" : ""
                  )}
                  onDoubleClick={handleSummaryDoubleClick}
                  onClick={() => isEditing && onToggleSummaryWidget?.(widgetType)}
                >
                  {isEditing ? (
                    <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                      <div
                        className="flex items-center gap-1 border border-white/5 bg-sidebar/90"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                          disabled={span <= 1}
                          onClick={() => onResizeSummaryWidget?.(widgetType, span - 1)}
                        >
                          -
                        </button>
                        <span className="px-1 text-[10px] text-white/50">{span}x</span>
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                          disabled={span >= 2}
                          onClick={() => onResizeSummaryWidget?.(widgetType, span + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {isEditing ? (
                    <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                      <div className="flex size-4 items-center justify-center border border-white/5">
                        <svg viewBox="0 0 24 24" className="size-3 fill-white">
                          <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9 9a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L10.5 14.5l8.293-8.293a1 1 0 0 1 1.492.5z" />
                        </svg>
                      </div>
                      <GripVertical className="size-3 text-white/40" />
                    </div>
                  ) : null}
                  {renderSummaryWidget(
                    widgetType,
                    monthSummary,
                    rangeSummary,
                    summaryLoading,
                    rangeLabel
                  )}
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
              </SortableSummaryWidget>
            );
          })}

          {isEditing
            ? availableSummaryWidgets.map((widgetType) => (
                <div
                  key={`available-${widgetType}`}
                  className="h-full opacity-50 transition-all duration-150 hover:opacity-100"
                  onClick={() => onToggleSummaryWidget?.(widgetType)}
                >
                  {renderSummaryWidget(
                    widgetType,
                    monthSummary,
                    rangeSummary,
                    summaryLoading,
                    rangeLabel
                  )}
                </div>
              ))
            : null}
        </div>
      </SortableContext>
    </DndContext>
  );
}
