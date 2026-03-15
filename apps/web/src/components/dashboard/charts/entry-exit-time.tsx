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
  countRangeDays,
  formatRangeLabel,
  getComparisonRange,
} from "@/components/dashboard/chart-comparison-utils";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  useComparisonStore,
  type WidgetComparisonMode,
} from "@/stores/comparison";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "./dashboard-chart-ui";
import { useChartDateRange } from "./use-chart-date-range";
import { type ChartTrade, useChartTrades } from "./use-chart-trades";

interface EntryExitTimeProps {
  accountId?: string;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const chartConfig = {
  entries: {
    label: "Selected entries",
    color: "#6383ff",
  },
  exits: {
    label: "Selected exits",
    color: "#FCA070",
  },
  compareEntries: {
    label: "Comparison entries",
    color: "rgba(99, 131, 255, 0.4)",
  },
  compareExits: {
    label: "Comparison exits",
    color: "rgba(252, 160, 112, 0.4)",
  },
} satisfies ChartConfig;

type HourBucket = {
  entries: number;
  exits: number;
};

function buildHourDistribution(trades: ChartTrade[]) {
  const buckets: HourBucket[] = HOURS.map(() => ({
    entries: 0,
    exits: 0,
  }));

  trades.forEach((trade) => {
    const entryTime = trade.openTime ?? trade.open;
    const exitTime = trade.closeTime ?? trade.close;

    if (entryTime) {
      buckets[new Date(entryTime).getUTCHours()].entries += 1;
    }
    if (exitTime) {
      buckets[new Date(exitTime).getUTCHours()].exits += 1;
    }
  });

  return buckets;
}

function getComparisonLabel(
  mode: WidgetComparisonMode,
  daysSelected: number | null,
  enabled: boolean
) {
  if (!enabled) return undefined;
  if (mode === "thisWeek") return "This week";
  if (mode === "lastWeek") return "Last week";
  if (!daysSelected) return "Previous range";
  if (daysSelected === 1) return "Previous day";
  return `Previous ${daysSelected} days`;
}

export function EntryExitTimeChart({
  accountId,
  ownerId = "entry-exit-time",
  comparisonMode,
}: EntryExitTimeProps) {
  const { start, end, min, max } = useChartDateRange();
  const comparisons = useComparisonStore((state) => state.comparisons);
  const myMode = comparisonMode ?? comparisons[ownerId] ?? "none";

  const resolvedRange = useMemo(() => {
    const minDate = min ? new Date(min) : undefined;
    const maxDate = max ? new Date(max) : undefined;
    minDate?.setHours(0, 0, 0, 0);
    maxDate?.setHours(23, 59, 59, 999);

    if (start && end) {
      return { start: new Date(start), end: new Date(end) };
    }

    const fallbackEnd = maxDate ?? new Date();
    const endDate = new Date(fallbackEnd);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 29);
    if (minDate && startDate < minDate) {
      return { start: minDate, end: endDate };
    }
    return { start: startDate, end: endDate };
  }, [end, max, min, start]);

  const rangeOverride = useMemo(
    () =>
      resolvedRange
        ? {
            startISO: resolvedRange.start.toISOString(),
            endISO: resolvedRange.end.toISOString(),
          }
        : undefined,
    [resolvedRange]
  );

  const comparisonRange = useMemo(() => {
    if (!resolvedRange) return null;
    return getComparisonRange(myMode, resolvedRange, {
      minDate: min,
      maxDate: max,
    });
  }, [max, min, myMode, resolvedRange]);

  const comparisonRangeOverride = useMemo(
    () =>
      comparisonRange
        ? {
            startISO: comparisonRange.start.toISOString(),
            endISO: comparisonRange.end.toISOString(),
          }
        : undefined,
    [comparisonRange]
  );

  const { trades, isLoading } = useChartTrades(accountId, rangeOverride);
  const {
    trades: comparisonTrades,
    isLoading: comparisonLoading,
  } = useChartTrades(accountId, comparisonRangeOverride, {
    enabled: Boolean(comparisonRange),
  });

  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [activeDataset, setActiveDataset] = useState<
    "entries" | "exits" | "compareEntries" | "compareExits" | undefined
  >(undefined);

  const primaryDistribution = useMemo(
    () => buildHourDistribution(trades),
    [trades]
  );
  const comparisonDistribution = useMemo(
    () => buildHourDistribution(comparisonTrades),
    [comparisonTrades]
  );

