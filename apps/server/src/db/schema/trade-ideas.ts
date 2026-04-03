import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import type { StoredProfileEffects } from "../../lib/profile-effects";
import { user } from "./auth";
import { journalEntry, type TradePhase } from "./journal";

export type TradeIdeaDirection = "long" | "short";
export type TradeIdeaPhase = TradePhase;

export const tradeIdeaShare = pgTable(
  "trade_idea_share",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    journalEntryId: text("journal_entry_id").references(() => journalEntry.id, {
      onDelete: "set null",
    }),
    shareToken: varchar("share_token", { length: 32 }).notNull(),

    symbol: text("symbol").notNull(),
    direction: varchar("direction", { length: 10 })
      .$type<TradeIdeaDirection>()
      .notNull(),
    entryPrice: numeric("entry_price"),
    stopLoss: numeric("stop_loss"),
    takeProfit: numeric("take_profit"),
    riskReward: numeric("risk_reward"),

    title: text("title"),
    description: text("description"),
    tradePhase: varchar("trade_phase", { length: 20 }).$type<TradeIdeaPhase>(),
    strategyName: text("strategy_name"),
    timeframe: varchar("timeframe", { length: 10 }),
    session: varchar("session", { length: 30 }),

    chartImageUrl: text("chart_image_url"),
    chartImageWidth: integer("chart_image_width"),
    chartImageHeight: integer("chart_image_height"),

    ogImageUrl: text("og_image_url"),
    ogImageGeneratedAt: timestamp("og_image_generated_at"),

    showUsername: boolean("show_username").notNull().default(true),
    showPrices: boolean("show_prices").notNull().default(true),
    showRR: boolean("show_rr").notNull().default(true),

    authorDisplayName: text("author_display_name"),
    authorUsername: text("author_username"),
    authorAvatarUrl: text("author_avatar_url"),
    authorBannerUrl: text("author_banner_url"),
    authorProfileEffects: jsonb("author_profile_effects").$type<
      StoredProfileEffects | null
    >(),

    isActive: boolean("is_active").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => ({
    userIdx: index("idx_trade_idea_share_user").on(table.userId, table.createdAt),
    tokenIdx: uniqueIndex("trade_idea_share_token_idx").on(table.shareToken),
    activeIdx: index("idx_trade_idea_share_active").on(table.isActive, table.expiresAt),
    journalEntryIdx: index("idx_trade_idea_share_journal_entry").on(
      table.journalEntryId,
      table.createdAt
    ),
  })
);

export const tradeIdeaShareRelations = relations(tradeIdeaShare, ({ one }) => ({
  user: one(user, {
    fields: [tradeIdeaShare.userId],
    references: [user.id],
  }),
  journalEntry: one(journalEntry, {
    fields: [tradeIdeaShare.journalEntryId],
    references: [journalEntry.id],
  }),
}));
