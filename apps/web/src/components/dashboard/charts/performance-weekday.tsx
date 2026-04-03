"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import React from "react";
import {
  useComparisonStore,
  type WidgetComparisonMode,
} from "@/stores/comparison";
import { queryClient, trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { useSpring, useMotionValueEvent } from "motion/react";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
  useChartCurrencyCode,
} from "./dashboard-chart-ui";
import { useChartDateRange } from "./use-chart-date-range";

// Slightly nudge X-axis tick labels to the right without shifting the chart domain
const WeekdayXAxisTick: React.FC<{
  x?: number;
  y?: number;
  payload?: { value?: string };
}> = ({ x = 0, y = 0, payload }) => {
  const label = (payload?.value ?? "") as string;
  const charW = 8; // approx character width
  const padX = 24; // horizontal padding on each side
  const padY = 0; // vertical padding
  const w = Math.max(24, label.length * charW + padX * 2);
  const h = 16 + padY * 2;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={-w / 2}
        y={-h + 12}
        width={w}
        height={h}
        rx={4}
        fill="transparent"
        pointerEvents="none"
      />
      <text textAnchor="middle" fill="currentColor">
        <tspan dy={4}>{label}</tspan>
      </text>
    </g>
  );
};

type DayPoint = { dateISO: string; totalProfit: number };

const chartConfig = {
  profit: {
    label: "Profit",
    color: "var(--secondary-foreground)",
  },
} satisfies ChartConfig;

const WEEKDAY_ORDER = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
type WeekdayKey = (typeof WEEKDAY_ORDER)[number];
const FULL_WEEKDAY_MAP: Record<WeekdayKey, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

// Use UTC when deriving weekday from an ISO date string to avoid local-time shifts
function weekdayKeyFromISO(iso: string): WeekdayKey {
  const date = new Date(iso);
  const day = date.getUTCDay(); // 0 (Sun) - 6 (Sat)
  switch (day) {
    case 0:
      return "Sun";
    case 1:
      return "Mon";
    case 2:
      return "Tue";
    case 3:
      return "Wed";
    case 4:
      return "Thu";
    case 5:
      return "Fri";
    case 6:
      return "Sat";
    default:
      return "Mon";
  }
}


function addUTCDays(d: Date, n: number): Date {
  const dd = new Date(d);
  dd.setUTCHours(0, 0, 0, 0);
  dd.setUTCDate(dd.getUTCDate() + n);
  return dd;
}

function countUTCDaysInclusive(range: { start: Date; end: Date }) {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((+end - +start) / dayMs) + 1);
}

