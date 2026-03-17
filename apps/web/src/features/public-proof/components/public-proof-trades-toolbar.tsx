"use client";

import * as React from "react";
import { ChevronDown, ListFilterPlus, Rows3, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  PUBLIC_PROOF_GROUP_OPTIONS,
  getPublicProofSortBadge,
  type PublicProofGroupBy,
  type PublicProofSortValue,
} from "@/features/public-proof/lib/public-proof-trades-table";
import { tradesToolbarStyles } from "@/features/trades/table-toolbar/lib/trades-toolbar-styles";

const SORT_OPTIONS: Array<{ label: string; value: PublicProofSortValue }> = [
  { label: "Latest activity", value: "time:desc" },
  { label: "Earliest activity", value: "time:asc" },
  { label: "Highest profit and loss", value: "profit:desc" },
  { label: "Lowest profit and loss", value: "profit:asc" },
  { label: "Highest volume", value: "volume:desc" },
  { label: "Lowest volume", value: "volume:asc" },
  { label: "Longest hold", value: "durationSeconds:desc" },
  { label: "Shortest hold", value: "durationSeconds:asc" },
  { label: "A→Z symbols", value: "symbol:asc" },
  { label: "Z→A symbols", value: "symbol:desc" },
];

function PublicProofFilterSubmenu({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onValueChange: (value: string) => void;
}) {
  const {
    filterMenuSubContentClass,
    filterMenuTriggerClass,
    selectMenuItemClass,
  } = tradesToolbarStyles;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className={cn(filterMenuSubContentClass, "w-[220px] p-1")}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className={selectMenuItemClass}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function PublicProofTradesToolbar({
  searchValue,
  onSearchChange,
  outcomeFilter,
  onOutcomeFilterChange,
  sourceFilter,
  onSourceFilterChange,
  statusFilter,
  onStatusFilterChange,
  editFilter,
  onEditFilterChange,
  sortValue,
  onSortChange,
  onClearSort,
  groupBy,
  onGroupByChange,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  outcomeFilter: string;
  onOutcomeFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  editFilter: string;
  onEditFilterChange: (value: string) => void;
  sortValue: PublicProofSortValue;
  onSortChange: (value: PublicProofSortValue) => void;
  onClearSort: () => void;
  groupBy: PublicProofGroupBy | null;
  onGroupByChange: (value: PublicProofGroupBy | null) => void;
}) {
  const {
    activeBadgeClass,
    badgeBaseClass,
    filterMenuContentClass,
    filterMenuMainSeparatorClass,
    filterMenuSectionTitleClass,
    iconBadgeClass,
    selectMenuContentClass,
    selectMenuItemClass,
  } = tradesToolbarStyles;

  const appliedFilterCount = [
    outcomeFilter !== "all",
    sourceFilter !== "all",
    statusFilter !== "all",
    editFilter !== "all",
  ].filter(Boolean).length;
  const sortBadge = getPublicProofSortBadge(sortValue);

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex w-full items-center gap-2">
        <div className="group relative flex h-[38px] w-full items-center rounded-sm ring ring-white/5 pl-8 pr-2 transition duration-250 hover:bg-sidebar-accent xl:max-w-xl">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40 transition-colors group-hover:text-white/60" />
          <Input
            type="search"
            placeholder="Search symbol, source, outcome, status"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-full border-none bg-transparent! px-0 py-0 text-xs ring-0 placeholder:text-white/25 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "relative",
                  iconBadgeClass,
                  appliedFilterCount > 0 && activeBadgeClass,
                  "rounded-none bg-transparent ring-0 hover:bg-transparent"
                )}
                aria-label={
                  appliedFilterCount > 0
                    ? `Filters applied: ${appliedFilterCount}`
                    : "Open filters"
                }
              >
                <ListFilterPlus className="size-4 text-white/60 hover:text-white" />
                {appliedFilterCount > 0 ? (
                  <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal-400" />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={filterMenuContentClass}>
              <div className={filterMenuSectionTitleClass}>Filters</div>
              <Separator className={filterMenuMainSeparatorClass} />
              <PublicProofFilterSubmenu
                label="Outcome"
                value={outcomeFilter}
                onValueChange={onOutcomeFilterChange}
                options={[
                  { label: "All outcomes", value: "all" },
                  { label: "Win", value: "Win" },
                  { label: "Loss", value: "Loss" },
                  { label: "Breakeven", value: "BE" },
                  { label: "Partial win", value: "PW" },
                ]}
              />
              <PublicProofFilterSubmenu
                label="Source"
                value={sourceFilter}
                onValueChange={onSourceFilterChange}
                options={[
                  { label: "All sources", value: "all" },
                  { label: "Broker sync", value: "broker_sync" },
                  { label: "CSV import", value: "csv_import" },
                  { label: "Manual entry", value: "manual_entry" },
                ]}
              />
              <PublicProofFilterSubmenu
                label="Status"
                value={statusFilter}
                onValueChange={onStatusFilterChange}
                options={[
                  { label: "All rows", value: "all" },
                  { label: "Live trades", value: "live" },
                  { label: "Closed trades", value: "closed" },
                ]}
              />
              <PublicProofFilterSubmenu
                label="Edits"
                value={editFilter}
                onValueChange={onEditFilterChange}
                options={[
                  { label: "All rows", value: "all" },
                  { label: "Edited only", value: "edited" },
                ]}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={badgeBaseClass}>
              Sort by
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(selectMenuContentClass, "w-[280px]")}
          >
            <div className={filterMenuSectionTitleClass}>Sort by</div>
            <Separator className={filterMenuMainSeparatorClass} />
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  selectMenuItemClass,
                  sortValue === option.value && "bg-sidebar-accent"
                )}
                onSelect={() => onSortChange(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
            <Separator className={filterMenuMainSeparatorClass} />
            <DropdownMenuItem
              className={selectMenuItemClass}
              onSelect={onClearSort}
            >
              Clear sort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {sortBadge ? (
          <Button className={badgeBaseClass} onClick={onClearSort}>
            {sortBadge}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(
                "relative",
                iconBadgeClass,
                groupBy && activeBadgeClass
              )}
              aria-label={groupBy ? `Grouped by ${groupBy}` : "Group trades"}
            >
              <Rows3 className="size-4" />
              {groupBy ? (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal-400" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(selectMenuContentClass, "w-[200px]")}
          >
            <div className={filterMenuSectionTitleClass}>Group by</div>
            <Separator className={filterMenuMainSeparatorClass} />
            {PUBLIC_PROOF_GROUP_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.key}
                className={cn(
                  selectMenuItemClass,
                  groupBy === option.key && "bg-sidebar-accent"
                )}
                onSelect={() =>
                  onGroupByChange(groupBy === option.key ? null : option.key)
                }
              >
                {option.label}
                {groupBy === option.key ? (
                  <span className="ml-auto text-teal-400">✓</span>
                ) : null}
              </DropdownMenuItem>
            ))}
            {groupBy ? (
              <>
                <Separator className={filterMenuMainSeparatorClass} />
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() => onGroupByChange(null)}
                >
                  Clear grouping
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
