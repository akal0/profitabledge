"use client";

import { BrainCircuit, TrendingDown, TrendingUp, Target } from "lucide-react";

import { trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { WidgetWrapper } from "./widget-wrapper";

function formatHoldTime(seconds: number) {
  if (!seconds) return "n/a";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function EdgeSummaryWidget({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const storeAccountId = useAccountStore((state) => state.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;

  const { data: rawData, isLoading } = useQuery({
    ...trpcOptions.ai.getProfile.queryOptions({
      accountId: effectiveAccountId || "",
    }),
    enabled: !!effectiveAccountId,
    staleTime: 60_000,
  });
  const data = rawData as
    | {
        profile: any;
        edges: Array<{ label: string; winRate: number; trades: number }>;
        leaks: Array<{ label: string; winRate: number; trades: number }>;
      }
    | undefined;

  const profile = data?.profile;
  const topEdge = data?.edges?.[0];
  const topLeak = data?.leaks?.[0];

  if (isLoading) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={BrainCircuit}
        title="Edge Summary"
        showHeader
        contentClassName="flex-col p-3.5 space-y-2"
      >
        <Skeleton className="h-16 w-full bg-sidebar" />
        <Skeleton className="h-20 w-full bg-sidebar" />
      </WidgetWrapper>
    );
  }

  if (!profile) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={BrainCircuit}
        title="Edge Summary"
        showHeader
        contentClassName="flex-col items-center justify-center p-3.5"
      >
        <div className="flex items-center justify-center text-xs text-white/35">
          Need more closed trades before the edge profile becomes reliable.
        </div>
      </WidgetWrapper>
    );
  }

  const topSession = profile.sessions?.[0];
  const topSymbol = profile.symbols?.[0];
  const sweetSpot = profile.rrProfile;

  const focusScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(profile.winRate * 0.35 + profile.profitFactor * 20 + (topEdge?.trades || 0))
    )
  );

  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={className}
      icon={BrainCircuit}
      title="Edge Summary"
      showHeader
      contentClassName="flex-col p-3.5"
      headerRight={
        <span className="text-[10px] text-white/30">
          Focus score {focusScore}
        </span>
      }
    >
      <div className="flex-1 flex flex-col gap-2.5">
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-white/5 bg-black/10 p-2">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">
              Win Rate
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {profile.winRate.toFixed(1)}%
            </p>
          </div>
          <div className="border border-white/5 bg-black/10 p-2">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">
              Profit Factor
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {profile.profitFactor.toFixed(2)}
            </p>
          </div>
          <div className="border border-white/5 bg-black/10 p-2">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">
              Expectancy
            </p>
            <p
              className={cn(
                "mt-2 text-lg font-semibold",
                profile.expectancy >= 0 ? "text-teal-400" : "text-rose-400"
              )}
            >
              ${profile.expectancy.toFixed(0)}
            </p>
          </div>
        </div>

        <div className="grid flex-1 gap-2 md:grid-cols-2">
          <div className="border border-emerald-500/15 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
                Best Edge
              </p>
            </div>
            <p className="mt-2 text-sm font-medium text-white">
              {topEdge?.label || topSession?.session || "Building profile"}
            </p>
            <p className="mt-1 text-[11px] text-white/45">
              {topEdge
                ? `${topEdge.winRate.toFixed(0)}% WR over ${topEdge.trades} trades`
                : topSession
                ? `${topSession.winRate.toFixed(0)}% WR in ${topSession.session}`
                : "Keep tagging trades to isolate your best setup."}
            </p>
          </div>

          <div className="border border-rose-500/15 bg-rose-500/5 p-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-3.5 text-rose-400" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-rose-300/80">
                Biggest Leak
              </p>
            </div>
            <p className="mt-2 text-sm font-medium text-white">
              {topLeak?.label || "No dominant leak yet"}
            </p>
            <p className="mt-1 text-[11px] text-white/45">
              {topLeak
                ? `${topLeak.winRate.toFixed(0)}% WR across ${topLeak.trades} trades`
                : "Sample is either clean or still too small to isolate a repeated leak."}
            </p>
          </div>
        </div>

        <div className="border border-white/5 bg-black/10 p-3">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 text-white/45" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Best Focus Next
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/70">
            Trade more of <span className="text-white">{topSymbol?.symbol || "your top symbol"}</span>
            {topSession ? ` during ${topSession.session}` : ""}, keep planned R:R near{" "}
            <span className="text-white">
              {sweetSpot.sweetSpotMin.toFixed(1)}-{sweetSpot.sweetSpotMax.toFixed(1)}R
            </span>
            , and hold winners around{" "}
            <span className="text-white">
              {formatHoldTime(profile.holdTime.sweetSpotMin)}-{formatHoldTime(profile.holdTime.sweetSpotMax)}
            </span>
            .
          </p>
        </div>
      </div>
    </WidgetWrapper>
  );
}
