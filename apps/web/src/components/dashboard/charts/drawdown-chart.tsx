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
  drawdown: {
    label: "Drawdown",
    color: "#F76290",
  },
} satisfies ChartConfig;

type DataPoint = {
  date: string;
  drawdown: number;
  drawdownPercent: number;
  timestamp: number;
};

export function DrawdownChart({ accountId }: { accountId?: string }) {
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

  const { data, maxDrawdown, maxDrawdownPercent } = React.useMemo(() => {
    if (!resolvedRange) {
      return {
        data: [] as DataPoint[],
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
      };
    }

    let runningEquity = initialBalance;
    let peakEquity = initialBalance;
    let absoluteMaxDrawdown = 0;
    let absoluteMaxDrawdownPercent = 0;
    const points: DataPoint[] = [
      {
        date: resolvedRange.start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        drawdown: 0,
        drawdownPercent: 0,
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
      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }

      const drawdown = peakEquity - runningEquity;
      const drawdownPercent =
        peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;

      if (drawdown > absoluteMaxDrawdown) {
        absoluteMaxDrawdown = drawdown;
        absoluteMaxDrawdownPercent = drawdownPercent;
      }

      points.push({
        date: new Date(trade.close || 0).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        drawdown: -drawdown,
        drawdownPercent: -drawdownPercent,
        timestamp: new Date(trade.close || 0).getTime(),
      });
    });

    return {
      data: points,
      maxDrawdown: absoluteMaxDrawdown,
      maxDrawdownPercent: absoluteMaxDrawdownPercent,
    };
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

  const yMin = Math.min(...data.map((point) => point.drawdownPercent), -1);
  const yTicks = [0, yMin * 0.25, yMin * 0.5, yMin * 0.75, yMin].map((value) =>
    Number(value.toFixed(2))
  );

  return (
    <Card className="h-full w-full rounded-none border-none bg-transparent shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="-mt-3">
          <p className="text-sm font-normal tracking-wide text-white/40">
            In the selected days, your maximum drawdown reached{" "}
            <span className="font-medium text-rose-400">
              {formatSignedPercent(-maxDrawdownPercent)}
            </span>
            {" "}({formatSignedCurrency(-maxDrawdown, 2)}).
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-3">
        <ChartContainer config={chartConfig} className="h-52 w-full md:h-74">
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 32, bottom: 18 }}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F76290" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F76290" stopOpacity={0} />
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
              domain={[yMin, 0]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as DataPoint;
                const percent = Number(payload[0].value ?? 0);
                return (
                  <DashboardChartTooltipFrame title={point.date}>
                    <DashboardChartTooltipRow
                      label="Drawdown"
                      value={`${Math.abs(percent).toFixed(2)}% underwater`}
                      tone="negative"
                    />
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
              activeDot={{ r: 4, fill: "#F76290" }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
