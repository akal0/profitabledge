"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAccountStore } from "@/stores/account";

import { Skeleton } from "../../ui/skeleton";
import { cn } from "@/lib/utils";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

export type CorrelationAxis = "session" | "symbol" | "direction";
export type CorrelationMetric = "winRate" | "avgRR" | "pnl" | "count";

function getAxisValue(trade: any, axis: CorrelationAxis): string {
  switch (axis) {
    case "session":
      return trade.sessionTag || "Untagged";
    case "symbol":
      return trade.symbol || "Unknown";
    case "direction": {
      const direction = String(trade.tradeType || "").toLowerCase();
      if (direction === "buy" || direction === "long") return "Long";
      if (direction === "sell" || direction === "short") return "Short";
      return "Unknown";
    }
  }
}

function heatColor(value: number, min: number, max: number): string {
  if (max === min) return "bg-white/[0.04]";
  const ratio = (value - min) / (max - min);
  if (ratio > 0.8) return "bg-emerald-500/30";
  if (ratio > 0.6) return "bg-emerald-500/15";
  if (ratio > 0.4) return "bg-white/[0.04]";
  if (ratio > 0.2) return "bg-red-500/12";
  return "bg-red-500/25";
}

function formatMetricValue(metric: CorrelationMetric, value: number) {
  if (metric === "pnl") return formatSignedCurrency(value, 0);
  if (metric === "winRate") return `${value.toFixed(1)}%`;
  if (metric === "avgRR") return `${value.toFixed(2)}R`;
  return `${Math.round(value).toLocaleString()} trades`;
}

