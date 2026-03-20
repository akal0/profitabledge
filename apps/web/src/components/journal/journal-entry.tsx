"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Separator } from "../ui/separator";
import {
  CoverImageCropDialog,
  type CoverFrameDimensions,
} from "@/components/cover-image-crop-dialog";
import type { JournalEditorHandle } from "@/components/journal/editor";
import { JournalEntryDialogs } from "@/components/journal/entry/journal-entry-dialogs";
import { JournalEntryHeader } from "@/components/journal/entry/journal-entry-header";
import { JournalEntryMain } from "@/components/journal/entry/journal-entry-main";
import type { JournalEntryPageProps } from "@/components/journal/entry/entry-types";
import { useJournalEntryPageState } from "@/components/journal/entry/use-journal-entry-page-state";

function parseCoverPosition(objectPosition: string) {
  const y = objectPosition.trim().split(/\s+/)[1] ?? "50%";
  const nextPosition = Number.parseFloat(y.replace("%", ""));

  if (!Number.isFinite(nextPosition)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(nextPosition)));
}

export function JournalEntryPage(props: JournalEntryPageProps) {
  const state = useJournalEntryPageState(props);
  const editorRef = useRef<JournalEditorHandle | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const coverContainerRef = useRef<HTMLDivElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingCoverSrc, setPendingCoverSrc] = useState("");
  const [coverFrameDimensions, setCoverFrameDimensions] =
    useState<CoverFrameDimensions | null>(null);

  const measureCoverFrame = useCallback(() => {
    const coverRect = coverContainerRef.current?.getBoundingClientRect();
    if (coverRect && coverRect.width > 0 && coverRect.height > 0) {
      const nextDimensions = {
        width: coverRect.width,
        height: coverRect.height,
      };
      setCoverFrameDimensions(nextDimensions);
      return nextDimensions;
    }

    const pageRect = pageContainerRef.current?.getBoundingClientRect();
    if (pageRect && pageRect.width > 0) {
      const nextDimensions = {
        width: pageRect.width,
        height: window.matchMedia("(min-width: 768px)").matches ? 256 : 192,
      };
      setCoverFrameDimensions(nextDimensions);
      return nextDimensions;
    }

    return null;
  }, []);

  const openCoverCropDialog = useCallback((imageSrc: string) => {
    measureCoverFrame();
    setPendingCoverSrc(imageSrc);
    setCropDialogOpen(true);
  }, [measureCoverFrame]);

  const handleCoverImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (file.size > 8 * 1024 * 1024) {
        toast.error("Image must be under 8MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const result = readerEvent.target?.result;
        if (typeof result !== "string" || !result) {
          toast.error("Failed to read cover image");
          return;
        }

        openCoverCropDialog(result);
      };
      reader.onerror = () => {
        toast.error("Failed to read cover image");
      };
      reader.readAsDataURL(file);
    },
    [openCoverCropDialog]
  );

  const handleEditCover = useCallback(() => {
    if (!state.coverImageUrl) {
      return;
    }

    openCoverCropDialog(state.coverImageUrl);
  }, [openCoverCropDialog, state.coverImageUrl]);

  const handleCropApply = useCallback(
    (objectPosition: string) => {
      if (!pendingCoverSrc) {
        return;
      }

      state.setCoverImageUrl(pendingCoverSrc);
      state.setCoverPosition(parseCoverPosition(objectPosition));
      state.markChanged();
      setPendingCoverSrc("");
      setCropDialogOpen(false);
    },
    [pendingCoverSrc, state]
  );

  const handleCropCancel = useCallback(() => {
    setPendingCoverSrc("");
    setCropDialogOpen(false);
  }, []);

  if (state.isLoadingEntry) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    );
  }

  return (
    <div ref={pageContainerRef} className="flex min-h-0 w-full flex-1 flex-col">
      <JournalEntryHeader
        title={state.title}
        hasChanges={state.hasChanges}
        isSaving={state.isSaving}
        onBack={props.onBack}
        onSave={() => state.handleSave(editorRef.current?.getSnapshot() ?? undefined)}
        onShowSaveTemplateDialog={() => state.setShowSaveTemplateDialog(true)}
        onShowDeleteConfirm={() => state.setShowDeleteConfirm(true)}
      />

      <Separator />

      <JournalEntryMain
        entryId={props.entryId}
        accountId={props.accountId}
        existingEntryLoaded={state.existingEntryLoaded}
        coverImageUrl={state.coverImageUrl}
        coverPosition={state.coverPosition}
        coverContainerRef={coverContainerRef}
        title={state.title}
        emoji={state.emoji}
        tradePhase={state.tradePhase}
        psychology={state.psychology}
        journalDate={state.journalDate}
        content={state.content}
        tags={state.tags}
        newTag={state.newTag}
        showTagInput={state.showTagInput}
        coverImageRef={state.coverImageRef}
        activeTab={state.activeTab}
        mediaFiles={state.mediaFiles}
        plannedEntryPrice={state.plannedEntryPrice}
        plannedExitPrice={state.plannedExitPrice}
        plannedStopLoss={state.plannedStopLoss}
        plannedTakeProfit={state.plannedTakeProfit}
        plannedRiskReward={state.plannedRiskReward}
        plannedNotes={state.plannedNotes}
        actualOutcome={state.actualOutcome}
        actualPnl={state.actualPnl}
        actualPips={state.actualPips}
        postTradeAnalysis={state.postTradeAnalysis}
        lessonsLearned={state.lessonsLearned}
        onCoverImageChange={handleCoverImageChange}
        onEditCover={handleEditCover}
        onOpenEmojiPicker={() => state.setShowEmojiPicker(true)}
        onRemoveCover={() => {
          state.setCoverImageUrl(null);
          state.markChanged();
        }}
        onTitleChange={(value) => {
          state.setTitle(value);
          state.markChanged();
        }}
        onContentChange={(blocks) => {
          state.handleContentChange(blocks);
        }}
        onTradePhaseChange={(value) => {
          state.setTradePhase(value);
          state.markChanged();
        }}
        onPsychologyChange={(value) => {
          state.setPsychology(value);
          state.markChanged();
        }}
        onSetJournalDateTagInput={state.setShowTagInput}
        onNewTagChange={state.setNewTag}
        onAddTag={state.handleAddTag}
        onRemoveTag={state.handleRemoveTag}
        onTagKeyDown={state.handleTagKeyDown}
        onActiveTabChange={state.setActiveTab}
        onMediaSelected={state.handleMediaSelected}
        onMediaRemove={state.handleMediaRemove}
        onPlannedEntryPriceChange={(value) => {
          state.setPlannedEntryPrice(value);
          state.markChanged();
        }}
        onPlannedExitPriceChange={(value) => {
          state.setPlannedExitPrice(value);
          state.markChanged();
        }}
        onPlannedStopLossChange={(value) => {
          state.setPlannedStopLoss(value);
          state.markChanged();
        }}
        onPlannedTakeProfitChange={(value) => {
          state.setPlannedTakeProfit(value);
          state.markChanged();
        }}
        onPlannedRiskRewardChange={(value) => {
          state.setPlannedRiskReward(value);
          state.markChanged();
        }}
        onPlannedNotesChange={(value) => {
          state.setPlannedNotes(value);
          state.markChanged();
        }}
        onActualOutcomeChange={(value) => {
          state.setActualOutcome(value);
          state.markChanged();
        }}
        onActualPnlChange={(value) => {
          state.setActualPnl(value);
          state.markChanged();
        }}
        onActualPipsChange={(value) => {
          state.setActualPips(value);
          state.markChanged();
        }}
        onPostTradeAnalysisChange={(value) => {
          state.setPostTradeAnalysis(value);
          state.markChanged();
        }}
        onLessonsLearnedChange={(value) => {
          state.setLessonsLearned(value);
          state.markChanged();
        }}
        onApplyAICapture={state.applyAICapture}
        editorRef={editorRef}
      />

      {pendingCoverSrc ? (
        <CoverImageCropDialog
          open={cropDialogOpen}
          imageSrc={pendingCoverSrc}
          frameDimensions={coverFrameDimensions}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      ) : null}

      <JournalEntryDialogs
        showEmojiPicker={state.showEmojiPicker}
        emoji={state.emoji}
        title={state.title}
        content={state.content}
        showSaveTemplateDialog={state.showSaveTemplateDialog}
        showDeleteConfirm={state.showDeleteConfirm}
        onShowEmojiPickerChange={state.setShowEmojiPicker}
        onEmojiSelect={(native) => {
          state.setEmoji(native);
          state.setShowEmojiPicker(false);
          state.markChanged();
        }}
        onRemoveEmoji={() => {
          state.setEmoji(null);
          state.setShowEmojiPicker(false);
          state.markChanged();
        }}
        onShowSaveTemplateDialogChange={state.setShowSaveTemplateDialog}
        onTemplateSaved={() => {
          toast.success("Template saved successfully!");
        }}
        onShowDeleteConfirmChange={state.setShowDeleteConfirm}
        onDelete={state.handleDelete}
      />
    </div>
  );
}
