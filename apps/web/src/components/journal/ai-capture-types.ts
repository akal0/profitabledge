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

export interface JournalAICaptureResult {
  title: string;
  journalDate: string | null;
  tags: string[];
  entryType: JournalAICaptureEntryType | null;
  tradePhase: TradePhase | null;
  psychology: JournalAICapturePsychologyPatch | null;
  contentBlocks: JournalBlock[];
}
