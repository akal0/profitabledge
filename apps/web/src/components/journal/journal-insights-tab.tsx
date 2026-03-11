"use client";

import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";
import { JournalInsightsPanel, PatternAnalysisCard } from "./ai-analysis-display";
import { JournalOverviewPanel } from "./journal-overview-panel";
import { PsychologyCorrelationChart } from "./psychology-correlation-chart";
import { JournalWidgetFrame } from "./journal-widget-shell";

interface JournalInsightsTabProps {
  accountId?: string;
  onCreateEntry: () => void;
  onSelectEntry: (entryId: string) => void;
  onCreateFromPrompt: (prompt: any) => void;
  className?: string;
}

export function JournalInsightsTab({
  accountId,
  onCreateEntry,
  onSelectEntry,
  onCreateFromPrompt,
  className,
}: JournalInsightsTabProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <JournalOverviewPanel
        accountId={accountId}
        onCreateEntry={onCreateEntry}
        onSelectEntry={onSelectEntry}
        onCreateFromPrompt={onCreateFromPrompt}
      />

      <JournalWidgetFrame
        header={
          <div className="p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Brain className="h-4 w-4 text-teal-300" />
              <span>Journal Insights</span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              Use the journal as a reflection engine: ask questions, surface repeat patterns, and connect psychology to outcomes.
            </p>
          </div>
        }
      >
        <div className="p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <JournalInsightsPanel />
            <PatternAnalysisCard />
          </div>
        </div>
      </JournalWidgetFrame>

      <PsychologyCorrelationChart accountId={accountId} />
    </div>
  );
}
