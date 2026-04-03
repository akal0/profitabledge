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
import { useChartTrades } from "./use-chart-trades";

interface RMultipleDistributionProps {
  accountId?: string;
  currencyCode?: string | null;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
}

const chartConfig = {
  count: {
    label: "Trade count",
    color: "#6383ff",
  },
  compare: {
    label: "Comparison",
    color: "#FCA070",
  },
} satisfies ChartConfig;

type DistributionRow = {
  label: string;
  rMultiple: number;
  count: number;
  compareCount?: number;
};

function buildDistributionRows(
  primaryValues: number[],
  comparisonValues: number[]
): DistributionRow[] {
  const allValues = [...primaryValues, ...comparisonValues];
  if (allValues.length === 0) return [];

  const minR = Math.floor(Math.min(...allValues));
  const maxR = Math.ceil(Math.max(...allValues));
  const binSize = 0.5;
  const primaryBins: Record<string, number> = {};
  const comparisonBins: Record<string, number> = {};

  for (let value = minR; value <= maxR; value += binSize) {
    const label = value.toFixed(1);
    primaryBins[label] = 0;
    comparisonBins[label] = 0;
  }

  primaryValues.forEach((value) => {
    const label = (Math.floor(value / binSize) * binSize).toFixed(1);
    if (primaryBins[label] !== undefined) primaryBins[label] += 1;
  });

  comparisonValues.forEach((value) => {
    const label = (Math.floor(value / binSize) * binSize).toFixed(1);
    if (comparisonBins[label] !== undefined) comparisonBins[label] += 1;
  });

  return Object.keys(primaryBins).map((label) => ({
    label,
    rMultiple: Number(label),
    count: primaryBins[label] ?? 0,
    compareCount: comparisonBins[label] ?? 0,
  }));
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

export function RMultipleDistributionChart({
  accountId,
  currencyCode: _currencyCode,
  ownerId = "r-multiple-distribution",
  comparisonMode,
}: RMultipleDistributionProps) {
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
    "count" | "compareCount" | undefined
  >(undefined);

  const rMultiples = useMemo(
    () =>
      trades
        .map((trade) => Number(trade.realisedRR))
        .filter((value) => Number.isFinite(value)),
    [trades]
  );
  const comparisonRMultiples = useMemo(
    () =>
      comparisonTrades
        .map((trade) => Number(trade.realisedRR))
        .filter((value) => Number.isFinite(value)),
    [comparisonTrades]
  );

  const chartData = buildDistributionRows(rMultiples, comparisonRMultiples);

  if (isLoading || comparisonLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    );
  }

  if (rMultiples.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">No realized R data available</p>
      </div>
    );
  }

  const avgR =
    rMultiples.reduce((sum, value) => sum + value, 0) / rMultiples.length;
  const comparisonAvgR = comparisonRMultiples.length
    ? comparisonRMultiples.reduce((sum, value) => sum + value, 0) /
      comparisonRMultiples.length
    : null;
  const dominantBin = chartData.reduce(
    (best, item) => (item.count > best.count ? item : best),
    chartData[0]
  );
  const daysSelected = resolvedRange ? countRangeDays(resolvedRange) : null;
  const primaryLabel = resolvedRange
    ? formatRangeLabel(resolvedRange)
    : "Selected range";
  const comparisonLabel = getComparisonLabel(
    myMode,
    daysSelected,
    comparisonRMultiples.length > 0
  );
  const comparisonLabelWithRange =
    comparisonLabel && comparisonRange
      ? `${comparisonLabel} (${formatRangeLabel(comparisonRange)})`
      : comparisonLabel;

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm font-normal tracking-wide text-white/40">
        <span>
          Average realised return is{" "}
          <span
            className={
              avgR >= 0
                ? "font-medium tracking-normal text-teal-400"
                : "font-medium tracking-normal text-rose-400"
            }
          >
            {avgR.toFixed(2)}R
          </span>
          {comparisonAvgR != null ? (
            <>
              {" "}vs{" "}
              <span className="font-medium tracking-normal text-[#FCA070]">
                {comparisonAvgR.toFixed(2)}R
              </span>
              .
            </>
          ) : (
            "."
          )}
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
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
          >
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
                const item = payload[0].payload as DistributionRow;
                return (
                  <DashboardChartTooltipFrame title={`${item.label}R bucket`}>
                    {payload.map((entry) => {
                      const key = entry.dataKey as "count" | "compareCount";
                      const isRowActive = activeDataset
                        ? key === activeDataset
                        : true;
                      return (
                        <DashboardChartTooltipRow
                          key={key}
                          label={
                            key === "count"
                              ? primaryLabel
                              : (comparisonLabelWithRange ?? "Comparison")
                          }
                          value={`${Number(entry.value ?? 0).toLocaleString()} trades`}
                          tone={key === "compareCount" ? "accent" : "default"}
                          dimmed={!isRowActive}
                          indicatorColor={
                            key === "compareCount" ? "#FCA070" : "#6383ff"
                          }
                        />
                      );
                    })}
                    <DashboardChartTooltipRow
                      label="Average realised R"
                      value={`${avgR.toFixed(2)}R`}
                      tone={avgR >= 0 ? "positive" : "negative"}
                      dimmed={activeDataset === "compareCount"}
                    />
                    {comparisonAvgR != null ? (
                      <DashboardChartTooltipRow
                        label="Comparison avg R"
                        value={`${comparisonAvgR.toFixed(2)}R`}
                        tone="accent"
                        dimmed={activeDataset === "count"}
                      />
                    ) : null}
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
            <Bar
              dataKey="count"
              radius={[0, 0, 0, 0]}
              barSize={comparisonRMultiples.length > 0 ? 18 : 28}
              name={primaryLabel}
            >
              {chartData.map((item, index) => {
                const isActive =
                  index === activeIndex &&
                  (!activeDataset || activeDataset === "count");
                const baseFill =
                  item.rMultiple >= 0 ? "var(--color-count)" : "#F76290";
                const activeFill = item.rMultiple >= 0 ? "#2dd4bf" : "#fb7185";
                return (
                  <Cell
                    key={item.label}
                    className="duration-200"
                    opacity={activeIndex == null || isActive ? 1 : 0.25}
                    fill={isActive ? activeFill : baseFill}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                      setActiveDataset("count");
                    }}
                    onMouseLeave={() => {
                      setActiveIndex(undefined);
                      setActiveDataset(undefined);
                    }}
                  />
                );
              })}
            </Bar>
            {comparisonRMultiples.length > 0 ? (
              <Bar
                dataKey="compareCount"
                radius={[0, 0, 0, 0]}
                barSize={18}
                name={comparisonLabelWithRange ?? "Comparison"}
              >
                {chartData.map((item, index) => {
                  const isActive =
                    index === activeIndex && activeDataset === "compareCount";
                  return (
                    <Cell
                      key={`cmp-${item.label}`}
                      className="duration-200"
                      opacity={activeIndex == null || isActive ? 1 : 0.25}
                      fill={isActive ? "#f59e0b" : "#FCA070"}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("compareCount");
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
