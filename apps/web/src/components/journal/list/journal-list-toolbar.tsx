"use client";

import {
  ChevronDown,
  LayoutGrid,
  List,
  ListFilterPlus,
  Plus,
  Search,
  SortAsc,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  toolbarFilterMenuContentClass,
  toolbarFilterMenuItemClass,
  toolbarFilterMenuMainSeparatorClass,
  toolbarFilterMenuSectionTitleClass,
  toolbarFilterMenuSubContentClass,
  toolbarFilterMenuSurfaceClass,
  toolbarFilterMenuTriggerClass,
} from "@/components/ui/filter-menu-styles";
import { journalToolbarPrimaryButtonClassName } from "@/components/journal/list/journal-list-shared";
import {
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
  journalSegmentedActionButtonActiveClassName,
  journalSegmentedActionButtonClassName,
  journalSegmentedActionContainerClassName,
} from "@/components/journal/action-button-styles";
import { entryTypeConfig } from "@/components/journal/list/list-types";

type EntryTypeFilter =
  | "general"
  | "daily"
  | "weekly"
  | "monthly"
  | "comparison"
  | "trade_review"
  | "strategy"
  | "backtest"
  | null;
type DateRangeFilter = "all" | "today" | "week" | "month";
type SortField = "updatedAt" | "createdAt" | "title";
type ViewMode = "grid" | "list";

interface AppliedFilter {
  key: string;
  label: string;
  onClear: () => void;
}

interface JournalListToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  appliedFilters: AppliedFilter[];
  shouldGroupFilters: boolean;
  forceEntryType?: string;
  filterEntryType: EntryTypeFilter;
  onFilterEntryTypeChange: (value: EntryTypeFilter) => void;
  filterDateRange: DateRangeFilter;
  onFilterDateRangeChange: (value: DateRangeFilter) => void;
  dateRangeLabelMap: Record<DateRangeFilter, string>;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  sortBy: SortField;
  onSortByChange: (value: SortField) => void;
  onClearFilters: () => void;
  onCreateEntry: () => void;
  onOpenSearchDialog: () => void;
}

export function JournalListToolbar({
  searchInput,
  onSearchChange,
  appliedFilters,
  shouldGroupFilters,
  forceEntryType,
  filterEntryType,
  onFilterEntryTypeChange,
  filterDateRange,
  onFilterDateRangeChange,
  dateRangeLabelMap,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  onClearFilters,
  onCreateEntry,
  onOpenSearchDialog,
}: JournalListToolbarProps) {
  const badgeBaseClass =
    "cursor-pointer flex h-[38px] items-center justify-center rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:text-white";
  const filterMenuContentClass = cn(toolbarFilterMenuContentClass, "w-[280px]");
  const filterMenuSubContentClass = cn(
    toolbarFilterMenuSubContentClass,
    "w-[220px]"
  );
  const filterMenuSectionTitleClass = toolbarFilterMenuSectionTitleClass;
  const filterMenuMainSeparatorClass = toolbarFilterMenuMainSeparatorClass;
  const filterMenuTriggerClass = toolbarFilterMenuTriggerClass;
  const filterMenuItemClass = toolbarFilterMenuItemClass;
  const selectMenuContentClass = cn(
    toolbarFilterMenuSurfaceClass,
    "px-1.5 pb-2 pt-0.5"
  );

  return (
    <div className="shrink-0">
      <div className="px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="group relative flex h-9 w-full max-w-[32rem] items-center rounded-md ring ring-white/5 pl-8 pr-2 transition duration-250 hover:bg-sidebar-accent">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/40 transition-colors group-hover:text-white/60" />
              <Input
                value={searchInput}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by title"
                className="h-full ring-0 bg-transparent px-0 py-0 text-xs text-white placeholder:text-white/30 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 group-hover:bg-transparent border-none hover:bg-transparent"
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="relative bg-transparent px-1 py-0 text-[11px] text-white/60 shadow-none hover:bg-transparent hover:text-white ring-0">
                    <ListFilterPlus className="size-4" />
                    {appliedFilters.length > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-md ring ring-white/10 bg-white/[0.08] px-1 text-[10px] font-medium leading-none text-white/80">
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
                  <DropdownMenuSeparator
                    className={filterMenuMainSeparatorClass}
                  />

                  {!forceEntryType ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger
                        className={filterMenuTriggerClass}
                      >
                        Entry Type
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent
                        className={filterMenuSubContentClass}
                      >
                        <DropdownMenuRadioGroup
                          value={filterEntryType ?? "__all__"}
                          onValueChange={(value) =>
                            onFilterEntryTypeChange(
                              value === "__all__"
                                ? null
                                : (value as EntryTypeFilter)
                            )
                          }
                        >
                          <DropdownMenuRadioItem
                            value="__all__"
                            className={filterMenuItemClass}
                          >
                            All
                          </DropdownMenuRadioItem>
                          {Object.entries(entryTypeConfig).map(
                            ([key, config]) => {
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
                            }
                          )}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : null}

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                      Date Range
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      className={filterMenuSubContentClass}
                    >
                      <DropdownMenuRadioGroup
                        value={filterDateRange}
                        onValueChange={(value) =>
                          onFilterDateRangeChange(value as DateRangeFilter)
                        }
                      >
                        {Object.entries(dateRangeLabelMap).map(
                          ([value, label]) => (
                            <DropdownMenuRadioItem
                              key={value}
                              value={value}
                              className={filterMenuItemClass}
                            >
                              {label}
                            </DropdownMenuRadioItem>
                          )
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {appliedFilters.length > 0 ? (
                    <>
                      <DropdownMenuSeparator
                        className={filterMenuMainSeparatorClass}
                      />
                      <DropdownMenuItem
                        onSelect={onClearFilters}
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
              onClick={onOpenSearchDialog}
              className={journalActionIconButtonClassName}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={onCreateEntry}
              className={journalToolbarPrimaryButtonClassName}
              size="sm"
            >
              <Plus className="size-3" />
              New entry
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className={journalActionButtonMutedClassName}>
                  <SortAsc className="size-3" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="ring-white/10 bg-sidebar"
              >
                <DropdownMenuItem
                  className={cn(
                    "text-white/80 focus:bg-white/10 focus:text-white",
                    sortBy === "updatedAt" && "bg-white/5"
                  )}
                  onClick={() => onSortByChange("updatedAt")}
                >
                  Last modified
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "text-white/80 focus:bg-white/10 focus:text-white",
                    sortBy === "createdAt" && "bg-white/5"
                  )}
                  onClick={() => onSortByChange("createdAt")}
                >
                  Date created
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "text-white/80 focus:bg-white/10 focus:text-white",
                    sortBy === "title" && "bg-white/5"
                  )}
                  onClick={() => onSortByChange("title")}
                >
                  Title
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className={journalSegmentedActionContainerClassName}>
              <button
                onClick={() => onViewModeChange("grid")}
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
                onClick={() => onViewModeChange("list")}
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
    </div>
  );
}
