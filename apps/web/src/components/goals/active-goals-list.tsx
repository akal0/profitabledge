"use client";

import { motion } from "motion/react";
import { MoreVertical, Trash2, Edit, Pause, Play } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { goalTemplates } from "./goal-templates";
import { toSentenceCaseTitle } from "./goal-text";
import { useState } from "react";
import {
  GoalContentSeparator,
  GoalSurface,
} from "./goal-surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Goal {
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
}

const TARGET_TYPE_META: Record<
  string,
  { label: string; format: "currency" | "percent" | "ratio" | "count" }
> = {
  profit: { label: "Profit", format: "currency" },
  winRate: { label: "Win rate", format: "percent" },
  consistency: { label: "Consistency", format: "percent" },
  rr: { label: "Average R:R", format: "ratio" },
  trades: { label: "Trades", format: "count" },
  streak: { label: "Streak", format: "count" },
  journalRate: { label: "Journal coverage", format: "percent" },
  ruleCompliance: { label: "Rule compliance", format: "percent" },
  edgeTradeRate: { label: "Edge-trade rate", format: "percent" },
  breakAfterLoss: { label: "Post-loss pause", format: "percent" },
  checklistCompletion: { label: "Checklist completion", format: "percent" },
};

function formatGoalValue(goal: Goal, rawValue: string) {
  const value = parseFloat(rawValue || "0");
  const meta = TARGET_TYPE_META[goal.targetType];

  switch (meta?.format) {
    case "currency":
      return `$${value.toFixed(0)}`;
    case "percent":
      return `${value.toFixed(0)}%`;
    case "ratio":
      return `${value.toFixed(2)}R`;
    case "count":
    default:
      return `${value.toFixed(0)}`;
  }
}

interface ActiveGoalsListProps {
  goals: Goal[];
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

export function ActiveGoalsList({
  goals,
  onEdit,
  onDelete,
  onPause,
  onResume,
}: ActiveGoalsListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getProgress = (goal: Goal) => {
    const current = parseFloat(goal.currentValue || "0");
    const target = parseFloat(goal.targetValue || "1");
    return Math.min((current / target) * 100, 100);
  };

  const getDeadlineText = (goal: Goal) => {
    if (!goal.deadline) return "No deadline";

    const deadline = new Date(goal.deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return "Overdue";
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days <= 7) return `${days} days left`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks left`;
    return `${Math.ceil(days / 30)} months left`;
  };

  const getColorForType = (targetType: string) => {
    const template = goalTemplates.find((t) => t.targetType === targetType);
    return template?.color || "#3b82f6";
  };

  if (goals.length === 0) {
    return (
      <GoalSurface>
        <div className="py-12 text-center">
          <p className="text-sm text-white/40">No active goals yet</p>
          <p className="mt-2 text-xs text-white/30">Create a goal to get started</p>
        </div>
      </GoalSurface>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal, index) => {
        const progress = getProgress(goal);
        const color = getColorForType(goal.targetType);
        const isHovered = hoveredId === goal.id;

        return (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onMouseEnter={() => setHoveredId(goal.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <GoalSurface className="transition-all">
              <div className="relative p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {toSentenceCaseTitle(goal.title)}
                    </h3>
                    {goal.description && (
                      <p className="truncate text-xs text-white/50">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-sm p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/70">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(goal)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Goal
                        </DropdownMenuItem>
                      )}
                      {goal.status === "active" && onPause && (
                        <DropdownMenuItem onClick={() => onPause(goal.id)}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause Goal
                        </DropdownMenuItem>
                      )}
                      {goal.status === "paused" && onResume && (
                        <DropdownMenuItem onClick={() => onResume(goal.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Resume Goal
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(goal.id)}
                          className="text-red-400"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Goal
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <GoalContentSeparator className="mb-3.5 mt-3.5" />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-shrink-0 self-start">
                    <ProgressRing
                      progress={progress}
                      size={72}
                      strokeWidth={5}
                      color={color}
                      showLabel={true}
                      animated={isHovered}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-[10px] text-white/45">
                        <span>
                          {formatGoalValue(goal, goal.currentValue)} /{" "}
                          {formatGoalValue(goal, goal.targetValue)}
                        </span>
                        <span>{getDeadlineText(goal)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <GoalContentSeparator className="mb-3 mt-3.5" />

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${color}15`,
                      color: color,
                    }}
                  >
                    {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}
                  </span>
                  <span className="inline-flex items-center rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/55">
                    {TARGET_TYPE_META[goal.targetType]?.label || goal.targetType}
                  </span>
                  {goal.status === "paused" && (
                    <span className="inline-flex items-center rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/45">
                      Paused
                    </span>
                  )}
                </div>
              </div>
            </GoalSurface>
          </motion.div>
        );
      })}
    </div>
  );
}
