"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BookText,
  CalendarClock,
  CalendarDays,
  LineChart,
  Pin,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { isAllAccountsScope } from "@/stores/account";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JournalPrompts } from "./journal-prompts";
import { JournalWidgetFrame, JournalWidgetShell } from "./journal-widget-shell";
import {
  journalActionButtonClassName,
  journalActionButtonMutedClassName,
  journalCompactActionButtonClassName,
} from "./action-button-styles";

interface JournalOverviewPanelProps {
  accountId?: string;
  onCreateEntry: () => void;
  onSelectEntry: (entryId: string) => void;
  onCreateFromPrompt: (prompt: any) => void;
  className?: string;
}

const compactNumberFormatter = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function JournalOverviewPanel({
  accountId,
  onCreateEntry,
  onSelectEntry,
  onCreateFromPrompt,
  className,
}: JournalOverviewPanelProps) {
  const canGenerateScopedReviews =
    typeof accountId === "string" && !isAllAccountsScope(accountId);

  const { data: stats, isLoading: statsLoading } = trpc.journal.stats.useQuery(
    accountId ? { accountId } : undefined
  );
  const { data: prompts = [], isLoading: promptsLoading } =
    trpc.journal.getPrompts.useQuery();

  const handleGeneratedEntry = (entryId?: string) => {
    if (entryId) {
      onSelectEntry(entryId);
    }
  };

  const autoGenerateEntryMutation = trpc.journal.autoGenerateEntry.useMutation({
    onSuccess: (entry: any) => {
      handleGeneratedEntry(entry.id);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate daily review");
    },
  });

  const generatePeriodReviewMutation =
    trpc.journal.generatePeriodReview.useMutation({
      onSuccess: (entry: any) => {
        handleGeneratedEntry(entry.id);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to generate period review");
      },
    });

  const topEntryType = React.useMemo(() => {
    if (!stats?.typeBreakdown?.length) {
      return "No entries yet";
    }

    const [topType] = [...stats.typeBreakdown].sort((a, b) => b.count - a.count);
    const labelMap: Record<string, string> = {
      general: "General",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      trade_review: "Trade Review",
      strategy: "Strategy",
      comparison: "Comparison",
      backtest: "Backtest",
    };

    return labelMap[topType.entryType || "general"] ?? "General";
  }, [stats?.typeBreakdown]);

  const activeWeeks =
    stats?.recentActivity?.filter((week: any) => week.count > 0).length ?? 0;
  const pendingPrompts = prompts.filter((prompt: any) => prompt.status === "pending");

  const statCards = [
    {
      label: "Entries",
      value: stats?.totalEntries ?? 0,
      helper: "in this scope",
      icon: BookText,
    },
    {
      label: "Words",
      value: compactNumberFormatter.format(stats?.totalWords ?? 0),
      helper: "written so far",
      icon: LineChart,
    },
    {
      label: "Pinned",
      value: stats?.pinnedCount ?? 0,
      helper: "kept at the top",
      icon: Pin,
    },
    {
      label: "Focus",
      value: topEntryType,
      helper:
        activeWeeks > 0 ? `${activeWeeks} active week${activeWeeks === 1 ? "" : "s"}` : "build the streak",
      icon: Sparkles,
    },
  ];

  const isGeneratingDaily = autoGenerateEntryMutation.isPending;
  const isGeneratingPeriod = generatePeriodReviewMutation.isPending;

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <JournalWidgetShell key={index}>
                <div className="flex items-start justify-between p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20 bg-sidebar-accent" />
                    <Skeleton className="h-6 w-24 bg-sidebar-accent" />
                    <Skeleton className="h-3 w-16 bg-sidebar-accent" />
                  </div>
                  <Skeleton className="h-9 w-9 bg-sidebar-accent" />
                </div>
              </JournalWidgetShell>
            ))
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <JournalWidgetShell key={stat.label}>
                  <div className="flex items-start justify-between p-4">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                        {stat.label}
                      </p>
                      <p className="text-lg font-semibold text-white">{stat.value}</p>
                      <p className="text-xs text-white/40">{stat.helper}</p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-teal-300">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </JournalWidgetShell>
              );
            })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <JournalWidgetFrame
          header={
            <div className="flex flex-row items-center justify-between gap-4 p-3.5">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Prompt Inbox</h3>
                <p className="text-xs text-white/45">
                  Surface the AI prompts that should turn into journal entries next.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-teal-400/20 bg-teal-500/10 text-teal-300"
                >
                  {pendingPrompts.length} pending
                </Badge>
                <JournalPrompts
                  triggerVariant="button"
                  buttonLabel="Open inbox"
                  onJournalFromPrompt={onCreateFromPrompt}
                />
              </div>
            </div>
          }
        >
          <div className="space-y-3 p-4">
            {promptsLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-sm bg-sidebar-accent" />
              ))
            ) : pendingPrompts.length > 0 ? (
              pendingPrompts.slice(0, 3).map((prompt: any) => (
                <div
                  key={prompt.id}
                  className="flex items-start justify-between gap-3 rounded-sm border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-white">{prompt.title}</p>
                    <p className="line-clamp-2 text-xs leading-5 text-white/45">
                      {prompt.questions?.[0] || "Prompt ready for reflection."}
                    </p>
                    <p className="text-[11px] text-white/30">
                      Added{" "}
                      {formatDistanceToNow(new Date(prompt.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onCreateFromPrompt(prompt)}
                    className={journalCompactActionButtonClassName}
                  >
                    Use prompt
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-medium text-white">No prompts queued</p>
                <p className="mt-1 text-xs text-white/45">
                  The inbox will fill as trades close and reflection moments stack up.
                </p>
              </div>
            )}
          </div>
        </JournalWidgetFrame>

        <JournalWidgetFrame
          header={
            <div className="p-3.5">
              <h3 className="text-sm font-semibold text-white">Review Builder</h3>
              <p className="text-xs text-white/45">
                Create structured daily, weekly, and monthly reflections from recent trades.
              </p>
            </div>
          }
        >
          <div className="space-y-3 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="sm"
                disabled={!canGenerateScopedReviews || isGeneratingDaily}
                onClick={() => {
                  if (!accountId) return;
                  autoGenerateEntryMutation.mutate({ accountId });
                }}
                className={journalActionButtonClassName}
              >
                <CalendarClock className="h-4 w-4" />
                {isGeneratingDaily ? "Building..." : "Daily recap"}
              </Button>
              <Button
                size="sm"
                disabled={!canGenerateScopedReviews || isGeneratingPeriod}
                onClick={() => {
                  if (!accountId) return;
                  generatePeriodReviewMutation.mutate({
                    accountId,
                    period: "week",
                  });
                }}
                className={journalActionButtonClassName}
              >
                <CalendarDays className="h-4 w-4" />
                {isGeneratingPeriod ? "Building..." : "Weekly review"}
              </Button>
              <Button
                size="sm"
                disabled={!canGenerateScopedReviews || isGeneratingPeriod}
                onClick={() => {
                  if (!accountId) return;
                  generatePeriodReviewMutation.mutate({
                    accountId,
                    period: "month",
                  });
                }}
                className={journalActionButtonClassName}
              >
                <CalendarDays className="h-4 w-4" />
                {isGeneratingPeriod ? "Building..." : "Monthly review"}
              </Button>
              <Button
                size="sm"
                onClick={onCreateEntry}
                className={journalActionButtonMutedClassName}
              >
                <Plus className="h-4 w-4" />
                New blank
              </Button>
            </div>

            {canGenerateScopedReviews ? (
              <p className="text-xs text-white/40">
                Generated reviews open immediately so you can refine the structure before saving.
              </p>
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs leading-5 text-white/45">
                  Select a single account to generate daily, weekly, or monthly review entries.
                </p>
              </div>
            )}
          </div>
        </JournalWidgetFrame>
      </div>
    </div>
  );
}
