"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  countRangeDays,
  formatRangeLabel,
  getComparisonRange,
  normalizeDateRange,
} from "@/components/dashboard/chart-comparison-utils";
import {
  useComparisonStore,
  type WidgetComparisonMode,
} from "@/stores/comparison";
import { trpcOptions } from "@/utils/trpc";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
  formatSignedPercent,
  useChartCurrencyCode,
} from "./dashboard-chart-ui";
import {
  buildRelativeAxisTicks,
  clampRelativeMs,
  formatRelativeDate,
  formatRelativeTooltipDate,
  getRelativeAxisTickStepMs,
  getMergedRelativePositions,
  getRangeDurationMs,
  getRelativeSamplingStepMs,
  getSeriesValueAt,
  usesBucketedRelativeSampling,
} from "./range-alignment";
import { useChartRenderMode } from "./chart-render-mode";
import { type ChartTrade, useChartTrades } from "./use-chart-trades";
import { useChartDateRange } from "./use-chart-date-range";

const chartConfig = {
  equity: {
    label: "Equity",
    color: "#00E0C8",
  },
  compare: {
    label: "Comparison",
    color: "#FCA070",
  },
} satisfies ChartConfig;

type DataPoint = {
  equity: number;
  relativeMs: number;
};

function buildEquitySeries(
  trades: ChartTrade[],
  range: { start: Date; end: Date } | null,
  initialBalance: number
) {
  if (!range) return [] as DataPoint[];

  const durationMs = getRangeDurationMs(range);
  let runningEquity = initialBalance;
  const points: DataPoint[] = [
    {
      equity: runningEquity,
      relativeMs: 0,
    },
  ];

  const sortedTrades = [...trades]
    .filter(
      (trade) => trade.close && (trade.netPnl != null || trade.profit != null)
    )
    .sort(
      (a, b) =>
        new Date(a.close || 0).getTime() - new Date(b.close || 0).getTime()
    );

  sortedTrades.forEach((trade) => {
    runningEquity += Number(trade.netPnl ?? trade.profit ?? 0);
    points.push({
      equity: runningEquity,
      relativeMs: clampRelativeMs(new Date(trade.close || 0).getTime(), range),
    });
  });

  if (points[points.length - 1]?.relativeMs !== durationMs) {
    points.push({
      equity: runningEquity,
      relativeMs: durationMs,
    });
  }

  return points;
}

