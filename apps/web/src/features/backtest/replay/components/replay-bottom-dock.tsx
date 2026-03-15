"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeskMetric } from "@/features/backtest/replay/components/replay-primitives";
import { ReplayReviewTab } from "@/features/backtest/replay/components/replay-review-tab";
import {
  type BacktestPendingOrder,
  type BacktestTimeframe,
  type BacktestTrade,
  type MonteCarloResult,
  type ReplayMistake,
  type ReplayPatternMatch,
  type ReplayPatternTemplate,
  type ReplaySharedSnapshot,
  type ReplayTimelineEvent,
  type ReviewPlaybackMode,
  type RuleSetOption,
  type RulebookCoachingResult,
  type WorkspaceTab,
} from "@/features/backtest/replay/lib/replay-domain";
import {
  formatPrice,
  formatSignedCurrency,
  formatSignedPips,
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

type ReplayBottomDockProps = {
  workspaceTab: WorkspaceTab;
  onWorkspaceTabChange: (value: WorkspaceTab) => void;
  cashBalance: number;
  equity: number;
  realizedPnL: number;
  openPnL: number;
  openRisk: number;
  challengeStateLabel: string;
  challengeHelper: string;
  onClose: () => void;
  openTrades: BacktestTrade[];
  replayPendingOrders: BacktestPendingOrder[];
  symbol: string;
  currentPrice: number;
  closedTrades: BacktestTrade[];
  scoreExplainers: ReplayScoreExplainer[];
  scoreNarrative: string;
  reviewPlaybackMode: ReviewPlaybackMode;
  isReviewPlaybackRunning: boolean;
  onToggleWalkthrough: () => void;
  onStepReviewEvent: () => void;
  onResumeFromMistake: (mistakeId?: string) => void;
  hasCurrentCandle: boolean;
  onSaveCurrentPattern: () => void;
  onCreateSharedSnapshot: () => void;
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
  intrabarMode: "candle-path" | "bar-magnifier";
  barMagnifierTimeframe: BacktestTimeframe | null;
};

export function ReplayBottomDock({
  workspaceTab,
  onWorkspaceTabChange,
  cashBalance,
  equity,
  realizedPnL,
  openPnL,
  openRisk,
  challengeStateLabel,
  challengeHelper,
  onClose,
  openTrades,
  replayPendingOrders,
  symbol,
  currentPrice,
  closedTrades,
  scoreExplainers,
  scoreNarrative,
  reviewPlaybackMode,
  isReviewPlaybackRunning,
  onToggleWalkthrough,
  onStepReviewEvent,
  onResumeFromMistake,
  hasCurrentCandle,
  onSaveCurrentPattern,
  onCreateSharedSnapshot,
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
  intrabarMode,
  barMagnifierTimeframe,
}: ReplayBottomDockProps) {
  return (
    <Tabs
      value={workspaceTab}
      onValueChange={(value) => onWorkspaceTabChange(value as WorkspaceTab)}
      className="flex h-[300px] flex-col bg-sidebar"
    >
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-sidebar-accent px-3 py-2">
            <Badge className="bg-teal-400 text-slate-950">Backtesting</Badge>
          </div>
          <DeskMetric label="Account balance" value={`$${cashBalance.toFixed(2)}`} />
          <DeskMetric label="Equity" value={`$${equity.toFixed(2)}`} />
          <DeskMetric label="Realized P&L" value={formatSignedCurrency(realizedPnL)} />
          <DeskMetric label="Unrealized P&L" value={formatSignedCurrency(openPnL)} />
          <DeskMetric label="Open risk" value={`$${openRisk.toFixed(2)}`} />
          <DeskMetric label="Challenge" value={`${challengeStateLabel} · ${challengeHelper}`} />
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 rounded-md px-3 text-sm text-white/60 hover:bg-sidebar-accent hover:text-white"
            onClick={onClose}
          >
            Close Dock
          </Button>
        </div>

        <TabsList className="mt-3 h-auto bg-transparent p-0">
          <div className="flex items-center gap-6">
            <TabsTrigger value="positions" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-sm text-white/50 data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
              Positions
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-sm text-white/50 data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
              Order History
            </TabsTrigger>
            <TabsTrigger value="review" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-sm text-white/50 data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
              Review
            </TabsTrigger>
          </div>
        </TabsList>
      </div>

      <TabsContent value="positions" className="mt-0 flex-1 overflow-auto px-4 py-4">
        {!openTrades.length ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-white/45">
            <p className="text-base font-medium text-white">
              There are no open positions in this backtest session.
            </p>
            <p className="mt-2 text-sm">
              {replayPendingOrders.length
                ? `${replayPendingOrders.length} pending order${replayPendingOrders.length === 1 ? "" : "s"} waiting on chart.`
                : "Use the order ticket to place the next trade or continue replaying."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-white/75">
            <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
              <tr>
                <th className="pb-3 font-medium">Symbol</th>
                <th className="pb-3 font-medium">Side</th>
                <th className="pb-3 font-medium">Qty</th>
                <th className="pb-3 font-medium">Avg Fill Price</th>
                <th className="pb-3 font-medium">Take Profit</th>
                <th className="pb-3 font-medium">Stop Loss</th>
                <th className="pb-3 font-medium">Last Price</th>
                <th className="pb-3 font-medium">Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map((trade) => (
                <tr key={trade.id} className="border-t border-white/5">
                  <td className="py-3 font-medium text-white">{symbol}</td>
                  <td className="py-3">{trade.direction === "long" ? "Buy" : "Sell"}</td>
                  <td className="py-3">{Math.round(trade.volume * 100000).toLocaleString()}</td>
                  <td className="py-3">{formatPrice(symbol, trade.entryPrice)}</td>
                  <td className="py-3">{trade.tp ? formatPrice(symbol, trade.tp) : "-"}</td>
                  <td className="py-3">{trade.sl ? formatPrice(symbol, trade.sl) : "-"}</td>
                  <td className="py-3">{formatPrice(symbol, currentPrice || trade.entryPrice)}</td>
                  <td className={cn("py-3 font-medium", (trade.pnl || 0) >= 0 ? "text-teal-300" : "text-rose-300")}>
                    {formatSignedCurrency(trade.pnl || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-0 flex-1 overflow-auto px-4 py-4">
        {!closedTrades.length ? (
          <div className="rounded-2xl border border-dashed border-white/5 bg-sidebar-accent/50 px-5 py-6 text-sm text-white/45">
            No closed trades yet.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-white/75">
            <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
              <tr>
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Side</th>
                <th className="pb-3 font-medium">Entry</th>
                <th className="pb-3 font-medium">Exit</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Pips</th>
                <th className="pb-3 font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {[...closedTrades].reverse().map((trade) => (
                <tr key={trade.id} className="border-t border-white/5">
                  <td className="py-3 text-white/45">
                    {trade.exitTime ? format(new Date((trade.exitTime as number) * 1000), "MMM d HH:mm") : "-"}
                  </td>
                  <td className="py-3 font-medium text-white">{trade.direction === "long" ? "Buy" : "Sell"}</td>
                  <td className="py-3">{formatPrice(symbol, trade.entryPrice)}</td>
                  <td className="py-3">{trade.exitPrice ? formatPrice(symbol, trade.exitPrice) : "-"}</td>
                  <td className="py-3 capitalize">{trade.exitType || "manual"}</td>
                  <td className={cn("py-3", (trade.pnlPips || 0) >= 0 ? "text-teal-300" : "text-rose-300")}>
                    {formatSignedPips(trade.pnlPips || 0)}
                  </td>
                  <td className={cn("py-3 font-medium", (trade.pnl || 0) >= 0 ? "text-teal-300" : "text-rose-300")}>
                    {formatSignedCurrency(trade.pnl || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>

      <TabsContent value="review" className="mt-0 flex-1 overflow-auto px-4 py-4">
        <ReplayReviewTab
          scoreExplainers={scoreExplainers}
          scoreNarrative={scoreNarrative}
          reviewPlaybackMode={reviewPlaybackMode}
          isReviewPlaybackRunning={isReviewPlaybackRunning}
          onToggleWalkthrough={onToggleWalkthrough}
          onStepReviewEvent={onStepReviewEvent}
          onResumeFromMistake={onResumeFromMistake}
          hasReplayMistakes={replayMistakes.length > 0}
          onSaveCurrentPattern={onSaveCurrentPattern}
          onCreateSharedSnapshot={onCreateSharedSnapshot}
          hasCurrentCandle={hasCurrentCandle}
          reviewComparisons={reviewComparisons}
          timelineEvents={timelineEvents}
          reviewEventId={reviewEventId}
          onJumpToTimelineEvent={onJumpToTimelineEvent}
          isLoadingRulebook={isLoadingRulebook}
          linkedRuleSetId={linkedRuleSetId}
          onLinkedRuleSetChange={onLinkedRuleSetChange}
          ruleSets={ruleSets}
          rulebookCoaching={rulebookCoaching}
          bestWorstSelf={bestWorstSelf}
          patternLibrary={patternLibrary}
          selectedPatternId={selectedPatternId}
          onSelectedPatternChange={onSelectedPatternChange}
          patternMatches={patternMatches}
          onJumpToPatternMatch={onJumpToPatternMatch}
          sharedSnapshots={sharedSnapshots}
          selectedSharedSnapshotId={selectedSharedSnapshotId}
          onApplySharedSnapshot={onApplySharedSnapshot}
          onCopySharedSnapshotLink={onCopySharedSnapshotLink}
          replayMistakes={replayMistakes}
          sessionId={sessionId}
          onRunMonteCarlo={onRunMonteCarlo}
          isRunningMonteCarlo={isRunningMonteCarlo}
          monteCarloResult={monteCarloResult}
          executionEnvironment={executionEnvironment}
          symbol={symbol}
          intrabarMode={intrabarMode}
          barMagnifierTimeframe={barMagnifierTimeframe}
        />
      </TabsContent>
    </Tabs>
  );
}
