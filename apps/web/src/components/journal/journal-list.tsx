"use client";

import React, { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { JournalListContent } from "@/components/journal/list/journal-list-content";
import { JournalSearchDialog } from "@/components/journal/journal-search";
import { JournalListToolbar } from "@/components/journal/list/journal-list-toolbar";
import type {
  JournalListEntry,
  JournalListProps,
} from "@/components/journal/list/list-types";
import { entryTypeConfig } from "@/components/journal/list/list-types";
import { trpc } from "@/utils/trpc";
import { FolderPlus, Trash2 } from "lucide-react";

type EntryTypeFilter =
  | "general"
  | "daily"
  | "weekly"
  | "monthly"
  | "comparison"
  | "trade_review"
  | "strategy"
  | null;
type DateRangeFilter = "all" | "today" | "week" | "month";
type SortField = "updatedAt" | "createdAt" | "title";
type ViewMode = "grid" | "list";

export function JournalList({
  accountId,
  onSelectEntry,
  onCreateEntry,
  className,
  forceEntryType,
}: JournalListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortField>("updatedAt");
  const [filterEntryType, setFilterEntryType] = useState<EntryTypeFilter>(null);
  const [filterDateRange, setFilterDateRange] =
    useState<DateRangeFilter>("all");
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[]>([]);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState("");
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderTitle, setFolderTitle] = useState("");
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<JournalListEntry | null>(null);
  const [renameFolderTitle, setRenameFolderTitle] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [draggingEntryIds, setDraggingEntryIds] = useState<string[]>([]);
  const [activeDropFolderId, setActiveDropFolderId] = useState<string | null>(null);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 250);

  const { data: entriesData, isLoading, refetch } = trpc.journal.list.useQuery({
    limit: 50,
    accountId,
    includeShared: true,
    folderId: currentFolderId,
    search: search || undefined,
    sortBy,
    sortOrder: "desc",
    entryType: (forceEntryType as any) || filterEntryType || undefined,
  });
  const { data: foldersData, refetch: refetchFolders } =
    trpc.journal.listFolders.useQuery({ accountId });

  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: () => {
      if (currentFolderId && deleteConfirmIds.includes(currentFolderId)) {
        setCurrentFolderId(null);
      }
      void refetch();
      void refetchFolders();
    },
  });
  const duplicateEntry = trpc.journal.duplicate.useMutation({
    onSuccess: () => refetch(),
  });
  const updateEntry = trpc.journal.update.useMutation({
    onSuccess: () => {
      void refetch();
      void refetchFolders();
    },
  });
  const createFolder = trpc.journal.createFolder.useMutation({
    onSuccess: () => {
      setCreateFolderOpen(false);
      setFolderTitle("");
      void refetch();
      void refetchFolders();
    },
  });

  const getFilteredByDate = (items: JournalListEntry[]) => {
    if (filterDateRange === "all") return items;

    const now = new Date();
    let cutoffDate: Date;

    switch (filterDateRange) {
      case "today":
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return items;
    }

    return items.filter((item) => new Date(item.updatedAt) >= cutoffDate);
  };

  const items = getFilteredByDate(entriesData?.items || []);
  const folders = items.filter((entry) => entry.itemType === "folder");
  const entries = items.filter((entry) => entry.itemType !== "folder");
  const selectableEntries = entries.filter((entry) => !entry.isShared);
  const pinnedEntries = entries.filter((entry) => entry.isPinned);
  const recentEntries = entries.filter((entry) => !entry.isPinned);
  const availableFolders = (foldersData || []).map((folder) => ({
    id: folder.id,
    title: folder.title,
  }));
  const currentFolderName = currentFolderId
    ? foldersData?.find((folder) => folder.id === currentFolderId)?.title ?? null
    : null;

  const dateRangeLabelMap: Record<DateRangeFilter, string> = {
    all: "All time",
    today: "Today",
    week: "This week",
    month: "This month",
  };

  const appliedFilters = [
    filterEntryType
      ? {
          key: "entry-type",
          label: `Type: ${entryTypeConfig[filterEntryType].label}`,
          onClear: () => setFilterEntryType(null),
        }
      : null,
    filterDateRange !== "all"
      ? {
          key: "date-range",
          label: `Date: ${dateRangeLabelMap[filterDateRange]}`,
          onClear: () => setFilterDateRange("all"),
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    onClear: () => void;
  }>;

  const entryTypeLabels: Record<string, string> = {
    general: "General",
    daily: "Daily Review",
    weekly: "Weekly Review",
    monthly: "Monthly Review",
    trade_review: "Trade Review",
    strategy: "Strategy",
    comparison: "Comparison",
    edge: "Edge entry",
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteConfirmIds([id]);
    setDeleteConfirmTitle(title);
  };

  const handleSelectEntry = (entry: JournalListEntry) => {
    if (entry.itemType === "folder") {
      setSelectedEntryIds([]);
      setSelectionMode(false);
      setCurrentFolderId(entry.id);
      return;
    }

    if (selectionMode) {
      if (entry.isShared) {
        return;
      }
      setSelectedEntryIds((current) =>
        current.includes(entry.id)
          ? current.filter((id) => id !== entry.id)
          : [...current, entry.id]
      );
      return;
    }

    if (entry.isShared && entry.shareToken) {
      router.push(`/share/journal/${entry.shareToken}?entryId=${entry.id}`);
      return;
    }

    onSelectEntry(entry.id);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmIds.length === 0) return;
    for (const id of deleteConfirmIds) {
      deleteEntry.mutate({ id });
    }
    setDeleteConfirmIds([]);
    setDeleteConfirmTitle("");
    setSelectedEntryIds([]);
  };

  const handleMoveToFolder = (id: string, folderId: string | null) => {
    setDraggingEntryIds([]);
    setActiveDropFolderId(null);
    updateEntry.mutate({ id, folderId });
  };

  const handleMoveEntriesToFolder = (ids: string[], folderId: string | null) => {
    if (ids.length === 0) return;
    setDraggingEntryIds([]);
    setActiveDropFolderId(null);
    setSelectedEntryIds([]);
    void Promise.all(ids.map((id) => updateEntry.mutateAsync({ id, folderId })));
  };

  const handleCreateFolder = () => {
    createFolder.mutate({ title: folderTitle.trim() || "Untitled folder" });
  };

  const handleOpenRenameFolder = (entry: JournalListEntry) => {
    setFolderToRename(entry);
    setRenameFolderTitle(entry.title);
    setRenameFolderOpen(true);
  };

  const handleRenameFolder = () => {
    if (!folderToRename) return;
    updateEntry.mutate({
      id: folderToRename.id,
      title: renameFolderTitle.trim() || "Untitled folder",
    });
    setRenameFolderOpen(false);
    setFolderToRename(null);
    setRenameFolderTitle("");
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <JournalListToolbar
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        appliedFilters={appliedFilters}
        shouldGroupFilters={appliedFilters.length > 1}
        forceEntryType={forceEntryType}
        filterEntryType={filterEntryType}
        onFilterEntryTypeChange={setFilterEntryType}
        filterDateRange={filterDateRange}
        onFilterDateRangeChange={setFilterDateRange}
        dateRangeLabelMap={dateRangeLabelMap}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        onClearFilters={() => {
          setFilterEntryType(null);
          setFilterDateRange("all");
        }}
        onCreateEntry={() => onCreateEntry(currentFolderId ?? undefined)}
        onCreateFolder={() => setCreateFolderOpen(true)}
        availableFolders={availableFolders}
        selectedCount={selectedEntryIds.length}
        totalSelectableCount={selectableEntries.length}
        isSelectionMode={selectionMode}
        onSelectionModeChange={(value) => {
          setSelectionMode(value);
          if (!value) {
            setSelectedEntryIds([]);
          }
        }}
        onSelectAll={() => setSelectedEntryIds(selectableEntries.map((entry) => entry.id))}
        onClearSelected={() => setSelectedEntryIds([])}
        onMoveSelectedToFolder={(folderId) =>
          handleMoveEntriesToFolder(selectedEntryIds, folderId)
        }
        onArchiveSelected={() => {
          void Promise.all(
            selectedEntryIds.map((id) => updateEntry.mutateAsync({ id, isArchived: true }))
          );
          setSelectedEntryIds([]);
        }}
        onDeleteSelected={() => {
          if (selectedEntryIds.length === 0) return;
          setDeleteConfirmIds(selectedEntryIds);
          setDeleteConfirmTitle(
            selectedEntryIds.length === 1
              ? entries.find((entry) => entry.id === selectedEntryIds[0])?.title ?? "this entry"
              : `${selectedEntryIds.length} selected entries`
          );
        }}
        onOpenSearchDialog={() => setShowSearchDialog(true)}
      />

      <Separator />

      <JournalListContent
        isLoading={isLoading}
        folders={folders}
        entries={entries}
        pinnedEntries={pinnedEntries}
        recentEntries={recentEntries}
        viewMode={viewMode}
        entryTypeLabels={entryTypeLabels}
        availableFolders={availableFolders}
        currentFolderName={currentFolderName}
        onCreateEntry={() => onCreateEntry(currentFolderId ?? undefined)}
        onBackToRoot={() => {
          setCurrentFolderId(null);
          setSelectedEntryIds([]);
          setSelectionMode(false);
        }}
        onSelectEntry={handleSelectEntry}
        onDelete={handleDeleteClick}
        onDuplicate={(id) => duplicateEntry.mutate({ id })}
        onTogglePin={(id, isPinned) =>
          updateEntry.mutate({ id, isPinned: !isPinned })
        }
        onArchive={(id) => updateEntry.mutate({ id, isArchived: true })}
        onMoveToFolder={handleMoveToFolder}
        onMoveEntriesToFolder={handleMoveEntriesToFolder}
        onRenameFolder={handleOpenRenameFolder}
        selectionMode={selectionMode}
        selectedEntryIds={selectedEntryIds}
        draggingEntryIds={draggingEntryIds}
        activeDropFolderId={activeDropFolderId}
        onDragEntryStart={(entry) => {
          if (entry.itemType === "entry") {
            setDraggingEntryIds(
              selectedEntryIds.includes(entry.id) && selectedEntryIds.length > 0
                ? selectedEntryIds
                : [entry.id]
            );
          }
        }}
        onDragEntryEnd={() => {
          setDraggingEntryIds([]);
          setActiveDropFolderId(null);
        }}
        onDragOverFolder={setActiveDropFolderId}
        onToggleSelected={(entry) => {
          if (entry.itemType === "folder" || entry.isShared) return;
          setSelectionMode(true);
          setSelectedEntryIds((current) =>
            current.includes(entry.id)
              ? current.filter((id) => id !== entry.id)
              : [...current, entry.id]
          );
        }}
      />

      <AlertDialog
        open={deleteConfirmIds.length > 0}
        onOpenChange={(open) => !open && setDeleteConfirmIds([])}
      >
        <AlertDialogContent
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md [&>button]:hidden"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-sm font-medium text-white">
                  {deleteConfirmIds.length > 1 ? "Delete entries?" : "Delete entry?"}
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-xs leading-relaxed text-white/40">
                  Are you sure you want to delete "{deleteConfirmTitle}"? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
            <Separator />

            {/* Footer */}
            <AlertDialogFooter className="flex items-center justify-end gap-2 px-5 py-3">
              <AlertDialogCancel className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-red-500/20 bg-red-500/12 px-3 py-2 h-9 text-xs text-red-200 transition-all duration-250 active:scale-95 hover:bg-red-500/18 shadow-none"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <JournalSearchDialog
        isOpen={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        onSelectEntry={onSelectEntry}
        accountId={accountId}
      />

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="border-white/10 bg-sidebar text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="size-4 text-teal-300" />
              New folder
            </DialogTitle>
            <DialogDescription className="text-white/45">
              Create a journal folder now and add entries into it whenever you want.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs text-white/55">Folder name</label>
            <Input
              value={folderTitle}
              onChange={(event) => setFolderTitle(event.target.value)}
              placeholder="Weekly reviews"
              className="border-white/10 bg-sidebar-accent text-white placeholder:text-white/25"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateFolder();
                }
              }}
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => setCreateFolderOpen(false)}
              className="cursor-pointer rounded-sm border border-white/10 bg-sidebar px-3 py-2 text-xs text-white/70 transition hover:bg-sidebar-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFolder}
              className="cursor-pointer rounded-sm border border-teal-400/20 bg-teal-500/15 px-3 py-2 text-xs text-teal-100 transition hover:bg-teal-500/20"
            >
              Create folder
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <DialogContent className="border-white/10 bg-sidebar text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Rename folder</DialogTitle>
            <DialogDescription className="text-white/45">
              Update the folder name without affecting the entries inside it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs text-white/55">Folder name</label>
            <Input
              value={renameFolderTitle}
              onChange={(event) => setRenameFolderTitle(event.target.value)}
              placeholder="Weekly reviews"
              className="border-white/10 bg-sidebar-accent text-white placeholder:text-white/25"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleRenameFolder();
                }
              }}
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => setRenameFolderOpen(false)}
              className="cursor-pointer rounded-sm border border-white/10 bg-sidebar px-3 py-2 text-xs text-white/70 transition hover:bg-sidebar-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleRenameFolder}
              className="cursor-pointer rounded-sm border border-teal-400/20 bg-teal-500/15 px-3 py-2 text-xs text-teal-100 transition hover:bg-teal-500/20"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
