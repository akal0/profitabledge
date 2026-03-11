"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Target,
  Plus,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

interface GoalSelectorProps {
  entryId: string;
  linkedGoalIds?: string[];
  onChange?: (goalIds: string[]) => void;
  className?: string;
}

export function GoalSelector({
  entryId,
  linkedGoalIds = [],
  onChange,
  className,
}: GoalSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: goals = [], isLoading } = trpc.goals.list.useQuery({
    status: "active",
  });

  const { data: entryGoals = [] } = trpc.journal.getEntryGoals.useQuery({
    entryId,
  });

  const linkGoal = trpc.journal.linkGoal.useMutation();
  const unlinkGoal = trpc.journal.unlinkGoal.useMutation();

  const linkedIds = entryGoals.map((eg) => eg.goalId);

  const handleLinkGoal = async (goalId: string) => {
    await linkGoal.mutateAsync({ entryId, goalId });
    onChange?.([...linkedIds, goalId]);
  };

  const handleUnlinkGoal = async (goalId: string) => {
    await unlinkGoal.mutateAsync({ entryId, goalId });
    onChange?.(linkedIds.filter((id) => id !== goalId));
  };

  const isGoalLinked = (goalId: string) => linkedIds.includes(goalId);

  const getGoalProgress = (goal: any) => {
    const current = Number(goal.currentValue || 0);
    const target = Number(goal.targetValue || 1);
    return Math.min(100, (current / target) * 100);
  };

  const filteredGoals = goals.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-white/40" />
        <span className="text-xs text-white/60">Linked Goals</span>
      </div>

      {entryGoals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entryGoals.map((eg) => (
            <GoalBadge
              key={eg.id}
              goal={eg.goal}
              onRemove={() => handleUnlinkGoal(eg.goalId)}
            />
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-dashed border-white/20 text-white/40 hover:text-white hover:border-white/40"
          >
            <Plus className="h-3 w-3 mr-1" />
            Link goal
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-0 bg-sidebar border-white/10"
        >
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search goals..."
              value={search}
              onValueChange={setSearch}
              className="text-white placeholder:text-white/30"
            />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-sm text-white/40">
                No goals found
              </CommandEmpty>
              <CommandGroup>
                {filteredGoals.map((goal) => {
                  const linked = isGoalLinked(goal.id);
                  return (
                    <CommandItem
                      key={goal.id}
                      onSelect={() =>
                        linked ? handleUnlinkGoal(goal.id) : handleLinkGoal(goal.id)
                      }
                      className="flex items-center justify-between text-white/80 hover:text-white hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            goal.status === "achieved"
                              ? "bg-green-500"
                              : goal.status === "failed"
                              ? "bg-red-500"
                              : "bg-teal-500"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{goal.title}</p>
                          <div className="flex items-center gap-2 text-xs text-white/40">
                            <span>{goal.type}</span>
                            <span>•</span>
                            <span>{getGoalProgress(goal).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                      {linked && <Check className="h-4 w-4 text-teal-400" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface GoalBadgeProps {
  goal: any;
  onRemove: () => void;
}

function GoalBadge({ goal, onRemove }: GoalBadgeProps) {
  const progress = Number(goal.currentValue || 0) / Number(goal.targetValue || 1) * 100;

  return (
    <div className="group flex items-center gap-2 px-2 py-1 bg-sidebar-accent border border-white/10">
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          goal.status === "achieved"
            ? "bg-green-500"
            : goal.status === "failed"
            ? "bg-red-500"
            : "bg-teal-500"
        )}
      />
      <span className="text-xs text-white/80">{goal.title}</span>
      <span className="text-xs text-white/40">{Math.min(100, progress).toFixed(0)}%</span>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

interface GoalProgressCardProps {
  goal: any;
  contribution?: string;
  className?: string;
}

export function GoalProgressCard({ goal, contribution, className }: GoalProgressCardProps) {
  const current = Number(goal.currentValue || 0);
  const target = Number(goal.targetValue || 1);
  const progress = Math.min(100, (current / target) * 100);

  const isAchieved = goal.status === "achieved";
  const isFailed = goal.status === "failed";

  return (
    <div
      className={cn(
        "p-4 bg-sidebar-accent border border-white/10",
        isAchieved && "border-green-500/30",
        isFailed && "border-red-500/30",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-white">{goal.title}</h4>
          <p className="text-xs text-white/40 mt-0.5">
            {goal.type} goal
            {goal.deadline && (
              <>
                <span className="mx-1">•</span>
                <Calendar className="h-3 w-3 inline mr-0.5" />
                {format(new Date(goal.deadline), "MMM d")}
              </>
            )}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs",
            progress >= 100 ? "text-green-400" : progress >= 50 ? "text-teal-400" : "text-white/40"
          )}
        >
          {progress >= 50 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {progress.toFixed(0)}%
        </div>
      </div>

      <Progress value={progress} className="h-1.5 bg-white/10" />

      <div className="flex items-center justify-between mt-2 text-xs text-white/40">
        <span>
          {current.toFixed(2)} / {target.toFixed(2)} {goal.targetType}
        </span>
        {contribution && (
          <span className="text-teal-400">+{contribution} contribution</span>
        )}
      </div>
    </div>
  );
}
