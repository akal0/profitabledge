"use client";

import { useRef } from "react";
import { toast } from "sonner";

import { Separator } from "../ui/separator";
import type { JournalEditorHandle } from "@/components/journal/editor";
import { JournalEntryDialogs } from "@/components/journal/entry/journal-entry-dialogs";
import { JournalEntryHeader } from "@/components/journal/entry/journal-entry-header";
import { JournalEntryMain } from "@/components/journal/entry/journal-entry-main";
import type { JournalEntryPageProps } from "@/components/journal/entry/entry-types";
import { useJournalEntryPageState } from "@/components/journal/entry/use-journal-entry-page-state";

export function JournalEntryPage(props: JournalEntryPageProps) {
  const state = useJournalEntryPageState(props);
  const editorRef = useRef<JournalEditorHandle | null>(null);

  if (state.isLoadingEntry) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
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
        onCoverPositionChange={state.handleCoverPositionChange}
        onCoverImageChange={state.handleCoverImageChange}
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
