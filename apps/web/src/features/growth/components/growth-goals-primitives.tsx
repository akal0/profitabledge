import type { LucideIcon } from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { cn } from "@/lib/utils";

export function GrowthStatCard({
  icon: Icon,
  label,
  value,
  color,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
  className?: string;
}) {
  return (
    <GoalSurface className={className}>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </GoalSurface>
  );
}

export function GrowthEmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border border-dashed border-white/10 px-4 py-5 text-xs text-white/35",
        className
      )}
    >
      {message}
    </div>
  );
}
