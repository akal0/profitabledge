"use client";

import { useEffect, useRef, useState } from "react";
import { Command, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import type { JournalAICaptureResult } from "@/components/journal/ai-capture-types";
import {
  journalActionButtonClassName,
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
} from "@/components/journal/action-button-styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { showAIErrorToast } from "@/lib/ai-error-toast";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export function JournalAICaptureDialog({
  open,
  onOpenChange,
  onApply,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (capture: JournalAICaptureResult) => void;
  accountId?: string;
}) {
  const [input, setInput] = useState("");
  const wasOpenRef = useRef(open);
  const parseMutation = trpc.journal.parseNaturalCapture.useMutation();

  useEffect(() => {
    if (!open && wasOpenRef.current) {
      setInput("");
      parseMutation.reset();
    }
    wasOpenRef.current = open;
  }, [open, parseMutation]);

  const handleInsert = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    try {
      const result = await parseMutation.mutateAsync({
        text: trimmed,
        accountId,
      });
      onApply(result as JournalAICaptureResult);
    } catch (error) {
      if (!showAIErrorToast(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to parse journal capture"
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-xl"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">AI Capture</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                Write it like a normal journal note. AI will pull out whatever
                structure it can, including relevant journal blocks, and insert
                it directly into the entry.
              </p>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                className={cn(
                  journalActionIconButtonClassName,
                  "ml-auto size-8"
                )}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          <Separator />

          {/* Input area */}
          <div className="flex flex-1 flex-col gap-4 px-5 py-5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleInsert();
                }
              }}
              autoFocus
              rows={6}
              placeholder="Today was rough. I chased EURUSD after missing the clean entry, got stopped, then kept trading trying to make it back."
              className="min-h-[180px] resize-none border-0 bg-transparent px-4 py-3 text-xl font-medium leading-relaxed text-white placeholder:text-white/20 focus-visible:ring-0"
            />
            <div className="rounded-sm border border-white/5 bg-sidebar/60 px-4 py-3 text-xs leading-relaxed text-white/38">
              No special format needed. Example:{" "}
              <span className="text-white/58">
                Had a rough NY session today. I chased NQ after missing the
                clean entry and felt shaky after the second loss. AI can turn
                that into a structured review with charts, psychology, and
                matched trade blocks when they fit.
              </span>
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3">
            <div className="hidden items-center gap-1.5 text-[11px] text-white/30 sm:flex">
              <Command className="h-3 w-3" />
              <span>Ctrl/⌘ + Enter to insert</span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                type="button"
                className={journalActionButtonMutedClassName}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn(
                  journalActionButtonClassName,
                  "border-teal-500/30 bg-teal-500/12 text-teal-100 hover:bg-teal-500/20"
                )}
                disabled={!input.trim() || parseMutation.isPending}
                onClick={() => void handleInsert()}
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Inserting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Insert with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
