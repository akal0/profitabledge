"use client";

import type React from "react";
import { format } from "date-fns";
import { Brain, Calendar, Clock, Edit3, Image as ImageIcon, Lightbulb, Paperclip, Plus, Smile, Sparkles, Tag, Target, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { JournalEditor } from "@/components/journal/editor";
import type { JournalEditorHandle } from "@/components/journal/editor";
import { TradePhaseBadge, TradePhaseSelector } from "@/components/journal/trade-phase-selector";
import { PsychologySummary, PsychologyTracker } from "@/components/journal/psychology-tracker";
import { GoalSelector } from "@/components/journal/goal-selector";
import { AIAnalysisDisplay } from "@/components/journal/ai-analysis-display";
import { MediaDropzone, type MediaFile } from "@/components/media/media-dropzone";
import type { JournalAICaptureResult } from "@/components/journal/ai-capture-types";
import type { JournalBlock, PsychologySnapshot, TradePhase } from "@/components/journal/types";

export function JournalEntryMain({
  entryId,
  accountId,
  existingEntryLoaded,
  coverImageUrl,
  coverPosition,
  title,
  emoji,
  tradePhase,
  psychology,
  journalDate,
  content,
  tags,
  newTag,
  showTagInput,
  coverImageRef,
  activeTab,
  mediaFiles,
  plannedEntryPrice,
  plannedExitPrice,
  plannedStopLoss,
  plannedTakeProfit,
  plannedRiskReward,
  plannedNotes,
  actualOutcome,
  actualPnl,
  actualPips,
  postTradeAnalysis,
  lessonsLearned,
  onCoverPositionChange,
  onCoverImageChange,
  onOpenEmojiPicker,
  onRemoveCover,
  onTitleChange,
  onContentChange,
  onTradePhaseChange,
  onPsychologyChange,
  onSetJournalDateTagInput,
  onNewTagChange,
  onAddTag,
  onRemoveTag,
  onTagKeyDown,
  onActiveTabChange,
  onMediaSelected,
  onMediaRemove,
  onPlannedEntryPriceChange,
  onPlannedExitPriceChange,
  onPlannedStopLossChange,
  onPlannedTakeProfitChange,
  onPlannedRiskRewardChange,
  onPlannedNotesChange,
  onActualOutcomeChange,
  onActualPnlChange,
  onActualPipsChange,
  onPostTradeAnalysisChange,
  onLessonsLearnedChange,
  onApplyAICapture,
  editorRef,
}: {
  entryId?: string;
  accountId?: string;
  existingEntryLoaded: boolean;
  coverImageUrl: string | null;
  coverPosition: number;
  title: string;
  emoji: string | null;
  tradePhase: TradePhase | null;
  psychology: PsychologySnapshot;
  journalDate: string | null;
  content: JournalBlock[];
  tags: string[];
  newTag: string;
  showTagInput: boolean;
  coverImageRef: React.RefObject<HTMLInputElement | null>;
  activeTab: string;
  mediaFiles: MediaFile[];
  plannedEntryPrice: string;
  plannedExitPrice: string;
  plannedStopLoss: string;
  plannedTakeProfit: string;
  plannedRiskReward: string;
  plannedNotes: string;
  actualOutcome: "win" | "loss" | "breakeven" | "scratched" | null;
  actualPnl: string;
  actualPips: string;
  postTradeAnalysis: string;
  lessonsLearned: string;
  onCoverPositionChange: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCoverImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenEmojiPicker: () => void;
  onRemoveCover: () => void;
  onTitleChange: (value: string) => void;
  onContentChange: (blocks: JournalBlock[], html: string) => void;
  onTradePhaseChange: (phase: TradePhase | null) => void;
  onPsychologyChange: (psychology: PsychologySnapshot) => void;
  onSetJournalDateTagInput: (visible: boolean) => void;
  onNewTagChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onTagKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onActiveTabChange: (value: string) => void;
  onMediaSelected: (files: MediaFile[]) => void;
  onMediaRemove: (id: string) => void;
  onPlannedEntryPriceChange: (value: string) => void;
  onPlannedExitPriceChange: (value: string) => void;
  onPlannedStopLossChange: (value: string) => void;
  onPlannedTakeProfitChange: (value: string) => void;
  onPlannedRiskRewardChange: (value: string) => void;
  onPlannedNotesChange: (value: string) => void;
  onActualOutcomeChange: (
    value: "win" | "loss" | "breakeven" | "scratched" | null
  ) => void;
  onActualPnlChange: (value: string) => void;
  onActualPipsChange: (value: string) => void;
  onPostTradeAnalysisChange: (value: string) => void;
  onLessonsLearnedChange: (value: string) => void;
  onApplyAICapture: (
    capture: JournalAICaptureResult,
    nextContent?: JournalBlock[]
  ) => void;
  editorRef: React.RefObject<JournalEditorHandle | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {coverImageUrl ? (
        <div
          className="group relative h-48 cursor-move bg-sidebar-accent md:h-64"
          onClick={onCoverPositionChange}
        >
          <img
            src={coverImageUrl}
            alt="Cover"
            className="h-full w-full object-cover"
            style={{ objectPosition: `center ${coverPosition}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              className="border-white/10 bg-sidebar/90 text-white backdrop-blur-sm hover:bg-sidebar-accent"
              onClick={(event) => {
                event.stopPropagation();
                coverImageRef.current?.click();
              }}
            >
              Change cover
            </Button>
            <Button
              size="sm"
              className="border-white/10 bg-sidebar/90 text-white backdrop-blur-sm hover:bg-sidebar-accent"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveCover();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
            Click to reposition
          </div>
        </div>
      ) : (
        <div className="h-12" />
      )}

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex items-center gap-2 text-white/40">
          {!emoji ? (
            <button
              onClick={onOpenEmojiPicker}
              className="flex items-center gap-1.5 text-sm transition-colors hover:text-white/60"
            >
              <Smile className="h-4 w-4" />
              Add icon
            </button>
          ) : null}
          {!coverImageUrl ? (
            <>
              <span className="text-white/20">|</span>
              <button
                onClick={() => coverImageRef.current?.click()}
                className="flex items-center gap-1.5 text-sm transition-colors hover:text-white/60"
              >
                <ImageIcon className="h-4 w-4" />
                Add cover
              </button>
            </>
          ) : null}
          <input
            ref={coverImageRef}
            type="file"
            accept="image/*"
            onChange={onCoverImageChange}
            className="hidden"
          />
        </div>

        {emoji ? (
          <button
            onClick={onOpenEmojiPicker}
            className="mb-4 text-6xl transition-transform hover:scale-110"
          >
            {emoji}
          </button>
        ) : null}

        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Untitled"
          className="mb-4 w-full border-none bg-transparent text-4xl font-bold text-white outline-none placeholder:text-white/20"
        />

        {tradePhase ? (
          <div className="mb-4">
            <TradePhaseBadge phase={tradePhase} />
          </div>
        ) : null}

        <div className="mb-8 border-b border-white/5 pb-4 text-sm text-white/40">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {journalDate
                ? format(new Date(journalDate), "MMM d, yyyy")
                : format(new Date(), "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {Math.max(
                1,
                Math.ceil(
                  content.reduce(
                    (accumulator, block) =>
                      accumulator +
                      (block.content?.split(/\s+/).length || 0),
                    0
                  ) / 200
                )
              )}{" "}
              min read
            </div>
            <PsychologySummary psychology={psychology} compact />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="h-4 w-4 flex-shrink-0 text-white/40" />
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="inline-flex h-6 max-w-[180px] cursor-pointer items-center rounded-full bg-transparent px-2.5 text-xs text-white/60 ring-1 ring-white/10 transition-colors hover:text-white/80 hover:ring-white/20"
                title={`Remove ${tag}`}
              >
                <span className="truncate">{tag}</span>
              </button>
            ))}

            {showTagInput ? (
              <Input
                value={newTag}
                onChange={(event) => onNewTagChange(event.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={onAddTag}
                placeholder="Add tag..."
                autoFocus
                className="h-6 w-24 border-white/20 bg-transparent text-xs text-white placeholder:text-white/30 focus-visible:ring-teal-500"
              />
            ) : (
              <button
                onClick={() => onSetJournalDateTagInput(true)}
                className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/60"
              >
                <Plus className="h-3 w-3" />
                Add tag
              </button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
          <TabsList className="mb-6 h-auto rounded-none border-b border-white/10 bg-transparent p-0">
            <TabsTrigger value="content" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Edit3 className="mr-2 h-3 w-3" />
              Content
            </TabsTrigger>
            <TabsTrigger value="trade-idea" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Lightbulb className="mr-2 h-3 w-3" />
              Trade Idea
            </TabsTrigger>
            <TabsTrigger value="psychology" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Brain className="mr-2 h-3 w-3" />
              Psychology
            </TabsTrigger>
            <TabsTrigger value="goals" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Target className="mr-2 h-3 w-3" />
              Goals
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Sparkles className="mr-2 h-3 w-3" />
              AI
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Paperclip className="mr-2 h-3 w-3" />
              Media
              {mediaFiles.length > 0 ? (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">
                  {mediaFiles.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-0">
            {!entryId || existingEntryLoaded ? (
              <JournalEditor
                ref={editorRef}
                key={entryId || "new"}
                initialContent={existingEntryLoaded ? content : []}
                onChange={onContentChange}
                onApplyAICapture={onApplyAICapture}
                placeholder="Start writing, or press '/' for commands..."
                autoFocus={!entryId}
                accountId={accountId}
              />
            ) : (
              <div className="min-h-[200px] animate-pulse rounded-lg bg-white/5" />
            )}
          </TabsContent>

          <TabsContent value="trade-idea" className="mt-0 space-y-6">
            <TradePhaseSelector value={tradePhase} onChange={onTradePhaseChange} />

            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput label="Planned Entry Price" value={plannedEntryPrice} placeholder="e.g., 1.0850" onChange={onPlannedEntryPriceChange} />
              <LabeledInput label="Planned Exit Price" value={plannedExitPrice} placeholder="e.g., 1.0950" onChange={onPlannedExitPriceChange} />
              <LabeledInput label="Stop Loss" value={plannedStopLoss} placeholder="e.g., 1.0800" onChange={onPlannedStopLossChange} />
              <LabeledInput label="Take Profit" value={plannedTakeProfit} placeholder="e.g., 1.1000" onChange={onPlannedTakeProfitChange} />
              <LabeledInput label="Risk:Reward Ratio" value={plannedRiskReward} placeholder="e.g., 1:2" onChange={onPlannedRiskRewardChange} />
            </div>

            <LabeledTextarea
              label="Trade Idea Notes"
              value={plannedNotes}
              placeholder="Describe your setup, reasoning, and key levels..."
              onChange={onPlannedNotesChange}
              minHeight="min-h-[100px]"
            />

            {tradePhase === "post-trade" ? (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium">Post-Trade Analysis</h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Actual Outcome</Label>
                    <select
                      value={actualOutcome || ""}
                      onChange={(event) =>
                        onActualOutcomeChange(
                          (event.target.value as
                            | "win"
                            | "loss"
                            | "breakeven"
                            | "scratched"
                            | "") || null
                        )
                      }
                      className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                      <option value="breakeven">Breakeven</option>
                      <option value="scratched">Scratched</option>
                    </select>
                  </div>
                  <LabeledInput label="Actual P&L ($)" value={actualPnl} placeholder="e.g., +250" onChange={onActualPnlChange} />
                  <LabeledInput label="Actual Pips" value={actualPips} placeholder="e.g., +25" onChange={onActualPipsChange} />
                </div>

                <LabeledTextarea
                  label="Post-Trade Analysis"
                  value={postTradeAnalysis}
                  placeholder="What went well? What could be improved?"
                  onChange={onPostTradeAnalysisChange}
                  minHeight="min-h-[80px]"
                />
                <LabeledTextarea
                  label="Lessons Learned"
                  value={lessonsLearned}
                  placeholder="Key takeaways from this trade..."
                  onChange={onLessonsLearnedChange}
                  minHeight="min-h-[80px]"
                />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="psychology" className="mt-0">
            <PsychologyTracker value={psychology} onChange={onPsychologyChange} />
          </TabsContent>

          <TabsContent value="goals" className="mt-0">
            {entryId ? (
              <GoalSelector entryId={entryId} />
            ) : (
              <EmptyTabState
                icon={<Target className="mb-3 h-10 w-10 text-white/20" />}
                text="Save the entry first to link goals"
              />
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-0">
            {entryId ? (
              <AIAnalysisDisplay entryId={entryId} />
            ) : (
              <EmptyTabState
                icon={<Sparkles className="mb-3 h-10 w-10 text-white/20" />}
                text="Save the entry first to enable AI analysis"
              />
            )}
          </TabsContent>

          <TabsContent value="media" className="mt-0">
            <MediaDropzone
              files={mediaFiles}
              onFilesSelected={onMediaSelected}
              onFileRemove={onMediaRemove}
              accept="all"
              maxFiles={20}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="bg-muted/30"
      />
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  placeholder,
  onChange,
  minHeight,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full resize-none rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ${minHeight}`}
      />
    </div>
  );
}

function EmptyTabState({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="text-sm text-white/40">{text}</p>
    </div>
  );
}
