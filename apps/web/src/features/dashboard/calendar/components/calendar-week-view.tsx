"use client";

import type { KeyboardEvent } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";

import type {
  CalendarPreviewState,
  DayRow,
  GoalMarker,
  TradePreview,
} from "../lib/calendar-types";
import {
  formatAccessibleDate,
  formatDuration,
  formatMoney,
  formatTradeCount,
  formatTradePillMoney,
  fromDateISO,
  getGoalLegendChipClass,
  getGoalLegendLabel,
  getGoalMarkerClass,
  getGoalStatusClass,
  getGoalStatusText,
  getHeatmapBg,
  getTradePillProfitTone,
} from "../lib/calendar-utils";

type CalendarWeekViewProps = {
  days: DayRow[];
  goalMap: Map<string, GoalMarker[]>;
  goalOverlay: boolean;
  heatmapEnabled: boolean;
  heatmapMaxAbs: number;
  initialBalance: number | null;
  hoveredISO: string | null;
  previews: CalendarPreviewState;
  onSelectDay: (dateISO: string) => void;
  onHoverDay: (dateISO: string, count: number) => void;
  onLeaveDay: (dateISO: string) => void;
};

type GroupedTradePreview = {
  symbol: string;
  totalProfit: number;
  items: Array<{
    id: string;
    profit: number;
  }>;
};

function handleDayKeyDown(
  event: KeyboardEvent<HTMLElement>,
  dateISO: string,
  onSelectDay: (dateISO: string) => void
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelectDay(dateISO);
}

function buildGroupedPreviewRows(rows: TradePreview[]) {
  const groupedBySymbol = rows.reduce<Record<string, GroupedTradePreview>>(
    (accumulator, row) => {
      const key = (row.symbol || "(Unknown)").trim();
      const current =
        accumulator[key] ?? { symbol: key, totalProfit: 0, items: [] };
      current.totalProfit += Number(row.profit || 0);
      current.items.push({ id: row.id, profit: Number(row.profit || 0) });
      accumulator[key] = current;
      return accumulator;
    },
    {}
  );

  return Object.values(groupedBySymbol)
    .sort((left, right) => Math.abs(right.totalProfit) - Math.abs(left.totalProfit))
    .slice(0, 3);
}