  const chartData = useMemo(
    () =>
      HOURS.map((hour) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        entries: primaryDistribution[hour]?.entries ?? 0,
        exits: primaryDistribution[hour]?.exits ?? 0,
        compareEntries: comparisonDistribution[hour]?.entries ?? 0,
        compareExits: comparisonDistribution[hour]?.exits ?? 0,
      })),
    [comparisonDistribution, primaryDistribution]
  );

  if (isLoading || comparisonLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    );
  }

  const hasPrimaryData = chartData.some(
    (item) => item.entries > 0 || item.exits > 0
  );
  if (!hasPrimaryData) {
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
  const peakComparisonEntry = chartData.reduce(
    (best, item) =>
      item.compareEntries > best.compareEntries ? item : best,
    chartData[0]
  );
  const peakComparisonExit = chartData.reduce(
    (best, item) => (item.compareExits > best.compareExits ? item : best),
    chartData[0]
  );

  const daysSelected = resolvedRange ? countRangeDays(resolvedRange) : null;
  const primaryRangeLabel = resolvedRange
    ? formatRangeLabel(resolvedRange)
    : "Selected range";
  const comparisonLabel = getComparisonLabel(
    myMode,
    daysSelected,
    Boolean(comparisonRange) && comparisonTrades.length > 0
  );
  const comparisonRangeLabel = comparisonRange
    ? formatRangeLabel(comparisonRange)
    : undefined;
  const primaryEntriesLabel = `Entries (${primaryRangeLabel})`;
  const primaryExitsLabel = `Exits (${primaryRangeLabel})`;
  const comparisonEntriesLabel =
    comparisonLabel && comparisonRangeLabel
      ? `${comparisonLabel} entries (${comparisonRangeLabel})`
      : "Comparison entries";
  const comparisonExitsLabel =
    comparisonLabel && comparisonRangeLabel
      ? `${comparisonLabel} exits (${comparisonRangeLabel})`
      : "Comparison exits";
  const hasComparisonData = chartData.some(
    (item) => item.compareEntries > 0 || item.compareExits > 0
  );
  const barSize = hasComparisonData ? 7 : 18;

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm font-normal tracking-wide text-white/40">
        <span>
          Entries cluster most around{" "}
          <span className="font-medium tracking-normal text-white/80">
            {peakEntry.hour}
          </span>
          {hasComparisonData ? (
            <>
              {" "}vs{" "}
              <span className="font-medium tracking-normal text-[#6383ff]">
                {peakComparisonEntry.hour}
              </span>{" "}
              in {comparisonLabel ?? "comparison"}.
            </>
          ) : (
            "."
          )}
        </span>
        <span>
          Exits cluster most around{" "}
          <span className="font-medium tracking-normal text-white/80">
            {peakExit.hour}
          </span>
          {hasComparisonData ? (
            <>
              {" "}vs{" "}
              <span className="font-medium tracking-normal text-[#FCA070]">
                {peakComparisonExit.hour}
              </span>{" "}
              in {comparisonLabel ?? "comparison"}.
            </>
          ) : (
            "."
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval={2}
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
                const row = payload[0].payload as {
                  hour: string;
                };
                return (
                  <DashboardChartTooltipFrame title={row.hour}>
                    {payload.map((item) => {
                      const key = item.dataKey as
                        | "entries"
                        | "exits"
                        | "compareEntries"
                        | "compareExits";
                      const isRowActive = activeDataset
                        ? key === activeDataset
                        : true;
                      const label =
                        key === "entries"
                          ? primaryEntriesLabel
                          : key === "exits"
                            ? primaryExitsLabel
                            : key === "compareEntries"
                              ? comparisonEntriesLabel
                              : comparisonExitsLabel;
                      const tone =
                        key === "entries" || key === "compareEntries"
                          ? "default"
                          : "accent";
                      return (
                        <DashboardChartTooltipRow
                          key={key}
                          label={label}
                          value={`${Number(item.value ?? 0).toLocaleString()} trades`}
                          tone={tone}
                          dimmed={!isRowActive}
                          indicatorColor={
                            key === "entries"
                              ? "#6383ff"
                              : key === "exits"
                                ? "#FCA070"
                                : key === "compareEntries"
                                  ? "rgba(99, 131, 255, 0.4)"
                                  : "rgba(252, 160, 112, 0.4)"
                          }
                        />
                      );
                    })}
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Bar dataKey="entries" radius={[0, 0, 0, 0]} barSize={barSize}>
              {chartData.map((item, index) => {
                const isActive =
                  index === activeIndex &&
                  (!activeDataset || activeDataset === "entries");
                return (
                  <Cell
                    key={`entries-${item.hour}`}
                    className="duration-200"
                    opacity={activeIndex == null || isActive ? 1 : 0.25}
                    fill={isActive ? "#8fa2ff" : "var(--color-entries)"}
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
            <Bar dataKey="exits" radius={[0, 0, 0, 0]} barSize={barSize}>
              {chartData.map((item, index) => {
                const isActive =
                  index === activeIndex &&
                  (!activeDataset || activeDataset === "exits");
                return (
                  <Cell
                    key={`exits-${item.hour}`}
                    className="duration-200"
                    opacity={activeIndex == null || isActive ? 1 : 0.25}
                    fill={isActive ? "#ffd1b8" : "var(--color-exits)"}
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
            {hasComparisonData ? (
              <Bar
                dataKey="compareEntries"
                radius={[0, 0, 0, 0]}
                barSize={barSize}
              >
                {chartData.map((item, index) => {
                  const isActive =
                    index === activeIndex && activeDataset === "compareEntries";
                  return (
                    <Cell
                      key={`compare-entries-${item.hour}`}
                      className="duration-200"
                      opacity={activeIndex == null || isActive ? 1 : 0.25}
                      fill={
                        isActive
                          ? "rgba(99, 131, 255, 0.8)"
                          : "rgba(99, 131, 255, 0.38)"
                      }
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("compareEntries");
                      }}
                      onMouseLeave={() => {
                        setActiveIndex(undefined);
                        setActiveDataset(undefined);
                      }}
                    />
                  );
                })}
              </Bar>
            ) : null}
            {hasComparisonData ? (
              <Bar
                dataKey="compareExits"
                radius={[0, 0, 0, 0]}
                barSize={barSize}
              >
                {chartData.map((item, index) => {
                  const isActive =
                    index === activeIndex && activeDataset === "compareExits";
                  return (
                    <Cell
                      key={`compare-exits-${item.hour}`}
                      className="duration-200"
                      opacity={activeIndex == null || isActive ? 1 : 0.25}
                      fill={
                        isActive
                          ? "rgba(252, 160, 112, 0.8)"
                          : "rgba(252, 160, 112, 0.38)"
                      }
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("compareExits");
                      }}
                      onMouseLeave={() => {
                        setActiveIndex(undefined);
                        setActiveDataset(undefined);
                      }}
                    />
                  );
                })}
              </Bar>
            ) : null}
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
