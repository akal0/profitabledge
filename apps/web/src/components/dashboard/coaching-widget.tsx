"use client";

import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import {
  Brain,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Target,
  Shield,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { useState } from "react";
import { WidgetWrapper } from "./widget-wrapper";

interface CoachingInsight {
  type: "edge" | "warning" | "tip" | "goal";
  title: string;
  message: string;
  priority: number;
}

const insightIcons = {
  edge: TrendingUp,
  warning: AlertTriangle,
  tip: Lightbulb,
  goal: Target,
};

const insightColors = {
  edge: "text-emerald-400 bg-emerald-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  tip: "text-blue-400 bg-blue-500/10",
  goal: "text-purple-400 bg-purple-500/10",
};

export function CoachingWidget({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: profileData, isLoading: profileLoading } =
    trpc.ai.getProfile.useQuery(
      { accountId: accountId ?? "" },
      { enabled: !!accountId, staleTime: 60_000 }
    );

  const { data: edgeData, isLoading: edgeLoading } =
    trpc.ai.getEdgeConditions.useQuery(
      { accountId: accountId ?? "" },
      { enabled: !!accountId, staleTime: 60_000 }
    );

  const isLoading = profileLoading || edgeLoading;
  const profile = profileData?.profile;

  // Generate coaching insights from profile data
  const insights: CoachingInsight[] = [];

  if (profile) {
    // Edge-based coaching
    if (edgeData?.edges?.length) {
      const topEdge = edgeData.edges[0];
      insights.push({
        type: "edge",
        title: "Trade Your Edge",
        message: `Your best edge is "${topEdge.label}" with ${topEdge.winRate.toFixed(0)}% win rate. Focus more trades here.`,
        priority: 1,
      });
    }

    // Leak warnings
    if (edgeData?.leaks?.length) {
      const topLeak = edgeData.leaks[0];
      insights.push({
        type: "warning",
        title: "Avoid This Leak",
        message: `"${topLeak.label}" has only ${topLeak.winRate.toFixed(0)}% WR with -$${Math.abs(topLeak.avgLoss).toFixed(0)} avg loss. Consider avoiding.`,
        priority: 2,
      });
    }

    // Win rate coaching
    if (profile.winRate < 45) {
      insights.push({
        type: "tip",
        title: "Improve Win Rate",
        message: `Your win rate is ${profile.winRate.toFixed(0)}%. Focus on higher-probability setups and tighter entry criteria.`,
        priority: 3,
      });
    } else if (profile.winRate > 60) {
      insights.push({
        type: "tip",
        title: "Optimize Winners",
        message: `Your ${profile.winRate.toFixed(0)}% win rate is strong. Consider holding winners longer to maximize R:R.`,
        priority: 3,
      });
    }

    // RR coaching
    const avgRR = profile.rrProfile?.avgRealisedRR ?? 0;
    if (avgRR < 1 && avgRR > 0) {
      insights.push({
        type: "warning",
        title: "R:R Below 1",
        message: `Average R:R is ${avgRR.toFixed(2)}. Aim for at least 1:1 to maintain profitability with your win rate.`,
        priority: 2,
      });
    }

    // Consistency coaching
    const consistency = profile.consistency?.consistencyScore ?? 0;
    if (consistency < 40) {
      insights.push({
        type: "tip",
        title: "Build Consistency",
        message: `Consistency score is ${consistency.toFixed(0)}. Try to trade the same setups at similar sizes each day.`,
        priority: 3,
      });
    }

    // Profit factor coaching
    if (profile.profitFactor > 0 && profile.profitFactor < 1.2) {
      insights.push({
        type: "warning",
        title: "Thin Edge",
        message: `Profit factor is ${profile.profitFactor.toFixed(2)}. Cut losers faster or let winners run to improve this.`,
        priority: 2,
      });
    }

    // Goal reminder
    insights.push({
      type: "goal",
      title: "Daily Reminder",
      message: "Review your rules before each session. Discipline compounds.",
      priority: 4,
    });
  }

  // Sort by priority
  insights.sort((a, b) => a.priority - b.priority);
  const displayInsights = insights.slice(0, 4);
  const currentInsight = displayInsights[activeIndex % displayInsights.length];

  if (isLoading) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Brain}
        title="Edge Coach"
        showHeader
        contentClassName="flex-col justify-end p-3.5"
      >
        <Skeleton className="flex-1" />
      </WidgetWrapper>
    );
  }

  if (!displayInsights.length) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Brain}
        title="Edge Coach"
        showHeader
        contentClassName="flex-col items-center justify-center p-3.5"
      >
        <Shield className="size-8 text-white/10 mb-2" />
        <p className="text-xs text-white/40">Keep trading to unlock coaching insights</p>
      </WidgetWrapper>
    );
  }

  const Icon = insightIcons[currentInsight.type];

  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={className}
      icon={Brain}
      title="Edge Coach"
      showHeader
      contentClassName="flex-col justify-end"
      headerRight={
        <span className="text-[10px] text-white/20">
          {activeIndex + 1}/{displayInsights.length}
        </span>
      }
    >
      <div className="flex-1 flex flex-col p-3.5">
        <div
          className="flex-1 flex flex-col gap-2 cursor-pointer"
          onClick={() =>
            !isEditing &&
            setActiveIndex((i) => (i + 1) % displayInsights.length)
          }
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center size-6 rounded-sm",
                insightColors[currentInsight.type]
              )}
            >
              <Icon className="size-3.5" />
            </div>
            <span className="text-xs font-medium text-white/90">
              {currentInsight.title}
            </span>
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">
            {currentInsight.message}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-2">
          {displayInsights.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => !isEditing && setActiveIndex(i)}
              className={cn(
                "size-1.5 rounded-full transition-all",
                i === activeIndex % displayInsights.length
                  ? "bg-violet-400 scale-125"
                  : "bg-white/15 hover:bg-white/25"
              )}
            />
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}
