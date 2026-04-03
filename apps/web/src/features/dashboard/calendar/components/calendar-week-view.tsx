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

import { GroupedTradeMultiplierChip } from "./grouped-trade-multiplier-chip";
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
  formatTooltipDate,
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
  currencyCode?: string | null;
  days: DayRow[];
  goalMap: Map<string, GoalMarker[]>;
  goalOverlay: boolean;
  heatmapEnabled: boolean;
  heatmapMaxAbs: number;
  initialBalance: number | null;
  hoveredISO: string | null;
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
    .sort((left, right) => Math.abs(right.totalProfit) - Math.abs(left.totalProfit))
    .slice(0, 3);
}

export function CalendarWeekView({
  currencyCode,
  days,
  goalMap,
  goalOverlay,
  heatmapEnabled,
  heatmapMaxAbs,
  initialBalance,
  hoveredISO,
  livePreviewMap,
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
        const liveCount = dayRow.liveTradeCount || 0;
        const liveProfit = dayRow.liveTradeProfit || 0;
        const totalCount = dayRow.count + liveCount;
        const displayProfit = dayRow.count > 0 ? dayRow.totalProfit : liveProfit;
        const isGain = displayProfit >= 0;
        const pctValue =
          initialBalance && initialBalance > 0
            ? (Number(displayProfit || 0) / initialBalance) * 100
            : 0;
        const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(2)}%`;
        const heatBg = heatmapEnabled
          ? getHeatmapBg(displayProfit, totalCount, heatmapMaxAbs)
          : undefined;
        const previewRows = [
          ...(livePreviewMap.get(dayRow.dateISO) || []),
          ...(previews[dayRow.dateISO]?.trades || []),
        ].sort(
          (left, right) =>
            new Date(left.open).getTime() - new Date(right.open).getTime()
        );
        const previewLoading =
          dayRow.count > 0 ? previews[dayRow.dateISO]?.loading ?? true : false;
        const groupedRows = buildGroupedPreviewRows(previewRows);
        const tradeCountLabel =
          dayRow.count > 0 && liveCount > 0
            ? `${formatTradeCount(dayRow.count)} closed · ${formatTradeCount(liveCount)} live`
            : dayRow.count > 0
              ? `${formatTradeCount(dayRow.count)} ${dayRow.count === 1 ? "trade" : "trades"}`
              : liveCount > 0
                ? `${formatTradeCount(liveCount)} live`
                : "0 trades";

        const cell = (
          <div
            key={dayRow.dateISO}
            className={cn(
              "flex min-h-[180px] w-full cursor-pointer flex-col border-black/10 bg-white p-5 transition-colors duration-250 hover:bg-sidebar-accent dark:border-white/5 dark:bg-sidebar",
              isSingleDayView
                ? "rounded-md border"
                : "first:rounded-l-md last:rounded-r-md first:border not-first:border not-last:border-l-0 last:border-l-0"
            )}
            role="button"
            tabIndex={0}
            aria-label={`View trades for ${formatAccessibleDate(dayDate)}`}
            style={heatBg ? { backgroundColor: heatBg } : undefined}
            onClick={() => onSelectDay(dayRow.dateISO)}
            onKeyDown={(event) => handleDayKeyDown(event, dayRow.dateISO, onSelectDay)}
            onMouseEnter={() => onHoverDay(dayRow.dateISO, dayRow.count, totalCount)}
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
                      const extra = Math.max(0, Number(totalCount || 0) - shown);
                      return extra > 0 ? (
                        <span className="inline-block rounded-xs bg-neutral-800/25 px-2 py-0.5 text-[10px] font-medium text-white/60">
                          +{formatTradeCount(extra)} trades
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex h-full flex-col place-content-end gap-1">
                  {previewLoading && groupedRows.length === 0 ? (
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
                            {formatTradePillMoney(
                              Number(group.totalProfit || 0),
                              currencyCode
                            )}
                          </span>
                          {group.items.length > 1 ? (
                            <GroupedTradeMultiplierChip
                              label={`x${formatTradeCount(group.items.length)}`}
                            >
                              {group.items.map((item) => {
                                const row = previewRows.find(
                                  (preview) => preview.id === item.id
                                );
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
                                    {row?.status === "live" ? (
                                      <span className="rounded-xs bg-cyan-400/12 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-cyan-200 ring-1 ring-cyan-400/20">
                                        Live
                                      </span>
                                    ) : null}
                                    <span className="min-w-0 flex-1 truncate text-center text-[11px] tabular-nums text-white/40">
                                      {formatDuration(row?.holdSeconds || 0)}
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
                    ))
                  ) : (
                    <span className="text-xs text-white/40">
                      {totalCount > 0 ? "No trade details available." : "No trades"}
                    </span>
                  )}
                  {previewLoading && dayRow.count > 0 && groupedRows.length > 0 ? (
                    <span className="pt-1 text-[10px] text-white/40">
                      Loading closed trades...
                    </span>
                  ) : null}
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
                      displayProfit === 0 ? "text-white/25" : ""
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
                      displayProfit === 0 ? "text-white/50" : ""
                    )}
                  >
                    {formatMoney(displayProfit, currencyCode)}
                  </div>
                </div>
                {dayRow.count > 0 && liveCount > 0 ? (
                  <div className="mt-1 text-[11px] font-medium text-cyan-200/80">
                    Live {formatMoney(liveProfit, currencyCode)}
                  </div>
                ) : null}
                <div className="mt-1 text-xs font-medium text-white/25">
                  {tradeCountLabel}
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
                <span className="text-[11px] text-white/60">
                  {formatTooltipDate(dayDate)}
                </span>
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
