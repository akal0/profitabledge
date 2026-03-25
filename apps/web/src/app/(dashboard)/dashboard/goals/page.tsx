"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, Target, TrendingUp, type LucideIcon } from "lucide-react";

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
import {
  Tabs,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { isAllAccountsScope, useAccountStore } from "@/stores/account";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { useGoalDialog } from "@/stores/goal-dialog";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { getGoalSchedule, type GoalType } from "@/lib/goals-dates";
import { invalidateGoalQueries } from "@/lib/goals-query";

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

type GoalLifecycleStatus = "active" | "paused" | "achieved" | "failed";

const PROCESS_TARGET_TYPES = new Set([
  "journalRate",
  "ruleCompliance",
  "edgeTradeRate",
  "breakAfterLoss",
  "checklistCompletion",
  "maxRiskPerTrade",
]);

const GOAL_LIFECYCLE_ORDER: GoalLifecycleStatus[] = [
  "active",
  "paused",
  "achieved",
  "failed",
];

const GOAL_LIFECYCLE_LABELS: Record<
  GoalLifecycleStatus,
  { title: string; emptyTitle: string; emptyDescription: string }
> = {
  active: {
    title: "Active goals",
    emptyTitle: "No active goals yet",
    emptyDescription: "Create a goal to get started",
  },
  paused: {
    title: "Paused goals",
    emptyTitle: "No paused goals",
    emptyDescription: "Paused goals will show up here when you need to step back without deleting them.",
  },
  achieved: {
    title: "Achieved goals",
    emptyTitle: "No achieved goals yet",
    emptyDescription: "Completed goals will stay here so you can review what you’ve closed out.",
  },
  failed: {
    title: "Failed goals",
    emptyTitle: "No failed goals",
    emptyDescription: "Missed goals will show here so you can review and rework them.",
  },
};

function isProcessGoal(goal: GoalRow) {
  return PROCESS_TARGET_TYPES.has(goal.targetType);
}

function getSuggestedGoalType(targetType: string): GoalType {
  switch (targetType) {
    case "ruleCompliance":
    case "edgeTradeRate":
    case "breakAfterLoss":
      return "weekly";
    case "journalRate":
    case "checklistCompletion":
    default:
      return "monthly";
  }
}

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

export default function GoalsPage() {
  const selectedAccountId = useAccountStore((state) => state.selectedAccountId);
  const scopedAccountId =
    selectedAccountId && !isAllAccountsScope(selectedAccountId)
      ? selectedAccountId
      : undefined;
  const queryClient = useQueryClient();
  const { open: createDialogOpen, setOpen: setCreateDialogOpen } =
    useGoalDialog();
  const [goalStatusTab, setGoalStatusTab] =
    useState<GoalLifecycleStatus>("active");
  const [creatingSuggestedGoalType, setCreatingSuggestedGoalType] =
    useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<{
    show: boolean;
    milestone: {
      type:
        | "goal_completed"
        | "streak_record"
        | "profit_milestone"
        | "consistency";
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
    }),
    staleTime: 30_000,
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

  const allGoals = useMemo(() => (goals as GoalRow[]) || [], [goals]);
  const goalsByStatus = useMemo(() => {
    const grouped = Object.fromEntries(
      GOAL_LIFECYCLE_ORDER.map((status) => [status, [] as GoalRow[]])
    ) as Record<GoalLifecycleStatus, GoalRow[]>;

    allGoals.forEach((goal) => {
      const status = GOAL_LIFECYCLE_ORDER.includes(
        goal.status as GoalLifecycleStatus
      )
        ? (goal.status as GoalLifecycleStatus)
        : "active";
      grouped[status].push(goal);
    });

    return grouped;
  }, [allGoals]);
  const activeGoals = goalsByStatus.active;
  const processGoals = useMemo(
    () => activeGoals.filter((goal) => isProcessGoal(goal)),
    [activeGoals]
  );
  const outcomeGoals = useMemo(
    () => activeGoals.filter((goal) => !isProcessGoal(goal)),
    [activeGoals]
  );
  const visibleLifecycleGoals = goalsByStatus[goalStatusTab];

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
            trpcClient.goals.refreshCustomGoalProgress.mutate({
              goalId: goal.id,
            })
          );
        });

      try {
        await Promise.all(refreshes);
        await invalidateGoalQueries(queryClient);
      } catch (error) {
        console.error("Failed to refresh goals state:", error);
      }
    };

    void run();
  }, [activeGoals, scopedAccountId, queryClient]);

  const handleDeleteGoal = async (id: string) => {
    try {
      await trpcClient.goals.delete.mutate({ id });
      await invalidateGoalQueries(queryClient);
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  };

  const handlePauseGoal = async (id: string) => {
    try {
      await trpcClient.goals.update.mutate({ id, status: "paused" });
      await invalidateGoalQueries(queryClient);
    } catch (error) {
      console.error("Failed to pause goal:", error);
    }
  };

  const handleResumeGoal = async (id: string) => {
    try {
      await trpcClient.goals.update.mutate({ id, status: "active" });
      await invalidateGoalQueries(queryClient);
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
    if (creatingSuggestedGoalType === goal.targetType) {
      return;
    }

    const goalType = getSuggestedGoalType(goal.targetType);
    const { startDate, deadline } = getGoalSchedule(goalType);

    setCreatingSuggestedGoalType(goal.targetType);

    try {
      await trpcClient.goals.create.mutate({
        accountId: scopedAccountId || null,
        type: goalType,
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
        startDate,
        deadline,
        title: goal.title,
        description: goal.description,
      });

      await invalidateGoalQueries(queryClient);
    } catch (error) {
      console.error("Failed to create suggested goal:", error);
    } finally {
      setCreatingSuggestedGoalType(null);
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
          <p className="text-white/40">
            Select an account or use All accounts to track goals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="space-y-6 p-6 py-4">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Goals</h1>
            <p className="mt-1 text-sm text-white/50">
              Set targets, track discipline, and keep progress visible across every account scope.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className={getPropAssignActionButtonClassName({
              tone: "neutral",
              className: "self-start gap-1.5 px-4 text-white",
            })}
          >
            <Plus className="h-4 w-4" />
            Create goal
          </Button>
        </section>

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
            ].map((card) => {
              return (
                <div key={card.label}>
                  <OverviewStatCard
                    icon={card.icon}
                    label={card.label}
                    value={card.value}
                    color={card.color}
                  />
                </div>
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
            <div className="h-full min-h-[220px]">
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
            </div>
          </div>
        ) : null}

        {processScorecard?.hasTrades ? (
          <ProcessScorecard
            metrics={processScorecard}
            recommendedGoals={processScorecard.recommendedGoals}
            existingGoalTypes={processGoalTypes}
            onCreateGoal={handleCreateSuggestedGoal}
            creatingGoalType={creatingSuggestedGoalType}
          />
        ) : (
          <GoalSurface>
            <div className="p-5 text-sm text-white/55">
              Process scorecard will appear once you have closed trades in this
              scope.
            </div>
          </GoalSurface>
        )}

        <Tabs
          value={goalStatusTab}
          onValueChange={(value) =>
            setGoalStatusTab(value as GoalLifecycleStatus)
          }
          className="space-y-6"
        >
          <div className="overflow-x-auto">
            <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5">
              {GOAL_LIFECYCLE_ORDER.map((status) => (
                <TabsTriggerUnderlined
                  key={status}
                  value={status}
                  className="gap-2 text-sm"
                >
                  <span>{GOAL_LIFECYCLE_LABELS[status].title}</span>
                  <span className="rounded-full bg-white/6 px-2 py-0.5 text-[11px] text-white/55">
                    {goalsByStatus[status].length}
                  </span>
                </TabsTriggerUnderlined>
              ))}
            </TabsListUnderlined>
          </div>

          {isLoadingGoals ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-white/40">Loading goals...</p>
            </div>
          ) : goalStatusTab === "active" ? (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section>
                <h2 className="mb-4 text-xl font-semibold text-white">
                  Outcome goals
                </h2>
                <ActiveGoalsList
                  goals={outcomeGoals}
                  onDelete={handleDeleteGoal}
                  onPause={handlePauseGoal}
                  onResume={handleResumeGoal}
                  emptyTitle="No active outcome goals"
                  emptyDescription="Outcome targets like profit, win rate, or streaks will show here."
                  emptyActionLabel="Create outcome goal"
                  onEmptyAction={() => setCreateDialogOpen(true)}
                />
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-white">
                  Process goals
                </h2>
                <ActiveGoalsList
                  goals={processGoals}
                  onDelete={handleDeleteGoal}
                  onPause={handlePauseGoal}
                  onResume={handleResumeGoal}
                  emptyTitle="No active process goals"
                  emptyDescription="Process-driven targets like journal rate or rule compliance will show here."
                  emptyActionLabel="Create process goal"
                  onEmptyAction={() => setCreateDialogOpen(true)}
                />
              </section>
            </div>
          ) : (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-white">
                {GOAL_LIFECYCLE_LABELS[goalStatusTab].title}
              </h2>
              <ActiveGoalsList
                goals={visibleLifecycleGoals}
                onDelete={handleDeleteGoal}
                onResume={
                  goalStatusTab === "paused" ? handleResumeGoal : undefined
                }
                emptyTitle={GOAL_LIFECYCLE_LABELS[goalStatusTab].emptyTitle}
                emptyDescription={
                  GOAL_LIFECYCLE_LABELS[goalStatusTab].emptyDescription
                }
              />
            </section>
          )}
        </Tabs>
      </main>

      <CreateGoalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        accountId={scopedAccountId}
      />

      <MilestoneCelebration
        show={celebrationData.show}
        milestone={celebrationData.milestone}
        onClose={() =>
          setCelebrationData((previous) => ({ ...previous, show: false }))
        }
      />
    </>
  );
}
