"use client";

import { Archive, ChevronLeft, Copy, FileText, MoreHorizontal, Save, Share, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
} from "@/components/journal/action-button-styles";

export function JournalEntryHeader({
  title,
  hasChanges,
  isSaving,
  onBack,
  onSave,
  onShowSaveTemplateDialog,
  onShowDeleteConfirm,
}: {
  title: string;
  hasChanges: boolean;
  isSaving: boolean;
  onBack?: () => void;
  onSave: () => void;
  onShowSaveTemplateDialog: () => void;
  onShowDeleteConfirm: () => void;
}) {
  return (
    <>
      <div className="sticky top-0 z-20 bg-sidebar backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
        <div className="flex items-center justify-between px-8 py-2">
          <div className="flex items-center gap-2">
            {onBack ? (
              <Button
                size="sm"
                onClick={onBack}
                className={journalActionIconButtonClassName}
              >
                <ChevronLeft className="size-3" />
              </Button>
            ) : null}
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span>Journal</span>
              <span>/</span>
              <span className="max-w-48 truncate text-white">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges ? (
              <span className="text-xs text-white/40">Unsaved changes</span>
            ) : null}
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving || !hasChanges}
              className={journalActionButtonMutedClassName}
            >
              {isSaving ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Save className="size-3" />
                  Save changes
                </>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className={journalActionIconButtonClassName}>
                  <MoreHorizontal className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-white/10 bg-sidebar text-xs!"
              >
                <DropdownMenuItem className="text-xs! text-white/80 focus:bg-white/10 focus:text-white">
                  <Star className="size-3!" />
                  Pin to top
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs! text-white/80 focus:bg-white/10 focus:text-white">
                  <Copy className="size-3!" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs! text-white/80 focus:bg-white/10 focus:text-white">
                  <Share className="size-3!" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs! text-white/80 focus:bg-white/10 focus:text-white"
                  onClick={onShowSaveTemplateDialog}
                >
                  <FileText className="size-3!" />
                  Save as template
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-xs! text-white/80 focus:bg-white/10 focus:text-white">
                  <Archive className="size-3!" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs! text-red-400 focus:bg-red-400/10 focus:text-red-400"
                  onClick={onShowDeleteConfirm}
                >
                  <Trash2 className="size-3!" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
}
