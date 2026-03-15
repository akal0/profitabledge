"use client";

import { useRef } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import { Brain, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { WidgetWrapper } from "./widget-wrapper";
import { WidgetShareButton } from "@/features/dashboard/widgets/components/widget-share-button";

const TILT_LEVELS = {
  green: {
    label: "Clear mind",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    ring: "ring-emerald-500/30",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  yellow: {
    label: "Mild tilt",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    ring: "ring-yellow-500/30",
    gradient: "from-yellow-500/20 to-yellow-500/5",
  },
  orange: {
    label: "Tilting",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    ring: "ring-orange-500/30",
    gradient: "from-orange-500/20 to-orange-500/5",
  },
  red: {
    label: "Full tilt",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    ring: "ring-red-500/30",
    gradient: "from-red-500/20 to-red-500/5",
  },
} as const;

function formatEmotionLabel(emotion: string) {
  if (emotion.toLowerCase() === "fomo") return "FOMO";
  return emotion
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TiltmeterWidget({
  isEditing = false,
  className,
}: {
  isEditing?: boolean;
  className?: string;
}) {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const { data: tiltData, isLoading } = trpc.ai.getTiltStatus.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId, refetchInterval: 10_000 }
  );

  const { data: mentalScore } = trpc.ai.getMentalScore.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId, refetchInterval: 30_000 }
  );

  if (isLoading) {
    return (
      <WidgetWrapper
        rootRef={widgetRef}
        className={className}
        icon={Brain}
        title="Tiltmeter"
        showHeader
        contentClassName="flex-col p-3.5"
        headerRight={
          !isEditing ? (
            <WidgetShareButton targetRef={widgetRef} title="Tiltmeter" />
          ) : null
        }
      >
        <Skeleton className="h-full w-full rounded-sm" />
      </WidgetWrapper>
    );
  }

  const tiltScore =
    tiltData?.tiltScore ??
    (typeof tiltData?.score === "number" ? 100 - tiltData.score : 0);
  const level = (tiltData?.level ?? "green") as keyof typeof TILT_LEVELS;
  const indicators = tiltData?.indicators ?? [];
  const config = TILT_LEVELS[level];
  const recentEmotions = tiltData?.recentEmotions ?? [];
  const dominantEmotion = recentEmotions[0] ?? null;
  const emotionalStateLabel = dominantEmotion
    ? formatEmotionLabel(dominantEmotion.emotion)
    : "No recent emotion tags";
  const activeStateLabels = indicators
    .map((indicator) => indicator.label ?? indicator.message ?? "Tilt signal")
    .filter(Boolean);

  const mentalTotal = mentalScore?.totalScore ?? mentalScore?.overall ?? 0;

  // Semicircular gauge angle: 0 = left (green), 180 = right (red)
  const gaugeAngle = (tiltScore / 100) * 180;

  return (
    <WidgetWrapper
      rootRef={widgetRef}
      isEditing={isEditing}
      className={className}
      icon={Brain}
      title="Tiltmeter"
      showHeader
      contentClassName="flex-col justify-end p-3.5"
      headerRight={
        <>
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-1 rounded-sm",
              config.bg,
              config.color
            )}
          >
            {config.label}
          </span>
          {!isEditing ? (
            <WidgetShareButton targetRef={widgetRef} title="Tiltmeter" />
          ) : null}
        </>
      }
    >
      <div className="flex flex-col justify-end h-full w-full">
        <div className="flex flex-col items-center justify-center flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative mb-2 w-32 h-16 cursor-help">
                {/* Background arc */}
                <svg viewBox="0 0 120 60" className="w-full h-full">
                  <path
                    d="M 10 55 A 50 50 0 0 1 110 55"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-white/10"
                  />
                  {/* Colored arc */}
                  <path
                    d="M 10 55 A 50 50 0 0 1 110 55"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(gaugeAngle / 180) * 157} 157`}
                    className={config.color}
                  />
                  {/* Needle */}
                  <line
                    x1="60"
                    y1="55"
                    x2={
                      60 + 40 * Math.cos(((180 - gaugeAngle) * Math.PI) / 180)
                    }
                    y2={
                      55 - 40 * Math.sin(((180 - gaugeAngle) * Math.PI) / 180)
                    }
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="60" cy="55" r="4" fill="white" />
                </svg>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="px-0 py-2">
              <div className="flex min-w-[180px] flex-col">
                <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                  <span>
                    {activeStateLabels.length > 0
                      ? "Active state"
                      : "Emotional state"}
                  </span>
                  <span>
                    {activeStateLabels.length > 0
                      ? `${activeStateLabels.length} ${
                          activeStateLabels.length === 1 ? "signal" : "signals"
                        }`
                      : dominantEmotion
                      ? `${dominantEmotion.count} ${
                          dominantEmotion.count === 1 ? "tag" : "tags"
                        }`
                      : null}
                  </span>
                </div>
                <Separator className="mt-2 w-full" />
                <div className="flex flex-col gap-1 px-3 pt-2 text-xs font-medium text-white">
                  {activeStateLabels.length > 0 ? (
                    activeStateLabels.map((label, index) => (
                      <div
                        key={`${label}-${index}`}
                        className="flex items-center gap-1.5"
                      >
                        <AlertTriangle
                          className={cn("h-3 w-3 shrink-0", config.color)}
                        />
                        <span>{label}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {tiltScore < 20 ? (
                        <CheckCircle className="h-3 w-3 shrink-0 text-emerald-400" />
                      ) : (
                        <Brain className="h-3 w-3 shrink-0 text-white/50" />
                      )}
                      <span>
                        {tiltScore < 20
                          ? "Trading with a clear head"
                          : emotionalStateLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          <div className="text-center">
            <span className={cn("text-2xl font-bold", config.color)}>
              {tiltScore}
            </span>
            <span className="text-white/40 text-sm">/100</span>
          </div>

          {mentalTotal > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Activity className="h-3 w-3 text-white/40" />
              <span className="text-[10px] text-white/40">
                Mental: {mentalTotal}/100
              </span>
            </div>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
}
