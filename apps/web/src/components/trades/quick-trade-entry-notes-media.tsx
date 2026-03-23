"use client";

import { Paperclip, StickyNote } from "lucide-react";

import { JournalEditor } from "@/components/journal/editor";
import type { JournalBlock } from "@/components/journal/types";
import {
  MediaDropzone,
  type MediaFile,
} from "@/components/media/media-dropzone";
import { TRADE_SURFACE_CARD_CLASS } from "@/components/trades/trade-identifier-pill";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type QuickTradeEntryNotesMediaProps = {
  noteEditorKey: number;
  noteContent: JournalBlock[];
  onNoteChange: (blocks: JournalBlock[], html: string) => void;
  mediaFiles: MediaFile[];
  onFilesSelected: (files: MediaFile[]) => void;
  onFileRemove: (id: string) => void;
  disabled?: boolean;
};

export function QuickTradeEntryNotesMedia({
  noteEditorKey,
  noteContent,
  onNoteChange,
  mediaFiles,
  onFilesSelected,
  onFileRemove,
  disabled = false,
}: QuickTradeEntryNotesMediaProps) {
  return (
    <>
      <div className="px-6 py-3">
        <h3 className="text-xs font-semibold tracking-wide text-white/70">
          Notes & annotations
        </h3>
      </div>
      <Separator />
      <div className="space-y-5 px-6 py-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StickyNote className="size-4 text-white/45" />
            <span className="text-xs text-white/50">
              Capture your execution notes before you save the trade.
            </span>
          </div>
          <div className={cn(TRADE_SURFACE_CARD_CLASS, "overflow-hidden")}>
            <JournalEditor
              key={noteEditorKey}
              initialContent={noteContent}
              onChange={onNoteChange}
              placeholder="Add notes about this trade... Use '/' for commands"
              autoFocus={false}
              className="[&_.journal-editor-content]:px-6 [&_.journal-editor-content]:py-4 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-white/45" />
            <span className="text-xs text-white/50">
              Add screenshots or recordings now and they will attach after the
              trade is created.
            </span>
          </div>
          <MediaDropzone
            files={mediaFiles}
            onFilesSelected={onFilesSelected}
            onFileRemove={onFileRemove}
            disabled={disabled}
          />
        </div>
      </div>
      <Separator />
    </>
  );
}
