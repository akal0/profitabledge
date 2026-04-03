"use client";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  Timer,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { TradePhase } from "@/components/journal/types";

interface TradePhaseSelectorProps {
  value?: TradePhase | null;
  onChange: (phase: TradePhase | null) => void;
  className?: string;
}

const phases: {
  id: TradePhase;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "pre-trade",
    label: "Pre-Trade",
    description: "Planning and analysis before entry",
    icon: Lightbulb,
  },
  {
    id: "during-trade",
    label: "During Trade",
    description: "Active position management",
    icon: Timer,
  },
  {
    id: "post-trade",
    label: "Post-Trade",
    description: "Review and lessons learned",
    icon: CheckCircle2,
  },
];

export function TradePhaseSelector({
  value,
  onChange,
  className,
}: TradePhaseSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Trade Phase (Optional)
      </div>
      <div className="grid grid-cols-3 gap-2">
        {phases.map((phase) => {
          const Icon = phase.icon;
          const isSelected = value === phase.id;

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onChange(isSelected ? null : phase.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200",
                "hover:bg-muted/50",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border/50"
              )}
            >
              <div
                className={cn(
                  "rounded-full p-2 transition-colors",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-medium",
                    isSelected ? "text-primary" : "text-foreground"
                  )}
                >
                  {phase.label}
                </p>
                <p className="text-[10px] text-muted-foreground hidden sm:block">
                  {phase.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TradePhaseBadge({
  phase,
  className,
}: {
  phase: TradePhase;
  className?: string;
}) {
  const config: Record<TradePhase, { icon: LucideIcon; color: string; bg: string }> = {
    "pre-trade": {
      icon: Lightbulb,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    "during-trade": {
      icon: Timer,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    "post-trade": {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  };

  const { icon: Icon, color, bg } = config[phase];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        bg,
        color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="capitalize">{phase.replace("-", " ")}</span>
    </div>
  );
}
