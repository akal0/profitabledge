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
  useChartCurrencyCode,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

export type RollingMetricKey =
  | "winRate"
  | "profitFactor"
  | "avgRR"
  | "expectancy";

const metricConfig: Record<
  RollingMetricKey,
  { label: string; color: string; ref?: number; suffix: string }
> = {
  winRate: { label: "Win rate", color: "#34d399", ref: 50, suffix: "%" },
  profitFactor: {
    label: "Profit factor",
    color: "#818cf8",
    ref: 1,
    suffix: "",
  },
  avgRR: { label: "Avg RR", color: "#fbbf24", ref: 1, suffix: "R" },
  expectancy: { label: "Expectancy", color: "#38bdf8", ref: 0, suffix: "$" },
};

const chartConfig = {
  value: {
    label: "Rolling metric",
    color: "#34d399",
  },
} satisfies ChartConfig;

function formatMetricValue(
  metric: RollingMetricKey,
  value: number,
  currencyCode?: string | null
) {
  if (metric === "expectancy") {
    return formatSignedCurrency(value, 2, currencyCode);
  }
  if (metric === "avgRR") {
    return `${value.toFixed(2)}R`;
  }
  if (metric === "winRate") {
    return `${value.toFixed(2)}%`;
  }
  return value.toFixed(2);
}

export function RollingPerformanceChart({
  accountId,
  metric = "winRate",
  window = 20,
}: {
  accountId?: string;
  metric?: RollingMetricKey;
  window?: 10 | 20 | 50;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);
  const resolvedCurrencyCode = useChartCurrencyCode(accountId);

  const chartData = useMemo(() => {
    if (trades.length < window) return [];

    const sorted = [...trades].sort(
      (a, b) =>
        new Date(a.openTime || a.open || 0).getTime() -
        new Date(b.openTime || b.open || 0).getTime()
    );

    const dataPoints: { trade: number; value: number; date: string }[] = [];

    for (let i = window; i <= sorted.length; i++) {
      const windowTrades = sorted.slice(i - window, i);

      let value = 0;
      const pnls = windowTrades.map((trade) =>
        parseFloat(trade.netPnl?.toString() || trade.profit?.toString() || "0")
      );
      const rrs = windowTrades.map((trade) =>
        parseFloat(trade.realisedRR?.toString() || "0")
      );
      const wins = pnls.filter((pnl) => pnl > 0);
      const losses = pnls.filter((pnl) => pnl < 0);

      switch (metric) {
        case "winRate":
          value = (wins.length / windowTrades.length) * 100;
          break;
        case "profitFactor": {
          const grossWin = wins.reduce((sum, pnl) => sum + pnl, 0);
          const grossLoss = Math.abs(
            losses.reduce((sum, pnl) => sum + pnl, 0)
          );
          value = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 10 : 0;
          break;
        }
        case "avgRR":
          value = rrs.reduce((sum, rr) => sum + rr, 0) / rrs.length;
          break;
        case "expectancy":
          value = pnls.reduce((sum, pnl) => sum + pnl, 0) / windowTrades.length;
          break;
      }

      const lastTrade = windowTrades[windowTrades.length - 1];
      dataPoints.push({
        trade: i,
        value: parseFloat(value.toFixed(2)),
        date: new Date(lastTrade.openTime || lastTrade.open || 0).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
          }
        ),
      });
    }

    return dataPoints;
  }, [metric, trades, window]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (trades.length < 20) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Need at least 20 trades for rolling analysis
      </div>
    );
  }

  const config = metricConfig[metric];
  const values = chartData.map((point) => point.value);
  const currentValue = values[values.length - 1] ?? 0;
  const recentSlice = values.slice(-10);
  const olderSlice = values.slice(0, Math.min(10, values.length));
  const recentAvg =
    recentSlice.reduce((sum, value) => sum + value, 0) /
    Math.max(recentSlice.length, 1);
  const olderAvg =
    olderSlice.reduce((sum, value) => sum + value, 0) /
    Math.max(olderSlice.length, 1);
  const trend =
    recentAvg > olderAvg
      ? "improving"
      : recentAvg < olderAvg
      ? "declining"
      : "stable";

  chartConfig.value.color = config.color;

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex items-center">
        <p className="text-sm font-normal tracking-wide text-white/40">
          Current {config.label.toLowerCase()} over the last {window} trades is{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              metric === "expectancy"
                ? currentValue >= 0
                  ? "text-teal-400"
                  : "text-rose-400"
                : "text-white/80"
            )}
          >
            {formatMetricValue(metric, currentValue, resolvedCurrencyCode)}
          </span>
          .
        </p>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-1 text-[10px] font-medium",
            trend === "improving" && "bg-emerald-500/10 text-emerald-400",
            trend === "declining" && "bg-rose-500/10 text-rose-400",
            trend === "stable" && "bg-white/5 text-white/40"
          )}
        >
          {trend === "improving"
            ? "Improving"
            : trend === "declining"
            ? "Declining"
            : "Stable"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
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
              width={metric === "expectancy" ? 64 : 40}
              tickFormatter={(value) => {
                if (metric === "expectancy") {
                  return formatSignedCurrency(value, 0, resolvedCurrencyCode);
                }
                if (metric === "avgRR") return `${value.toFixed(1)}R`;
                if (metric === "winRate") return `${Math.round(value)}%`;
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
                      value={formatMetricValue(
                        metric,
                        value,
                        resolvedCurrencyCode
                      )}
                      tone={
                        metric === "expectancy"
                          ? value >= 0
                            ? "positive"
                            : "negative"
                          : "default"
                      }
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            {config.ref != null ? (
              <ReferenceLine
                y={config.ref}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="5 5"
              />
            ) : null}
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
