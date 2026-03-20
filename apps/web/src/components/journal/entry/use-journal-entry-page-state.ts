"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";

import type { MediaFile } from "@/components/media/media-dropzone";
import type { JournalAICaptureResult } from "@/components/journal/ai-capture-types";
import type { JournalEditorSnapshot } from "@/components/journal/editor";
import type {
  JournalBlock,
  PsychologySnapshot,
  TradePhase,
} from "@/components/journal/types";
import type {
  EntryType,
  JournalEntryData,
  JournalEntryPageProps,
} from "@/components/journal/entry/entry-types";
import { trpc } from "@/utils/trpc";

function createDefaultPsychology(): PsychologySnapshot {
  return {
    mood: 5,
    confidence: 5,
    energy: 5,
    focus: 5,
    fear: 3,
    greed: 3,
    emotionalState: "neutral",
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  return value || null;
}

function normalizeJournalDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.toISOString();
}

function buildPersistedEntryPayload({
  title,
  emoji,
  coverImageUrl,
  coverImagePosition,
  content,
  tags,
  entryType,
  journalDate,
  tradePhase,
  psychology,
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
}: {
  title: string;
  emoji: string | null;
  coverImageUrl: string | null;
  coverImagePosition: number;
  content: JournalBlock[];
  tags: string[];
  entryType: EntryType;
  journalDate: string | null;
  tradePhase: TradePhase | null;
  psychology: PsychologySnapshot;
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
}) {
  return {
    title,
    emoji,
    coverImageUrl,
    coverImagePosition,
    content,
    tags,
    entryType,
    journalDate,
    tradePhase,
    psychology,
    plannedEntryPrice: normalizeOptionalText(plannedEntryPrice),
    plannedExitPrice: normalizeOptionalText(plannedExitPrice),
    plannedStopLoss: normalizeOptionalText(plannedStopLoss),
    plannedTakeProfit: normalizeOptionalText(plannedTakeProfit),
    plannedRiskReward: normalizeOptionalText(plannedRiskReward),
    plannedNotes: normalizeOptionalText(plannedNotes),
    actualOutcome,
    actualPnl: normalizeOptionalText(actualPnl),
    actualPips: normalizeOptionalText(actualPips),
    postTradeAnalysis: normalizeOptionalText(postTradeAnalysis),
    lessonsLearned: normalizeOptionalText(lessonsLearned),
  };
}

function serializePersistedEntryPayload(
  payload: ReturnType<typeof buildPersistedEntryPayload>
) {
  return JSON.stringify(payload);
}

