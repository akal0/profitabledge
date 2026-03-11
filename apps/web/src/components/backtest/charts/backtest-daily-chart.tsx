"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

import {
  APP_RECHARTS_TOOLTIP_CONTENT_STYLE,
  APP_RECHARTS_TOOLTIP_LABEL_STYLE,
} from "@/components/ui/tooltip";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  data: Record<number, { wins: number; losses: number }>;
}

export function BacktestDailyChart({ data }: Props) {
  const chartData = dayLabels.map((label, i) => ({
    day: label,
    wins: data[i]?.wins ?? 0,
    losses: data[i]?.losses ?? 0,
    total: (data[i]?.wins ?? 0) + (data[i]?.losses ?? 0),
    winRate: (data[i]?.wins ?? 0) + (data[i]?.losses ?? 0) > 0
      ? ((data[i]?.wins ?? 0) / ((data[i]?.wins ?? 0) + (data[i]?.losses ?? 0))) * 100
      : 0,
  })).filter((d) => d.total > 0);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No daily data
      </div>
    );
  }

  const bestDay = chartData.reduce((best, d) =>
    d.winRate > best.winRate && d.total >= 3 ? d : best, chartData[0]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-lg font-semibold text-teal-400">{bestDay.day}</span>
        <span className="text-sm font-medium text-white/60">Best day ({bestDay.winRate.toFixed(0)}% WR)</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="day" tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} width={20} />
            <Tooltip
              contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
              labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
            />
            <Bar dataKey="wins" stackId="a" fill="#00E0C8" name="Wins" />
            <Bar dataKey="losses" stackId="a" fill="#F76290" radius={[2, 2, 0, 0]} name="Losses" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
