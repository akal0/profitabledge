"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

interface RMultipleDistributionProps {
  accountId?: string;
}

const chartConfig = {
  count: {
    label: "Trade count",
    color: "#6383ff",
  },
} satisfies ChartConfig;

export function RMultipleDistributionChart({
  accountId,
}: RMultipleDistributionProps) {
  const { trades, isLoading } = useChartTrades(accountId);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    );
  }

  const rMultiples = trades
    .map((trade) => Number(trade.realisedRR))
    .filter((value) => Number.isFinite(value));

  if (rMultiples.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">No realized R data available</p>
      </div>
    );
  }

  const minR = Math.floor(Math.min(...rMultiples));
  const maxR = Math.ceil(Math.max(...rMultiples));
  const binSize = 0.5;
  const bins: Record<string, number> = {};

  for (let value = minR; value <= maxR; value += binSize) {
    bins[value.toFixed(1)] = 0;
  }

  rMultiples.forEach((value) => {
    const binIndex = Math.floor(value / binSize) * binSize;
    const label = binIndex.toFixed(1);
    if (bins[label] !== undefined) {
      bins[label] += 1;
    }
  });

  const chartData = Object.entries(bins).map(([label, count]) => ({
    label,
    rMultiple: parseFloat(label),
    count,
  }));

  const avgR =
    rMultiples.reduce((sum, value) => sum + value, 0) / rMultiples.length;
  const dominantBin = chartData.reduce(
    (best, item) => (item.count > best.count ? item : best),
    chartData[0]
  );

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm font-normal tracking-wide text-white/40">
        <span>
          Average realised return is{" "}
          <span
            className={
              avgR >= 0 ? "font-medium tracking-normal text-teal-400" : "font-medium tracking-normal text-rose-400"
            }
          >
            {avgR.toFixed(2)}R
          </span>
          .
        </span>
        <span>
          Most common bucket{" "}
          <span className="font-medium tracking-normal text-white/80">
            {dominantBin.label}R
          </span>
          .
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
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
                  <DashboardChartTooltipFrame title={`${item.label}R bucket`}>
                    <DashboardChartTooltipRow
                      label="Trade count"
                      value={`${Number(item.count).toLocaleString()} trades`}
                    />
                    <DashboardChartTooltipRow
                      label="Average realised R"
                      value={`${avgR.toFixed(2)}R`}
                      tone={avgR >= 0 ? "positive" : "negative"}
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <ReferenceLine
              x="0.0"
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="5 5"
            />
            <ReferenceLine
              x={avgR.toFixed(1)}
              stroke="#FCA070"
              strokeDasharray="5 5"
            />
            <Bar dataKey="count" radius={[0, 0, 0, 0]} barSize={28}>
              {chartData.map((item, index) => {
                const isActive = index === activeIndex;
                const baseFill =
                  item.rMultiple >= 0 ? "var(--color-count)" : "#F76290";
                const activeFill =
                  item.rMultiple >= 0 ? "#2dd4bf" : "#fb7185";
                return (
                  <Cell
                    key={item.label}
                    className="duration-200"
                    opacity={activeIndex == null || isActive ? 1 : 0.25}
                    fill={isActive ? activeFill : baseFill}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
