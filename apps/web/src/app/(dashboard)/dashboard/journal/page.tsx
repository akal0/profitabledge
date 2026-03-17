"use client";

import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JournalList } from "@/components/journal/journal-list";
import { JournalEntryPage } from "@/components/journal/journal-entry";
import { TemplateBrowser } from "@/components/journal/template-browser";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import { useAccountStore } from "@/stores/account";
import type { JournalBlock } from "@/components/journal/types";
import { JournalCalendarTab } from "@/components/journal/journal-calendar-tab";
import { JournalInsightsTab } from "@/components/journal/journal-insights-tab";
import { JournalWidgetFrame } from "@/components/journal/journal-widget-shell";
import { trpcOptions, trpc } from "@/utils/trpc";
import {
  journalActionButtonClassName,
  journalActionButtonMutedClassName,
} from "@/components/journal/action-button-styles";
import { toast } from "sonner";
import { FileText } from "lucide-react";

const JOURNAL_TABS = [
  "entries",
  "review-ready",
  "insights",
  "calendar",
] as const;
type JournalTab = (typeof JOURNAL_TABS)[number];
interface ReviewQueueItem {
  id: string;
  title: string;
  preview?: string;
  updatedAt: string | Date;
}

function isJournalTab(value: string | null): value is JournalTab {
  return value !== null && JOURNAL_TABS.includes(value as JournalTab);
}

function buildPromptBlocks(prompt: {
  title?: string;
  questions?: string[];
  triggerType?: string;
}): JournalBlock[] {
  const blocks: JournalBlock[] = [
    {
      id: crypto.randomUUID(),
      type: "heading2",
      content: prompt.title || "Prompt Reflection",
      children: [],
    },
  ];

  if (prompt.triggerType) {
    blocks.push({
      id: crypto.randomUUID(),
      type: "callout",
      content: `Prompt trigger: ${prompt.triggerType.replace(/_/g, " ")}`,
      props: {
        calloutEmoji: "🧠",
        calloutType: "note",
      },
      children: [],
    });
  }

  if (prompt.questions && prompt.questions.length > 0) {
    blocks.push({
      id: crypto.randomUUID(),
      type: "heading3",
      content: "Reflection prompts",
      children: [],
    });

    prompt.questions.forEach((question) => {
      blocks.push({
        id: crypto.randomUUID(),
        type: "bulletList",
        content: question,
        children: [],
      });
    });
  } else {
    blocks.push({
      id: crypto.randomUUID(),
      type: "paragraph",
      content:
        "Capture the reflection, trade context, and next-step adjustments here.",
      children: [],
    });
  }

  return blocks;
}

