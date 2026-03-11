"use client";

import React, { useEffect, useState, useCallback } from "react";
import { trpcClient } from "@/utils/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { BacktestEquityCurve } from "@/components/backtest/charts/backtest-equity-curve";
import { BacktestDrawdownChart } from "@/components/backtest/charts/backtest-drawdown-chart";
import { BacktestRRDistribution } from "@/components/backtest/charts/backtest-rr-distribution";
import { BacktestMaeMfeScatter } from "@/components/backtest/charts/backtest-mae-mfe-scatter";
import { BacktestHourlyChart } from "@/components/backtest/charts/backtest-hourly-chart";
import { BacktestDailyChart } from "@/components/backtest/charts/backtest-daily-chart";
import { BacktestStreakChart } from "@/components/backtest/charts/backtest-streak-chart";
import { BacktestDirectionStats } from "@/components/backtest/charts/backtest-direction-stats";

type SessionOption = { id: string; name: string; symbol: string; status: string };

type AnalyticsData = {
  stats: {
    totalTradesNum: number;
    winRate: string;
    profitFactor: string;
    sharpeRatio: string;
    averageRR: string;
    maxDrawdownPercent: string;
    totalPnL: string;
    totalPnLPercent: string;
    averageWin: string;
    averageLoss: string;
    largestWin: string;
    largestLoss: string;
    longestWinStreak: number;
    longestLoseStreak: number;
    averageHoldTimeSeconds: number;
    finalBalance: string;
    winningTrades: number;
    losingTrades: number;
  };
  equityCurve: { time: string; equity: number; tradeIndex: number }[];
  drawdownSeries: { time: string; drawdown: number; drawdownPercent: number }[];
  rrDistribution: number[];
  mfeMae: { mfe: number; mae: number; pnl: number; direction: string }[];
  byHour: Record<number, { wins: number; losses: number }>;
  byDay: Record<number, { wins: number; losses: number }>;
  directionStats: {
    long: { total: number; wins: number; winRate: number };
    short: { total: number; wins: number; winRate: number };
  };
  trades: any[];
};

type DriftItem = {
  dimension: string;
  label: string;
  liveValue: number;
  backtestValue: number;
  percentChange: number;
  direction: "higher" | "lower" | "similar";
  severity: "significant" | "moderate" | "minor";
  insight: string;
};

type ComparisonData = {
  driftItems: DriftItem[];
  overallDriftScore: number;
  summary: string;
};

const CARD_HEIGHT = "h-[20rem]";

function WidgetCard({
  icon: Icon,
  title,
  children,
  className,
  heightClass,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
  heightClass?: string;
}) {
  return (
    <div className={cn("bg-sidebar w-full border border-white/5 p-1.5 flex flex-col rounded-sm group overflow-hidden", heightClass ?? CARD_HEIGHT, className)}>
      <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
        <Icon className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
        <h2 className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">{title}</h2>
      </div>
      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col h-full w-full rounded-sm overflow-hidden">
        <div className="flex flex-col p-3.5 h-full">
          {children}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-sm font-medium text-white">
        {value}{suffix}
      </span>
    </div>
  );
}

