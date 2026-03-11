"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

interface EntryExitTimeProps {
  accountId?: string;
}

const chartConfig = {
  entries: {
    label: "Entries",
    color: "#6383ff",
  },
  exits: {
    label: "Exits",
    color: "#FCA070",
  },
} satisfies ChartConfig;

export function EntryExitTimeChart({ accountId }: EntryExitTimeProps) {
  const { trades, isLoading } = useChartTrades(accountId);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [activeDataset, setActiveDataset] = useState<
    "entries" | "exits" | undefined
  >(undefined);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    );
  }

  const entryHours: Record<number, number> = {};
  const exitHours: Record<number, number> = {};

  for (let hour = 0; hour < 24; hour++) {
    entryHours[hour] = 0;
    exitHours[hour] = 0;
  }

  trades.forEach((trade) => {
    if (trade.open) {
      const entryHour = new Date(trade.open).getUTCHours();
      entryHours[entryHour] += 1;
    }
    if (trade.close) {
      const exitHour = new Date(trade.close).getUTCHours();
      exitHours[exitHour] += 1;
    }
  });

  const chartData = Object.keys(entryHours).map((hour) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    entries: entryHours[parseInt(hour, 10)],
    exits: exitHours[parseInt(hour, 10)],
  }));

  if (chartData.every((item) => item.entries === 0 && item.exits === 0)) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">No entry/exit time data available</p>
      </div>
    );
  }

  const peakEntry = chartData.reduce(
    (best, item) => (item.entries > best.entries ? item : best),
    chartData[0]
  );
  const peakExit = chartData.reduce(
    (best, item) => (item.exits > best.exits ? item : best),
    chartData[0]
  );

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm font-normal tracking-wide text-white/40">
        <span>
          Entries cluster most around{" "}
          <span className="font-medium tracking-normal text-white/80">
            {peakEntry.hour}
          </span>
          .
        </span>
        <span>
          Exits cluster most around{" "}
          <span className="font-medium tracking-normal text-white/80">
            {peakExit.hour}
          </span>
          .
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="hour"
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
                const row = payload[0].payload;
                return (
                  <DashboardChartTooltipFrame title={row.hour}>
                    {payload.map((item) => {
                      const key = item.dataKey as "entries" | "exits";
                      const isRowActive = activeDataset ? key === activeDataset : true;
                      return (
                        <DashboardChartTooltipRow
                          key={key}
                          label={key === "entries" ? "Entries" : "Exits"}
                          value={`${Number(item.value ?? 0).toLocaleString()} trades`}
                          tone={key === "entries" ? "default" : "accent"}
                          dimmed={!isRowActive}
                        />
                      );
                    })}
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Bar dataKey="entries" radius={[0, 0, 0, 0]} barSize={18}>
              {chartData.map((item, index) => {
                const isActive =
                  index === activeIndex &&
                  (!activeDataset || activeDataset === "entries");
                return (
                  <Cell
                    key={`entries-${item.hour}`}
                    className="duration-200"
                    opacity={activeIndex == null || isActive ? 1 : 0.25}
                    fill={isActive ? "#2dd4bf" : "var(--color-entries)"}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                      setActiveDataset("entries");
                    }}
                    onMouseLeave={() => {
                      setActiveIndex(undefined);
                      setActiveDataset(undefined);
                    }}
                  />
                );
              })}
            </Bar>
            <Bar dataKey="exits" radius={[0, 0, 0, 0]} barSize={18}>
              {chartData.map((item, index) => {
                const isActive =
                  index === activeIndex &&
                  (!activeDataset || activeDataset === "exits");
                return (
                  <Cell
                    key={`exits-${item.hour}`}
                    className="duration-200"
                    opacity={activeIndex == null || isActive ? 1 : 0.25}
                    fill={isActive ? "#fb7185" : "var(--color-exits)"}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                      setActiveDataset("exits");
                    }}
                    onMouseLeave={() => {
                      setActiveIndex(undefined);
                      setActiveDataset(undefined);
                    }}
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
