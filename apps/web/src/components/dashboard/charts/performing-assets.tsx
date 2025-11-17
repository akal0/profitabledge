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

const CHART_MARGIN = 35;

type Point = { label: string; value: number };

const chartConfig = {
  profit: {
    label: "Profit",
    color: "var(--secondary-foreground)",
  },
} satisfies ChartConfig;

export function PerformingAssetsBarChart({
  accountId,
  ownerId = "performing-assets",
}: {
  accountId?: string;
  ownerId?: string;
}) {
  const { start, end, max } = useDateRangeStore();
  const comparisons = useComparisonStore((s) => s.comparisons);
  const myMode = comparisons[ownerId] ?? "none";
  const [series, setSeries] = React.useState<Point[]>([]);
  const [comparisonSeries, setComparisonSeries] = React.useState<
    Point[] | null
  >(null);

  React.useEffect(() => {
    (async () => {
      if (!accountId || !start || !end) return;
      // Primary: total profit grouped by asset in selected range
      const primaryAssets = await trpcClient.accounts.profitByAssetRange.query({
        accountId,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      });
      const primaryMap = new Map<string, number>();
      for (const a of primaryAssets) {
        const key = (a.symbol ?? "(Unknown)").trim();
        primaryMap.set(key, Number(a.totalProfit ?? 0));
      }

      // Optional comparison based on myMode
      let compareMap: Map<string, number> | null = null;
      if (myMode === "previous") {
        const dayMs = 24 * 60 * 60 * 1000;
        const s = new Date(start);
        const e = new Date(end);
        s.setHours(0, 0, 0, 0);
        e.setHours(0, 0, 0, 0);
        const daysSelected = Math.floor((+e - +s) / dayMs) + 1;
        const prevStart = new Date(s);
        prevStart.setDate(s.getDate() - daysSelected);
        const prevEnd = new Date(e);
        prevEnd.setDate(e.getDate() - daysSelected);
        const prevAssets = await trpcClient.accounts.profitByAssetRange.query({
          accountId,
          startISO: prevStart.toISOString(),
          endISO: prevEnd.toISOString(),
        });
        compareMap = new Map();
        for (const a of prevAssets) {
          const key = (a.symbol ?? "(Unknown)").trim();
          compareMap.set(key, Number(a.totalProfit ?? 0));
        }
      } else if (myMode === "thisWeek" && max) {
        const endMost = new Date(max);
        endMost.setHours(0, 0, 0, 0);
        const startMost = new Date(endMost);
        startMost.setDate(endMost.getDate() - 6);
        const recentAssets = await trpcClient.accounts.profitByAssetRange.query(
          {
            accountId,
            startISO: startMost.toISOString(),
            endISO: endMost.toISOString(),
          }
        );
        compareMap = new Map();
        for (const a of recentAssets) {
          const key = (a.symbol ?? "(Unknown)").trim();
          compareMap.set(key, Number(a.totalProfit ?? 0));
        }
      }

      // Build display list: union of symbols; filter out zeros in both series
      const symbols = new Set<string>([...primaryMap.keys()]);
      if (compareMap) for (const k of compareMap.keys()) symbols.add(k);
      const filteredSymbols = Array.from(symbols).filter((sym) => {
        const p = Number(primaryMap.get(sym) ?? 0);
        const c = Number(compareMap ? compareMap.get(sym) ?? 0 : 0);
        return p !== 0 || c !== 0;
      });

      // Sort by absolute primary profit desc; tie-break by compare abs
      filteredSymbols.sort((a, b) => {
        const pa = Math.abs(Number(primaryMap.get(a) ?? 0));
        const pb = Math.abs(Number(primaryMap.get(b) ?? 0));
        if (pb !== pa) return pb - pa;
        const ca = Math.abs(Number(compareMap ? compareMap.get(a) ?? 0 : 0));
        const cb = Math.abs(Number(compareMap ? compareMap.get(b) ?? 0 : 0));
        return cb - ca;
      });

      const primaryPoints: Point[] = filteredSymbols.map((sym) => ({
        label: sym,
        value: Number(primaryMap.get(sym) ?? 0),
      }));
      setSeries(primaryPoints);

      if (compareMap) {
        const comparePoints: Point[] = filteredSymbols.map((sym) => ({
          label: sym,
          value: Number(compareMap!.get(sym) ?? 0),
        }));
        setComparisonSeries(comparePoints);
      } else {
        setComparisonSeries(null);
      }
    })();
  }, [
    accountId,
    start?.toISOString(),
    end?.toISOString(),
    max?.toString(),
    myMode,
    ownerId,
  ]);
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );
  const [activeDataset, setActiveDataset] = React.useState<
    "profit" | "compare" | undefined
  >(undefined);

  const dataForChart = React.useMemo(
    () => series.map((p) => ({ asset: p.label, profit: p.value })),
    [series]
  );
  const comparisonDataForChart = React.useMemo(
    () =>
      comparisonSeries
        ? comparisonSeries.map((p) => ({ asset: p.label, compare: p.value }))
        : [],
    [comparisonSeries]
  );

  // Merge primary and comparison series into one dataset for Recharts
  const mergedData = React.useMemo(() => {
    if (!comparisonDataForChart.length) return dataForChart;
    const len = Math.max(dataForChart.length, comparisonDataForChart.length);
    const rows: Array<{ asset: string; profit?: number; compare?: number }> =
      [];
    for (let i = 0; i < len; i++) {
      const base = dataForChart[i];
      const comp = comparisonDataForChart[i];
      rows.push({
        asset: base?.asset ?? comp?.asset ?? String(i + 1),
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

  // Compute most/least profitable assets (include comparison if enabled)
  const bestWorst = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of series)
      totals.set(p.label, (totals.get(p.label) ?? 0) + Number(p.value || 0));
    if (comparisonSeries && (myMode === "previous" || myMode === "thisWeek")) {
      for (const c of comparisonSeries)
        totals.set(c.label, (totals.get(c.label) ?? 0) + Number(c.value || 0));
    }
    let best: { symbol: string; v: number } | null = null;
    let worst: { symbol: string; v: number } | null = null;
    for (const [symbol, v] of totals.entries()) {
      if (best === null || v > best.v) best = { symbol, v };
      if (worst === null || v < worst.v) worst = { symbol, v };
    }
    return { best, worst };
  }, [series, comparisonSeries, myMode]);

  const primaryLabel = React.useMemo(() => "Selected range", []);
  const comparisonLabel = React.useMemo(() => {
    if (!comparisonSeries) return undefined;
    return myMode === "thisWeek" ? "This week" : "Previous range";
  }, [comparisonSeries, myMode]);

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
    if (!start || !end || myMode !== "previous") return undefined;
    const prevStart = new Date(start);
    prevStart.setHours(0, 0, 0, 0);
    // Use same length as primary by counting unique assets length as proxy
    const days = 7; // fallback window length
    prevStart.setDate(prevStart.getDate() - days);
    const prevEnd = new Date(end);
    prevEnd.setHours(0, 0, 0, 0);
    prevEnd.setDate(prevEnd.getDate() - days);
    return formatRange(prevStart, prevEnd);
  }, [start, end, myMode, formatRange]);

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {bestWorst.best && bestWorst.worst ? (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Most profitable asset:{" "}
              <span className="text-teal-400 font-medium">
                {bestWorst.best.symbol} ({bestWorst.best.v < 0 ? "-$" : "$"}
                {Math.abs(bestWorst.best.v).toLocaleString()})
              </span>{" "}
              · Least profitable asset:{" "}
              <span className="text-rose-400 font-medium">
                {bestWorst.worst.symbol} ({bestWorst.worst.v < 0 ? "-$" : "$"}
                {Math.abs(bestWorst.worst.v).toLocaleString()})
              </span>
            </p>
          ) : (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Asset performance
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
                dataKey="asset"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => String(value).slice(0, 12)}
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
