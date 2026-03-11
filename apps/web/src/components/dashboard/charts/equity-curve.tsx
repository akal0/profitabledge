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
import { useDateRangeStore } from "@/stores/date-range";
import { trpcOptions } from "@/utils/trpc";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
  formatSignedPercent,
} from "./dashboard-chart-ui";
import { useChartTrades } from "./use-chart-trades";

const chartConfig = {
  equity: {
    label: "Equity",
    color: "#00E0C8",
  },
} satisfies ChartConfig;

type DataPoint = {
  date: string;
  equity: number;
  timestamp: number;
};

export function EquityCurveChart({ accountId }: { accountId?: string }) {
  const { start, end, min, max } = useDateRangeStore();

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
            startISO: resolvedRange.start.toISOString(),
            endISO: resolvedRange.end.toISOString(),
          }
        : undefined,
    [resolvedRange]
  );

  const { trades, isLoading: tradesLoading } = useChartTrades(
    accountId,
    rangeOverride
  );

  const { data: statsData, isLoading: statsLoading } = useQuery({
    ...trpcOptions.accounts.stats.queryOptions({ accountId: accountId || "" }),
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

  const data = React.useMemo(() => {
    if (!resolvedRange) return [];

    let runningEquity = initialBalance;
    const points: DataPoint[] = [
      {
        date: resolvedRange.start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        equity: runningEquity,
        timestamp: resolvedRange.start.getTime(),
      },
    ];

    const sortedTrades = [...trades]
      .filter((trade) => trade.close && trade.profit != null)
      .sort(
        (a, b) =>
          new Date(a.close || 0).getTime() - new Date(b.close || 0).getTime()
      );

    sortedTrades.forEach((trade) => {
      runningEquity += Number(trade.profit ?? 0);
      points.push({
        date: new Date(trade.close || 0).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        equity: runningEquity,
        timestamp: new Date(trade.close || 0).getTime(),
      });
    });

    return points;
  }, [initialBalance, resolvedRange, trades]);

  const loading = tradesLoading || statsLoading;

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

  const allEquityValues = data.map((point) => point.equity);
  const minEquity = Math.min(...allEquityValues, initialBalance);
  const maxEquity = Math.max(...allEquityValues, initialBalance);
  const equityRange = maxEquity - minEquity;
  const padding = equityRange > 0 ? equityRange * 0.1 : Math.max(initialBalance * 0.05, 100);
  const yMin = Math.max(0, minEquity - padding);
  const yMax = maxEquity + padding;
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Number((yMin + ((yMax - yMin) / 4) * index).toFixed(2))
  );

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
            {" "}({formatSignedCurrency(netChange, 2)}).
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-3">
        <ChartContainer config={chartConfig} className="h-52 w-full md:h-74">
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 32, bottom: 18 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00E0C8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00E0C8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickFormatter={(value) => formatSignedCurrency(value, 0)}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as DataPoint;
                const value = Number(payload[0].value ?? 0);
                return (
                  <DashboardChartTooltipFrame title={point.date}>
                    <DashboardChartTooltipRow
                      label="Equity"
                      value={formatSignedCurrency(value, 2)}
                      tone={value >= 0 ? "positive" : "negative"}
                    />
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
              activeDot={{ r: 4, fill: "#00E0C8" }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
