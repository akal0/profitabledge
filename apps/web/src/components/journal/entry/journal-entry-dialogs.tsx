"use client";

import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SaveTemplateDialog } from "@/components/journal/template-browser";
import { cn } from "@/lib/utils";
import { journalActionButtonMutedClassName } from "@/components/journal/action-button-styles";
import { Smile, Trash2, X } from "lucide-react";

export function JournalEntryDialogs({
  showEmojiPicker,
  emoji,
  title,
  content,
  showSaveTemplateDialog,
  showDeleteConfirm,
  onShowEmojiPickerChange,
  onEmojiSelect,
  onRemoveEmoji,
  onShowSaveTemplateDialogChange,
  onTemplateSaved,
  onShowDeleteConfirmChange,
  onDelete,
}: {
  showEmojiPicker: boolean;
  emoji: string | null;
  title: string;
  content: unknown;
  showSaveTemplateDialog: boolean;
  showDeleteConfirm: boolean;
  onShowEmojiPickerChange: (open: boolean) => void;
  onEmojiSelect: (emoji: string) => void;
  onRemoveEmoji: () => void;
  onShowSaveTemplateDialogChange: (open: boolean) => void;
  onTemplateSaved: () => void;
  onShowDeleteConfirmChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Dialog open={showEmojiPicker} onOpenChange={onShowEmojiPickerChange}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-[352px]"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Smile className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Choose an icon</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">Select an emoji to represent this journal entry</p>
              </div>
              <DialogClose asChild>
                <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            {/* Body */}
            <div className="emoji-picker-wrapper">
              <Picker
                data={data}
                onEmojiSelect={(selected: { native: string }) =>
                  onEmojiSelect(selected.native)
                }
                theme="dark"
                set="native"
                previewPosition="none"
                skinTonePosition="none"
                navPosition="bottom"
                perLine={8}
                maxFrequentRows={2}
              />
            </div>
            {emoji ? (
              <div className="p-4 pt-0">
                <Button
                  size="sm"
                  className={cn(
                    journalActionButtonMutedClassName,
                    "w-full text-red-400 hover:bg-red-400/10 hover:text-red-400"
                  )}
                  onClick={onRemoveEmoji}
                >
                  Remove icon
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <SaveTemplateDialog
        isOpen={showSaveTemplateDialog}
        onClose={() => onShowSaveTemplateDialogChange(false)}
        entryTitle={title}
        entryContent={content as any}
        onSaved={onTemplateSaved}
      />

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={onShowDeleteConfirmChange}
      >
        <AlertDialogContent
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md [&>button]:hidden"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-sm font-medium text-white">
                  Delete entry?
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-xs leading-relaxed text-white/40">
                  Are you sure you want to delete "{title}"? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
            <Separator />

            {/* Footer */}
            <AlertDialogFooter className="flex items-center justify-end gap-2 px-5 py-3">
              <AlertDialogCancel className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-red-500/20 bg-red-500/12 px-3 py-2 h-9 text-xs text-red-200 transition-all duration-250 active:scale-95 hover:bg-red-500/18 shadow-none"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
