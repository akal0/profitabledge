"use client";

import * as React from "react";
import type { Column } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  label: string;
  tooltip?: string;
  className?: string;
}

export function SortableHeader<TData, TValue>({
  column,
  label,
  tooltip,
  className,
}: SortableHeaderProps<TData, TValue>) {
  const isSorted = column.getIsSorted();
  const canSort = column.getCanSort();

  const handleClick = () => {
    if (!canSort) return;

    // Cycle through: none -> asc -> desc -> none
    if (!isSorted) {
      column.toggleSorting(false); // asc
    } else if (isSorted === "asc") {
      column.toggleSorting(true); // desc
    } else {
      column.clearSorting(); // none
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const SortIcon = () => {
    if (!canSort) return null;

    if (!isSorted) {
      return <ArrowUpDown className="size-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />;
    }

    if (isSorted === "asc") {
      return <ArrowUp className="size-3.5 text-teal-400" />;
    }

    return <ArrowDown className="size-3.5 text-teal-400" />;
  };

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 select-none group",
        canSort && "cursor-pointer hover:text-white transition-colors",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={canSort ? "button" : undefined}
      tabIndex={canSort ? 0 : undefined}
      aria-sort={
        !isSorted ? "none" : isSorted === "asc" ? "ascending" : "descending"
      }
    >
      <span className="text-xs font-medium tracking-wide uppercase text-white/50 group-hover:text-white/70">
        {label}
      </span>
      <SortIcon />
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
