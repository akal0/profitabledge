"use client";

import React, { useState } from "react";
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
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import { useAccountStore } from "@/stores/account";
import type { JournalBlock } from "@/components/journal/types";
import { JournalCalendarTab } from "@/components/journal/journal-calendar-tab";
import { JournalInsightsTab } from "@/components/journal/journal-insights-tab";
import { JournalSharesTab } from "@/components/journal/share/shares-tab";
import { trpcOptions, trpc } from "@/utils/trpc";

const JOURNAL_TABS = [
  "entries",
  "insights",
  "calendar",
  "shares",
] as const;
type JournalTab = (typeof JOURNAL_TABS)[number];

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
      "edge",
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
    requestedTab === "insights" && hasResolvedBillingState && !canAccessInsights
      ? "entries"
      : requestedTab;
  const completePromptMutation = trpc.journal.completePrompt.useMutation();

  React.useEffect(() => {
    if (!entryIdFromQuery) return;
    setSelectedEntryId((current) =>
      current === entryIdFromQuery ? current : entryIdFromQuery
    );
    setIsCreating(false);
  }, [entryIdFromQuery]);

  React.useEffect(() => {
    if (
      !hasResolvedBillingState ||
      requestedTab !== "insights" ||
      canAccessInsights
    ) {
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
    [canAccessInsights, router, safePathname, searchParams]
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
        <div className="overflow-x-auto px-4 sm:px-6 lg:px-7">
          <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
            <TabsTriggerUnderlined
              value="entries"
              className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              Entries
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
            <TabsTriggerUnderlined
              value="shares"
              className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              Shares
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
          className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8"
        >
          <JournalCalendarTab
            accountId={accountId || undefined}
            onSelectEntry={(id) => setSelectedEntryId(id)}
            className="h-full"
          />
        </TabsContent>

        <TabsContent
          value="shares"
          className="mt-0 flex min-h-0 flex-1 overflow-hidden"
        >
          <JournalSharesTab accountId={accountId || undefined} />
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
      fallback={
        <RouteLoadingFallback
          route="journal"
          className="min-h-screen bg-background dark:bg-sidebar"
        />
      }
    >
      <JournalPageContent />
    </React.Suspense>
  );
}
