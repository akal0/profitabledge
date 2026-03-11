"use client";

import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Clock,
  Flame,
  TrendingUp,
  TrendingDown,
  Pause,
  Scale,
  Shield,
  Timer,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetWrapper } from "./widget-wrapper";

const NUDGE_CONFIG = {
  overtrading_warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  tilt_alert: {
    icon: Flame,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  take_a_break: {
    icon: Pause,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  size_creep: {
    icon: Scale,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  loss_recovery: {
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  session_limit: {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  positive_reinforcement: {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  exit_window: {
    icon: Timer,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
  },
} as const;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function SessionCoachingWidget({
  isEditing = false,
  className,
}: {
  isEditing?: boolean;
  className?: string;
}) {
  const accountId = useAccountStore((s) => s.selectedAccountId);

  const { data: session, isLoading: loadingSession } =
    trpc.ai.getSessionState.useQuery(
      { accountId: accountId ?? "" },
      { enabled: !!accountId, refetchInterval: 15_000 }
    );

  const { data: nudges } = trpc.ai.getCoachingNudges.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId, refetchInterval: 30_000 }
  );

  const activeNudges = nudges ?? [];

  if (loadingSession) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Activity}
        title="Session coach"
        showHeader
        contentClassName="flex-col p-3.5"
      >
        <Skeleton className="h-full w-full rounded-sm" />
      </WidgetWrapper>
    );
  }

  const isActive = session?.isActive ?? false;
  const tradeCount = session?.tradeCount ?? 0;
  const wins = session?.wins ?? 0;
  const losses = session?.losses ?? 0;
  const runningPnL = session?.runningPnL ?? 0;
  const streak = session?.currentStreak ?? { type: null, count: 0 };

  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={className}
      icon={Activity}
      title="Session coach"
      showHeader
      contentClassName="flex-col justify-end p-3.5"
      headerRight={
        isActive ? (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400">Live</span>
          </span>
        ) : null
      }
    >
      {!isActive ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Clock className="h-8 w-8 text-white/20 mb-2" />
          <p className="text-xs text-white/50">No active session</p>
          <p className="text-[10px] text-white/30 mt-1">
            Start trading to see live coaching
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-white/90">{tradeCount}</p>
              <p className="text-[10px] text-white/40">Trades</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white/90">
                {wins}W/{losses}L
              </p>
              <p className="text-[10px] text-white/40">Score</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-lg font-bold",
                  runningPnL >= 0 ? "text-teal-400" : "text-rose-400"
                )}
              >
                ${Math.abs(runningPnL).toFixed(0)}
              </p>
              <p className="text-[10px] text-white/40">P&L</p>
            </div>
          </div>

          {streak.type && streak.count > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              {streak.type === "win" ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-rose-400" />
              )}
              <span
                className={cn(
                  "text-[10px] font-medium",
                  streak.type === "win" ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {streak.count}-trade {streak.type} streak
              </span>
            </div>
          )}

          <div className="space-y-1.5 mt-auto overflow-y-auto max-h-24">
            {activeNudges.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[10px]">
                <Zap className="h-2.5 w-2.5 text-teal-400" />
                <span className="text-white/50">
                  Session looking good — keep it up
                </span>
              </div>
            ) : (
              activeNudges.slice(0, 3).map((nudge, i) => {
                const config =
                  NUDGE_CONFIG[nudge.type as keyof typeof NUDGE_CONFIG] ??
                  NUDGE_CONFIG.tilt_alert;
                  const Icon = config.icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-1.5 text-[10px] rounded-sm p-1.5 border",
                        config.bg,
                        config.border
                      )}
                    >
                      <Icon
                        className={cn("h-3 w-3 shrink-0 mt-0.5", config.color)}
                      />
                      <div className="min-w-0">
                        <p className={cn("font-medium", config.color)}>
                          {nudge.title}
                        </p>
                        <p className="text-white/50 truncate">
                          {nudge.message}
                        </p>
                      </div>
                    </div>
                  );
              })
            )}
          </div>
        </>
      )}
    </WidgetWrapper>
  );
}
