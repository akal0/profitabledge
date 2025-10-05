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
  ChartTooltipContent,
} from "@/components/ui/chart";
import React from "react";
import { useDateRangeStore } from "@/stores/date-range";
import { useComparisonStore } from "@/stores/comparison";
import { trpcClient } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { useSpring, useMotionValueEvent } from "motion/react";

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

function formatWeekday(d: Date): WeekdayKey {
  const s = d.toLocaleDateString("en-US", { weekday: "short" });
  // Ensure consistent Mon-Sun ordering
  return (s === "Sun" ? "Sun" : s) as WeekdayKey;
}

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

// Use UTC when deriving weekday from a Date to avoid TZ boundary issues
function weekdayKeyFromDateUTC(d: Date): WeekdayKey {
  const day = d.getUTCDay();
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

// Normalize a Date to a UTC YYYY-MM-DD key
function isoDayKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const atMidnight = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
  return atMidnight.toISOString().slice(0, 10);
}

function addUTCDays(d: Date, n: number): Date {
  const dd = new Date(d);
  dd.setUTCHours(0, 0, 0, 0);
  dd.setUTCDate(dd.getUTCDate() + n);
  return dd;
}

export function PerformanceWeekdayChart({
  accountId,
  ownerId = "performance-weekday",
}: {
  accountId?: string;
  ownerId?: string;
}) {
  const { start, end, min, max } = useDateRangeStore();
  const comparisons = useComparisonStore((s) => s.comparisons);
  const myMode = comparisons[ownerId] ?? "none";
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
  const [primaryLatestISO, setPrimaryLatestISO] = React.useState<
    Record<WeekdayKey, string>
  >({} as any);
  const [compareLatestISO, setCompareLatestISO] = React.useState<Record<
    WeekdayKey,
    string
  > | null>(null);

  // Per-date maps to guarantee values align with the actual dates in the chart
  const [primaryByDate, setPrimaryByDate] = React.useState<
    Record<string, number>
  >({});
  const [prevByDate, setPrevByDate] = React.useState<Record<
    string,
    number
  > | null>(null);
  const [thisWeekByDate, setThisWeekByDate] = React.useState<Record<
    string,
    number
  > | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!accountId || !start || !end) return;
      // Compute effective 7-day range when global range < 7
      const dayMs = 24 * 60 * 60 * 1000;
      const s0 = new Date(start);
      const e0 = new Date(end);
      s0.setHours(0, 0, 0, 0);
      e0.setHours(0, 0, 0, 0);
      const selectedDays = Math.floor((+e0 - +s0) / dayMs) + 1;
      let effStart = new Date(s0);
      let effEnd = new Date(e0);
      if (selectedDays < 7) {
        let needed = 7 - selectedDays;
        const minD = min ? new Date(min) : undefined;
        const maxD = max ? new Date(max) : undefined;
        minD?.setHours(0, 0, 0, 0);
        maxD?.setHours(0, 0, 0, 0);
        const beforeAvail = minD
          ? Math.max(0, Math.floor((+s0 - +minD) / dayMs))
          : 0;
        const extendBack = Math.min(needed, beforeAvail);
        effStart.setDate(effStart.getDate() - extendBack);
        needed -= extendBack;
        if (needed > 0) {
          const afterAvail = maxD
            ? Math.max(0, Math.floor((+maxD - +e0) / dayMs))
            : 0;
          const extendFwd = Math.min(needed, afterAvail);
          effEnd.setDate(effEnd.getDate() + extendFwd);
        }
      }
      const data: DayPoint[] = await trpcClient.accounts.recentByDay.query({
        accountId,
        startISO: effStart.toISOString(),
        endISO: effEnd.toISOString(),
      });

      const agg: Record<WeekdayKey, number> = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };
      const latestISO: Record<WeekdayKey, string> = {} as any;
      const present: Set<WeekdayKey> = new Set();
      for (const row of data) {
        const key = weekdayKeyFromISO(row.dateISO);
        agg[key] += row.totalProfit;
        present.add(key);
        const prev = latestISO[key] ? new Date(latestISO[key]) : null;
        const current = new Date(row.dateISO);
        if (!prev || current.getTime() > prev.getTime())
          latestISO[key] = row.dateISO;
      }
      // Build per-date map
      const mapPrimary: Record<string, number> = {};
      for (const row of data) {
        const k = row.dateISO.slice(0, 10);
        mapPrimary[k] = (mapPrimary[k] ?? 0) + Number(row.totalProfit || 0);
      }
      setPrimaryAgg(agg);
      setPrimaryLatestISO(latestISO);
      setPrimaryByDate(mapPrimary);

      if (myMode === "previous") {
        const prevStart = new Date(effStart);
        prevStart.setDate(effStart.getDate() - 7);
        const prevEnd = new Date(effEnd);
        prevEnd.setDate(effEnd.getDate() - 7);
        const prev: DayPoint[] = await trpcClient.accounts.recentByDay.query({
          accountId,
          startISO: prevStart.toISOString(),
          endISO: prevEnd.toISOString(),
        });
        const prevAgg: Record<WeekdayKey, number> = {
          Mon: 0,
          Tue: 0,
          Wed: 0,
          Thu: 0,
          Fri: 0,
          Sat: 0,
          Sun: 0,
        };
        const prevLatestISO: Record<WeekdayKey, string> = {} as any;
        for (const row of prev) {
          const key = weekdayKeyFromISO(row.dateISO);
          // Only include weekdays that are present in the current selection
          if ((present as Set<WeekdayKey>).has(key)) {
            prevAgg[key] += row.totalProfit;
            const prev2 = prevLatestISO[key]
              ? new Date(prevLatestISO[key])
              : null;
            const current = new Date(row.dateISO);
            if (!prev2 || current.getTime() > prev2.getTime())
              prevLatestISO[key] = row.dateISO;
          }
        }
        // Per-date map for previous week
        const mapPrev: Record<string, number> = {};
        for (const row of prev) {
          const k = row.dateISO.slice(0, 10);
          mapPrev[k] = (mapPrev[k] ?? 0) + Number(row.totalProfit || 0);
        }
        setCompareAgg(prevAgg);
        setCompareLatestISO(prevLatestISO);
        setPrevByDate(mapPrev);
        setThisWeekByDate(null);
      } else if (myMode === "thisWeek") {
        if (!max) {
          setCompareAgg(null);
          setCompareLatestISO(null);
          setPrevByDate(null);
          setThisWeekByDate(null);
        } else {
          const endMost = new Date(max);
          endMost.setHours(0, 0, 0, 0);
          const startMost = new Date(endMost);
          startMost.setDate(endMost.getDate() - 6);
          if (min && startMost < min)
            startMost.setTime(new Date(min).getTime());
          const recent: DayPoint[] =
            await trpcClient.accounts.recentByDay.query({
              accountId,
              startISO: startMost.toISOString(),
              endISO: endMost.toISOString(),
            });
          const weekAgg: Record<WeekdayKey, number> = {
            Mon: 0,
            Tue: 0,
            Wed: 0,
            Thu: 0,
            Fri: 0,
            Sat: 0,
            Sun: 0,
          };
          const weekLatestISO: Record<WeekdayKey, string> = {} as any;
          for (const row of recent) {
            const key = weekdayKeyFromISO(row.dateISO);
            if ((present as Set<WeekdayKey>).has(key)) {
              weekAgg[key] += row.totalProfit;
              const prev2 = weekLatestISO[key]
                ? new Date(weekLatestISO[key])
                : null;
              const current = new Date(row.dateISO);
              if (!prev2 || current.getTime() > prev2.getTime())
                weekLatestISO[key] = row.dateISO;
            }
          }
          const mapThis: Record<string, number> = {};
          for (const row of recent) {
            const k = row.dateISO.slice(0, 10);
            mapThis[k] = (mapThis[k] ?? 0) + Number(row.totalProfit || 0);
          }
          setCompareAgg(weekAgg);
          setCompareLatestISO(weekLatestISO);
          setThisWeekByDate(mapThis);
          setPrevByDate(null);
        }
      } else {
        setCompareAgg(null);
        setCompareLatestISO(null);
        setPrevByDate(null);
        setThisWeekByDate(null);
      }
    })();
  }, [
    accountId,
    start?.toISOString(),
    end?.toISOString(),
    min?.toString(),
    max?.toString(),
    myMode,
    ownerId,
  ]);

  // Helper to compute effective range (forward-first, then backward)
  const effectiveRange = React.useMemo(() => {
    if (!start || !end)
      return undefined as { start: Date; end: Date } | undefined;
    const dayMs = 24 * 60 * 60 * 1000;
    const s0 = new Date(start);
    const e0 = new Date(end);
    s0.setHours(0, 0, 0, 0);
    e0.setHours(0, 0, 0, 0);
    const selectedDays = Math.floor((+e0 - +s0) / dayMs) + 1;
    if (selectedDays >= 7) return { start: s0, end: e0 };
    const minD = min ? new Date(min) : undefined;
    const maxD = max ? new Date(max) : undefined;
    minD?.setHours(0, 0, 0, 0);
    maxD?.setHours(0, 0, 0, 0);
    let needed = 7 - selectedDays;
    let newStart = new Date(s0);
    let newEnd = new Date(e0);
    // Prefer forward first
    const afterAvail = maxD
      ? Math.max(0, Math.floor((+maxD - +e0) / dayMs))
      : 0;
    const extendFwd = Math.min(needed, afterAvail);
    newEnd.setDate(newEnd.getDate() + extendFwd);
    needed -= extendFwd;
    if (needed > 0) {
      const beforeAvail = minD
        ? Math.max(0, Math.floor((+s0 - +minD) / dayMs))
        : 0;
      const extendBack = Math.min(needed, beforeAvail);
      newStart.setDate(newStart.getDate() - extendBack);
    }
    return { start: newStart, end: newEnd };
  }, [start, end, min, max]);

  // Build dataset from present weekdays, ordered starting from the selected range's start weekday
  // Chronological dates for the effective range (earliest first)
  const weekDatesSorted = React.useMemo(() => {
    if (!effectiveRange?.start || !effectiveRange?.end) return [] as Date[];
    const s = new Date(effectiveRange.start);
    const e = new Date(effectiveRange.end);
    s.setUTCHours(0, 0, 0, 0);
    e.setUTCHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.floor((+e - +s) / dayMs) + 1);
    const arr: Date[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(s);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + i);
      arr.push(d);
    }
    return arr;
  }, [effectiveRange?.start, effectiveRange?.end]);

  const dataForChart = React.useMemo(() => {
    return weekDatesSorted.map((d) => {
      const key = isoDayKeyUTC(d);
      const weekday = weekdayKeyFromDateUTC(d);
      return {
        day: d.getUTCDate(),
        weekday,
        profit: Number(primaryByDate[key] ?? 0),
        primaryDate: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      } as any;
    });
  }, [weekDatesSorted, primaryByDate]);
  const comparisonDataForChart = React.useMemo(() => {
    if (myMode === "previous" && prevByDate) {
      return weekDatesSorted.map((d) => {
        const prevD = addUTCDays(d, -7);
        const key = isoDayKeyUTC(prevD);
        return {
          day: d.getUTCDate(),
          weekday: weekdayKeyFromDateUTC(d),
          compare: Number(prevByDate[key] ?? 0),
          compareDate: prevD.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        } as any;
      });
    }
    if (myMode === "thisWeek" && thisWeekByDate && max) {
      const endMost = new Date(max);
      endMost.setUTCHours(0, 0, 0, 0);
      const startMost = addUTCDays(endMost, -6);
      const mostRecentDates: Date[] = [];
      for (let i = 0; i < 7; i++)
        mostRecentDates.push(addUTCDays(startMost, i));
      return weekDatesSorted.map((_, i) => {
        const target = mostRecentDates[i];
        const key = isoDayKeyUTC(target);
        return {
          day: weekDatesSorted[i].getUTCDate(),
          weekday: weekdayKeyFromDateUTC(weekDatesSorted[i]),
          compare: Number(thisWeekByDate[key] ?? 0),
          compareDate: target.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        } as any;
      });
    }
    return [] as Array<{ day: number; weekday: string; compare: number }>;
  }, [myMode, weekDatesSorted, prevByDate, thisWeekByDate, max]);

  // Symmetric nice scale across both datasets (7 ticks with 0 baseline)
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
    if (!Number.isFinite(maxAbs) || maxAbs === 0) maxAbs = 100;
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

  // Compute best/worst day from aligned daily data
  const bestWorst = React.useMemo(() => {
    let best: { k: WeekdayKey; v: number } | null = null;
    let worst: { k: WeekdayKey; v: number } | null = null;
    for (let i = 0; i < dataForChart.length; i++) {
      const d = dataForChart[i];
      const c = comparisonDataForChart[i];
      const total = Number(d?.profit ?? 0) + Number(c?.compare ?? 0);
      const k = (d?.weekday as WeekdayKey) || "Mon";
      if (best === null || total > best.v) best = { k, v: total };
      if (worst === null || total < worst.v) worst = { k, v: total };
    }
    return { best, worst };
  }, [dataForChart, comparisonDataForChart]);

  const primaryLabel = "Profit";
  const comparisonLabel =
    myMode === "thisWeek"
      ? "This week"
      : myMode === "previous"
      ? "Previous weekdays"
      : undefined;

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {bestWorst.best && bestWorst.worst ? (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Most profitable day:{" "}
              <span className="text-teal-400 font-medium">
                {bestWorst.best.k} ({bestWorst.best.v < 0 ? "-$" : "$"}
                {Math.abs(bestWorst.best.v).toLocaleString()})
              </span>{" "}
              · Least profitable day:{" "}
              <span className="text-rose-400 font-medium">
                {bestWorst.worst.k} ({bestWorst.worst.v < 0 ? "-$" : "$"}
                {Math.abs(bestWorst.worst.v).toLocaleString()})
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
          className="w-full h-52 md:h-74"
        >
          <AreaChart
            data={
              comparisonDataForChart.length
                ? dataForChart.map((d, i) => ({
                    ...d,
                    compare: comparisonDataForChart[i]?.compare,
                    compareDate: comparisonDataForChart[i]?.compareDate,
                  }))
                : dataForChart
            }
            margin={{ left: 36, right: 0, top: 12, bottom: -4 }}
            onMouseMove={(state: any) => {
              const x = state?.activeCoordinate?.x;
              const payload: any[] = state?.activePayload ?? [];
              // sum unique series values for profit and compare
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
              const lastCompare = comparisonDataForChart.length
                ? comparisonDataForChart[comparisonDataForChart.length - 1]
                    ?.compare ?? 0
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
              dataKey="day"
              tickLine={false}
              tickMargin={20}
              axisLine={false}
              tick={(props: any) => {
                const { x, y, payload } = props || {};
                const idx = payload?.index ?? 0;
                const edgePad = 20;
                const isFirst = idx === 0;
                const isLast = idx === dataForChart.length - 1;
                const dx = isFirst ? edgePad : isLast ? -edgePad : 0;
                const labelText = String(payload?.value ?? "");
                return (
                  <g transform={`translate(${(x ?? 0) + dx},${y ?? 0})`}>
                    <text textAnchor="middle" fill="currentColor">
                      <tspan>{labelText}</tspan>
                    </text>
                  </g>
                );
              }}
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

            {comparisonDataForChart.length > 0 ? (
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
              ${springY.get().toFixed(0)}
            </text>
            {comparisonDataForChart.length > 0 ? (
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
                const hasCompare = (payload as any[]).some(
                  (it) => String(it.dataKey) === "compare"
                );
                const headerText = hasCompare
                  ? base.primaryDate ||
                    base.compareDate ||
                    FULL_WEEKDAY_MAP[(base.weekday as WeekdayKey) || "Mon"] ||
                    base.weekday
                  : base.primaryDate ||
                    FULL_WEEKDAY_MAP[(base.weekday as WeekdayKey) || "Mon"] ||
                    base.weekday;
                // Deduplicate by dataKey (profit/compare) to avoid ghost line duplicates
                const seen = new Set<string>();
                const entries = (payload as any[]).filter((it) => {
                  const k = String(it.dataKey ?? "");
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
                return (
                  <div className="bg-white border-black/10 dark:bg-dashboard-background dark:border-white/10 grid min-w-[16rem] gap-2 border-[0.5px] p-3 px-0 text-xs shadow-xl">
                    <div className="text-[11px] font-medium text-black/80 dark:text-white px-3">
                      {headerText}
                    </div>

                    <div className="h-px bg-black/10 dark:bg-white/10" />

                    <div className="grid gap-2 px-3">
                      {entries.map((item: any) => {
                        const key = item.dataKey as "profit" | "compare";
                        const v = Number(item.value ?? 0);
                        const sign = v < 0 ? "-$" : "$";
                        const rawName =
                          typeof item.name === "string" ? item.name : undefined;
                        const dayLabel =
                          FULL_WEEKDAY_MAP[
                            (base.weekday as WeekdayKey) || "Mon"
                          ] || base.weekday;
                        // Prefer explicit item name only if it's not just the dataKey
                        let label: string;
                        if (
                          rawName &&
                          rawName.toLowerCase() !== String(key).toLowerCase()
                        ) {
                          label = rawName;
                        } else {
                          label =
                            key === "compare"
                              ? `Previous ${dayLabel}`
                              : dayLabel;
                        }
                        return (
                          <div
                            key={key}
                            className={cn(
                              "flex w-full justify-between font-semibold"
                            )}
                          >
                            <span className="text-black dark:text-white/80">
                              {label}
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
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
