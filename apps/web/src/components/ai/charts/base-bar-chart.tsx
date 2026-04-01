"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatDisplayCurrency } from "@/lib/format-display";
import {
  Bar,
  BarChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";

export interface BaseBarChartProps {
  data: Array<{ name: string; value: number; [k: string]: any }>;
  height?: number | string;
  /** "singular" highlights only first bar */
  mode?: "singular" | "plural";
  /** Custom value formatter for Y axis & tooltip */
  formatValue?: (v: number) => string;
  /** Summary line below chart */
  summary?: { best?: { label: string }; worst?: { label: string } };
  className?: string;
}

const defaultFormat = (v: number) => {
  return formatDisplayCurrency(v);
};

export function BaseBarChart({
  data,
  height,
  mode = "plural",
  formatValue: fmt = defaultFormat,
  summary,
  className,
}: BaseBarChartProps) {
  const isSingular = mode === "singular";

  return (
    <div className="flex h-max w-full flex-col">
      <ChartContainer
        config={{ value: { label: "Value", color: "#2dd4bf" } }}
        className={cn("aspect-auto h-56 w-full md:h-60", className)}
        style={height ? { height } : undefined}
      >
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: 8, bottom: 4 }}
        >
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
                    indicatorColor={d.value >= 0 ? "#2dd4bf" : "#fb7185"}
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.value >= 0 ? "#2dd4bf" : "#fb7185"}
                opacity={isSingular ? (index === 0 ? 1 : 0.2) : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {summary?.best && (
        <div className="mt-2 text-xs text-white/50">
          Highest: <span className="text-teal-400">{summary.best.label}</span>
          {summary.worst && (
            <>
              {" "}· Lowest:{" "}
              <span className="text-rose-400">{summary.worst.label}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
