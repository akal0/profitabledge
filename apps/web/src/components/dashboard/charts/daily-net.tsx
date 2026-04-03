"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import React from "react";
import { AnimatePresence } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMotionValueEvent, useSpring } from "framer-motion";
import {
  useComparisonStore,
  type WidgetComparisonMode,
} from "@/stores/comparison";
import { queryClient, trpcOptions } from "@/utils/trpc";
import {
  countRangeDays,
  formatRangeLabel,
  getComparisonRange,
} from "@/components/dashboard/chart-comparison-utils";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
  useChartCurrencyCode,
} from "./dashboard-chart-ui";
import { useChartDateRange } from "./use-chart-date-range";

const CHART_MARGIN = 35;

type Point = { label: string; value: number };
type DayRow = { dateISO: string; totalProfit: number };

const chartConfig = {
  profit: {
    label: "Profit",
    color: "var(--secondary-foreground)",
  },
} satisfies ChartConfig;

export function DailyNetBarChart({
  accountId,
  ownerId = "daily-net",
  comparisonMode,
  rows,
  comparisonRows,
  currencyCode,
  headline,
  xAxisTickFormatter,
  primarySeriesLabel,
  comparisonSeriesLabel,
  chartMargin,
}: {
  accountId?: string;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
  rows?: Point[];
  comparisonRows?: Point[] | null;
  currencyCode?: string | null;
  headline?: React.ReactNode;
  xAxisTickFormatter?: (value: string) => string;
  primarySeriesLabel?: string;
  comparisonSeriesLabel?: string;
  chartMargin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}) {
  const { start, end, min, max } = useChartDateRange();
  const comparisons = useComparisonStore((s) => s.comparisons);
  const myMode = comparisonMode ?? comparisons[ownerId] ?? "none";
  const [series, setSeries] = React.useState<Point[]>([]);
  const [comparisonSeries, setComparisonSeries] = React.useState<
    Point[] | null
  >(null);

  const resolvedRange = React.useMemo(() => {
    const minD = min ? new Date(min) : undefined;
    const maxD = max ? new Date(max) : undefined;
    minD?.setHours(0, 0, 0, 0);
    maxD?.setHours(23, 59, 59, 999);

    if (start && end) {
      return { start: new Date(start), end: new Date(end) };
    }

    const fallbackEnd = maxD ?? new Date();
    const endDate = new Date(fallbackEnd);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 6);
    if (minD && startDate < minD) {
      return { start: minD, end: endDate };
    }
    return { start: startDate, end: endDate };
  }, [end, max, min, start]);

  const comparisonRange = React.useMemo(() => {
    if (!resolvedRange) return null;
    return getComparisonRange(myMode, resolvedRange, {
      minDate: min,
      maxDate: max,
    });
  }, [max, min, myMode, resolvedRange]);
  const resolvedCurrencyCode = useChartCurrencyCode(accountId, currencyCode);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (rows || !accountId || !resolvedRange) return;

      const primaryPromise = queryClient.fetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId,
          startISO: resolvedRange.start.toISOString(),
          endISO: resolvedRange.end.toISOString(),
          currencyCode: resolvedCurrencyCode,
        }),
        staleTime: 30_000,
      });
      const comparisonPromise = comparisonRange
        ? queryClient.fetchQuery({
            ...trpcOptions.accounts.recentByDay.queryOptions({
              accountId,
              startISO: comparisonRange.start.toISOString(),
              endISO: comparisonRange.end.toISOString(),
              currencyCode: resolvedCurrencyCode,
            }),
            staleTime: 30_000,
          })
        : Promise.resolve(null);

      const [primary, comparison] = await Promise.all([
        primaryPromise,
        comparisonPromise,
      ]);
      if (cancelled) return;

      const primaryPoints: Point[] = (primary as DayRow[]).map((d) => ({
        label: new Date(d.dateISO).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: d.totalProfit,
      }));
      setSeries(primaryPoints);

      if (!comparisonRange || !comparison) {
        setComparisonSeries(null);
        return;
      }

      const comparisonPoints: Point[] = (comparison as DayRow[]).map((d) => ({
        label: new Date(d.dateISO).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: d.totalProfit,
      }));
      setComparisonSeries(comparisonPoints);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, comparisonRange, resolvedCurrencyCode, resolvedRange, rows]);

  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );
  const [activeDataset, setActiveDataset] = React.useState<
    "profit" | "compare" | undefined
  >(undefined);

  const primarySeries = rows ?? series;
  const secondarySeries = comparisonRows ?? comparisonSeries;

  const dataForChart = React.useMemo(
    () => primarySeries.map((p) => ({ month: p.label, profit: p.value })),
    [primarySeries]
  );
  const comparisonDataForChart = React.useMemo(
    () =>
      secondarySeries
        ? secondarySeries.map((p) => ({ month: p.label, compare: p.value }))
        : [],
    [secondarySeries]
  );

  const mergedData = React.useMemo(() => {
    if (!comparisonDataForChart.length) return dataForChart;
    const len = Math.max(dataForChart.length, comparisonDataForChart.length);
    const rows: Array<{ month: string; profit?: number; compare?: number }> =
      [];
    for (let i = 0; i < len; i++) {
      const base = dataForChart[i];
      const comp = comparisonDataForChart[i];
      rows.push({
        month: base?.month ?? comp?.month ?? String(i + 1),
        profit: base?.profit,
        compare: comp?.compare,
      });
    }
    return rows;
  }, [comparisonDataForChart, dataForChart]);

  const maxValueIndex = React.useMemo(() => {
    if (activeIndex !== undefined) {
      return {
        index: activeIndex,
        value: dataForChart[activeIndex]?.profit ?? 0,
      };
    }
    return dataForChart.reduce(
      (currentMax, data, index) =>
        data.profit > currentMax.value
          ? { index, value: data.profit }
          : currentMax,
      { index: 0, value: 0 }
    );
  }, [activeIndex, dataForChart]);

  const maxValueIndexSpring = useSpring(maxValueIndex.value, {
    stiffness: 100,
    damping: 20,
  });

  const [springyValue, setSpringyValue] = React.useState(maxValueIndex.value);

  useMotionValueEvent(maxValueIndexSpring, "change", (latest) => {
    setSpringyValue(Number(latest.toFixed(0)));
  });

  React.useEffect(() => {
    maxValueIndexSpring.set(maxValueIndex.value);
  }, [maxValueIndex.value, maxValueIndexSpring]);

  const displayedValue = React.useMemo(
    () => Math.round(maxValueIndex.value || 0),
    [maxValueIndex.value]
  );

  const niceScale = React.useMemo(() => {
    const values: number[] = [];
    for (const d of dataForChart)
      if (typeof d.profit === "number") values.push(d.profit);
    for (const d of comparisonDataForChart)
      if (typeof (d as any).compare === "number")
        values.push((d as any).compare);

    let maxAbs = values.length
      ? Math.max(...values.map((v) => Math.abs(Number(v) || 0)))
      : 0;

    if (!Number.isFinite(maxAbs) || maxAbs === 0) {
      maxAbs = 100;
    }

    const niceStep = (x: number) => {
      const exp = Math.floor(Math.log10(x));
      const f = x / Math.pow(10, exp);
      let nf = 1;
      if (f <= 1) nf = 1;
      else if (f <= 2) nf = 2;
      else if (f <= 5) nf = 5;
      else nf = 10;
      return nf * Math.pow(10, exp);
    };

    const step = niceStep(maxAbs / 3);
    const maxValue = step * 3;
    const minValue = -maxValue;
    const ticks = Array.from({ length: 7 }, (_, i) => minValue + i * step);
    return { min: minValue, max: maxValue, ticks };
  }, [comparisonDataForChart, dataForChart]);

  const currencyTick = (v: number) => {
    return formatSignedCurrency(v, 0, resolvedCurrencyCode);
  };

  const weekNet = React.useMemo(
    () => Math.round(primarySeries.reduce((sum, p) => sum + (p.value || 0), 0)),
    [primarySeries]
  );

  const daysSelected = React.useMemo(() => {
    if (rows) return null;
    if (!resolvedRange) return null;
    return countRangeDays(resolvedRange);
  }, [resolvedRange, rows]);

  const primaryLabel = React.useMemo(() => {
    if (primarySeriesLabel) return primarySeriesLabel;
    if (rows) return "Selected range";
    if (!daysSelected) return "Selected days";
    return daysSelected === 7 ? "Selected week" : `Selected ${daysSelected} days`;
  }, [daysSelected, primarySeriesLabel, rows]);

  const comparisonLabel = React.useMemo(() => {
    if (comparisonSeriesLabel) return comparisonSeriesLabel;
    if (!secondarySeries) return undefined;
    if (rows) return "Comparison";
    if (myMode === "thisWeek") return "This week";
    if (myMode === "lastWeek") return "Last week";
    if (!daysSelected) return undefined;
    if (daysSelected === 1) return "Previous day";
    return `Previous ${daysSelected} days`;
  }, [comparisonSeriesLabel, daysSelected, myMode, rows, secondarySeries]);

  const selectedRangeStr = React.useMemo(() => {
    if (rows) return undefined;
    if (!resolvedRange) return undefined;
    return formatRangeLabel(resolvedRange);
  }, [resolvedRange, rows]);

  const comparisonRangeStr = React.useMemo(() => {
    if (rows) return undefined;
    if (!comparisonRange) return undefined;
    return formatRangeLabel(comparisonRange);
  }, [comparisonRange, rows]);

  const positiveWeekNet = weekNet >= 0;
  const defaultHeadline = rows ? (
    <p className="text-sm font-normal tracking-wide text-white/40">
      Across the selected filter, net P&amp;L totals{" "}
      <span
        className={cn(
          "font-medium tracking-normal",
          positiveWeekNet ? "text-teal-400" : "text-rose-400"
        )}
      >
        {formatSignedCurrency(weekNet, 0, resolvedCurrencyCode)}
      </span>
      .
    </p>
  ) : daysSelected === 7 ? (
    positiveWeekNet ? (
      <p className="font-normal text-white/40 text-sm tracking-wide">
        Nice work. Your selected week closed at{" "}
        <span
          className={cn("font-semibold tracking-normal", "text-teal-400")}
        >
          {formatSignedCurrency(weekNet, 0, resolvedCurrencyCode)}
        </span>
        .
      </p>
    ) : (
      <p className="font-normal text-white/40 text-sm tracking-wide">
        Your selected week finished at{" "}
        <span
          className={cn("font-medium tracking-normal", "text-rose-400")}
        >
          {formatSignedCurrency(weekNet, 0, resolvedCurrencyCode)}
        </span>
        .
      </p>
    )
  ) : (
    <p className="font-normal text-white/40 text-sm tracking-wide">
      In the selected {daysSelected ?? "?"} days, you{" "}
      {positiveWeekNet ? "made" : "lost"}{" "}
      <span
        className={cn(
          "font-medium tracking-normal",
          positiveWeekNet ? "text-teal-400" : "text-rose-400"
        )}
      >
        {formatSignedCurrency(weekNet, 0, resolvedCurrencyCode)}
      </span>
      .
    </p>
  );

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {headline ?? defaultHeadline}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 overflow-visible">
        <AnimatePresence mode="wait">
          <ChartContainer config={chartConfig} className="w-full h-52 md:h-74">
            <BarChart
              accessibilityLayer
              data={mergedData}
              onMouseLeave={() => {}}
              margin={{
                left: chartMargin?.left ?? 0,
                right: chartMargin?.right ?? 0,
                top: chartMargin?.top ?? 12,
                bottom: chartMargin?.bottom ?? -4,
              }}
            >
              <YAxis
                domain={[niceScale.min, niceScale.max]}
                tickLine={false}
                axisLine={false}
                width={56}
                tickMargin={6}
                tickFormatter={currencyTick}
                ticks={niceScale.ticks}
              />

              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) =>
                  xAxisTickFormatter ? xAxisTickFormatter(String(value)) : String(value).slice(0, 6)
                }
              />
              <Bar
                dataKey="profit"
                fill="var(--color-profit)"
                radius={[0, 0, 0, 0]}
                barSize={32}
                name={
                  selectedRangeStr
                    ? `${primaryLabel} (${selectedRangeStr})`
                    : primaryLabel
                }
              >
                {mergedData.map((d: any, index: number) => {
                  const isActive =
                    index === maxValueIndex.index &&
                    activeDataset !== "compare";
                  const hoverFill = d.profit >= 0 ? "#2dd4bf" : "#fb7185";
                  return (
                    <Cell
                      className="duration-200"
                      opacity={isActive ? 1 : 0.2}
                      key={index}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("profit");
                      }}
                      fill={isActive ? hoverFill : "var(--color-profit)"}
                    />
                  );
                })}
              </Bar>
              {comparisonDataForChart.length > 0 ? (
                <Bar
                  dataKey="compare"
                  fill="#FCA070"
                  radius={[0, 0, 0, 0]}
                  barSize={32}
                  name={
                    comparisonRangeStr
                      ? `${comparisonLabel} (${comparisonRangeStr})`
                      : comparisonLabel
                  }
                >
                  {mergedData.map((d: any, index: number) => {
                    const isActive =
                      index === maxValueIndex.index &&
                      activeDataset === "compare";
                    const hoverFill = d.compare >= 0 ? "#2dd4bf" : "#fb7185";
                    return (
                      <Cell
                        className="duration-200"
                        opacity={isActive ? 1 : 0.2}
                        key={`cmp-${index}`}
                        onMouseEnter={() => {
                          setActiveIndex(index);
                          setActiveDataset("compare");
                        }}
                        fill={isActive ? hoverFill : "#FCA070"}
                      />
                    );
                  })}
                </Bar>
              ) : null}
              <CartesianGrid vertical={false} strokeDasharray="8 8" />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <DashboardChartTooltipFrame title="Profit">
                      {payload.map((item: any) => {
                        const key = item.dataKey as "profit" | "compare";
                        const isRowActive = activeDataset
                          ? key === activeDataset
                          : true;
                        const v = Number(item.value ?? 0);
                        return (
                          <DashboardChartTooltipRow
                            key={key}
                            label={
                              item.name ??
                              (key === "profit" ? "Selected" : "Comparison")
                            }
                            value={formatSignedCurrency(v, 0, resolvedCurrencyCode)}
                            tone={v < 0 ? "negative" : "positive"}
                            dimmed={!isRowActive}
                            indicatorColor={
                              typeof item.color === "string"
                                ? item.color
                                : key === "compare"
                                  ? "#FCA070"
                                  : v < 0
                                    ? "#fb7185"
                                    : "#2dd4bf"
                            }
                          />
                        );
                      })}
                    </DashboardChartTooltipFrame>
                  );
                }}
              />
            </BarChart>
          </ChartContainer>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

interface CustomReferenceLabelProps {
  viewBox?: {
    x?: number;
    y?: number;
  };
  value: number;
}

const CustomReferenceLabel: React.FC<CustomReferenceLabelProps> = (props) => {
  const { viewBox, value } = props;
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;

  const width = React.useMemo(() => {
    const characterWidth = 8;
    const padding = 10;
    return value.toString().length * characterWidth + padding;
  }, [value]);

  return (
    <>
      <rect
        x={x - CHART_MARGIN}
        y={y - 9}
        width={width}
        height={18}
        fill="var(--secondary-foreground)"
        rx={4}
      />
      <text
        fontWeight={600}
        x={x - CHART_MARGIN + 6}
        y={y + 4}
        fill="var(--primary-foreground)"
      >
        {value}
      </text>
    </>
  );
};
