"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Copy,
  MoreHorizontal,
  Pin,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntryCoverPattern } from "@/components/journal/list/entry-cover-pattern";
import type { JournalListEntry } from "@/components/journal/list/list-types";

export interface JournalListEntryActions {
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
}

export function EntryCard({
  entry,
  entryTypeLabels,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
}: {
  entry: JournalListEntry;
  entryTypeLabels: Record<string, string>;
} & JournalListEntryActions) {
  const updatedAt = new Date(entry.updatedAt);
  const timeAgo = formatDistanceToNow(updatedAt, { addSuffix: true });
  const isShared = entry.isShared === true;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-md border border-white/5 bg-sidebar transition-colors hover:border-white/10"
      onClick={onSelect}
    >
      {entry.coverImageUrl ? (
        <div className="h-24 overflow-hidden bg-sidebar-accent">
          <img
            src={entry.coverImageUrl}
            alt=""
            className="h-full w-full object-cover opacity-80"
            style={{
              objectPosition: `center ${entry.coverImagePosition ?? 50}%`,
            }}
          />
        </div>
      ) : (
        <EntryCoverPattern
          entryType={entry.entryType ?? undefined}
          title={entry.title}
        />
      )}

      <div className="p-4">
        <div className="mb-2 flex items-start gap-2">
          {entry.emoji ? <span className="text-xl">{entry.emoji}</span> : null}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-white">{entry.title}</h3>
            {isShared ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-teal-400/20 bg-teal-500/10 text-[10px] text-teal-200"
                >
                  <Share2 className="mr-1 h-3 w-3" />
                  Shared journal
                </Badge>
                {entry.shareName ? (
                  <span className="text-xs text-white/35">{entry.shareName}</span>
                ) : null}
              </div>
            ) : null}
            {entry.preview ? (
              <p className="mt-1 line-clamp-2 text-sm text-white/40">
                {entry.preview}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 -mx-4 border-t border-white/5" />

        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <span>{timeAgo}</span>
          {entry.readTimeMinutes ? (
            <>
              <span>•</span>
              <span>{entry.readTimeMinutes} min read</span>
            </>
          ) : null}
          {entry.entryType && entry.entryType !== "general" ? (
            <>
              <span>•</span>
              <Badge
                variant="outline"
                className="border-white/10 text-xs text-white/40"
              >
                {entryTypeLabels[entry.entryType] || "General"}
              </Badge>
            </>
          ) : null}
        </div>
      </div>

      {!isShared ? (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-7 border-0 bg-black/50 p-0 hover:bg-black/70"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4 text-white" />
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
                {entry.isPinned ? "Unpin" : "Pin to top"}
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
                className="text-white/80 focus:bg-white/10 focus:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive();
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
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
      ) : null}

      {entry.isPinned && !isShared ? (
        <div className="absolute left-2 top-2">
          <Pin className="h-4 w-4 text-teal-400" />
        </div>
      ) : null}
    </div>
  );
}
