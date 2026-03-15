import { z } from "zod";

export const alphaMilestoneSchema = z.enum([
  "sign_up_completed",
  "account_connected",
  "trades_synced",
  "journal_entry_created",
  "replay_session_created",
  "assistant_prompt_started",
  "feedback_submitted",
]);

export const supportFeedbackCategorySchema = z.enum([
  "bug",
  "idea",
  "account_sync",
  "ai",
  "ux",
  "other",
]);

export const supportFeedbackPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const clientEventCategorySchema = z.enum([
  "activation",
  "navigation",
  "usage",
  "feedback",
]);
