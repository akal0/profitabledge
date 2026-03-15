"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "./dashboard-chart-ui";
import { useChartDateRange } from "./use-chart-date-range";
import { useChartTrades } from "./use-chart-trades";

type HeatmapCell = {
  hour: number;
  day: string;
  profit: number;
  count: number;
  avgProfit: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};
const HEATMAP_COLUMN_TEMPLATE = "2rem repeat(24, minmax(0, 1fr))";
const HEATMAP_ROW_TEMPLATE = "1rem repeat(7, minmax(0, 1fr))";

function getHeatmapBackground(
  avgProfit: number,
  count: number,
  maxProfit: number,
  minProfit: number
) {
  if (count === 0) {
    return "rgba(255, 255, 255, 0.03)";
  }

  const absMax = Math.max(Math.abs(maxProfit), Math.abs(minProfit));
  const intensity = absMax > 0 ? Math.abs(avgProfit) / absMax : 0;
  const alpha = Math.max(0.18, Math.min(0.82, intensity * 0.82));

  if (avgProfit > 0) {
    return `rgba(20, 184, 166, ${alpha})`;
  }

  if (avgProfit < 0) {
    return `rgba(244, 63, 94, ${alpha})`;
  }

  return "rgba(255, 255, 255, 0.03)";
}

function formatHourSlot(hour: number) {
  const endHour = (hour + 1) % 24;
  return `${hour.toString().padStart(2, "0")}:00 - ${endHour
    .toString()
    .padStart(2, "0")}:00`;
}

export function PerformanceHeatmap({
  accountId,
}: {
  accountId?: string;
}) {
  const { start, end, min, max } = useChartDateRange();

  const resolvedRange = React.useMemo(() => {
    const minD = min ? new Date(min) : undefined;
    const maxD = max ? new Date(max) : undefined;
    minD?.setUTCHours(0, 0, 0, 0);
    maxD?.setUTCHours(0, 0, 0, 0);

    if (start && end) {
      return { start: new Date(start), end: new Date(end) };
    }

    const fallbackEnd = maxD ?? new Date();
    const endUTC = new Date(
      Date.UTC(
        fallbackEnd.getUTCFullYear(),
        fallbackEnd.getUTCMonth(),
        fallbackEnd.getUTCDate()
      )
    );
    const startUTC = new Date(endUTC);
    startUTC.setUTCDate(startUTC.getUTCDate() - 29);
    if (minD && startUTC < minD) {
      return { start: minD, end: endUTC };
    }
    return { start: startUTC, end: endUTC };
  }, [start, end, min, max]);

  const rangeOverride = React.useMemo(
    () =>
      resolvedRange
        ? {
            startISO: resolvedRange.start.toISOString(),
            endISO: resolvedRange.end.toISOString(),
          }
        : undefined,
    [resolvedRange]
  );

  const { trades, isLoading } = useChartTrades(accountId, rangeOverride);

  const { cellMap, maxProfit, minProfit } = React.useMemo(() => {
    const grid: Record<string, { profit: number; count: number }> = {};

    trades.forEach((trade) => {
      if (!trade.close || trade.profit == null) return;

      const closeDate = new Date(trade.close);
      const hour = closeDate.getHours();
      const day = closeDate.getDay();
      const key = `${day}-${hour}`;

      if (!grid[key]) {
        grid[key] = { profit: 0, count: 0 };
      }

      grid[key].profit += Number(trade.profit);
      grid[key].count += 1;
    });

    const nextCellMap: Record<string, HeatmapCell> = {};
    let maxValue = 0;
    let minValue = 0;

    DAYS.forEach((dayName, dayIndex) => {
      HOURS.forEach((hour) => {
        const key = `${dayIndex}-${hour}`;
        const cell = grid[key] || { profit: 0, count: 0 };
        const avgProfit = cell.count > 0 ? cell.profit / cell.count : 0;

        nextCellMap[`${dayName}-${hour}`] = {
          hour,
          day: dayName,
          profit: cell.profit,
          count: cell.count,
          avgProfit,
        };

        if (avgProfit > maxValue) maxValue = avgProfit;
        if (avgProfit < minValue) minValue = avgProfit;
      });
    });

    return {
      cellMap: nextCellMap,
      maxProfit: maxValue,
      minProfit: minValue,
    };
  }, [trades]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-full w-full rounded-none bg-sidebar" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No trades in selected range
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden py-1">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="grid h-full w-full gap-0.5 text-[10px]"
            style={{
              gridTemplateColumns: HEATMAP_COLUMN_TEMPLATE,
              gridTemplateRows: HEATMAP_ROW_TEMPLATE,
            }}
          >
            <div />
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex items-end justify-center pb-0.5 text-[8px] leading-none text-white/40"
              >
                {hour % 6 === 0 ? hour : ""}
              </div>
            ))}

            {DAYS.map((day) => (
              <React.Fragment key={day}>
                <div className="flex items-center justify-end pr-1 text-[9px] text-white/60">
                  {day}
                </div>
                {HOURS.map((hour) => {
                  const cell = cellMap[`${day}-${hour}`];
                  if (!cell) return <div key={hour} className="h-full w-full" />;

                  const title = `${DAY_LABELS[day]} • ${formatHourSlot(hour)}`;
                  const totalTone =
                    cell.profit > 0
                      ? "positive"
                      : cell.profit < 0
                        ? "negative"
                        : "default";
                  const averageTone =
                    cell.avgProfit > 0
                      ? "positive"
                      : cell.avgProfit < 0
                        ? "negative"
                        : "default";

                  return (
                    <Tooltip key={hour}>
                      <TooltipTrigger asChild>
                        <div
                          tabIndex={0}
                          className={cn(
                            "relative h-full min-h-0 w-full cursor-pointer rounded-[2px] border border-white/5 transition-all hover:border-white/20 focus-visible:border-white/25 focus-visible:outline-none data-[state=closed]:border-white/5 data-[state=delayed-open]:border-white/25 data-[state=instant-open]:border-white/25"
                          )}
                          style={{
                            backgroundColor: getHeatmapBackground(
                              cell.avgProfit,
                              cell.count,
                              maxProfit,
                              minProfit
                            ),
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        sideOffset={8}
                        className="border-0 bg-transparent p-0 shadow-none"
                      >
                        <DashboardChartTooltipFrame
                          title={title}
                          className="min-w-[14rem]"
                        >
                          <DashboardChartTooltipRow
                            label="Trades"
                            value={cell.count.toLocaleString()}
                            dimmed={cell.count === 0}
                          />
                          <DashboardChartTooltipRow
                            label="Net P&L"
                            value={formatSignedCurrency(cell.profit, 2)}
                            tone={totalTone}
                            dimmed={cell.count === 0}
                          />
                          <DashboardChartTooltipRow
                            label="Avg per trade"
                            value={formatSignedCurrency(cell.avgProfit, 2)}
                            tone={averageTone}
                            dimmed={cell.count === 0}
                          />
                        </DashboardChartTooltipFrame>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-white/40">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-rose-500/60" />
            <span>Loss</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-sidebar-accent/20" />
            <span>No trades</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-teal-500/60" />
            <span>Profit</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
