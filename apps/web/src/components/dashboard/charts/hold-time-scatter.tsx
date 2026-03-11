"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/stores/account";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { Skeleton } from "../../ui/skeleton";
import { useChartTrades } from "./use-chart-trades";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "./dashboard-chart-ui";

function formatDuration(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function HoldTimeScatterChart({ accountId }: { accountId?: string }) {
  const storeAccountId = useAccountStore((state) => state.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);

  const scatterData = useMemo(() => {
    return trades
      .filter((trade) => {
        return (
          Number.isFinite(Number(trade.holdSeconds)) &&
          Number(trade.holdSeconds) > 0 &&
          Number.isFinite(Number(trade.profit))
        );
      })
      .map((trade) => {
        const profit = Number(trade.profit ?? 0);
        const holdMinutes = Number(trade.holdSeconds ?? 0) / 60;
        const rr = Number(trade.realisedRR ?? 0);
        return {
          holdMinutes,
          profit,
          rr,
          symbol: trade.symbol || "Unknown",
          outcome: profit >= 0 ? "Winning Trades" : "Losing Trades",
          size: Math.max(24, Math.min(180, Math.abs(profit))),
        };
      });
  }, [trades]);

  const winners = scatterData.filter((trade) => trade.profit >= 0);
  const losers = scatterData.filter((trade) => trade.profit < 0);

  const stats = useMemo(() => {
    const holdTimes = scatterData.map((trade) => trade.holdMinutes);
    return {
      medianHold: median(holdTimes),
      avgWinnerHold: average(winners.map((trade) => trade.holdMinutes)),
      avgLoserHold: average(losers.map((trade) => trade.holdMinutes)),
    };
  }, [losers, scatterData, winners]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (scatterData.length < 5) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Need at least 5 closed trades with duration data
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-[9px] text-white/30">
        <span>
          Median hold:{" "}
          <span className="font-medium text-white/70">
            {formatDuration(stats.medianHold)}
          </span>
        </span>
        <span>
          Avg winner hold:{" "}
          <span className="font-medium text-emerald-400">
            {formatDuration(stats.avgWinnerHold)}
          </span>
        </span>
        <span>
          Avg loser hold:{" "}
          <span className="font-medium text-rose-400">
            {formatDuration(stats.avgLoserHold)}
          </span>
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              type="number"
              dataKey="holdMinutes"
              name="Hold time"
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDuration}
              label={{
                value: "Hold time",
                position: "insideBottom",
                offset: -4,
                fill: "rgba(255,255,255,0.35)",
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="profit"
              name="P&L"
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value) => formatSignedCurrency(value, 0)}
            />
            <ZAxis type="number" dataKey="size" range={[32, 160]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as {
                  symbol: string;
                  holdMinutes: number;
                  profit: number;
                  rr: number;
                };
                return (
                  <DashboardChartTooltipFrame title={point.symbol}>
                    <DashboardChartTooltipRow
                      label="Hold time"
                      value={formatDuration(point.holdMinutes)}
                    />
                    <DashboardChartTooltipRow
                      label="P&L"
                      value={formatSignedCurrency(point.profit, 2)}
                      tone={point.profit >= 0 ? "positive" : "negative"}
                    />
                    <DashboardChartTooltipRow
                      label="Realised RR"
                      value={`${point.rr.toFixed(2)}R`}
                      tone={point.rr >= 0 ? "positive" : "negative"}
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <ReferenceLine
              y={0}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="5 5"
            />
            <Scatter
              name="Winning Trades"
              data={winners.map((trade) => ({
                ...trade,
                "Hold time": trade.holdMinutes,
                "P&L": trade.profit,
                RR: trade.rr,
              }))}
              fill="#34d399"
              fillOpacity={0.45}
            />
            <Scatter
              name="Losing Trades"
              data={losers.map((trade) => ({
                ...trade,
                "Hold time": trade.holdMinutes,
                "P&L": trade.profit,
                RR: trade.rr,
              }))}
              fill="#fb7185"
              fillOpacity={0.45}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
