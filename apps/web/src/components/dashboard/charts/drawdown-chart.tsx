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
  drawdown: {
    label: "Drawdown",
    color: "#F76290",
  },
  compare: {
    label: "Comparison",
    color: "#FCA070",
  },
} satisfies ChartConfig;

type DataPoint = {
  drawdown: number;
  drawdownPercent: number;
  relativeMs: number;
};

function buildDrawdownSeries(
  trades: ChartTrade[],
  range: { start: Date; end: Date } | null,
  initialBalance: number
) {
  if (!range) {
    return {
      data: [] as DataPoint[],
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
    };
  }

  const durationMs = getRangeDurationMs(range);
  let runningEquity = initialBalance;
  let peakEquity = initialBalance;
  let absoluteMaxDrawdown = 0;
  let absoluteMaxDrawdownPercent = 0;
  const points: DataPoint[] = [
    {
      drawdown: 0,
      drawdownPercent: 0,
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
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }

    const drawdown = peakEquity - runningEquity;
    const drawdownPercent = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;

    if (drawdown > absoluteMaxDrawdown) {
      absoluteMaxDrawdown = drawdown;
      absoluteMaxDrawdownPercent = drawdownPercent;
    }

    points.push({
      drawdown: -drawdown,
      drawdownPercent: -drawdownPercent,
      relativeMs: clampRelativeMs(new Date(trade.close || 0).getTime(), range),
    });
  });

  if (points[points.length - 1]?.relativeMs !== durationMs) {
    const currentDrawdown = peakEquity - runningEquity;
    const currentDrawdownPercent =
      peakEquity > 0 ? (currentDrawdown / peakEquity) * 100 : 0;

    points.push({
      drawdown: -currentDrawdown,
      drawdownPercent: -currentDrawdownPercent,
      relativeMs: durationMs,
    });
  }

  return {
    data: points,
    maxDrawdown: absoluteMaxDrawdown,
    maxDrawdownPercent: absoluteMaxDrawdownPercent,
  };
}

export function DrawdownChart({
  accountId,
  ownerId = "drawdown-chart",
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

  const { data, maxDrawdown, maxDrawdownPercent } = React.useMemo(
    () => buildDrawdownSeries(trades, timelineRange, initialBalance),
    [initialBalance, timelineRange, trades]
  );
  const comparisonResult = React.useMemo(
    () =>
      comparisonTimelineRange
        ? buildDrawdownSeries(
            comparisonTrades,
            comparisonTimelineRange,
            initialBalance
          )
        : { data: [] as DataPoint[], maxDrawdown: 0, maxDrawdownPercent: 0 },
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

  const daysSelected = timelineRange ? countRangeDays(timelineRange) : null;
  const primaryLabel = (() => {
    if (!daysSelected) return "Selected range";
    if (daysSelected === 1) return "Selected day";
    if (daysSelected === 7) return "Selected week";
    return `Selected ${daysSelected} days`;
  })();
  const comparisonLabel = (() => {
    if (!comparisonResult.data.length) return undefined;
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
    value: point.drawdownPercent,
  }));
  const comparisonSeries = comparisonResult.data.map((point) => ({
    relativeMs: point.relativeMs,
    value: point.drawdownPercent,
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
    drawdownPercent: getSeriesValueAt(primarySeries, relativeMs),
    compare: comparisonResult.data.length
      ? getSeriesValueAt(comparisonSeries, relativeMs)
      : undefined,
  }));

  const yMin = Math.min(
    ...mergedData.flatMap((point) =>
      [point.drawdownPercent, point.compare].filter(
        (value): value is number => typeof value === "number"
      )
    ),
    -1
  );
  const yTicks = [0, yMin * 0.25, yMin * 0.5, yMin * 0.75, yMin].map((value) =>
    Number(value.toFixed(2))
  );
  const xTicks = buildRelativeAxisTicks(durationMs, 6, axisTickStepMs);

  return (
    <Card className="h-full w-full rounded-none border-none bg-transparent shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="-mt-3">
          <p className="text-sm font-normal tracking-wide text-white/40">
            In the selected days, your maximum drawdown reached{" "}
            <span className="font-medium text-rose-400">
              {formatSignedPercent(-maxDrawdownPercent)}
            </span>
            {" "}({formatSignedCurrency(-maxDrawdown, 2, resolvedCurrencyCode)}).
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-visible">
        <ChartContainer config={chartConfig} className="h-52 w-full md:h-74">
          <AreaChart
            data={mergedData}
            margin={{ top: 12, right: 0, left: 36, bottom: -4 }}
          >
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F76290" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F76290" stopOpacity={0} />
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
              domain={[yMin, 0]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={20}
              tick={{ fill: "rgba(255,255,255,0.4)" }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
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
                      const key = item.dataKey as "drawdownPercent" | "compare";
                      const percent = Number(item.value ?? 0);
                      const label =
                        key === "drawdownPercent"
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
                          value={`${Math.abs(percent).toFixed(2)}% underwater`}
                          tone={key === "compare" ? "accent" : "negative"}
                          indicatorColor={key === "compare" ? "#FCA070" : "#F76290"}
                        />
                      );
                    })}
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="drawdownPercent"
              stroke="#F76290"
              strokeWidth={2}
              fill="url(#drawdownGradient)"
              dot={false}
              isAnimationActive={renderMode !== "embedded"}
              activeDot={{ r: 4, fill: "#F76290" }}
            />
            {comparisonResult.data.length > 0 ? (
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