function JournalPageContent() {
  const { selectedAccountId: accountId } = useAccountStore();
  const router = useRouter();
  const pathname = usePathname();
  const safePathname = pathname ?? "/dashboard/journal";
  const searchParams = useSearchParams();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [initialContent, setInitialContent] = useState<JournalBlock[] | null>(
    null
  );
  const [initialTitle, setInitialTitle] = useState<string | null>(null);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const entryIdFromQuery = searchParams?.get("entryId") ?? null;
  const entryTypeFromQuery = searchParams?.get("entryType") ?? null;
  const activeTabValue = searchParams?.get("tab") ?? null;
  const requestedTab: JournalTab = isJournalTab(activeTabValue)
    ? activeTabValue
    : "entries";
  const forcedEntryType =
    entryTypeFromQuery &&
    [
      "general",
      "daily",
      "weekly",
      "monthly",
      "trade_review",
      "strategy",
      "comparison",
      "backtest",
    ].includes(entryTypeFromQuery)
      ? entryTypeFromQuery
      : undefined;
  const { data: billingState, isFetched: hasResolvedBillingState } = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const canAccessInsights = billingState?.admin?.isAdmin === true;
  const shouldHoldInsightsTab =
    requestedTab === "insights" && !hasResolvedBillingState;
  const activeTab: JournalTab =
    requestedTab === "insights" &&
    hasResolvedBillingState &&
    !canAccessInsights
      ? "entries"
      : requestedTab;
  const { data: reviewQueue } = useQuery({
    ...trpcOptions.journal.list.queryOptions({
      limit: 12,
      entryType: "trade_review",
      tags: ["trade-close-auto"],
      accountId: accountId || undefined,
    }),
    staleTime: 30000,
  });
  const reviewItems = React.useMemo(
    () => (reviewQueue as { items?: ReviewQueueItem[] } | undefined)?.items ?? [],
    [reviewQueue]
  );
  const completePromptMutation = trpc.journal.completePrompt.useMutation();
  const notifyPendingReviews =
    trpc.notifications.notifyPendingReviews.useMutation();
  const markTypeRead = trpc.notifications.markTypeRead.useMutation();
  const reviewNotifiedRef = useRef(false);
  const [reviewsViewed, setReviewsViewed] = useState(
    () => activeTab === "review-ready"
  );

  React.useEffect(() => {
    if (reviewNotifiedRef.current || reviewItems.length === 0) return;
    reviewNotifiedRef.current = true;

    const count = reviewItems.length;

    // If already on review-ready tab, skip toast and mark viewed
    if (activeTab === "review-ready") {
      setReviewsViewed(true);
      markTypeRead.mutate({ type: "post_exit_ready" });
      return;
    }

    // Toast for immediate visibility
    toast(`${count} trade review${count === 1 ? "" : "s"} waiting`, {
      description: "Open the Review Ready tab to reflect on recent trades.",
      icon: <FileText className="size-4 text-teal-400" />,
      duration: 6000,
      classNames: {
        toast: "bg-sidebar border-white/10 text-white",
        title: "text-white font-medium",
        description: "text-white/60",
      },
    });

    // Persistent notification (deduped per day)
    notifyPendingReviews.mutate({ count });
  }, [activeTab, markTypeRead, notifyPendingReviews, reviewItems]);

  React.useEffect(() => {
    if (!entryIdFromQuery) return;
    setSelectedEntryId((current) =>
      current === entryIdFromQuery ? current : entryIdFromQuery
    );
    setIsCreating(false);
  }, [entryIdFromQuery]);

  React.useEffect(() => {
    if (!hasResolvedBillingState || requestedTab !== "insights" || canAccessInsights) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("tab");
    const query = params.toString();
    router.replace(query ? `${safePathname}?${query}` : safePathname, {
      scroll: false,
    });
  }, [
    canAccessInsights,
    hasResolvedBillingState,
    requestedTab,
    router,
    safePathname,
    searchParams,
  ]);

  const clearEntryIdFromUrl = React.useCallback(() => {
    if (!searchParams?.get("entryId")) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("entryId");
    const query = params.toString();
    router.replace(query ? `${safePathname}?${query}` : safePathname, {
      scroll: false,
    });
  }, [router, safePathname, searchParams]);

  const handleTabChange = React.useCallback(
    (value: string) => {
      if (!isJournalTab(value)) {
        return;
      }

      if (value === "insights" && !canAccessInsights) {
        return;
      }

      // Mark review notifications as read and hide dot when opening the tab
      if (value === "review-ready") {
        setReviewsViewed(true);
        markTypeRead.mutate({ type: "post_exit_ready" });
      }

      const params = new URLSearchParams(searchParams?.toString() ?? "");

      if (value === "entries") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }

      const query = params.toString();
      router.replace(query ? `${safePathname}?${query}` : safePathname, {
        scroll: false,
      });
    },
    [canAccessInsights, router, safePathname, searchParams, markTypeRead]
  );

  // Handle template selection
  const handleSelectTemplate = (template: any) => {
    setActivePromptId(null);
    setInitialContent(template.content || []);
    setInitialTitle(template.name || "Untitled");
    setIsCreating(true);
  };

  // Handle starting blank entry
  const handleStartBlank = () => {
    setActivePromptId(null);
    setInitialContent(null);
    setInitialTitle(null);
    setIsCreating(true);
  };

  // Handle new entry button click
  const handleCreateEntry = () => {
    setActivePromptId(null);
    setShowTemplateBrowser(true);
  };

  const handleCreateFromPrompt = React.useCallback((prompt: any) => {
    setShowTemplateBrowser(false);
    setSelectedEntryId(null);
    setInitialContent(buildPromptBlocks(prompt));
    setInitialTitle(prompt?.title || "Prompt Reflection");
    setActivePromptId(prompt?.id || null);
    setIsCreating(true);
  }, []);

  // Reset state when going back
  const handleBack = () => {
    setSelectedEntryId(null);
    setIsCreating(false);
    setInitialContent(null);
    setInitialTitle(null);
    setActivePromptId(null);
    clearEntryIdFromUrl();
  };

  // Show entry editor if creating new or viewing existing
  if (isCreating || selectedEntryId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <JournalEntryPage
          key={selectedEntryId || "new-entry"}
          entryId={selectedEntryId || undefined}
          accountId={accountId || undefined}
          initialContent={initialContent || undefined}
          initialTitle={initialTitle || undefined}
          onBack={handleBack}
          onSave={(entry) => {
            setSelectedEntryId(entry.id || null);
            setIsCreating(false);
            setInitialContent(null);
            setInitialTitle(null);
            if (activePromptId && entry.id) {
              void completePromptMutation.mutateAsync({
                promptId: activePromptId,
                resultingEntryId: entry.id,
              });
            }
            setActivePromptId(null);
          }}
        />
      </div>
    );
  }

  if (shouldHoldInsightsTab) {
    return (
      <main className="flex min-h-0 flex-1">
        <RouteLoadingFallback route="journal" className="min-h-0" />
      </main>
    );
  }

  // Show journal list
  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 bg-background dark:bg-sidebar">
        <div className="overflow-x-auto px-4 sm:px-6 lg:px-8">
          <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
            <TabsTriggerUnderlined
              value="entries"
              className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              Entries
            </TabsTriggerUnderlined>
            <TabsTriggerUnderlined
              value="review-ready"
              className="h-10 gap-2 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              <span>Review ready</span>
              {reviewItems.length > 0 && !reviewsViewed && (
                <span className="size-1.5 rounded-full bg-teal-400" />
              )}
            </TabsTriggerUnderlined>
            {canAccessInsights ? (
              <TabsTriggerUnderlined
                value="insights"
                className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
              >
                Insights
              </TabsTriggerUnderlined>
            ) : null}
            <TabsTriggerUnderlined
              value="calendar"
              className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              Calendar
            </TabsTriggerUnderlined>
          </TabsListUnderlined>
        </div>
        <Separator />
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsContent
          value="entries"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <JournalList
            accountId={accountId || undefined}
            forceEntryType={forcedEntryType}
            onSelectEntry={(id) => setSelectedEntryId(id)}
            onCreateEntry={handleCreateEntry}
            className="min-h-0 flex-1"
          />
        </TabsContent>

        <TabsContent
          value="review-ready"
          className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8"
        >
          <JournalWidgetFrame
            className="min-h-full"
            header={
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">
                        Review ready
                      </h2>
                      <Badge className="bg-teal-500/15 text-teal-300 hover:bg-teal-500/15">
                        {reviewItems.length}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/50">
                      Auto-generated trade reviews waiting for your manual
                      reflection.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className={journalActionButtonClassName}
                      onClick={handleCreateEntry}
                    >
                      New Entry
                    </Button>
                    {reviewItems.length > 0 ? (
                      <Button
                        size="sm"
                        className={journalActionButtonMutedClassName}
                        onClick={() =>
                          setSelectedEntryId(reviewItems[0]?.id || null)
                        }
                      >
                        Open Latest
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            }
          >
            {reviewItems.length > 0 ? (
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {reviewItems.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntryId(entry.id)}
                    className="rounded-sm border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wide text-teal-300">
                        Trade Review
                      </span>
                      <span className="text-[11px] text-white/35">
                        {new Date(entry.updatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-white">
                      {entry.title}
                    </p>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/45">
                      {entry.preview ||
                        "Open the review to inspect execution, context, and next-step corrections."}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                  <p className="text-sm font-medium text-white">
                    No reviews waiting
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Auto-generated trade reviews will land here after qualifying
                    trade-close events.
                  </p>
                </div>
              </div>
            )}
          </JournalWidgetFrame>
        </TabsContent>

        {canAccessInsights ? (
          <TabsContent
            value="insights"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:px-8"
          >
            <JournalInsightsTab
              accountId={accountId || undefined}
              onCreateEntry={handleCreateEntry}
              onSelectEntry={(id) => setSelectedEntryId(id)}
              onCreateFromPrompt={handleCreateFromPrompt}
            />
          </TabsContent>
        ) : null}

        <TabsContent
          value="calendar"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:px-8"
        >
          <JournalCalendarTab
            accountId={accountId || undefined}
            onSelectEntry={(id) => setSelectedEntryId(id)}
          />
        </TabsContent>
      </main>

      {/* Template Browser Dialog */}
      <TemplateBrowser
        isOpen={showTemplateBrowser}
        onClose={() => setShowTemplateBrowser(false)}
        onSelectTemplate={handleSelectTemplate}
        onStartBlank={handleStartBlank}
      />
    </Tabs>
  );
}

export default function JournalPage() {
  return (
    <React.Suspense
      fallback={<RouteLoadingFallback route="journal" className="min-h-screen bg-background dark:bg-sidebar" />}
    >
      <JournalPageContent />
    </React.Suspense>
  );
}
