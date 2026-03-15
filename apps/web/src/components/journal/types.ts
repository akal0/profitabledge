/**
 * Journal Editor Types
 */

export type TradePhase = 'pre-trade' | 'during-trade' | 'post-trade';

export interface PsychologySnapshot {
  mood: number;
  confidence: number;
  energy: number;
  focus: number;
  fear: number;
  greed: number;
  emotionalState:
    | 'calm'
    | 'confident'
    | 'neutral'
    | 'excited'
    | 'anxious'
    | 'stressed'
    | 'frustrated'
    | 'angry'
    | 'confused'
    | 'discouraged'
    | 'overwhelmed'
    | 'regretful'
    | 'impatient';
  notes?: string;
  tradingEnvironment?: 'home' | 'office' | 'traveling' | 'mobile';
  sleepQuality?: number;
  distractions?: boolean;
  marketCondition?: 'trending' | 'ranging' | 'volatile' | 'quiet' | 'unsure';
}

export type JournalBlockType = 
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'checkList'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  | 'image'
  | 'video'
  | 'embed'
  | 'chart'
  | 'trade'
  | 'tradeComparison'
  | 'statCard'
  | 'table'
  | 'psychology';

export interface JournalBlock {
  id: string;
  type: JournalBlockType;
  content: string;
  props?: JournalBlockProps;
  children?: JournalBlock[];
}

export interface JournalBlockProps {
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  imageWidth?: number;
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: number;
  videoCaption?: string;
  videoAutoplay?: boolean;
  videoMuted?: boolean;
  calloutEmoji?: string;
  calloutColor?: string;
  calloutType?: 'info' | 'warning' | 'success' | 'error' | 'note';
  language?: string;
  chartType?: ChartEmbedType;
  chartConfig?: ChartEmbedConfig;
  tradeId?: string;
  tradeDisplay?: 'card' | 'inline' | 'detailed';
  tradeIds?: string[];
  trades?: Array<{
    id: string;
    symbol?: string | null;
    tradeDirection?: 'long' | 'short';
    profit?: number | null;
    pips?: number | null;
    close?: string | null;
    outcome?: string | null;
  }>;
  comparisonMetrics?: string[];
  statType?: string;
  accountId?: string;
  dateRange?: { start: string; end: string };
  checked?: boolean;
  tableData?: { rows: string[][]; headers?: string[] };
  psychologyData?: PsychologySnapshot;
  symbol?: string;
  tradeDirection?: 'long' | 'short';
  profit?: number;
  pips?: number;
  closeTime?: string | null;
  outcome?: string | null;
}

export type ChartEmbedType = 
  | 'equity-curve'
  | 'drawdown'
  | 'daily-net'
  | 'performance-weekday'
  | 'performing-assets'
  | 'performance-heatmap'
  | 'streak-distribution'
  | 'r-multiple-distribution'
  | 'mae-mfe-scatter'
  | 'entry-exit-time';

export interface ChartEmbedConfig {
  accountId?: string;
  accountIds?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  showComparison?: boolean;
  comparisonType?: 'previous' | 'account';
  height?: number;
  title?: string;
  hideTitle?: boolean;
}

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'text' | 'media' | 'analytics' | 'trading';
  action: () => void;
}

export interface MediaAttachment {
  id: string;
  mediaType: 'image' | 'video' | 'screen_recording';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  altText?: string;
  caption?: string;
  sortOrder: number;
  createdAt: Date;
}

export interface JournalEntry {
  id: string;
  title: string;
  emoji?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number;
  content: JournalBlock[];
  accountIds: string[];
  linkedTradeIds: string[];
  entryType: string;
  tags: string[];
  journalDate?: Date | null;
  isPinned: boolean;
  isArchived: boolean;
  wordCount: number;
  readTimeMinutes: number;
  tradePhase?: TradePhase | null;
  psychology?: PsychologySnapshot | null;
  plannedEntryPrice?: string | null;
  plannedExitPrice?: string | null;
  plannedStopLoss?: string | null;
  plannedTakeProfit?: string | null;
  plannedRiskReward?: string | null;
  plannedNotes?: string | null;
  actualOutcome?: 'win' | 'loss' | 'breakeven' | 'scratched' | null;
  actualPnl?: string | null;
  actualPips?: string | null;
  postTradeAnalysis?: string | null;
  lessonsLearned?: string | null;
  createdAt: Date;
  updatedAt: Date;
  images?: MediaAttachment[];
  media?: MediaAttachment[];
}
