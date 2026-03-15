"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Award, Target, TrendingUp, type LucideIcon } from "lucide-react";

import { CreateGoalDialog } from "@/components/goals/create-goal-dialog";
import { ActiveGoalsList } from "@/components/goals/active-goals-list";
import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { MilestoneCelebration } from "@/components/goals/milestone-celebration";
import { ProcessScorecard } from "@/components/goals/process-scorecard";
import { ProgressRing } from "@/components/goals/progress-ring";
import { StreakTracker } from "@/components/goals/streak-tracker";
import { isAllAccountsScope, useAccountStore } from "@/stores/account";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { useGoalDialog } from "@/stores/goal-dialog";

type GoalRow = {
  id: string;
  type: string;
  targetType: string;
  targetValue: string;
  currentValue: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  startDate: string;
  isCustom?: boolean | null;
};

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <GoalSurface>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </GoalSurface>
  );
}

function invalidateGoals(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith("goals.");
    },
  });
}

export default function GoalsPage() {
  const selectedAccountId = useAccountStore((state) => state.selectedAccountId);
  const scopedAccountId =
    selectedAccountId && !isAllAccountsScope(selectedAccountId)
      ? selectedAccountId
      : undefined;
  const queryClient = useQueryClient();
  const { open: createDialogOpen, setOpen: setCreateDialogOpen } = useGoalDialog();
  const [celebrationData, setCelebrationData] = useState<{
    show: boolean;
    milestone: {
      type: "goal_completed" | "streak_record" | "profit_milestone" | "consistency";
      title: string;
      description?: string;
      value?: number;
    };
  }>({
    show: false,
    milestone: {
      type: "goal_completed",
      title: "",
    },
  });
  const refreshKeyRef = useRef<string | null>(null);

  const { data: goals = [], isLoading: isLoadingGoals } = useQuery({
    ...trpcOptions.goals.list.queryOptions({
      accountId: scopedAccountId,
      status: "active",
    }),
  });

  const { data: stats } = useQuery({
    ...trpcOptions.goals.getStats.queryOptions({
      accountId: scopedAccountId,
    }),
  });

  const { data: streaks } = useQuery({
    ...trpcOptions.goals.getStreaks.queryOptions({
      accountId: scopedAccountId,
    }),
  });

  const { data: processScorecard } = useQuery({
    ...trpcOptions.goals.getProcessScorecard.queryOptions({
      accountId: scopedAccountId,
    }),
  });

  const activeGoals = useMemo(() => (goals as GoalRow[]) || [], [goals]);
  const processGoals = useMemo(
    () =>
      activeGoals.filter((goal) =>
        [
          "journalRate",
          "ruleCompliance",
          "edgeTradeRate",
          "breakAfterLoss",
          "checklistCompletion",
          "maxRiskPerTrade",
        ].includes(goal.targetType)
      ),
    [activeGoals]
  );
  const outcomeGoals = useMemo(
    () =>
      activeGoals.filter(
        (goal) => !processGoals.some((processGoal) => processGoal.id === goal.id)
      ),
    [activeGoals, processGoals]
  );

  useEffect(() => {
    const refreshKey = `${scopedAccountId ?? "all"}:${activeGoals
      .map((goal) => `${goal.id}:${goal.currentValue}`)
      .join("|")}`;

    if (!activeGoals.length || refreshKeyRef.current === refreshKey) {
      return;
    }

    refreshKeyRef.current = refreshKey;

    const run = async () => {
      const refreshes: Promise<unknown>[] = [
        trpcClient.goals.evaluateProcessGoals.mutate({
          accountId: scopedAccountId,
        }),
      ];

      activeGoals
        .filter((goal) => goal.isCustom)
        .forEach((goal) => {
          refreshes.push(
            trpcClient.goals.refreshCustomGoalProgress.mutate({ goalId: goal.id })
          );
        });

      try {
        await Promise.all(refreshes);
        await invalidateGoals(queryClient);
      } catch (error) {
        console.error("Failed to refresh goals state:", error);
      }
    };

    void run();
  }, [activeGoals, scopedAccountId, queryClient]);

  const handleDeleteGoal = async (id: string) => {
    try {
      await trpcClient.goals.delete.mutate({ id });
      await invalidateGoals(queryClient);
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  };

  const handlePauseGoal = async (id: string) => {
    try {
      await trpcClient.goals.update.mutate({ id, status: "paused" });
      await invalidateGoals(queryClient);
    } catch (error) {
      console.error("Failed to pause goal:", error);
    }
  };

  const handleResumeGoal = async (id: string) => {
    try {
      await trpcClient.goals.update.mutate({ id, status: "active" });
      await invalidateGoals(queryClient);
    } catch (error) {
      console.error("Failed to resume goal:", error);
    }
  };

  const handleCreateSuggestedGoal = async (goal: {
    targetType: string;
    title: string;
    description: string;
    targetValue: number;
  }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await trpcClient.goals.create.mutate({
        accountId: scopedAccountId || null,
        type: "monthly",
        targetType: goal.targetType as
          | "profit"
          | "winRate"
          | "consistency"
          | "rr"
          | "trades"
          | "streak"
          | "journalRate"
          | "ruleCompliance"
          | "edgeTradeRate"
          | "maxRiskPerTrade"
          | "breakAfterLoss"
          | "checklistCompletion",
        targetValue: goal.targetValue,
        startDate: today,
        deadline: nextMonth.toISOString().split("T")[0],
        title: goal.title,
        description: goal.description,
      });

      await invalidateGoals(queryClient);
    } catch (error) {
      console.error("Failed to create suggested goal:", error);
    }
  };

  const processGoalTypes = useMemo(
    () => processGoals.map((goal) => goal.targetType),
    [processGoals]
  );

  if (!selectedAccountId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Target className="mx-auto mb-4 h-12 w-12 text-white/20" />
          <p className="text-white/40">Select an account or use All Accounts to track goals.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="space-y-6 p-6 py-4">
        {stats ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              {
                icon: Target,
                label: "Active goals",
                value: stats.active,
                color: "text-blue-400",
              },
              {
                icon: Award,
                label: "Achieved",
                value: stats.achieved,
                color: "text-teal-400",
              },
              {
                icon: TrendingUp,
                label: "Total goals",
                value: stats.total,
                color: "text-purple-400",
              },
              {
                icon: Target,
                label: "Success rate",
                value: `${stats.achievementRate.toFixed(0)}%`,
                color: "text-orange-400",
              },
            ].map((card, index) => {
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * (index + 1) }}
                >
                  <OverviewStatCard
                    icon={card.icon}
                    label={card.label}
                    value={card.value}
                    color={card.color}
                  />
                </motion.div>
              );
            })}
          </div>
        ) : null}

        {streaks ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StreakTracker
              className="min-h-[220px]"
              currentStreak={streaks.currentWinStreak}
              longestStreak={streaks.longestWinStreak}
              streakType="wins"
            />
            <StreakTracker
              className="min-h-[220px]"
              currentStreak={streaks.currentGreenDays}
              longestStreak={streaks.longestGreenDays}
              streakType="greenDays"
            />
            <motion.div
              className="h-full min-h-[220px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <GoalSurface className="h-full">
                <div className="flex h-full flex-col p-3.5">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-teal-300" />
                    <span className="text-xs text-white/50">Goal hit rate</span>
                  </div>
                  <GoalContentSeparator className="mb-5 mt-3.5" />
                  <div className="flex flex-1 items-center justify-center">
                    <ProgressRing
                      progress={stats?.achievementRate || 0}
                      size={120}
                      strokeWidth={9}
                      color="#14b8a6"
                      label="Goal hit rate"
                    />
                  </div>
                </div>
              </GoalSurface>
            </motion.div>
          </div>
        ) : null}

        {processScorecard?.hasTrades ? (
          <ProcessScorecard
            metrics={processScorecard}
            recommendedGoals={processScorecard.recommendedGoals}
            existingGoalTypes={processGoalTypes}
            onCreateGoal={handleCreateSuggestedGoal}
          />
        ) : (
          <GoalSurface>
            <div className="p-5 text-sm text-white/55">
              Process scorecard will appear once you have closed trades in this scope.
            </div>
          </GoalSurface>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Outcome goals</h2>
            {isLoadingGoals ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-white/40">Loading goals...</p>
              </div>
            ) : (
              <ActiveGoalsList
                goals={outcomeGoals}
                onDelete={handleDeleteGoal}
                onPause={handlePauseGoal}
                onResume={handleResumeGoal}
              />
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Process goals</h2>
            {isLoadingGoals ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-white/40">Loading goals...</p>
              </div>
            ) : (
              <ActiveGoalsList
                goals={processGoals}
                onDelete={handleDeleteGoal}
                onPause={handlePauseGoal}
                onResume={handleResumeGoal}
              />
            )}
          </section>
        </div>
      </main>

      <CreateGoalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        accountId={scopedAccountId}
      />

      <MilestoneCelebration
        show={celebrationData.show}
        milestone={celebrationData.milestone}
        onClose={() => setCelebrationData((previous) => ({ ...previous, show: false }))}
      />
    </>
  );
}
