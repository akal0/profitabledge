import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  varchar,
  jsonb,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { trade, tradingAccount } from "./trading";

// Account Following (follow accounts, not people)
export const accountFollow = pgTable(
  "account_follow",
  {
    id: text("id").primaryKey(),
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followedAccountId: text("followed_account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    followedUserId: text("followed_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notificationPreferences: jsonb("notification_preferences")
      .default({
        newTrades: true,
        milestones: true,
        insights: true,
      })
      .$type<{
        newTrades: boolean;
        milestones: boolean;
        insights: boolean;
      }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex("idx_account_follow_unique").on(
      table.followerUserId,
      table.followedAccountId
    ),
    followerIdx: index("idx_account_follow_follower").on(
      table.followerUserId,
      table.createdAt
    ),
    accountIdx: index("idx_account_follow_account").on(
      table.followedAccountId,
      table.createdAt
    ),
  })
);

// Feed Events (auto-generated from verified trades)
export const feedEvent = pgTable(
  "feed_event",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 30 }).notNull(), // trade_closed, streak_milestone, execution_insight, discipline_break, etc.
    tradeId: text("trade_id").references(() => trade.id, {
      onDelete: "cascade",
    }),
    eventData: jsonb("event_data").notNull().$type<{
      symbol?: string;
      tradeType?: string;
      realizedRR?: number;
      availableRR?: number;
      rrCaptureEfficiency?: number;
      exitEfficiency?: number;
      protocolAligned?: boolean;
      sessionTag?: string;
      holdTimeSeconds?: number;
      streakCount?: number;
      streakType?: "win" | "loss";
      disciplineIssue?: string;
      metricChange?: {
        metric: string;
        from: number;
        to: number;
      };
    }>(),
    caption: text("caption"), // Optional, max 60 chars
    isVisible: boolean("is_visible").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("idx_feed_event_account").on(
      table.accountId,
      table.createdAt
    ),
    typeIdx: index("idx_feed_event_type").on(table.eventType, table.createdAt),
    tradeIdx: index("idx_feed_event_trade").on(table.tradeId),
  })
);

// Trade Annotations (timestamped, immutable insights)
export const tradeAnnotation = pgTable(
  "trade_annotation",
  {
    id: text("id").primaryKey(),
    tradeId: text("trade_id")
      .notNull()
      .references(() => trade.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(), // Max 200 chars
    annotationType: varchar("annotation_type", { length: 30 }).notNull(), // execution_note, emotion_note, rule_note, learning_note
    isPublic: boolean("is_public").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    editableUntil: timestamp("editable_until").notNull(), // 5 min grace period
    editedAt: timestamp("edited_at"),
  },
  (table) => ({
    uniqueIdx: uniqueIndex("idx_trade_annotation_unique").on(table.tradeId),
    userIdx: index("idx_trade_annotation_user").on(
      table.userId,
      table.createdAt
    ),
    publicIdx: index("idx_trade_annotation_public").on(
      table.isPublic,
      table.createdAt
    ),
  })
);

// Pattern Follows (follow execution patterns, not people)
export const patternFollow = pgTable(
  "pattern_follow",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // User-defined name
    patternConfig: jsonb("pattern_config").notNull().$type<{
      session?: string;
      symbol?: string;
      minRRCapture?: number;
      minSampleSize?: number;
      minProtocolRate?: number;
      maxDrawdown?: number;
      propFirmId?: string;
    }>(),
    matchCount: integer("match_count").default(0), // Number of accounts matching pattern
    lastMatchedAt: timestamp("last_matched_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_pattern_follow_user").on(
      table.userId,
      table.isActive,
      table.createdAt
    ),
  })
);

