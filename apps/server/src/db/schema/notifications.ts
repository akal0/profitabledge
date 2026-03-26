import {
  pgTable,
  text,
  timestamp,
  varchar,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),
    failureReason: text("failure_reason"),
  },
  (table) => ({
    userCreatedIdx: index("idx_push_subscription_user_created").on(
      table.userId,
      table.createdAt
    ),
    endpointUniqueIdx: uniqueIndex("push_subscription_endpoint_unique").on(
      table.endpoint
    ),
  })
);
