"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpcClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { APP_RECHARTS_TOOLTIP_CONTENT_STYLE } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Clock,
  BarChart3,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

type SessionAnalytics = Awaited<ReturnType<typeof trpcClient.backtest.getSessionAnalytics.query>>;

const equityConfig = {
  equity: { label: "Equity", color: "#00E0C8" },
} satisfies ChartConfig;

const drawdownConfig = {
  drawdownPercent: { label: "Drawdown %", color: "#F76290" },
} satisfies ChartConfig;

const rrConfig = {
  value: { label: "R:R", color: "#818CF8" },
} satisfies ChartConfig;

export default function BacktestReviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId =
    typeof params?.sessionId === "string" ? params.sessionId : undefined;

  const [data, setData] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const result = await trpcClient.backtest.getSessionAnalytics.query({ sessionId });
        setData(result);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) {
    return <RouteLoadingFallback route="backtestReview" className="min-h-full" />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-lg font-medium">Session not found</p>
        <Button onClick={() => router.push("/backtest")}>Back to Sessions</Button>
      </div>
    );
  }

  const { session, stats, equityCurve, drawdownSeries, rrDistribution, mfeMae, byHour, byDay, directionStats, trades } = data;

  const closedTrades = trades.filter((t: any) => t.status !== "open");
  const finalBalance = stats.finalBalance ? Number(stats.finalBalance) : Number(session.initialBalance);
  const totalPnL = stats.totalPnL ? Number(stats.totalPnL) : 0;
  const totalPnLPercent = stats.totalPnLPercent ? Number(stats.totalPnLPercent) : 0;
  const winRate = stats.winRate ? Number(stats.winRate) : 0;
  const profitFactor = stats.profitFactor ? Number(stats.profitFactor) : 0;
  const maxDD = stats.maxDrawdownPercent ? Number(stats.maxDrawdownPercent) : 0;
  const sharpe = stats.sharpeRatio ? Number(stats.sharpeRatio) : 0;
  const avgRR = stats.averageRR ? Number(stats.averageRR) : 0;
  const avgWin = stats.averageWin ? Number(stats.averageWin) : 0;
  const avgLoss = stats.averageLoss ? Number(stats.averageLoss) : 0;
  const largestWin = stats.largestWin ? Number(stats.largestWin) : 0;
  const largestLoss = stats.largestLoss ? Number(stats.largestLoss) : 0;
  const winStreak = stats.longestWinStreak || 0;
  const loseStreak = stats.longestLoseStreak || 0;
  const avgHoldSecs = stats.averageHoldTimeSeconds || 0;

  // Format hold time
  const formatHoldTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  // Prepare RR histogram data
  const rrBuckets: Record<string, number> = {};
  rrDistribution.forEach((rr: number) => {
    const bucket = Math.round(rr * 2) / 2; // Round to nearest 0.5
    const key = bucket.toFixed(1);
    rrBuckets[key] = (rrBuckets[key] || 0) + 1;
  });
  const rrHistData = Object.entries(rrBuckets)
    .map(([rr, count]) => ({ rr: Number(rr), count, fill: Number(rr) >= 0 ? "#00E0C8" : "#F76290" }))
    .sort((a, b) => a.rr - b.rr);

  // Prepare by-hour data
  const hourData = Array.from({ length: 24 }, (_, i) => {
    const h = byHour[i] || { wins: 0, losses: 0 };
    return { hour: `${i}:00`, wins: h.wins, losses: -h.losses };
  });

  // Prepare by-day data
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayData = dayNames.map((name, i) => {
    const d = byDay[i] || { wins: 0, losses: 0 };
    return { day: name, wins: d.wins, losses: -d.losses, total: d.wins + d.losses };
  });

  return (
    <main className="p-6 py-4 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => router.push("/backtest")}>
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{session.symbol}</span>
              <span>{session.timeframe}</span>
              {session.startDate && session.completedAt && (
                <span>
                  {format(new Date(session.startDate), "MMM d, yyyy")} — {format(new Date(session.completedAt), "MMM d, yyyy")}
                </span>
              )}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                session.status === "completed" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"
              )}>
                {session.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total P&L" value={`${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`} sublabel={`${totalPnLPercent >= 0 ? "+" : ""}${totalPnLPercent.toFixed(2)}%`} color={totalPnL >= 0 ? "teal" : "rose"} icon={totalPnL >= 0 ? TrendingUp : TrendingDown} />
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} sublabel={`${stats.winningTrades}W / ${stats.losingTrades}L`} color={winRate >= 50 ? "teal" : "rose"} icon={Target} />
        <StatCard label="Profit Factor" value={profitFactor > 100 ? "∞" : profitFactor.toFixed(2)} color={profitFactor >= 1.5 ? "teal" : profitFactor >= 1 ? "yellow" : "rose"} icon={BarChart3} />
        <StatCard label="Max Drawdown" value={`${maxDD.toFixed(2)}%`} sublabel={`$${Number(stats.maxDrawdown || 0).toFixed(2)}`} color="rose" icon={AlertTriangle} />
        <StatCard label="Sharpe Ratio" value={sharpe.toFixed(2)} color={sharpe >= 1 ? "teal" : sharpe >= 0 ? "yellow" : "rose"} icon={Activity} />
        <StatCard label="Avg R:R" value={avgRR.toFixed(2)} color={avgRR >= 1 ? "teal" : "rose"} icon={Trophy} />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniStat label="Avg Win" value={`$${avgWin.toFixed(2)}`} color="teal" />
        <MiniStat label="Avg Loss" value={`$${avgLoss.toFixed(2)}`} color="rose" />
        <MiniStat label="Largest Win" value={`$${largestWin.toFixed(2)}`} color="teal" />
        <MiniStat label="Largest Loss" value={`$${Math.abs(largestLoss).toFixed(2)}`} color="rose" />
        <MiniStat label="Win/Lose Streak" value={`${winStreak} / ${loseStreak}`} />
        <MiniStat label="Avg Hold Time" value={formatHoldTime(avgHoldSecs)} icon={Clock} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity Curve */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={equityConfig} className="h-[250px] w-full">
              <AreaChart data={equityCurve.map((p: any) => ({ ...p, equity: Number(p.equity) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" domain={["auto", "auto"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={Number(session.initialBalance)} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="equity" stroke="#00E0C8" fill="rgba(0,224,200,0.1)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Drawdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={drawdownConfig} className="h-[250px] w-full">
              <AreaChart data={drawdownSeries.map((p: any) => ({ ...p, drawdownPercent: -Number(p.drawdownPercent) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                <Area type="monotone" dataKey="drawdownPercent" stroke="#F76290" fill="rgba(247,98,144,0.1)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* R:R Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">R:R Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={rrConfig} className="h-[250px] w-full">
              <BarChart data={rrHistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="rr" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {rrHistData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* MFE/MAE Scatter */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">MFE / MAE Scatter</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {mfeMae.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" dataKey="mae" name="MAE (pips)" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" label={{ value: "MAE (pips)", position: "bottom", fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                  <YAxis type="number" dataKey="mfe" name="MFE (pips)" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" label={{ value: "MFE (pips)", angle: -90, position: "insideLeft", fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                  <Tooltip
                    contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                    formatter={(value: number, name: string) => [`${value.toFixed(1)} pips`, name]}
                  />
                  <Scatter data={mfeMae.filter((d: any) => d.pnl >= 0)} fill="#00E0C8" opacity={0.7} />
                  <Scatter data={mfeMae.filter((d: any) => d.pnl < 0)} fill="#F76290" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No MFE/MAE data</div>
            )}
          </CardContent>
        </Card>

        {/* Performance by Hour */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ wins: { label: "Wins", color: "#00E0C8" }, losses: { label: "Losses", color: "#F76290" } }} className="h-[250px] w-full">
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                <Bar dataKey="wins" fill="#00E0C8" radius={[2, 2, 0, 0]} stackId="stack" />
                <Bar dataKey="losses" fill="#F76290" radius={[0, 0, 2, 2]} stackId="stack" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Direction Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Direction Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="size-4 text-teal-400" />
                  <span className="text-sm font-medium text-teal-400">Long</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{directionStats.long.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Wins</span><span className="text-teal-400">{directionStats.long.wins}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Win Rate</span><span>{(directionStats.long.winRate * 100).toFixed(1)}%</span></div>
                </div>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="size-4 text-rose-400" />
                  <span className="text-sm font-medium text-rose-400">Short</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{directionStats.short.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Wins</span><span className="text-teal-400">{directionStats.short.wins}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Win Rate</span><span>{(directionStats.short.winRate * 100).toFixed(1)}%</span></div>
                </div>
              </div>
            </div>

            {/* Day of week */}
            <div>
              <p className="text-xs font-medium mb-2">By Day of Week</p>
              <div className="grid grid-cols-5 gap-1">
                {dayData.slice(1, 6).map(d => (
                  <div key={d.day} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{d.day}</p>
                    <p className="text-xs font-medium">{d.total}</p>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: d.total > 0 ? `${(d.wins / d.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trade Log ({closedTrades.length} trades)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-muted-foreground">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Direction</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">Exit</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Volume</th>
                  <th className="text-right py-2 px-2">P&L</th>
                  <th className="text-right py-2 px-2">Pips</th>
                  <th className="text-right py-2 px-2">R:R</th>
                  <th className="text-right py-2 px-2">MFE</th>
                  <th className="text-right py-2 px-2">MAE</th>
                  <th className="text-right py-2 px-2">Hold</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((trade: any, i: number) => {
                  const pnl = Number(trade.pnl || 0);
                  const pnlPips = Number(trade.pnlPips || 0);
                  const rr = trade.realizedRR ? Number(trade.realizedRR) : null;
                  const mfe = trade.mfePips ? Number(trade.mfePips) : null;
                  const mae = trade.maePips ? Number(trade.maePips) : null;
                  const holdSecs = trade.holdTimeSeconds || 0;

                  return (
                    <tr key={trade.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 px-2">
                        <span className={cn("font-medium", trade.direction === "long" ? "text-teal-400" : "text-rose-400")}>
                          {trade.direction === "long" ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{Number(trade.entryPrice).toFixed(5)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{trade.exitPrice ? Number(trade.exitPrice).toFixed(5) : "—"}</td>
                      <td className="py-1.5 px-2">
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[10px]",
                          trade.exitType === "tp" ? "bg-teal-500/20 text-teal-400" :
                          trade.exitType === "sl" ? "bg-rose-500/20 text-rose-400" :
                          "bg-white/10 text-muted-foreground"
                        )}>
                          {trade.exitType === "tp" ? "TP" : trade.exitType === "sl" ? "SL" : "Manual"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{Number(trade.volume).toFixed(2)}</td>
                      <td className={cn("py-1.5 px-2 text-right font-mono font-medium", pnl >= 0 ? "text-teal-400" : "text-rose-400")}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </td>
                      <td className={cn("py-1.5 px-2 text-right font-mono", pnlPips >= 0 ? "text-teal-400" : "text-rose-400")}>
                        {pnlPips >= 0 ? "+" : ""}{pnlPips.toFixed(1)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{rr !== null ? rr.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-teal-400/70">{mfe !== null ? mfe.toFixed(1) : "—"}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-rose-400/70">{mae !== null ? mae.toFixed(1) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">{formatHoldTime(holdSecs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// ============== STAT CARD COMPONENTS ==============

function StatCard({
  label, value, sublabel, color = "default", icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: "teal" | "rose" | "yellow" | "default";
  icon?: React.ElementType;
}) {
  const colorMap = {
    teal: "text-teal-400",
    rose: "text-rose-400",
    yellow: "text-yellow-400",
    default: "text-foreground",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          {Icon && <Icon className="size-3.5 text-muted-foreground/50" />}
        </div>
        <p className={cn("text-lg font-bold font-mono", colorMap[color])}>{value}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label, value, color, icon: Icon,
}: {
  label: string;
  value: string;
  color?: "teal" | "rose";
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-sidebar-accent/50 rounded-lg border border-white/5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-3 text-muted-foreground" />}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className={cn("text-xs font-medium font-mono", color === "teal" ? "text-teal-400" : color === "rose" ? "text-rose-400" : "")}>
        {value}
      </span>
    </div>
  );
}
