"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";

import {
  APP_RECHARTS_TOOLTIP_CONTENT_STYLE,
  APP_RECHARTS_TOOLTIP_LABEL_STYLE,
} from "@/components/ui/tooltip";

interface Trade {
  pnl: number;
}

interface Props {
  trades: Trade[];
}

export function BacktestStreakChart({ trades }: Props) {
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No trade data
      </div>
    );
  }

  // Calculate streaks
  const streaks: { type: "win" | "loss"; length: number }[] = [];
  let currentType: "win" | "loss" | null = null;
  let currentLength = 0;

  for (const trade of trades) {
    const isWin = trade.pnl > 0;
    const type = isWin ? "win" : "loss";

    if (type === currentType) {
      currentLength++;
    } else {
      if (currentType !== null) {
        streaks.push({ type: currentType, length: currentLength });
      }
      currentType = type;
      currentLength = 1;
    }
  }
  if (currentType !== null) {
    streaks.push({ type: currentType, length: currentLength });
  }

  // Build histogram of streak lengths
  const streakCounts: Record<string, { winStreaks: number; lossStreaks: number }> = {};
  for (const s of streaks) {
    const key = String(s.length);
    if (!streakCounts[key]) streakCounts[key] = { winStreaks: 0, lossStreaks: 0 };
    if (s.type === "win") streakCounts[key].winStreaks++;
    else streakCounts[key].lossStreaks++;
  }

  const chartData = Object.entries(streakCounts)
    .map(([length, counts]) => ({
      length: `${length}`,
      winStreaks: counts.winStreaks,
      lossStreaks: counts.lossStreaks,
    }))
    .sort((a, b) => parseInt(a.length) - parseInt(b.length));

  const maxWinStreak = Math.max(...streaks.filter((s) => s.type === "win").map((s) => s.length), 0);
  const maxLoseStreak = Math.max(...streaks.filter((s) => s.type === "loss").map((s) => s.length), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-lg font-semibold text-teal-400">{maxWinStreak}W</span>
        <span className="text-lg font-semibold text-rose-400">{maxLoseStreak}L</span>
        <span className="text-sm font-medium text-white/60">Max streaks</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="length" tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "Streak Length", position: "insideBottom", offset: -2, fill: "#ffffff40", fontSize: 10 }} />
            <YAxis tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} width={20} />
            <Tooltip
              contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
              labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
            />
            <Bar dataKey="winStreaks" fill="#00E0C8" name="Win Streaks" radius={[2, 2, 0, 0]} />
            <Bar dataKey="lossStreaks" fill="#F76290" name="Loss Streaks" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
