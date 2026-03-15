"use client";

import { format } from "date-fns";
import { Copy, FileText, MoreHorizontal, Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { journalCompactActionIconButtonClassName } from "@/components/journal/action-button-styles";
import type { JournalListEntry } from "@/components/journal/list/list-types";
import type { JournalListEntryActions } from "@/components/journal/list/entry-card";

export function EntryListItem({
  entry,
  entryTypeLabels,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
}: {
  entry: JournalListEntry;
  entryTypeLabels: Record<string, string>;
} & Pick<
  JournalListEntryActions,
  "onSelect" | "onDelete" | "onDuplicate" | "onTogglePin"
>) {
  const updatedAt = new Date(entry.updatedAt);

  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-md border border-white/5 bg-sidebar p-3 transition-colors hover:border-white/10"
      onClick={onSelect}
    >
      <div className="flex h-10 w-10 items-center justify-center bg-sidebar-accent text-white/60">
        {entry.emoji ? (
          <span className="text-xl">{entry.emoji}</span>
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {entry.isPinned ? <Pin className="h-3 w-3 text-teal-400" /> : null}
          <h3 className="truncate font-medium text-white">{entry.title}</h3>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
          <span>{format(updatedAt, "MMM d, yyyy")}</span>
          {entry.readTimeMinutes ? (
            <>
              <span>•</span>
              <span>{entry.readTimeMinutes} min</span>
            </>
          ) : null}
          {entry.entryType && entry.entryType !== "general" ? (
            <>
              <span>•</span>
              <span>{entryTypeLabels[entry.entryType] || entry.entryType}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className={journalCompactActionIconButtonClassName}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="border-white/10 bg-sidebar"
          >
            <DropdownMenuItem
              className="text-white/80 focus:bg-white/10 focus:text-white"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin();
              }}
            >
              <Pin className="mr-2 h-4 w-4" />
              {entry.isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-white/80 focus:bg-white/10 focus:text-white"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="text-red-400 focus:bg-red-400/10 focus:text-red-400"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
