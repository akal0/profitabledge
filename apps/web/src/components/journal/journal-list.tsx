"use client";

import React, { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { APP_TOOLTIP_SURFACE_CLASS } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Calendar,
  Clock,
  Pin,
  MoreHorizontal,
  Trash2,
  Copy,
  Archive,
  FileText,
  LayoutGrid,
  List,
  SortAsc,
  ListFilterPlus,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Target,
  Sparkles,
  GitCompare,
} from "lucide-react";
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
import { format, formatDistanceToNow } from "date-fns";
import { JournalSearchDialog } from "./journal-search";
import {
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
  journalCompactActionIconButtonClassName,
  journalSegmentedActionButtonActiveClassName,
  journalSegmentedActionButtonClassName,
  journalSegmentedActionContainerClassName,
} from "./action-button-styles";

// ============================================================================
// Types
// ============================================================================

interface JournalListEntry {
  id: string;
  title: string;
  emoji?: string | null;
  coverImageUrl?: string | null;
  entryType: string | null;
  tags: string[] | null;
  journalDate?: Date | string | null;
  isPinned: boolean | null;
  wordCount: number | null;
  readTimeMinutes: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  preview?: string;
}

interface JournalListProps {
  accountId?: string;
  onSelectEntry: (entryId: string) => void;
  onCreateEntry: () => void;
  className?: string;
  /** Force-filter entries to this type (hides the type filter UI) */
  forceEntryType?: string;
}

// ============================================================================
// Journal List Component
// ============================================================================

// Entry type config
const entryTypeConfig = {
  general: { label: "General", icon: FileText, color: "text-white/60", accent: "#888888" },
  daily: { label: "Daily Review", icon: Calendar, color: "text-blue-400", accent: "#60a5fa" },
  weekly: { label: "Weekly Review", icon: CalendarDays, color: "text-purple-400", accent: "#a78bfa" },
  monthly: { label: "Monthly Review", icon: CalendarDays, color: "text-fuchsia-400", accent: "#e879f9" },
  trade_review: { label: "Trade Review", icon: Target, color: "text-teal-400", accent: "#2dd4bf" },
  strategy: { label: "Strategy", icon: Sparkles, color: "text-yellow-400", accent: "#facc15" },
  comparison: { label: "Comparison", icon: GitCompare, color: "text-orange-400", accent: "#fb923c" },
  backtest: { label: "Backtest", icon: Target, color: "text-cyan-400", accent: "#22d3ee" },
};

const journalToolbarPrimaryButtonClassName =
  "cursor-pointer flex h-[38px] items-center justify-center gap-1 rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent";

