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
import { trpcClient } from "@/utils/trpc";
import {
  formatRangeLabel,
  getComparisonRange,
} from "@/components/dashboard/chart-comparison-utils";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "./dashboard-chart-ui";
import { useChartDateRange } from "./use-chart-date-range";

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
  comparisonMode,
}: {
  accountId?: string;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
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

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!accountId || !resolvedRange) return;

      const primaryPromise = trpcClient.accounts.profitByAssetRange.query({
        accountId,
        startISO: resolvedRange.start.toISOString(),
        endISO: resolvedRange.end.toISOString(),
      });
      const comparisonPromise = comparisonRange
        ? trpcClient.accounts.profitByAssetRange.query({
            accountId,
            startISO: comparisonRange.start.toISOString(),
            endISO: comparisonRange.end.toISOString(),
          })
        : Promise.resolve(null);

      const [primaryAssets, comparisonAssets] = await Promise.all([
        primaryPromise,
        comparisonPromise,
      ]);
      if (cancelled) return;

      const primaryMap = new Map<string, number>();
      for (const a of primaryAssets) {
        const key = (a.symbol ?? "(Unknown)").trim();
        primaryMap.set(key, Number(a.totalProfit ?? 0));
      }

      let compareMap: Map<string, number> | null = null;
      if (comparisonAssets) {
        compareMap = new Map();
        for (const a of comparisonAssets) {
          const key = (a.symbol ?? "(Unknown)").trim();
          compareMap.set(key, Number(a.totalProfit ?? 0));
        }
      }

      const symbols = new Set<string>([...primaryMap.keys()]);
      if (compareMap) for (const k of compareMap.keys()) symbols.add(k);
      const filteredSymbols = Array.from(symbols).filter((sym) => {
        const p = Number(primaryMap.get(sym) ?? 0);
        const c = Number(compareMap ? compareMap.get(sym) ?? 0 : 0);
        return p !== 0 || c !== 0;
      });

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

    return () => {
      cancelled = true;
    };
  }, [accountId, comparisonRange, resolvedRange]);
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
    if (comparisonSeries) {
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
  }, [series, comparisonSeries]);

  const primaryLabel = React.useMemo(() => "Selected range", []);
  const comparisonLabel = React.useMemo(() => {
    if (!comparisonSeries) return undefined;
    if (myMode === "thisWeek") return "This week";
    if (myMode === "lastWeek") return "Last week";
    return "Previous range";
  }, [comparisonSeries, myMode]);

  const selectedRangeStr = React.useMemo(() => {
    if (!resolvedRange) return undefined;
    return formatRangeLabel(resolvedRange);
  }, [resolvedRange]);

  const comparisonRangeStr = React.useMemo(() => {
    if (!comparisonRange) return undefined;
    return formatRangeLabel(comparisonRange);
  }, [comparisonRange]);

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {bestWorst.best && bestWorst.worst ? (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Most profitable asset:{" "}
              <span className="text-teal-400 font-medium">
                {bestWorst.best.symbol} ({formatSignedCurrency(bestWorst.best.v, 0)})
              </span>{" "}
              · Least profitable asset:{" "}
              <span className="text-rose-400 font-medium">
                {bestWorst.worst.symbol} ({formatSignedCurrency(bestWorst.worst.v, 0)})
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
                    comparisonRangeStr
                      ? `${comparisonLabel} (${comparisonRangeStr})`
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
                              (key === "profit" ? "Selected" : "Previous")
                            }
                            value={formatSignedCurrency(v, 0)}
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
