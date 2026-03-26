"use client";

import { formatDistanceToNow } from "date-fns";
import { BookOpenText, Eye, UserRound } from "lucide-react";

import { JournalShareEntryView } from "@/components/journal/share/entry-view";
import type {
  JournalShareSummary,
  SharedJournalEntryListItem,
  SharedJournalEntryPayload,
} from "@/components/journal/share/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function JournalShareReader({
  share,
  entries,
  selectedEntryId,
  selectedEntry,
  onSelectEntry,
}: {
  share: JournalShareSummary;
  entries: SharedJournalEntryListItem[];
  selectedEntryId: string | null;
  selectedEntry: SharedJournalEntryPayload | null;
  onSelectEntry: (entryId: string) => void;
}) {
  return (
    <div className="flex min-h-screen min-w-screen flex-col bg-sidebar text-white">
      <header className="ring-b ring-white/8 bg-sidebar/95 backdrop-blur-sm py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs text-white/30">Private journal share</div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.05em] text-white">
              {share.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/42">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" />
                {share.ownerName || "Trader"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpenText className="size-4" />
                {entries.length} shared page{entries.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-4" />
                {share.viewCount} approved view
                {share.viewCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="ring-teal-400/20 bg-teal-400/8 text-teal-200"
          >
            Read only
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 flex-1 flex-col lg:flex-row">
        {/*<aside className="ring-b ring-white/8 lg:w-[320px] lg:ring-b-0 lg:ring-r">
          <ScrollArea className="h-full max-h-[36vh] lg:max-h-none">
            <div className="space-y-2 p-4">
              {entries.map((entry) => {
                const isSelected = entry.id === selectedEntryId;
                const updatedLabel = formatDistanceToNow(
                  new Date(entry.updatedAt),
                  {
                    addSuffix: true,
                  }
                );

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelectEntry(entry.id)}
                    className={cn(
                      "w-full rounded-xl ring px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "ring-teal-400/30 bg-teal-400/10"
                        : "ring-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {entry.emoji ? (
                        <span className="text-xl leading-none">
                          {entry.emoji}
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {entry.title}
                        </div>
                        {entry.preview ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">
                            {entry.preview}
                          </p>
                        ) : null}
                        <div className="mt-2 text-[11px] text-white/32">
                          Updated {updatedLabel}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>*/}

        <main className="min-h-0 flex-1">
          {selectedEntry ? (
            <JournalShareEntryView entry={selectedEntry} />
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center px-6 text-center">
              <div>
                <p className="text-lg font-medium text-white/72">
                  Select a shared page
                </p>
                <p className="mt-2 text-sm text-white/42">
                  Choose a journal page from the list to open it in read-only
                  mode.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
