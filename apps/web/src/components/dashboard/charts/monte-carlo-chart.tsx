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
  useChartCurrencyCode,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

interface SimPath {
  id: number;
  data: number[];
}

type MonteCarloPercentiles = {
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
};

type SimulationConfidence = {
  label: string;
  toneClassName: string;
  helperText: string;
  showHeadlineRate: boolean;
};

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

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], mean: number) {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gaussianishSample() {
  let total = 0;
  for (let index = 0; index < 6; index += 1) {
    total += Math.random();
  }
  return total - 3;
}

function getSimulationConfidence(
  sampleSize: number,
  wins: number,
  losses: number
): SimulationConfidence {
  const minorityCount = Math.min(wins, losses);
  const majorityCount = Math.max(wins, losses, 1);
  const balanceRatio = minorityCount / majorityCount;

  if (sampleSize >= 120 && minorityCount >= 25 && balanceRatio >= 0.45) {
    return {
      label: "High confidence",
      toneClassName: "text-teal-300",
      helperText:
        "The selected range is broad and balanced enough to treat the simulation as directional rather than anecdotal.",
      showHeadlineRate: true,
    };
  }

  if (sampleSize >= 60 && minorityCount >= 12 && balanceRatio >= 0.3) {
    return {
      label: "Medium confidence",
      toneClassName: "text-amber-300",
      helperText:
        "The sample is usable for scenario shape, but still too narrow for a trustworthy headline rate.",
      showHeadlineRate: false,
    };
  }

  return {
    label: "Low confidence",
    toneClassName: "text-rose-300",
    helperText:
      "The selected range is too thin or one-sided to support a trustworthy headline rate.",
    showHeadlineRate: false,
  };
}

function getSimulationOutlook(rate: number) {
  if (rate >= 75) {
    return { label: "Strongly positive", toneClassName: "text-teal-300" };
  }
  if (rate >= 60) {
    return { label: "Positive", toneClassName: "text-teal-400" };
  }
  if (rate >= 45) {
    return { label: "Balanced", toneClassName: "text-white/80" };
  }
  if (rate >= 30) {
    return { label: "Negative", toneClassName: "text-rose-300" };
  }
  return { label: "Strongly negative", toneClassName: "text-rose-400" };
}

function runMonteCarloSimulation(
  tradeReturns: number[],
  numSimulations: number,
  numTrades: number
): SimPath[] {
  const meanReturn = average(tradeReturns);
  const stdDevRaw = standardDeviation(tradeReturns, meanReturn);
  const avgAbsReturn = average(tradeReturns.map((value) => Math.abs(value)));
  const avgLossMagnitude = average(
    tradeReturns.filter((value) => value < 0).map((value) => Math.abs(value))
  );
  const uncertaintyFloor = Math.max(
    stdDevRaw,
    avgAbsReturn * 0.35,
    avgLossMagnitude * 0.5
  );
  const conservativeMean = meanReturn * 0.85;
  const observedMin = Math.min(...tradeReturns);
  const observedMax = Math.max(...tradeReturns);
  const minReturn = observedMin - uncertaintyFloor * 0.75;
  const maxReturn = observedMax + uncertaintyFloor * 0.75;
  const paths: SimPath[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const data: number[] = [0];
    let equity = 0;

    for (let i = 0; i < numTrades; i++) {
      const index = Math.floor(Math.random() * tradeReturns.length);
      const empiricalReturn = tradeReturns[index];
      const gaussianReturn =
        conservativeMean + uncertaintyFloor * gaussianishSample();
      const blendedReturn = clamp(
        empiricalReturn * 0.7 + gaussianReturn * 0.3,
        minReturn,
        maxReturn
      );
      equity += blendedReturn;
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
  const resolvedCurrencyCode = useChartCurrencyCode(accountId);

  const {
    percentiles,
    tradeCount,
    profitableProbability,
    sampleSize,
    wins,
    losses,
    insufficientReason,
  } = useMemo(() => {
    const closedReturns = trades
      .filter((trade) => Boolean(trade.closeTime ?? trade.close))
      .map((trade) =>
        parseFloat(trade.netPnl?.toString() || trade.profit?.toString() || "0")
      )
      .filter((value) => !Number.isNaN(value));

    if (closedReturns.length < 10) {
      return {
        paths: [] as SimPath[],
        percentiles: null as MonteCarloPercentiles | null,
        tradeCount: 0,
        profitableProbability: null as number | null,
        sampleSize: closedReturns.length,
        wins: 0,
        losses: 0,
        insufficientReason: "Need at least 10 closed trades for Monte Carlo simulation",
      };
    }

    const wins = closedReturns.filter((value) => value > 0).length;
    const losses = closedReturns.filter((value) => value < 0).length;

    if (wins === 0 || losses === 0) {
      return {
        paths: [] as SimPath[],
        percentiles: null as MonteCarloPercentiles | null,
        tradeCount: 0,
        profitableProbability: null as number | null,
        sampleSize: closedReturns.length,
        wins,
        losses,
        insufficientReason:
          "Need both winning and losing closed trades in the selected range for a credible simulation",
      };
    }

    const numTrades = Math.min(closedReturns.length, 200);
    const simPaths = runMonteCarloSimulation(closedReturns, simCount, numTrades);

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

    const profitableCount = simPaths.filter(
      (path) => path.data[path.data.length - 1] > 0
    ).length;
    const profitableProbability =
      ((profitableCount + 1) / (simPaths.length + 2)) * 100;

    return {
      percentiles: { p5, p25, p50, p75, p95 },
      tradeCount: numTrades,
      profitableProbability,
      sampleSize: closedReturns.length,
      wins,
      losses,
      insufficientReason: null as string | null,
    };
  }, [simCount, trades]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!percentiles) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        {insufficientReason ?? "Not enough data for Monte Carlo simulation"}
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
  const confidence = getSimulationConfidence(sampleSize, wins, losses);
  const outlook = getSimulationOutlook(profitableProbability ?? 50);

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
            {formatSignedCurrency(finalP50, 0, resolvedCurrencyCode)}
          </span>
          .
        </span>
        <span>
          Simulated outlook{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              outlook.toneClassName
            )}
          >
            {outlook.label}
          </span>
          .
        </span>
        <span>
          Confidence{" "}
          <span
            className={cn(
              "font-medium tracking-normal",
              confidence.toneClassName
            )}
          >
            {confidence.label}
          </span>
          .
        </span>
        <span>
          Sample{" "}
          <span className="font-medium tracking-normal text-white/80">
            {sampleSize}
          </span>{" "}
          closed trades ({wins} wins / {losses} losses).
        </span>
        {confidence.showHeadlineRate ? (
          <span>
            Simulated positive-outcome rate{" "}
            <span className="font-medium tracking-normal text-white/80">
              {(profitableProbability ?? 0).toFixed(0)}%
            </span>
            .
          </span>
        ) : (
          <span>{confidence.helperText}</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-visible">
        <ChartContainer config={chartConfig} className="h-full w-full overflow-visible">
          <LineChart data={chartData} margin={{ top: 12, right: 0, left: 36, bottom: -4 }}>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="trade"
              tick={{ fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={20}
              tickFormatter={(value) =>
                formatSignedCurrency(value, 0, resolvedCurrencyCode)
              }
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
                      value={formatSignedCurrency(
                        Number(payload[0].payload.p95),
                        0,
                        resolvedCurrencyCode
                      )}
                      tone="positive"
                    />
                    <DashboardChartTooltipRow
                      label="75th percentile"
                      value={formatSignedCurrency(
                        Number(payload[0].payload.p75),
                        0,
                        resolvedCurrencyCode
                      )}
                      tone="positive"
                    />
                    <DashboardChartTooltipRow
                      label="Median path"
                      value={formatSignedCurrency(
                        Number(payload[0].payload.p50),
                        0,
                        resolvedCurrencyCode
                      )}
                      tone={
                        Number(payload[0].payload.p50) >= 0
                          ? "positive"
                          : "negative"
                      }
                    />
                    <DashboardChartTooltipRow
                      label="25th percentile"
                      value={formatSignedCurrency(
                        Number(payload[0].payload.p25),
                        0,
                        resolvedCurrencyCode
                      )}
                      tone="negative"
                    />
                    <DashboardChartTooltipRow
                      label="5th percentile"
                      value={formatSignedCurrency(
                        Number(payload[0].payload.p5),
                        0,
                        resolvedCurrencyCode
                      )}
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