function generatePatternSeed(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function EntryCoverPattern({ entryType, title }: { entryType?: string; title: string }) {
  const config = entryTypeConfig[entryType as keyof typeof entryTypeConfig] ?? entryTypeConfig.general;
  const seed = generatePatternSeed(title);
  const patternType = seed % 3;
  const rotation = (seed % 60) - 30;

  return (
    <div className="relative h-20 overflow-hidden bg-sidebar-accent">
      {/* Base gradient */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          background: `linear-gradient(${120 + rotation}deg, ${config.accent}, transparent 70%)`,
        }}
      />

      {/* Pattern layer */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `rotate(${rotation}deg) scale(1.3)` }}
      >
        <defs>
          {patternType === 0 ? (
            <pattern id={`dots-${seed}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill={config.accent} />
            </pattern>
          ) : patternType === 1 ? (
            <pattern id={`grid-${seed}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke={config.accent} strokeWidth="0.5" />
            </pattern>
          ) : (
            <pattern id={`diag-${seed}`} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 0 12 L 12 0 M -3 3 L 3 -3 M 9 15 L 15 9" stroke={config.accent} strokeWidth="0.5" fill="none" />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternType === 0 ? `dots-${seed}` : patternType === 1 ? `grid-${seed}` : `diag-${seed}`})`} />
      </svg>

      {/* Accent orb */}
      <div
        className="absolute -bottom-6 opacity-[0.08] blur-2xl"
        style={{
          width: 120,
          height: 60,
          left: `${20 + (seed % 50)}%`,
          background: `radial-gradient(ellipse, ${config.accent}, transparent)`,
        }}
      />
    </div>
  );
}

export function JournalList({
  accountId,
  onSelectEntry,
  onCreateEntry,
  className,
  forceEntryType,
}: JournalListProps) {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"updatedAt" | "createdAt" | "title">(
    "updatedAt"
  );
  const [filterEntryType, setFilterEntryType] = useState<"general" | "daily" | "weekly" | "monthly" | "comparison" | "trade_review" | "strategy" | "backtest" | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string>("");
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 250);

  // Fetch entries
  const {
    data: entriesData,
    isLoading,
    refetch,
  } = trpc.journal.list.useQuery({
    limit: 50,
    accountId,
    search: search || undefined,
    sortBy,
    sortOrder: "desc",
    entryType: (forceEntryType as any) || filterEntryType || undefined,
  });

  // Filter entries by date range client-side
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
    
    return items.filter(item => {
      const itemDate = new Date(item.updatedAt);
      return itemDate >= cutoffDate;
    });
  };

  const entries = getFilteredByDate(entriesData?.items || []);

  const dateRangeLabelMap: Record<typeof filterDateRange, string> = {
    all: "All time",
    today: "Today",
    week: "This week",
    month: "This month",
  };

  const badgeBaseClass =
    "cursor-pointer flex h-[38px] items-center justify-center rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:text-white";
  const filterMenuSurfaceClass = cn(
    APP_TOOLTIP_SURFACE_CLASS,
    "border-white/6 bg-sidebar/95 text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
  );
  const filterMenuContentClass = `${filterMenuSurfaceClass} w-[280px] p-1.5`;
  const filterMenuSubContentClass = `${filterMenuSurfaceClass} ml-4 p-1`;
  const filterMenuSectionTitleClass =
    "px-4 py-2 text-[11px] font-semibold text-white/55";
  const filterMenuMainSeparatorClass = "-mx-1.5 w-[calc(100%+0.75rem)]";
  const filterMenuTriggerClass =
    "px-4 py-2.5 text-xs text-white/75 data-[highlighted]:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent/80";
  const filterMenuItemClass =
    "px-4 py-2.5 text-xs text-white/75 data-[highlighted]:bg-sidebar-accent/80";
  const selectMenuContentClass = `${filterMenuSurfaceClass} px-1.5 pb-2 pt-0.5`;

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

  const shouldGroupFilters = appliedFilters.length > 1;

  const clearFilters = () => {
    setFilterEntryType(null);
    setFilterDateRange("all");
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  // Delete with confirmation
  const handleDeleteClick = (id: string, title: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmTitle(title);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      deleteEntry.mutate({ id: deleteConfirmId });
      setDeleteConfirmId(null);
      setDeleteConfirmTitle("");
    }
  };

  // Mutations
  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const duplicateEntry = trpc.journal.duplicate.useMutation({
    onSuccess: () => refetch(),
  });
  const updateEntry = trpc.journal.update.useMutation({
    onSuccess: () => refetch(),
  });

  // Group entries
  const pinnedEntries = entries.filter((e) => e.isPinned);
  const recentEntries = entries.filter((e) => !e.isPinned);

  // Entry type labels
  const entryTypeLabels: Record<string, string> = {
    general: "General",
    daily: "Daily Review",
    weekly: "Weekly Review",
    monthly: "Monthly Review",
    trade_review: "Trade Review",
    strategy: "Strategy",
    comparison: "Comparison",
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Toolbar */}
      <div className="shrink-0">
        <div className="px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="group relative flex h-9 w-full max-w-[32rem] items-center rounded-md border border-white/5 pl-8 pr-2 transition duration-250 hover:bg-sidebar-accent">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors group-hover:text-white/60" />
                <Input
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search (title)"
                  className="h-full border-none bg-transparent px-0 py-0 text-xs text-white placeholder:text-white/30 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 group-hover:bg-transparent"
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="relative bg-transparent px-1 py-0 text-[11px] text-white/60 shadow-none hover:bg-transparent hover:text-white">
                      <ListFilterPlus className="size-4" />
                      {appliedFilters.length > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] px-1 text-[10px] font-medium leading-none text-white/80">
                          {appliedFilters.length}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className={cn(filterMenuContentClass, "-mr-[9px]")}
                  >
                    <div className={filterMenuSectionTitleClass}>Filters</div>
                    <DropdownMenuSeparator className={filterMenuMainSeparatorClass} />

                    {!forceEntryType ? (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                          Entry Type
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          className={cn(filterMenuSubContentClass, "w-[220px]")}
                        >
                          <DropdownMenuRadioGroup
                            value={filterEntryType ?? "__all__"}
                            onValueChange={(value) =>
                              setFilterEntryType(
                                value === "__all__"
                                  ? null
                                  : (value as typeof filterEntryType)
                              )
                            }
                          >
                            <DropdownMenuRadioItem
                              value="__all__"
                              className={filterMenuItemClass}
                            >
                              All
                            </DropdownMenuRadioItem>
                            {Object.entries(entryTypeConfig).map(([key, config]) => {
                              const Icon = config.icon;
                              return (
                                <DropdownMenuRadioItem
                                  key={key}
                                  value={key}
                                  className={filterMenuItemClass}
                                >
                                  <Icon className="size-3.5" />
                                  {config.label}
                                </DropdownMenuRadioItem>
                              );
                            })}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ) : null}

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                        Date Range
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent
                        className={cn(filterMenuSubContentClass, "w-[220px]")}
                      >
                        <DropdownMenuRadioGroup
                          value={filterDateRange}
                          onValueChange={(value) =>
                            setFilterDateRange(value as typeof filterDateRange)
                          }
                        >
                          {Object.entries(dateRangeLabelMap).map(([value, label]) => (
                            <DropdownMenuRadioItem
                              key={value}
                              value={value}
                              className={filterMenuItemClass}
                            >
                              {label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {appliedFilters.length > 0 ? (
                      <>
                        <DropdownMenuSeparator
                          className={filterMenuMainSeparatorClass}
                        />
                        <DropdownMenuItem
                          onSelect={clearFilters}
                          className={filterMenuItemClass}
                        >
                          Clear all filters
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Button
                size="sm"
                onClick={() => setShowSearchDialog(true)}
                className={journalActionIconButtonClassName}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button
                onClick={onCreateEntry}
                className={journalToolbarPrimaryButtonClassName}
              >
                <Plus className="mr-1 h-4 w-4" />
                New entry
              </Button>

              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className={journalActionButtonMutedClassName}
                  >
                    <SortAsc className="h-4 w-4 mr-1" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-sidebar border-white/10"
                >
                  <DropdownMenuItem
                    className={cn(
                      "text-white/80 focus:text-white focus:bg-white/10",
                      sortBy === "updatedAt" && "bg-white/5"
                    )}
                    onClick={() => setSortBy("updatedAt")}
                  >
                    Last modified
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      "text-white/80 focus:text-white focus:bg-white/10",
                      sortBy === "createdAt" && "bg-white/5"
                    )}
                    onClick={() => setSortBy("createdAt")}
                  >
                    Date created
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      "text-white/80 focus:text-white focus:bg-white/10",
                      sortBy === "title" && "bg-white/5"
                    )}
                    onClick={() => setSortBy("title")}
                  >
                    Title
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View toggle */}
              <div className={journalSegmentedActionContainerClassName}>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    journalSegmentedActionButtonClassName,
                    "px-2.5",
                    viewMode === "grid"
                      ? journalSegmentedActionButtonActiveClassName
                      : undefined
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    journalSegmentedActionButtonClassName,
                    "px-2.5",
                    viewMode === "list"
                      ? journalSegmentedActionButtonActiveClassName
                      : undefined
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {appliedFilters.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {shouldGroupFilters ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className={cn(badgeBaseClass, "gap-2")}>
                      Filters ({appliedFilters.length})
                      <ChevronDown className="size-3.5 text-white/60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(selectMenuContentClass, "w-[280px]")}
                  >
                    {appliedFilters.map((filter) => (
                      <DropdownMenuItem
                        key={filter.key}
                        className="p-0 focus:bg-transparent"
                        onSelect={filter.onClear}
                      >
                        <span
                          className={cn(
                            badgeBaseClass,
                            "flex w-full items-center justify-between"
                          )}
                        >
                          {filter.label}
                          <span className="ml-2">x</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                appliedFilters.map((filter) => (
                  <Button
                    key={filter.key}
                    className={badgeBaseClass}
                    onClick={filter.onClear}
                  >
                    {filter.label}
                    <span className="ml-2">x</span>
                  </Button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <Separator />
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-2"
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "bg-sidebar-accent",
                  viewMode === "grid" ? "h-48" : "h-20"
                )}
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState onCreateEntry={onCreateEntry} />
        ) : (
          <>
            {/* Pinned entries */}
            {pinnedEntries.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="h-4 w-4 text-white/40" />
                  <span className="text-sm font-medium text-white/60">
                    Pinned
                  </span>
                </div>
                <EntriesGrid
                  entries={pinnedEntries}
                  viewMode={viewMode}
                  entryTypeLabels={entryTypeLabels}
                  onSelect={onSelectEntry}
                  onDelete={(id, title) => handleDeleteClick(id, title)}
                  onDuplicate={(id) => duplicateEntry.mutate({ id })}
                  onTogglePin={(id, isPinned) =>
                    updateEntry.mutate({ id, isPinned: !isPinned })
                  }
                  onArchive={(id) =>
                    updateEntry.mutate({ id, isArchived: true })
                  }
                />
              </div>
            )}

            {/* Recent entries */}
            {recentEntries.length > 0 && (
              <div>
                {pinnedEntries.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-white/40" />
                    <span className="text-sm font-medium text-white/60">
                      Recent
                    </span>
                  </div>
                )}
                <EntriesGrid
                  entries={recentEntries}
                  viewMode={viewMode}
                  entryTypeLabels={entryTypeLabels}
                  onSelect={onSelectEntry}
                  onDelete={(id, title) => handleDeleteClick(id, title)}
                  onDuplicate={(id) => duplicateEntry.mutate({ id })}
                  onTogglePin={(id, isPinned) =>
                    updateEntry.mutate({ id, isPinned: !isPinned })
                  }
                  onArchive={(id) =>
                    updateEntry.mutate({ id, isArchived: true })
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-sidebar border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete entry?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete "{deleteConfirmTitle}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
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

// ============================================================================
// Entries Grid Component
// ============================================================================

interface EntriesGridProps {
  entries: JournalListEntry[];
  viewMode: "grid" | "list";
  entryTypeLabels: Record<string, string>;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean | null) => void;
  onArchive: (id: string) => void;
}

function EntriesGrid({
  entries,
  viewMode,
  entryTypeLabels,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
}: EntriesGridProps) {
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
            onArchive={() => onArchive(entry.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

// ============================================================================
// Entry Card Component
// ============================================================================

interface EntryCardProps {
  entry: JournalListEntry;
  entryTypeLabels: Record<string, string>;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
}

function EntryCard({
  entry,
  entryTypeLabels,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
}: EntryCardProps) {
  const updatedAt = new Date(entry.updatedAt);
  const timeAgo = formatDistanceToNow(updatedAt, { addSuffix: true });

  return (
    <div
      className="group relative rounded-md bg-sidebar border border-white/5 hover:border-white/10 transition-colors cursor-pointer overflow-hidden"
      onClick={onSelect}
    >
      {/* Cover image */}
      {entry.coverImageUrl ? (
        <div className="h-24 bg-sidebar-accent overflow-hidden">
          <img
            src={entry.coverImageUrl}
            alt=""
            className="w-full h-full object-cover opacity-80"
          />
        </div>
      ) : (
        <EntryCoverPattern entryType={entry.entryType ?? undefined} title={entry.title} />
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-2">
          {entry.emoji && <span className="text-xl">{entry.emoji}</span>}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white truncate">{entry.title}</h3>
            {entry.preview && (
              <p className="text-sm text-white/40 line-clamp-2 mt-1">
                {entry.preview}
              </p>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="mt-3 -mx-4 border-t border-white/5" />

        {/* Meta */}
        <div className="flex items-center gap-2 mt-3 text-xs text-white/40">
          <span>{timeAgo}</span>
          {entry.readTimeMinutes && (
            <>
              <span>•</span>
              <span>{entry.readTimeMinutes} min read</span>
            </>
          )}
          {entry.entryType && entry.entryType !== "general" && (
            <>
              <span>•</span>
              <Badge
                variant="outline"
                className="text-xs border-white/10 text-white/40"
              >
                {entryTypeLabels[entry.entryType] || entry.entryType}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Actions menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70 border-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-sidebar border-white/10"
          >
            <DropdownMenuItem
              className="text-white/80 focus:text-white focus:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              <Pin className="h-4 w-4 mr-2" />
              {entry.isPinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-white/80 focus:text-white focus:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="text-white/80 focus:text-white focus:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pin indicator */}
      {entry.isPinned && (
        <div className="absolute top-2 left-2">
          <Pin className="h-4 w-4 text-teal-400" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Entry List Item Component
// ============================================================================

interface EntryListItemProps {
  entry: JournalListEntry;
  entryTypeLabels: Record<string, string>;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
}

function EntryListItem({
  entry,
  entryTypeLabels,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
}: EntryListItemProps) {
  const updatedAt = new Date(entry.updatedAt);

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-md bg-sidebar border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      {/* Icon/Emoji */}
      <div className="flex items-center justify-center w-10 h-10 bg-sidebar-accent text-white/60">
        {entry.emoji ? (
          <span className="text-xl">{entry.emoji}</span>
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {entry.isPinned && <Pin className="h-3 w-3 text-teal-400" />}
          <h3 className="font-medium text-white truncate">{entry.title}</h3>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
          <span>{format(updatedAt, "MMM d, yyyy")}</span>
          {entry.readTimeMinutes && (
            <>
              <span>•</span>
              <span>{entry.readTimeMinutes} min</span>
            </>
          )}
          {entry.entryType && entry.entryType !== "general" && (
            <>
              <span>•</span>
              <span>{entryTypeLabels[entry.entryType] || entry.entryType}</span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className={journalCompactActionIconButtonClassName}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-sidebar border-white/10"
          >
            <DropdownMenuItem
              className="text-white/80 focus:text-white focus:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              <Pin className="h-4 w-4 mr-2" />
              {entry.isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-white/80 focus:text-white focus:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ onCreateEntry }: { onCreateEntry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-md bg-sidebar-accent flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-white/20" />
      </div>
      <h3 className="text-lg font-medium text-white mb-1">
        No journal entries yet
      </h3>
      <p className="text-sm text-white/40 mb-4 max-w-xs">
        Start documenting your trading journey, reviewing trades, and tracking
        your progress
      </p>
      <Button
        onClick={onCreateEntry}
        className={journalToolbarPrimaryButtonClassName}
      >
        <Plus className="h-4 w-4 mr-1" />
        Create your first entry
      </Button>
    </div>
  );
}
