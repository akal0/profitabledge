"use client";

import { format } from "date-fns";
import { Copy, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type BacktestTimeframe,
  type MonteCarloResult,
  type ReplayMistake,
  type ReplayPatternMatch,
  type ReplayPatternTemplate,
  type ReplaySharedSnapshot,
  type ReplayTimelineEvent,
  type ReviewPlaybackMode,
  type RuleSetOption,
  type RulebookCoachingResult,
} from "@/features/backtest/replay/lib/replay-domain";
import {
  formatHoldTime,
  formatPrice,
  formatSignedCurrency,
  getTimeframeCompactLabel,
} from "@/features/backtest/replay/lib/replay-utils";
import { cn } from "@/lib/utils";

type ReplayScoreExplainer = {
  label: string;
  value: string;
  helper: string;
};

type ReplayComparisonSummary = {
  count: number;
  avgRR: number;
  avgHold: number;
  avgRisk: number;
};

type ReplayComparison = {
  label: string;
  leftLabel: string;
  rightLabel: string;
  left: ReplayComparisonSummary;
  right: ReplayComparisonSummary;
};

type ReplayBucketSummary = {
  label: string;
  count: number;
  totalPnl: number;
  winRate: number;
  avgRR: number;
};

type ReplayExecutionEnvironment = {
  spread: number;
  slippagePips: number;
  commissionPerLot: number;
  sessionLabel: string;
};

type ReplayReviewTabProps = {
  scoreExplainers: ReplayScoreExplainer[];
  scoreNarrative: string;
  reviewPlaybackMode: ReviewPlaybackMode;
  isReviewPlaybackRunning: boolean;
  onToggleWalkthrough: () => void;
  onStepReviewEvent: () => void;
  onResumeFromMistake: (mistakeId?: string) => void;
  hasReplayMistakes: boolean;
  onSaveCurrentPattern: () => void;
  onCreateSharedSnapshot: () => void;
  hasCurrentCandle: boolean;
  reviewComparisons: ReplayComparison[];
  timelineEvents: ReplayTimelineEvent[];
  reviewEventId: string | null;
  onJumpToTimelineEvent: (eventId: string) => void;
  isLoadingRulebook: boolean;
  linkedRuleSetId: string | null;
  onLinkedRuleSetChange: (value: string | null) => void;
  ruleSets: RuleSetOption[];
  rulebookCoaching: RulebookCoachingResult | null;
  bestWorstSelf: {
    best: ReplayBucketSummary[];
    worst: ReplayBucketSummary[];
  };
  patternLibrary: ReplayPatternTemplate[];
  selectedPatternId: string | null;
  onSelectedPatternChange: (value: string) => void;
  patternMatches: ReplayPatternMatch[];
  onJumpToPatternMatch: (timeUnix: number) => void;
  sharedSnapshots: ReplaySharedSnapshot[];
  selectedSharedSnapshotId: string | null;
  onApplySharedSnapshot: (snapshotId: string) => void;
  onCopySharedSnapshotLink: (snapshotId: string) => void;
  replayMistakes: ReplayMistake[];
  sessionId: string | null;
  onRunMonteCarlo: () => void;
  isRunningMonteCarlo: boolean;
  monteCarloResult: MonteCarloResult | null;
  executionEnvironment: ReplayExecutionEnvironment;
  symbol: string;
  intrabarMode: "candle-path" | "bar-magnifier";
  barMagnifierTimeframe: BacktestTimeframe | null;
};

