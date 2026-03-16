"use client";

import { Lock } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SampleGateStatus {
  tier: string;
  required: number;
  current: number;
  isUnlocked: boolean;
  message: string;
  unlockSummary?: string;
  unlocks?: string[];
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
  const unlockSummary =
    nextLocked.unlockSummary ||
    "Unlocks the next tier of trade metrics once this sample threshold is reached.";
  const unlocks = nextLocked.unlocks ?? [];
  const tierLabel = `${
    nextLocked.tier.charAt(0).toUpperCase() + nextLocked.tier.slice(1)
  } metrics`;

  const tooltipContent = (
    <div className="flex max-w-[320px] flex-col gap-2">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-white">{tierLabel}</p>
        <p className="text-[11px] leading-relaxed text-white/60">
          Unlocks at {nextLocked.required} trades. You are currently at{" "}
          {nextLocked.current}/{nextLocked.required}.
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-white/75">
        {unlockSummary}
      </p>

      {unlocks.length ? (
        <div className="flex flex-wrap gap-1">
          {unlocks.map((unlock) => (
            <span
              key={unlock}
              className="rounded-sm bg-sidebar-accent px-2 py-1 text-[10px] text-white/70 ring ring-white/5"
            >
              {unlock}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex items-start gap-3 border border-white/5 px-4 py-3 h-max bg-sidebar hover:bg-sidebar-accent transition-colors rounded-t-sm">
      <div className="flex flex-1 min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-white/70 tracking-wide">
            {tierLabel}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                <Lock className="size-3.5 text-white/50 flex-shrink-0" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[320px]">
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-help items-center gap-2">
              <div className="h-1 min-w-[100px] flex-1 overflow-hidden rounded-full bg-teal-400/12">
                <div
                  className="h-full rounded-full bg-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              <p className="text-[10px] text-white/40 font-medium tabular-nums whitespace-nowrap">
                {nextLocked.current}/{nextLocked.required}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[320px]">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
