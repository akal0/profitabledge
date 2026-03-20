import type { JournalBlock, PsychologySnapshot } from "@/components/journal/types";

export interface JournalShareSummary {
  id: string;
  name: string;
  shareToken: string;
  sharePath: string;
  shareUrl: string;
  isActive: boolean;
  revokedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  viewCount: number;
  lastViewedAt?: string | Date | null;
  ownerName: string;
}

export interface SharedJournalEntryListItem {
  id: string;
  title: string;
  emoji?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number | null;
  entryType?: string | null;
  tags: string[];
  journalDate?: string | Date | null;
  updatedAt: string | Date;
  createdAt: string | Date;
  preview?: string;
  tradePhase?: string | null;
  sortOrder?: number;
}

export interface SharedJournalEntryPayload extends SharedJournalEntryListItem {
  content: JournalBlock[];
  wordCount: number | null;
  readTimeMinutes: number | null;
  psychology?: PsychologySnapshot | null;
  plannedEntryPrice?: string | null;
  plannedExitPrice?: string | null;
  plannedStopLoss?: string | null;
  plannedTakeProfit?: string | null;
  plannedRiskReward?: string | null;
  plannedNotes?: string | null;
  actualOutcome?: string | null;
  actualPnl?: string | null;
  actualPips?: string | null;
  postTradeAnalysis?: string | null;
  lessonsLearned?: string | null;
}

export type JournalShareGateState =
  | "approved"
  | "pending"
  | "requestable"
  | "rejected"
  | "inactive";
