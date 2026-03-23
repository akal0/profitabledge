"use client";

import { cn } from "@/lib/utils";
import { entryTypeConfig, generatePatternSeed } from "@/components/journal/list/list-types";

export function EntryCoverPattern({
  entryType,
  title,
  className,
}: {
  entryType?: string;
  title: string;
  className?: string;
}) {
  const config =
    entryTypeConfig[entryType as keyof typeof entryTypeConfig] ??
    entryTypeConfig.general;
  const seed = generatePatternSeed(title);
  const patternType = seed % 3;
  const rotation = (seed % 60) - 30;
  const patternId =
    patternType === 0
      ? `dots-${seed}`
      : patternType === 1
        ? `grid-${seed}`
        : `diag-${seed}`;

  return (
    <div className={cn("relative h-20 overflow-hidden bg-sidebar-accent", className)}>
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          background: `linear-gradient(${120 + rotation}deg, ${config.accent}, transparent 70%)`,
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `rotate(${rotation}deg) scale(1.3)` }}
      >
        <defs>
          {patternType === 0 ? (
            <pattern
              id={patternId}
              x="0"
              y="0"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill={config.accent} />
            </pattern>
          ) : patternType === 1 ? (
            <pattern
              id={patternId}
              x="0"
              y="0"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke={config.accent}
                strokeWidth="0.5"
              />
            </pattern>
          ) : (
            <pattern
              id={patternId}
              x="0"
              y="0"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 0 12 L 12 0 M -3 3 L 3 -3 M 9 15 L 15 9"
                stroke={config.accent}
                strokeWidth="0.5"
                fill="none"
              />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      <div
        className="absolute -bottom-6 opacity-[0.08] blur-2xl"
        style={{
          width: 120,
          height: 60,
          left: `${20 + (seed % 50)}%`,
          background: `radial-gradient(ellipse, ${config.accent}, transparent)`,
        }}
      />
    </div>
  );
}
