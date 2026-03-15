"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Bell,
  X,
  MessageSquare,
  Target,
  TrendingUp,
  Brain,
  Clock,
  Sparkles,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  journalActionButtonClassName,
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
  journalCompactActionButtonClassName,
  journalCompactActionIconButtonClassName,
} from "./action-button-styles";

interface JournalPromptsProps {
  onJournalFromPrompt?: (prompt: any) => void;
  className?: string;
  triggerVariant?: "icon" | "button";
  buttonLabel?: string;
}

const PROMPT_ICONS: Record<string, React.ElementType> = {
  trade_review: Target,
  daily_reflection: Clock,
  pattern_inquiry: Brain,
  goal_progress: TrendingUp,
  psychology_check: Sparkles,
};

const PROMPT_COLORS: Record<string, string> = {
  trade_review: "text-teal-400 bg-teal-400/10",
  daily_reflection: "text-blue-400 bg-blue-400/10",
  pattern_inquiry: "text-purple-400 bg-purple-400/10",
  goal_progress: "text-green-400 bg-green-400/10",
  psychology_check: "text-yellow-400 bg-yellow-400/10",
};

export function JournalPrompts({
  onJournalFromPrompt,
  className,
  triggerVariant = "icon",
  buttonLabel = "Open prompts",
}: JournalPromptsProps) {
  const [showSheet, setShowSheet] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const { data: prompts = [], isLoading, refetch } = trpc.journal.getPrompts.useQuery();

  const showPromptMutation = trpc.journal.showPrompt.useMutation();
  const dismissPromptMutation = trpc.journal.dismissPrompt.useMutation();
  const autoGenerateMutation = trpc.journal.autoGeneratePrompts.useMutation();

  useEffect(() => {
    const interval = setInterval(() => {
      autoGenerateMutation.mutate();
    }, 60000);

    autoGenerateMutation.mutate();

    return () => clearInterval(interval);
  }, [autoGenerateMutation]);

  const handleShowPrompt = async (prompt: any) => {
    await showPromptMutation.mutateAsync({ promptId: prompt.id });
    setSelectedPrompt(prompt);
  };

  const handleDismiss = async (promptId: string) => {
    await dismissPromptMutation.mutateAsync({ promptId });
    refetch();
  };

  const handleStartJournaling = () => {
    if (selectedPrompt) {
      onJournalFromPrompt?.(selectedPrompt);
      setShowSheet(false);
      setSelectedPrompt(null);
    }
  };

  const pendingCount = prompts.filter((p: any) => p.status === "pending").length;

  const PromptIcon = selectedPrompt && PROMPT_ICONS[selectedPrompt.type]
    ? PROMPT_ICONS[selectedPrompt.type]
    : MessageSquare;

  return (
    <>
      {triggerVariant === "button" ? (
        <Button
          size="sm"
          onClick={() => setShowSheet(true)}
          className={cn(journalActionButtonClassName, className)}
        >
          <Bell className="h-4 w-4" />
          <span>{buttonLabel}</span>
          {pendingCount > 0 ? (
            <Badge className="rounded-full border-0 bg-teal-500/15 px-2 py-0 text-[10px] text-teal-300 hover:bg-teal-500/15">
              {pendingCount}
            </Badge>
          ) : null}
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => setShowSheet(true)}
          className={cn("relative", journalActionIconButtonClassName, className)}
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] text-white">
              {pendingCount}
            </span>
          )}
        </Button>
      )}

      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <SheetContent className="w-full sm:max-w-md bg-sidebar border-white/10">
          <SheetHeader>
            <SheetTitle className="text-white">Journal Prompts</SheetTitle>
            <SheetDescription className="text-white/40">
              AI-generated prompts to help you reflect on your trading
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-sidebar-accent animate-pulse" />
                ))}
              </div>
            ) : prompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-10 w-10 text-white/20 mb-3" />
                <p className="text-sm text-white/40">No prompts right now</p>
                <p className="text-xs text-white/30 mt-1">
                  Prompts will appear based on your trading activity
                </p>
              </div>
            ) : (
              prompts.map((prompt: any) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onShow={() => handleShowPrompt(prompt)}
                  onDismiss={() => handleDismiss(prompt.id)}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-xl"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent")}>
                <PromptIcon className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">{selectedPrompt?.title}</div>
                {selectedPrompt?.triggerType && (
                  <p className="mt-1 text-xs leading-relaxed text-white/40">
                    Triggered by: {selectedPrompt.triggerType.replace(/_/g, " ")}
                  </p>
                )}
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
            <div className="space-y-4 px-5 py-4">
              {selectedPrompt?.questions?.map((question: string, index: number) => (
                <div key={index} className="space-y-2">
                  <p className="text-sm text-white/80">{question}</p>
                  <Textarea
                    value={answers[index] || ""}
                    onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
                    placeholder="Your reflection..."
                    className="bg-sidebar-accent border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                  />
                </div>
              ))}
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                onClick={() => {
                  if (selectedPrompt) {
                    handleDismiss(selectedPrompt.id);
                    setSelectedPrompt(null);
                  }
                }}
                className={journalActionButtonMutedClassName}
              >
                Dismiss
              </Button>
              <Button
                onClick={handleStartJournaling}
                className={journalActionButtonClassName}
              >
                <FileText className="h-4 w-4 mr-2" />
                Start Journaling
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PromptCardProps {
  prompt: any;
  onShow: () => void;
  onDismiss: () => void;
}

function PromptCard({ prompt, onShow, onDismiss }: PromptCardProps) {
  const Icon = PROMPT_ICONS[prompt.type] || MessageSquare;
  const colorClass = PROMPT_COLORS[prompt.type] || "text-white/60 bg-white/10";
  const timeAgo = formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true });

  return (
    <div className="p-4 bg-sidebar-accent border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn("p-2 flex-shrink-0", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{prompt.title}</p>
            <p className="text-xs text-white/40 mt-1 line-clamp-2">
              {prompt.questions?.[0]}
            </p>
            <p className="text-xs text-white/30 mt-2">{timeAgo}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={onShow}
            className={cn(
              journalCompactActionButtonClassName,
              "text-white hover:text-white"
            )}
          >
            Answer
          </Button>
          <Button
            size="sm"
            onClick={onDismiss}
            className={journalCompactActionIconButtonClassName}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PromptNotificationBanner({ onJournalFromPrompt }: { onJournalFromPrompt?: (prompt: any) => void }) {
  const [dismissed, setDismissed] = useState(false);
  const { data: prompts = [] } = trpc.journal.getPrompts.useQuery();

  const latestPrompt = prompts[0];

  if (!latestPrompt || dismissed) return null;

  const Icon = PROMPT_ICONS[latestPrompt.type] || MessageSquare;

  return (
    <div className="p-3 bg-gradient-to-r from-teal-500/20 to-blue-500/20 border border-teal-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-1.5", PROMPT_COLORS[latestPrompt.type])}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{latestPrompt.title}</p>
            <p className="text-xs text-white/60">{latestPrompt.questions?.[0]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onJournalFromPrompt?.(latestPrompt)}
            className={journalCompactActionButtonClassName}
          >
            Journal now
          </Button>
          <Button
            size="sm"
            onClick={() => setDismissed(true)}
            className={journalCompactActionIconButtonClassName}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
