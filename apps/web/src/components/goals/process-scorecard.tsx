"use client";

import type { ComponentType } from "react";
import { BookOpen, CheckSquare, Shield, TimerReset, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { GoalContentSeparator, GoalPanel, GoalSurface } from "./goal-surface";
import { toSentenceCaseTitle } from "./goal-text";

type ProcessMetric = {
  key: string;
  label: string;
  value: number;
  target?: number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
};

type ProcessScorecardProps = {
  metrics: {
    totalTrades: number;
    journalRate: number;
    ruleCompliance: number;
    edgeTradeRate: number;
    breakAfterLoss: number;
    checklistCompletion: number;
    lossesTracked: number;
    checklistSamples: number;
  };
  recommendedGoals?: Array<{
    targetType: string;
    title: string;
    description: string;
    targetValue: number;
  }>;
  existingGoalTypes?: string[];
  onCreateGoal?: (goal: {
    targetType: string;
    title: string;
    description: string;
    targetValue: number;
  }) => void | Promise<void>;
  creatingGoalType?: string | null;
};

function getStatus(value: number, target = 80) {
  if (value >= target) return "strong";
  if (value >= target * 0.8) return "watch";
  return "weak";
}

export function ProcessScorecard({
  metrics,
  recommendedGoals = [],
  existingGoalTypes = [],
  onCreateGoal,
  creatingGoalType = null,
}: ProcessScorecardProps) {
  const metricCards: ProcessMetric[] = [
    {
      key: "ruleCompliance",
      label: "Rule compliance",
      value: metrics.ruleCompliance,
      target: 90,
      description: "Share of recent trades marked as aligned with your protocol.",
      icon: Shield,
      color: "text-teal-300",
    },
    {
      key: "edgeTradeRate",
      label: "Edge trade rate",
      value: metrics.edgeTradeRate,
      target: 85,
      description: "How often recent trades had a tagged session or model.",
      icon: TrendingUp,
      color: "text-lime-300",
    },
    {
      key: "journalRate",
      label: "Journal coverage",
      value: metrics.journalRate,
      target: 80,
      description: "Closed trades linked into journal reviews.",
      icon: BookOpen,
      color: "text-sky-300",
    },
    {
      key: "breakAfterLoss",
      label: "Post-loss pause",
      value: metrics.breakAfterLoss,
      target: 80,
      description: "Losses followed by at least a 15-minute pause before the next trade.",
      icon: TimerReset,
      color: "text-orange-300",
    },
    {
      key: "checklistCompletion",
      label: "Checklist completion",
      value: metrics.checklistCompletion,
      target: 90,
      description: "Average pre-trade checklist completion rate.",
      icon: CheckSquare,
      color: "text-fuchsia-300",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Process scorecard</h2>
          <p className="text-sm text-white/55">
            Discipline metrics from your last {metrics.totalTrades} closed trades.
          </p>
        </div>
        <div className="text-right text-xs text-white/45">
          <div>{metrics.lossesTracked} loss events checked for reset discipline</div>
          <div>{metrics.checklistSamples} checklist samples available</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {metricCards.map((metric) => {
          const status = getStatus(metric.value, metric.target);
          const railClass =
            status === "strong"
              ? "bg-teal-400"
              : status === "watch"
                ? "bg-yellow-400"
                : "bg-rose-400";
          const Icon = metric.icon;

          return (
            <GoalSurface key={metric.key}>
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${metric.color}`} />
                  <span className="text-xs text-white/50">{metric.label}</span>
                </div>
                <GoalContentSeparator className="mb-3.5 mt-3.5" />
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-semibold text-white">
                    {metric.value.toFixed(0)}%
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    Target {metric.target}%
                  </span>
                </div>
                <p className="mt-2 min-h-[40px] text-[11px] leading-4 text-white/40">
                  {metric.description}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full ${railClass}`}
                    style={{ width: `${Math.max(0, Math.min(metric.value, 100))}%` }}
                  />
                </div>
              </div>
            </GoalSurface>
          );
        })}
      </div>

      {recommendedGoals.length > 0 && onCreateGoal ? (
        <GoalPanel
          title="Recommended process goals"
          description="Turn weak discipline spots into explicit targets."
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {recommendedGoals.map((goal) => {
              const disabled = existingGoalTypes.includes(goal.targetType);
              const isCreating = creatingGoalType === goal.targetType;
              return (
                <div
                  key={goal.targetType}
                  className="rounded-sm border border-white/5 bg-white/[0.03] p-3"
                >
                  <div className="text-xs font-medium text-white">
                    {toSentenceCaseTitle(goal.title)}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-white/40">{goal.description}</p>
                  <Button
                    type="button"
                    disabled={disabled || isCreating}
                    onClick={() => void onCreateGoal(goal)}
                    className={getPropAssignActionButtonClassName({
                      tone: "neutral",
                      size: "sm",
                      className: "mt-3 gap-1.5 text-white",
                    })}
                  >
                    {disabled ? "Already active" : isCreating ? "Creating..." : "Create goal"}
                  </Button>
                </div>
              );
            })}
          </div>
        </GoalPanel>
      ) : null}
    </section>
  );
}
