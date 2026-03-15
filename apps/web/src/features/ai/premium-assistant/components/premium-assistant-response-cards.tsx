"use client";

import { Response } from "@/components/ui/shadcn-io/ai/response";
import {
  decorateMentions,
  sentenceCase,
  splitMarkdownSections,
} from "@/features/ai/premium-assistant/lib/premium-assistant-formatting";

export function PremiumAssistantResponseCards({
  content,
}: {
  content: string;
}) {
  const sections = splitMarkdownSections(content);
  if (sections.length === 0) {
    return (
      <Response parseIncompleteMarkdown={false}>
        {decorateMentions(content)}
      </Response>
    );
  }

  return (
    <div className="w-full space-y-4">
      {sections.map((section, idx) => (
        <div
          key={`${section.title}-${idx}`}
          className="group flex h-full w-full flex-col rounded-sm border border-white/5 bg-sidebar p-1"
        >
          <div className="flex w-full items-start justify-between gap-3 px-3.5 py-2">
            <h2 className="text-sm font-medium text-white/50">
              <span className="normal-case">{sentenceCase(section.title)}</span>
            </h2>
          </div>
          <div className="flex h-full w-full flex-col rounded-sm bg-white transition-all duration-150 dark:bg-sidebar-accent dark:hover:brightness-120">
            <div className="flex h-full flex-col p-3.5 text-white">
              <Response parseIncompleteMarkdown={false}>
                {decorateMentions(section.body)}
              </Response>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
