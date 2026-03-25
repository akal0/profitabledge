/**
 * Coaching Schema
 *
 * Tables for the proactive AI coaching system:
 * - Trade emotions (pre/during/post-trade emotional state tagging)
 * - Trading rules (user-defined rules + AI evaluation)
 * - Trade checklists (pre-trade checklists + completion tracking)
 * - Trader digests (daily/weekly briefings)
 * - Recommendation log (track AI recommendation effectiveness)
 * - Trader memory (long-term conversational memory)
 * - Trade feedback (post-trade AI evaluation cards)
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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tradingAccount, trade } from "./trading";

// ============================================================================
// Trade Emotion — Quick-tap emotional state per trade per stage
// ============================================================================

export const tradeEmotion = pgTable(
  "trade_emotion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tradeId: text("trade_id").references(() => trade.id, {
      onDelete: "cascade",
    }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    stage: varchar("stage", { length: 20 }).notNull(), // 'pre_entry' | 'during' | 'post_exit'
    emotion: varchar("emotion", { length: 30 }).notNull(), // 'confident' | 'anxious' | 'fomo' | 'revenge' | ...
    intensity: integer("intensity").default(3), // 1-5 scale
    note: text("note"), // optional free-text

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tradeIdx: index("idx_trade_emotion_trade").on(table.tradeId),
    accountIdx: index("idx_trade_emotion_account").on(table.accountId),
    userIdx: index("idx_trade_emotion_user").on(table.userId),
    stageIdx: index("idx_trade_emotion_stage").on(
      table.accountId,
      table.stage
    ),
  })
);

export type TradeEmotionRow = typeof tradeEmotion.$inferSelect;
export type InsertTradeEmotion = typeof tradeEmotion.$inferInsert;

// ============================================================================
// Trading Rule — User-defined rules with automatic evaluation
// ============================================================================

export const tradingRule = pgTable(
  "trading_rule",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    category: varchar("category", { length: 30 }).notNull(), // 'session' | 'symbol' | 'risk' | 'timing' | 'setup' | 'psychology'
    ruleType: varchar("rule_type", { length: 50 }).notNull(), // 'max_trades_per_day' | 'allowed_sessions' | 'max_consecutive_losses' | ...
    label: text("label").notNull(), // Human-readable: "Max 3 trades per day"
    description: text("description"), // Extended explanation

    // Rule parameters (flexible JSON for different rule types)
    parameters: jsonb("parameters").notNull(), // e.g., { maxTrades: 3 } or { allowedSessions: ["London", "New York"] }

    isActive: boolean("is_active").notNull().default(true),
    isSuggested: boolean("is_suggested").notNull().default(false), // AI-suggested rules
    suggestedReason: text("suggested_reason"), // Why AI suggested this

    // Statistics
    violationCount: integer("violation_count").notNull().default(0),
    complianceRate: numeric("compliance_rate"), // 0-100%
    lastViolatedAt: timestamp("last_violated_at"),
    lastEvaluatedAt: timestamp("last_evaluated_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("idx_trading_rule_account").on(table.accountId),
    userIdx: index("idx_trading_rule_user").on(table.userId),
    activeIdx: index("idx_trading_rule_active").on(
      table.accountId,
      table.isActive
    ),
    categoryIdx: index("idx_trading_rule_category").on(
      table.accountId,
      table.category
    ),
  })
);

export type TradingRuleRow = typeof tradingRule.$inferSelect;
export type InsertTradingRule = typeof tradingRule.$inferInsert;

// ============================================================================
// Rule Violation — Individual rule violation events
// ============================================================================

export const ruleViolation = pgTable(
  "rule_violation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ruleId: text("rule_id")
      .notNull()
      .references(() => tradingRule.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tradeId: text("trade_id").references(() => trade.id, {
      onDelete: "set null",
    }),

    description: text("description").notNull(), // "Took 4th trade (max is 3)"
    data: jsonb("data"), // Supporting context

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ruleIdx: index("idx_rule_violation_rule").on(table.ruleId),
    accountIdx: index("idx_rule_violation_account").on(table.accountId),
    userIdx: index("idx_rule_violation_user").on(table.userId),
  })
);

export type RuleViolationRow = typeof ruleViolation.$inferSelect;
export type InsertRuleViolation = typeof ruleViolation.$inferInsert;

// ============================================================================
// Trade Checklist Template — Reusable pre-trade checklists
// ============================================================================

export const tradeChecklistTemplate = pgTable(
  "trade_checklist_template",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    name: text("name").notNull(), // "London Scalp Checklist"
    description: text("description"),
    strategyTag: text("strategy_tag"), // Links to model tag

    items: jsonb("items")
      .notNull()
      .$type<
        Array<{ label: string; isRequired: boolean; category?: string }>
      >(),

    isDefault: boolean("is_default").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("idx_checklist_template_account").on(table.accountId),
    userIdx: index("idx_checklist_template_user").on(table.userId),
  })
);

export type TradeChecklistTemplateRow =
  typeof tradeChecklistTemplate.$inferSelect;
export type InsertTradeChecklistTemplate =
  typeof tradeChecklistTemplate.$inferInsert;

// ============================================================================
// Trade Checklist Result — Per-trade checklist completions
// ============================================================================

export const tradeChecklistResult = pgTable(
  "trade_checklist_result",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tradeId: text("trade_id").references(() => trade.id, {
      onDelete: "cascade",
    }),
    templateId: text("template_id")
      .notNull()
      .references(() => tradeChecklistTemplate.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    completedItems: jsonb("completed_items")
      .notNull()
      .$type<
        Array<{ itemIndex: number; checked: boolean; timestamp?: string }>
      >(),
    completionRate: numeric("completion_rate"), // 0-100%

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tradeIdx: index("idx_checklist_result_trade").on(table.tradeId),
    templateIdx: index("idx_checklist_result_template").on(table.templateId),
    accountIdx: index("idx_checklist_result_account").on(table.accountId),
  })
);

export type TradeChecklistResultRow =
  typeof tradeChecklistResult.$inferSelect;
export type InsertTradeChecklistResult =
  typeof tradeChecklistResult.$inferInsert;

// ============================================================================
// Trader Digest — Daily/weekly AI-generated briefings
// ============================================================================

export const traderDigest = pgTable(
  "trader_digest",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    digestType: varchar("digest_type", { length: 20 }).notNull(), // 'morning' | 'evening' | 'weekly' | 'milestone' | 'trade_close'

    // Structured content
    content: jsonb("content").notNull().$type<{
      // Morning/Evening digest
      review?: {
        tradesToday: number;
        winRate: number;
        pnl: number;
        bestTrade?: string;
        worstTrade?: string;
        edgeMatches: number;
        leakMatches: number;
        reviewedAt?: string;
        label?: "Today's review" | "Yesterday's review" | "Latest trading day";
      };
      outlook?: {
        recommendedSessions: string[];
        avoidSessions: string[];
        focusSymbols: string[];
        streakContext: string;
      };
      progress?: {
        weeklyWinRate: number;
        weeklyPnL: number;
        vs30DayAvgWR: number;
        vs30DayAvgPnL: number;
        trend: "improving" | "stable" | "declining";
      };
      focusItem?: {
        title: string;
        message: string;
        type: "edge" | "leak" | "rule" | "psychology";
      };
      // Trade close feedback
      tradeFeedback?: {
        tradeId: string;
        score: number; // 0-100
        edgeMatch: string | null;
        leakMatch: string | null;
        holdTimeComparison: string;
        rrComparison: string;
        whatIf: string | null;
        aiComment: string;
      };
      // Milestone
      milestone?: {
        milestoneName: string; // "50 trades", "100 trades"
        tradeCount: number;
        highlights: string[];
        improvements: string[];
      };
      // AI narrative
      narrative: string;
    }>(),

    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("idx_trader_digest_account").on(table.accountId),
    userIdx: index("idx_trader_digest_user").on(table.userId),
    typeIdx: index("idx_trader_digest_type").on(
      table.accountId,
      table.digestType
    ),
    unreadIdx: index("idx_trader_digest_unread").on(
      table.accountId,
      table.isRead
    ),
  })
);

export type TraderDigestRow = typeof traderDigest.$inferSelect;
export type InsertTraderDigest = typeof traderDigest.$inferInsert;

// ============================================================================
// Recommendation Log — Track AI recommendation effectiveness
// ============================================================================

export const recommendationLog = pgTable(
  "recommendation_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    category: varchar("category", { length: 30 }).notNull(), // 'edge' | 'leak' | 'rule' | 'psychology' | 'risk' | 'efficiency'
    recommendation: text("recommendation").notNull(),
    context: jsonb("context"), // What data supported this recommendation

    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at"),

    // Outcome tracking
    outcomeTracked: boolean("outcome_tracked").notNull().default(false),
    effectivenessScore: numeric("effectiveness_score"), // -1 to 1

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("idx_recommendation_log_account").on(table.accountId),
    userIdx: index("idx_recommendation_log_user").on(table.userId),
    categoryIdx: index("idx_recommendation_log_category").on(
      table.accountId,
      table.category
    ),
  })
);

export type RecommendationLogRow = typeof recommendationLog.$inferSelect;
export type InsertRecommendationLog = typeof recommendationLog.$inferInsert;

// ============================================================================
// Trader Memory — Long-term AI conversational memory
// ============================================================================

export const traderMemory = pgTable(
  "trader_memory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    category: varchar("category", { length: 20 }).notNull(), // 'preference' | 'goal' | 'context' | 'instruction'
    content: text("content").notNull(), // The fact or preference
    source: varchar("source", { length: 20 }).notNull().default("extracted"), // 'extracted' | 'user_stated'

    confidence: numeric("confidence").default("0.8"), // 0-1
    lastReferencedAt: timestamp("last_referenced_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_trader_memory_user").on(table.userId),
    categoryIdx: index("idx_trader_memory_category").on(
      table.userId,
      table.category
    ),
  })
);

export type TraderMemoryRow = typeof traderMemory.$inferSelect;
export type InsertTraderMemory = typeof traderMemory.$inferInsert;
