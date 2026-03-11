"use client";

import * as React from "react";
import { Lock, TrendingUp } from "lucide-react";

interface SampleGateStatus {
  tier: string;
  required: number;
  current: number;
  isUnlocked: boolean;
  message: string;
}

interface SampleGateBannerProps {
  status: SampleGateStatus[];
}

export function SampleGateBanner({ status }: SampleGateBannerProps) {
  // Find the next locked tier
  const nextLocked = status.find((s) => !s.isUnlocked);

  // If all unlocked (either by sample count OR by user preference), hide the banner entirely
  if (!nextLocked) {
    return null;
  }

  const progress = (nextLocked.current / nextLocked.required) * 100;
  const remaining = nextLocked.required - nextLocked.current;

  return (
    <div className="flex items-center gap-3 border border-white/5 px-4 py-3 h-max bg-sidebar hover:bg-sidebar-accent transition-colors rounded-t-sm">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-white/70 tracking-wide">
            {nextLocked.tier.charAt(0).toUpperCase() + nextLocked.tier.slice(1)} metrics
          </p>
          <p className="text-[10px] text-white/40">
            {remaining} more trade{remaining === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 bg-white/5 rounded-none h-1 overflow-hidden min-w-[100px] max-w-[200px]">
            <div
              className="bg-white h-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-white/40 font-medium tabular-nums whitespace-nowrap">
            {nextLocked.current}/{nextLocked.required}
          </p>
        </div>
      </div>
      <Lock className="size-3.5 text-white/50 flex-shrink-0" />
    </div>
  );
}
