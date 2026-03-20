import type { JournalBlock, PsychologySnapshot, TradePhase } from "@/components/journal/types";

export type JournalAICaptureEntryType =
  | "general"
  | "daily"
  | "weekly"
  | "monthly"
  | "trade_review"
  | "strategy"
  | "comparison"
  | "backtest";

export type JournalAICapturePsychologyPatch = Partial<PsychologySnapshot>;
export type JournalAICaptureOutcome =
  | "win"
  | "loss"
  | "breakeven"
  | "scratched"
  | null;

export interface JournalAICaptureResult {
  title: string;
  journalDate: string | null;
  tags: string[];
  entryType: JournalAICaptureEntryType | null;
  tradePhase: TradePhase | null;
  psychology: JournalAICapturePsychologyPatch | null;
  plannedEntryPrice?: string | null;
  plannedExitPrice?: string | null;
  plannedStopLoss?: string | null;
  plannedTakeProfit?: string | null;
  plannedRiskReward?: string | null;
  plannedNotes?: string | null;
  actualOutcome?: JournalAICaptureOutcome;
  actualPnl?: string | null;
  actualPips?: string | null;
  postTradeAnalysis?: string | null;
  lessonsLearned?: string | null;
  transcript?: string | null;
  contentBlocks: JournalBlock[];
}
