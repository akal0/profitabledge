"use client";

import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JournalPrompts } from "@/components/journal/journal-prompts";
import { journalActionButtonMutedClassName } from "@/components/journal/action-button-styles";

type ReviewQueueItem = {
  id: string;
};

type JournalWorkflowStripProps = {
  pendingPromptCount: number;
  reviewItems: ReviewQueueItem[];
  onCreateFromPrompt: (prompt: any) => void;
  onOpenLatestReview: () => void;
  onOpenReviewTab: () => void;
};

export function JournalWorkflowStrip({
  pendingPromptCount,
  reviewItems,
  onCreateFromPrompt,
  onOpenLatestReview,
  onOpenReviewTab,
}: JournalWorkflowStripProps) {
  return (
    <div className="shrink-0 border-b border-white/5 px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_auto]">
        <div className="rounded-sm border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-white/70">
            <Sparkles className="size-4 text-teal-300" />
            <span className="text-xs uppercase tracking-[0.18em]">
              Prompt inbox
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {pendingPromptCount}
            </span>
            <span className="pb-1 text-xs text-white/35">pending</span>
          </div>
          <p className="mt-2 text-xs text-white/45">
            Reflection prompts generated from trade closes and journaling
            patterns.
          </p>
        </div>

        <div className="rounded-sm border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-white/70">
            <FileText className="size-4 text-violet-300" />
            <span className="text-xs uppercase tracking-[0.18em]">
              Review queue
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {reviewItems.length}
            </span>
            <span className="pb-1 text-xs text-white/35">ready</span>
          </div>
          <p className="mt-2 text-xs text-white/45">
            Auto-generated trade reviews waiting for your manual reflection.
          </p>
        </div>

        <div className="rounded-sm border border-white/5 bg-white/[0.03] p-3 xl:min-w-[260px]">
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">
            Quick actions
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <JournalPrompts
              triggerVariant="button"
              buttonLabel="Open inbox"
              onJournalFromPrompt={onCreateFromPrompt}
            />
            {reviewItems.length > 0 ? (
              <Button
                size="sm"
                className={journalActionButtonMutedClassName}
                onClick={onOpenLatestReview}
              >
                Latest review
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                className={journalActionButtonMutedClassName}
                onClick={onOpenReviewTab}
              >
                Review tab
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
