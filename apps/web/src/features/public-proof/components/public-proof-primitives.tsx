"use client";

import type { LucideIcon } from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { JournalEditorStyles } from "@/components/journal/editor/journal-editor-styles";
import { cn } from "@/lib/utils";

export function PublicProofMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  iconClassName = "text-white/50",
  valueClassName = "text-white",
  railClassName = "bg-white/25",
  className,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  railClassName?: string;
  className?: string;
}) {
  return (
    <GoalSurface className={cn("w-full h-full overflow-hidden", className)}>
      <div className="flex h-full min-h-0 flex-col p-3.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <p className={cn("text-2xl font-semibold tracking-tight", valueClassName)}>
            {value}
          </p>
          <p className="mt-1 text-xs leading-4 text-white/40">{detail}</p>

          <div className="mt-3 h-1.5 rounded-full bg-white/8 relative overflow-hidden">
            <div className={cn("h-full w-full", railClassName)} />
          </div>
        </div>
      </div>
    </GoalSurface>
  );
}

export function PublicProofHtmlPreview({
  html,
  emptyLabel,
}: {
  html?: string | null;
  emptyLabel: string;
}) {
  if (!html?.trim()) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-sm border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/45">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/8 bg-white/[0.03] px-5 py-4">
      <div className="journal-editor" data-compact="true">
        <JournalEditorStyles />
        <article
          className="journal-editor-content focus:outline-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
