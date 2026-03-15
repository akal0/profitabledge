/**
 * Journal Schema
 * 
 * Notion-style journal with block-based content, embedded charts, and trade linking.
 * Supports rich text editing, slash commands, images, and analytics embeds.
 * 
 * Features:
 * - Trade Ideas Journal: Pre-trade, during-trade, post-trade phases
 * - Psychology Tracker: Mood, confidence, emotional state tracking
 * - Media Attachments: Images and videos for trades and entries
 * - AI Integration: Auto-summaries, pattern detection, prompts
 * - Goals Integration: Link entries to trading goals
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  varchar,
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { tradingAccount, trade, goal } from "./trading";

// ============================================================================
// Trade Phase Types
// ============================================================================

export type TradePhase = 'pre-trade' | 'during-trade' | 'post-trade';

// ============================================================================
// Psychology Tracking Types
// ============================================================================

export interface PsychologySnapshot {
  mood: number; // 1-10 scale (1 = terrible, 10 = excellent)
  confidence: number; // 1-10 scale (1 = no confidence, 10 = very confident)
  energy: number; // 1-10 scale (1 = exhausted, 10 = energized)
  focus: number; // 1-10 scale (1 = distracted, 10 = laser focused)
  fear: number; // 1-10 scale (1 = no fear, 10 = terrified)
  greed: number; // 1-10 scale (1 = patient, 10 = fomo/greedy)
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
  notes?: string; // Optional free-form notes about mental state
  tradingEnvironment?: 'home' | 'office' | 'traveling' | 'mobile';
  sleepQuality?: number; // 1-10 scale
  distractions?: boolean;
  marketCondition?: 'trending' | 'ranging' | 'volatile' | 'quiet' | 'unsure';
}

// ============================================================================
// AI-Generated Types
// ============================================================================

export interface JournalAIInsight {
  type: 'pattern' | 'strength' | 'weakness' | 'recommendation' | 'correlation';
  title: string;
  description: string;
  confidence: number; // 0-1
  data?: Record<string, any>;
  createdAt: string;
}

export interface JournalPrompt {
  id: string;
  type: 'trade_review' | 'daily_reflection' | 'pattern_inquiry' | 'goal_progress' | 'psychology_check';
  title: string;
  questions: string[];
  context?: Record<string, any>;
  tradeId?: string;
  goalId?: string;
}

// ============================================================================
// Journal Entry - Main journal page/document
// ============================================================================

export const journalEntry = pgTable("journal_entry", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  title: text("title").notNull().default("Untitled"),
  emoji: varchar("emoji", { length: 10 }),
  coverImageUrl: text("cover_image_url"),
  coverImagePosition: integer("cover_image_position").default(50),
  
  content: jsonb("content").$type<JournalBlock[]>().default([]),
  
  accountIds: jsonb("account_ids").$type<string[]>().default([]),
  linkedTradeIds: jsonb("linked_trade_ids").$type<string[]>().default([]),
  
  // NEW: Goal linking
  linkedGoalIds: jsonb("linked_goal_ids").$type<string[]>().default([]),
  
  entryType: varchar("entry_type", { length: 30 }).default("general"),
  tags: jsonb("tags").$type<string[]>().default([]),
  
  // NEW: Search-optimized content (plain text for full-text search)
  plainTextContent: text("plain_text_content"),
  
  journalDate: timestamp("journal_date"),
  
  isPublished: boolean("is_published").default(false),
  isPinned: boolean("is_pinned").default(false),
  isArchived: boolean("is_archived").default(false),
  
  wordCount: integer("word_count").default(0),
  readTimeMinutes: integer("read_time_minutes").default(0),

  tradePhase: varchar("trade_phase", { length: 20 }), // 'pre-trade' | 'during-trade' | 'post-trade'
  
  psychology: jsonb("psychology").$type<PsychologySnapshot>(),
  
  plannedEntryPrice: numeric("planned_entry_price"),
  plannedExitPrice: numeric("planned_exit_price"),
  plannedStopLoss: numeric("planned_stop_loss"),
  plannedTakeProfit: numeric("planned_take_profit"),
  plannedRiskReward: numeric("planned_risk_reward"),
  plannedNotes: text("planned_notes"),
  
  actualOutcome: varchar("actual_outcome", { length: 20 }), // 'win' | 'loss' | 'breakeven' | 'scratched'
  actualPnl: numeric("actual_pnl"),
  actualPips: numeric("actual_pips"),
  postTradeAnalysis: text("post_trade_analysis"),
  lessonsLearned: text("lessons_learned"),
  
  // NEW: AI-generated fields
  aiSummary: text("ai_summary"), // AI-generated summary
  aiKeyInsights: jsonb("ai_key_insights").$type<string[]>(), // Key insights extracted
  aiPatterns: jsonb("ai_patterns").$type<JournalAIInsight[]>(), // Detected patterns
  aiSentiment: varchar("ai_sentiment", { length: 20 }), // 'positive' | 'negative' | 'neutral' | 'mixed'
  aiTopics: jsonb("ai_topics").$type<string[]>(), // Extracted topics
  aiAnalyzedAt: timestamp("ai_analyzed_at"), // When AI last analyzed this entry
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_journal_entry_user").on(table.userId),
  userDateIdx: index("idx_journal_entry_user_date").on(table.userId, table.journalDate),
  userTypeIdx: index("idx_journal_entry_user_type").on(table.userId, table.entryType),
  pinnedIdx: index("idx_journal_entry_pinned").on(table.userId, table.isPinned),
  tradePhaseIdx: index("idx_journal_entry_trade_phase").on(table.userId, table.tradePhase),
  // NEW: Full-text search index
  searchIdx: index("idx_journal_entry_search").on(table.userId, table.plainTextContent),
  // NEW: Goal linking index
  goalIdx: index("idx_journal_entry_goals").on(table.userId, table.linkedGoalIds),
}));

// ============================================================================
// Journal Entry Goals - Many-to-many relationship
// ============================================================================

export const journalEntryGoal = pgTable("journal_entry_goal", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entryId: text("entry_id")
    .notNull()
    .references(() => journalEntry.id, { onDelete: "cascade" }),
  goalId: text("goal_id")
    .notNull()
    .references(() => goal.id, { onDelete: "cascade" }),
  
  // Optional context for why this goal is linked
  context: text("context"),
  contribution: numeric("contribution"), // How much this entry contributed to the goal
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  entryIdx: index("idx_journal_entry_goal_entry").on(table.entryId),
  goalIdx: index("idx_journal_entry_goal_goal").on(table.goalId),
  uniqueIdx: index("idx_journal_entry_goal_unique").on(table.entryId, table.goalId),
}));

// ============================================================================
// Psychology Performance Correlation - Cached correlation analysis
// ============================================================================

export const psychologyCorrelation = pgTable("psychology_correlation", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  
  // Correlation data
  metric: varchar("metric", { length: 30 }).notNull(), // 'winRate' | 'profit' | 'rr' | 'holdTime'
  psychologyFactor: varchar("psychology_factor", { length: 30 }).notNull(), // 'mood' | 'confidence' | 'energy' | 'focus' | 'fear' | 'greed'
  
  correlationCoefficient: numeric("correlation_coefficient").notNull(), // -1 to 1
  sampleSize: integer("sample_size").notNull(),
  significance: varchar("significance", { length: 20 }), // 'high' | 'medium' | 'low' | 'none'
  
  // Detailed analysis
  insights: jsonb("insights").$type<{
    bestConditions: string;
    worstConditions: string;
    recommendation: string;
    dataPoints: { x: number; y: number }[];
  }>(),
  
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_psych_correlation_user").on(table.userId),
  accountIdx: index("idx_psych_correlation_account").on(table.accountId),
  metricIdx: index("idx_psych_correlation_metric").on(table.userId, table.metric),
}));

// ============================================================================
// Journal Prompts - AI-generated journaling prompts
// ============================================================================

export const journalPromptQueue = pgTable("journal_prompt_queue", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  // Prompt content
  type: varchar("type", { length: 30 }).notNull(),
  title: text("title").notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  
  // Context that triggered this prompt
  triggerType: varchar("trigger_type", { length: 30 }), // 'trade_close' | 'streak' | 'goal_progress' | 'schedule' | 'pattern_detected'
  triggerData: jsonb("trigger_data"),
  
  // Related entities
  tradeId: text("trade_id").references(() => trade.id, { onDelete: "set null" }),
  goalId: text("goal_id").references(() => goal.id, { onDelete: "set null" }),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // 'pending' | 'shown' | 'dismissed' | 'completed'
  shownAt: timestamp("shown_at"),
  completedAt: timestamp("completed_at"),
  dismissedAt: timestamp("dismissed_at"),
  
  // Resulting entry if user journaled
  resultingEntryId: text("resulting_entry_id").references(() => journalEntry.id, { onDelete: "set null" }),
  
  priority: integer("priority").default(0), // Higher = more important
  expiresAt: timestamp("expires_at"), // Optional expiration
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_journal_prompt_user").on(table.userId),
  statusIdx: index("idx_journal_prompt_status").on(table.userId, table.status),
  triggerIdx: index("idx_journal_prompt_trigger").on(table.userId, table.triggerType),
}));

// ============================================================================
// Journal Templates - Reusable templates for journal entries
// ============================================================================

export const journalTemplate = pgTable("journal_template", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null = system template
  
  name: text("name").notNull(),
  description: text("description"),
  emoji: varchar("emoji", { length: 10 }),
  
  // Template content structure
  content: jsonb("content").$type<JournalBlock[]>().default([]),
  
  // Template metadata
  category: varchar("category", { length: 30 }), // 'daily' | 'weekly' | 'trade_review' | 'strategy' | 'custom'
  isSystem: boolean("is_system").default(false), // System-provided templates
  isPublic: boolean("is_public").default(false), // User-shared templates
  usageCount: integer("usage_count").default(0),
  
  // NEW: Trade-type specific templates
  applicableTradeTypes: jsonb("applicable_trade_types").$type<string[]>(), // e.g., ['win', 'loss', 'BE']
  applicableSessions: jsonb("applicable_sessions").$type<string[]>(), // e.g., ['London', 'NY']
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_journal_template_user").on(table.userId),
  categoryIdx: index("idx_journal_template_category").on(table.category),
}));

// ============================================================================
// Journal Media - Uploaded images and videos for journal entries
// ============================================================================

export const journalMedia = pgTable("journal_media", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  entryId: text("entry_id").references(() => journalEntry.id, { onDelete: "set null" }),
  
  mediaType: varchar("media_type", { length: 20 }).notNull(), // 'image' | 'video' | 'screen_recording'
  
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 50 }),
  width: integer("width"),
  height: integer("height"),
  
  durationSeconds: integer("duration_seconds"),
  
  altText: text("alt_text"),
  caption: text("caption"),
  
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_journal_media_user").on(table.userId),
  entryIdx: index("idx_journal_media_entry").on(table.entryId),
  typeIdx: index("idx_journal_media_type").on(table.mediaType),
}));

// Legacy table - kept for backward compatibility
export const journalImage = pgTable("journal_image", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  entryId: text("entry_id").references(() => journalEntry.id, { onDelete: "set null" }),
  
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 50 }),
  width: integer("width"),
  height: integer("height"),
  
  altText: text("alt_text"),
  caption: text("caption"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_journal_image_user").on(table.userId),
  entryIdx: index("idx_journal_image_entry").on(table.entryId),
}));

// ============================================================================
// Trade Media - Uploaded images and videos for trades
// ============================================================================

export const tradeMedia = pgTable("trade_media", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trade.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  mediaType: varchar("media_type", { length: 20 }).notNull(), // 'image' | 'video' | 'screen_recording'
  
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 50 }),
  width: integer("width"),
  height: integer("height"),
  
  durationSeconds: integer("duration_seconds"),
  
  altText: text("alt_text"),
  caption: text("caption"),
  description: text("description"),
  
  isEntryScreenshot: boolean("is_entry_screenshot").default(false),
  isExitScreenshot: boolean("is_exit_screenshot").default(false),
  isAnalysis: boolean("is_analysis").default(false),
  
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tradeIdx: index("idx_trade_media_trade").on(table.tradeId),
  userIdx: index("idx_trade_media_user").on(table.userId),
  typeIdx: index("idx_trade_media_type").on(table.mediaType),
}));

// ============================================================================
// Trade Notes - Rich text annotations for trades
// ============================================================================

export const tradeNote = pgTable("trade_note", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trade.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  content: jsonb("content").$type<JournalBlock[]>().default([]),
  htmlContent: text("html_content"),
  
  plainTextContent: text("plain_text_content"),
  
  wordCount: integer("word_count").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tradeIdx: index("idx_trade_note_trade").on(table.tradeId),
  userIdx: index("idx_trade_note_user").on(table.userId),
}));

// ============================================================================
// Watchlist - Track symbols of interest
// ============================================================================

export const watchlistItem = pgTable("watchlist_item", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  
  symbol: varchar("symbol", { length: 64 }).notNull(),
  
  notes: text("notes"),
  
  tags: jsonb("tags").$type<string[]>().default([]),
  
  priority: integer("priority").default(0), // 0 = normal, 1 = high, -1 = low
  
  status: varchar("status", { length: 20 }).default("watching"), // 'watching' | 'entered' | 'exited' | 'archived'
  
  targetPrice: numeric("target_price"),
  stopPrice: numeric("stop_price"),
  
  lastPrice: numeric("last_price"),
  lastPriceUpdatedAt: timestamp("last_price_updated_at"),
  
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_watchlist_user").on(table.userId),
  accountIdx: index("idx_watchlist_account").on(table.accountId),
  symbolIdx: index("idx_watchlist_symbol").on(table.userId, table.symbol),
  statusIdx: index("idx_watchlist_status").on(table.userId, table.status),
}));

// ============================================================================
// Block Types & Interfaces
// ============================================================================

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
  | 'psychology'
  | 'goal'; // NEW: Goal embed block

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
  trades?: Array<{
    id: string;
    symbol?: string | null;
    tradeDirection?: 'long' | 'short';
    profit?: number | null;
    pips?: number | null;
    close?: string | null;
    outcome?: string | null;
  }>;
  symbol?: string;
  tradeDirection?: 'long' | 'short';
  profit?: number;
  pips?: number;
  closeTime?: string | null;
  outcome?: string | null;
  
  tradeIds?: string[];
  comparisonMetrics?: string[];
  
  // NEW: Goal embed props
  goalId?: string;
  goalDisplay?: 'card' | 'progress' | 'mini';
  
  statType?: string;
  accountId?: string;
  dateRange?: { start: string; end: string };
  
  checked?: boolean;
  
  tableData?: { rows: string[][]; headers?: string[] };
  
  psychologyData?: PsychologySnapshot;
}

// Chart types that can be embedded in journal
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
  accountIds?: string[]; // For comparison charts
  dateRange?: {
    start: string;
    end: string;
  };
  // Chart-specific options
  showComparison?: boolean;
  comparisonType?: 'previous' | 'account';
  height?: number;
  title?: string;
  hideTitle?: boolean;
}

// ============================================================================
// Relations
// ============================================================================

export const journalEntryRelations = relations(journalEntry, ({ one, many }) => ({
  user: one(user, {
    fields: [journalEntry.userId],
    references: [user.id],
  }),
  images: many(journalImage),
  media: many(journalMedia),
  goalLinks: many(journalEntryGoal),
  prompts: many(journalPromptQueue),
}));

export const journalEntryGoalRelations = relations(journalEntryGoal, ({ one }) => ({
  entry: one(journalEntry, {
    fields: [journalEntryGoal.entryId],
    references: [journalEntry.id],
  }),
  goal: one(goal, {
    fields: [journalEntryGoal.goalId],
    references: [goal.id],
  }),
}));

export const journalTemplateRelations = relations(journalTemplate, ({ one }) => ({
  user: one(user, {
    fields: [journalTemplate.userId],
    references: [user.id],
  }),
}));

export const journalImageRelations = relations(journalImage, ({ one }) => ({
  user: one(user, {
    fields: [journalImage.userId],
    references: [user.id],
  }),
  entry: one(journalEntry, {
    fields: [journalImage.entryId],
    references: [journalEntry.id],
  }),
}));

export const journalMediaRelations = relations(journalMedia, ({ one }) => ({
  user: one(user, {
    fields: [journalMedia.userId],
    references: [user.id],
  }),
  entry: one(journalEntry, {
    fields: [journalMedia.entryId],
    references: [journalEntry.id],
  }),
}));

export const tradeMediaRelations = relations(tradeMedia, ({ one }) => ({
  user: one(user, {
    fields: [tradeMedia.userId],
    references: [user.id],
  }),
  trade: one(trade, {
    fields: [tradeMedia.tradeId],
    references: [trade.id],
  }),
}));

export const journalPromptQueueRelations = relations(journalPromptQueue, ({ one }) => ({
  user: one(user, {
    fields: [journalPromptQueue.userId],
    references: [user.id],
  }),
  trade: one(trade, {
    fields: [journalPromptQueue.tradeId],
    references: [trade.id],
  }),
  goal: one(goal, {
    fields: [journalPromptQueue.goalId],
    references: [goal.id],
  }),
  resultingEntry: one(journalEntry, {
    fields: [journalPromptQueue.resultingEntryId],
    references: [journalEntry.id],
  }),
}));

export const psychologyCorrelationRelations = relations(psychologyCorrelation, ({ one }) => ({
  user: one(user, {
    fields: [psychologyCorrelation.userId],
    references: [user.id],
  }),
  account: one(tradingAccount, {
    fields: [psychologyCorrelation.accountId],
    references: [tradingAccount.id],
  }),
}));
