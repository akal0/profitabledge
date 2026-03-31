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
  folders: JournalListEntry[];
  entries: JournalListEntry[];
  pinnedEntries: JournalListEntry[];
  recentEntries: JournalListEntry[];
  viewMode: ViewMode;
  entryTypeLabels: Record<string, string>;
  availableFolders: Array<{ id: string; title: string }>;
  currentFolderName?: string | null;
  onCreateEntry: () => void;
  onBackToRoot: () => void;
  onSelectEntry: (entry: JournalListEntry) => void;
  onDelete: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean | null) => void;
  onArchive: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
  onMoveEntriesToFolder: (ids: string[], folderId: string | null) => void;
  onRenameFolder: (entry: JournalListEntry) => void;
  selectionMode?: boolean;
  selectedEntryIds: string[];
  draggingEntryId?: string | null;
  draggingEntryIds?: string[];
  activeDropFolderId?: string | null;
  onDragEntryStart: (entry: JournalListEntry) => void;
  onDragEntryEnd: () => void;
  onDragOverFolder: (folderId: string) => void;
  onToggleSelected: (entry: JournalListEntry) => void;
}

export function JournalListContent({
  isLoading,
  folders,
  entries,
  pinnedEntries,
  recentEntries,
  viewMode,
  entryTypeLabels,
  availableFolders,
  currentFolderName,
  onCreateEntry,
  onBackToRoot,
  onSelectEntry,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
  onMoveToFolder,
  onMoveEntriesToFolder,
  onRenameFolder,
  selectionMode,
  selectedEntryIds,
  draggingEntryId,
  draggingEntryIds,
  activeDropFolderId,
  onDragEntryStart,
  onDragEntryEnd,
  onDragOverFolder,
  onToggleSelected,
}: JournalListContentProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
      {currentFolderName ? (
        <div className="mb-4 flex items-center justify-between rounded-md border border-white/5 bg-sidebar px-4 py-3">
          <div>
            <div className="mt-1 text-sm font-medium text-white">
              {currentFolderName}
            </div>
          </div>
          <button
            onClick={onBackToRoot}
            className="text-xs text-teal-300 transition hover:text-teal-200"
          >
            Back to all journals
          </button>
        </div>
      ) : null}

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
      ) : folders.length === 0 && entries.length === 0 ? (
        currentFolderName ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-md border border-dashed border-white/10 bg-sidebar px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/35">
              {currentFolderName}
            </div>
            <h3 className="mb-1 text-lg font-medium text-white">
              This folder is empty
            </h3>
            <p className="mb-4 max-w-xs text-sm text-white/40">
              Add a fresh journal entry here now, or move an existing one into
              this folder.
            </p>
            <button
              onClick={onCreateEntry}
              className="rounded-sm border border-teal-400/20 bg-teal-500/15 px-3 py-2 text-xs text-teal-100 transition hover:bg-teal-500/20"
            >
              Create an entry here
            </button>
          </div>
        ) : (
          <JournalListEmptyState onCreateEntry={onCreateEntry} />
        )
      ) : (
        <>
          {folders.length > 0 ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium text-white/60">
                  Folders
                </span>
              </div>
              <EntriesGrid
                entries={folders}
                viewMode={viewMode}
                entryTypeLabels={entryTypeLabels}
                availableFolders={availableFolders}
                onSelect={onSelectEntry}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
                onMoveToFolder={onMoveToFolder}
                onMoveEntriesToFolder={onMoveEntriesToFolder}
                onRename={onRenameFolder}
                selectionMode={selectionMode}
                selectedEntryIds={selectedEntryIds}
                draggingEntryIds={draggingEntryIds}
                activeDropFolderId={activeDropFolderId}
                onDragEntryStart={onDragEntryStart}
                onDragEntryEnd={onDragEntryEnd}
                onDragOverFolder={onDragOverFolder}
                onToggleSelected={onToggleSelected}
              />
            </div>
          ) : null}

          {pinnedEntries.length > 0 ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Pin className="h-4 w-4 text-white/40" />
                <span className="text-sm font-medium text-white/60">
                  Pinned
                </span>
              </div>
              <EntriesGrid
                entries={pinnedEntries}
                viewMode={viewMode}
                entryTypeLabels={entryTypeLabels}
                availableFolders={availableFolders}
                onSelect={onSelectEntry}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
                onMoveToFolder={onMoveToFolder}
                onMoveEntriesToFolder={onMoveEntriesToFolder}
                onRename={onRenameFolder}
                selectionMode={selectionMode}
                selectedEntryIds={selectedEntryIds}
                draggingEntryIds={draggingEntryIds}
                activeDropFolderId={activeDropFolderId}
                onDragEntryStart={onDragEntryStart}
                onDragEntryEnd={onDragEntryEnd}
                onDragOverFolder={onDragOverFolder}
                onToggleSelected={onToggleSelected}
              />
            </div>
          ) : null}

          {recentEntries.length > 0 ? (
            <div>
              {pinnedEntries.length > 0 ? (
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/40" />
                  <span className="text-sm font-medium text-white/60">
                    Recent
                  </span>
                </div>
              ) : null}
              <EntriesGrid
                entries={recentEntries}
                viewMode={viewMode}
                entryTypeLabels={entryTypeLabels}
                availableFolders={availableFolders}
                onSelect={onSelectEntry}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
                onMoveToFolder={onMoveToFolder}
                onMoveEntriesToFolder={onMoveEntriesToFolder}
                onRename={onRenameFolder}
                selectionMode={selectionMode}
                selectedEntryIds={selectedEntryIds}
                draggingEntryIds={draggingEntryIds}
                activeDropFolderId={activeDropFolderId}
                onDragEntryStart={onDragEntryStart}
                onDragEntryEnd={onDragEntryEnd}
                onDragOverFolder={onDragOverFolder}
                onToggleSelected={onToggleSelected}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
