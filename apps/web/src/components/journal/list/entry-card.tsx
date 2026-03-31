"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Copy,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Share2,
  Square,
  SquareCheckBig,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JournalFolderBadge } from "@/components/journal/list/journal-folder-badge";
import { EntryCoverPattern } from "@/components/journal/list/entry-cover-pattern";
import type { JournalListEntry } from "@/components/journal/list/list-types";

export interface JournalListEntryActions {
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onRename: () => void;
  onToggleSelected?: () => void;
}

export function EntryCard({
  entry,
  entryTypeLabels,
  availableFolders,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
  onArchive,
  onMoveToFolder,
  onRename,
  onToggleSelected,
  onDragStart,
  onDragEnd,
  onDragTarget,
  onDropEntry,
  isDropTarget,
  selectionMode,
  isSelected,
}: {
  entry: JournalListEntry;
  entryTypeLabels: Record<string, string>;
  availableFolders: Array<{ id: string; title: string }>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragTarget?: () => void;
  onDropEntry?: () => void;
  isDropTarget?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
} & JournalListEntryActions) {
  const updatedAt = new Date(entry.updatedAt);
  const timeAgo = formatDistanceToNow(updatedAt, { addSuffix: true });
  const isShared = entry.isShared === true;
  const isFolder = entry.itemType === "folder";
  const folderCount = entry.folderEntryCount ?? 0;

  if (isFolder) {
    return (
      <div
        className={cn(
          "group relative flex w-max max-w-full cursor-pointer flex-col items-start gap-2 rounded-md px-2 py-3 transition",
          isDropTarget && "bg-teal-500/8"
        )}
        onClick={onSelect}
        onDragOver={(event) => {
          if (!onDropEntry) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDragTarget?.();
        }}
        onDrop={(event) => {
          if (!onDropEntry) return;
          event.preventDefault();
          event.stopPropagation();
          onDropEntry();
        }}
      >
        <div className="relative">
          <JournalFolderBadge
            title={entry.title}
            previewItems={entry.folderPreviewItems}
          />
          {!isShared ? (
            <div className="absolute -right-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100">
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
                <DropdownMenuContent align="end" className="border-white/10 bg-sidebar">
                  <DropdownMenuItem
                    className="text-white/80 focus:bg-white/10 focus:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRename();
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename folder
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
        </div>

        <div className="min-w-0 pl-1">
          <h3 className="truncate text-sm font-medium text-white">{entry.title}</h3>
          <p className="mt-1 text-xs text-white/45">
            {folderCount > 0
              ? `${folderCount} ${folderCount === 1 ? "entry" : "entries"} inside`
              : "Empty folder"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-md border bg-sidebar transition-colors",
        isDropTarget
          ? "border-teal-400/50 ring-1 ring-teal-400/30"
          : "border-white/5 hover:border-white/10",
        "cursor-grab active:cursor-grabbing",
        selectionMode && isSelected && "border-teal-400/40 ring-1 ring-teal-400/30",
      ].join(" ")}
      onClick={onSelect}
      draggable={!isShared}
      onDragStart={(event) => {
        if (isShared) return;
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entry.id);
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(event) => {
        if (!onDropEntry) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragTarget?.();
      }}
      onDrop={(event) => {
        if (!onDropEntry) return;
        event.preventDefault();
        event.stopPropagation();
        onDropEntry();
      }}
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="ring-teal-400/30 bg-teal-500/10 text-[10px] text-teal-200"
                >
                  <Share2 className="size-3" />
                  Shared journal
                </Badge>
                {entry.shareName ? (
                  <span className="text-xs text-white/35">
                    {entry.shareName}
                  </span>
                ) : null}
              </div>
            ) : null}
            {entry.preview ? (
              <p className="mt-2 line-clamp-2 text-sm text-white/40">
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
              <>
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
                {availableFolders.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-white/80 focus:bg-white/10 focus:text-white">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Move to folder
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="border-white/10 bg-sidebar">
                      {entry.folderId ? (
                        <DropdownMenuItem
                          className="text-white/80 focus:bg-white/10 focus:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMoveToFolder(null);
                          }}
                        >
                          Remove from folder
                        </DropdownMenuItem>
                      ) : null}
                      {availableFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          className="text-white/80 focus:bg-white/10 focus:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMoveToFolder(folder.id);
                          }}
                        >
                          {folder.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
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
              </>
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

      {selectionMode ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelected?.();
          }}
          className="absolute left-2 top-2 rounded-sm bg-black/45 p-1 text-white/80 transition hover:text-white"
        >
          {isSelected ? (
            <SquareCheckBig className="h-4 w-4 text-teal-300" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ) : null}

      {entry.isPinned && !isShared ? (
        <div className="absolute left-2 top-2">
          <Pin className="h-4 w-4 text-teal-400" />
        </div>
      ) : null}
    </div>
  );
}
