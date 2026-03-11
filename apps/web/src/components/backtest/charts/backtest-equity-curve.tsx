"use client";

import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltipContent,
  ChartTooltip,
} from "@/components/ui/chart";

const chartConfig = {
  equity: { label: "Equity", color: "#00E0C8" },
} satisfies ChartConfig;

interface Props {
  data: { time: string; equity: number; tradeIndex: number }[];
}

export function BacktestEquityCurve({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        Not enough data
      </div>
    );
  }

  const startEquity = data[0].equity;
  const endEquity = data[data.length - 1].equity;
  const pnl = endEquity - startEquity;
  const pnlPct = startEquity > 0 ? (pnl / startEquity) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className={`text-2xl font-semibold ${pnl >= 0 ? "text-teal-400" : "text-rose-400"}`}>
          {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </span>
        <span className="text-sm font-medium text-white/60">
          ${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="btEquityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00E0C8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00E0C8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="tradeIndex" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickFormatter={(v) => `#${v}`} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={50} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />} />
          <Area type="monotone" dataKey="equity" stroke="#00E0C8" strokeWidth={2} fill="url(#btEquityGrad)" dot={false} activeDot={{ r: 3, fill: "#00E0C8" }} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
