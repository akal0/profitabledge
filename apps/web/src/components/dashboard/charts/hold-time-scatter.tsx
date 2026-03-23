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

import { useChartTrades } from "./use-chart-trades";
import { useChartRenderMode } from "./chart-render-mode";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
  useChartCurrencyCode,
} from "./dashboard-chart-ui";

function formatDuration(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
  const renderMode = useChartRenderMode();
  const { trades, isLoading } = useChartTrades(effectiveAccountId);
  const resolvedCurrencyCode = useChartCurrencyCode(accountId);

  const scatterData = useMemo(() => {
    const maxPoints =
      renderMode === "embedded" ? 300 : Number.POSITIVE_INFINITY;
    const eligibleTrades = trades
      .filter((trade) => {
        return (
          Number.isFinite(Number(trade.holdSeconds)) &&
          Number(trade.holdSeconds) > 0 &&
          Number.isFinite(Number(trade.netPnl ?? trade.profit))
        );
      })
      .map((trade) => ({
        trade,
        profit: Number(trade.netPnl ?? trade.profit ?? 0),
      }));
    const sampleStep =
      maxPoints !== Number.POSITIVE_INFINITY &&
      eligibleTrades.length > maxPoints
        ? Math.ceil(eligibleTrades.length / maxPoints)
        : 1;
    const sampledTrades =
      sampleStep > 1
        ? eligibleTrades.filter((_, index) => index % sampleStep === 0)
        : eligibleTrades;

    return sampledTrades
      .map((trade) => {
        const profit = trade.profit;
        const holdMinutes = Number(trade.trade.holdSeconds ?? 0) / 60;
        const rr = Number(trade.trade.realisedRR ?? 0);
        return {
          holdMinutes,
          profit,
          rr,
          symbol: trade.trade.symbol || "Unknown",
          size: Math.max(24, Math.min(180, Math.abs(profit))),
        };
      });
  }, [renderMode, trades]);

  const winners = scatterData.filter((trade) => trade.profit >= 0);
  const losers = scatterData.filter((trade) => trade.profit < 0);

  const stats = useMemo(() => {
    const holdTimes = scatterData.map((trade) => trade.holdMinutes);
    return {
      medianHold: median(holdTimes),
    };
  }, [scatterData]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    );
  }

  if (scatterData.length < 5) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">
          Need at least 5 closed trades with duration data
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis
          type="number"
          dataKey="holdMinutes"
          name="Hold time"
          stroke="#ffffff50"
          tick={{ fill: "#ffffff70", fontSize: 11 }}
          tickFormatter={formatDuration}
          label={{
            value: "Hold time",
            position: "insideBottom",
            offset: -5,
            fill: "#ffffff50",
          }}
        />
        <YAxis
          type="number"
          dataKey="profit"
          name="P&L"
          stroke="#ffffff50"
          tick={{ fill: "#ffffff70", fontSize: 11 }}
          width={72}
          tickFormatter={(value) =>
            formatSignedCurrency(value, 0, resolvedCurrencyCode)
          }
          label={{
            value: "P&L",
            angle: -90,
            position: "insideLeft",
            fill: "#ffffff50",
          }}
        />
        <ZAxis type="number" dataKey="size" range={[20, 200]} />
        <Tooltip
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
                  value={formatSignedCurrency(
                    point.profit,
                    2,
                    resolvedCurrencyCode
                  )}
                  tone={point.profit >= 0 ? "positive" : "negative"}
                />
                <DashboardChartTooltipRow
                  label="Realised RR"
                  value={`${point.rr.toFixed(2)}R`}
                  tone={point.rr >= 0 ? "positive" : "negative"}
                />
                <DashboardChartTooltipRow
                  label="Median hold"
                  value={formatDuration(stats.medianHold)}
                />
              </DashboardChartTooltipFrame>
            );
          }}
        />
        <ReferenceLine y={0} stroke="#ffffff30" strokeWidth={1} />
        <Scatter
          name="Winning Trades"
          data={winners}
          fill="#10b981"
          fillOpacity={0.6}
          isAnimationActive={renderMode !== "embedded"}
        />
        <Scatter
          name="Losing Trades"
          data={losers}
          fill="#ef4444"
          fillOpacity={0.6}
          isAnimationActive={renderMode !== "embedded"}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
