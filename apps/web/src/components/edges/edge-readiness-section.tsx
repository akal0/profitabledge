"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ShieldCheck,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EdgeReadinessBadge = {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "critical" | "neutral";
};

export type EdgeReadinessData = {
  score: number;
  label: string;
  summary: string;
  badges: EdgeReadinessBadge[];
  blockers: string[];
  nextActions: string[];
};

function getToneClasses(tone?: EdgeReadinessBadge["tone"]) {
  switch (tone) {
    case "positive":
      return "ring-teal-400/20 bg-teal-400/10 text-teal-100";
    case "warning":
      return "ring-amber-400/20 bg-amber-400/10 text-amber-100";
    case "critical":
      return "ring-rose-400/20 bg-rose-400/10 text-rose-100";
    default:
      return "ring-white/10 bg-white/5 text-white/80";
  }
}

function getScoreTone(score: number) {
  if (score >= 75) {
    return {
      icon: CheckCircle2,
      iconClassName: "text-teal-300",
      railClassName: "bg-teal-400",
    };
  }

  if (score >= 45) {
    return {
      icon: ShieldCheck,
      iconClassName: "text-amber-300",
      railClassName: "bg-amber-400",
    };
  }

  return {
    icon: AlertTriangle,
    iconClassName: "text-rose-300",
    railClassName: "bg-rose-400",
  };
}

export function EdgeReadinessSection({
  readiness,
}: {
  readiness: EdgeReadinessData | null;
}) {
  if (!readiness) {
    return (
      <GoalSurface className="w-full">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <CircleDashed className="h-4 w-4 text-white/45" />
            <p className="text-sm font-medium text-white/78">Readiness</p>
          </div>
          <GoalContentSeparator className="mb-4 mt-4" />
          <p className="text-sm text-white/45">
            Readiness signals will appear once Edge versioning and fit scoring
            are available for this setup.
          </p>
        </div>
      </GoalSurface>
    );
  }

  const tone = getScoreTone(readiness.score);
  const ScoreIcon = tone.icon;

  return (
    <GoalSurface className="w-full">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ScoreIcon className={cn("h-4 w-4", tone.iconClassName)} />
              <p className="text-sm font-medium text-white/78">Readiness</p>
            </div>
            <p className="mt-1 text-xs text-white/45">
              How ready this Edge is for repeatable deployment.
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              readiness.score >= 75
                ? "ring-teal-400/20 bg-teal-400/10 text-teal-100"
                : readiness.score >= 45
                ? "ring-amber-400/20 bg-amber-400/10 text-amber-100"
                : "ring-rose-400/20 bg-rose-400/10 text-rose-100"
            )}
          >
            {readiness.label} · {readiness.score}/100
          </Badge>
        </div>

        <GoalContentSeparator className="mb-4 mt-4" />

        <p className="text-sm leading-6 text-white/68">{readiness.summary}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {readiness.badges.map((badge) => (
            <GoalSurface key={badge.label} innerClassName="h-full overflow-hidden">
              <div className="p-3">
                <p className="text-xs font-medium text-white/52">{badge.label}</p>
                <GoalContentSeparator className="mb-3 mt-3" />
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", getToneClasses(badge.tone))}
                >
                  {badge.value}
                </Badge>
              </div>
            </GoalSurface>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <GoalSurface innerClassName="h-full overflow-hidden">
            <div className="p-3">
              <p className="text-xs font-medium text-white/52">Current blockers</p>
              <GoalContentSeparator className="mb-3 mt-3" />
              <div className="space-y-2 text-sm text-white/68">
                {readiness.blockers.length > 0 ? (
                  readiness.blockers.map((item) => (
                    <p key={item}>{item}</p>
                  ))
                ) : (
                  <p>No immediate blockers detected.</p>
                )}
              </div>
            </div>
          </GoalSurface>

          <GoalSurface innerClassName="h-full overflow-hidden">
            <div className="p-3">
              <p className="text-xs font-medium text-white/52">Next actions</p>
              <GoalContentSeparator className="mb-3 mt-3" />
              <div className="space-y-2 text-sm text-white/68">
                {readiness.nextActions.length > 0 ? (
                  readiness.nextActions.map((item) => (
                    <p key={item}>{item}</p>
                  ))
                ) : (
                  <p>No follow-up actions queued yet.</p>
                )}
              </div>
            </div>
          </GoalSurface>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={cn("h-full rounded-full", tone.railClassName)}
            style={{ width: `${Math.max(6, Math.min(readiness.score, 100))}%` }}
          />
        </div>
      </div>
    </GoalSurface>
  );
}
