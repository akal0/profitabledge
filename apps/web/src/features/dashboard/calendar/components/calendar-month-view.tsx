"use client";

import { useState, type KeyboardEvent } from "react";

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

import { GroupedTradeMultiplierChip } from "./grouped-trade-multiplier-chip";
import type {
  CalendarPreviewState,
  DayRow,
  GoalMarker,
  TradePreview,
} from "../lib/calendar-types";
import {
  formatAccessibleDate,
  formatMoney,
  formatTooltipDate,
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
  currencyCode?: string | null;
  showWeekends: boolean;
  dayMap: Map<string, DayRow>;
  goalMap: Map<string, GoalMarker[]>;
  goalOverlay: boolean;
  heatmapEnabled: boolean;
  heatmapMaxAbs: number;
  initialBalance: number | null;
  livePreviewMap: Map<string, TradePreview[]>;
  previews: CalendarPreviewState;
  onSelectDay: (dateISO: string) => void;
  onHoverDay: (
    dateISO: string,
    closedCount: number,
    totalCount: number
  ) => void;
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
    .sort(
      (left, right) => Math.abs(right.totalProfit) - Math.abs(left.totalProfit)
    )
    .slice(0, 3);
}

export function CalendarMonthView({
  monthGrid,
  activeMonth,
  currencyCode,
  showWeekends,
  dayMap,
  goalMap,
  goalOverlay,
  heatmapEnabled,
  heatmapMaxAbs,
  initialBalance,
  livePreviewMap,
  previews,
  onSelectDay,
  onHoverDay,
  onLeaveDay,
}: CalendarMonthViewProps) {
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null);
  const [nestedTooltipKey, setNestedTooltipKey] = useState<string | null>(null);

  return (
    <div className="border border-white/5 bg-white dark:bg-sidebar rounded-md overflow-hidden">
      <div
        className={cn(
          "grid gap-[1px] bg-sidebar-accent",
          showWeekends ? "grid-cols-7" : "grid-cols-5"
        )}
      >
        {monthGrid.map((day) => {
          const key = toYMD(day);
          const inMonth = activeMonth != null ? day.getMonth() === activeMonth : true;
          const data = dayMap.get(key);
          const dayGoals = goalMap.get(key) || [];
          const hasGoals = goalOverlay && dayGoals.length > 0;
          const totalProfit = data?.totalProfit || 0;
          const count = data?.count || 0;
          const liveCount = data?.liveTradeCount || 0;
          const liveProfit = data?.liveTradeProfit || 0;
          const totalCount = count + liveCount;
          const displayProfit = count > 0 ? totalProfit : liveProfit;
          const isGain = displayProfit >= 0;
          const pctValue =
            initialBalance && initialBalance > 0
              ? (Number(displayProfit || 0) / initialBalance) * 100
              : 0;
          const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(2)}%`;
          const heatBg = heatmapEnabled
            ? getHeatmapBg(displayProfit, totalCount, heatmapMaxAbs)
            : undefined;
          const preview = previews[key];
          const previewTrades = [...(livePreviewMap.get(key) || []), ...(preview?.trades || [])]
            .sort(
              (left, right) =>
                new Date(left.open).getTime() - new Date(right.open).getTime()
            );
          const previewLoading = count > 0 ? preview?.loading ?? true : false;
          const groupedPreviewRows = buildGroupedPreviewRows(previewTrades);
          const shown = previewTrades.length;
          const extra = Math.max(0, totalCount - shown);
          const countLabel =
            count > 0 && liveCount > 0
              ? `${formatTradeCount(count)} closed · ${formatTradeCount(liveCount)} live`
              : count > 0
                ? `${formatTradeCount(count)} ${count === 1 ? "trade" : "trades"}`
                : liveCount > 0
                  ? `${formatTradeCount(liveCount)} live`
                  : "0 trades";

          const cell = (
            <div
              className={cn(
                "flex min-h-[120px] cursor-pointer flex-col gap-2 bg-white p-3 transition-colors duration-250 hover:bg-sidebar-accent dark:bg-sidebar",
                !inMonth && totalCount === 0 && "opacity-40"
              )}
              role="button"
              tabIndex={0}
              aria-label={`View trades for ${formatAccessibleDate(day)}`}
              style={heatBg ? { backgroundColor: heatBg } : undefined}
              onClick={() => onSelectDay(key)}
              onKeyDown={(event) => handleDayKeyDown(event, key, onSelectDay)}
              onMouseEnter={() => onHoverDay(key, count, totalCount)}
              onMouseLeave={() => onLeaveDay(key)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-secondary">{day.getDate()}</span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isGain ? "text-teal-400" : "text-rose-400",
                    displayProfit === 0 ? "text-white/25" : ""
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
                    displayProfit === 0 ? "text-white/50" : ""
                  )}
                >
                  {formatMoney(displayProfit, currencyCode)}
                </div>
                {count > 0 && liveCount > 0 ? (
                  <div className="text-[10px] font-medium text-cyan-200/80">
                    Live {formatMoney(liveProfit, currencyCode)}
                  </div>
                ) : null}
                <div className="text-[10px] font-medium text-white/25">
                  {countLabel}
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

          if (totalCount <= 0 && !hasGoals) {
            return <div key={key}>{cell}</div>;
          }

          return (
            <Tooltip
              key={key}
              open={openTooltipKey === key || nestedTooltipKey === key}
              onOpenChange={(open) => {
                if (open) {
                  setOpenTooltipKey(key);
                  return;
                }

                setOpenTooltipKey((current) => (current === key ? null : current));
              }}
            >
              <TooltipTrigger asChild>{cell}</TooltipTrigger>
              <TooltipContent className="px-0 py-3">
                <div className="flex max-h-72 min-w-[280px] max-w-[360px] flex-col overflow-auto">
                  <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                    <span>{formatTooltipDate(day)}</span>
                    <span>
                      {count > 0 && liveCount > 0
                        ? `${formatTradeCount(count)} closed · ${formatTradeCount(liveCount)} live`
                        : count > 0
                          ? `${formatTradeCount(count)} ${count === 1 ? "trade" : "trades"}`
                          : `${formatTradeCount(liveCount)} live`}
                    </span>
                  </div>
                  {totalCount > 0 ? <Separator className="mt-2 w-full" /> : null}
                  {previewLoading && previewTrades.length === 0 ? (
                    <div className="flex flex-col gap-2 px-3 pt-2">
                      <Skeleton className="h-3 w-32 rounded-none bg-sidebar-accent" />
                      <Skeleton className="h-3 w-28 rounded-none bg-sidebar-accent" />
                      <Skeleton className="h-3 w-24 rounded-none bg-sidebar-accent" />
                    </div>
                  ) : previewTrades.length > 0 ? (
                    <div className="flex flex-col gap-1 px-3 pt-2">
                      {groupedPreviewRows.map((group) => {
                        return (
                          <div
                            key={group.symbol}
                            className="flex w-full items-center justify-between gap-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white">
                              {group.symbol}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  TRADE_IDENTIFIER_PILL_CLASS,
                                  "min-h-0 shrink-0 px-1.5 py-0 text-[10px]",
                                  getTradePillProfitTone(
                                    Number(group.totalProfit || 0)
                                  )
                                )}
                                >
                                  {formatTradePillMoney(
                                    Number(group.totalProfit || 0),
                                    currencyCode
                                  )}
                              </span>
                              {group.items.length > 1 ? (
                                <GroupedTradeMultiplierChip
                                  label={`x${formatTradeCount(group.items.length)}`}
                                  onOpenChange={(open) => {
                                    setNestedTooltipKey((current) => {
                                      if (open) return key;
                                      return current === key ? null : current;
                                    });
                                    if (open) {
                                      setOpenTooltipKey(key);
                                    }
                                  }}
                                >
                                  {group.items.map((item) => {
                                    const row = previewTrades.find(
                                      (previewTrade) =>
                                        previewTrade.id === item.id
                                    );
                                    const opened = row?.open
                                      ? new Date(
                                          row.open
                                        ).toLocaleTimeString([], {
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
                                        {row?.status === "live" ? (
                                          <span className="rounded-xs bg-cyan-400/12 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-cyan-200 ring-1 ring-cyan-400/20">
                                            Live
                                          </span>
                                        ) : null}
                                        <span className="min-w-0 flex-1 truncate text-center text-[11px] tabular-nums text-white/40">
                                          {row?.symbol}
                                        </span>
                                        <span
                                          className={cn(
                                            TRADE_IDENTIFIER_PILL_CLASS,
                                            "ml-auto min-h-0 shrink-0 px-1.5 py-0 text-[10px]",
                                            getTradePillProfitTone(
                                              Number(row?.profit || 0)
                                            )
                                          )}
                                        >
                                          {formatTradePillMoney(
                                            Number(row?.profit || 0),
                                            currencyCode
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </GroupedTradeMultiplierChip>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : totalCount > 0 ? (
                    <span className="px-3 pt-2 text-[11px] text-white/40">
                      No trade details available.
                    </span>
                  ) : null}
                  {previewLoading && count > 0 && previewTrades.length > 0 ? (
                    <span className="px-3 pt-2 text-[10px] text-white/40">
                      Loading closed trades...
                    </span>
                  ) : null}
                  {totalCount > 0 && !previewLoading && extra > 0 ? (
                    <span className="px-3 pt-2 text-[10px] text-white/40">
                      Showing {formatTradeCount(shown)} of {formatTradeCount(totalCount)} trades.
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
