"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Trash2, FileText, BarChart2, X } from "lucide-react";

import { bulkActionsStyles } from "../lib/bulk-actions-styles";
import type { SelectedTradesStats } from "../lib/bulk-actions-types";

type BulkActionsDialogsProps = {
  selectedCount: number;
  deleteDialogOpen: boolean;
  notesDialogOpen: boolean;
  statsOpen: boolean;
  noteText: string;
  appendNote: boolean;
  stats?: SelectedTradesStats;
  deletePending: boolean;
  notesPending: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onNotesDialogOpenChange: (open: boolean) => void;
  onStatsOpenChange: (open: boolean) => void;
  onNoteTextChange: (value: string) => void;
  onAppendNoteChange: (checked: boolean) => void;
  onDelete: () => void;
  onAddNotes: () => void;
};

export function BulkActionsDialogs({
  selectedCount,
  deleteDialogOpen,
  notesDialogOpen,
  statsOpen,
  noteText,
  appendNote,
  stats,
  deletePending,
  notesPending,
  onDeleteDialogOpenChange,
  onNotesDialogOpenChange,
  onStatsOpenChange,
  onNoteTextChange,
  onAppendNoteChange,
  onDelete,
  onAddNotes,
}: BulkActionsDialogsProps) {
  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Delete Trades</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Are you sure you want to delete {selectedCount} trades? This action cannot be undone.
                </p>
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
            <div className="px-5 py-4">
              <div className={bulkActionsStyles.dialogSectionClass}>
                <p className="text-sm text-white/70">
                  Imported trades deleted here stay suppressed during future CSV
                  enrichment, so the same rows do not come back on the next import.
                </p>
              </div>
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <DialogClose asChild>
                <Button
                  className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={onDelete}
                disabled={deletePending}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-red-500/20 bg-red-500/12 px-3 py-2 h-9 text-xs text-red-200 transition-all duration-250 active:scale-95 hover:bg-red-500/18 shadow-none"
              >
                {deletePending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notesDialogOpen} onOpenChange={onNotesDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <FileText className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Add Notes</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">Add notes to {selectedCount} selected trades</p>
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
            <div className="px-5 py-4 space-y-4">
              <div className={cn("space-y-2", bulkActionsStyles.dialogSectionClass)}>
                <Label htmlFor="note-text" className="text-xs text-white/70">
                  Note
                </Label>
                <Textarea
                  id="note-text"
                  placeholder="Enter your note..."
                  value={noteText}
                  onChange={(event) => onNoteTextChange(event.target.value)}
                  className={cn(
                    "min-h-[120px] text-sm",
                    bulkActionsStyles.inputClass
                  )}
                />
              </div>
              <label
                htmlFor="append-note"
                className={bulkActionsStyles.checkboxRowClass}
              >
                <Checkbox
                  id="append-note"
                  checked={appendNote}
                  onCheckedChange={(checked) =>
                    onAppendNoteChange(checked === true)
                  }
                  className="border-white/10"
                />
                <div className="space-y-0.5">
                  <span className="block cursor-pointer text-xs font-medium text-white/78">
                    Append to existing notes
                  </span>
                  <span className="block text-[11px] text-white/45">
                    Keep current trade notes and add this text underneath.
                  </span>
                </div>
              </label>
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <DialogClose asChild>
                <Button
                  className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={onAddNotes}
                disabled={notesPending}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                {notesPending ? "Adding..." : "Add Notes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={statsOpen} onOpenChange={onStatsOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-2xl"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <BarChart2 className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Quick Stats</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">Statistics for {selectedCount} selected trades</p>
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
            <div className="px-5 py-4">
              {stats ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>
                      Total P&amp;L
                    </div>
                    <div
                      className={cn(
                        "mt-3 text-2xl font-bold",
                        (stats.totalPnL || 0) >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      $
                      {Number(stats.totalPnL || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>
                      Net P&amp;L
                    </div>
                    <div
                      className={cn(
                        "mt-3 text-2xl font-bold",
                        (stats.netPnL || 0) >= 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      $
                      {Number(stats.netPnL || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>Win Rate</div>
                    <div className="mt-3 text-xl font-semibold text-white">
                      {Number(stats.winRate || 0).toFixed(1)}%
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      {stats.wins || 0}W / {stats.losses || 0}L /{" "}
                      {stats.breakeven || 0}BE
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>Avg RR</div>
                    <div className="mt-3 text-xl font-semibold text-white">
                      {Number(stats.avgRR || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>
                      Total Volume
                    </div>
                    <div className="mt-3 text-xl font-semibold text-white">
                      {Number(stats.totalVolume || 0).toFixed(2)} lots
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>
                      Avg Hold Time
                    </div>
                    <div className="mt-3 text-xl font-semibold text-white">
                      {Math.floor((stats.avgHold || 0) / 3600)}h{" "}
                      {Math.floor(((stats.avgHold || 0) % 3600) / 60)}m
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>
                      Total Commissions
                    </div>
                    <div className="mt-3 text-xl font-semibold text-red-400">
                      $
                      {Math.abs(Number(stats.totalCommissions || 0)).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </div>
                  </div>
                  <div className={bulkActionsStyles.statCardClass}>
                    <div className={bulkActionsStyles.statLabelClass}>
                      Total Swap
                    </div>
                    <div
                      className={cn(
                        "mt-3 text-xl font-semibold",
                        (stats.totalSwap || 0) >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      $
                      {Number(stats.totalSwap || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={bulkActionsStyles.dialogSectionClass}>
                  <p className="text-sm text-white/60">
                    No selection stats available yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
