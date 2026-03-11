"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

import {
  APP_RECHARTS_TOOLTIP_CONTENT_STYLE,
  APP_RECHARTS_TOOLTIP_LABEL_STYLE,
} from "@/components/ui/tooltip";

interface Props {
  data: Record<number, { wins: number; losses: number }>;
}

export function BacktestHourlyChart({ data }: Props) {
  const chartData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    wins: data[hour]?.wins ?? 0,
    losses: data[hour]?.losses ?? 0,
  })).filter((d) => d.wins > 0 || d.losses > 0);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No hourly data
      </div>
    );
  }

  const bestHour = chartData.reduce((best, d) => {
    const wr = d.wins + d.losses > 0 ? d.wins / (d.wins + d.losses) : 0;
    const bestWr = best.wins + best.losses > 0 ? best.wins / (best.wins + best.losses) : 0;
    return wr > bestWr && d.wins + d.losses >= 3 ? d : best;
  }, chartData[0]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-lg font-semibold text-teal-400">{bestHour.hour}</span>
        <span className="text-sm font-medium text-white/60">Best hour</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="hour" tick={{ fill: "#ffffff60", fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} width={20} />
            <Tooltip
              contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
              labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
            />
            <Bar dataKey="wins" stackId="a" fill="#00E0C8" radius={[0, 0, 0, 0]} name="Wins" />
            <Bar dataKey="losses" stackId="a" fill="#F76290" radius={[2, 2, 0, 0]} name="Losses" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
