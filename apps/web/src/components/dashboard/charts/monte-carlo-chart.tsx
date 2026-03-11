"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/stores/account";
import {
  CartesianGrid,
  Line,
  LineChart,
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

interface SimPath {
  id: number;
  data: number[];
}

const chartConfig = {
  p95: {
    label: "95th percentile",
    color: "rgba(52,211,153,0.2)",
  },
  p75: {
    label: "75th percentile",
    color: "rgba(52,211,153,0.35)",
  },
  p50: {
    label: "Median path",
    color: "#34d399",
  },
  p25: {
    label: "25th percentile",
    color: "rgba(239,68,68,0.35)",
  },
  p5: {
    label: "5th percentile",
    color: "rgba(239,68,68,0.2)",
  },
} satisfies ChartConfig;

function runMonteCarloSimulation(
  tradeReturns: number[],
  numSimulations: number,
  numTrades: number
): SimPath[] {
  const paths: SimPath[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const data: number[] = [0];
    let equity = 0;

    for (let i = 0; i < numTrades; i++) {
      const index = Math.floor(Math.random() * tradeReturns.length);
      equity += tradeReturns[index];
      data.push(equity);
    }

    paths.push({ id: sim, data });
  }

  return paths;
}

export function MonteCarloChart({
  accountId,
  simCount = 100,
}: {
  accountId?: string;
  simCount?: number;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);

  const { paths, percentiles, tradeCount } = useMemo(() => {
    if (trades.length < 10) {
      return { paths: [] as SimPath[], percentiles: null, tradeCount: 0 };
    }

    const returns = trades.map((trade) =>
      parseFloat(trade.netPnl?.toString() || trade.profit?.toString() || "0")
    );
    const validReturns = returns.filter((value) => !Number.isNaN(value));
    if (validReturns.length < 5) {
      return { paths: [] as SimPath[], percentiles: null, tradeCount: 0 };
    }

    const numTrades = Math.min(validReturns.length, 200);
    const simPaths = runMonteCarloSimulation(validReturns, simCount, numTrades);

    const p5: number[] = [];
    const p25: number[] = [];
    const p50: number[] = [];
    const p75: number[] = [];
    const p95: number[] = [];

    for (let step = 0; step <= numTrades; step++) {
      const values = simPaths.map((path) => path.data[step]).sort((a, b) => a - b);
      p5.push(values[Math.floor(values.length * 0.05)]);
      p25.push(values[Math.floor(values.length * 0.25)]);
      p50.push(values[Math.floor(values.length * 0.5)]);
      p75.push(values[Math.floor(values.length * 0.75)]);
      p95.push(values[Math.floor(values.length * 0.95)]);
    }

    return {
      paths: simPaths,
      percentiles: { p5, p25, p50, p75, p95 },
      tradeCount: numTrades,
    };
  }, [simCount, trades]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!percentiles || trades.length < 10) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Need at least 10 trades for Monte Carlo simulation
      </div>
    );
  }

  const chartData = percentiles.p50.map((_, index) => ({
    trade: index,
    p5: percentiles.p5[index],
    p25: percentiles.p25[index],
    p50: percentiles.p50[index],
    p75: percentiles.p75[index],
    p95: percentiles.p95[index],
  }));

  const finalP50 = percentiles.p50[percentiles.p50.length - 1];
  const finalP5 = percentiles.p5[percentiles.p5.length - 1];
  const finalP95 = percentiles.p95[percentiles.p95.length - 1];
  const winProbability =
    (paths.filter((path) => path.data[path.data.length - 1] > 0).length /
      paths.length) *
    100;

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm font-normal tracking-wide text-white/40">
        <span>
          Median outcome after {tradeCount} simulated trades is{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              finalP50 >= 0 ? "text-teal-400" : "text-rose-400"
            )}
          >
            {formatSignedCurrency(finalP50, 0)}
          </span>
          .
        </span>
        <span>
          Win probability{" "}
          <span className="font-medium tracking-normal text-white/80">
            {winProbability.toFixed(0)}%
          </span>
          .
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart data={chartData} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="trade"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
              tickFormatter={(value) => formatSignedCurrency(value, 0)}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const step = payload[0].payload.trade;
                return (
                  <DashboardChartTooltipFrame title={`Trade ${step}`}>
                    <DashboardChartTooltipRow
                      label="95th percentile"
                      value={formatSignedCurrency(Number(payload[0].payload.p95), 0)}
                      tone="positive"
                    />
                    <DashboardChartTooltipRow
                      label="75th percentile"
                      value={formatSignedCurrency(Number(payload[0].payload.p75), 0)}
                      tone="positive"
                    />
                    <DashboardChartTooltipRow
                      label="Median path"
                      value={formatSignedCurrency(Number(payload[0].payload.p50), 0)}
                      tone={
                        Number(payload[0].payload.p50) >= 0
                          ? "positive"
                          : "negative"
                      }
                    />
                    <DashboardChartTooltipRow
                      label="25th percentile"
                      value={formatSignedCurrency(Number(payload[0].payload.p25), 0)}
                      tone="negative"
                    />
                    <DashboardChartTooltipRow
                      label="5th percentile"
                      value={formatSignedCurrency(Number(payload[0].payload.p5), 0)}
                      tone="negative"
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="p95"
              stroke="rgba(52,211,153,0.2)"
              dot={false}
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="p75"
              stroke="rgba(52,211,153,0.35)"
              dot={false}
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#34d399"
              dot={false}
              strokeWidth={2}
              activeDot={{ r: 4, fill: "#34d399" }}
            />
            <Line
              type="monotone"
              dataKey="p25"
              stroke="rgba(239,68,68,0.35)"
              dot={false}
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="p5"
              stroke="rgba(239,68,68,0.2)"
              dot={false}
              strokeWidth={1}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
