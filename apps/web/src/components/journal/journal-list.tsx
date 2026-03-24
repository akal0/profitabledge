"use client";

import React, { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

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
import { Trash2 } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortField>("updatedAt");
  const [filterEntryType, setFilterEntryType] = useState<EntryTypeFilter>(null);
  const [filterDateRange, setFilterDateRange] =
    useState<DateRangeFilter>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState("");
  const [showSearchDialog, setShowSearchDialog] = useState(false);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 250);

  const { data: entriesData, isLoading, refetch } = trpc.journal.list.useQuery({
    limit: 50,
    accountId,
    search: search || undefined,
    sortBy,
    sortOrder: "desc",
    entryType: (forceEntryType as any) || filterEntryType || undefined,
  });

  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const duplicateEntry = trpc.journal.duplicate.useMutation({
    onSuccess: () => refetch(),
  });
  const updateEntry = trpc.journal.update.useMutation({
    onSuccess: () => refetch(),
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

  const entries = getFilteredByDate(entriesData?.items || []);
  const pinnedEntries = entries.filter((entry) => entry.isPinned);
  const recentEntries = entries.filter((entry) => !entry.isPinned);

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
    setDeleteConfirmId(id);
    setDeleteConfirmTitle(title);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmId) return;
    deleteEntry.mutate({ id: deleteConfirmId });
    setDeleteConfirmId(null);
    setDeleteConfirmTitle("");
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
        onCreateEntry={onCreateEntry}
        onOpenSearchDialog={() => setShowSearchDialog(true)}
      />

      <Separator />

      <JournalListContent
        isLoading={isLoading}
        entries={entries}
        pinnedEntries={pinnedEntries}
        recentEntries={recentEntries}
        viewMode={viewMode}
        entryTypeLabels={entryTypeLabels}
        onCreateEntry={onCreateEntry}
        onSelectEntry={onSelectEntry}
        onDelete={handleDeleteClick}
        onDuplicate={(id) => duplicateEntry.mutate({ id })}
        onTogglePin={(id, isPinned) =>
          updateEntry.mutate({ id, isPinned: !isPinned })
        }
        onArchive={(id) => updateEntry.mutate({ id, isArchived: true })}
      />

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
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
                <AlertDialogTitle className="text-sm font-medium text-white">Delete entry?</AlertDialogTitle>
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

    </div>
  );
}
