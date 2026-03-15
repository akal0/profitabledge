"use client";

import React, { useEffect, useState, useCallback } from "react";
import { trpcClient } from "@/utils/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import {
  Clock,
  History,
  Target,
  TrendingUp,
  BarChart3,
  Activity,
} from "lucide-react";
import { Bar, BarChart, XAxis, Cell, Pie, PieChart } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type OverviewStats = {
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  totalTrades: number;
  totalTimeSeconds: number;
  totalHistoricalSeconds: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  avgRR: number;
  wins: number;
  losses: number;
  longCount: number;
  shortCount: number;
  bySymbol: Record<string, { total: number; wins: number; pnl: number }>;
  sessionsByMonth: Record<string, number>;
};

type SessionOption = {
  id: string;
  name: string;
  symbol: string;
  status: string;
};

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: { value: number; label: string }[] = [];
  if (days > 0) parts.push({ value: days, label: days === 1 ? "day" : "days" });
  if (hours > 0) parts.push({ value: hours, label: hours === 1 ? "hour" : "hours" });
  if (minutes > 0 || parts.length === 0) parts.push({ value: minutes, label: minutes === 1 ? "minute" : "minutes" });
  return parts;
}

function formatHistoricalDuration(seconds: number) {
  const years = Math.floor(seconds / (365.25 * 86400));
  let remaining = seconds - years * 365.25 * 86400;
  const months = Math.floor(remaining / (30.44 * 86400));
  remaining -= months * 30.44 * 86400;
  const weeks = Math.floor(remaining / (7 * 86400));
  remaining -= weeks * 7 * 86400;
  const days = Math.floor(remaining / 86400);

  const parts: { value: number; label: string }[] = [];
  if (years > 0) parts.push({ value: years, label: years === 1 ? "year" : "years" });
  if (months > 0) parts.push({ value: months, label: months === 1 ? "month" : "months" });
  if (weeks > 0) parts.push({ value: weeks, label: weeks === 1 ? "week" : "weeks" });
  if (days > 0) parts.push({ value: days, label: days === 1 ? "day" : "days" });
  if (parts.length === 0) parts.push({ value: 0, label: "days" });
  return parts;
}

const CARD_HEIGHT = "h-[17rem]";

const chartConfig = {
  hours: { label: "Hours", color: "#facc15" },
  buys: { label: "Buys", color: "#00E0C8" },
  sells: { label: "Sells", color: "#F76290" },
} satisfies ChartConfig;