export function PerformanceWeekdayChart({
  accountId,
  currencyCode,
  ownerId = "performance-weekday",
  comparisonMode,
}: {
  accountId?: string;
  currencyCode?: string | null;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
}) {
  const { start, end, min, max } = useChartDateRange();
  const comparisons = useComparisonStore((s) => s.comparisons);
  const myMode = comparisonMode ?? comparisons[ownerId] ?? "none";
  const resolvedCurrencyCode = useChartCurrencyCode(accountId, currencyCode);
  // Clipped area interaction state
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [axis, setAxis] = React.useState(0);
  const springX = useSpring(0, { damping: 30, stiffness: 100 });
  const springY = useSpring(0, { damping: 30, stiffness: 100 });
  useMotionValueEvent(springX, "change", (latest) => setAxis(latest));
  const [ready, setReady] = React.useState(false);

  // Initialize guide to full width on mount and keep in sync on resize
  React.useEffect(() => {
    const update = () => {
      const w = chartRef.current?.getBoundingClientRect().width || 0;
      if (w > 0) {
        springX.set(w);
        setAxis(w);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [springX]);

  const [primaryAgg, setPrimaryAgg] = React.useState<
    Record<WeekdayKey, number>
  >({} as any);
  const [compareAgg, setCompareAgg] = React.useState<Record<
    WeekdayKey,
    number
  > | null>(null);

  const resolvedRange = React.useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const minD = min ? new Date(min) : undefined;
    const maxD = max ? new Date(max) : undefined;
    minD?.setUTCHours(0, 0, 0, 0);
    maxD?.setUTCHours(0, 0, 0, 0);
    if (!start || !end) {
      const fallbackEnd = maxD ?? new Date();
      const endUTC = new Date(
        Date.UTC(
          fallbackEnd.getUTCFullYear(),
          fallbackEnd.getUTCMonth(),
          fallbackEnd.getUTCDate()
        )
      );
      const startUTC = addUTCDays(endUTC, -6);
      if (minD && startUTC < minD) {
        return { start: minD, end: endUTC };
      }
      return { start: startUTC, end: endUTC };
    }
    const s0 = new Date(start);
    const e0 = new Date(end);
    s0.setUTCHours(0, 0, 0, 0);
    e0.setUTCHours(0, 0, 0, 0);
    const selectedDays = Math.floor((+e0 - +s0) / dayMs) + 1;
    if (selectedDays >= 7) return { start: s0, end: e0 };
    let needed = 7 - selectedDays;
    let newStart = new Date(s0);
    let newEnd = new Date(e0);
    const afterAvail = maxD
      ? Math.max(0, Math.floor((+maxD - +e0) / dayMs))
      : 0;
    const extendFwd = Math.min(needed, afterAvail);
    newEnd.setUTCDate(newEnd.getUTCDate() + extendFwd);
    needed -= extendFwd;
    if (needed > 0) {
      const beforeAvail = minD
        ? Math.max(0, Math.floor((+s0 - +minD) / dayMs))
        : 0;
      const extendBack = Math.min(needed, beforeAvail);
      newStart.setUTCDate(newStart.getUTCDate() - extendBack);
    }
    return { start: newStart, end: newEnd };
  }, [start, end, min, max]);

  const comparisonRange = React.useMemo(() => {
    if (!resolvedRange || myMode === "none") return null;
    const minBound = min ? new Date(min) : null;
    minBound?.setUTCHours(0, 0, 0, 0);
    if (myMode === "thisWeek") {
      if (!max) return null;
      const endMost = new Date(max);
      endMost.setUTCHours(0, 0, 0, 0);
      const startMost = addUTCDays(endMost, -6);
      if (minBound && startMost < minBound) return null;
      return { start: startMost, end: endMost };
    }
    const shiftDays =
      myMode === "lastWeek" ? 7 : countUTCDaysInclusive(resolvedRange);
    const prevStart = addUTCDays(resolvedRange.start, -shiftDays);
    const prevEnd = addUTCDays(resolvedRange.end, -shiftDays);
    if (minBound && prevStart < minBound) return null;
    return { start: prevStart, end: prevEnd };
  }, [max, min, myMode, resolvedRange]);

  React.useEffect(() => {
    (async () => {
      if (!accountId || !resolvedRange) return;
      const data = (await queryClient.fetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId,
          startISO: resolvedRange.start.toISOString(),
          endISO: resolvedRange.end.toISOString(),
          currencyCode: resolvedCurrencyCode,
        }),
        staleTime: 30_000,
      })) as DayPoint[];

      const agg: Record<WeekdayKey, number> = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };
      for (const row of data) {
        const key = weekdayKeyFromISO(row.dateISO);
        agg[key] += row.totalProfit;
      }
      setPrimaryAgg(agg);

      if (!comparisonRange) {
        setCompareAgg(null);
        return;
      }

      const comparisonData = (await queryClient.fetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId,
          startISO: comparisonRange.start.toISOString(),
          endISO: comparisonRange.end.toISOString(),
          currencyCode: resolvedCurrencyCode,
        }),
        staleTime: 30_000,
      })) as DayPoint[];
      const nextCompareAgg: Record<WeekdayKey, number> = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };
      for (const row of comparisonData) {
        const key = weekdayKeyFromISO(row.dateISO);
        nextCompareAgg[key] += row.totalProfit;
      }
      setCompareAgg(nextCompareAgg);
    })();
  }, [accountId, comparisonRange, resolvedCurrencyCode, resolvedRange]);

  const dataForChart = React.useMemo(() => {
    return WEEKDAY_ORDER.map((weekday) => ({
      weekday,
      profit: Number(primaryAgg[weekday] ?? 0),
      compare: Number(compareAgg?.[weekday] ?? 0),
    }));
  }, [primaryAgg, compareAgg]);

  // Symmetric nice scale across both datasets (7 ticks with 0 baseline)
  const niceScale = React.useMemo(() => {
    const values: number[] = [];
    for (const d of dataForChart) {
      if (typeof d.profit === "number") values.push(d.profit);
      if (typeof d.compare === "number") values.push(d.compare);
    }
    const safeValues = values.length ? values : [0];
    const minVal = Math.min(...safeValues);
    const maxVal = Math.max(...safeValues);
    const pad = (v: number) => Math.max(1, Math.abs(v) * 0.08);
    const min =
      minVal >= 0 ? 0 : Math.floor(minVal - pad(minVal));
    const max =
      maxVal <= 0 ? 0 : Math.ceil(maxVal + pad(maxVal));
    const range = Math.max(1, max - min);
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
    const step = niceStep(range / 6);
    const tickStart = Math.ceil(min / step) * step;
    const ticks: number[] = [];
    for (let v = tickStart; v <= max + step * 0.5; v += step) {
      ticks.push(v);
    }
    return { min, max, ticks };
  }, [dataForChart]);

  const currencyTick = (v: number) => {
    return formatSignedCurrency(v, 0, resolvedCurrencyCode);
  };

  // Compute best/worst day from aligned daily data
  const bestWorst = React.useMemo(() => {
    let best: { k: WeekdayKey; v: number } | null = null;
    let worst: { k: WeekdayKey; v: number } | null = null;
    for (let i = 0; i < dataForChart.length; i++) {
      const d = dataForChart[i];
      const total =
        Number(d?.profit ?? 0) + (compareAgg ? Number(d?.compare ?? 0) : 0);
      const k = (d?.weekday as WeekdayKey) || "Mon";
      if (best === null || total > best.v) best = { k, v: total };
      if (worst === null || total < worst.v) worst = { k, v: total };
    }
    return { best, worst };
  }, [dataForChart, compareAgg]);

  const primaryLabel = "Profit";
  const comparisonDays = React.useMemo(() => {
    if (!comparisonRange) return null;
    return countUTCDaysInclusive(resolvedRange);
  }, [comparisonRange, resolvedRange]);
  const comparisonLabel =
    !comparisonRange
      ? undefined
      : myMode === "thisWeek"
      ? "This week"
      : myMode === "lastWeek"
      ? "Last week"
      : myMode === "previous"
      ? comparisonDays === 1
        ? "Previous day"
        : `Previous ${comparisonDays ?? 0} days`
      : undefined;

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {bestWorst.best && bestWorst.worst ? (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Most profitable day:{" "}
              <span className="text-teal-400 font-medium">
                {bestWorst.best.k} ({formatSignedCurrency(bestWorst.best.v, 0, resolvedCurrencyCode)})
              </span>{" "}
              · Least profitable day:{" "}
              <span className="text-rose-400 font-medium">
                {bestWorst.worst.k} ({formatSignedCurrency(bestWorst.worst.v, 0, resolvedCurrencyCode)})
              </span>
            </p>
          ) : (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Weekday performance
            </p>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-visible">
        <ChartContainer
          ref={chartRef}
          config={chartConfig}
          className="w-full h-52 md:h-74 pb-4"
        >
          <AreaChart
            data={dataForChart}
            margin={{ left: 36, right: 0, top: 12, bottom: -4 }}
            onMouseMove={(state: any) => {
              const x = state?.activeCoordinate?.x;
              const payload: any[] = state?.activePayload ?? [];
              // sum unique series values for profit
              const seen = new Set<string>();
              let sum = 0;
              for (const it of payload) {
                const key = String(it?.dataKey ?? "");
                if ((key === "profit" || key === "compare") && !seen.has(key)) {
                  seen.add(key);
                  const v = Number(it?.value ?? 0);
                  if (!Number.isNaN(v)) sum += v;
                }
              }
              if (typeof x === "number") {
                springX.set(x);
                if (seen.size > 0) springY.set(sum);
              }
            }}
            onMouseLeave={() => {
              const w = chartRef.current?.getBoundingClientRect().width || 0;
              springX.set(w);
              const lastProfit = dataForChart.length
                ? dataForChart[dataForChart.length - 1]?.profit ?? 0
                : 0;
              const lastCompare = dataForChart.length
                ? dataForChart[dataForChart.length - 1]?.compare ?? 0
                : 0;
              springY.set(Number(lastProfit) + Number(lastCompare));
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
              dataKey="weekday"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={<WeekdayXAxisTick />}
            />

            {/* ghost lines behind graph */}
            <Area
              type="monotone"
              dataKey="profit"
              fill="none"
              stroke="var(--color-profit)"
              strokeOpacity={0.2}
              dot={false}
              activeDot={false}
            />

            {comparisonLabel ? (
              <Area
                type="monotone"
                dataKey="compare"
                fill="none"
                stroke="#FCA070"
                strokeOpacity={0.2}
                dot={false}
                activeDot={false}
              />
            ) : null}

            <Area
              type="monotone"
              dataKey="profit"
              name={primaryLabel}
              stroke="var(--color-profit)"
              fill="url(#gradient-cliped-area-profit)"
              strokeWidth={1}
              dot={false}
              activeDot={false}
              style={{
                ...(axis > 0
                  ? {
                      clipPath: `inset(0 ${
                        (chartRef.current?.getBoundingClientRect().width || 0) -
                        axis
                      }px 0 0)`,
                    }
                  : {}),
                transition: ready ? "clip-path 220ms ease-out" : "none",
                willChange: "clip-path",
              }}
            />
            {/* vertical guide and value label */}
            <line
              x1={axis}
              y1={0}
              x2={axis}
              y2={"75%"}
              stroke="var(--color-profit)"
              strokeDasharray="3 3"
              strokeLinecap="round"
              strokeOpacity={0.2}
            />
            <rect
              x={axis - 50}
              y={0}
              width={50}
              height={18}
              fill="var(--color-profit)"
            />
            <text
              x={axis - 25}
              fontWeight={600}
              y={13}
              textAnchor="middle"
              fill="var(--primary-foreground)"
            >
              {formatSignedCurrency(springY.get(), 0, resolvedCurrencyCode)}
            </text>

            {comparisonLabel ? (
              <Area
                type="monotone"
                dataKey="compare"
                name={comparisonLabel}
                stroke="#FCA070"
                fill="#FCA070"
                fillOpacity={0.04}
                strokeOpacity={0.8}
                strokeDasharray="3 3"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                style={{
                  ...(axis > 0
                    ? {
                        clipPath: `inset(0 ${
                          (chartRef.current?.getBoundingClientRect().width ||
                            0) - axis
                        }px 0 0)`,
                      }
                    : {}),
                  transition: ready ? "clip-path 220ms ease-out" : "none",
                  willChange: "clip-path",
                }}
              />
            ) : null}

            <CartesianGrid vertical={false} strokeDasharray="8 8" />
            <defs>
              <linearGradient
                id="gradient-cliped-area-profit"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-profit)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-profit)"
                  stopOpacity={0}
                />
                <mask id="mask-cliped-area-chart">
                  <rect
                    x={0}
                    y={0}
                    width={"50%"}
                    height={"100%"}
                    fill="white"
                  />
                </mask>
              </linearGradient>
            </defs>

            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const base = (payload[0]?.payload || {}) as any;
                const headerText =
                  FULL_WEEKDAY_MAP[(base.weekday as WeekdayKey) || "Mon"] ||
                  base.weekday;
                const seen = new Set<string>();
                const entries = (payload as any[]).filter((it) => {
                  const k = String(it.dataKey ?? "");
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
                return (
                  <DashboardChartTooltipFrame title={headerText}>
                    {entries.map((item: any) => {
                      const key = item.dataKey as "profit" | "compare";
                      const v = Number(item.value ?? 0);
                      const dayLabel =
                        FULL_WEEKDAY_MAP[
                          (base.weekday as WeekdayKey) || "Mon"
                        ] || base.weekday;
                      const label =
                        key === "compare"
                          ? `${comparisonLabel || "Comparison"} · ${dayLabel}`
                          : "Profit";
                      return (
                        <DashboardChartTooltipRow
                          key={key}
                          label={label}
                          value={formatSignedCurrency(
                            v,
                            0,
                            resolvedCurrencyCode
                          )}
                          tone={v < 0 ? "negative" : "positive"}
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
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
