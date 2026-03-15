"use client";

import type { KeyboardEvent } from "react";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";

import type {
  CalendarPreviewState,
  DayRow,
  GoalMarker,
} from "../lib/calendar-types";
import {
  formatAccessibleDate,
  formatMoney,
  formatShortDate,
  formatTradeCount,
  formatTradePillMoney,
  getGoalLegendChipClass,
  getGoalLegendLabel,
  getGoalMarkerClass,
  getGoalStatusClass,
  getGoalStatusText,
  getHeatmapBg,
  getTradePillProfitTone,
  toYMD,
} from "../lib/calendar-utils";

type CalendarMonthViewProps = {
  monthGrid: Date[];
  activeMonth: number | null;
  dayMap: Map<string, DayRow>;
  goalMap: Map<string, GoalMarker[]>;
  goalOverlay: boolean;
  heatmapEnabled: boolean;
  heatmapMaxAbs: number;
  initialBalance: number | null;
  previews: CalendarPreviewState;
  onSelectDay: (dateISO: string) => void;
  onHoverDay: (dateISO: string, count: number) => void;
  onLeaveDay: (dateISO: string) => void;
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

export function CalendarMonthView({
  monthGrid,
  activeMonth,
  dayMap,
  goalMap,
  goalOverlay,
  heatmapEnabled,
  heatmapMaxAbs,
  initialBalance,
  previews,
  onSelectDay,
  onHoverDay,
  onLeaveDay,
}: CalendarMonthViewProps) {
  return (
    <div className="border border-white/5 bg-white dark:bg-sidebar rounded-sm overflow-hidden">
      <div className="grid grid-cols-7 gap-[1px] bg-sidebar-accent">
        {monthGrid.map((day) => {
          const key = toYMD(day);
          const inMonth = activeMonth != null ? day.getMonth() === activeMonth : true;
          const data = dayMap.get(key);
          const dayGoals = goalMap.get(key) || [];
          const hasGoals = goalOverlay && dayGoals.length > 0;
          const totalProfit = data?.totalProfit || 0;
          const count = data?.count || 0;
          const isGain = totalProfit >= 0;
          const pctValue =
            initialBalance && initialBalance > 0
              ? (Number(totalProfit || 0) / initialBalance) * 100
              : 0;
          const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(2)}%`;
          const heatBg = heatmapEnabled
            ? getHeatmapBg(totalProfit, count, heatmapMaxAbs)
            : undefined;
          const preview = previews[key];
          const previewTrades = preview?.trades || [];
          const previewLoading = count > 0 ? preview?.loading ?? true : false;
          const shown = previewTrades.length;
          const extra = Math.max(0, count - shown);

          const cell = (
            <div
              className={cn(
                "flex min-h-[120px] cursor-pointer flex-col gap-2 bg-white p-3 transition-colors duration-250 hover:bg-sidebar-accent dark:bg-sidebar",
                !inMonth && count === 0 && "opacity-40"
              )}
              role="button"
              tabIndex={0}
              aria-label={`View trades for ${formatAccessibleDate(day)}`}
              style={heatBg ? { backgroundColor: heatBg } : undefined}
              onClick={() => onSelectDay(key)}
              onKeyDown={(event) => handleDayKeyDown(event, key, onSelectDay)}
              onMouseEnter={() => onHoverDay(key, count)}
              onMouseLeave={() => onLeaveDay(key)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-secondary">{day.getDate()}</span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isGain ? "text-teal-400" : "text-rose-400",
                    totalProfit === 0 ? "text-white/25" : ""
                  )}
                >
                  {pctLabel}
                </span>
              </div>
              <div className="mt-auto flex flex-col gap-1">
                <div
                  className={cn(
                    "text-sm font-medium",
                    isGain ? "text-teal-400" : "text-rose-400",
                    totalProfit === 0 ? "text-white/50" : ""
                  )}
                >
                  {formatMoney(totalProfit)}
                </div>
                <div className="text-[10px] font-medium text-white/25">
                  {count} {count === 1 ? "trade" : "trades"}
                </div>
              </div>
              {goalOverlay && hasGoals ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayGoals.map((goal, index) => (
                    <div key={`${goal.title}-${index}`} className="flex items-center gap-1">
                      <div
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          getGoalMarkerClass(goal)
                        )}
                      />
                      <span className="truncate text-[8px] leading-tight text-white/40">
                        {goal.isStart ? "Start: " : "Due: "}
                        {goal.title}
                      </span>
                      {goal.isDeadline && goal.status === "active" ? (
                        <span className="ml-auto shrink-0 text-[7px] text-white/25">
                          {Math.round(goal.progress)}%
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );

          if (count <= 0 && !hasGoals) {
            return <div key={key}>{cell}</div>;
          }

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>{cell}</TooltipTrigger>
              <TooltipContent className="px-0 py-3">
                <div className="flex max-h-72 min-w-[280px] max-w-[360px] flex-col overflow-auto">
                  <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                    <span>{formatShortDate(day)}</span>
                    <span>
                      {formatTradeCount(count)} {count === 1 ? "trade" : "trades"}
                    </span>
                  </div>
                  {count > 0 ? <Separator className="mt-2 w-full" /> : null}
                  {count > 0 && previewLoading ? (
                    <div className="flex flex-col gap-2 px-3 pt-2">
                      <Skeleton className="h-3 w-32 rounded-none bg-sidebar-accent" />
                      <Skeleton className="h-3 w-28 rounded-none bg-sidebar-accent" />
                      <Skeleton className="h-3 w-24 rounded-none bg-sidebar-accent" />
                    </div>
                  ) : count > 0 && previewTrades.length > 0 ? (
                    <div className="flex flex-col gap-1 px-3 pt-2">
                      {previewTrades.map((trade) => {
                        const opened = trade.open
                          ? new Date(trade.open).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--:--";

                        return (
                          <div key={trade.id} className="flex w-full items-center gap-3">
                            <span className="w-16 shrink-0 text-left text-[11px] tabular-nums text-white/60">
                              {opened}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-center text-[11px] text-white/70">
                              {trade.symbol}
                            </span>
                            <span
                              className={cn(
                                TRADE_IDENTIFIER_PILL_CLASS,
                                "ml-auto min-h-0 shrink-0 px-1.5 py-0 text-[10px]",
                                getTradePillProfitTone(Number(trade.profit || 0))
                              )}
                            >
                              {formatTradePillMoney(Number(trade.profit || 0))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : count > 0 ? (
                    <span className="px-3 pt-2 text-[11px] text-white/40">
                      No trade details available.
                    </span>
                  ) : null}
                  {count > 0 && !previewLoading && extra > 0 ? (
                    <span className="px-3 pt-2 text-[10px] text-white/40">
                      Showing {formatTradeCount(shown)} of {formatTradeCount(count)} trades.
                    </span>
                  ) : null}
                  {hasGoals ? (
                    <>
                      <Separator className="my-2 w-full" />
                      <div className="flex flex-col gap-1.5 px-3">
                        <span className="text-[10px] uppercase tracking-wide text-white/40">
                          Goals
                        </span>
                        {dayGoals.map((goal, index) => {
                          const statusText = getGoalStatusText(goal);
                          return (
                            <div
                              key={`${goal.title}-${index}-${goal.isStart ? "start" : "due"}`}
                              className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"
                            >
                              <span
                                className={cn(
                                  "rounded-xs px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                                  getGoalLegendChipClass(goal)
                                )}
                              >
                                {getGoalLegendLabel(goal)}
                              </span>
                              <span className="min-w-0 truncate text-[11px] text-white/80">
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
                    </>
                  ) : null}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
