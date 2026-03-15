import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const activationMilestone = pgTable(
  "activation_milestone",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 80 }).notNull(),
    source: varchar("source", { length: 40 }).default("app").notNull(),
    count: integer("count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    userMilestoneUnique: uniqueIndex("activation_milestone_user_key_idx").on(
      table.userId,
      table.key
    ),
    userSeenIdx: index("activation_milestone_user_seen_idx").on(
      table.userId,
      table.lastSeenAt
    ),
  })
);

export const appEvent = pgTable(
  "app_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    category: varchar("category", { length: 40 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    level: varchar("level", { length: 20 }).notNull().default("info"),
    source: varchar("source", { length: 40 }).notNull().default("server"),
    pagePath: text("page_path"),
    summary: text("summary"),
    fingerprint: varchar("fingerprint", { length: 160 }),
    metadata: jsonb("metadata"),
    isUserVisible: boolean("is_user_visible").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("app_event_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    categoryCreatedIdx: index("app_event_category_created_idx").on(
      table.category,
      table.createdAt
    ),
    fingerprintIdx: index("app_event_fingerprint_idx").on(table.fingerprint),
  })
);

export const userFeedback = pgTable(
  "user_feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email"),
    category: varchar("category", { length: 30 }).notNull(),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    pagePath: text("page_path"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("user_feedback_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    statusCreatedIdx: index("user_feedback_status_created_idx").on(
      table.status,
      table.createdAt
    ),
  })
);

export type ActivationMilestoneRow = typeof activationMilestone.$inferSelect;
export type InsertActivationMilestone = typeof activationMilestone.$inferInsert;
export type AppEventRow = typeof appEvent.$inferSelect;
export type InsertAppEvent = typeof appEvent.$inferInsert;
export type UserFeedbackRow = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = typeof userFeedback.$inferInsert;