export default function BacktestOverviewPage() {
  const backtestEnabled = isPublicAlphaFeatureEnabled("backtest");

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");

  // Fetch session list for the selector
  useEffect(() => {
    if (!backtestEnabled) {
      return;
    }
    (async () => {
      try {
        const result = await trpcClient.backtest.listSessions.query();
        setSessions(
          (result as any[]).map((s: any) => ({
            id: s.id,
            name: s.name,
            symbol: s.symbol,
            status: s.status,
          }))
        );
      } catch {
        // Silently fail — selector just won't populate
      }
    })();
  }, [backtestEnabled]);

  const fetchStats = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const data = await trpcClient.backtest.getOverviewStats.query(
        sessionId === "all" ? undefined : { sessionId }
      );
      setStats(data);
    } catch (e) {
      console.error("Failed to load overview stats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!backtestEnabled) {
      return;
    }
    fetchStats(selectedSessionId);
  }, [backtestEnabled, selectedSessionId, fetchStats]);

  const handleSessionChange = (value: string) => {
    setSelectedSessionId(value);
  };

  if (!backtestEnabled) {
    return (
      <AlphaFeatureLocked
        feature="backtest"
        title="Backtest is held back in this alpha"
      />
    );
  }

  if (loading) {
    return (
      <main className="p-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Backtesting</h1>
            <p className="text-xs text-white/40 mt-0.5">Your backtesting performance at a glance.</p>
          </div>
        </div>
        <div className="grid gap-1.5 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={cn("bg-sidebar w-full border border-white/5 p-1.5 rounded-sm overflow-hidden", CARD_HEIGHT)}>
              <div className="p-3.5"><Skeleton className="w-32 rounded-sm h-4 bg-sidebar-accent" /></div>
              <div className="bg-sidebar-accent h-full w-full rounded-sm p-3.5">
                <Skeleton className="h-6 w-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="p-6 py-4">
        <h1 className="text-xl font-semibold">Backtesting</h1>
        <p className="text-xs text-white/40 mt-1">Failed to load stats.</p>
      </main>
    );
  }

  // Build chart data
  const monthLabels = Object.keys(stats.sessionsByMonth).sort();
  const timeChartData = monthLabels.map((key) => {
    const [y, m] = key.split("-");
    const date = new Date(Number(y), Number(m) - 1);
    return {
      month: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      hours: Math.round(stats.sessionsByMonth[key] * 10) / 10,
    };
  });

  const symbolData = Object.entries(stats.bySymbol)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([sym, data]) => ({
      symbol: sym,
      buys: data.wins,
      sells: data.total - data.wins,
      total: data.total,
    }));

  const buyPct = stats.totalTrades > 0 ? ((stats.longCount / stats.totalTrades) * 100).toFixed(1) : "0";
  const sellPct = stats.totalTrades > 0 ? ((stats.shortCount / stats.totalTrades) * 100).toFixed(1) : "0";

  return (
    <main className="p-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Backtesting</h1>
          <p className="text-xs text-white/40 mt-0.5">Your backtesting performance at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedSessionId} onValueChange={handleSessionChange}>
            <SelectTrigger size="sm" className="text-xs h-8 w-[180px] bg-sidebar border-white/5 text-white/70">
              <SelectValue placeholder="All sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="truncate">{s.name}</span>
                  <span className="text-white/30 ml-1 text-[10px]">{s.symbol}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/backtest/sessions">
            <Button variant="ghost" className="text-xs h-8 text-white/50 hover:text-white">
              View sessions →
            </Button>
          </Link>
          <Link href="/backtest/replay">
            <Button className="text-xs h-8 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
              New Session
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-1.5 md:grid-cols-3">
        {/* Time Invested */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <Clock className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Time Invested</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full rounded-sm">
            <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
              <div className="flex items-baseline gap-1.5 mb-1">
                {formatDuration(stats.totalTimeSeconds).map((p, i) => (
                  <React.Fragment key={i}>
                    <h1 className="text-2xl font-medium text-teal-400">{p.value}</h1>
                    <span className="text-xs text-white/50 font-medium">{p.label}</span>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs font-medium text-secondary">Total time spent backtesting</p>
            </div>
          </div>
        </div>

        {/* Historical Time Replayed */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <History className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Historical time replayed</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full rounded-sm">
            <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
              <div className="flex items-baseline gap-1.5 mb-1">
                {formatHistoricalDuration(stats.totalHistoricalSeconds).map((p, i) => (
                  <React.Fragment key={i}>
                    <h1 className="text-2xl font-medium text-teal-400">{p.value}</h1>
                    <span className="text-xs text-white/50 font-medium">{p.label}</span>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs font-medium text-secondary">Historical data covered</p>
            </div>
          </div>
        </div>

        {/* Time Invested Chart */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <Clock className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Time Invested</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm min-h-0">
            <div className="flex flex-col p-3.5 h-full justify-end min-h-0">
              {timeChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-full w-full min-h-0">
                  <BarChart data={timeChartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="hours" fill="#facc15" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-end justify-center h-full pb-4">
                  <p className="text-xs text-white/40">No session data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trades Taken */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <Target className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Trades taken</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full rounded-sm">
            <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
              <h1 className="text-2xl font-medium text-teal-400 mb-1">{stats.totalTrades}</h1>
              <div className="flex flex-col gap-2">
                <div className="h-3.5 bg-sidebar rounded-sm overflow-hidden flex">
                  <div className="h-full bg-teal-400" style={{ width: `${buyPct}%` }} />
                  <div className="h-full bg-rose-400" style={{ width: `${sellPct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-teal-400">{buyPct}% buys</span>
                  <span className="text-[10px] text-rose-400">{sellPct}% sells</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/5 mt-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/50">Longs</span>
                    <span className="text-white font-medium">{stats.longCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Shorts</span>
                    <span className="text-white font-medium">{stats.shortCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Win Rate */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <Activity className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Overall win rate</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full rounded-sm">
            <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
              <div className="flex items-baseline gap-1 mb-1">
                <h1 className={cn("text-2xl font-medium", stats.winRate >= 50 ? "text-teal-400" : "text-rose-400")}>
                  {stats.winRate.toFixed(1)}
                </h1>
                <span className="text-xs text-white/50 font-medium">%</span>
              </div>
              <p className="text-xs font-medium text-secondary">Across all sessions</p>
              <div className="pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="px-2 py-1 bg-teal-500">
                      <span className="text-xs text-white font-medium">W</span>
                    </div>
                    <span className="text-xs text-white/70">{stats.wins}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="px-2 py-1 bg-rose-500">
                      <span className="text-xs text-white font-medium">L</span>
                    </div>
                    <span className="text-xs text-white/70">{stats.losses}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Win Rate Pie */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <BarChart3 className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Win Rate</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm min-h-0">
            <div className="flex flex-col p-3.5 h-full justify-end items-center min-h-0">
              {stats.totalTrades > 0 ? (
                <>
                  <ChartContainer config={chartConfig} className="flex-1 w-32 min-h-0">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Wins", value: stats.wins },
                          { name: "Losses", value: stats.losses },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={48}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell fill="#00E0C8" />
                        <Cell fill="#F76290" />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex items-center gap-4 text-xs shrink-0 pt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-teal-400" />
                      <span className="text-white/50">Wins</span>
                      <span className="text-white font-medium">{stats.wins}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-rose-400" />
                      <span className="text-white/50">Losses</span>
                      <span className="text-white font-medium">{stats.losses}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-end justify-center h-full pb-4">
                  <p className="text-xs text-white/40">No trades yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profit Factor */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <TrendingUp className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Profit Factor</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full rounded-sm">
            <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
              <h1 className={cn("text-2xl font-medium mb-1", stats.profitFactor >= 1 ? "text-teal-400" : "text-rose-400")}>
                {stats.profitFactor >= 999 ? "∞" : stats.profitFactor.toFixed(2)}
              </h1>
              <p className="text-xs font-medium text-secondary">
                {stats.profitFactor >= 1.5 ? "Strong edge" : stats.profitFactor >= 1 ? "Positive expectancy" : stats.totalTrades > 0 ? "Negative expectancy" : "No data yet"}
              </p>
              <div className="pt-2 border-t border-white/5 mt-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Sessions</span>
                  <span className="text-white font-medium">{stats.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Completed</span>
                  <span className="text-white font-medium">{stats.completedSessions}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Average R:R */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <Target className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Average R:R</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full rounded-sm">
            <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
              <div className="flex items-baseline gap-1 mb-1">
                <h1 className={cn("text-2xl font-medium", stats.avgRR >= 1 ? "text-teal-400" : stats.totalTrades > 0 ? "text-rose-400" : "text-white/40")}>
                  {stats.totalTrades > 0 ? stats.avgRR.toFixed(2) : "--"}
                </h1>
                {stats.totalTrades > 0 && <span className="text-xs text-white/50 font-medium">R</span>}
              </div>
              <p className="text-xs font-medium text-secondary">Average risk-to-reward ratio</p>
              <div className="pt-2 border-t border-white/5 mt-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Total P&L</span>
                  <span className={cn("font-medium", stats.totalPnL >= 0 ? "text-teal-400" : "text-rose-400")}>
                    {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Active</span>
                  <span className="text-teal-400 font-medium">{stats.activeSessions}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trades by Symbol */}
        <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", CARD_HEIGHT)}>
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <BarChart3 className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">Trades by symbol</h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm min-h-0">
            <div className="flex flex-col p-3.5 h-full justify-end min-h-0">
              {symbolData.length > 0 ? (
                <>
                  <div className="flex flex-col gap-2">
                    {symbolData.map((s) => {
                      const maxTotal = Math.max(...symbolData.map((d) => d.total), 1);
                      const pct = (s.total / maxTotal) * 100;
                      return (
                        <div key={s.symbol} className="flex items-center gap-2">
                          <div className="w-16 truncate text-xs text-white/40 font-mono">{s.symbol}</div>
                          <div className="flex-1 h-3.5 bg-sidebar rounded-sm overflow-hidden flex">
                            <div className="h-full bg-teal-400" style={{ width: `${(s.buys / Math.max(s.total, 1)) * pct}%` }} />
                            <div className="h-full bg-rose-400" style={{ width: `${(s.sells / Math.max(s.total, 1)) * pct}%` }} />
                          </div>
                          <div className="w-8 text-xs text-white/70 text-right font-medium">{s.total}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-white/40 pt-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-teal-400" />
                      <span>Wins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-rose-400" />
                      <span>Losses</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-end justify-center pb-4">
                  <p className="text-xs text-white/40">No symbol data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
