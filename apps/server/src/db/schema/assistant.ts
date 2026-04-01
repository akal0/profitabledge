import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { tradingAccount } from "./trading";
import type {
  ConversationContext,
  RenderedWidget,
  ToolCall,
} from "../../lib/assistant/types";

export const conversation = pgTable(
  "conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").default("New conversation"),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userLastMessageIdx: index("idx_conversation_user").on(
      table.userId,
      table.lastMessageAt
    ),
  })
);

export const message = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(),
    content: text("content").notNull(),
    widgets: jsonb("widgets").$type<RenderedWidget[]>().default([]),
    toolCalls: jsonb("tool_calls").$type<ToolCall[]>().default([]),
    context: jsonb("context").$type<ConversationContext>(),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    conversationCreatedAtIdx: index("idx_message_conversation").on(
      table.conversationId,
      table.createdAt
    ),
  })
);

export type Conversation = typeof conversation.$inferSelect;
export type ConversationInsert = typeof conversation.$inferInsert;
export type Message = typeof message.$inferSelect;
export type MessageInsert = typeof message.$inferInsert;
