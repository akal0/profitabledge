"use client";

import { Clock, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EntriesGrid } from "@/components/journal/list/entries-grid";
import { JournalListEmptyState } from "@/components/journal/list/journal-list-empty-state";
import type { JournalListEntry } from "@/components/journal/list/list-types";

type ViewMode = "grid" | "list";

interface JournalListContentProps {
  isLoading: boolean;
  entries: JournalListEntry[];
  pinnedEntries: JournalListEntry[];
  recentEntries: JournalListEntry[];
  viewMode: ViewMode;
  entryTypeLabels: Record<string, string>;
  onCreateEntry: () => void;
  onSelectEntry: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean | null) => void;
  onArchive: (id: string) => void;
}

export function JournalListContent({
  isLoading,
  entries,
  pinnedEntries,
  recentEntries,
  viewMode,
  entryTypeLabels,
  onCreateEntry,
  onSelectEntry,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
}: JournalListContentProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
      {isLoading ? (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              : "space-y-2"
          )}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn(
                "bg-sidebar-accent",
                viewMode === "grid" ? "h-48" : "h-20"
              )}
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <JournalListEmptyState onCreateEntry={onCreateEntry} />
      ) : (
        <>
          {pinnedEntries.length > 0 ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Pin className="h-4 w-4 text-white/40" />
                <span className="text-sm font-medium text-white/60">Pinned</span>
              </div>
              <EntriesGrid
                entries={pinnedEntries}
                viewMode={viewMode}
                entryTypeLabels={entryTypeLabels}
                onSelect={onSelectEntry}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
              />
            </div>
          ) : null}

          {recentEntries.length > 0 ? (
            <div>
              {pinnedEntries.length > 0 ? (
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/40" />
                  <span className="text-sm font-medium text-white/60">Recent</span>
                </div>
              ) : null}
              <EntriesGrid
                entries={recentEntries}
                viewMode={viewMode}
                entryTypeLabels={entryTypeLabels}
                onSelect={onSelectEntry}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