// Pattern Matches (cached results)
export const patternMatch = pgTable(
  "pattern_match",
  {
    id: text("id").primaryKey(),
    patternFollowId: text("pattern_follow_id")
      .notNull()
      .references(() => patternFollow.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    matchScore: numeric("match_score"), // How well it matches (0-1)
    metricsSnapshot: jsonb("metrics_snapshot").$type<{
      rrCaptureEfficiency?: number;
      protocolRate?: number;
      sampleSize?: number;
      maxDrawdown?: number;
      medianR?: number;
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    patternIdx: index("idx_pattern_match_pattern").on(
      table.patternFollowId,
      table.matchScore
    ),
    accountIdx: index("idx_pattern_match_account").on(table.accountId),
  })
);

// Mirror Comparisons (private execution comparisons)
export const mirrorComparison = pgTable(
  "mirror_comparison",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    myAccountId: text("my_account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    theirAccountId: text("their_account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    comparisonData: jsonb("comparison_data").notNull().$type<{
      avgHoldTime: { mine: number; theirs: number };
      rrCaptureEfficiency: { mine: number; theirs: number };
      exitEfficiency: { mine: number; theirs: number };
      protocolRate: { mine: number; theirs: number };
    }>(),
    insights: jsonb("insights").$type<string[]>(), // AI-generated insights
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_mirror_comparison_user").on(
      table.userId,
      table.createdAt
    ),
    myAccountIdx: index("idx_mirror_comparison_my_account").on(
      table.myAccountId
    ),
  })
);

// Leaderboard Entry (redesigned for quality metrics)
export const leaderboardEntry = pgTable(
  "leaderboard_entry",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Time period
    period: varchar("period", { length: 20 }).notNull(), // 30d, 90d, all_time
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Category
    category: varchar("category", { length: 30 }).notNull(), // consistency, execution, discipline, risk

    // Metrics (category-specific)
    metricValues: jsonb("metric_values").notNull().$type<{
      // Consistency category
      medianR?: number;
      maxDrawdown?: number; // Also used by Risk category
      varianceR?: number;
      // Execution category
      avgRRCaptureEfficiency?: number;
      avgManipRREfficiency?: number;
      avgExitEfficiency?: number;
      // Discipline category
      protocolAlignmentRate?: number;
      revengeClusterRate?: number;
      sessionAdherenceRate?: number;
      // Risk category (maxDrawdown defined above)
      avgRiskPerTrade?: number;
      slAdherenceRate?: number;
    }>(),

    // Ranking (percentile-based, not #1/#2/#3)
    percentile: integer("percentile"), // 1-100
    percentileBand: varchar("percentile_band", { length: 20 }), // "Top 10%", "Top 25%", etc.

    // Sample requirements
    totalTrades: integer("total_trades").notNull(),
    sampleValid: boolean("sample_valid").default(true),
    minimumTradesRequired: integer("minimum_trades_required").default(100),

    // Filters (for filtered leaderboards)
    propFirmId: text("prop_firm_id"),
    sessionTag: text("session_tag"),
    symbol: varchar("symbol", { length: 64 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex("idx_leaderboard_unique").on(
      table.accountId,
      table.period,
      table.periodStart,
      table.category
    ),
    periodCategoryIdx: index("idx_leaderboard_period_category").on(
      table.period,
      table.category,
      table.percentile,
      table.updatedAt
    ),
    userIdx: index("idx_leaderboard_user").on(
      table.userId,
      table.period,
      table.category
    ),
  })
);

// Activity (simplified, for audit trail)
export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activityType: varchar("activity_type", { length: 30 }).notNull(),
    contentId: text("content_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_activity_user").on(table.userId, table.createdAt),
  })
);

// Bookmark (kept from original, private feature)
export const bookmark = pgTable(
  "bookmark",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentType: varchar("content_type", { length: 20 }).notNull(), // feed_event, trade, account
    contentId: text("content_id").notNull(),
    folder: text("folder"), // Optional folder organization
    notes: text("notes"), // Private notes
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex("idx_bookmark_unique").on(
      table.userId,
      table.contentType,
      table.contentId
    ),
    userIdx: index("idx_bookmark_user").on(table.userId, table.createdAt),
    folderIdx: index("idx_bookmark_folder").on(
      table.userId,
      table.folder,
      table.createdAt
    ),
  })
);
