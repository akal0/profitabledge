import { pgTable, text, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tradingAccount } from "./trading";

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 32 }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    metadata: jsonb("metadata"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("idx_notification_user_created").on(
      table.userId,
      table.createdAt
    ),
    userDedupeIdx: index("idx_notification_user_dedupe").on(
      table.userId,
      table.dedupeKey
    ),
  })
);