export function ReplayReviewTab({
  scoreExplainers,
  scoreNarrative,
  reviewPlaybackMode,
  isReviewPlaybackRunning,
  onToggleWalkthrough,
  onStepReviewEvent,
  onResumeFromMistake,
  hasReplayMistakes,
  onSaveCurrentPattern,
  onCreateSharedSnapshot,
  hasCurrentCandle,
  reviewComparisons,
  timelineEvents,
  reviewEventId,
  onJumpToTimelineEvent,
  isLoadingRulebook,
  linkedRuleSetId,
  onLinkedRuleSetChange,
  ruleSets,
  rulebookCoaching,
  bestWorstSelf,
  patternLibrary,
  selectedPatternId,
  onSelectedPatternChange,
  patternMatches,
  onJumpToPatternMatch,
  sharedSnapshots,
  selectedSharedSnapshotId,
  onApplySharedSnapshot,
  onCopySharedSnapshotLink,
  replayMistakes,
  sessionId,
  onRunMonteCarlo,
  isRunningMonteCarlo,
  monteCarloResult,
  executionEnvironment,
  symbol,
  intrabarMode,
  barMagnifierTimeframe,
}: ReplayReviewTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {scoreExplainers.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
              <p className="mt-2 text-xs text-white/45">{item.helper}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Review coach</h3>
              <p className="mt-1 text-xs text-white/45">{scoreNarrative}</p>
            </div>
            <Badge variant="outline" className="border-white/5 bg-sidebar text-white/65">
              {reviewPlaybackMode === "events" ? "Event walkthrough" : "Manual review"}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onToggleWalkthrough}
              disabled={timelineEvents.filter((event) => event.type !== "checkpoint").length === 0}
            >
              {isReviewPlaybackRunning ? "Pause walkthrough" : "Play walkthrough"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onStepReviewEvent}
              disabled={timelineEvents.filter((event) => event.type !== "checkpoint").length === 0}
            >
              Next event
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={() => onResumeFromMistake()}
              disabled={!hasReplayMistakes}
            >
              Resume before mistake
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onSaveCurrentPattern}
              disabled={!hasCurrentCandle}
            >
              Save pattern
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onCreateSharedSnapshot}
              disabled={!hasCurrentCandle}
            >
              Freeze snapshot
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {reviewComparisons.map((comparison) => (
            <div key={comparison.label} className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{comparison.label}</h3>
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">Compare</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: comparison.leftLabel, summary: comparison.left },
                  { label: comparison.rightLabel, summary: comparison.right },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/35">{item.label}</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Trades</span>
                        <span className="text-white">{item.summary.count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Avg R</span>
                        <span className="text-white">{item.summary.avgRR.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Avg hold</span>
                        <span className="text-white">{formatHoldTime(item.summary.avgHold)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/45">Avg risk</span>
                        <span className="text-white">{item.summary.avgRisk.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Replay timeline</h3>
              <p className="mt-1 text-xs text-white/45">
                Jump through checkpoints, fills, exits, drawdown stress, and news.
              </p>
            </div>
            <Select value={reviewEventId ?? undefined} onValueChange={onJumpToTimelineEvent}>
              <SelectTrigger className="h-9 w-[220px] rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent">
                <SelectValue placeholder="Jump to event" />
              </SelectTrigger>
              <SelectContent>
                {timelineEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {format(new Date(event.timeUnix * 1000), "MMM d HH:mm")} · {event.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
            {timelineEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onJumpToTimelineEvent(event.id)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition",
                  reviewEventId === event.id
                    ? "border-teal-400/50 bg-sidebar text-white"
                    : "border-white/5 bg-sidebar-accent/30 text-white/75 hover:bg-sidebar hover:text-white"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="mt-1 text-xs text-white/45">{event.helper}</p>
                </div>
                <span className="shrink-0 text-[11px] text-white/45">
                  {format(new Date(event.timeUnix * 1000), "HH:mm")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Rulebook-linked coaching</h3>
              <p className="mt-1 text-xs text-white/45">
                Evaluate replay trades against your live rule set instead of generic standards.
              </p>
            </div>
            {isLoadingRulebook ? <Loader2 className="size-4 animate-spin text-white/35" /> : null}
          </div>

          <div className="mt-4">
            <Select
              value={linkedRuleSetId ?? "__none"}
              onValueChange={(value) => onLinkedRuleSetChange(value === "__none" ? null : value)}
            >
              <SelectTrigger className="h-10 border-white/5 bg-sidebar text-sm text-white">
                <SelectValue placeholder="Select a rule set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No linked rulebook</SelectItem>
                {ruleSets.map((ruleSet) => (
                  <SelectItem key={ruleSet.id} value={ruleSet.id}>
                    {ruleSet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {linkedRuleSetId && rulebookCoaching?.summary ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">Compliance</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {rulebookCoaching.summary.complianceRate}%
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {rulebookCoaching.summary.passCount}/{rulebookCoaching.summary.totalTrades} trades passed clean.
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">Average score</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {rulebookCoaching.summary.averageScore}/100
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {rulebookCoaching.summary.failCount} hard fails, {rulebookCoaching.summary.partialCount} partials.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/35">Top violations</p>
                <div className="mt-3 space-y-2">
                  {rulebookCoaching.summary.topViolations.length ? (
                    rulebookCoaching.summary.topViolations.map((item) => (
                      <div key={item.violation} className="flex items-center justify-between text-sm">
                        <span className="text-white/75">{item.violation}</span>
                        <span className="text-white/45">{item.count}x</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/45">No violations flagged yet.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
              {ruleSets.length
                ? "Select a rule set to score the replay against your own Edge."
                : "No rule sets found yet. Create one in settings to unlock rulebook coaching."}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <h3 className="text-sm font-semibold text-white">Best self / worst self</h3>
          <p className="mt-1 text-xs text-white/45">
            Buckets with at least two trades, ranked by realized P&amp;L.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/35">Best self</p>
              <div className="mt-3 space-y-2">
                {bestWorstSelf.best.length ? (
                  bestWorstSelf.best.map((bucket) => (
                    <div key={bucket.label} className="rounded-lg border border-white/5 bg-sidebar-accent/40 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{bucket.label}</span>
                        <span className="text-sm text-teal-300">{formatSignedCurrency(bucket.totalPnl)}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        {bucket.count} trades · {bucket.winRate.toFixed(0)}% win rate · {bucket.avgRR.toFixed(2)}R average
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/45">Not enough trades to rank a strong edge bucket yet.</div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/5 bg-sidebar px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/35">Worst self</p>
              <div className="mt-3 space-y-2">
                {bestWorstSelf.worst.length ? (
                  bestWorstSelf.worst.map((bucket) => (
                    <div key={bucket.label} className="rounded-lg border border-white/5 bg-sidebar-accent/40 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{bucket.label}</span>
                        <span className="text-sm text-rose-300">{formatSignedCurrency(bucket.totalPnl)}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        {bucket.count} trades · {bucket.winRate.toFixed(0)}% win rate · {bucket.avgRR.toFixed(2)}R average
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/45">Not enough trades to isolate a weak behavior bucket yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Pattern library</h3>
              <p className="mt-1 text-xs text-white/45">
                Save replay setups and jump to similar structures from the current session.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onSaveCurrentPattern}
              disabled={!hasCurrentCandle}
            >
              Save current
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {patternLibrary.length ? (
              patternLibrary.slice(0, 6).map((pattern) => {
                const isActive = selectedPatternId === pattern.id;
                return (
                  <button
                    key={pattern.id}
                    type="button"
                    onClick={() => onSelectedPatternChange(pattern.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition",
                      isActive
                        ? "border-teal-400/50 bg-sidebar text-white"
                        : "border-white/5 bg-sidebar hover:bg-sidebar-accent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{pattern.name}</p>
                      <span className="text-[11px] text-white/45">{pattern.featureVector.direction}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {pattern.featureVector.rangePips.toFixed(1)} pip range · impulse{" "}
                      {pattern.featureVector.impulsePips.toFixed(1)} pips
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                Save a replay moment to start building your pattern library.
              </div>
            )}
          </div>

          {patternMatches.length ? (
            <div className="mt-4 rounded-xl border border-white/5 bg-sidebar px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/35">Closest matches</p>
              <div className="mt-3 space-y-2">
                {patternMatches.map((match) => (
                  <button
                    key={`${match.patternId}-${match.timeUnix}`}
                    type="button"
                    onClick={() => onJumpToPatternMatch(match.timeUnix)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-sidebar-accent/40 px-3 py-2 text-left text-sm transition hover:bg-sidebar-accent"
                  >
                    <span className="text-white/75">
                      {format(new Date(match.timeUnix * 1000), "MMM d HH:mm")}
                    </span>
                    <span className="text-teal-300">{Math.round(match.score * 100)}%</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Replay snapshots</h3>
              <p className="mt-1 text-xs text-white/45">
                Freeze the chart, drawings, and context at a candle for mentor or self-review.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onCreateSharedSnapshot}
              disabled={!hasCurrentCandle}
            >
              Save snapshot
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {sharedSnapshots.length ? (
              sharedSnapshots.slice(0, 6).map((snapshot) => (
                <div
                  key={snapshot.id}
                  className={cn(
                    "rounded-xl border px-3 py-3",
                    selectedSharedSnapshotId === snapshot.id
                      ? "border-teal-400/50 bg-sidebar"
                      : "border-white/5 bg-sidebar"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => onApplySharedSnapshot(snapshot.id)} className="text-left">
                      <p className="text-sm font-medium text-white">{snapshot.label}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {snapshot.selectedContextTimeframes.length
                          ? `Context ${snapshot.selectedContextTimeframes.map(getTimeframeCompactLabel).join(", ")}`
                          : "No extra context panes"}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                      onClick={() => onCopySharedSnapshotLink(snapshot.id)}
                    >
                      <Copy className="mr-1 size-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                Save a snapshot to create a frozen replay review link.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <h3 className="text-sm font-semibold text-white">Mistake clustering</h3>
          <p className="mt-1 text-xs text-white/45">
            Auto-detected execution and process leaks from the replay session.
          </p>

          <div className="mt-4 space-y-2">
            {replayMistakes.length ? (
              replayMistakes.map((mistake) => (
                <button
                  key={mistake.id}
                  type="button"
                  onClick={() => onJumpToTimelineEvent(mistake.id)}
                  className="w-full rounded-xl border border-white/5 bg-sidebar px-3 py-3 text-left transition hover:bg-sidebar-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{mistake.title}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-white/5 bg-sidebar text-white/65",
                        mistake.severity === "high" && "text-rose-300",
                        mistake.severity === "medium" && "text-amber-300"
                      )}
                    >
                      {mistake.severity}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-white/45">{mistake.detail}</p>
                  <div className="mt-3">
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        onResumeFromMistake(mistake.id);
                      }}
                      className="inline-flex cursor-pointer items-center rounded-md border border-white/5 bg-sidebar-accent px-2 py-1 text-[11px] text-white/65 transition hover:bg-sidebar hover:text-white"
                    >
                      Resume drill
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                No obvious process leaks detected yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Monte Carlo</h3>
              <p className="mt-1 text-xs text-white/45">
                Stress test expectancy and drawdown across randomized trade sequences.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent"
              onClick={onRunMonteCarlo}
              disabled={!sessionId || isRunningMonteCarlo}
            >
              {isRunningMonteCarlo ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              Run
            </Button>
          </div>

          {monteCarloResult ? (
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/45">Median finish</span>
                <span className="text-white">${monteCarloResult.finalEquity.p50.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Profitable paths</span>
                <span className="text-white">{monteCarloResult.probabilities.profitableAfter.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Drawdown &gt; 20%</span>
                <span className="text-white">{monteCarloResult.probabilities.drawdownExceeds20.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Kelly / half Kelly</span>
                <span className="text-white">
                  {monteCarloResult.kellyCriterion.toFixed(2)}% / {monteCarloResult.halfKelly.toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
              Run a simulation once you want a probabilistic view of the session edge.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
          <h3 className="text-sm font-semibold text-white">Execution environment</h3>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/45">Spread model</span>
              <span className="text-white">{formatPrice(symbol, executionEnvironment.spread)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/45">Slippage model</span>
              <span className="text-white">{executionEnvironment.slippagePips.toFixed(2)} pips</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/45">Commission</span>
              <span className="text-white">${executionEnvironment.commissionPerLot.toFixed(2)} / lot</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/45">Liquidity regime</span>
              <span className="text-white">{executionEnvironment.sessionLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/45">Intrabar mode</span>
              <span className="text-white">
                {intrabarMode === "bar-magnifier"
                  ? `Bar magnifier${barMagnifierTimeframe ? ` · ${getTimeframeCompactLabel(barMagnifierTimeframe)}` : ""}`
                  : "Candle path"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
