"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { TrendingUp, Flame } from "lucide-react";
import { GoalContentSeparator, GoalSurface } from "./goal-surface";

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
  streakType: "wins" | "greenDays" | "trades";
  className?: string;
}

type StreakTone = {
  color: string;
  backgroundColor: string;
  recordBadgeClassName: string;
  recordTextClassName: string;
};

const GREEN_STREAK_TONE: StreakTone = {
  color: "#10b981",
  backgroundColor: "#10b98115",
  recordBadgeClassName: "border-emerald-500/20 bg-emerald-500/10",
  recordTextClassName: "text-emerald-400",
};

const streakConfig = {
  wins: {
    label: "Win streak",
    icon: TrendingUp,
    unit: "wins",
  },
  greenDays: {
    label: "Green days",
    icon: Flame,
    unit: "days",
  },
  trades: {
    label: "Trade streak",
    icon: TrendingUp,
    color: "#3b82f6",
    unit: "trades",
  },
};

function getWinStreakTone(
  currentStreak: number,
  longestStreak: number
): StreakTone {
  const progressRatio =
    longestStreak > 0
      ? currentStreak / longestStreak
      : currentStreak > 0
      ? 1
      : 0;

  if (progressRatio >= 0.75) {
    return GREEN_STREAK_TONE;
  }

  if (progressRatio >= 0.35) {
    return {
      color: "#f59e0b",
      backgroundColor: "#f59e0b15",
      recordBadgeClassName: "border-amber-500/20 bg-amber-500/10",
      recordTextClassName: "text-amber-400",
    };
  }

  return {
    color: "#9ca3af",
    backgroundColor: "#9ca3af15",
    recordBadgeClassName: "border-slate-500/20 bg-slate-500/10",
    recordTextClassName: "text-slate-300",
  };
}

export function StreakTracker({
  currentStreak,
  longestStreak,
  streakType,
  className,
}: StreakTrackerProps) {
  const config = streakConfig[streakType];
  const Icon = config.icon;
  const progressToRecord =
    longestStreak > 0
      ? Math.min((currentStreak / longestStreak) * 100, 100)
      : currentStreak > 0
      ? 100
      : 0;
  const tone =
    streakType === "wins"
      ? getWinStreakTone(currentStreak, longestStreak)
      : streakType === "greenDays"
      ? GREEN_STREAK_TONE
      : {
          color: "#3b82f6",
          backgroundColor: "#3b82f615",
          recordBadgeClassName: "border-blue-500/20 bg-blue-500/10",
          recordTextClassName: "text-blue-300",
        };

  return (
    <div className={cn("h-full", className)}>
      <GoalSurface className="h-full">
        <div className="relative flex h-full flex-col overflow-hidden p-3.5">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" style={{ color: tone.color }} />
            <span className="text-xs text-white/50">{config.label}</span>
          </div>

          <div className="mt-auto">
            <GoalContentSeparator className="mb-5 mt-3.5" />

            <div className="mb-3">
              <div className="mb-0.5 text-4xl font-semibold text-white">
                {currentStreak}
              </div>
              <div className="text-xs text-white/40">current {config.unit}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-white/45">
                <span>Progress to record</span>
                <span>
                  {currentStreak} / {longestStreak}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: tone.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToRecord}%` }}
                  transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                />
              </div>
            </div>

            {currentStreak >= longestStreak && currentStreak > 0 && (
              <motion.div
                className={cn(
                  "mt-3 inline-flex items-center gap-2 self-start rounded-full px-2.5 py-1",
                  tone.recordBadgeClassName
                )}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    tone.recordTextClassName
                  )}
                >
                  New record!
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </GoalSurface>
    </div>
  );
}

// Streak calendar visualization
interface StreakCalendarProps {
  streakData: Array<{ date: string; hasStreak: boolean }>;
  className?: string;
}

export function StreakCalendar({ streakData, className }: StreakCalendarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-white/80">Last 30 Days</h3>
      <div className="grid grid-cols-10 gap-1">
        {streakData.map((day, index) => (
          <motion.div
            key={day.date}
            className={cn(
              "aspect-square rounded-sm",
              day.hasStreak ? "bg-teal-500/80" : "bg-white/10"
            )}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.01, duration: 0.2 }}
            title={day.date}
          />
        ))}
      </div>
    </div>
  );
}
