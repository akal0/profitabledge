"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { APP_RECHARTS_TOOLTIP_CONTENT_STYLE } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Trophy, Play, Target, AlertTriangle, TrendingUp } from "lucide-react";

interface SimConfig {
  simulations: number;
  tradeDays: number;
  tradesPerDay: number;
  startBalance: number;
  profitTarget: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  riskPerTrade: number;
}

const defaultConfig: SimConfig = {
  simulations: 500,
  tradeDays: 30,
  tradesPerDay: 3,
  startBalance: 100000,
  profitTarget: 10,
  maxDailyLoss: 5,
  maxDrawdown: 10,
  riskPerTrade: 1,
};

function NumberInput({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-white/40">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="text-[9px] text-white/25 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

export default function ChallengeSimulatorPage() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [config, setConfig] = useState<SimConfig>(defaultConfig);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const { data: tradesData } = trpc.trades.list.useQuery(
    { accountId: accountId || "", limit: 500, offset: 0 },
    { enabled: !!accountId }
  );

  const trades = tradesData?.trades || [];

  // Derive trader stats from actual trades
  const traderStats = useMemo(() => {
    if (trades.length < 5)
      return { winRate: 0.55, avgWinPct: 0.8, avgLossPct: -0.5, available: false };

    const pnls = trades.map((t: any) => parseFloat(t.profit?.toString() || "0"));
    const wins = pnls.filter((p: number) => p > 0);
    const losses = pnls.filter((p: number) => p < 0);
    return {
      winRate: wins.length / pnls.length,
      avgWinPct: wins.length > 0 ? (wins.reduce((s: number, p: number) => s + p, 0) / wins.length / config.startBalance) * 100 : 0.8,
      avgLossPct: losses.length > 0 ? (losses.reduce((s: number, p: number) => s + p, 0) / losses.length / config.startBalance) * 100 : -0.5,
      available: true,
    };
  }, [trades, config.startBalance]);

  const runSimulation = () => {
    setRunning(true);

    // Use setTimeout to not block UI
    setTimeout(() => {
      const { simulations, tradeDays, tradesPerDay, startBalance, profitTarget, maxDailyLoss, maxDrawdown, riskPerTrade } = config;
      const totalTrades = tradeDays * tradesPerDay;
      const targetBalance = startBalance * (1 + profitTarget / 100);
      const maxDDAmount = startBalance * (maxDrawdown / 100);
      const maxDailyLossAmount = startBalance * (maxDailyLoss / 100);

      let passCount = 0;
      let failDDCount = 0;
      let failDailyCount = 0;
      const daysToPass: number[] = [];
      const finalBalances: number[] = [];

      // Equity paths for percentile bands
      const allPaths: number[][] = [];

      for (let sim = 0; sim < simulations; sim++) {
        let balance = startBalance;
        let peakBalance = startBalance;
        let passed = false;
        let failed = false;
        let failReason = "";
        const path: number[] = [startBalance];

        for (let day = 0; day < tradeDays && !passed && !failed; day++) {
          let dailyPnl = 0;

          for (let t = 0; t < tradesPerDay && !failed; t++) {
            const isWin = Math.random() < traderStats.winRate;
            const riskAmount = balance * (riskPerTrade / 100);
            const pnl = isWin
              ? riskAmount * (Math.abs(traderStats.avgWinPct) / (riskPerTrade || 1))
              : -riskAmount;
            balance += pnl;
            dailyPnl += pnl;

            // Check max drawdown
            peakBalance = Math.max(peakBalance, balance);
            if (peakBalance - balance > maxDDAmount) {
              failed = true;
              failReason = "drawdown";
              failDDCount++;
            }

            // Check daily loss
            if (Math.abs(dailyPnl) > maxDailyLossAmount && dailyPnl < 0) {
              failed = true;
              failReason = "daily";
              failDailyCount++;
            }
          }

          path.push(balance);

          // Check profit target
          if (balance >= targetBalance && !failed) {
            passed = true;
            daysToPass.push(day + 1);
            passCount++;
          }
        }

        finalBalances.push(balance);
        allPaths.push(path);
      }

      // Compute percentile equity paths
      const maxLen = tradeDays + 1;
      const p5: number[] = [];
      const p25: number[] = [];
      const p50: number[] = [];
      const p75: number[] = [];
      const p95: number[] = [];

      for (let i = 0; i < maxLen; i++) {
        const vals = allPaths
          .map((p) => p[Math.min(i, p.length - 1)])
          .sort((a, b) => a - b);
        const len = vals.length;
        p5.push(vals[Math.floor(len * 0.05)]);
        p25.push(vals[Math.floor(len * 0.25)]);
        p50.push(vals[Math.floor(len * 0.5)]);
        p75.push(vals[Math.floor(len * 0.75)]);
        p95.push(vals[Math.floor(len * 0.95)]);
      }

      const chartData = Array.from({ length: maxLen }, (_, i) => ({
        day: i,
        p5: Math.round(p5[i]),
        p25: Math.round(p25[i]),
        p50: Math.round(p50[i]),
        p75: Math.round(p75[i]),
        p95: Math.round(p95[i]),
      }));

      setResults({
        passRate: (passCount / simulations) * 100,
        failDDRate: (failDDCount / simulations) * 100,
        failDailyRate: (failDailyCount / simulations) * 100,
        avgDaysToPass: daysToPass.length > 0 ? daysToPass.reduce((s, d) => s + d, 0) / daysToPass.length : 0,
        medianFinal: finalBalances.sort((a, b) => a - b)[Math.floor(finalBalances.length / 2)],
        chartData,
        targetBalance,
      });
      setRunning(false);
    }, 50);
  };

  const updateConfig = <K extends keyof SimConfig>(key: K, val: number) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Trophy className="size-5 text-yellow-400" />
          Challenge Simulator
        </h1>
        <p className="text-xs text-white/40 mt-1">
          Simulate prop firm challenges using your actual trading statistics. See your probability of passing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config Panel */}
        <div className="bg-sidebar border border-white/5 rounded-md p-4 space-y-4">
          <h2 className="text-sm font-medium text-white">Challenge Rules</h2>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Starting Balance" value={config.startBalance} onChange={(v) => updateConfig("startBalance", v)} suffix="$" min={1000} step={1000} />
            <NumberInput label="Profit Target" value={config.profitTarget} onChange={(v) => updateConfig("profitTarget", v)} suffix="%" min={1} max={50} step={0.5} />
            <NumberInput label="Max Daily Loss" value={config.maxDailyLoss} onChange={(v) => updateConfig("maxDailyLoss", v)} suffix="%" min={1} max={20} step={0.5} />
            <NumberInput label="Max Drawdown" value={config.maxDrawdown} onChange={(v) => updateConfig("maxDrawdown", v)} suffix="%" min={1} max={30} step={0.5} />
          </div>

          <h2 className="text-sm font-medium text-white pt-2">Trading Parameters</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Trading Days" value={config.tradeDays} onChange={(v) => updateConfig("tradeDays", v)} min={5} max={90} />
            <NumberInput label="Trades/Day" value={config.tradesPerDay} onChange={(v) => updateConfig("tradesPerDay", v)} min={1} max={20} />
            <NumberInput label="Risk/Trade" value={config.riskPerTrade} onChange={(v) => updateConfig("riskPerTrade", v)} suffix="%" min={0.1} max={5} step={0.1} />
            <NumberInput label="Simulations" value={config.simulations} onChange={(v) => updateConfig("simulations", v)} min={100} max={5000} step={100} />
          </div>

          {/* Stats from actual trades */}
          {traderStats.available && (
            <div className="border-t border-white/5 pt-3">
              <p className="text-[10px] text-white/30 mb-2">Your stats (from {trades.length} trades):</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-[10px]">
                  <span className="text-white/30">Win Rate: </span>
                  <span className="text-white font-medium">{(traderStats.winRate * 100).toFixed(1)}%</span>
                </div>
                <div className="text-[10px]">
                  <span className="text-white/30">Avg Win: </span>
                  <span className="text-emerald-400 font-medium">{traderStats.avgWinPct.toFixed(2)}%</span>
                </div>
                <div className="text-[10px]">
                  <span className="text-white/30">Avg Loss: </span>
                  <span className="text-red-400 font-medium">{traderStats.avgLossPct.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={runSimulation}
            disabled={running}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            <Play className="size-3.5 mr-1.5" />
            {running ? "Simulating..." : "Run Simulation"}
          </Button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {results ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-sidebar border border-white/5 rounded-md p-3 text-center">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Pass Rate</p>
                  <p className={cn("text-2xl font-bold mt-1", results.passRate > 50 ? "text-emerald-400" : results.passRate > 30 ? "text-yellow-400" : "text-red-400")}>
                    {results.passRate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-sidebar border border-white/5 rounded-md p-3 text-center">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Avg Days</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {results.avgDaysToPass > 0 ? results.avgDaysToPass.toFixed(0) : "—"}
                  </p>
                </div>
                <div className="bg-sidebar border border-white/5 rounded-md p-3 text-center">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">DD Fail</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{results.failDDRate.toFixed(1)}%</p>
                </div>
                <div className="bg-sidebar border border-white/5 rounded-md p-3 text-center">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Daily Fail</p>
                  <p className="text-2xl font-bold text-orange-400 mt-1">{results.failDailyRate.toFixed(1)}%</p>
                </div>
              </div>

              {/* Equity Chart */}
              <div className="bg-sidebar border border-white/5 rounded-md p-4">
                <h3 className="text-sm font-medium text-white mb-3">Equity Projection (Percentile Bands)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={results.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "Trading Day", position: "insideBottom", offset: -5, fontSize: 9, fill: "rgba(255,255,255,0.2)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                        formatter={(v: number) => [`$${v.toLocaleString()}`, ""]}
                      />
                      <ReferenceLine y={results.targetBalance} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "Target", position: "right", fill: "#22c55e", fontSize: 9 }} />
                      <ReferenceLine y={config.startBalance * (1 - config.maxDrawdown / 100)} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Max DD", position: "right", fill: "#ef4444", fontSize: 9 }} />
                      <Line type="monotone" dataKey="p5" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="3 3" name="5th %ile" />
                      <Line type="monotone" dataKey="p25" stroke="#fbbf24" dot={false} strokeWidth={1} name="25th %ile" />
                      <Line type="monotone" dataKey="p50" stroke="#818cf8" dot={false} strokeWidth={2} name="Median" />
                      <Line type="monotone" dataKey="p75" stroke="#34d399" dot={false} strokeWidth={1} name="75th %ile" />
                      <Line type="monotone" dataKey="p95" stroke="#22c55e" dot={false} strokeWidth={1} strokeDasharray="3 3" name="95th %ile" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-sidebar border border-white/5 rounded-md p-4 space-y-2">
                <h3 className="text-sm font-medium text-white">Recommendations</h3>
                {results.passRate < 50 && (
                  <div className="flex items-start gap-2 text-[11px]">
                    <AlertTriangle className="size-3 text-yellow-400 mt-0.5 shrink-0" />
                    <span className="text-white/60">
                      Pass rate below 50%. Consider reducing risk per trade to {Math.max(0.25, config.riskPerTrade * 0.7).toFixed(2)}% or improving your win rate.
                    </span>
                  </div>
                )}
                {results.failDDRate > 30 && (
                  <div className="flex items-start gap-2 text-[11px]">
                    <AlertTriangle className="size-3 text-red-400 mt-0.5 shrink-0" />
                    <span className="text-white/60">
                      High drawdown failure rate ({results.failDDRate.toFixed(0)}%). Reduce max concurrent trades or risk per trade.
                    </span>
                  </div>
                )}
                {results.passRate >= 50 && (
                  <div className="flex items-start gap-2 text-[11px]">
                    <TrendingUp className="size-3 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-white/60">
                      Good pass probability! Your current stats support this challenge configuration.
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-sidebar border border-white/5 rounded-md p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
              <Target className="size-10 text-white/10 mb-3" />
              <p className="text-sm text-white/30">Configure challenge parameters and click "Run Simulation"</p>
              <p className="text-[10px] text-white/20 mt-1">
                Uses your actual trading statistics to simulate {config.simulations} challenge attempts
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