export function EquityCurveChart({
  accountId,
  ownerId = "equity-curve",
  comparisonMode,
}: {
  accountId?: string;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
}) {
  const { start, end, min, max } = useChartDateRange();
  const renderMode = useChartRenderMode();
  const comparisons = useComparisonStore((state) => state.comparisons);
  const myMode = comparisonMode ?? comparisons[ownerId] ?? "none";
  const resolvedCurrencyCode = useChartCurrencyCode(accountId);

  const resolvedRange = React.useMemo(() => {
    const minDate = min ? new Date(min) : undefined;
    const maxDate = max ? new Date(max) : undefined;
    minDate?.setUTCHours(0, 0, 0, 0);
    maxDate?.setUTCHours(0, 0, 0, 0);

    if (start && end) {
      return { start: new Date(start), end: new Date(end) };
    }

    const fallbackEnd = maxDate ?? new Date();
    const endUTC = new Date(
      Date.UTC(
        fallbackEnd.getUTCFullYear(),
        fallbackEnd.getUTCMonth(),
        fallbackEnd.getUTCDate()
      )
    );
    const startUTC = new Date(endUTC);
    startUTC.setUTCDate(startUTC.getUTCDate() - 29);
    if (minDate && startUTC < minDate) {
      return { start: minDate, end: endUTC };
    }
    return { start: startUTC, end: endUTC };
  }, [end, max, min, start]);

  const rangeOverride = React.useMemo(
    () =>
      resolvedRange
        ? {
            startISO: normalizeDateRange(resolvedRange).start.toISOString(),
            endISO: normalizeDateRange(resolvedRange).end.toISOString(),
          }
        : undefined,
    [resolvedRange]
  );

  const comparisonRange = React.useMemo(() => {
    if (!resolvedRange) return null;
    return getComparisonRange(myMode, resolvedRange, {
      minDate: min,
      maxDate: max,
    });
  }, [max, min, myMode, resolvedRange]);

  const comparisonRangeOverride = React.useMemo(
    () =>
      comparisonRange
        ? {
            startISO: normalizeDateRange(comparisonRange).start.toISOString(),
            endISO: normalizeDateRange(comparisonRange).end.toISOString(),
          }
        : undefined,
    [comparisonRange]
  );

  const timelineRange = React.useMemo(
    () => (resolvedRange ? normalizeDateRange(resolvedRange) : null),
    [resolvedRange]
  );
  const comparisonTimelineRange = React.useMemo(
    () => (comparisonRange ? normalizeDateRange(comparisonRange) : null),
    [comparisonRange]
  );

  const { trades, isLoading: tradesLoading } = useChartTrades(
    accountId,
    rangeOverride
  );
  const {
    trades: comparisonTrades,
    isLoading: comparisonTradesLoading,
  } = useChartTrades(accountId, comparisonRangeOverride, {
    enabled: Boolean(comparisonRange),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    ...trpcOptions.accounts.stats.queryOptions({
      accountId: accountId || "",
      currencyCode: resolvedCurrencyCode,
    }),
    enabled: !!accountId,
  });

  const initialBalance = Number(
    (
      statsData as
        | {
            initialBalance?: number | string | null;
          }
        | undefined
    )?.initialBalance ?? 0
  );

  const data = React.useMemo(
    () => buildEquitySeries(trades, timelineRange, initialBalance),
    [initialBalance, timelineRange, trades]
  );
  const comparisonData = React.useMemo(
    () =>
      comparisonTimelineRange
        ? buildEquitySeries(
            comparisonTrades,
            comparisonTimelineRange,
            initialBalance
          )
        : [],
    [comparisonTimelineRange, comparisonTrades, initialBalance]
  );

  const loading = tradesLoading || statsLoading || comparisonTradesLoading;

  if (loading) {
    return (
      <div className="flex h-full flex-col justify-center gap-2">
        <Skeleton className="h-4 w-32 rounded-none bg-sidebar" />
        <Skeleton className="h-full w-full rounded-none bg-sidebar" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        No trades in selected range
      </div>
    );
  }

  const currentEquity = data[data.length - 1]?.equity ?? initialBalance;
  const netChange = currentEquity - initialBalance;
  const netChangePercent =
    initialBalance > 0 ? (netChange / initialBalance) * 100 : 0;
  const changeVerb = netChange >= 0 ? "increased" : "decreased";

  const daysSelected = timelineRange ? countRangeDays(timelineRange) : null;
  const primaryLabel = (() => {
    if (!daysSelected) return "Selected range";
    if (daysSelected === 1) return "Selected day";
    if (daysSelected === 7) return "Selected week";
    return `Selected ${daysSelected} days`;
  })();
  const comparisonLabel = (() => {
    if (!comparisonData.length) return undefined;
    if (myMode === "thisWeek") return "This week";
    if (myMode === "lastWeek") return "Last week";
    if (!daysSelected) return "Previous range";
    if (daysSelected === 1) return "Previous day";
    return `Previous ${daysSelected} days`;
  })();
  const primaryRangeLabel = timelineRange
    ? formatRangeLabel(timelineRange)
    : undefined;
  const comparisonRangeLabel = comparisonTimelineRange
    ? formatRangeLabel(comparisonTimelineRange)
    : undefined;
  const durationMs = timelineRange ? getRangeDurationMs(timelineRange) : 0;
  const sampleStepMs = timelineRange
    ? getRelativeSamplingStepMs(timelineRange)
    : null;
  const axisTickStepMs = timelineRange
    ? getRelativeAxisTickStepMs(timelineRange)
    : null;
  const useBucketedSampling = timelineRange
    ? usesBucketedRelativeSampling(timelineRange)
    : false;
  const primarySeries = data.map((point) => ({
    relativeMs: point.relativeMs,
    value: point.equity,
  }));
  const comparisonSeries = comparisonData.map((point) => ({
    relativeMs: point.relativeMs,
    value: point.equity,
  }));

  const mergedData = getMergedRelativePositions(
    primarySeries,
    comparisonSeries,
    durationMs,
    sampleStepMs,
    {
      includeSeriesPoints: !useBucketedSampling,
    }
  ).map((relativeMs) => ({
    x: relativeMs,
    label: timelineRange ? formatRelativeDate(timelineRange, relativeMs) : "",
    primaryDate: timelineRange
      ? formatRelativeTooltipDate(timelineRange, relativeMs)
      : "",
    comparisonDate: comparisonTimelineRange
      ? formatRelativeTooltipDate(comparisonTimelineRange, relativeMs)
      : undefined,
    equity: getSeriesValueAt(primarySeries, relativeMs),
    compare: comparisonData.length
      ? getSeriesValueAt(comparisonSeries, relativeMs)
      : undefined,
  }));

  const allEquityValues = mergedData.flatMap((point) =>
    [point.equity, point.compare].filter(
      (value): value is number => typeof value === "number"
    )
  );
  const minEquity = Math.min(...allEquityValues, initialBalance);
  const maxEquity = Math.max(...allEquityValues, initialBalance);
  const equityRange = maxEquity - minEquity;
  const padding = equityRange > 0 ? equityRange * 0.1 : Math.max(initialBalance * 0.05, 100);
  const yMin = Math.max(0, minEquity - padding);
  const yMax = maxEquity + padding;
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Number((yMin + ((yMax - yMin) / 4) * index).toFixed(2))
  );
  const xTicks = buildRelativeAxisTicks(durationMs, 6, axisTickStepMs);

  return (
    <Card className="h-full w-full rounded-none border-none bg-transparent shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="-mt-3">
          <p className="text-sm font-normal tracking-wide text-white/40">
            In the selected days, your equity has {changeVerb} by{" "}
            <span
              className={netChange >= 0 ? "font-medium text-teal-400" : "font-medium text-rose-400"}
            >
              {formatSignedPercent(netChangePercent)}
            </span>
            {" "}({formatSignedCurrency(netChange, 2, resolvedCurrencyCode)}).
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-visible">
        <ChartContainer config={chartConfig} className="h-52 w-full md:h-74">
          <AreaChart
            data={mergedData}
            margin={{ top: 12, right: 0, left: 44, bottom: -4 }}
          >
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00E0C8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00E0C8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, durationMs]}
              ticks={xTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: "rgba(255,255,255,0.4)" }}
              tickFormatter={(value) =>
                timelineRange
                  ? formatRelativeDate(timelineRange, Number(value))
                  : ""
              }
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={20}
              tick={{ fill: "rgba(255,255,255,0.4)" }}
              tickFormatter={(value) =>
                formatSignedCurrency(value, 0, resolvedCurrencyCode)
              }
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as {
                  label: string;
                  primaryDate?: string;
                  comparisonDate?: string;
                };
                return (
                  <DashboardChartTooltipFrame
                    title={point.primaryDate ?? point.comparisonDate ?? point.label}
                  >
                    {payload.map((item) => {
                      const key = item.dataKey as "equity" | "compare";
                      const value = Number(item.value ?? 0);
                      const label =
                        key === "equity"
                          ? primaryRangeLabel
                            ? `${primaryLabel} (${primaryRangeLabel})`
                            : primaryLabel
                          : comparisonRangeLabel
                            ? `${comparisonLabel ?? "Comparison"} (${comparisonRangeLabel})`
                            : (comparisonLabel ?? "Comparison");
                      return (
                        <DashboardChartTooltipRow
                          key={key}
                          label={label}
                          value={formatSignedCurrency(
                            value,
                            2,
                            resolvedCurrencyCode
                          )}
                          tone={key === "compare" ? "accent" : "default"}
                          indicatorColor={key === "compare" ? "#FCA070" : "#00E0C8"}
                        />
                      );
                    })}
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#00E0C8"
              strokeWidth={2}
              fill="url(#equityGradient)"
              dot={false}
              isAnimationActive={renderMode !== "embedded"}
              activeDot={{ r: 4, fill: "#00E0C8" }}
            />
            {comparisonData.length > 0 ? (
              <Area
                type="monotone"
                dataKey="compare"
                stroke="#FCA070"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="transparent"
                fillOpacity={0}
                dot={false}
                isAnimationActive={renderMode !== "embedded"}
                activeDot={{ r: 4, fill: "#FCA070" }}
              />
            ) : null}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
