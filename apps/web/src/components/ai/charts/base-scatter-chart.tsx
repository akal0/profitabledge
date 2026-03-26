"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ZAxis,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";

export interface BaseScatterChartProps {
  data: Array<{ x: number; y: number; label?: string; [k: string]: any }>;
  height?: number | string;
  xLabel?: string;
  yLabel?: string;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  color?: string;
  className?: string;
}

const defaultFormat = (v: number) => v.toFixed(2);

export function BaseScatterChart({
  data,
  height = "100%",
  xLabel,
  yLabel,
  formatX = defaultFormat,
  formatY = defaultFormat,
  color = "#2dd4bf",
  className,
}: BaseScatterChartProps) {
  return (
    <ChartContainer
      config={{ points: { label: yLabel || "Value", color } }}
      className={cn("aspect-auto w-full min-h-[18rem] flex-1", className)}
      style={{ height }}
    >
        <ScatterChart margin={{ top: 12, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
          />
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatX}
            name={xLabel}
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickMargin={8}
            tickFormatter={formatY}
            name={yLabel}
          />
          <ZAxis range={[40, 40]} />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <DashboardChartTooltipFrame title={d.label || "Point"}>
                  {xLabel ? (
                    <DashboardChartTooltipRow
                      label={xLabel}
                      value={formatX(d.x)}
                      indicatorColor={color}
                    />
                  ) : null}
                  {yLabel ? (
                    <DashboardChartTooltipRow
                      label={yLabel}
                      value={formatY(d.y)}
                      indicatorColor={color}
                    />
                  ) : null}
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Scatter data={data} fill={color} opacity={0.7} />
        </ScatterChart>
    </ChartContainer>
  );
}
