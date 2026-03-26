"use client";

import { WidgetBlockRenderer } from "@/components/ai/widget-block-renderer";
import {
  AssistantGenericSummaryWidgets,
  AssistantQuickSummaryWidgets,
} from "@/components/ai/assistant-insight-widgets";
import { GoalContentSeparator, GoalSurface } from "@/components/goals/goal-surface";
import { Response } from "@/components/ui/shadcn-io/ai/response";
import type { AnalysisBlock, VizSpec } from "@/types/assistant-stream";
import {
  decorateMentions,
  formatCurrencyNumbers,
  sentenceCase,
  splitMarkdownSections,
} from "@/features/ai/premium-assistant/lib/premium-assistant-formatting";

function AssistantMessageCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col rounded-sm border border-white/5 bg-sidebar p-1">
      <div className="flex w-full items-start justify-between gap-3 px-3.5 py-2">
        <h2 className="text-sm font-medium text-white/50">Your assistant</h2>
      </div>
      <div className="flex h-full w-full flex-col rounded-sm bg-white transition-all duration-150 dark:bg-sidebar-accent dark:hover:brightness-120">
        <div className="flex h-full flex-col p-3.5 text-white">{children}</div>
      </div>
    </div>
  );
}

export function PremiumAssistantResponseCards({
  content,
  analysisBlocks = [],
  visualization,
  accountId,
  onViewTrades,
}: {
  content: string;
  analysisBlocks?: AnalysisBlock[];
  visualization?: VizSpec;
  accountId?: string;
  onViewTrades?: (tradeIds: string[]) => void;
}) {
  const profileBlock = analysisBlocks.find(
    (block): block is Extract<AnalysisBlock, { type: "profileSummary" }> =>
      block.type === "profileSummary"
  );
  const edgeConditionsBlock = analysisBlocks.find(
    (block): block is Extract<AnalysisBlock, { type: "edgeConditions" }> =>
      block.type === "edgeConditions"
  );
  const visualizationBlock = analysisBlocks.find(
    (block): block is Extract<AnalysisBlock, { type: "visualization" }> =>
      block.type === "visualization"
  );
  const effectiveVisualization = visualization ?? visualizationBlock?.viz;
  const excludedTitles = new Set(
    [
      profileBlock ? "your trading profile" : null,
      profileBlock ? "money left on the table" : null,
      edgeConditionsBlock ? "your edges" : null,
      edgeConditionsBlock ? "your leaks" : null,
      edgeConditionsBlock ? "your edge & leak conditions" : null,
    ].filter(Boolean) as string[]
  );
  const sections = splitMarkdownSections(content).filter(
    (section) => !excludedTitles.has(section.title.trim().toLowerCase())
  );
  const introSectionIndex = sections.findIndex(
    (section) =>
      section.title.trim().toLowerCase() === "response" && section.body.trim()
  );
  const introSection =
    introSectionIndex >= 0 ? sections[introSectionIndex] : null;
  const standaloneSections = sections.filter(
    (_, index) => index !== introSectionIndex
  );

  if (
    !content.trim() &&
    analysisBlocks.length === 0 &&
    !profileBlock &&
    !edgeConditionsBlock &&
    !effectiveVisualization
  ) {
    return null;
  }

  if (sections.length === 0) {
    if (
      !profileBlock &&
      !edgeConditionsBlock &&
      analysisBlocks.length === 0 &&
      !effectiveVisualization
    ) {
      return (
        <Response parseIncompleteMarkdown={false}>
          {decorateMentions(formatCurrencyNumbers(content))}
        </Response>
      );
    }
  }

  const summaryWidgets = profileBlock || edgeConditionsBlock ? (
    <AssistantQuickSummaryWidgets
      profile={profileBlock?.profile || null}
      edgeConditions={
        edgeConditionsBlock
          ? {
              edges: edgeConditionsBlock.edges,
              leaks: edgeConditionsBlock.leaks,
            }
          : null
      }
    />
  ) : analysisBlocks.length > 0 || effectiveVisualization ? (
    <AssistantGenericSummaryWidgets
      analysisBlocks={analysisBlocks}
      visualization={effectiveVisualization}
    />
  ) : null;

  const bubbleBody = introSection?.body?.trim();
  const shouldRenderBubble = Boolean(
    bubbleBody ||
      (!summaryWidgets &&
        standaloneSections.length === 0 &&
        !effectiveVisualization &&
        content.trim())
  );

  return (
    <div className="w-full space-y-4">
      {shouldRenderBubble ? (
        <AssistantMessageCard>
          <Response parseIncompleteMarkdown={false}>
            {decorateMentions(
              formatCurrencyNumbers(bubbleBody || content)
            )}
          </Response>
        </AssistantMessageCard>
      ) : null}
      {summaryWidgets}
      <div className="w-full space-y-4">
        {standaloneSections.map((section, idx) => (
          <GoalSurface key={`${section.title}-${idx}`} className="overflow-hidden">
            <div className="px-3.5 py-2">
              <h2 className="text-sm font-medium text-white/60">
                {sentenceCase(section.title)}
              </h2>
            </div>
            <GoalContentSeparator />
            <div className="px-3.5 py-3.5 text-white">
              <Response parseIncompleteMarkdown={false}>
                {decorateMentions(formatCurrencyNumbers(section.body))}
              </Response>
            </div>
          </GoalSurface>
        ))}
        {effectiveVisualization ? (
          <WidgetBlockRenderer
            viz={effectiveVisualization}
            accountId={accountId}
            onViewTrades={onViewTrades}
          />
        ) : null}
      </div>
    </div>
  );
}
