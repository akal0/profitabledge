"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { cn } from "@/lib/utils";
import { Plus, ListOrdered, Trash2 } from "lucide-react";
import { trpcClient } from "@/utils/trpc";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

type SessionListItem = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  totalTrades: number | null;
  winRate: string | null;
  totalPnL: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const TIMEFRAMES = [
  { value: "m1", label: "1 Minute" },
  { value: "m5", label: "5 Minutes" },
  { value: "m15", label: "15 Minutes" },
  { value: "m30", label: "30 Minutes" },
  { value: "h1", label: "1 Hour" },
  { value: "h4", label: "4 Hours" },
  { value: "d1", label: "Daily" },
];

export default function BacktestSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trpcClient.backtest.listSessions.query();
      setSessions(result as any);
    } catch {
      console.error("Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await trpcClient.backtest.deleteSession.mutate({ sessionId: id });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }, []);

  return (
    <main className="p-6 py-4 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Manage your backtesting sessions. Click to resume or review.
          </p>
        </div>
        <Button onClick={() => router.push("/backtest/replay")} className="gap-2">
          <Plus className="size-4" />
          New Session
        </Button>
      </div>

      {loading ? (
        <RouteLoadingFallback route="backtestSessions" className="min-h-[320px]" />
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <ListOrdered className="size-12 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-lg font-medium">No sessions yet</p>
            <p className="text-sm text-muted-foreground">Create your first backtest session to start practicing.</p>
          </div>
          <Button onClick={() => router.push("/backtest/replay")} className="gap-2 mt-2">
            <Plus className="size-4" />
            Create Session
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map(s => (
            <div
              key={s.id}
              className="flex items-center justify-between p-4 bg-sidebar-accent/50 rounded-lg border border-white/5 hover:bg-sidebar-accent/80 transition-colors cursor-pointer group"
              onClick={() => {
                if (s.status === "completed") {
                  router.push(`/backtest/${s.id}/review`);
                } else {
                  router.push(`/backtest/replay?sessionId=${s.id}`);
                }
              }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={cn(
                  "size-2 rounded-full shrink-0",
                  s.status === "active" ? "bg-emerald-500" : s.status === "completed" ? "bg-blue-500" : "bg-gray-500"
                )} />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{s.symbol}</span>
                    <span>{TIMEFRAMES.find(t => t.value === s.timeframe)?.label || s.timeframe}</span>
                    <span>{formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {s.status === "completed" && (
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <p className="text-muted-foreground">Trades</p>
                      <p className="font-medium">{s.totalTrades || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Win Rate</p>
                      <p className="font-medium">{s.winRate ? `${Number(s.winRate).toFixed(1)}%` : "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">P&L</p>
                      <p className={cn("font-medium", Number(s.totalPnL || 0) >= 0 ? "text-teal-400" : "text-rose-400")}>
                        {Number(s.totalPnL || 0) >= 0 ? "+" : ""}${Number(s.totalPnL || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
                {s.status === "active" && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">In Progress</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 size-8"
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
