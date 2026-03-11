"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/utils/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  TrendingUp,
  Target,
  BarChart3,
  Activity,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function VerifiedTrackRecordPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = trpc.accounts.getTrackRecord.useQuery(
    { shareId },
    { enabled: !!shareId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-full max-w-xl space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40">
        <div className="text-center space-y-3">
          <AlertTriangle className="size-10 mx-auto text-amber-400/50" />
          <p className="text-lg">Track record not found</p>
          <p className="text-xs text-white/20">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  const { stats, trader, verificationHash, accountName, broker, generatedAt } = data as any;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metrics = [
    { label: "Total Trades", value: stats.totalTrades, icon: Activity, color: "text-blue-400" },
    { label: "Win Rate", value: `${stats.winRate}%`, icon: Target, color: stats.winRate >= 50 ? "text-emerald-400" : "text-rose-400" },
    { label: "Profit Factor", value: stats.profitFactor >= 999 ? "∞" : stats.profitFactor.toFixed(2), icon: TrendingUp, color: stats.profitFactor >= 1 ? "text-emerald-400" : "text-rose-400" },
    { label: "Avg R:R", value: stats.avgRR.toFixed(2), icon: BarChart3, color: stats.avgRR >= 1 ? "text-emerald-400" : "text-amber-400" },
    { label: "Total P&L", value: `$${stats.totalPnl.toLocaleString()}`, icon: TrendingUp, color: stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Max Drawdown", value: `$${stats.maxDrawdown.toLocaleString()}`, icon: AlertTriangle, color: "text-amber-400" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="bg-sidebar border border-white/5 rounded-t-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {trader?.image ? (
                <img src={trader.image} alt="" className="size-10 rounded-full" />
              ) : (
                <div className="size-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-sm font-medium">
                  {trader?.name?.[0] || "?"}
                </div>
              )}
              <div>
                <h2 className="text-white font-medium text-sm">{trader?.name || "Trader"}</h2>
                {trader?.username && (
                  <p className="text-[10px] text-white/30">@{trader.username}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold",
                stats.verificationLevel === "ea_synced"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              )}>
                <ShieldCheck className="size-3" />
                {stats.verificationLevel === "ea_synced" ? "EA VERIFIED" : "SELF-REPORTED"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-white/30">
            <span>{accountName} · {broker}</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Calendar className="size-3" />
              {stats.startDate} → {stats.endDate}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="bg-sidebar border-x border-white/5 p-4">
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white/[0.02] border border-white/5 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <m.icon className="size-3.5 text-white/25" />
                  <span className="text-[10px] text-white/40">{m.label}</span>
                </div>
                <span className={cn("text-lg font-semibold", m.color)}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Footer */}
        <div className="bg-sidebar border border-white/5 rounded-b-lg p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] text-white/20 uppercase tracking-wider">Verification Hash</p>
              <code className="text-[10px] text-white/40 font-mono">{verificationHash}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/15">
                Generated {new Date(generatedAt).toLocaleDateString()}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-white/50 transition-colors"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Share"}
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 text-center">
            <p className="text-[9px] text-white/15">
              Verified by Profitabledge · {stats.totalTrades} trades analyzed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
