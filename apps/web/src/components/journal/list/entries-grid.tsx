"use client";

import { EntryCard } from "@/components/journal/list/entry-card";
import { EntryListItem } from "@/components/journal/list/entry-list-item";
import type { JournalListEntry } from "@/components/journal/list/list-types";

export function EntriesGrid({
  entries,
  viewMode,
  entryTypeLabels,
  availableFolders,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
  onMoveToFolder,
  onMoveEntriesToFolder,
  onRename,
  selectionMode,
  selectedEntryIds,
  draggingEntryIds,
  activeDropFolderId,
  onDragEntryStart,
  onDragEntryEnd,
  onDragOverFolder,
  onToggleSelected,
}: {
  entries: JournalListEntry[];
  viewMode: "grid" | "list";
  entryTypeLabels: Record<string, string>;
  availableFolders: Array<{ id: string; title: string }>;
  onSelect: (entry: JournalListEntry) => void;
  onDelete: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean | null) => void;
  onArchive: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
  onMoveEntriesToFolder: (ids: string[], folderId: string | null) => void;
  onRename: (entry: JournalListEntry) => void;
  selectionMode?: boolean;
  selectedEntryIds: string[];
  draggingEntryIds?: string[];
  activeDropFolderId?: string | null;
  onDragEntryStart?: (entry: JournalListEntry) => void;
  onDragEntryEnd?: () => void;
  onDragOverFolder?: (folderId: string) => void;
  onToggleSelected: (entry: JournalListEntry) => void;
}) {
  if (viewMode === "list") {
    return (
      <div className="space-y-1">
        {entries.map((entry) => (
          <EntryListItem
            key={entry.id}
            entry={entry}
            entryTypeLabels={entryTypeLabels}
            availableFolders={availableFolders}
            onSelect={() => onSelect(entry)}
            onDelete={() => onDelete(entry.id, entry.title)}
            onDuplicate={() => onDuplicate(entry.id)}
            onTogglePin={() => onTogglePin(entry.id, entry.isPinned)}
            onMoveToFolder={(folderId) => onMoveToFolder(entry.id, folderId)}
            onRename={() => onRename(entry)}
            onToggleSelected={() => onToggleSelected(entry)}
            selectionMode={selectionMode}
            isSelected={selectedEntryIds.includes(entry.id)}
            onDragStart={() => onDragEntryStart?.(entry)}
            onDragEnd={onDragEntryEnd}
            onDragTarget={() => {
              if (entry.itemType === "folder") {
                onDragOverFolder?.(entry.id);
              }
            }}
            onDropEntry={
              draggingEntryIds?.length && entry.itemType === "folder"
                ? () => onMoveEntriesToFolder(draggingEntryIds, entry.id)
                : undefined
            }
            isDropTarget={activeDropFolderId === entry.id}
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
          availableFolders={availableFolders}
          onSelect={() => onSelect(entry)}
          onDelete={() => onDelete(entry.id, entry.title)}
          onDuplicate={() => onDuplicate(entry.id)}
          onTogglePin={() => onTogglePin(entry.id, entry.isPinned)}
          onArchive={() => onArchive(entry.id)}
          onMoveToFolder={(folderId) => onMoveToFolder(entry.id, folderId)}
          onRename={() => onRename(entry)}
          onToggleSelected={() => onToggleSelected(entry)}
          selectionMode={selectionMode}
          isSelected={selectedEntryIds.includes(entry.id)}
          onDragStart={() => onDragEntryStart?.(entry)}
          onDragEnd={onDragEntryEnd}
          onDragTarget={() => {
            if (entry.itemType === "folder") {
              onDragOverFolder?.(entry.id);
            }
          }}
          onDropEntry={
            draggingEntryIds?.length && entry.itemType === "folder"
              ? () => onMoveEntriesToFolder(draggingEntryIds, entry.id)
              : undefined
          }
          isDropTarget={activeDropFolderId === entry.id}
        />
      ))}
    </div>
  );
}
