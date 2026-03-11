"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface BaseAreaChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  /** "daily_pnl" computes cumulative values */
  variant?: "default" | "daily_pnl";
  formatValue?: (v: number) => string;
  gradientId?: string;
  strokeColor?: string;
  className?: string;
}

const defaultFormat = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-$" : "$";
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

export function BaseAreaChart({
  data,
  height = 192,
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
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 12, left: 24, bottom: 8 }}
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
            width={36}
            tickMargin={8}
            tickFormatter={fmt}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-dashboard-background border border-white/10 rounded px-3 py-2 shadow-xl">
                  <p className="text-white/70 text-xs">{d.name}</p>
                  <p
                    className={cn(
                      "font-semibold",
                      d.value >= 0 ? "text-teal-400" : "text-rose-400"
                    )}
                  >
                    {fmt(d.value)}
                  </p>
                </div>
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
      </ResponsiveContainer>
    </div>
  );
}
