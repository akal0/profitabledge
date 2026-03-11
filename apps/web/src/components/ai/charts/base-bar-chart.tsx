"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface BaseBarChartProps {
  data: Array<{ name: string; value: number; [k: string]: any }>;
  height?: number;
  /** "singular" highlights only first bar */
  mode?: "singular" | "plural";
  /** Custom value formatter for Y axis & tooltip */
  formatValue?: (v: number) => string;
  /** Summary line below chart */
  summary?: { best?: { label: string }; worst?: { label: string } };
  className?: string;
}

const defaultFormat = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-$" : "$";
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

export function BaseBarChart({
  data,
  height = 192,
  mode = "plural",
  formatValue: fmt = defaultFormat,
  summary,
  className,
}: BaseBarChartProps) {
  const isSingular = mode === "singular";

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
      </ResponsiveContainer>

      {summary?.best && (
        <div className="mt-2 text-xs text-white/50">
          Best: <span className="text-teal-400">{summary.best.label}</span>
          {summary.worst && (
            <>
              {" "}· Worst:{" "}
              <span className="text-rose-400">{summary.worst.label}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
