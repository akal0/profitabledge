"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Trophy, Star, TrendingUp, Target, Award } from "lucide-react";
import confetti from "canvas-confetti";

interface MilestoneCelebrationProps {
  show: boolean;
  milestone: {
    type: "goal_completed" | "streak_record" | "profit_milestone" | "consistency";
    title: string;
    description?: string;
    value?: number;
  };
  onClose: () => void;
}

const milestoneConfig = {
  goal_completed: {
    icon: Trophy,
    color: "#fbbf24",
    title: "Goal Achieved!",
    gradient: "from-yellow-500/20 to-orange-500/20",
  },
  streak_record: {
    icon: TrendingUp,
    color: "#f97316",
    title: "New Record!",
    gradient: "from-orange-500/20 to-red-500/20",
  },
  profit_milestone: {
    icon: Star,
    color: "#10b981",
    title: "Milestone Reached!",
    gradient: "from-green-500/20 to-teal-500/20",
  },
  consistency: {
    icon: Award,
    color: "#8b5cf6",
    title: "Consistency Master!",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
};

export function MilestoneCelebration({
  show,
  milestone,
  onClose,
}: MilestoneCelebrationProps) {
  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const config = milestoneConfig[milestone.type];
  const Icon = config.icon;

  useEffect(() => {
    if (show && !hasShownConfetti) {
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = [config.color, "#ffffff", "#10b981", "#3b82f6"];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      setHasShownConfetti(true);
    }

    if (!show) {
      setHasShownConfetti(false);
    }
  }, [show, hasShownConfetti, config.color]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Celebration modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`relative pointer-events-auto max-w-md w-full rounded-2xl border border-white/20 bg-gradient-to-br ${config.gradient} backdrop-blur-xl p-8 shadow-2xl`}
              initial={{ scale: 0.5, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Glow effect */}
              <div
                className="absolute inset-0 opacity-30 blur-3xl rounded-2xl"
                style={{
                  background: `radial-gradient(circle at center, ${config.color}, transparent 70%)`,
                }}
              />

              {/* Content */}
              <div className="relative z-10 text-center">
                {/* Animated icon */}
                <motion.div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                  style={{ backgroundColor: `${config.color}30` }}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    delay: 0.2,
                  }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 10, -10, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  >
                    <Icon className="w-10 h-10" style={{ color: config.color }} />
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  className="text-3xl font-bold text-white mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {config.title}
                </motion.h2>

                {/* Milestone title */}
                <motion.p
                  className="text-xl text-white/90 mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {milestone.title}
                </motion.p>

                {/* Description */}
                {milestone.description && (
                  <motion.p
                    className="text-sm text-white/60 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {milestone.description}
                  </motion.p>
                )}

                {/* Value badge */}
                {milestone.value !== undefined && (
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor: `${config.color}20`,
                      borderColor: `${config.color}40`,
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, type: "spring" }}
                  >
                    <Target className="w-4 h-4" style={{ color: config.color }} />
                    <span className="text-white font-semibold">
                      {milestone.value}
                    </span>
                  </motion.div>
                )}

                {/* Close button */}
                <motion.button
                  className="mt-8 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                  onClick={onClose}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Compact achievement badge
interface AchievementBadgeProps {
  type: "goal_completed" | "streak_record" | "profit_milestone" | "consistency";
  title: string;
  date: string;
  className?: string;
}

export function AchievementBadge({
  type,
  title,
  date,
  className,
}: AchievementBadgeProps) {
  const config = milestoneConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      className={`flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5 ${className}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02 }}
    >
      <div
        className="flex-shrink-0 p-2 rounded-lg"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <p className="text-xs text-white/50">{date}</p>
      </div>
    </motion.div>
  );
}
