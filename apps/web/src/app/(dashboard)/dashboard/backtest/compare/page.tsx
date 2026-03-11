"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

type Severity = "significant" | "moderate" | "minor";

function SeverityBadge({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    significant: "bg-red-500/15 text-red-400",
    moderate: "bg-yellow-500/15 text-yellow-400",
    minor: "bg-white/5 text-white/40",
  };
  return (
    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", colors[severity])}>
      {severity}
    </span>
  );
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "higher")
    return <TrendingUp className="size-3.5 text-emerald-400" />;
  if (direction === "lower")
    return <TrendingDown className="size-3.5 text-red-400" />;
  return <Minus className="size-3.5 text-white/30" />;
}

export default function BacktestComparePage() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [comparing, setComparing] = useState(false);

  const { data, isLoading, refetch } = trpc.backtest.compareToLive.useQuery(
    { accountId: accountId || "" },
    { enabled: false }
  );

  const handleCompare = () => {
    setComparing(true);
    refetch().finally(() => setComparing(false));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <GitCompare className="size-5" />
            Backtest vs Live Comparison
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Compare your backtest behavior to live trading to identify execution gaps
          </p>
        </div>
        <Button
          onClick={handleCompare}
          disabled={!accountId || comparing}
          className="bg-white text-black hover:bg-white/90"
        >
          <BarChart3 className="size-3.5 mr-1.5" />
          {comparing ? "Analyzing..." : "Run Comparison"}
        </Button>
      </div>

      {!accountId && (
        <div className="bg-sidebar border border-white/5 rounded-md p-8 text-center">
          <p className="text-sm text-white/30">Select an account to compare backtest vs live performance</p>
        </div>
      )}

      {isLoading || comparing ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : data ? (
        <>
          {/* Overall Drift Score */}
          <div className="bg-sidebar border border-white/5 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Overall Behavioral Drift</p>
                <p className={cn(
                  "text-3xl font-bold mt-1",
                  data.overallDriftScore < 30 ? "text-emerald-400" :
                  data.overallDriftScore < 60 ? "text-yellow-400" : "text-red-400"
                )}>
                  {data.overallDriftScore.toFixed(0)}%
                </p>
              </div>
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                data.overallDriftScore < 30 ? "bg-emerald-500/10 text-emerald-400" :
                data.overallDriftScore < 60 ? "bg-yellow-500/10 text-yellow-400" :
                "bg-red-500/10 text-red-400"
              )}>
                {data.overallDriftScore < 30 ? (
                  <><CheckCircle2 className="size-4" /> Consistent</>
                ) : data.overallDriftScore < 60 ? (
                  <><AlertTriangle className="size-4" /> Moderate Drift</>
                ) : (
                  <><AlertTriangle className="size-4" /> Significant Drift</>
                )}
              </div>
            </div>
            {data.summary && (
              <p className="text-[11px] text-white/50 mt-3 border-t border-white/5 pt-3">
                {data.summary}
              </p>
            )}
          </div>

          {/* Drift Items */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-white">Behavioral Dimensions</h2>
            {data.driftItems?.map((item: any, i: number) => (
              <div key={i} className="bg-sidebar border border-white/5 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DirectionIcon direction={item.direction} />
                    <h3 className="text-sm font-medium text-white">{item.label}</h3>
                    <SeverityBadge severity={item.severity} />
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    item.percentChange > 0 ? "text-emerald-400" : item.percentChange < 0 ? "text-red-400" : "text-white/30"
                  )}>
                    {item.percentChange > 0 ? "+" : ""}{item.percentChange.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-white/[0.03] rounded p-2.5">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider">Backtest</p>
                    <p className="text-lg font-semibold text-white mt-0.5">
                      {typeof item.backtestValue === "number" ? item.backtestValue.toFixed(2) : item.backtestValue}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded p-2.5">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider">Live</p>
                    <p className="text-lg font-semibold text-white mt-0.5">
                      {typeof item.liveValue === "number" ? item.liveValue.toFixed(2) : item.liveValue}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-white/50">{item.insight}</p>
              </div>
            ))}
          </div>

          {/* Profile Comparison */}
          {data.backtestProfile && data.liveProfile && (
            <div className="bg-sidebar border border-white/5 rounded-md p-4">
              <h2 className="text-sm font-medium text-white mb-3">Profile Snapshot</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Win Rate", bt: data.backtestProfile.winRate, live: data.liveProfile.winRate, suffix: "%" },
                  { label: "Avg RR", bt: data.backtestProfile.avgRR, live: data.liveProfile.avgRR, suffix: "" },
                  { label: "Profit Factor", bt: data.backtestProfile.profitFactor, live: data.liveProfile.profitFactor, suffix: "" },
                  { label: "Trades/Day", bt: data.backtestProfile.avgTradesPerDay, live: data.liveProfile.avgTradesPerDay, suffix: "" },
                  { label: "Total Trades", bt: data.backtestProfile.totalTrades, live: data.liveProfile.totalTrades, suffix: "" },
                  { label: "Avg Hold (s)", bt: data.backtestProfile.avgHoldTimeSeconds, live: data.liveProfile.avgHoldTimeSeconds, suffix: "" },
                ].map((m, i) => {
                  const diff = m.live - m.bt;
                  return (
                    <div key={i} className="bg-white/[0.02] rounded p-2">
                      <p className="text-[9px] text-white/30">{m.label}</p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-[11px] text-white/50">{m.bt?.toFixed(1)}{m.suffix}</span>
                        <span className="text-white/15">&rarr;</span>
                        <span className="text-[11px] text-white font-medium">{m.live?.toFixed(1)}{m.suffix}</span>
                        <span className={cn(
                          "text-[9px]",
                          diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-white/20"
                        )}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : accountId ? (
        <div className="bg-sidebar border border-white/5 rounded-md p-8 text-center">
          <GitCompare className="size-10 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/30">Click "Run Comparison" to analyze behavioral drift between your backtest and live trading</p>
          <p className="text-[10px] text-white/20 mt-1">Requires at least 5 backtest trades and 10 live trades</p>
        </div>
      ) : null}
    </div>
  );
}
