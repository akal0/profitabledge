"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JournalWidgetFrame } from "@/components/journal/journal-widget-shell";
import {
  journalActionButtonClassName,
  journalActionButtonMutedClassName,
} from "@/components/journal/action-button-styles";

type ReviewQueueItem = {
  id: string;
  title: string;
  preview?: string;
  updatedAt: string | Date;
};

type JournalReviewReadyPanelProps = {
  reviewItems: ReviewQueueItem[];
  onCreateEntry: () => void;
  onSelectEntry: (id: string) => void;
};

export function JournalReviewReadyPanel({
  reviewItems,
  onCreateEntry,
  onSelectEntry,
}: JournalReviewReadyPanelProps) {
  return (
    <JournalWidgetFrame
      className="min-h-full"
      header={
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  Review ready
                </h2>
                <Badge className="bg-teal-500/15 text-teal-300 hover:bg-teal-500/15">
                  {reviewItems.length}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/50">
                Auto-generated trade reviews waiting for your manual reflection.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className={journalActionButtonClassName}
                onClick={onCreateEntry}
              >
                New Entry
              </Button>
              {reviewItems.length > 0 ? (
                <Button
                  size="sm"
                  className={journalActionButtonMutedClassName}
                  onClick={() => onSelectEntry(reviewItems[0]?.id || "")}
                >
                  Open Latest
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      }
    >
      {reviewItems.length > 0 ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {reviewItems.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectEntry(entry.id)}
              className="rounded-sm border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-teal-300">
                  Trade Review
                </span>
                <span className="text-[11px] text-white/35">
                  {new Date(entry.updatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-white">
                {entry.title}
              </p>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/45">
                {entry.preview ||
                  "Open the review to inspect execution, context, and next-step corrections."}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm font-medium text-white">
              No reviews waiting
            </p>
            <p className="mt-1 text-sm text-white/45">
              Auto-generated trade reviews will land here after qualifying
              trade-close events.
            </p>
          </div>
        </div>
      )}
    </JournalWidgetFrame>
  );
}