export default function BacktestAnalyticsPage() {
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // Fetch sessions for selector
  useEffect(() => {
    (async () => {
      try {
        const result = await trpcClient.backtest.listSessions.query();
        setSessions(result.map((s: any) => ({
          id: s.id, name: s.name, symbol: s.symbol, status: s.status,
        })));
      } catch {}
    })();
  }, []);

  // Fetch accounts for comparison
  useEffect(() => {
    (async () => {
      try {
        const result = await trpcClient.accounts.list.query();
        setAccounts(result.map((a: any) => ({ id: a.id, name: a.name || a.accountNumber || a.id })));
        if (result.length > 0 && !selectedAccount) setSelectedAccount(result[0].id);
      } catch {}
    })();
  }, []);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const input = selectedSession === "all" ? undefined : { sessionId: selectedSession };
      const data = await trpcClient.backtest.getAggregateAnalytics.query(input);
      setAnalytics(data as AnalyticsData);
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Run comparison
  const runComparison = async () => {
    if (!selectedAccount) return;
    setComparisonLoading(true);
    try {
      const result = await trpcClient.backtest.compareToLive.query({
        accountId: selectedAccount,
        sessionId: selectedSession === "all" ? undefined : selectedSession,
      });
      setComparison(result as ComparisonData);
    } catch (e) {
      console.error("Comparison failed:", e);
    } finally {
      setComparisonLoading(false);
    }
  };

  return (
    <main className="p-6 py-4 h-full overflow-y-auto">
      {/* Header + Session Selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Performance analytics across your backtesting sessions.
          </p>
        </div>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select session" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.symbol})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className={cn("rounded-sm bg-sidebar", CARD_HEIGHT)} />
          ))}
        </div>
      ) : !analytics || analytics.stats.totalTradesNum === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <BarChart3 className="size-12 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-lg font-medium">No analytics data yet</p>
            <p className="text-sm text-muted-foreground">
              Complete some backtest sessions with trades to see analytics.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Equity Curve */}
            <WidgetCard icon={TrendingUp} title="Equity Curve">
              <BacktestEquityCurve data={analytics.equityCurve} />
            </WidgetCard>

            {/* Drawdown */}
            <WidgetCard icon={TrendingDown} title="Drawdown">
              <BacktestDrawdownChart data={analytics.drawdownSeries} />
            </WidgetCard>

            {/* Key Stats */}
            <WidgetCard icon={Target} title="Key Statistics">
              <div className="flex flex-col h-full justify-center">
                <StatRow label="Win Rate" value={`${Number(analytics.stats.winRate).toFixed(1)}`} suffix="%" />
                <StatRow label="Profit Factor" value={Number(analytics.stats.profitFactor).toFixed(2)} />
                <StatRow label="Sharpe Ratio" value={Number(analytics.stats.sharpeRatio).toFixed(2)} />
                <StatRow label="Avg R:R" value={Number(analytics.stats.averageRR).toFixed(2)} />
                <StatRow label="Max Drawdown" value={`${Number(analytics.stats.maxDrawdownPercent).toFixed(1)}`} suffix="%" />
                <StatRow label="Avg Hold Time" value={formatHoldTime(analytics.stats.averageHoldTimeSeconds)} />
              </div>
            </WidgetCard>

            {/* R-Multiple Distribution */}
            <WidgetCard icon={BarChart3} title="R-Multiple Distribution">
              <BacktestRRDistribution data={analytics.rrDistribution} />
            </WidgetCard>

            {/* MAE/MFE Scatter */}
            <WidgetCard icon={Activity} title="MAE / MFE Scatter">
              <BacktestMaeMfeScatter data={analytics.mfeMae} />
            </WidgetCard>

            {/* Win/Loss by Hour */}
            <WidgetCard icon={BarChart3} title="Performance by Hour">
              <BacktestHourlyChart data={analytics.byHour} />
            </WidgetCard>

            {/* Win/Loss by Day */}
            <WidgetCard icon={BarChart3} title="Performance by Day">
              <BacktestDailyChart data={analytics.byDay} />
            </WidgetCard>

            {/* Streak Distribution */}
            <WidgetCard icon={Activity} title="Streak Distribution">
              <BacktestStreakChart trades={analytics.trades.map((t: any) => ({ pnl: Number(t.pnl || 0) }))} />
            </WidgetCard>

            {/* Direction Stats */}
            <WidgetCard icon={Target} title="Direction Analysis">
              <BacktestDirectionStats data={analytics.directionStats} />
            </WidgetCard>
          </div>

          {/* AI Behavioral Comparison */}
          <div className="bg-sidebar border border-white/5 rounded-sm overflow-hidden">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="w-full flex items-center justify-between p-4 hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Brain className="size-5 text-purple-400" />
                <span className="font-medium">AI Behavioral Comparison</span>
                <span className="text-xs text-white/40">Compare backtest vs live trading patterns</span>
              </div>
              {showComparison ? <ChevronUp className="size-4 text-white/50" /> : <ChevronDown className="size-4 text-white/50" />}
            </button>

            {showComparison && (
              <div className="p-4 pt-0 space-y-4">
                <div className="flex items-center gap-3">
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select live account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={runComparison}
                    disabled={comparisonLoading || !selectedAccount}
                    className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30"
                  >
                    {comparisonLoading ? "Analyzing..." : "Compare to Live"}
                  </Button>
                </div>

                {comparison && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="bg-sidebar-accent/50 rounded-sm p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-white/60">Overall Drift Score</span>
                        <span className={cn(
                          "text-sm font-bold",
                          comparison.overallDriftScore < 20 ? "text-teal-400" :
                          comparison.overallDriftScore < 50 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {comparison.overallDriftScore}/100
                        </span>
                      </div>
                      <p className="text-sm text-white/70">{comparison.summary}</p>
                    </div>

                    {/* Drift Items Grid */}
                    {comparison.driftItems.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {comparison.driftItems.map((item) => (
                          <div
                            key={item.dimension}
                            className={cn(
                              "bg-sidebar-accent/30 rounded-sm p-3 border",
                              item.severity === "significant" ? "border-rose-500/30" :
                              item.severity === "moderate" ? "border-amber-500/30" : "border-white/5"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-white/60">{item.label}</span>
                              {item.direction === "higher" ? (
                                <ArrowUp className="size-3.5 text-amber-400" />
                              ) : item.direction === "lower" ? (
                                <ArrowDown className="size-3.5 text-blue-400" />
                              ) : (
                                <Minus className="size-3.5 text-teal-400" />
                              )}
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                              <span className="text-lg font-semibold text-white">
                                {formatDriftValue(item.dimension, item.backtestValue)}
                              </span>
                              <span className="text-xs text-white/40">
                                vs {formatDriftValue(item.dimension, item.liveValue)} live
                              </span>
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed">{item.insight}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatHoldTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function formatDriftValue(dimension: string, value: number): string {
  switch (dimension) {
    case "hold_time":
      return formatHoldTime(value);
    case "trade_frequency":
      return `${value.toFixed(1)}/day`;
    case "win_rate":
      return `${value.toFixed(1)}%`;
    case "rr_ratio":
      return `${value.toFixed(2)}R`;
    case "profit_factor":
      return value.toFixed(2);
    default:
      return value.toFixed(2);
  }
}
