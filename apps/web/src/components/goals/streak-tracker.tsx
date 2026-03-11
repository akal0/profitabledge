"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { TrendingUp, Flame } from "lucide-react";

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
  streakType: "wins" | "greenDays" | "trades";
  className?: string;
}

const streakConfig = {
  wins: {
    label: "Win Streak",
    icon: TrendingUp,
    color: "#10b981",
    unit: "wins",
  },
  greenDays: {
    label: "Green Days",
    icon: Flame,
    color: "#f59e0b",
    unit: "days",
  },
  trades: {
    label: "Trade Streak",
    icon: TrendingUp,
    color: "#3b82f6",
    unit: "trades",
  },
};

export function StreakTracker({
  currentStreak,
  longestStreak,
  streakType,
  className,
}: StreakTrackerProps) {
  const config = streakConfig[streakType];
  const Icon = config.icon;

  return (
    <motion.div
      className={cn(
        "group rounded-sm border border-white/5 bg-sidebar p-1.5",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative overflow-hidden rounded-sm bg-sidebar-accent p-4 transition-all duration-250 group-hover:brightness-120">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <div
            className="rounded p-1.5"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
          </div>
          <span className="text-xs text-white/50">{config.label}</span>
        </div>

        {/* Current streak */}
        <div className="mb-5">
          <motion.div
            className="mb-0.5 text-4xl font-semibold text-white"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            {currentStreak}
          </motion.div>
          <div className="text-xs text-white/40">current {config.unit}</div>
        </div>

        {/* Progress bar to longest streak */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-white/45">
            <span>Progress to record</span>
            <span>
              {currentStreak} / {longestStreak}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: config.color }}
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min((currentStreak / longestStreak) * 100, 100)}%`,
              }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Record badge */}
        {currentStreak >= longestStreak && currentStreak > 0 && (
          <motion.div
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
          >
            <span className="text-[10px] font-medium text-yellow-400">
              New Record!
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
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
              day.hasStreak
                ? "bg-teal-500/80"
                : "bg-white/10"
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
