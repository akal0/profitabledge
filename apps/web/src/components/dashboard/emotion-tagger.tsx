"use client";

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import { Smile, Zap, Flag, ChevronDown, ChevronUp } from "lucide-react";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";

import { Separator } from "@/components/ui/separator";

const PRE_ENTRY_EMOTIONS = [
  { value: "confident", label: "Confident", emoji: "💪" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "anxious", label: "Anxious", emoji: "😰" },
  { value: "fomo", label: "FOMO", emoji: "🏃" },
  { value: "revenge", label: "Revenge", emoji: "😤" },
  { value: "bored", label: "Bored", emoji: "🥱" },
  { value: "excited", label: "Excited", emoji: "🤩" },
  { value: "hesitant", label: "Hesitant", emoji: "🤔" },
] as const;

const DURING_EMOTIONS = [
  { value: "calm", label: "Calm", emoji: "😌" },
  { value: "stressed", label: "Stressed", emoji: "😓" },
  { value: "greedy", label: "Greedy", emoji: "🤑" },
  { value: "fearful", label: "Fearful", emoji: "😨" },
  { value: "impatient", label: "Impatient", emoji: "⏳" },
  { value: "focused", label: "Focused", emoji: "🎯" },
] as const;

const POST_EXIT_EMOTIONS = [
  { value: "satisfied", label: "Satisfied", emoji: "😊" },
  { value: "regretful", label: "Regretful", emoji: "😞" },
  { value: "relieved", label: "Relieved", emoji: "😮‍💨" },
  { value: "frustrated", label: "Frustrated", emoji: "😡" },
  { value: "indifferent", label: "Indifferent", emoji: "😶" },
  { value: "proud", label: "Proud", emoji: "🏆" },
] as const;

const STAGES = [
  {
    key: "pre_entry" as const,
    label: "Before entry",
    icon: Smile,
    emotions: PRE_ENTRY_EMOTIONS,
  },
  {
    key: "during" as const,
    label: "During trade",
    icon: Zap,
    emotions: DURING_EMOTIONS,
  },
  {
    key: "post_exit" as const,
    label: "After exit",
    icon: Flag,
    emotions: POST_EXIT_EMOTIONS,
  },
];

const STAGE_TONES = {
  pre_entry: TRADE_IDENTIFIER_TONES.info,
  during: TRADE_IDENTIFIER_TONES.live,
  post_exit: TRADE_IDENTIFIER_TONES.amber,
} as const;

interface EmotionTaggerProps {
  tradeId: string;
  accountId?: string | null;
  compact?: boolean;
}

type TradeEmotionRecord = {
  stage: string;
  emotion: string;
};

export function EmotionTagger({
  tradeId,
  accountId: accountIdProp,
  compact = false,
}: EmotionTaggerProps) {
  const aiApi = (trpc as any).ai;
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const accountId = accountIdProp ?? selectedAccountId;
  const [expanded, setExpanded] = useState(!compact);

  const { data: emotionsRaw, refetch } = aiApi.getEmotions.useQuery(
    { accountId: accountId || "", tradeId },
    { enabled: !!tradeId && !!accountId }
  );
  const emotions = useMemo(
    () => (emotionsRaw as TradeEmotionRecord[] | undefined) ?? [],
    [emotionsRaw]
  );

  const tagMutation = aiApi.tagEmotion.useMutation({
    onSuccess: () => refetch(),
  });

  const handleTag = useCallback(
    (stage: "pre_entry" | "during" | "post_exit", emotion: string) => {
      if (!accountId) return;
      tagMutation.mutate({
        tradeId,
        accountId,
        stage,
        emotion,
      });
    },
    [accountId, tradeId, tagMutation]
  );

  // Get currently selected emotion per stage
  const selectedByStage = useMemo(
    () =>
      emotions.reduce((acc: Record<string, string>, e: TradeEmotionRecord) => {
        if (!(e.stage in acc)) {
          acc[e.stage as string] = e.emotion;
        }
        return acc;
      }, {} as Record<string, string>),
    [emotions]
  );

  const hasAnyEmotions = Object.keys(selectedByStage).length > 0;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between group cursor-pointer"
      >
        <h3 className="text-xs font-semibold text-white/70 tracking-wide">
          Emotions
        </h3>
        <div className="flex items-center gap-2">
          {!expanded && hasAnyEmotions && (
            <div className="flex gap-2">
              {STAGES.map((stage) => {
                const selected = selectedByStage[stage.key];
                const emo = stage.emotions.find((e) => e.value === selected);
                if (!emo) return null;
                return (
                  <span
                    key={stage.key}
                    className="text-sm"
                    title={`${stage.label}: ${emo.label}`}
                  >
                    {emo.emoji}
                  </span>
                );
              })}
            </div>
          )}

          {expanded ? (
            <ChevronUp className="h-3 w-3 text-white/40" />
          ) : (
            <ChevronDown className="h-3 w-3 text-white/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-5">
          {STAGES.map((stage) => {
            const StageIcon = stage.icon;
            const selected = selectedByStage[stage.key];

            return (
              <div key={stage.key} className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <StageIcon className="h-3 w-3 text-white/50" />
                  <span className="text-[11px] font-medium text-white/50">
                    {stage.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stage.emotions.map((emo) => {
                    const isSelected = selected === emo.value;
                    return (
                      <button
                        key={emo.value}
                        onClick={() => handleTag(stage.key, emo.value)}
                        disabled={tagMutation.isPending || !accountId}
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          "gap-1 cursor-pointer",
                          isSelected
                            ? STAGE_TONES[stage.key]
                            : "ring-white/8 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white/80"
                        )}
                      >
                        <span>{emo.emoji}</span>
                        <span>{emo.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
