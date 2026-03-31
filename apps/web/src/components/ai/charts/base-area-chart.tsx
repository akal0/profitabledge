"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatDisplayCurrency } from "@/lib/format-display";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";

export interface BaseAreaChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number | string;
  /** "daily_pnl" computes cumulative values */
  variant?: "default" | "daily_pnl";
  formatValue?: (v: number) => string;
  gradientId?: string;
  strokeColor?: string;
  className?: string;
}

const defaultFormat = (v: number) => {
  return formatDisplayCurrency(v);
};

export function BaseAreaChart({
  data,
  height,
  variant = "default",
  formatValue: fmt = defaultFormat,
  gradientId = "areaGradient",
  strokeColor = "#2dd4bf",
  className,
}: BaseAreaChartProps) {
  const formatXAxisLabel = React.useCallback((value: any) => {
    const str = String(value);
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
    return str;
  }, []);

  const chartData = React.useMemo(() => {
    if (variant !== "daily_pnl") return data;

    const withDates = data
      .map((r) => {
        const date = r.name ? new Date(r.name) : null;
        return { ...r, date };
      })
      .sort((a, b) => {
        const aTime = a.date?.getTime() ?? 0;
        const bTime = b.date?.getTime() ?? 0;
        return aTime - bTime;
      });

    let running = 0;
    return withDates.map((r) => {
      running += r.value;
      const label =
        r.date && !Number.isNaN(r.date.getTime())
          ? r.date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : r.name;
      return { name: label, value: running };
    });
  }, [data, variant]);

  return (
    <ChartContainer
      config={{ value: { label: "Value", color: strokeColor } }}
      className={cn("mt-auto aspect-auto h-60 w-full md:h-72", className)}
      style={height ? { height } : undefined}
    >
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 8, left: 8, bottom: 4 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
            tickFormatter={formatXAxisLabel}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickMargin={8}
            tickFormatter={fmt}
          />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <DashboardChartTooltipFrame title="Value">
                  <DashboardChartTooltipRow
                    label={d.name}
                    value={fmt(d.value)}
                    tone={d.value >= 0 ? "positive" : "negative"}
                    indicatorColor={strokeColor}
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
          />
        </AreaChart>
    </ChartContainer>
  );
}
