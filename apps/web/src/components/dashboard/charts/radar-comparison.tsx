"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/stores/account";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import { Skeleton } from "../../ui/skeleton";
import {
  createSymbolGroupDisplayMap,
  getSymbolGroupKey,
} from "@/lib/symbol-grouping";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

export type RadarGroupBy = "session" | "symbol";

const COLORS = [
  "#34d399",
  "#818cf8",
  "#fbbf24",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
];
const AXES = [
  "Win Rate",
  "Avg RR",
  "Profit Factor",
  "Consistency",
  "Trade Count",
];

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function formatRadarRawValue(axis: string, value: number) {
  switch (axis) {
    case "Win Rate":
    case "Consistency":
      return `${value.toFixed(1)}%`;
    case "Avg RR":
      return `${value.toFixed(2)}R`;
    case "Trade Count":
      return `${Math.round(value).toLocaleString()} trades`;
    default:
      return value.toFixed(2);
  }
}

export function RadarComparisonChart({
  accountId,
  groupBy = "session",
}: {
  accountId?: string;
  groupBy?: RadarGroupBy;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;
  const { trades, isLoading } = useChartTrades(effectiveAccountId);

  const { chartData, groups } = useMemo(() => {
    if (trades.length === 0) {
      return { chartData: [] as Record<string, any>[], groups: [] as string[] };
    }

    const symbolDisplayMap = createSymbolGroupDisplayMap(trades);
    const buckets: Record<string, any[]> = {};
    for (const trade of trades) {
      const key =
        groupBy === "session"
          ? trade.sessionTag || "Untagged"
          : symbolDisplayMap.get(getSymbolGroupKey(trade)) || "Unknown";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(trade);
    }

    const sortedGroups = Object.entries(buckets)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6);

    const rawStats: Record<
      string,
      {
        winRate: number;
        avgRR: number;
        pf: number;
        consistency: number;
        count: number;
      }
    > = {};
    const ranges = {
      winRate: { min: Infinity, max: -Infinity },
      avgRR: { min: Infinity, max: -Infinity },
      pf: { min: Infinity, max: -Infinity },
      consistency: { min: Infinity, max: -Infinity },
      count: { min: Infinity, max: -Infinity },
    };

    for (const [name, groupTrades] of sortedGroups) {
      const pnls = groupTrades.map((trade) =>
        parseFloat(trade.profit?.toString() || "0")
      );
      const rrs = groupTrades
        .map((trade) => parseFloat(trade.realisedRR?.toString() || "0"))
        .filter((value) => Number.isFinite(value));
      const wins = pnls.filter((value) => value > 0);
      const losses = pnls.filter((value) => value < 0);
      const grossWin = wins.reduce((sum, value) => sum + value, 0);
      const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));

      const stats = {
        winRate: (wins.length / Math.max(pnls.length, 1)) * 100,
        avgRR:
          rrs.length > 0
            ? rrs.reduce((sum, value) => sum + value, 0) / rrs.length
            : 0,
        pf: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 5 : 0,
        consistency: (wins.length / Math.max(pnls.length, 1)) * 100,
        count: groupTrades.length,
      };
      rawStats[name] = stats;

      for (const key of [
        "winRate",
        "avgRR",
        "pf",
        "consistency",
        "count",
      ] as const) {
        ranges[key].min = Math.min(ranges[key].min, stats[key]);
        ranges[key].max = Math.max(ranges[key].max, stats[key]);
      }
    }

    const data = AXES.map((axis, axisIndex) => {
      const entry: Record<string, any> = { axis };
      for (const [name] of sortedGroups) {
        const stats = rawStats[name];
        switch (axisIndex) {
          case 0:
            entry[name] = normalize(
              stats.winRate,
              ranges.winRate.min,
              ranges.winRate.max
            );
            entry[`${name}Raw`] = stats.winRate;
            break;
          case 1:
            entry[name] = normalize(
              stats.avgRR,
              ranges.avgRR.min,
              ranges.avgRR.max
            );
            entry[`${name}Raw`] = stats.avgRR;
            break;
          case 2:
            entry[name] = normalize(stats.pf, ranges.pf.min, ranges.pf.max);
            entry[`${name}Raw`] = stats.pf;
            break;
          case 3:
            entry[name] = normalize(
              stats.consistency,
              ranges.consistency.min,
              ranges.consistency.max
            );
            entry[`${name}Raw`] = stats.consistency;
            break;
          case 4:
            entry[name] = normalize(
              stats.count,
              ranges.count.min,
              ranges.count.max
            );
            entry[`${name}Raw`] = stats.count;
            break;
        }
      }
      return entry;
    });

    return { chartData: data, groups: sortedGroups.map(([name]) => name) };
  }, [groupBy, trades]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (trades.length < 10) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Need at least 10 trades for strategy radar
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 py-2">
      <div className="flex items-center text-sm font-normal tracking-wide text-white/40">
        Comparing the top {groups.length} {groupBy} groups across win rate,
        average RR, profit factor, consistency and count.
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={chartData}
            cx="50%"
            cy="45%"
            outerRadius="82%"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <RechartsTooltip
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const axis = String(label ?? payload[0].payload.axis);
                return (
                  <DashboardChartTooltipFrame title={axis}>
                    {payload.map((item) => {
                      const rawValue = Number(
                        item.payload?.[`${String(item.dataKey)}Raw`] ?? item.value ?? 0
                      );
                      return (
                        <DashboardChartTooltipRow
                          key={String(item.dataKey)}
                          label={String(item.name)}
                          value={formatRadarRawValue(axis, rawValue)}
                          tone="default"
                        />
                      );
                    })}
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            {groups.map((name, index) => (
              <Radar
                key={name}
                name={name}
                dataKey={name}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.1}
                strokeWidth={1.75}
              />
            ))}
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{
                fontSize: 10,
                color: "rgba(255,255,255,0.55)",
                paddingTop: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
