"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/stores/account";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Skeleton } from "../../ui/skeleton";
import { cn } from "@/lib/utils";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
  useChartCurrencyCode,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

function normalPDF(x: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return x === mean ? 1 : 0;
  const exponent = -0.5 * ((x - mean) / stdDev) ** 2;
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.E ** exponent;
}

const chartConfig = {
  count: {
    label: "Trade count",
    color: "rgba(129,140,248,0.55)",
  },
  normal: {
    label: "Normal fit",
    color: "#f59e0b",
  },
} satisfies ChartConfig;

export function BellCurveChart({
  accountId,
  currencyCode,
}: {
  accountId?: string;
  currencyCode?: string | null;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);
  const resolvedCurrencyCode = useChartCurrencyCode(accountId, currencyCode);

  const chartData = useMemo(() => {
    if (trades.length < 5) return null;

    const profits = trades.map((trade) =>
      parseFloat((trade.netPnl ?? trade.profit ?? 0).toString())
    );
    const mean = profits.reduce((sum, value) => sum + value, 0) / profits.length;
    const variance =
      profits.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      profits.length;
    const stdDev = Math.sqrt(variance);

    const min = Math.min(...profits);
    const max = Math.max(...profits);
    const range = max - min;
    if (range === 0) return null;

    const binCount = Math.min(30, Math.max(10, Math.ceil(Math.sqrt(profits.length))));
    const binWidth = range / binCount;

    const bins: Array<{
      x: number;
      count: number;
      normal: number;
      label: string;
      lower: number;
      upper: number;
    }> = [];

    for (let i = 0; i < binCount; i++) {
      const lower = min + i * binWidth;
      const upper = lower + binWidth;
      const midpoint = (lower + upper) / 2;
      const count = profits.filter((profit) =>
        profit >= lower && (i === binCount - 1 ? profit <= upper : profit < upper)
      ).length;

      const normalHeight = normalPDF(midpoint, mean, stdDev) * profits.length * binWidth;

      bins.push({
        x: midpoint,
        count,
        normal: parseFloat(normalHeight.toFixed(2)),
        label: formatSignedCurrency(midpoint, 0, resolvedCurrencyCode),
        lower,
        upper,
      });
    }

    return {
      bins,
      mean,
      stdDev,
      skewness:
        stdDev > 0
          ? profits.reduce(
              (sum, value) => sum + ((value - mean) / stdDev) ** 3,
              0
            ) / profits.length
          : 0,
      kurtosis:
        stdDev > 0
          ? profits.reduce(
              (sum, value) => sum + ((value - mean) / stdDev) ** 4,
              0
            ) / profits.length - 3
          : 0,
    };
  }, [resolvedCurrencyCode, trades]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!chartData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Need at least 5 trades for distribution analysis
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm font-normal tracking-wide text-white/40">
        <span>
          Average trade outcome is{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              chartData.mean >= 0 ? "text-teal-400" : "text-rose-400"
            )}
          >
            {formatSignedCurrency(chartData.mean, 2, resolvedCurrencyCode)}
          </span>
          .
        </span>
        <span>
          Std dev{" "}
          <span className="font-medium tracking-normal text-white/80">
            {formatSignedCurrency(chartData.stdDev, 2, resolvedCurrencyCode)}
          </span>
          .
        </span>
        <span>
          Skew{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              chartData.skewness >= 0 ? "text-teal-400" : "text-rose-400"
            )}
          >
            {chartData.skewness.toFixed(2)}
          </span>
          .
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ComposedChart data={chartData.bins} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload;
                return (
                  <DashboardChartTooltipFrame
                    title={`${formatSignedCurrency(item.lower, 0, resolvedCurrencyCode)} to ${formatSignedCurrency(
                      item.upper,
                      0,
                      resolvedCurrencyCode
                    )}`}
                  >
                    <DashboardChartTooltipRow
                      label="Trade count"
                      value={`${Number(item.count).toLocaleString()} trades`}
                    />
                    <DashboardChartTooltipRow
                      label="Normal fit"
                      value={Number(item.normal).toFixed(2)}
                      tone="accent"
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <ReferenceLine
              x={formatSignedCurrency(chartData.mean, 0, resolvedCurrencyCode)}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="5 5"
            />
            <Bar
              dataKey="count"
              fill="rgba(129,140,248,0.55)"
              stroke="rgba(129,140,248,0.9)"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="normal"
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.75}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  );
}
