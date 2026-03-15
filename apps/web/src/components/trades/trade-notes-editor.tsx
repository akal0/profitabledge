"use client";

import React, { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { JournalEditor } from "@/components/journal/editor";
import type { JournalBlock } from "@/components/journal/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { Save, Loader2, Paperclip } from "lucide-react";
import { TradeMediaSection } from "./trade-media-section";
import {
  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
} from "@/components/trades/trade-identifier-pill";

interface TradeNotesEditorProps {
  tradeId: string;
  className?: string;
}

type TradeNoteRecord = {
  content?: JournalBlock[] | null;
};

export function TradeNotesEditor({
  tradeId,
  className,
}: TradeNotesEditorProps) {
  const tradeNotesApi = (trpc as any).tradeNotes;
  const [content, setContent] = useState<JournalBlock[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: existingNote, isLoading } = tradeNotesApi.getByTradeId.useQuery(
    { tradeId },
    {
      onSuccess: (data: TradeNoteRecord | null | undefined) => {
        if (data && !isInitialized) {
          setContent((data.content as JournalBlock[]) || []);
          setIsInitialized(true);
        }
      },
    }
  );

  const upsertNote = tradeNotesApi.upsert.useMutation();

  const [debouncedContent] = useDebounce(content, 2000);

  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const handleSave = useCallback(async (blocks?: JournalBlock[], html?: string) => {
    const contentToSave = blocks || content;
    if (contentToSave.length === 0) return;

    try {
      await upsertNote.mutateAsync({
        tradeId,
        content: contentToSave,
        htmlContent: html,
        plainTextContent: contentToSave
          .map((b) => b.content || "")
          .join(" ")
          .replace(/<[^>]*>/g, ""),
        wordCount: contentToSave.reduce(
          (acc, b) => acc + (b.content?.split(/\s+/).length || 0),
          0
        ),
      });
      setHasChanges(false);
      toast.success("Notes saved");
    } catch (error) {
      toast.error("Failed to save notes");
    }
  }, [content, tradeId, upsertNote]);

  const handleContentChange = useCallback(
    (blocks: JournalBlock[], html: string) => {
      setContent(blocks);
      setHasChanges(true);

      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }

      autoSaveRef.current = setTimeout(() => {
        handleSave(blocks, html);
      }, 3000);
    },
    [handleSave]
  );

  const handleManualSave = () => {
    handleSave();
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-8 w-32 bg-sidebar-accent" />
        <Skeleton className="h-40 w-full bg-sidebar-accent" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/70 tracking-wide">
            Notes & annotations
          </h3>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  TRADE_IDENTIFIER_TONES.warning,
                  "min-h-6 px-2 py-0.5 text-[10px]"
                )}
              >
                Unsaved changes
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSave}
              disabled={upsertNote.isPending || !hasChanges}
              className={cn(TRADE_ACTION_BUTTON_PRIMARY_CLASS, "h-7 gap-1.5")}
            >
              {upsertNote.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
        <Separator className="-mx-6 w-[calc(100%+3rem)]" />
      </div>
      
      <div className={cn(TRADE_SURFACE_CARD_CLASS, "overflow-hidden")}>
        <JournalEditor
          key={tradeId}
          initialContent={(existingNote?.content as JournalBlock[]) || []}
          onChange={handleContentChange}
          placeholder="Add notes about this trade... Use '/' for commands"
          autoFocus={false}
          className="[&_.journal-editor-content]:px-6 [&_.journal-editor-content]:py-4 text-sm"
        />
      </div>

      <Separator className="-mx-6 w-[calc(100%+3rem)]" />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-white/50" />
          <h3 className="text-xs font-semibold text-white/70 tracking-wide">
            Media attachments
          </h3>
        </div>
        <TradeMediaSection tradeId={tradeId} />
      </div>
    </div>
  );
}
