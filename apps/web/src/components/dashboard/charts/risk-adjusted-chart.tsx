"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/stores/account";
import {
  CartesianGrid,
  Line,
  LineChart,
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
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

export type RiskMetricKey =
  | "sharpe"
  | "sortino"
  | "calmar"
  | "riskAdjustedEquity";

const metricConfig: Record<
  RiskMetricKey,
  { label: string; color: string; ref: number }
> = {
  sharpe: { label: "Sharpe ratio", color: "#818cf8", ref: 1 },
  sortino: { label: "Sortino ratio", color: "#34d399", ref: 1 },
  calmar: { label: "Calmar ratio", color: "#fbbf24", ref: 1 },
  riskAdjustedEquity: { label: "Risk-adj equity", color: "#38bdf8", ref: 0 },
};

const chartConfig = {
  value: {
    label: "Risk adjusted value",
    color: "#818cf8",
  },
} satisfies ChartConfig;

function formatMetricValue(metric: RiskMetricKey, value: number) {
  if (metric === "riskAdjustedEquity") {
    return formatSignedCurrency(value, 2);
  }
  return value.toFixed(3);
}

export function RiskAdjustedChart({
  accountId,
  metric = "sharpe",
  window = 20,
}: {
  accountId?: string;
  metric?: RiskMetricKey;
  window?: 10 | 20 | 50;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);

  const chartData = useMemo(() => {
    if (trades.length < window) return [];

    const sorted = [...trades].sort(
      (a, b) =>
        new Date(a.openTime || a.open || 0).getTime() -
        new Date(b.openTime || b.open || 0).getTime()
    );

    const returns = sorted.map((trade) =>
      parseFloat(trade.profit?.toString() || "0")
    );
    const dataPoints: { trade: number; value: number; date: string }[] = [];

    for (let i = window; i <= returns.length; i++) {
      const windowReturns = returns.slice(i - window, i);
      const mean =
        windowReturns.reduce((sum, value) => sum + value, 0) /
        windowReturns.length;
      const variance =
        windowReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        windowReturns.length;
      const stdDev = Math.sqrt(variance);
      const downsideReturns = windowReturns.filter((value) => value < 0);
      const downsideVariance =
        downsideReturns.length > 0
          ? downsideReturns.reduce((sum, value) => sum + value ** 2, 0) /
            downsideReturns.length
          : 0.0001;
      const downsideStdDev = Math.sqrt(downsideVariance);

      let equity = 10_000;
      let peak = 10_000;
      let maxDD = 0;
      for (const value of windowReturns) {
        equity += value;
        peak = Math.max(peak, equity);
        maxDD = Math.max(maxDD, peak - equity);
      }
      const totalReturn = windowReturns.reduce((sum, value) => sum + value, 0);

      let value = 0;
      switch (metric) {
        case "sharpe":
          value = stdDev > 0 ? mean / stdDev : 0;
          break;
        case "sortino":
          value = downsideStdDev > 0 ? mean / downsideStdDev : 0;
          break;
        case "calmar":
          value = maxDD > 0 ? totalReturn / maxDD : totalReturn > 0 ? 5 : 0;
          break;
        case "riskAdjustedEquity":
          value = stdDev > 0 ? totalReturn / stdDev : totalReturn;
          break;
      }

      const lastTrade = sorted[i - 1];
      dataPoints.push({
        trade: i,
        value: parseFloat(value.toFixed(3)),
        date: new Date(
          lastTrade.openTime || lastTrade.open || 0
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }

    return dataPoints;
  }, [metric, trades, window]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (trades.length < 20) {
    return (
      <div className="flex w-full h-full items-center justify-center text-sm text-white/30">
        Need at least 20 trades for risk-adjusted analysis
      </div>
    );
  }

  const config = metricConfig[metric];
  const currentValue = chartData[chartData.length - 1]?.value ?? 0;
  const tone =
    metric === "riskAdjustedEquity"
      ? currentValue >= 0
        ? "positive"
        : "negative"
      : currentValue >= config.ref
      ? "positive"
      : "negative";

  chartConfig.value.color = config.color;

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex items-center">
        <p className="text-sm font-normal tracking-wide text-white/40">
          Current {config.label.toLowerCase()} over the last {window} trades is{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              tone === "positive" ? "text-teal-400" : "text-rose-400"
            )}
          >
            {formatMetricValue(metric, currentValue)}
          </span>
          .
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="date"
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
              width={metric === "riskAdjustedEquity" ? 64 : 42}
              tickFormatter={(value) => {
                if (metric === "riskAdjustedEquity") {
                  return formatSignedCurrency(value, 0);
                }
                return value.toFixed(1);
              }}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                const value = Number(item.value ?? 0);
                return (
                  <DashboardChartTooltipFrame title={item.payload.date}>
                    <DashboardChartTooltipRow
                      label={config.label}
                      value={formatMetricValue(metric, value)}
                      tone={
                        metric === "riskAdjustedEquity"
                          ? value >= 0
                            ? "positive"
                            : "negative"
                          : value >= config.ref
                          ? "positive"
                          : "negative"
                      }
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <ReferenceLine
              y={config.ref}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              dot={false}
              strokeWidth={2}
              activeDot={{ r: 4, fill: config.color }}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
