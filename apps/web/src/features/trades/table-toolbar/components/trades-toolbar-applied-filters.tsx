"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { tradesToolbarStyles } from "../lib/trades-toolbar-styles";
import type { AppliedFilter } from "../lib/trades-toolbar-types";

export function TradesToolbarAppliedFilters({
  filters,
}: {
  filters: AppliedFilter[];
}) {
  const { badgeBaseClass, selectMenuContentClass } = tradesToolbarStyles;

  if (filters.length === 0) {
    return null;
  }

  if (filters.length > 1) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={cn(badgeBaseClass, "gap-2")}>
            Filters ({filters.length})
            <ChevronDown className="size-3.5 text-white/60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={cn(selectMenuContentClass, "w-[320px]")}>
          {filters.map((filter) => (
            <DropdownMenuItem
              key={filter.key}
              className="p-0 focus:bg-transparent"
              onSelect={filter.onClear}
            >
              <span className={cn(badgeBaseClass, "flex w-full items-center justify-between")}>
                {filter.label}
                <span className="ml-2">×</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return filters.map((filter) => (
    <Button key={filter.key} className={badgeBaseClass} onClick={filter.onClear}>
      {filter.label}
      <span className="ml-2">×</span>
    </Button>
  ));
}
