"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ZAxis,
} from "recharts";

export interface BaseScatterChartProps {
  data: Array<{ x: number; y: number; label?: string; [k: string]: any }>;
  height?: number;
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
  height = 192,
  xLabel,
  yLabel,
  formatX = defaultFormat,
  formatY = defaultFormat,
  color = "#2dd4bf",
  className,
}: BaseScatterChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            tickFormatter={formatY}
            name={yLabel}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-dashboard-background border border-white/10 rounded px-3 py-2 shadow-xl text-xs">
                  {d.label && (
                    <p className="text-white/70 mb-1">{d.label}</p>
                  )}
                  {xLabel && (
                    <p className="text-white/50">
                      {xLabel}: <span className="text-white">{formatX(d.x)}</span>
                    </p>
                  )}
                  {yLabel && (
                    <p className="text-white/50">
                      {yLabel}: <span className="text-white">{formatY(d.y)}</span>
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Scatter data={data} fill={color} opacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
