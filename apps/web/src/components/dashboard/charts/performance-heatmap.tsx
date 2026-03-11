"use client";

import React from "react";
import { useDateRangeStore } from "@/stores/date-range";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatSignedCurrency } from "./dashboard-chart-ui";
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

export function PerformanceHeatmap({
  accountId,
}: {
  accountId?: string;
}) {
  const { start, end, min, max } = useDateRangeStore();
  const [hoveredCell, setHoveredCell] = React.useState<string | null>(null);

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

  const dateRangeText = React.useMemo(() => {
    if (!resolvedRange) return "";
    const startStr = resolvedRange.start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = resolvedRange.end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startStr} - ${endStr}`;
  }, [resolvedRange]);

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

  const { data, maxProfit, minProfit } = React.useMemo(() => {
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

    const cells: HeatmapCell[] = [];
    let maxValue = 0;
    let minValue = 0;

    DAYS.forEach((dayName, dayIndex) => {
      HOURS.forEach((hour) => {
        const key = `${dayIndex}-${hour}`;
        const cell = grid[key] || { profit: 0, count: 0 };
        const avgProfit = cell.count > 0 ? cell.profit / cell.count : 0;

        cells.push({
          hour,
          day: dayName,
          profit: cell.profit,
          count: cell.count,
          avgProfit,
        });

        if (avgProfit > maxValue) maxValue = avgProfit;
        if (avgProfit < minValue) minValue = avgProfit;
      });
    });

    return {
      data: cells,
      maxProfit: maxValue,
      minProfit: minValue,
    };
  }, [trades]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 h-full justify-center">
        <Skeleton className="h-4 w-32 rounded-none bg-sidebar" />
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

  const getColor = (avgProfit: number, count: number) => {
    if (count === 0) return "bg-sidebar-accent/20";

    const absMax = Math.max(Math.abs(maxProfit), Math.abs(minProfit));
    const intensity = absMax > 0 ? Math.abs(avgProfit) / absMax : 0;

    if (avgProfit > 0) {
      // Green for profit
      const opacity = Math.min(intensity * 100, 100);
      return `bg-teal-500/${Math.max(20, Math.round(opacity))}`;
    } else if (avgProfit < 0) {
      // Red for loss
      const opacity = Math.min(intensity * 100, 100);
      return `bg-rose-500/${Math.max(20, Math.round(opacity))}`;
    }

    return "bg-sidebar-accent/20";
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-white/60">Performance by Hour & Day</span>
        <span className="text-xs text-white/40">{dateRangeText}</span>
      </div>

      <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-0.5 text-[10px] flex-1 overflow-auto">
        {/* Header: Hours */}
        <div></div>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="text-center text-white/40 py-0.5 text-[9px]"
          >
            {hour % 6 === 0 ? hour : ""}
          </div>
        ))}

        {/* Rows: Days */}
        {DAYS.map((day, dayIndex) => (
          <React.Fragment key={day}>
            <div className="text-white/60 pr-1.5 py-0.5 flex items-center justify-end text-[10px]">
              {day}
            </div>
            {HOURS.map((hour) => {
              const cell = data.find(
                (d) => d.day === day && d.hour === hour
              );
              if (!cell) return <div key={hour} className="aspect-square" />;

              const cellKey = `${day}-${hour}`;
              const isHovered = hoveredCell === cellKey;

              return (
                <div
                  key={hour}
                  className={cn(
                    "aspect-square border border-white/5 cursor-pointer hover:border-white/20 transition-all relative",
                    getColor(cell.avgProfit, cell.count)
                  )}
                  onMouseEnter={() => setHoveredCell(cellKey)}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  {/* Tooltip on hover - only show for this cell */}
                  {isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-sidebar border border-white/10 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-[100]">
                      {day} {hour}:00
                      <br />
                      {cell.count} trades
                      <br />
                      Avg: {formatSignedCurrency(cell.avgProfit, 2)}
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-rose-500/60"></div>
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-sidebar-accent/20"></div>
          <span>No trades</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-teal-500/60"></div>
          <span>Profit</span>
        </div>
      </div>
    </div>
  );
}
