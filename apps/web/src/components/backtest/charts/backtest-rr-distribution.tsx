"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";

import {
  APP_RECHARTS_TOOLTIP_CONTENT_STYLE,
  APP_RECHARTS_TOOLTIP_LABEL_STYLE,
} from "@/components/ui/tooltip";

interface Props {
  data: number[]; // array of RR values
}

export function BacktestRRDistribution({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No R-multiple data
      </div>
    );
  }

  const minR = Math.floor(Math.min(...data));
  const maxR = Math.ceil(Math.max(...data));
  const binSize = 0.5;
  const bins: Record<string, number> = {};

  for (let r = minR; r <= maxR; r += binSize) {
    bins[r.toFixed(1)] = 0;
  }

  data.forEach((r) => {
    const binIndex = Math.floor(r / binSize) * binSize;
    const label = binIndex.toFixed(1);
    if (bins[label] !== undefined) bins[label]++;
  });

  const chartData = Object.entries(bins).map(([label, count]) => ({
    rMultiple: parseFloat(label),
    label,
    count,
    fill: parseFloat(label) >= 0 ? "#00E0C8" : "#F76290",
  }));

  const avgR = data.reduce((s, r) => s + r, 0) / data.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className={`text-2xl font-semibold ${avgR >= 0 ? "text-teal-400" : "text-rose-400"}`}>
          {avgR >= 0 ? "+" : ""}{avgR.toFixed(2)}R
        </span>
        <span className="text-sm font-medium text-white/60">Average</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="label" tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
            <Tooltip
              contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
              labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
              formatter={(value: any) => [`${value} trades`, "Count"]}
            />
            <ReferenceLine x="0.0" stroke="#ef4444" strokeWidth={1.5} />
            <Bar dataKey="count" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
