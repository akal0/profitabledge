"use client";

import { motion } from "motion/react";
import { MoreVertical, Trash2, Edit, Pause, Play } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { goalTemplates } from "./goal-templates";
import { useState } from "react";
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
      <div className="text-center py-12">
        <p className="text-white/40 text-sm">No active goals yet</p>
        <p className="text-white/30 text-xs mt-2">Create a goal to get started</p>
      </div>
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
            className="group rounded-sm border border-white/5 bg-sidebar p-1.5 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onMouseEnter={() => setHoveredId(goal.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="relative rounded-sm bg-sidebar-accent p-4 transition-all duration-250 group-hover:brightness-120">
              <div className="flex items-center gap-4">
                {/* Progress ring */}
                <div className="flex-shrink-0">
                  <ProgressRing
                    progress={progress}
                    size={72}
                    strokeWidth={5}
                    color={color}
                    showLabel={true}
                    animated={isHovered}
                  />
                </div>

                {/* Goal info */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="truncate text-xs text-white/50">
                          {goal.description}
                        </p>
                      )}
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/70">
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

                  {/* Progress bar */}
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-white/45">
                      <span>{formatGoalValue(goal, goal.currentValue)} / {formatGoalValue(goal, goal.targetValue)}</span>
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

                  {/* Type badge */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${color}15`,
                        color: color,
                      }}
                    >
                      {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}
                    </span>
                    <span className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/55">
                      {TARGET_TYPE_META[goal.targetType]?.label || goal.targetType}
                    </span>
                    {goal.status === "paused" && (
                      <span className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/45">
                        Paused
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
