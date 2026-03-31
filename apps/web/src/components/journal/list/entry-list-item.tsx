"use client";

import { format } from "date-fns";
import {
  Copy,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Share2,
  Square,
  SquareCheckBig,
  Trash2,
} from "lucide-react";

import { journalCompactActionIconButtonClassName } from "@/components/journal/action-button-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { JournalListEntryActions } from "@/components/journal/list/entry-card";
import type { JournalListEntry } from "@/components/journal/list/list-types";

export function EntryListItem({
  entry,
  entryTypeLabels,
  availableFolders,
  onSelect,
  onDelete,
  onDuplicate,
  onTogglePin,
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
} & Pick<
  JournalListEntryActions,
  | "onSelect"
  | "onDelete"
  | "onDuplicate"
  | "onTogglePin"
  | "onMoveToFolder"
  | "onRename"
  | "onToggleSelected"
>) {
  const updatedAt = new Date(entry.updatedAt);
  const isShared = entry.isShared === true;
  const isFolder = entry.itemType === "folder";
  const folderCount = entry.folderEntryCount ?? 0;

  if (isFolder) {
    return (
      <div
        className={[
          "group flex w-max max-w-full items-center gap-3 rounded-md px-2 py-2 transition",
          isDropTarget && "bg-teal-500/8",
        ].join(" ")}
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
        <JournalFolderBadge
          title={entry.title}
          previewItems={entry.folderPreviewItems}
          className="scale-[0.78]"
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-white">{entry.title}</h3>
          <p className="mt-1 text-xs text-white/40">
            {folderCount > 0
              ? `${folderCount} ${folderCount === 1 ? "entry" : "entries"} inside`
              : "Empty folder"}
          </p>
        </div>

        {!isShared ? (
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
    );
  }

  return (
    <div
      className={[
        "group flex items-center gap-3 rounded-md border bg-sidebar p-3 transition-colors",
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
      <div className="flex h-10 w-10 items-center justify-center bg-sidebar-accent text-white/60">
        {entry.emoji ? (
          <span className="text-xl">{entry.emoji}</span>
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {entry.isPinned && !isShared && !isFolder ? (
            <Pin className="h-3 w-3 text-teal-400" />
          ) : null}
          <h3 className="truncate font-medium text-white">{entry.title}</h3>
        </div>
        {isShared ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-teal-400/20 bg-teal-500/10 text-[10px] text-teal-200"
            >
              <Share2 className="size-3" />
              Shared journal
            </Badge>
            {entry.shareName ? (
              <span className="text-xs text-white/35">{entry.shareName}</span>
            ) : null}
          </div>
        ) : null}
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
              <span>{entryTypeLabels[entry.entryType] || "General"}</span>
            </>
          ) : null}
        </div>
      </div>

      {!isShared ? (
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
              <>
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
          className="rounded-sm p-1 text-white/80 transition hover:text-white"
        >
          {isSelected ? (
            <SquareCheckBig className="h-4 w-4 text-teal-300" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
