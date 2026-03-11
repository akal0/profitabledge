"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { APP_RECHARTS_TOOLTIP_CONTENT_STYLE } from "@/components/ui/tooltip";

interface Props {
  data: {
    long: { total: number; wins: number; winRate: number };
    short: { total: number; wins: number; winRate: number };
  };
}

export function BacktestDirectionStats({ data }: Props) {
  const totalTrades = data.long.total + data.short.total;

  if (totalTrades === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No direction data
      </div>
    );
  }

  const pieData = [
    { name: "Long", value: data.long.total, fill: "#00E0C8" },
    { name: "Short", value: data.short.total, fill: "#F76290" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 flex-1 min-h-0">
        <div className="w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={38} strokeWidth={0}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-3 flex-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <span className="text-xs text-white/60">Long</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-white">{data.long.total}</span>
              <span className="text-xs text-white/50">
                {(data.long.winRate * 100).toFixed(0)}% WR
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-xs text-white/60">Short</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-white">{data.short.total}</span>
              <span className="text-xs text-white/50">
                {(data.short.winRate * 100).toFixed(0)}% WR
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
