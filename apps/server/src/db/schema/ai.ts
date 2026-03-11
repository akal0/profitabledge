import {
  pgTable,
  text,
  timestamp,
  varchar,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tradingAccount } from "./trading";

// Status enum for AI operations
export const aiStatusEnum = pgEnum("ai_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

// AI Report Chat - stores conversations and generated reports
export const aiReport = pgTable(
  "ai_report",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "set null",
    }), // Optional: specific account context
    title: text("title").notNull(), // Auto-generated from first user message
    description: text("description"), // Optional summary of the report
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: index("idx_ai_report_user_id").on(table.userId),
      accountIdIdx: index("idx_ai_report_account_id").on(table.accountId),
      createdAtIdx: index("idx_ai_report_created_at").on(table.createdAt),
    };
  }
);

// AI Chat Message - individual messages within a report
export const aiChatMessage = pgTable(
  "ai_chat_message",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => aiReport.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(), // Message text
    htmlContent: text("html_content"), // Rich text HTML (for user messages with TipTap)
    intent: text("intent"), // Classified intent (e.g., "weekly-performance", "asset-analysis")
    confidence: varchar("confidence", { length: 20 }), // AI classification confidence (0-1)
    data: jsonb("data"), // Structured data from action handlers (charts, tables, etc.)
    status: aiStatusEnum("status").default("completed"), // For tracking async operations
    error: text("error"), // Error message if status is 'failed'
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      reportIdIdx: index("idx_ai_chat_message_report_id").on(table.reportId),
      createdAtIdx: index("idx_ai_chat_message_created_at").on(
        table.createdAt
      ),
    };
  }
);

// AI Action Log - tracks individual actions/insights executed
export const aiActionLog = pgTable(
  "ai_action_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => aiChatMessage.id, {
      onDelete: "set null",
    }), // Optional: link to chat message
    title: text("title").notNull(), // Human-readable action title
    intent: text("intent").notNull(), // Intent name (e.g., "calculate-average-drawdown")
    userMessage: text("user_message").notNull(), // Original user query
    status: aiStatusEnum("status").default("pending"),
    result: jsonb("result"), // Action handler result
    error: text("error"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => {
    return {
      userIdIdx: index("idx_ai_action_log_user_id").on(table.userId),
      intentIdx: index("idx_ai_action_log_intent").on(table.intent),
      statusIdx: index("idx_ai_action_log_status").on(table.status),
      startedAtIdx: index("idx_ai_action_log_started_at").on(table.startedAt),
    };
  }
);

export type AiReport = typeof aiReport.$inferSelect;
export type AiReportInsert = typeof aiReport.$inferInsert;
export type AiChatMessage = typeof aiChatMessage.$inferSelect;
export type AiChatMessageInsert = typeof aiChatMessage.$inferInsert;
export type AiActionLog = typeof aiActionLog.$inferSelect;
export type AiActionLogInsert = typeof aiActionLog.$inferInsert;