export function useJournalEntryPageState({
  entryId,
  accountId,
  initialContent,
  initialTitle,
  initialEntryType,
  onBack,
  onSave,
}: JournalEntryPageProps) {
  const isExistingEntry = Boolean(entryId);
  const [title, setTitle] = useState(
    isExistingEntry ? "Untitled" : initialTitle || "Untitled"
  );
  const [emoji, setEmoji] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState(50);
  const [content, setContent] = useState<JournalBlock[]>(
    isExistingEntry ? [] : initialContent || []
  );
  const [tags, setTags] = useState<string[]>([]);
  const [entryType, setEntryType] = useState<EntryType>(
    isExistingEntry ? "general" : (initialEntryType as EntryType) || "general"
  );
  const [journalDate, setJournalDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tradePhase, setTradePhase] = useState<TradePhase | null>(null);
  const [psychology, setPsychology] = useState<PsychologySnapshot>(
    createDefaultPsychology()
  );
  const [plannedEntryPrice, setPlannedEntryPrice] = useState("");
  const [plannedExitPrice, setPlannedExitPrice] = useState("");
  const [plannedStopLoss, setPlannedStopLoss] = useState("");
  const [plannedTakeProfit, setPlannedTakeProfit] = useState("");
  const [plannedRiskReward, setPlannedRiskReward] = useState("");
  const [plannedNotes, setPlannedNotes] = useState("");
  const [actualOutcome, setActualOutcome] = useState<
    "win" | "loss" | "breakeven" | "scratched" | null
  >(null);
  const [actualPnl, setActualPnl] = useState("");
  const [actualPips, setActualPips] = useState("");
  const [postTradeAnalysis, setPostTradeAnalysis] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [activeTab, setActiveTab] = useState("content");
  const [isEntryHydrated, setIsEntryHydrated] = useState(!entryId);

  const coverImageRef = useRef<HTMLInputElement>(null);
  const lastHydratedEntryRef = useRef<{
    id: string | null;
    key: string | null;
  }>({ id: null, key: null });
  const lastSavedPayloadKeyRef = useRef<string | null>(null);
  const latestAutosavePayloadKeyRef = useRef<string>("");
  const hasChangesRef = useRef(false);
  const autosaveInFlightRef = useRef(false);

  const { data: existingEntry, isLoading: isLoadingEntry } =
    trpc.journal.get.useQuery({ id: entryId! }, { enabled: !!entryId });

  const createEntry = trpc.journal.create.useMutation();
  const updateEntry = trpc.journal.update.useMutation();
  const updateEntryMutateAsyncRef = useRef(updateEntry.mutateAsync);
  updateEntryMutateAsyncRef.current = updateEntry.mutateAsync;
  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: () => {
      toast.success("Entry deleted");
      onBack?.();
    },
    onError: () => {
      toast.error("Failed to delete entry");
    },
  });

  useEffect(() => {
    if (!entryId) {
      setIsEntryHydrated(true);
      return;
    }

    setIsEntryHydrated(false);
    lastHydratedEntryRef.current = { id: null, key: null };
    lastSavedPayloadKeyRef.current = null;
  }, [entryId]);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  const autosavePayload = useMemo(
    () =>
      buildPersistedEntryPayload({
        title,
        emoji,
        coverImageUrl,
        coverImagePosition: coverPosition,
        content,
        tags,
        entryType,
        journalDate,
        tradePhase,
        psychology,
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
      }),
    [
      actualOutcome,
      actualPips,
      actualPnl,
      content,
      coverImageUrl,
      coverPosition,
      emoji,
      entryType,
      journalDate,
      lessonsLearned,
      plannedEntryPrice,
      plannedExitPrice,
      plannedNotes,
      plannedRiskReward,
      plannedStopLoss,
      plannedTakeProfit,
      postTradeAnalysis,
      psychology,
      tags,
      title,
      tradePhase,
    ]
  );
  const autosavePayloadKey = useMemo(
    () => serializePersistedEntryPayload(autosavePayload),
    [autosavePayload]
  );
  const [debouncedAutosavePayloadKey] = useDebounce(autosavePayloadKey, 1000);

  useEffect(() => {
    latestAutosavePayloadKeyRef.current = autosavePayloadKey;
  }, [autosavePayloadKey]);

  useEffect(() => {
    if (!existingEntry) return;

    const hydratedPayload = buildPersistedEntryPayload({
      title: existingEntry.title || "Untitled",
      emoji: existingEntry.emoji || null,
      coverImageUrl: existingEntry.coverImageUrl || null,
      coverImagePosition: existingEntry.coverImagePosition || 50,
      content: (existingEntry.content as JournalBlock[]) || [],
      tags: (existingEntry.tags as string[]) || [],
      entryType: (existingEntry.entryType as EntryType) || "general",
      journalDate: normalizeJournalDate(
        existingEntry.journalDate as Date | string | null
      ),
      tradePhase: (existingEntry.tradePhase as TradePhase) || null,
      psychology:
        (existingEntry.psychology as PsychologySnapshot) ||
        createDefaultPsychology(),
      plannedEntryPrice: existingEntry.plannedEntryPrice || "",
      plannedExitPrice: existingEntry.plannedExitPrice || "",
      plannedStopLoss: existingEntry.plannedStopLoss || "",
      plannedTakeProfit: existingEntry.plannedTakeProfit || "",
      plannedRiskReward: existingEntry.plannedRiskReward || "",
      plannedNotes: existingEntry.plannedNotes || "",
      actualOutcome:
        (existingEntry.actualOutcome as typeof actualOutcome) || null,
      actualPnl: existingEntry.actualPnl || "",
      actualPips: existingEntry.actualPips || "",
      postTradeAnalysis: existingEntry.postTradeAnalysis || "",
      lessonsLearned: existingEntry.lessonsLearned || "",
    });
    const hydratedPayloadKey = serializePersistedEntryPayload(hydratedPayload);

    if (
      lastHydratedEntryRef.current.id === existingEntry.id &&
      lastHydratedEntryRef.current.key === hydratedPayloadKey
    ) {
      setIsEntryHydrated(true);
      lastSavedPayloadKeyRef.current = hydratedPayloadKey;
      return;
    }

    if (
      lastHydratedEntryRef.current.id === existingEntry.id &&
      hasChangesRef.current
    ) {
      return;
    }

    setTitle(hydratedPayload.title);
    setEmoji(hydratedPayload.emoji);
    setCoverImageUrl(hydratedPayload.coverImageUrl);
    setCoverPosition(hydratedPayload.coverImagePosition);
    setContent(hydratedPayload.content);
    setTags(hydratedPayload.tags);
    setEntryType(hydratedPayload.entryType);
    setJournalDate(hydratedPayload.journalDate);
    setTradePhase(hydratedPayload.tradePhase);
    setPsychology(hydratedPayload.psychology);
    setPlannedEntryPrice(hydratedPayload.plannedEntryPrice || "");
    setPlannedExitPrice(hydratedPayload.plannedExitPrice || "");
    setPlannedStopLoss(hydratedPayload.plannedStopLoss || "");
    setPlannedTakeProfit(hydratedPayload.plannedTakeProfit || "");
    setPlannedRiskReward(hydratedPayload.plannedRiskReward || "");
    setPlannedNotes(hydratedPayload.plannedNotes || "");
    setActualOutcome(hydratedPayload.actualOutcome);
    setActualPnl(hydratedPayload.actualPnl || "");
    setActualPips(hydratedPayload.actualPips || "");
    setPostTradeAnalysis(hydratedPayload.postTradeAnalysis || "");
    setLessonsLearned(hydratedPayload.lessonsLearned || "");
    setHasChanges(false);
    setIsEntryHydrated(true);
    lastHydratedEntryRef.current = {
      id: existingEntry.id,
      key: hydratedPayloadKey,
    };
    lastSavedPayloadKeyRef.current = hydratedPayloadKey;
  }, [existingEntry]);

  useEffect(() => {
    if (!entryId || !hasChanges || !isEntryHydrated) return;
    if (debouncedAutosavePayloadKey !== autosavePayloadKey) return;
    if (autosaveInFlightRef.current) return;

    if (lastSavedPayloadKeyRef.current === autosavePayloadKey) {
      setHasChanges(false);
      return;
    }

    const saveEntry = async () => {
      const savePayloadKey = autosavePayloadKey;
      autosaveInFlightRef.current = true;

      try {
        await updateEntryMutateAsyncRef.current({
          id: entryId,
          ...autosavePayload,
        });
        lastSavedPayloadKeyRef.current = savePayloadKey;
        if (latestAutosavePayloadKeyRef.current === savePayloadKey) {
          setHasChanges(false);
        } else {
          setHasChanges(false);
          queueMicrotask(() => {
            setHasChanges(true);
          });
        }
      } catch (error) {
        console.error("Failed to auto-save:", error);
      } finally {
        autosaveInFlightRef.current = false;
      }
    };

    void saveEntry();
  }, [
    autosavePayload,
    autosavePayloadKey,
    debouncedAutosavePayloadKey,
    entryId,
    hasChanges,
    isEntryHydrated,
  ]);

  const sanitizeBlocks = useCallback((blocks: JournalBlock[]): JournalBlock[] => {
    return blocks.filter((block) => {
      if (block.type === "chart") {
        const validChartTypes = [
          "equity-curve",
          "drawdown",
          "daily-net",
          "performance-weekday",
          "performing-assets",
          "performance-heatmap",
          "streak-distribution",
          "r-multiple-distribution",
          "mae-mfe-scatter",
          "entry-exit-time",
        ];
        return (
          block.props?.chartType &&
          validChartTypes.includes(block.props.chartType)
        );
      }

      if (block.type === "image") {
        const url = block.props?.imageUrl || "";
        return url.startsWith("data:") || url.startsWith("http");
      }

      return true;
    });
  }, []);

  const handleContentChange = useCallback(
    (blocks: JournalBlock[]) => {
      setContent(sanitizeBlocks(blocks));
      setHasChanges(true);
    },
    [sanitizeBlocks]
  );

  const handleSave = useCallback(async (snapshot?: JournalEditorSnapshot) => {
    setIsSaving(true);
    const resolvedContent = snapshot
      ? sanitizeBlocks(snapshot.content)
      : content;
    const resolvedPayload = {
      ...autosavePayload,
      content: resolvedContent,
    };
    const resolvedPayloadKey = serializePersistedEntryPayload(resolvedPayload);
    try {
      if (entryId) {
        await updateEntry.mutateAsync({
          id: entryId,
          ...resolvedPayload,
        });
        setContent(resolvedContent);
        lastSavedPayloadKeyRef.current = resolvedPayloadKey;
        lastHydratedEntryRef.current = {
          id: entryId,
          key: resolvedPayloadKey,
        };
      } else {
        const newEntry = await createEntry.mutateAsync({
          title,
          emoji: emoji || undefined,
          coverImageUrl: coverImageUrl || undefined,
          coverImagePosition: coverPosition,
          content: resolvedContent,
          tags,
          entryType,
          journalDate: journalDate || undefined,
          accountIds: accountId ? [accountId] : [],
          tradePhase: tradePhase || undefined,
          psychology: psychology || undefined,
          plannedEntryPrice: plannedEntryPrice || undefined,
          plannedExitPrice: plannedExitPrice || undefined,
          plannedStopLoss: plannedStopLoss || undefined,
          plannedTakeProfit: plannedTakeProfit || undefined,
          plannedRiskReward: plannedRiskReward || undefined,
          plannedNotes: plannedNotes || undefined,
          actualOutcome: actualOutcome || undefined,
          actualPnl: actualPnl || undefined,
          actualPips: actualPips || undefined,
          postTradeAnalysis: postTradeAnalysis || undefined,
          lessonsLearned: lessonsLearned || undefined,
        });

        onSave?.({
          id: newEntry.id,
          title,
          emoji,
          coverImageUrl,
          coverImagePosition: coverPosition,
          content: resolvedContent,
          tags,
          entryType,
          journalDate,
          tradePhase,
          psychology,
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
        } as JournalEntryData);
      }

      setHasChanges(false);
      toast.success("Saved");
    } catch (error) {
      toast.error("Failed to save");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [
    accountId,
    actualOutcome,
    actualPips,
    actualPnl,
    content,
    coverImageUrl,
    coverPosition,
    createEntry,
    emoji,
    entryId,
    entryType,
    journalDate,
    lessonsLearned,
    onSave,
    plannedEntryPrice,
    plannedExitPrice,
    plannedNotes,
    plannedRiskReward,
    plannedStopLoss,
    plannedTakeProfit,
    postTradeAnalysis,
    psychology,
    tags,
    title,
    tradePhase,
    updateEntry,
    autosavePayload,
    sanitizeBlocks,
  ]);

  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag("");
      setHasChanges(true);
    }
    setShowTagInput(false);
  }, [newTag, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
    setHasChanges(true);
  }, [tags]);

  const handleTagKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddTag();
      } else if (event.key === "Escape") {
        setShowTagInput(false);
        setNewTag("");
      }
    },
    [handleAddTag]
  );

  const handleMediaSelected = useCallback((files: MediaFile[]) => {
    setMediaFiles((prev) => [...prev, ...files]);
    setHasChanges(true);
  }, []);

  const handleMediaRemove = useCallback((id: string) => {
    setMediaFiles((prev) => prev.filter((file) => file.id !== id));
    setHasChanges(true);
  }, []);

  const applyAICapture = useCallback(
    (capture: JournalAICaptureResult, nextContent?: JournalBlock[]) => {
      const nextTitle = capture.title.trim();

      if (nextContent) {
        setContent(sanitizeBlocks(nextContent));
      }

      if (nextTitle) {
        setTitle((current) => {
          if (nextTitle === "Untitled" && current.trim() && current !== "Untitled") {
            return current;
          }

          return nextTitle;
        });
      }

      if (capture.journalDate) {
        setJournalDate(capture.journalDate);
      }

      if (capture.entryType) {
        setEntryType(capture.entryType);
      }

      if (capture.tradePhase) {
        setTradePhase(capture.tradePhase);
      }

      if (capture.tags.length > 0) {
        setTags((current) => Array.from(new Set([...current, ...capture.tags])));
      }

      if (capture.psychology) {
        setPsychology((current) => ({
          ...current,
          ...capture.psychology,
        }));
      }

      if (capture.plannedEntryPrice !== undefined) {
        setPlannedEntryPrice(capture.plannedEntryPrice || "");
      }

      if (capture.plannedExitPrice !== undefined) {
        setPlannedExitPrice(capture.plannedExitPrice || "");
      }

      if (capture.plannedStopLoss !== undefined) {
        setPlannedStopLoss(capture.plannedStopLoss || "");
      }

      if (capture.plannedTakeProfit !== undefined) {
        setPlannedTakeProfit(capture.plannedTakeProfit || "");
      }

      if (capture.plannedRiskReward !== undefined) {
        setPlannedRiskReward(capture.plannedRiskReward || "");
      }

      if (capture.plannedNotes !== undefined) {
        setPlannedNotes(capture.plannedNotes || "");
      }

      if (capture.actualOutcome !== undefined) {
        setActualOutcome(capture.actualOutcome);
      }

      if (capture.actualPnl !== undefined) {
        setActualPnl(capture.actualPnl || "");
      }

      if (capture.actualPips !== undefined) {
        setActualPips(capture.actualPips || "");
      }

      if (capture.postTradeAnalysis !== undefined) {
        setPostTradeAnalysis(capture.postTradeAnalysis || "");
      }

      if (capture.lessonsLearned !== undefined) {
        setLessonsLearned(capture.lessonsLearned || "");
      }

      setHasChanges(true);
    },
    [sanitizeBlocks]
  );

  return {
    title,
    setTitle,
    emoji,
    setEmoji,
    coverImageUrl,
    setCoverImageUrl,
    coverPosition,
    setCoverPosition,
    content,
    tags,
    entryType,
    journalDate,
    setJournalDate,
    isSaving,
    hasChanges,
    showEmojiPicker,
    setShowEmojiPicker,
    showSaveTemplateDialog,
    setShowSaveTemplateDialog,
    newTag,
    setNewTag,
    showTagInput,
    setShowTagInput,
    showDeleteConfirm,
    setShowDeleteConfirm,
    tradePhase,
    setTradePhase,
    psychology,
    setPsychology,
    plannedEntryPrice,
    setPlannedEntryPrice,
    plannedExitPrice,
    setPlannedExitPrice,
    plannedStopLoss,
    setPlannedStopLoss,
    plannedTakeProfit,
    setPlannedTakeProfit,
    plannedRiskReward,
    setPlannedRiskReward,
    plannedNotes,
    setPlannedNotes,
    actualOutcome,
    setActualOutcome,
    actualPnl,
    setActualPnl,
    actualPips,
    setActualPips,
    postTradeAnalysis,
    setPostTradeAnalysis,
    lessonsLearned,
    setLessonsLearned,
    mediaFiles,
    activeTab,
    setActiveTab,
    markChanged: () => setHasChanges(true),
    coverImageRef,
    isLoadingEntry: Boolean(entryId) && (isLoadingEntry || !isEntryHydrated),
    isEntryHydrated,
    existingEntryLoaded: !entryId || isEntryHydrated,
    handleContentChange,
    handleSave,
    handleAddTag,
    handleRemoveTag,
    handleTagKeyDown,
    handleMediaSelected,
    handleMediaRemove,
    applyAICapture,
    handleDelete: () => {
      if (entryId) {
        deleteEntry.mutate({ id: entryId });
      }
    },
  };
}
