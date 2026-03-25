"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number; // diameter in pixels
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#10b981",
  backgroundColor = "#ffffff10",
  showLabel = true,
  label,
  className,
  animated = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          initial={animated ? { strokeDashoffset: circumference } : false}
          animate={animated ? { strokeDashoffset: offset } : false}
          transition={{
            duration: 1,
            ease: "easeOut",
            delay: 0.2,
          }}
        />
      </svg>

      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-semibold text-white"
            style={{ fontSize: size <= 80 ? size * 0.18 : size * 0.2 }}
          >
            {Math.round(progress)}%
          </span>
          {label && (
            <span className="text-xs text-white/60 mt-1">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Multiple rings stacked (like Apple Watch Activity rings)
interface ActivityRingsProps {
  rings: Array<{
    progress: number;
    color: string;
    label?: string;
  }>;
  size?: number;
  className?: string;
}

export function ActivityRings({ rings, size = 180, className }: ActivityRingsProps) {
  const strokeWidth = 12;
  const gap = 6;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {rings.map((ring, index) => {
          const adjustedSize = size - index * (strokeWidth + gap) * 2;
          const radius = (adjustedSize - strokeWidth) / 2;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (ring.progress / 100) * circumference;
          const centerOffset = index * (strokeWidth + gap);

          return (
            <g key={index}>
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#ffffff08"
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Progress circle */}
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{
                  duration: 1.2,
                  ease: "easeOut",
                  delay: index * 0.2,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-center">
          {rings.map((ring, index) => (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ring.color }}
              />
              <span className="text-white/80">{ring.label}</span>
              <span className="text-white font-semibold">
                {Math.round(ring.progress)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