export function CorrelationMatrix({
  accountId,
  rowAxis = "session",
  colAxis = "symbol",
  metric = "winRate",
}: {
  accountId?: string;
  rowAxis?: CorrelationAxis;
  colAxis?: CorrelationAxis;
  metric?: CorrelationMetric;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);
  const [hoveredCell, setHoveredCell] = useState<{
    key: string;
    rect: { top: number; left: number; width: number };
  } | null>(null);

  const { matrix, rows, cols, minVal, maxVal } = useMemo(() => {
    if (trades.length === 0) {
      return {
        matrix: {} as Record<string, Record<string, number>>,
        rows: [] as string[],
        cols: [] as string[],
        minVal: 0,
        maxVal: 0,
      };
    }

    const groups: Record<string, Record<string, any[]>> = {};
    const rowSet = new Set<string>();
    const colSet = new Set<string>();

    for (const trade of trades) {
      const rowValue = getAxisValue(trade, rowAxis);
      const colValue = getAxisValue(trade, colAxis);
      rowSet.add(rowValue);
      colSet.add(colValue);
      if (!groups[rowValue]) groups[rowValue] = {};
      if (!groups[rowValue][colValue]) groups[rowValue][colValue] = [];
      groups[rowValue][colValue].push(trade);
    }

    const nextMatrix: Record<string, Record<string, number>> = {};
    let min = Infinity;
    let max = -Infinity;

    for (const rowValue of rowSet) {
      nextMatrix[rowValue] = {};
      for (const colValue of colSet) {
        const cell = groups[rowValue]?.[colValue] || [];
        if (cell.length === 0) {
          nextMatrix[rowValue][colValue] = Number.NaN;
          continue;
        }

        const pnls = cell.map((trade: any) =>
          parseFloat(trade.profit?.toString() || "0")
        );
        const rrs = cell
          .map((trade: any) => parseFloat(trade.realisedRR?.toString() || "0"))
          .filter((value: number) => Number.isFinite(value));
        const wins = pnls.filter((value: number) => value > 0).length;

        let value = 0;
        switch (metric) {
          case "winRate":
            value = (wins / cell.length) * 100;
            break;
          case "avgRR":
            value =
              rrs.length > 0
                ? rrs.reduce((sum: number, rr: number) => sum + rr, 0) /
                  rrs.length
                : 0;
            break;
          case "pnl":
            value = pnls.reduce((sum: number, pnl: number) => sum + pnl, 0);
            break;
          case "count":
            value = cell.length;
            break;
        }

        nextMatrix[rowValue][colValue] = parseFloat(value.toFixed(2));
        if (!Number.isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    }

    const sortedRows = [...rowSet].sort((a, b) => {
      const aCount = Object.values(groups[a] || {}).reduce(
        (sum, cell) => sum + cell.length,
        0
      );
      const bCount = Object.values(groups[b] || {}).reduce(
        (sum, cell) => sum + cell.length,
        0
      );
      return bCount - aCount;
    });
    const sortedCols = [...colSet].sort((a, b) => {
      let aCount = 0;
      let bCount = 0;
      for (const rowValue of rowSet) {
        aCount += groups[rowValue]?.[a]?.length || 0;
        bCount += groups[rowValue]?.[b]?.length || 0;
      }
      return bCount - aCount;
    });

    return {
      matrix: nextMatrix,
      rows: sortedRows.slice(0, 8),
      cols: sortedCols.slice(0, 8),
      minVal: min === Infinity ? 0 : min,
      maxVal: max === -Infinity ? 0 : max,
    };
  }, [colAxis, metric, rowAxis, trades]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (trades.length < 10) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Need at least 10 trades for correlation matrix
      </div>
    );
  }

  const metricLabel =
    metric === "winRate"
      ? "win rate"
      : metric === "avgRR"
      ? "avg RR"
      : metric === "pnl"
      ? "P&L"
      : "trade count";

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-visible">
        <div className="grid min-h-full min-w-full">
          <div className="my-auto">
            <table className="mx-auto h-auto w-max border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-sidebar-accent" />
                  {cols.map((colValue) => (
                    <th
                      key={colValue}
                      className="sticky top-0 z-10 min-w-[10rem] whitespace-nowrap bg-sidebar-accent px-3 pb-2 text-center text-[10px] font-medium uppercase tracking-wider text-white/35"
                    >
                      {colValue}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((rowValue) => (
                  <tr key={rowValue}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-sidebar-accent pr-4 text-right text-[10px] font-medium text-white/50">
                      {rowValue}
                    </td>
                    {cols.map((colValue) => {
                      const value = matrix[rowValue]?.[colValue];
                      const isEmpty = Number.isNaN(value);
                      const hoverKey = `${rowValue}:${colValue}`;
                      const isHovered = hoveredCell?.key === hoverKey;
                      return (
                        <td
                          key={colValue}
                          className="p-[3px]"
                          onMouseEnter={(e) => {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              key: hoverKey,
                              rect: {
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                              },
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className={cn(
                              "flex min-h-[6rem] min-w-[10rem] items-center justify-center rounded px-2 py-2 transition-all",
                              isEmpty
                                ? "bg-white/[0.02]"
                                : heatColor(value, minVal, maxVal),
                              isHovered &&
                                !isEmpty &&
                                "ring-1 ring-white/20 brightness-125"
                            )}
                          >
                            {isEmpty ? (
                              <span className="text-[10px] text-white/8">
                                —
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold leading-tight tabular-nums text-white/90">
                                {formatMetricValue(metric, value)}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {hoveredCell &&
        (() => {
          const [row, col] = hoveredCell.key.split(":");
          const value = matrix[row]?.[col];
          if (Number.isNaN(value)) return null;
          return createPortal(
            <div
              className="pointer-events-none fixed z-50"
              style={{
                top: hoveredCell.rect.top - 8,
                left: hoveredCell.rect.left + hoveredCell.rect.width / 2,
                transform: "translate(-50%, -100%)",
              }}
            >
              <DashboardChartTooltipFrame title={`${row} × ${col}`}>
                <DashboardChartTooltipRow
                  label={metricLabel}
                  value={formatMetricValue(metric, value)}
                  tone={
                    metric === "pnl"
                      ? value >= 0
                        ? "positive"
                        : "negative"
                      : "default"
                  }
                />
              </DashboardChartTooltipFrame>
            </div>,
            document.body
          );
        })()}
    </div>
  );
}
