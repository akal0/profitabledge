"use client";

import { EntryCard, type JournalListEntryActions } from "@/components/journal/list/entry-card";
import { EntryListItem } from "@/components/journal/list/entry-list-item";
import type { JournalListEntry } from "@/components/journal/list/list-types";

export function EntriesGrid({
  entries,
  viewMode,
  entryTypeLabels,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
}: {
  entries: JournalListEntry[];
  viewMode: "grid" | "list";
  entryTypeLabels: Record<string, string>;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean | null) => void;
  onArchive: (id: string) => void;
}) {
  if (viewMode === "list") {
    return (
      <div className="space-y-1">
        {entries.map((entry) => (
          <EntryListItem
            key={entry.id}
            entry={entry}
            entryTypeLabels={entryTypeLabels}
            onSelect={() => onSelect(entry.id)}
            onDelete={() => onDelete(entry.id, entry.title)}
            onDuplicate={() => onDuplicate(entry.id)}
            onTogglePin={() => onTogglePin(entry.id, entry.isPinned)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          entryTypeLabels={entryTypeLabels}
          onSelect={() => onSelect(entry.id)}
          onDelete={() => onDelete(entry.id, entry.title)}
          onDuplicate={() => onDuplicate(entry.id)}
          onTogglePin={() => onTogglePin(entry.id, entry.isPinned)}
          onArchive={() => onArchive(entry.id)}
        />
      ))}
    </div>
  );
}
