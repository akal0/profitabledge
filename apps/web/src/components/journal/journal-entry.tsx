"use client";

import React, { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { JournalEditor } from "./editor";
import type { JournalBlock, PsychologySnapshot, TradePhase } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Image as ImageIcon,
  Smile,
  MoreHorizontal,
  Trash2,
  Star,
  Archive,
  Copy,
  Share,
  Calendar,
  Clock,
  Save,
  ChevronLeft,
  X,
  FileText,
  Tag,
  Plus,
  Lightbulb,
  Brain,
  Paperclip,
  Edit3,
  Sparkles,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { Separator } from "../ui/separator";
import { SaveTemplateDialog } from "./template-browser";
import { TradePhaseSelector, TradePhaseBadge } from "./trade-phase-selector";
import { PsychologyTracker, PsychologySummary } from "./psychology-tracker";
import { MediaDropzone, type MediaFile } from "@/components/media/media-dropzone";
import { GoalSelector } from "./goal-selector";
import { AIAnalysisDisplay } from "./ai-analysis-display";
import {
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
  journalCompactActionButtonClassName,
  journalCompactActionIconButtonClassName,
} from "./action-button-styles";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

// ============================================================================
// Journal Entry Component
// ============================================================================

interface JournalEntryPageProps {
  entryId?: string;
  accountId?: string;
  initialContent?: JournalBlock[];
  initialTitle?: string;
  initialEntryType?: string;
  onBack?: () => void;
  onSave?: (entry: JournalEntryData) => void;
}

interface JournalEntryData {
  id?: string;
  title: string;
  emoji?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number;
  content: JournalBlock[];
  tags: string[];
  entryType: string;
  journalDate?: string | null;
  tradePhase?: TradePhase | null;
  psychology?: PsychologySnapshot | null;
  plannedEntryPrice?: string | null;
  plannedExitPrice?: string | null;
  plannedStopLoss?: string | null;
  plannedTakeProfit?: string | null;
  plannedRiskReward?: string | null;
  plannedNotes?: string | null;
  actualOutcome?: 'win' | 'loss' | 'breakeven' | 'scratched' | null;
  actualPnl?: string | null;
  actualPips?: string | null;
  postTradeAnalysis?: string | null;
  lessonsLearned?: string | null;
}

export function JournalEntryPage({
  entryId,
  accountId,
  initialContent,
  initialTitle,
  initialEntryType,
  onBack,
  onSave,
}: JournalEntryPageProps) {
  // Entry type options
  type EntryType =
    | "general"
    | "daily"
    | "weekly"
    | "monthly"
    | "trade_review"
    | "strategy"
    | "comparison"
    | "backtest";

  // State - use initial values from template if provided
  const [title, setTitle] = useState(initialTitle || "Untitled");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState(50);
  const [content, setContent] = useState<JournalBlock[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [entryType, setEntryType] = useState<EntryType>((initialEntryType as EntryType) || "general");
  const [journalDate, setJournalDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [tradePhase, setTradePhase] = useState<TradePhase | null>(null);
  const [psychology, setPsychology] = useState<PsychologySnapshot>({
    mood: 5,
    confidence: 5,
    energy: 5,
    focus: 5,
    fear: 3,
    greed: 3,
    emotionalState: 'neutral',
  });
  const [plannedEntryPrice, setPlannedEntryPrice] = useState<string>("");
  const [plannedExitPrice, setPlannedExitPrice] = useState<string>("");
  const [plannedStopLoss, setPlannedStopLoss] = useState<string>("");
  const [plannedTakeProfit, setPlannedTakeProfit] = useState<string>("");
  const [plannedRiskReward, setPlannedRiskReward] = useState<string>("");
  const [plannedNotes, setPlannedNotes] = useState<string>("");
  const [actualOutcome, setActualOutcome] = useState<'win' | 'loss' | 'breakeven' | 'scratched' | null>(null);
  const [actualPnl, setActualPnl] = useState<string>("");
  const [actualPips, setActualPips] = useState<string>("");
  const [postTradeAnalysis, setPostTradeAnalysis] = useState<string>("");
  const [lessonsLearned, setLessonsLearned] = useState<string>("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>("content");

  // Refs
  const coverImageRef = useRef<HTMLInputElement>(null);

  // Debounced save
  const [debouncedContent] = useDebounce(content, 1000);

  // Fetch existing entry if editing
  const { data: existingEntry, isLoading: isLoadingEntry } =
    trpc.journal.get.useQuery({ id: entryId! }, { enabled: !!entryId });

  // Load existing entry data
  React.useEffect(() => {
    if (existingEntry) {
      setTitle(existingEntry.title);
      setEmoji(existingEntry.emoji);
      setCoverImageUrl(existingEntry.coverImageUrl);
      setCoverPosition(existingEntry.coverImagePosition || 50);
      setContent((existingEntry.content as JournalBlock[]) || []);
      setTags((existingEntry.tags as string[]) || []);
      setEntryType((existingEntry.entryType as EntryType) || "general");
      const jd = existingEntry.journalDate as Date | string | null;
      setJournalDate(
        jd ? (typeof jd === "string" ? jd : jd.toISOString()) : null
      );
      setTradePhase((existingEntry.tradePhase as TradePhase) || null);
      setPsychology((existingEntry.psychology as PsychologySnapshot) || {
        mood: 5,
        confidence: 5,
        energy: 5,
        focus: 5,
        fear: 3,
        greed: 3,
        emotionalState: 'neutral',
      });
      setPlannedEntryPrice(existingEntry.plannedEntryPrice || "");
      setPlannedExitPrice(existingEntry.plannedExitPrice || "");
      setPlannedStopLoss(existingEntry.plannedStopLoss || "");
      setPlannedTakeProfit(existingEntry.plannedTakeProfit || "");
      setPlannedRiskReward(existingEntry.plannedRiskReward || "");
      setPlannedNotes(existingEntry.plannedNotes || "");
      setActualOutcome((existingEntry.actualOutcome as typeof actualOutcome) || null);
      setActualPnl(existingEntry.actualPnl || "");
      setActualPips(existingEntry.actualPips || "");
      setPostTradeAnalysis(existingEntry.postTradeAnalysis || "");
      setLessonsLearned(existingEntry.lessonsLearned || "");
    }
  }, [existingEntry]);

  // Mutations
  const createEntry = trpc.journal.create.useMutation();
  const updateEntry = trpc.journal.update.useMutation();
  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: () => {
      toast.success("Entry deleted");
      onBack?.();
    },
    onError: () => {
      toast.error("Failed to delete entry");
    },
  });

  // Auto-save on debounced content change
  React.useEffect(() => {
    if (!hasChanges || !entryId || debouncedContent.length === 0) return;

    const saveEntry = async () => {
      try {
        await updateEntry.mutateAsync({
          id: entryId,
          title,
          emoji,
          coverImageUrl,
          coverImagePosition: coverPosition,
          content: debouncedContent,
          tags,
          entryType,
          journalDate,
        });
        setHasChanges(false);
      } catch (error) {
        console.error("Failed to auto-save:", error);
      }
    };

    saveEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedContent]);

  // Sanitize blocks before saving - filter out invalid chart/trade blocks
  const sanitizeBlocks = useCallback(
    (blocks: JournalBlock[]): JournalBlock[] => {
      return blocks.filter((block) => {
        // Filter out chart blocks without valid chartType
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
        // Filter out image blocks without valid URL
        if (block.type === "image") {
          const url = block.props?.imageUrl || "";
          return url.startsWith("data:") || url.startsWith("http");
        }
        return true;
      });
    },
    []
  );

  // Handle content changes
  const handleContentChange = useCallback(
    (blocks: JournalBlock[], _html: string) => {
      const sanitized = sanitizeBlocks(blocks);
      setContent(sanitized);
      setHasChanges(true);
    },
    [sanitizeBlocks]
  );

  // Handle manual save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (entryId) {
        await updateEntry.mutateAsync({
          id: entryId,
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
          plannedEntryPrice: plannedEntryPrice || null,
          plannedExitPrice: plannedExitPrice || null,
          plannedStopLoss: plannedStopLoss || null,
          plannedTakeProfit: plannedTakeProfit || null,
          plannedRiskReward: plannedRiskReward || null,
          plannedNotes: plannedNotes || null,
          actualOutcome,
          actualPnl: actualPnl || null,
          actualPips: actualPips || null,
          postTradeAnalysis: postTradeAnalysis || null,
          lessonsLearned: lessonsLearned || null,
        });
      } else {
        const newEntry = await createEntry.mutateAsync({
          title,
          emoji: emoji || undefined,
          coverImageUrl: coverImageUrl || undefined,
          coverImagePosition: coverPosition,
          content,
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
        });
      }
      setHasChanges(false);
      toast.success("Saved");
    } catch (error) {
      toast.error("Failed to save");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cover image upload - converts to base64 for persistence
  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 data URL for persistence
    // In production, this should upload to a storage service (S3, etc.)
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const dataUrl = readerEvent.target?.result as string;
      if (dataUrl) {
        setCoverImageUrl(dataUrl);
        setHasChanges(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle cover image position change (drag)
  const handleCoverPositionChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = Math.round((y / rect.height) * 100);
    setCoverPosition(Math.max(0, Math.min(100, position)));
    setHasChanges(true);
  };

  // Tag management
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
      setHasChanges(true);
    }
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setHasChanges(true);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setShowTagInput(false);
      setNewTag("");
    }
  };

  const handleMediaSelected = useCallback((files: MediaFile[]) => {
    setMediaFiles((prev) => [...prev, ...files]);
    setHasChanges(true);
  }, []);

  const handleMediaRemove = useCallback((id: string) => {
    setMediaFiles((prev) => prev.filter((f) => f.id !== id));
    setHasChanges(true);
  }, []);

  if (isLoadingEntry) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-sidebar backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
        <div className="flex items-center justify-between py-2 px-8">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button
                size="sm"
                onClick={onBack}
                className={journalActionIconButtonClassName}
              >
                <ChevronLeft className="size-3" />
              </Button>
            )}
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span>Journal</span>
              <span>/</span>
              <span className="text-white truncate max-w-48">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-white/40">Unsaved changes</span>
            )}
            <Button
              size="sm"
              onClick={handleSave}
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
                <Button
                  size="sm"
                  className={journalActionIconButtonClassName}
                >
                  <MoreHorizontal className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-sidebar border-white/10 text-xs!"
              >
                <DropdownMenuItem className="text-white/80 focus:text-white focus:bg-white/10 text-xs!">
                  <Star className="size-3!" />
                  Pin to top
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white/80 focus:text-white focus:bg-white/10 text-xs!">
                  <Copy className="size-3!" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white/80 focus:text-white focus:bg-white/10 text-xs!">
                  <Share className="size-3!" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-white/80 focus:text-white focus:bg-white/10 text-xs!"
                  onClick={() => setShowSaveTemplateDialog(true)}
                >
                  <FileText className="size-3!" />
                  Save as template
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-white/80 focus:text-white focus:bg-white/10 text-xs!">
                  <Archive className="size-3!" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-400 focus:text-red-400 focus:bg-red-400/10 text-xs!"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="size-3!" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Cover Image */}
        {coverImageUrl ? (
          <div
            className="relative h-48 md:h-64 bg-sidebar-accent cursor-move group"
            onClick={handleCoverPositionChange}
          >
            <img
              src={coverImageUrl}
              alt="Cover"
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${coverPosition}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

            {/* Cover controls */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                className={cn(
                  journalCompactActionButtonClassName,
                  "bg-sidebar/90 border-white/10 text-white hover:bg-sidebar-accent backdrop-blur-sm"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  coverImageRef.current?.click();
                }}
              >
                Change cover
              </Button>
              <Button
                size="sm"
                className={cn(
                  journalCompactActionIconButtonClassName,
                  "bg-sidebar/90 border-white/10 text-white hover:bg-sidebar-accent backdrop-blur-sm"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setCoverImageUrl(null);
                  setHasChanges(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to reposition
            </div>
          </div>
        ) : (
          <div className="h-12" /> // Spacer when no cover
        )}

        {/* Main content area */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Add cover / emoji row */}
          <div className="flex items-center gap-2 mb-4 text-white/40">
            {!emoji && (
              <button
                onClick={() => setShowEmojiPicker(true)}
                className="flex items-center gap-1.5 text-sm hover:text-white/60 transition-colors"
              >
                <Smile className="h-4 w-4" />
                Add icon
              </button>
            )}
            {!coverImageUrl && (
              <>
                <span className="text-white/20">|</span>
                <button
                  onClick={() => coverImageRef.current?.click()}
                  className="flex items-center gap-1.5 text-sm hover:text-white/60 transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                  Add cover
                </button>
              </>
            )}
            <input
              ref={coverImageRef}
              type="file"
              accept="image/*"
              onChange={handleCoverImageChange}
              className="hidden"
            />
          </div>

          {/* Emoji */}
          {emoji && (
            <button
              onClick={() => setShowEmojiPicker(true)}
              className="text-6xl mb-4 hover:scale-110 transition-transform"
            >
              {emoji}
            </button>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Untitled"
            className="w-full text-4xl font-bold bg-transparent border-none outline-none text-white placeholder:text-white/20 mb-4"
          />

          {/* Trade Phase Badge */}
          {tradePhase && (
            <div className="mb-4">
              <TradePhaseBadge phase={tradePhase} />
            </div>
          )}

          {/* Metadata section */}
          <div className="text-sm text-white/40 mb-8 pb-4 border-b border-white/5">
            {/* Date and read time row */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {journalDate 
                  ? format(new Date(journalDate), "MMM d, yyyy")
                  : format(new Date(), "MMM d, yyyy")
                }
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {Math.max(1, Math.ceil(content.reduce((acc, block) => acc + (block.content?.split(/\s+/).length || 0), 0) / 200))} min read
              </div>
              {psychology && (
                <PsychologySummary psychology={psychology} compact />
              )}
            </div>
            
            {/* Tags row - separate line */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="h-4 w-4 text-white/40 flex-shrink-0" />
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs border-white/10 text-white/60 group/tag cursor-pointer hover:border-white/20"
                >
                  {tag}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(tag);
                    }}
                    className="ml-1 opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              
              {showTagInput ? (
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  placeholder="Add tag..."
                  autoFocus
                  className="h-6 w-24 text-xs bg-transparent border-white/20 text-white placeholder:text-white/30 focus-visible:ring-teal-500"
                />
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add tag
                </button>
              )}
            </div>
          </div>

          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 bg-transparent border-b border-white/10 rounded-none p-0 h-auto">
              <TabsTrigger 
                value="content" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
              >
                <Edit3 className="h-3 w-3 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger 
                value="trade-idea" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
              >
                <Lightbulb className="h-3 w-3 mr-2" />
                Trade Idea
              </TabsTrigger>
              <TabsTrigger 
                value="psychology" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
              >
                <Brain className="h-3 w-3 mr-2" />
                Psychology
              </TabsTrigger>
              <TabsTrigger 
                value="goals" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
              >
                <Target className="h-3 w-3 mr-2" />
                Goals
              </TabsTrigger>
              <TabsTrigger 
                value="ai" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
              >
                <Sparkles className="h-3 w-3 mr-2" />
                AI
              </TabsTrigger>
              <TabsTrigger 
                value="media" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
              >
                <Paperclip className="h-3 w-3 mr-2" />
                Media
                {mediaFiles.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">
                    {mediaFiles.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-0">
              {(!entryId || existingEntry) ? (
                <JournalEditor
                  key={entryId || 'new'}
                  initialContent={existingEntry ? (existingEntry.content as JournalBlock[]) || [] : []}
                  onChange={handleContentChange}
                  placeholder="Start writing, or press '/' for commands..."
                  autoFocus={!entryId}
                  accountId={accountId}
                />
              ) : (
                <div className="min-h-[200px] animate-pulse bg-white/5 rounded-lg" />
              )}
            </TabsContent>

            <TabsContent value="trade-idea" className="mt-0 space-y-6">
              <TradePhaseSelector
                value={tradePhase}
                onChange={(phase) => {
                  setTradePhase(phase);
                  setHasChanges(true);
                }}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Planned Entry Price</Label>
                  <Input
                    type="text"
                    value={plannedEntryPrice}
                    onChange={(e) => {
                      setPlannedEntryPrice(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., 1.0850"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Planned Exit Price</Label>
                  <Input
                    type="text"
                    value={plannedExitPrice}
                    onChange={(e) => {
                      setPlannedExitPrice(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., 1.0950"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Stop Loss</Label>
                  <Input
                    type="text"
                    value={plannedStopLoss}
                    onChange={(e) => {
                      setPlannedStopLoss(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., 1.0800"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Take Profit</Label>
                  <Input
                    type="text"
                    value={plannedTakeProfit}
                    onChange={(e) => {
                      setPlannedTakeProfit(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., 1.1000"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Risk:Reward Ratio</Label>
                  <Input
                    type="text"
                    value={plannedRiskReward}
                    onChange={(e) => {
                      setPlannedRiskReward(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., 1:2"
                    className="bg-muted/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Trade Idea Notes</Label>
                <textarea
                  value={plannedNotes}
                  onChange={(e) => {
                    setPlannedNotes(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Describe your setup, reasoning, and key levels..."
                  className="w-full min-h-[100px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm resize-none"
                />
              </div>

              {tradePhase === 'post-trade' && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-sm font-medium">Post-Trade Analysis</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Actual Outcome</Label>
                      <select
                        value={actualOutcome || ""}
                        onChange={(e) => {
                          setActualOutcome(e.target.value as typeof actualOutcome || null);
                          setHasChanges(true);
                        }}
                        className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="breakeven">Breakeven</option>
                        <option value="scratched">Scratched</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Actual P&L ($)</Label>
                      <Input
                        type="text"
                        value={actualPnl}
                        onChange={(e) => {
                          setActualPnl(e.target.value);
                          setHasChanges(true);
                        }}
                        placeholder="e.g., +250"
                        className="bg-muted/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Actual Pips</Label>
                      <Input
                        type="text"
                        value={actualPips}
                        onChange={(e) => {
                          setActualPips(e.target.value);
                          setHasChanges(true);
                        }}
                        placeholder="e.g., +25"
                        className="bg-muted/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Post-Trade Analysis</Label>
                    <textarea
                      value={postTradeAnalysis}
                      onChange={(e) => {
                        setPostTradeAnalysis(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="What went well? What could be improved?"
                      className="w-full min-h-[80px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Lessons Learned</Label>
                    <textarea
                      value={lessonsLearned}
                      onChange={(e) => {
                        setLessonsLearned(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Key takeaways from this trade..."
                      className="w-full min-h-[80px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="psychology" className="mt-0">
              <PsychologyTracker
                value={psychology}
                onChange={(p) => {
                  setPsychology(p);
                  setHasChanges(true);
                }}
              />
            </TabsContent>

            <TabsContent value="goals" className="mt-0">
              {entryId ? (
                <GoalSelector
                  entryId={entryId}
                  onChange={(goalIds) => {
                    console.log("Linked goals:", goalIds);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Target className="h-10 w-10 text-white/20 mb-3" />
                  <p className="text-sm text-white/40">
                    Save the entry first to link goals
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              {entryId ? (
                <AIAnalysisDisplay entryId={entryId} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-10 w-10 text-white/20 mb-3" />
                  <p className="text-sm text-white/40">
                    Save the entry first to enable AI analysis
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="media" className="mt-0">
              <MediaDropzone
                files={mediaFiles}
                onFilesSelected={handleMediaSelected}
                onFileRemove={handleMediaRemove}
                accept="all"
                maxFiles={20}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Emoji Picker Dialog */}
      <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <DialogContent className="bg-sidebar border-white/10 max-w-[352px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Choose an icon</DialogTitle>
            <DialogDescription className="text-white/40">
              Select an emoji to represent this journal entry
            </DialogDescription>
          </DialogHeader>
          <div className="emoji-picker-wrapper">
            <Picker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                setEmoji(emoji.native);
                setShowEmojiPicker(false);
                setHasChanges(true);
              }}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="bottom"
              perLine={8}
              maxFrequentRows={2}
            />
          </div>
          {emoji && (
            <div className="p-4 pt-0">
              <Button
                size="sm"
                className={cn(
                  journalActionButtonMutedClassName,
                  "w-full text-red-400 hover:bg-red-400/10 hover:text-red-400"
                )}
                onClick={() => {
                  setEmoji(null);
                  setShowEmojiPicker(false);
                  setHasChanges(true);
                }}
              >
                Remove icon
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <SaveTemplateDialog
        isOpen={showSaveTemplateDialog}
        onClose={() => setShowSaveTemplateDialog(false)}
        entryTitle={title}
        entryContent={content}
        onSaved={() => {
          toast.success("Template saved successfully!");
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-sidebar border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete entry?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete "{title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (entryId) {
                  deleteEntry.mutate({ id: entryId });
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
