"use client";

import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltipContent,
  ChartTooltip,
} from "@/components/ui/chart";

const chartConfig = {
  drawdown: { label: "Drawdown", color: "#F76290" },
} satisfies ChartConfig;

interface Props {
  data: { time: string; drawdown: number; drawdownPercent: number }[];
}

export function BacktestDrawdownChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        Not enough data
      </div>
    );
  }

  const maxDD = Math.max(...data.map((d) => d.drawdownPercent));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-2xl font-semibold text-rose-400">
          -{maxDD.toFixed(2)}%
        </span>
        <span className="text-sm font-medium text-white/60">Max drawdown</span>
      </div>
      <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="btDDGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F76290" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F76290" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" hide />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={40} tickFormatter={(v) => `-${Math.abs(v).toFixed(0)}%`} reversed />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(2)}% underwater`} />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="drawdownPercent" stroke="#F76290" strokeWidth={2} fill="url(#btDDGrad)" dot={false} activeDot={{ r: 3, fill: "#F76290" }} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
