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
  ChartTooltipContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JetBrains_Mono } from "next/font/google";
import { useMotionValueEvent, useSpring } from "framer-motion";
import { useDateRangeStore } from "@/stores/date-range";
import { useComparisonStore } from "@/stores/comparison";
import { trpcClient } from "@/utils/trpc";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const CHART_MARGIN = 35;

type Point = { label: string; value: number };

const chartConfig = {
  profit: {
    label: "Profit",
    color: "var(--secondary-foreground)",
  },
} satisfies ChartConfig;

export function DailyNetBarChart({
  accountId,
  ownerId = "daily-net",
}: {
  accountId?: string;
  ownerId?: string;
}) {
  const { start, end } = useDateRangeStore();
  const comparisons = useComparisonStore((s) => s.comparisons);
  const myMode = comparisons[ownerId] ?? "none";
  const [series, setSeries] = React.useState<Point[]>([]);
  const [comparisonSeries, setComparisonSeries] = React.useState<
    Point[] | null
  >(null);

  React.useEffect(() => {
    (async () => {
      if (!accountId || !start || !end) return;
      const data = await trpcClient.accounts.recentByDay.query({
        accountId,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      });
      const points: Point[] = data.map((d) => ({
        label: new Date(d.dateISO).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: d.totalProfit,
      }));
      setSeries(points);
      // Only compute comparison if this chart's comparison is enabled
      if (myMode === "previous") {
        const days = data.length > 0 ? data.length : 7;
        const prevStart = new Date(start);
        prevStart.setDate(start.getDate() - days);
        const prevEnd = new Date(end);
        prevEnd.setDate(end.getDate() - days);
        const prev = await trpcClient.accounts.recentByDay.query({
          accountId,
          startISO: prevStart.toISOString(),
          endISO: prevEnd.toISOString(),
        });
        const prevPoints: Point[] = prev.map((d) => ({
          label: new Date(d.dateISO).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          value: d.totalProfit,
        }));
        setComparisonSeries(prevPoints);
      } else if (myMode === "thisWeek") {
        // Use most recent week from global bounds
        const endMost = new Date(useDateRangeStore.getState().max!);
        endMost.setHours(0, 0, 0, 0);
        const startMost = new Date(endMost);
        startMost.setDate(endMost.getDate() - 6);
        const prev = await trpcClient.accounts.recentByDay.query({
          accountId,
          startISO: startMost.toISOString(),
          endISO: endMost.toISOString(),
        });
        const weekPoints: Point[] = prev.map((d) => ({
          label: new Date(d.dateISO).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          value: d.totalProfit,
        }));
        setComparisonSeries(weekPoints);
      } else {
        setComparisonSeries(null);
      }
    })();
  }, [accountId, start?.toISOString(), end?.toISOString(), myMode, ownerId]);
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );
  const [activeDataset, setActiveDataset] = React.useState<
    "profit" | "compare" | undefined
  >(undefined);

  const dataForChart = React.useMemo(
    () => series.map((p) => ({ month: p.label, profit: p.value })),
    [series]
  );
  const comparisonDataForChart = React.useMemo(
    () =>
      comparisonSeries
        ? comparisonSeries.map((p) => ({ month: p.label, compare: p.value }))
        : [],
    [comparisonSeries]
  );

  // Merge primary and comparison series into one dataset for Recharts
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
  }, [dataForChart, comparisonDataForChart]);

  const maxValueIndex = React.useMemo(() => {
    // if user is moving mouse over bar then set value to the bar value
    if (activeIndex !== undefined) {
      return {
        index: activeIndex,
        value: dataForChart[activeIndex]?.profit ?? 0,
      };
    }
    // if no active index then set value to max value
    return dataForChart.reduce(
      (max, data, index) => {
        return data.profit > max.value ? { index, value: data.profit } : max;
      },
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

  // Compute a symmetric Y-axis domain around 0 that considers both primary and
  // comparison values, and always yields exactly 7 ticks including $0.
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
      maxAbs = 100; // fallback so we always render a scale
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

    // Choose step so that +/- 3 steps covers the maxAbs value
    const step = niceStep(maxAbs / 3);
    const max = step * 3;
    const min = -max;
    const ticks = Array.from({ length: 7 }, (_, i) => min + i * step);
    return { min, max, ticks };
  }, [dataForChart, comparisonDataForChart]);

  const currencyTick = (v: number) => {
    const abs = Math.abs(Math.round(v));
    const prefix = v < 0 ? "-$" : "$";
    return `${prefix}${abs.toLocaleString()}`;
  };

  // Sum total profit over the selected range for header message
  const weekNet = React.useMemo(
    () => Math.round(series.reduce((sum, p) => sum + (p.value || 0), 0)),
    [series]
  );

  const daysSelected = React.useMemo(() => {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const diff = Math.floor((+e - +s) / 86400000) + 1;
    return diff;
  }, [start, end]);

  const primaryLabel = React.useMemo(() => {
    if (!daysSelected) return "Selected days";
    return daysSelected === 7 ? "This week" : `Selected ${daysSelected} days`;
  }, [daysSelected]);

  const comparisonLabel = React.useMemo(() => {
    if (!comparisonSeries) return undefined;
    if (myMode === "thisWeek") return "This week";
    if (!daysSelected) return undefined;
    if (daysSelected === 7) return "Previous week";
    return `Previous ${daysSelected} days`;
  }, [comparisonSeries, daysSelected, myMode]);

  // Build human-readable date ranges for labels/tooltips
  const formatRange = React.useCallback((a: Date, b: Date) => {
    const s = new Date(a);
    const e = new Date(b);
    const sStr = s.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const eStr = e.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${sStr}–${eStr}`;
  }, []);

  const selectedRangeStr = React.useMemo(() => {
    if (!start || !end) return undefined;
    return formatRange(start, end);
  }, [start, end, formatRange]);

  const previousRangeStr = React.useMemo(() => {
    if (myMode === "thisWeek") return undefined;
    if (!start || !end || myMode !== "previous" || !daysSelected)
      return undefined;
    const prevStart = new Date(start);
    prevStart.setHours(0, 0, 0, 0);
    prevStart.setDate(prevStart.getDate() - daysSelected);
    const prevEnd = new Date(end);
    prevEnd.setHours(0, 0, 0, 0);
    prevEnd.setDate(prevEnd.getDate() - daysSelected);
    return formatRange(prevStart, prevEnd);
  }, [start, end, myMode, daysSelected, formatRange]);

  const positiveWeekNet = weekNet >= 0;

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {daysSelected === 7 ? (
            positiveWeekNet ? (
              <p className="font-normal text-white/40 text-sm tracking-wide">
                Awesome! You ended this week with a profit of{" "}
                <span
                  className={cn(
                    "font-semibold tracking-normal",
                    "text-teal-400"
                  )}
                >
                  ${Math.abs(weekNet).toLocaleString()} 🎉
                </span>
              </p>
            ) : (
              <p className="font-normal text-white/40 text-sm tracking-wide">
                Have patience, you'll make back the{" "}
                <span
                  className={cn("font-medium tracking-normal", "text-rose-400")}
                >
                  -${Math.abs(weekNet).toLocaleString()}
                </span>{" "}
                you lost in no time!
              </p>
            )
          ) : (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              In the selected {daysSelected ?? "?"} days, you{" "}
              {positiveWeekNet ? "made" : "lost"} {""}
              <span
                className={cn(
                  "font-medium tracking-normal",
                  positiveWeekNet ? "text-teal-400" : "text-rose-400"
                )}
              >
                {positiveWeekNet ? "$" : "-$"}
                {Math.abs(weekNet).toLocaleString()}
              </span>
              .{" "}
              {positiveWeekNet
                ? "Great job!"
                : "Don't worry, you'll make it back!"}
            </p>
          )}
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
                left: 36,
                right: 0,
                top: 12,
                bottom: -4,
              }}
            >
              <YAxis
                domain={[niceScale.min, niceScale.max]}
                tickLine={false}
                axisLine={false}
                width={20}
                tickMargin={6}
                tickFormatter={currencyTick}
                ticks={niceScale.ticks}
              />

              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 6)}
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
                  const hoverFill = d.profit >= 0 ? "#2dd4bf" : "#fb7185"; // teal-400 / rose-400
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
                    previousRangeStr
                      ? `${comparisonLabel} (${previousRangeStr})`
                      : comparisonLabel
                  }
                >
                  {mergedData.map((d: any, index: number) => {
                    const isActive =
                      index === maxValueIndex.index &&
                      activeDataset === "compare";
                    const hoverFill = d.compare >= 0 ? "#2dd4bf" : "#fb7185"; // teal-400 / rose-400
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
                    <div className="bg-white border-black/10 dark:bg-dashboard-background dark:border-white/10 grid min-w-[16rem] gap-2 border-[0.5px] p-3 px-0 text-xs shadow-xl">
                      <div className="text-[11px] font-medium text-black/80 dark:text-white px-3">
                        Profit
                      </div>
                      <div className="h-px bg-black/10 dark:bg-white/10" />
                      <div className="grid gap-2 px-3">
                        {payload.map((item: any) => {
                          const key = item.dataKey as "profit" | "compare";
                          const isRowActive = activeDataset
                            ? key === activeDataset
                            : true;
                          const v = Number(item.value ?? 0);
                          const sign = v < 0 ? "-$" : "$";
                          return (
                            <div
                              key={key}
                              className={cn(
                                "flex w-full justify-between font-semibold",
                                !isRowActive && "opacity-50"
                              )}
                            >
                              <span className="text-black dark:text-white/80">
                                {item.name ??
                                  (key === "profit" ? "Selected" : "Previous")}
                              </span>
                              <span
                                className={cn(
                                  v < 0 ? "text-rose-400" : "text-teal-400"
                                )}
                              >
                                {sign}
                                {Math.abs(Math.round(v)).toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
                labelClassName="text-black"
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

  // we need to change width based on value length
  const width = React.useMemo(() => {
    const characterWidth = 8; // Average width of a character in pixels
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