export function CalendarWeekView({
  days,
  goalMap,
  goalOverlay,
  heatmapEnabled,
  heatmapMaxAbs,
  initialBalance,
  hoveredISO,
  previews,
  onSelectDay,
  onHoverDay,
  onLeaveDay,
}: CalendarWeekViewProps) {
  const isSingleDayView = days.length === 1;

  return (
    <div className="flex w-full">
      {days.map((dayRow) => {
        const dayDate = fromDateISO(dayRow.dateISO);
        const dayGoals = goalMap.get(dayRow.dateISO) || [];
        const hasGoals = goalOverlay && dayGoals.length > 0;
        const isGain = dayRow.totalProfit >= 0;
        const pctValue =
          initialBalance && initialBalance > 0
            ? (Number(dayRow.totalProfit || 0) / initialBalance) * 100
            : 0;
        const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(2)}%`;
        const heatBg = heatmapEnabled
          ? getHeatmapBg(dayRow.totalProfit, dayRow.count, heatmapMaxAbs)
          : undefined;
        const previewRows = previews[dayRow.dateISO]?.trades || [];
        const groupedRows = buildGroupedPreviewRows(previewRows);

        const cell = (
          <div
            key={dayRow.dateISO}
            className={cn(
              "flex min-h-[180px] w-full cursor-pointer flex-col border-black/10 bg-white p-5 transition-colors duration-250 hover:bg-sidebar-accent dark:border-white/5 dark:bg-sidebar",
              isSingleDayView
                ? "rounded-sm border"
                : "first:rounded-l-sm last:rounded-r-sm first:border not-first:border not-last:border-l-0 last:border-l-0"
            )}
            role="button"
            tabIndex={0}
            aria-label={`View trades for ${formatAccessibleDate(dayDate)}`}
            style={heatBg ? { backgroundColor: heatBg } : undefined}
            onClick={() => onSelectDay(dayRow.dateISO)}
            onKeyDown={(event) => handleDayKeyDown(event, dayRow.dateISO, onSelectDay)}
            onMouseEnter={() => onHoverDay(dayRow.dateISO, dayRow.count)}
            onMouseLeave={() => onLeaveDay(dayRow.dateISO)}
          >
            {hoveredISO === dayRow.dateISO ? (
              <div className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-secondary">
                      {dayDate.getDate()}
                    </span>
                    {hasGoals ? (
                      <div className="flex items-center gap-0.5">
                        {dayGoals.slice(0, 3).map((goal, index) => (
                          <div
                            key={index}
                            className={cn("size-1.5 rounded-full", getGoalMarkerClass(goal))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const shown = previewRows.length;
                      const extra = Math.max(0, Number(dayRow.count || 0) - shown);
                      return extra > 0 ? (
                        <span className="inline-block rounded-xs bg-neutral-800/25 px-2 py-0.5 text-[10px] font-medium text-white/60">
                          +{formatTradeCount(extra)} trades
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex h-full flex-col place-content-end gap-1">
                  {previews[dayRow.dateISO]?.loading ? (
                    <>
                      <Skeleton className="h-4 w-24 rounded-none bg-sidebar-accent" />
                      <Skeleton className="h-4 w-20 rounded-none bg-sidebar-accent" />
                      <Skeleton className="h-4 w-16 rounded-none bg-sidebar-accent" />
                    </>
                  ) : previewRows.length > 0 ? (
                    groupedRows.map((group) => (
                      <div
                        key={group.symbol}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-medium text-white">
                          {group.symbol}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              TRADE_IDENTIFIER_PILL_CLASS,
                              "min-h-0 px-1.5 py-0 text-[10px]",
                              getTradePillProfitTone(Number(group.totalProfit || 0))
                            )}
                          >
                            {formatTradePillMoney(Number(group.totalProfit || 0))}
                          </span>
                          {group.items.length > 1 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="rounded-xs bg-neutral-800/25 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                                  x{formatTradeCount(group.items.length)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                sideOffset={6}
                                className="w-max max-w-none min-w-[15rem] py-3"
                              >
                                <div className="flex flex-col gap-2">
                                  {group.items.map((item) => {
                                    const row = previewRows.find((preview) => preview.id === item.id);
                                    const opened = row?.open
                                      ? new Date(row.open).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "--:--";

                                    return (
                                      <div
                                        key={item.id}
                                        className="flex w-full items-center gap-3"
                                      >
                                        <span className="w-14 shrink-0 text-[11px] tabular-nums text-white/60">
                                          {opened}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-center text-[11px] tabular-nums text-white/40">
                                          {formatDuration(row?.holdSeconds || 0)}
                                        </span>
                                        <span
                                          className={cn(
                                            TRADE_IDENTIFIER_PILL_CLASS,
                                            "ml-auto min-h-0 shrink-0 px-1.5 py-0 text-[10px]",
                                            getTradePillProfitTone(Number(row?.profit || 0))
                                          )}
                                        >
                                          {formatTradePillMoney(Number(row?.profit || 0))}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-white/40">No trades</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-secondary">
                      {dayDate.getDate()}
                    </span>
                    {hasGoals ? (
                      <div className="flex items-center gap-0.5">
                        {dayGoals.slice(0, 3).map((goal, index) => (
                          <div
                            key={index}
                            className={cn("size-1.5 rounded-full", getGoalMarkerClass(goal))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <h1
                    className={cn(
                      "text-xs font-medium",
                      isGain ? "text-teal-400" : "text-rose-400",
                      dayRow.totalProfit === 0 ? "text-white/25" : ""
                    )}
                  >
                    {pctLabel}
                  </h1>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div
                    className={cn(
                      "text-xl font-medium",
                      isGain ? "text-teal-400" : "text-rose-400",
                      dayRow.totalProfit === 0 ? "text-white/50" : ""
                    )}
                  >
                    {formatMoney(dayRow.totalProfit)}
                  </div>
                </div>
                <div className="mt-1 text-xs font-medium text-white/25">
                  {formatTradeCount(dayRow.count)}{" "}
                  {dayRow.count === 1 ? "trade" : "trades"}
                </div>
              </div>
            )}
          </div>
        );

        if (!hasGoals) return cell;

        return (
          <Tooltip key={dayRow.dateISO}>
            <TooltipTrigger asChild>{cell}</TooltipTrigger>
            <TooltipContent className="w-max max-w-none px-0 py-3">
              <div className="flex flex-col gap-1.5 px-3">
                <span className="text-[10px] uppercase tracking-wide text-white/40">
                  Goals
                </span>
                {dayGoals.map((goal, index) => {
                  const statusText = getGoalStatusText(goal);
                  return (
                    <div
                      key={`${goal.title}-${index}-${goal.isStart ? "start" : "due"}`}
                      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"
                    >
                      <span
                        className={cn(
                          "rounded-xs px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                          getGoalLegendChipClass(goal)
                        )}
                      >
                        {getGoalLegendLabel(goal)}
                      </span>
                      <span className="text-[11px] whitespace-nowrap text-white/80">
                        {goal.title}
                      </span>
                      {statusText ? (
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-medium tabular-nums",
                            getGoalStatusClass(goal)
                          )}
                        >
                          {statusText}
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
