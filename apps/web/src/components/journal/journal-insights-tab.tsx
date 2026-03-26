"use client";

import { cn } from "@/lib/utils";
import { Activity, Brain, Sparkles } from "lucide-react";
import { JournalInsightsPanel, PatternAnalysisCard } from "./ai-analysis-display";
import { JournalOverviewPanel } from "./journal-overview-panel";
import { PsychologyCorrelationChart } from "./psychology-correlation-chart";
import { JournalInsightsSectionHeader } from "./journal-insights-shell";

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
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4 pb-4", className)}>
      <JournalInsightsSectionHeader
        icon={Sparkles}
        label="Workflow"
        count={2}
      />
      <JournalOverviewPanel
        accountId={accountId}
        onCreateEntry={onCreateEntry}
        onSelectEntry={onSelectEntry}
        onCreateFromPrompt={onCreateFromPrompt}
      />

      <JournalInsightsSectionHeader
        icon={Brain}
        label="Journal intelligence"
        count={2}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <JournalInsightsPanel accountId={accountId} />
        <PatternAnalysisCard accountId={accountId} />
      </div>

      <JournalInsightsSectionHeader
        icon={Activity}
        label="Psychology & performance"
        count={1}
      />
      <PsychologyCorrelationChart accountId={accountId} />
    </div>
  );
}
