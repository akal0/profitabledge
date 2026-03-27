"use client";

import { Building2, CircleDashed, Shield, Target } from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EdgeAccountFitRecommendation = {
  accountId: string;
  accountName: string;
  label?: string | null;
  score?: number | null;
  broker?: string | null;
  isProp?: boolean | null;
  reasons: string[];
  lastUsedAt?: string | Date | null;
};

export type EdgeAccountFitData = {
  summary: string;
  recommendations: EdgeAccountFitRecommendation[];
  cautions?: string[];
};

function formatScore(score?: number | null) {
  if (score == null || !Number.isFinite(score)) {
    return "Pending";
  }

  return `${Math.round(score)}% match`;
}

function getScoreTone(score?: number | null) {
  if (score == null || !Number.isFinite(score)) {
    return "ring-white/10 bg-white/5 text-white/75";
  }

  if (score >= 75) {
    return "ring-teal-400/20 bg-teal-400/10 text-teal-100";
  }

  if (score >= 45) {
    return "ring-amber-400/20 bg-amber-400/10 text-amber-100";
  }

  return "ring-rose-400/20 bg-rose-400/10 text-rose-100";
}

export function EdgeAccountFitSection({
  accountFit,
}: {
  accountFit: EdgeAccountFitData | null;
}) {
  if (!accountFit) {
    return (
      <GoalSurface className="w-full">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <CircleDashed className="h-4 w-4 text-white/45" />
            <p className="text-sm font-medium text-white/78">Account fit</p>
          </div>
          <GoalContentSeparator className="mb-4 mt-4" />
          <p className="text-sm text-white/45">
            Account matching will appear once the Edge has enough history to
            compare against your live accounts.
          </p>
        </div>
      </GoalSurface>
    );
  }

  return (
    <GoalSurface className="w-full">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-300" />
          <p className="text-sm font-medium text-white/78">Account fit</p>
        </div>
        <GoalContentSeparator className="mb-4 mt-4" />
        <p className="text-sm leading-6 text-white/68">{accountFit.summary}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {accountFit.recommendations.length > 0 ? (
            accountFit.recommendations.map((recommendation) => (
              <GoalSurface
                key={recommendation.accountId}
                innerClassName="h-full overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {recommendation.accountName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                        {recommendation.broker ? (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {recommendation.broker}
                          </span>
                        ) : null}
                        {recommendation.isProp ? (
                          <span className="inline-flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5" />
                            Prop account
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        getScoreTone(recommendation.score)
                      )}
                    >
                      {recommendation.label ||
                        formatScore(recommendation.score)}
                    </Badge>
                  </div>

                  <GoalContentSeparator className="mb-3 mt-3" />

                  <div className="space-y-2 text-sm text-white/68">
                    {recommendation.reasons.length > 0 ? (
                      recommendation.reasons.map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))
                    ) : (
                      <p>No fit notes yet.</p>
                    )}
                  </div>
                </div>
              </GoalSurface>
            ))
          ) : (
            <GoalSurface
              className="xl:col-span-2"
              innerClassName="overflow-hidden"
            >
              <div className="px-4 py-5 text-sm text-white/45">
                No account recommendations yet.
              </div>
            </GoalSurface>
          )}
        </div>

        {accountFit.cautions?.length ? (
          <GoalSurface
            className="mt-4 ring-amber-300/25! ring bg-amber-400/[0.08]"
            innerClassName="overflow-hidden bg-amber-400/[0.01]! ring-amber-300/15"
          >
            <div className="p-3 space-y-1">
              <p className="text-xs font-medium text-amber-100/76">Cautions</p>
              {/*<GoalContentSeparator className="mb-3 mt-3" />*/}
              <div className="space-y-2 text-xs text-amber-50/80">
                {accountFit.cautions.map((item) => (
                  <p key={item}>{item} l</p>
                ))}
              </div>
            </div>
          </GoalSurface>
        ) : null}
      </div>
    </GoalSurface>
  );
}
