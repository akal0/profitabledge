import type { JournalBlock, PsychologySnapshot, TradePhase } from "@/components/journal/types";

export type EntryType =
  | "general"
  | "daily"
  | "weekly"
  | "monthly"
  | "trade_review"
  | "strategy"
  | "comparison"
  | "backtest"
  | "edge";

export interface JournalEntryData {
  id?: string;
  title: string;
  emoji?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number;
  content: JournalBlock[];
  tags: string[];
  entryType: string;
  journalDate?: string | null;
  tradePhase?: TradePhase | null;
  psychology?: PsychologySnapshot | null;
  plannedEntryPrice?: string | null;
  plannedExitPrice?: string | null;
  plannedStopLoss?: string | null;
  plannedTakeProfit?: string | null;
  plannedRiskReward?: string | null;
  plannedNotes?: string | null;
  actualOutcome?: "win" | "loss" | "breakeven" | "scratched" | null;
  actualPnl?: string | null;
  actualPips?: string | null;
  postTradeAnalysis?: string | null;
  lessonsLearned?: string | null;
}

export interface JournalEntryPageProps {
  entryId?: string;
  accountId?: string;
  initialContent?: JournalBlock[];
  initialTitle?: string;
  initialEntryType?: string;
  onBack?: () => void;
  onSave?: (entry: JournalEntryData) => void;
}
